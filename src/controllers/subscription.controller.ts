import { Request, Response } from 'express';
import Subscription from '../models/Subscription';
import PricingConfig from '../models/PricingConfig';
import Delivery from '../models/Delivery';
import User from '../models/User';
import { Payment, IPayment, ManualTransfer } from '../models/Payment';
import { calculatePricing, calculatePricingForRange, generateDeliveryDates, generateTxRef } from '../utils/pricing.util';
import { findAvailableDriver } from '../services/delivery.service';
import { initiateFlutterwavePayment } from '../services/flutterwave.service';

// ---------- User: Create Subscription (initiate) ----------
export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mealsPerDay, scheduleType, startDate, portions = 1, addOns = [], paymentMethod, autoRenewal = false } = req.body as {
      mealsPerDay: 1 | 2;
      scheduleType: 'workdays' | 'alldays';
      startDate: string;
      portions?: number;
      addOns?: Array<{ name: string; price: number; quantity: number }>;
      paymentMethod: 'flutterwave' | 'manual_transfer';
      autoRenewal?: boolean;
      receiptDataUrl?: string;
    };

    // Validate input
    if (![1, 2].includes(mealsPerDay)) {
      res.status(400).json({ success: false, message: 'Invalid mealsPerDay. Must be 1 or 2.' });
      return;
    }
    if (!['workdays', 'alldays'].includes(scheduleType)) {
      res.status(400).json({ success: false, message: 'Invalid scheduleType. Must be workdays or alldays.' });
      return;
    }
    if (!['flutterwave', 'manual_transfer'].includes(paymentMethod)) {
      res.status(400).json({ success: false, message: 'Invalid paymentMethod.' });
      return;
    }
    const startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime()) || startDateObj < new Date()) {
      res.status(400).json({ success: false, message: 'Invalid startDate. Must be a future date.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured. Contact admin.' });
      return;
    }

    // Validate manual transfer option is enabled
    if (paymentMethod === 'manual_transfer' && !config.manualTransferEnabled) {
      res.status(400).json({ success: false, message: 'Manual transfer is currently unavailable.' });
      return;
    }

    // Calculate start and end dates
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

    // Calculate pricing at time of purchase (with actual delivery days in range)
    const breakdown = calculatePricingForRange(config, start, end, mealsPerDay, scheduleType, portions, addOns);

    const subscription = await Subscription.create({
      user: req.user!._id,
      mealsPerDay,
      scheduleType,
      startDate: start,
      endDate: end,
      mealCustomization: {
        portions,
        addOns: addOns.map(a => ({
          name: a.name,
          price: a.price,
          quantity: a.quantity,
        })),
      },
      paymentMethod,
      snapshot: {
        mealPrice: config.mealPrice,
        deliveryFee: config.deliveryFee,
        processingFee: config.processingFee,
        deliveryDays: breakdown.deliveryDays,
        mealsPerDay,
        portionMultiplier: portions,
        addOnsPerDay: breakdown.addOnsPerDay,
        dailyTotal: breakdown.dailyTotal,
        monthlyBase: breakdown.monthlyBase,
        totalAmount: breakdown.totalAmount,
        mealCostPrice: config.mealCostPrice,
        deliveryCostPrice: config.deliveryCostPrice,
        addOnsCostPerDay: breakdown.addOnsCostPerDay,
        totalCost: breakdown.totalCost,
        totalProfit: breakdown.totalProfit,
      },
      status: 'pending_payment',
      autoRenewal,
      renewalAttempts: 0,
      renewalFailureCount: 0,
    });

    // Create payment record
    const txRef = generateTxRef('RC');
    const payment = await Payment.create({
      user: req.user!._id,
      subscription: subscription._id,
      amount: breakdown.totalAmount,
      gateway: paymentMethod,
      txRef,
      status: 'pending',
    });

    if (paymentMethod === 'manual_transfer') {
      await ManualTransfer.create({
        payment: payment._id,
        user: req.user!._id,
        subscription: subscription._id,
        receiptUrl: req.body.receiptDataUrl || '',
        senderName: req.user?.name,
        amount: breakdown.totalAmount,
        status: 'pending',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Subscription initiated. Complete payment to activate.',
      subscription,
      payment: { id: payment._id, txRef: payment.txRef, amount: payment.amount },
      breakdown,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create subscription.', error: err });
  }
};

// ---------- User: Get My Subscriptions ----------
export const getMySubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriptions = await Subscription.find({ user: req.user!._id }).sort({ createdAt: -1 });
    res.json({ success: true, subscriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscriptions.', error: err });
  }
};

// ---------- User: Get My Active Subscription ----------
export const getActiveSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const subscription = await Subscription.findOne({ user: req.user!._id, status: 'active' });
    if (!subscription) {
      res.json({ success: true, subscription: null, message: 'No active subscription.' });
      return;
    }

    // Get upcoming deliveries
    const upcoming = await Delivery.find({
      subscription: subscription._id,
      scheduledDate: { $gte: new Date() },
      status: 'scheduled',
    })
      .sort({ scheduledDate: 1 })
      .limit(5);

    res.json({ success: true, subscription });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch active subscription.', error: err });
  }
};

