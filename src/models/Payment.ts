import mongoose, { Document, Schema } from 'mongoose';

// ─── Flutterwave / Online Payment ─────────────────────────────────────────────
export interface IPayment extends Document {
  user: mongoose.Types.ObjectId;
  subscription: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  gateway: 'flutterwave' | 'manual_transfer';
  status: 'pending' | 'successful' | 'failed' | 'refunded';
  flwRef?: string;          // Flutterwave transaction reference
  txRef: string;            // Our internal reference
  gatewayResponse?: object; // Raw webhook payload
  paidAt?: Date;
  createdAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    gateway: { type: String, enum: ['flutterwave', 'manual_transfer'], required: true },
    status: { type: String, enum: ['pending', 'successful', 'failed', 'refunded'], default: 'pending' },
    flwRef: String,
    txRef: { type: String, required: true, unique: true },
    gatewayResponse: Schema.Types.Mixed,
    paidAt: Date,
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

// ─── Manual Transfer Receipt ───────────────────────────────────────────────────
export interface IManualTransfer extends Document {
  payment: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  subscription: mongoose.Types.ObjectId;
  receiptUrl: string;        // Uploaded image path
  bankRef?: string;          // Depositor's bank ref (optional)
  senderName?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
}

const ManualTransferSchema = new Schema<IManualTransfer>(
  {
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    receiptUrl: { type: String, required: true },
    bankRef: String,
    senderName: String,
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

export const ManualTransfer = mongoose.model<IManualTransfer>('ManualTransfer', ManualTransferSchema);
