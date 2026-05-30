import User from '../models/User';
import Subscription from '../models/Subscription';
import Delivery from '../models/Delivery';
import mongoose from 'mongoose';
import { sendMail } from './mail.service';

/**
 * Automatically find an available driver.
 * Strategy: Round-robin (find driver with least active subscriptions or just pick next)
 * For simplicity, we'll pick a driver who is active.
 */
export const findAvailableDriver = async (): Promise<mongoose.Types.ObjectId | null> => {
  const drivers = await User.find({ role: 'driver', isActive: true });
  if (drivers.length === 0) return null;

  // Simple logic: pick a random one for now, or you could implement more complex logic
  const randomIndex = Math.floor(Math.random() * drivers.length);
  return drivers[randomIndex]._id as mongoose.Types.ObjectId;
};

/**
 * Assign a driver to a subscription and all its future deliveries
 */
export const assignDriverToSubscription = async (
  subscriptionId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId | null
): Promise<void> => {
  // Get subscription and user details for the email
  const subscription = await Subscription.findById(subscriptionId).populate('user');
  if (!subscription) return;

  const oldDriverId = subscription.assignedDriver;
  
  // Update subscription
  subscription.assignedDriver = driverId;
  await subscription.save();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Update all future 'scheduled' deliveries for this subscription (including today)
  await Delivery.updateMany(
    {
      subscription: subscriptionId,
      status: 'scheduled',
      scheduledDate: { $gte: today }
    },
    { assignedDriver: driverId }
  );

  // Send Emails
  const user = subscription.user as any;
  const area = user?.address?.area || 'N/A';
  const name = user?.name || 'Customer';

  // 1. Notify old driver if they were unassigned
  if (oldDriverId) {
    const oldDriver = await User.findById(oldDriverId);
    if (oldDriver && oldDriver.role === 'driver') {
      await sendMail({
        to: oldDriver.email,
        subject: 'Delivery Subscription Unassigned',
        html: `
          <p>Hi ${oldDriver.name},</p>
          <p>A delivery subscription for <strong>${name}</strong> in <strong>${area}</strong> has been unassigned from you.</p>
          <p>This subscription will no longer appear in your upcoming deliveries.</p>
        `
      }).catch(err => console.error('Error sending unassign email:', err));
    }
  }

  // 2. Notify new driver if assigned
  if (driverId) {
    const newDriver = await User.findById(driverId);
    if (newDriver && newDriver.role === 'driver') {
      await sendMail({
        to: newDriver.email,
        subject: 'New Delivery Subscription Assigned',
        html: `
          <p>Hi ${newDriver.name},</p>
          <p>A new delivery subscription has been assigned to you!</p>
          <ul>
            <li><strong>Customer:</strong> ${name}</li>
            <li><strong>Area:</strong> ${area}</li>
            <li><strong>Plan:</strong> ${subscription.mealsPerDay} meals/day (${subscription.scheduleType})</li>
          </ul>
          <p>Please log in to your dashboard to see the scheduled deliveries.</p>
        `
      }).catch(err => console.error('Error sending assign email:', err));
    }
  }
};

/**
 * Create deliveries for a subscription and assign a driver
 */
export const createDeliveriesForSubscription = async (subscriptionId: string): Promise<void> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) return;

  let driverId = subscription.assignedDriver;
  if (!driverId) {
    driverId = await findAvailableDriver() || undefined;
    if (driverId) {
      subscription.assignedDriver = driverId;
      await subscription.save();
    }
  }

  // This logic is mostly handled in subscription.controller.ts activateSubscription
  // but we can move it here or ensure it calls this.
};

/**
 * Reassign all active subscriptions and scheduled deliveries from one driver to another
 */
export const reassignAllDriverTasks = async (
  oldDriverId: string | mongoose.Types.ObjectId,
  newDriverId: string | mongoose.Types.ObjectId | null
): Promise<{ subscriptionsCount: number; deliveriesCount: number }> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get driver details
  const oldDriver = await User.findById(oldDriverId);
  const newDriver = newDriverId ? await User.findById(newDriverId) : null;

  // 1. Reassign all active/paused subscriptions
  const subResult = await Subscription.updateMany(
    { assignedDriver: oldDriverId, status: { $in: ['active', 'paused', 'pending_payment'] } },
    { assignedDriver: newDriverId }
  );

  // 2. Reassign all future scheduled deliveries
  const deliveryResult = await Delivery.updateMany(
    { 
      assignedDriver: oldDriverId, 
      status: 'scheduled',
      scheduledDate: { $gte: today }
    },
    { assignedDriver: newDriverId }
  );

  // Send Summary Emails
  if (oldDriver && oldDriver.role === 'driver') {
    await sendMail({
      to: oldDriver.email,
      subject: 'Deliveries Unassigned',
      html: `
        <p>Hi ${oldDriver.name},</p>
        <p>All your active delivery subscriptions (${subResult.modifiedCount}) and upcoming scheduled deliveries (${deliveryResult.modifiedCount}) have been unassigned from you.</p>
      `
    }).catch(err => console.error('Error sending batch unassign email:', err));
  }

  if (newDriver && newDriver.role === 'driver') {
    await sendMail({
      to: newDriver.email,
      subject: 'New Deliveries Assigned',
      html: `
        <p>Hi ${newDriver.name},</p>
        <p>You have been assigned new delivery tasks!</p>
        <ul>
          <li><strong>New Subscriptions:</strong> ${subResult.modifiedCount}</li>
          <li><strong>Upcoming Deliveries:</strong> ${deliveryResult.modifiedCount}</li>
        </ul>
        <p>Please log in to your dashboard to view your updated delivery schedule.</p>
      `
    }).catch(err => console.error('Error sending batch assign email:', err));
  }

  return {
    subscriptionsCount: subResult.modifiedCount,
    deliveriesCount: deliveryResult.modifiedCount
  };
};
