import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  role: 'superadmin' | 'admin';
  isActive: boolean;
  comparePassword(candidate: string): Promise<boolean>;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

AdminSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IAdmin>('Admin', AdminSchema);
