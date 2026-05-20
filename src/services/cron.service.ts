import cron from 'node-cron';
import Subscription from '../models/Subscription';
import Delivery from '../models/Delivery';
import PricingConfig from '../models/PricingConfig';
import { Payment } from '../models/Payment';
import { generateTxRef, calculatePricingForMonth } from '../utils/pricing.util';

// ─── Daily Cron: 6:00 AM — Expire old subscriptions ──────────────────────────
export const startCronJobs = (): void => {
  // Run every day at 6:00 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('⏰ Running daily cron: checking expired subscriptions...');
    try {
      const result = await Subscription.updateMany(
        { status: 'active', endDate: { $lt: new Date() } },
        { status: 'expired' }
      );
      console.log(`✅ Expired ${result.modifiedCount} subscriptions.`);
    } catch (err) {
      console.error('Cron error (expire subscriptions):', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Run every day at 7:00 AM — log today's delivery count for admin awareness
  cron.schedule('0 7 * * *', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const count = await Delivery.countDocuments({
      scheduledDate: { $gte: today, $lte: todayEnd },
      status: 'scheduled',
    });

    console.log(`🚚 RemoteChef: ${count} deliveries scheduled for today (${today.toDateString()}).`);
  }, { timezone: 'Africa/Lagos' });

  // Run every day at 8:00 AM — Check for auto-renewal subscriptions (5 days before end)
  cron.schedule('0 8 * * *', async () => {
    console.log('🔄 Running daily cron: checking subscriptions for auto-renewal (5 days before end)...');
    try {
      await triggerAutoRenewals();
    } catch (err) {
      console.error('Cron error (auto-renewal trigger):', err);
    }
  }, { timezone: 'Africa/Lagos' });

  // Run every 2 hours — Process retry attempts for failed renewals
  cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Running cron: processing auto-renewal retries...');
    try {
      await processAutoRenewalRetries();
    } catch (err) {
      console.error('Cron error (auto-renewal retries):', err);
    }
  }, { timezone: 'Africa/Lagos' });

  console.log('✅ Cron jobs started (Africa/Lagos timezone).');
};

/**
 * Trigger auto-renewals when subscription is 5 days from expiry
 * Conditions:
 * - Status: active
 * - Auto-renewal enabled
 * - Not already attempted this renewal cycle
 * - Days until end: <= 5 days
 */
async function triggerAutoRenewals(): Promise<void> {
  try {
    const now = new Date();
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    // Find subscriptions with auto-renewal enabled that end within 5 days
    // and haven't started renewal attempt yet
    const subscriptionsToRenew = await Subscription.find({
      status: 'active',
      autoRenewal: true,
      renewalAttempts: { $lt: 1 }, // Not yet attempted
      endDate: { $gte: now, $lte: fiveDaysFromNow },
    }).populate('user');

    console.log(`Found ${subscriptionsToRenew.length} subscriptions to trigger auto-renewal (5 days before end).`);

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      console.error('Pricing config not found for auto-renewal.');
      return;
    }

    for (const subscription of subscriptionsToRenew) {
      await attemptAutoRenewal(subscription, config, now);
    }
  } catch (err) {
    console.error('Error in triggerAutoRenewals:', err);
  }
}

/**
 * Process retry attempts for failed renewals
 * Retries happen 24 hours apart, max 3 attempts total
 */
async function processAutoRenewalRetries(): Promise<void> {
  try {
    const now = new Date();

    // Find subscriptions waiting for retry
    const subscriptionsForRetry = await Subscription.find({
      status: 'active',
      autoRenewal: true,
      renewalAttempts: { $gt: 0, $lt: 3 }, // Attempted but not completed all 3
      nextRetryAt: { $lte: now },
    }).populate('user');

    console.log(`Found ${subscriptionsForRetry.length} subscriptions for retry.`);

    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      console.error('Pricing config not found for auto-renewal retry.');
      return;
    }

    for (const subscription of subscriptionsForRetry) {
      await attemptAutoRenewal(subscription, config, now);
    }
  } catch (err) {
    console.error('Error in processAutoRenewalRetries:', err);
  }
}

