import User from '../models/User';
import Subscription from '../models/Subscription';
import Delivery from '../models/Delivery';
import mongoose from 'mongoose';

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
  // Update subscription
  const subscription = await Subscription.findByIdAndUpdate(subscriptionId, { assignedDriver: driverId });
  console.log(subscription);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if(driverId === null) {
    // Unassign driver from subscription
    await Subscription.findByIdAndUpdate(subscriptionId, { assignedDriver: null });

    // Unassign driver from all future deliveries
    await Delivery.updateMany(
      {
        subscription: subscriptionId,
        status: 'scheduled',
        scheduledDate: { $gte: today }
      },
      { assignedDriver: null }
    );
    return;
  }

  // Update all future 'scheduled' deliveries for this subscription (including today)
  const updatedDeliveries = await Delivery.updateMany(
    {
      subscription: subscriptionId,
      status: 'scheduled',
      scheduledDate: { $gte: today }
    },
    { assignedDriver: driverId }
  );
  console.log(updatedDeliveries);
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
