import { Request, Response } from 'express';
import PricingConfig from '../models/PricingConfig';
import { calculatePricing, generate12MonthBreakdown } from '../utils/pricing.util';

// ─── Public: Get pricing config (selling prices only — no cost prices exposed) ──
export const getPublicPricing = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured yet.' });
      return;
    }

    res.json({
      success: true,
      pricing: {
        mealPrice: config.mealPrice,
        deliveryFee: config.deliveryFee,
        processingFee: config.processingFee,
        workdayCount: config.workdayCount,
        allDayCount: config.allDayCount,
        portionOptions: config.portionOptions || [],
        addOns: config.addOns || [],
        manualTransferEnabled: config.manualTransferEnabled,
        // Bank details only if manual transfer is enabled
        ...(config.manualTransferEnabled && {
          bankName: config.bankName,
          accountNumber: config.accountNumber,
          accountName: config.accountName,
        }),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pricing.', error: err });
  }
};

// ─── Public: Live price calculator ────────────────────────────────────────────
export const calculatePrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mealsPerDay, scheduleType, portions = 1, addOns = [] } = req.body as {
      mealsPerDay: 1 | 2;
      scheduleType: 'workdays' | 'alldays';
      portions?: number;
      addOns?: Array<{ name: string; price: number; quantity: number }>;
    };

    if (![1, 2].includes(mealsPerDay) || !['workdays', 'alldays'].includes(scheduleType)) {
      res.status(400).json({ success: false, message: 'Invalid mealsPerDay or scheduleType.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured.' });
      return;
    }

    const breakdown = calculatePricing(config, mealsPerDay, scheduleType, portions, addOns);

    // Return public-safe breakdown (no cost/profit data)
    res.json({
      success: true,
      breakdown: {
        mealsPerDay: breakdown.mealsPerDay,
        scheduleType: breakdown.scheduleType,
        deliveryDays: breakdown.deliveryDays,
        mealCostPerDay: breakdown.mealCostPerDay,
        deliveryFee: breakdown.deliveryFee,
        addOnsPerDay: breakdown.addOnsPerDay,
        dailyTotal: breakdown.dailyTotal,
        monthlyBase: breakdown.monthlyBase,
        processingFee: breakdown.processingFee,
        totalAmount: breakdown.totalAmount,
        // Human-readable line items
        lineItems: [
          { label: `Meal (×${mealsPerDay})`, amount: breakdown.mealCostPerDay },
          { label: 'Delivery fee', amount: breakdown.deliveryFee },
          ...(breakdown.addOnsPerDay > 0 ? [{ label: 'Add-ons / day', amount: breakdown.addOnsPerDay }] : []),
          { label: 'Daily total', amount: breakdown.dailyTotal, highlight: true },
          { label: `× ${breakdown.deliveryDays} ${scheduleType === 'workdays' ? 'working' : ''} days`, amount: breakdown.monthlyBase },
          { label: 'Processing fee', amount: breakdown.processingFee },
          { label: 'TOTAL DUE', amount: breakdown.totalAmount, total: true },
        ],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Calculation failed.', error: err });
  }
};

// ─── Public: Get 12-month pricing breakdown ──────────────────────────────────
export const get12MonthBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mealsPerDay, scheduleType, startDate, portions = 1, addOns = [] } = req.body as {
      mealsPerDay: 1 | 2;
      scheduleType: 'workdays' | 'alldays';
      startDate: string;
      portions?: number;
      addOns?: Array<{ name: string; price: number; quantity: number }>;
    };

    if (![1, 2].includes(mealsPerDay) || !['workdays', 'alldays'].includes(scheduleType)) {
      res.status(400).json({ success: false, message: 'Invalid mealsPerDay or scheduleType.' });
      return;
    }

    const startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid startDate format.' });
      return;
    }

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      res.status(503).json({ success: false, message: 'Pricing not configured.' });
      return;
    }

    const breakdown = generate12MonthBreakdown(config, mealsPerDay, scheduleType, startDateObj, portions, addOns);

    // Return public-safe breakdown (no cost/profit data)
    res.json({
      success: true,
      breakdown: {
        mealsPerDay,
        scheduleType,
        startDate: startDateObj,
        totalAmount12Months: breakdown.totalAmount12Months,
        averageMonthlyAmount: breakdown.averageMonthlyAmount,
        minMonthAmount: breakdown.minMonthAmount,
        maxMonthAmount: breakdown.maxMonthAmount,
        differenceMinMax: breakdown.maxMonthAmount - breakdown.minMonthAmount,
        months: breakdown.months.map(m => ({
          month: m.monthName,
          year: m.year,
          workingDays: m.deliveryDays,
          totalAmount: m.totalAmount,
          lineItems: [
            { label: `Meal (×${mealsPerDay})`, amount: m.mealCostPerDay },
            { label: 'Delivery fee', amount: m.deliveryFee },
            ...(m.addOnsPerDay > 0 ? [{ label: 'Add-ons / day', amount: m.addOnsPerDay }] : []),
            { label: 'Daily total', amount: m.dailyTotal, highlight: true },
            { label: `× ${m.deliveryDays} ${scheduleType === 'workdays' ? 'working' : ''} days`, amount: m.monthlyBase },
            { label: 'Processing fee', amount: m.processingFee },
            { label: 'TOTAL DUE', amount: m.totalAmount, total: true },
          ],
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to calculate 12-month breakdown.', error: err });
  }
};
export const getAdminPricingConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await PricingConfig.findOne().sort({ updatedAt: -1 }).populate('updatedBy', 'name');
    if (!config) {
      res.status(404).json({ success: false, message: 'No pricing config found.' });
      return;
    }

    res.json({
      success: true,
      config: {
        ...config.toJSON(),
        mealProfitPerUnit: config.mealPrice - config.mealCostPrice,
        deliveryProfitPerUnit: config.deliveryFee - config.deliveryCostPrice,
        mealMarginPercent: Math.round(((config.mealPrice - config.mealCostPrice) / config.mealPrice) * 100),
        deliveryMarginPercent: Math.round(((config.deliveryFee - config.deliveryCostPrice) / config.deliveryFee) * 100),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin config.', error: err });
  }
};

// ─── Admin: Update pricing config ─────────────────────────────────────────────
export const updatePricingConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      mealPrice, deliveryFee, processingFee,
      mealCostPrice, deliveryCostPrice,
      workdayCount, allDayCount,
      portionOptions = [],
      addOns = [],
      manualTransferEnabled, bankName, accountNumber, accountName,
    } = req.body;

    // Always keep a single config document (upsert)
    const config = await PricingConfig.findOneAndUpdate(
      {},
      {
        mealPrice, deliveryFee, processingFee,
        mealCostPrice, deliveryCostPrice,
        workdayCount, allDayCount,
        portionOptions,
        addOns,
        manualTransferEnabled, bankName, accountNumber, accountName,
        updatedBy: req.admin!._id,
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Pricing config updated.',
      config,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update pricing.', error: err });
  }
};
