import mongoose, { Document, Schema } from 'mongoose';

export type ScheduleType = 'workdays' | 'alldays';
export type SubscriptionStatus = 'pending_payment' | 'active' | 'paused' | 'expired' | 'cancelled';

export interface IMealCustomization {
  portions: number;  // Selected portion count for this meal
  addOns: Array<{ name: string; price: number; quantity: number }>;  // Selected add-ons
}

export interface ISubscription extends Document {
  user: mongoose.Types.ObjectId;

  // Plan configuration
  mealsPerDay: 1 | 2;
  scheduleType: ScheduleType;
  startDate: Date;
  endDate: Date;

  // Meal customization (default: 1 portion, no add-ons)
  mealCustomization: IMealCustomization;

  // Pricing snapshot (locked at time of purchase)
  snapshot: {
    mealPrice: number;
    deliveryFee: number;
    processingFee: number;
    deliveryDays: number;
    mealsPerDay: number;
    portionMultiplier: number;  // e.g., 1.5x if 1.5 portions per meal
    addOnsPerDay: number;       // Total add-ons cost per day
    dailyTotal: number;
    monthlyBase: number;
    totalAmount: number;
    // Cost snapshot for margin tracking
    mealCostPrice: number;
    deliveryCostPrice: number;
    totalCost: number;
    totalProfit: number;
  };

  status: SubscriptionStatus;
  paymentMethod: 'flutterwave' | 'manual_transfer';
  renewalCount: number;
  
  // Auto-renewal configuration
  autoRenewal: boolean;
  lastRenewalDate?: Date;        // When last successful renewal occurred
  lastRenewalAttemptAt?: Date;   // When last renewal attempt was made (success or failure)
  nextRetryAt?: Date;             // When next retry should happen
  renewalAttempts?: number;       // Number of renewal attempts (0-3) for current cycle
  renewalFailureCount?: number;   // Total number of consecutive failures
  notes?: string;
  createdAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    mealsPerDay: { type: Number, enum: [1, 2], required: true },
    scheduleType: { type: String, enum: ['workdays', 'alldays'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    mealCustomization: {
      portions: { type: Number, default: 1 },
      addOns: [
        {
          name: String,
          price: Number,
          quantity: Number,
        }
      ],
    },

    snapshot: {
      mealPrice: Number,
      deliveryFee: Number,
      processingFee: Number,
      deliveryDays: Number,
      mealsPerDay: Number,
      portionMultiplier: Number,
      addOnsPerDay: Number,
      dailyTotal: Number,
      monthlyBase: Number,
      totalAmount: Number,
      mealCostPrice: Number,
      deliveryCostPrice: Number,
      totalCost: Number,
      totalProfit: Number,
    },

    status: {
      type: String,
      enum: ['pending_payment', 'active', 'paused', 'expired', 'cancelled'],
      default: 'pending_payment',
    },
    paymentMethod: { type: String, enum: ['flutterwave', 'manual_transfer'] },
    renewalCount: { type: Number, default: 0 },
    
    // Auto-renewal fields
    autoRenewal: { type: Boolean, default: false },
    lastRenewalDate: Date,
    lastRenewalAttemptAt: Date,
    nextRetryAt: Date,
    renewalAttempts: { type: Number, default: 0 },
    renewalFailureCount: { type: Number, default: 0 },
    
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
