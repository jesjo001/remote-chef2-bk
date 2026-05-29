import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Admin from '../models/Admin';

const serializeUser = (user: { _id?: unknown; id?: unknown; name: string; email: string; phone: string; address: unknown; createdAt?: Date | string, role: string }) => ({
  id: String(user.id || user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  address: user.address,
  role: user.role,
  createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt || new Date().toISOString()),
});

const signUserToken = (id: string) =>
  jwt.sign({ id }, process.env.JWT_SECRET as jwt.Secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });

const signAdminToken = (id: string) =>
  jwt.sign({ id, isAdmin: true }, process.env.JWT_ADMIN_SECRET as jwt.Secret, {
    expiresIn: '1d' as jwt.SignOptions['expiresIn'],
  });

// ---------- User Register ----------
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password, address } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already registered.' });
      return;
    }

    const user = await User.create({ name, email, phone, password, address });
    const token = signUserToken(String(user._id));

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Registration failed.', error: err });
  }
};

// ---------- User Login ----------
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is deactivated.' });
      return;
    }

    const token = signUserToken(String(user._id));

    console.log("User logged in:", serializeUser(user));
    res.json({
      success: true,
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed.', error: err });
  }
};

// ---------- Get My Profile ----------
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  res.json({ success: true, user: serializeUser(req.user as unknown as { _id?: unknown; id?: unknown; name: string; email: string; phone: string; address: unknown; createdAt?: Date | string, role: string }) });
};

// ---------- Update My Profile ----------
export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, address } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { name, phone, address },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user: user ? serializeUser(user) : null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Profile update failed.', error: err });
  }
};

// ---------- Admin Login ----------
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
      return;
    }

    const token = signAdminToken(String(admin._id));
    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Admin login failed.', error: err });
  }
};

// ---------- Admin: Get Own Profile ----------
export const getAdminProfile = async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    admin: req.admin
      ? {
          id: String(req.admin._id || req.admin.id),
          name: req.admin.name,
          email: req.admin.email,
          role: req.admin.role,
        }
      : null,
  });
};