// ---------- Internal: Activate Subscription + generate deliveries ----------
export const activateSubscription = async (subscriptionId: string): Promise<void> => {
  const updateData: any = { status: 'active' };
  
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) return;

  // Reset renewal attempt tracking for active subscriptions with auto-renewal
  if (subscription.autoRenewal) {
    updateData.renewalAttempts = 0;
    updateData.renewalFailureCount = 0;
  }

  const updatedSubscription = await Subscription.findByIdAndUpdate(
    subscriptionId,
    updateData,
    { new: true }
  );

  if (!updatedSubscription) return;

  const driverId = await findAvailableDriver();
  if (driverId) {
    await Subscription.findByIdAndUpdate(subscriptionId, { assignedDriver: driverId });
  }

  const dates = generateDeliveryDates(updatedSubscription.startDate, updatedSubscription.endDate, updatedSubscription.scheduleType);

  const deliveryDocs = dates.map((date) => ({
    subscription: updatedSubscription._id,
    user: updatedSubscription.user,
    scheduledDate: date,
    mealsCount: updatedSubscription.mealsPerDay,
    status: 'scheduled',
    assignedDriver: driverId || undefined,
  }));

  await Delivery.insertMany(deliveryDocs);
};

// ---------- User: Cancel Subscription ----------
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const subscription = await Subscription.findOne({ _id: req.params.id, user: req.user!._id });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found.' });
      return;
    }
    if (subscription.status !== 'active') {
      res.status(400).json({ success: false, message: 'Only active subscriptions can be cancelled.' });
      return;
    }

    subscription.status = 'cancelled';
    await subscription.save();

    // Cancel future deliveries
    await Delivery.updateMany(
      { subscription: subscription._id, scheduledDate: { $gt: new Date() }, status: 'scheduled' },
      { status: 'paused', adminNote: 'Cancelled by user' }
    );

    res.json({ success: true, message: 'Subscription cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancellation failed.', error: err });
  }
};

// ---------- Internal: Apply Portion Upgrade ----------
export const applyPortionUpgrade = async (subscriptionId: string, newPortions: number): Promise<void> => {
  try {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) return;

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) return;

    // Update portions
    subscription.mealCustomization.portions = newPortions;

    // Recalculate snapshot for future renewals based on current month range
    const newBreakdown = calculatePricingForRange(
      config, 
      subscription.startDate, 
      subscription.endDate, 
      subscription.mealsPerDay, 
      subscription.scheduleType, 
      newPortions, 
      subscription.mealCustomization.addOns
    );
    
    subscription.snapshot = {
      ...subscription.snapshot,
      mealPrice: config.mealPrice,
      portionMultiplier: newPortions,
      dailyTotal: newBreakdown.dailyTotal,
      monthlyBase: newBreakdown.monthlyBase,
      totalAmount: newBreakdown.totalAmount,
      mealCostPrice: config.mealCostPrice,
      totalCost: newBreakdown.totalCost,
      totalProfit: newBreakdown.totalProfit,
    };

    await subscription.save();
    
    // Optional: Update upcoming deliveries mealsCount if it's meant to represent total portions
    // However, the current code in activateSubscription sets mealsCount = mealsPerDay.
    // If the business logic dictates that mealsCount should include portions, we'd update it here.
  } catch (err) {
    console.error('applyPortionUpgrade error:', err);
  }
};

