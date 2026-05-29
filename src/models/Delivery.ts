import mongoose, { Document, Schema } from 'mongoose';

export type DeliveryStatus = 'scheduled' | 'out_for_delivery' | 'delivered' | 'missed' | 'paused';

export interface IDelivery extends Document {
  subscription: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  scheduledDate: Date;
  mealsCount: number;
  status: DeliveryStatus;
  assignedDriver?: mongoose.Types.ObjectId;
  deliveredAt?: Date;
  receiptImage?: string;
  driverNote?: string;
  adminNote?: string;
  createdAt: Date;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledDate: { type: Date, required: true },
    mealsCount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'out_for_delivery', 'delivered', 'missed', 'paused'],
      default: 'scheduled',
    },
    assignedDriver: { type: Schema.Types.ObjectId, ref: 'User' },
    deliveredAt: Date,
    receiptImage: String,
    driverNote: String,
    adminNote: String,
  },
  { timestamps: true }
);

// Index for fast daily board lookup
DeliverySchema.index({ scheduledDate: 1, status: 1 });
DeliverySchema.index({ subscription: 1, scheduledDate: 1 });

export default mongoose.model<IDelivery>('Delivery', DeliverySchema);
