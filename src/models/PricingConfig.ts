import mongoose, { Document, Schema } from 'mongoose';

export interface IPortionOption {
  portions: number;       // e.g., 1, 2, 3
  price: number;          // e.g., 1500 for 1 portion, 3000 for 2 portions
  cost: number;           // internal cost
}

export interface IAddOn {
  name: string;           // e.g., "Soda", "Bottled Water"
  price: number;
  cost: number;           // internal cost
}

export interface IPricingConfig extends Document {
  // Selling prices (what users pay)
  mealPrice: number;          // Per meal, per day
  deliveryFee: number;        // Per delivery day
  processingFee: number;      // Flat monthly fee

  // Cost prices (what the business pays — for profit tracking)
  mealCostPrice: number;      // Actual cost to prepare one meal
  deliveryCostPrice: number;  // Actual cost of one delivery

  // Schedule options
  workdayCount: number;       // Default: 20 (working days in a month)
  allDayCount: number;        // Default: 26 (all days excl. sundays or 30)

  // Portion sizes & add-ons
  portionOptions: IPortionOption[];  // Different portion sizes with pricing
  addOns: IAddOn[];                   // Optional add-ons (soda, water, etc.)

  // Manual transfer toggle
  manualTransferEnabled: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;

  // Computed margins (virtual getters)
  updatedBy: mongoose.Types.ObjectId;
}

const PortionOptionSchema = new Schema<IPortionOption>({
  portions: { type: Number, required: true },
  price: { type: Number, required: true },
  cost: { type: Number, required: true },
}, { _id: false });

const AddOnSchema = new Schema<IAddOn>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  cost: { type: Number, required: true },
}, { _id: false });

const PricingConfigSchema = new Schema<IPricingConfig>(
  {
    mealPrice: { type: Number, required: true, default: 2000 },
    deliveryFee: { type: Number, required: true, default: 1000 },
    processingFee: { type: Number, required: true, default: 10000 },

    mealCostPrice: { type: Number, required: true, default: 1500 },
    deliveryCostPrice: { type: Number, required: true, default: 700 },

    workdayCount: { type: Number, default: 20 },
    allDayCount: { type: Number, default: 26 },

    portionOptions: [PortionOptionSchema],
    addOns: [AddOnSchema],

    manualTransferEnabled: { type: Boolean, default: false },
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountName: { type: String, default: '' },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

// Virtual: profit per meal
PricingConfigSchema.virtual('mealProfitPerUnit').get(function () {
  return this.mealPrice - this.mealCostPrice;
});

// Virtual: profit per delivery
PricingConfigSchema.virtual('deliveryProfitPerUnit').get(function () {
  return this.deliveryFee - this.deliveryCostPrice;
});

PricingConfigSchema.set('toJSON', { virtuals: true });
PricingConfigSchema.set('toObject', { virtuals: true });

export default mongoose.model<IPricingConfig>('PricingConfig', PricingConfigSchema);