// ---------- User: Calculate Portion Upgrade ----------
export const calculatePortionUpgrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPortions } = req.body;

    const subscription = await Subscription.findOne({ _id: id, user: req.user!._id, status: 'active' });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Active subscription not found.' });
      return;
    }

    if (newPortions <= subscription.mealCustomization.portions) {
      res.status(400).json({ success: false, message: 'New portion count must be greater than current.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured.' });
      return;
    }

    const currentPortionPrice = config.portionOptions.find(p => p.portions === subscription.mealCustomization.portions)?.price || config.mealPrice;
    const newPortionPrice = config.portionOptions.find(p => p.portions === newPortions)?.price;

    if (!newPortionPrice) {
      res.status(400).json({ success: false, message: 'Invalid portion selection.' });
      return;
    }

    const priceDiffPerMeal = newPortionPrice - currentPortionPrice;
    const priceDiffPerDay = priceDiffPerMeal * subscription.mealsPerDay;

    const remainingDeliveries = await Delivery.countDocuments({
      subscription: subscription._id,
      scheduledDate: { $gte: new Date() },
      status: 'scheduled',
    });

    const totalUpgradeCost = priceDiffPerDay * remainingDeliveries;

    res.json({
      success: true,
      currentPortions: subscription.mealCustomization.portions,
      newPortions,
      remainingDeliveries,
      priceDiffPerDay,
      totalUpgradeCost,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to calculate upgrade.', error: err });
  }
};

// ---------- User: Initiate Portion Upgrade Payment ----------
export const initiatePortionUpgrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPortions } = req.body;

    const subscription = await Subscription.findOne({ _id: id, user: req.user!._id, status: 'active' });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Active subscription not found.' });
      return;
    }

    if (newPortions <= subscription.mealCustomization.portions) {
      res.status(400).json({ success: false, message: 'New portion count must be greater than current.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured.' });
      return;
    }

    const currentPortionPrice = config.portionOptions.find(p => p.portions === subscription.mealCustomization.portions)?.price || config.mealPrice;
    const newPortionPrice = config.portionOptions.find(p => p.portions === newPortions)?.price;

    if (!newPortionPrice) {
      res.status(400).json({ success: false, message: 'Invalid portion selection.' });
      return;
    }

    const priceDiffPerMeal = newPortionPrice - currentPortionPrice;
    const priceDiffPerDay = priceDiffPerMeal * subscription.mealsPerDay;

    const remainingDeliveries = await Delivery.countDocuments({
      subscription: subscription._id,
      scheduledDate: { $gte: new Date() },
      status: 'scheduled',
    });

    const totalUpgradeCost = priceDiffPerDay * remainingDeliveries;

    if (totalUpgradeCost <= 0) {
      res.status(400).json({ success: false, message: 'Upgrade cost must be positive.' });
      return;
    }

    // Create a pending payment record for the upgrade
    const txRef = generateTxRef('UP');
    const payment = await Payment.create({
      user: req.user!._id,
      subscription: subscription._id,
      amount: totalUpgradeCost,
      gateway: 'flutterwave',
      txRef,
      status: 'pending',
      type: 'upgrade',
      metadata: { newPortions },
    });

    const result = await initiateFlutterwavePayment(
      totalUpgradeCost,
      req.user!.email,
      req.user!.name,
      req.user!.phone,
      txRef,
      String(subscription._id),
      String(payment._id),
      { type: 'upgrade', newPortions }
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Upgrade payment initiated.',
        payment: { id: payment._id, txRef: payment.txRef, amount: payment.amount },
        authorizationUrl: result.data?.authorization_url || result.data?.link,
      });
    } else {
      res.status(400).json({ success: false, message: 'Failed to initiate payment.', error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to initiate upgrade.', error: err });
  }
};

// ---------- Internal: Apply Add-On Upgrade ----------
export const applyAddOnUpgrade = async (subscriptionId: string, newAddOns: Array<{ name: string; price: number; quantity: number }>): Promise<void> => {
  try {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) return;

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) return;

    // Update add-ons
    subscription.mealCustomization.addOns = newAddOns;

    // Recalculate snapshot for future renewals based on current month range
    const breakdown = calculatePricingForRange(
      config, 
      subscription.startDate,
      subscription.endDate,
      subscription.mealsPerDay, 
      subscription.scheduleType, 
      subscription.mealCustomization.portions, 
      newAddOns
    );
    
    subscription.snapshot = {
      ...subscription.snapshot,
      addOnsPerDay: breakdown.addOnsPerDay,
      dailyTotal: breakdown.dailyTotal,
      monthlyBase: breakdown.monthlyBase,
      totalAmount: breakdown.totalAmount,
      addOnsCostPerDay: breakdown.addOnsCostPerDay,
      totalCost: breakdown.totalCost,
      totalProfit: breakdown.totalProfit,
    };
    
    await subscription.save();
  } catch (err) {
    console.error('applyAddOnUpgrade error:', err);
  }
};

