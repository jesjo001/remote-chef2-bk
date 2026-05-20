import { Request, Response } from 'express';
import Subscription from '../models/Subscription';
import PricingConfig from '../models/PricingConfig';
import Delivery from '../models/Delivery';
import { Payment, ManualTransfer } from '../models/Payment';
import { calculatePricing, generateDeliveryDates, generateTxRef } from '../utils/pricing.util';

// ─── User: Create Subscription (initiate) ─────────────────────────────────────
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

    // Calculate pricing at time of purchase (with portions and add-ons)
    const breakdown = calculatePricing(config, mealsPerDay, scheduleType, portions, addOns);

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);

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

// ─── User: Get My Subscriptions ────────────────────────────────────────────────
export const getMySubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriptions = await Subscription.find({ user: req.user!._id }).sort({ createdAt: -1 });
    res.json({ success: true, subscriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscriptions.', error: err });
  }
};

// ─── User: Get My Active Subscription ─────────────────────────────────────────
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

// ─── Internal: Activate Subscription + generate deliveries ───────────────────
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

  const dates = generateDeliveryDates(updatedSubscription.startDate, updatedSubscription.endDate, updatedSubscription.scheduleType);

  const deliveryDocs = dates.map((date) => ({
    subscription: updatedSubscription._id,
    user: updatedSubscription.user,
    scheduledDate: date,
    mealsCount: updatedSubscription.mealsPerDay,
    status: 'scheduled',
  }));

  await Delivery.insertMany(deliveryDocs);
};

// ─── User: Cancel Subscription ─────────────────────────────────────────────────
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