/**
 * Attempt auto-renewal for a subscription
 * Increments renewal attempts and sets retry timing on failure
 */
async function attemptAutoRenewal(subscription: any, config: any, now: Date): Promise<void> {
  try {
    console.log(`🔄 Attempting auto-renewal for subscription ${subscription._id} (attempt ${(subscription.renewalAttempts || 0) + 1}/3)`);

    // Calculate next month's dates
    const nextStart = new Date(subscription.endDate);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    nextEnd.setDate(nextEnd.getDate() - 1);

    // Calculate pricing for next month using actual workday count
    const breakdown = calculatePricingForMonth(
      config,
      subscription.mealsPerDay,
      subscription.scheduleType,
      nextStart.getFullYear(),
      nextStart.getMonth(),
      subscription.mealCustomization.portions,
      subscription.mealCustomization.addOns
    );

    // Update subscription dates and renewal count
    subscription.startDate = nextStart;
    subscription.endDate = nextEnd;
    subscription.renewalCount = (subscription.renewalCount || 0) + 1;
    subscription.lastRenewalDate = now;
    subscription.lastRenewalAttemptAt = now;
    subscription.renewalAttempts = (subscription.renewalAttempts || 0) + 1;
    subscription.renewalFailureCount = 0; // Reset failure count on successful attempt

    // Update snapshot with new pricing
    subscription.snapshot = {
      mealPrice: config.mealPrice,
      deliveryFee: config.deliveryFee,
      processingFee: config.processingFee,
      deliveryDays: breakdown.deliveryDays,
      mealsPerDay: subscription.mealsPerDay,
      portionMultiplier: subscription.mealCustomization.portions,
      addOnsPerDay: breakdown.addOnsPerDay,
      dailyTotal: breakdown.dailyTotal,
      monthlyBase: breakdown.monthlyBase,
      totalAmount: breakdown.totalAmount,
      mealCostPrice: config.mealCostPrice,
      deliveryCostPrice: config.deliveryCostPrice,
      addOnsCostPerDay: breakdown.addOnsCostPerDay,
      totalCost: breakdown.totalCost,
      totalProfit: breakdown.totalProfit,
    };

    // Create payment record for renewal
    const txRef = generateTxRef('RC-RENEW');
    const payment = await Payment.create({
      user: subscription.user._id || subscription.user,
      subscription: subscription._id,
      amount: breakdown.totalAmount,
      gateway: subscription.paymentMethod,
      txRef,
      status: 'pending',
    });

    // Save updated subscription
    subscription.nextRetryAt = undefined; // Clear retry schedule on successful payment initiation
    await subscription.save();

    console.log(`✅ Auto-renewal attempt ${subscription.renewalAttempts}/3 successful for subscription ${subscription._id}. Payment ${payment._id} created for amount ${breakdown.totalAmount}.`);

  } catch (err) {
    console.error(`Error attempting auto-renewal for subscription ${subscription._id}:`, err);

    // Schedule retry: increment attempt count and set next retry in 24 hours
    subscription.renewalAttempts = (subscription.renewalAttempts || 0) + 1;
    subscription.lastRenewalAttemptAt = now;

    if (subscription.renewalAttempts < 3) {
      // Schedule retry in 24 hours
      const nextRetry = new Date(now);
      nextRetry.setHours(nextRetry.getHours() + 24);
      subscription.nextRetryAt = nextRetry;
      console.warn(`Auto-renewal failed for subscription ${subscription._id}. Retry ${subscription.renewalAttempts}/3 scheduled for ${nextRetry.toISOString()}`);
    } else {
      // All 3 attempts failed - disable auto-renewal
      // Subscription will expire naturally in 2 days, giving user time to renew manually
      subscription.autoRenewal = false;
      subscription.nextRetryAt = undefined;
      subscription.renewalFailureCount = (subscription.renewalFailureCount || 0) + 1;
      console.error(`❌ Auto-renewal permanently disabled for subscription ${subscription._id} after 3 failed attempts. User has 2 days to renew manually.`);
    }

    await subscription.save();
  }
}