// ---------- User: Calculate Add-On Upgrade ----------
export const calculateAddOnUpgrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newAddOns } = req.body as { newAddOns: Array<{ name: string; quantity: number }> };

    const subscription = await Subscription.findOne({ _id: id, user: req.user!._id, status: 'active' });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Active subscription not found.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured.' });
      return;
    }

    const currentAddOns = subscription.mealCustomization.addOns || [];
    let totalDiffPerDay = 0;
    const validatedNewAddOns: any[] = [];

    // Check for subtractions and calculate cost
    for (const newAddOn of newAddOns) {
      const configItem = config.addOns.find(a => a.name === newAddOn.name);
      if (!configItem) {
        res.status(400).json({ success: false, message: `Invalid add-on: ${newAddOn.name}` });
        return;
      }

      const currentItem = currentAddOns.find(a => a.name === newAddOn.name);
      const currentQty = currentItem?.quantity || 0;

      if (newAddOn.quantity < currentQty) {
        res.status(400).json({ success: false, message: `Cannot reduce quantity for ${newAddOn.name}.` });
        return;
      }

      const qtyDiff = newAddOn.quantity - currentQty;
      totalDiffPerDay += qtyDiff * configItem.price;

      validatedNewAddOns.push({
        name: configItem.name,
        price: configItem.price,
        quantity: newAddOn.quantity
      });
    }

    // Ensure all current add-ons are present in new list (no removal)
    for (const current of currentAddOns) {
      if (!newAddOns.find(n => n.name === current.name)) {
        res.status(400).json({ success: false, message: `Cannot remove existing add-on: ${current.name}` });
        return;
      }
    }

    const remainingDeliveries = await Delivery.countDocuments({
      subscription: subscription._id,
      scheduledDate: { $gte: new Date() },
      status: 'scheduled',
    });

    const totalUpgradeCost = totalDiffPerDay * remainingDeliveries;

    res.json({
      success: true,
      currentAddOns,
      newAddOns: validatedNewAddOns,
      remainingDeliveries,
      totalDiffPerDay,
      totalUpgradeCost,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to calculate upgrade.', error: err });
  }
};

// ---------- User: Initiate Add-On Upgrade Payment ----------
export const initiateAddOnUpgrade = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newAddOns } = req.body;

    const subscription = await Subscription.findOne({ _id: id, user: req.user!._id, status: 'active' });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Active subscription not found.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured.' });
      return;
    }

    const currentAddOns = subscription.mealCustomization.addOns || [];
    let totalDiffPerDay = 0;
    const validatedNewAddOns: any[] = [];

    for (const newAddOn of newAddOns) {
      const configItem = config.addOns.find(a => a.name === newAddOn.name);
      if (!configItem) continue;

      const currentItem = currentAddOns.find(a => a.name === newAddOn.name);
      const currentQty = currentItem?.quantity || 0;

      if (newAddOn.quantity < currentQty) {
        res.status(400).json({ success: false, message: `Cannot reduce quantity for ${newAddOn.name}.` });
        return;
      }

      const qtyDiff = newAddOn.quantity - currentQty;
      totalDiffPerDay += qtyDiff * configItem.price;

      validatedNewAddOns.push({
        name: configItem.name,
        price: configItem.price,
        quantity: newAddOn.quantity
      });
    }

    const remainingDeliveries = await Delivery.countDocuments({
      subscription: subscription._id,
      scheduledDate: { $gte: new Date() },
      status: 'scheduled',
    });

    const totalUpgradeCost = totalDiffPerDay * remainingDeliveries;

    if (totalUpgradeCost <= 0) {
      res.status(400).json({ success: false, message: 'Upgrade cost must be positive.' });
      return;
    }

    const txRef = generateTxRef('UP');
    const payment = await Payment.create({
      user: req.user!._id,
      subscription: subscription._id,
      amount: totalUpgradeCost,
      gateway: 'flutterwave',
      txRef,
      status: 'pending',
      type: 'upgrade',
      metadata: { newAddOns: validatedNewAddOns },
    });

    const result = await initiateFlutterwavePayment(
      totalUpgradeCost,
      req.user!.email,
      req.user!.name,
      req.user!.phone,
      txRef,
      String(subscription._id),
      String(payment._id),
      { type: 'upgrade', upgradeType: 'addons' }
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Upgrade payment initiated.',
        payment: { id: payment._id, txRef: payment.txRef, amount: payment.amount },
        authorizationUrl: result.data?.authorization_url || result.data?.link,
      });
    } else {
      res.status(400).json({ success: false, message: 'Failed to initiate payment.', error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to initiate upgrade.', error: err });
  }
};
