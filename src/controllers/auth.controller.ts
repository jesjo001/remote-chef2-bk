import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import Admin from '../models/Admin';
import { sendMail } from '../services/mail.service';

const serializeUser = (user: { _id?: unknown; id?: unknown; name: string; email: string; phone: string; address: unknown; createdAt?: Date | string, role: string; isEmailVerified?: boolean }) => ({
  id: String(user.id || user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  address: user.address,
  role: user.role,
  isEmailVerified: user.isEmailVerified ?? false,
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

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      name, email, phone, password, address,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
    });

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    try {
      await sendMail({
        to: email,
        subject: 'Verify your email - RemoteChef',
        html: `
          <h2>Welcome to RemoteChef!</h2>
          <p>Please verify your email address to complete your registration:</p>
          <p><a href="${verifyUrl}" style="background:#0066ff;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
          <p>This link expires in 24 hours.</p>
        `,
      });
    } catch (mailErr) {
      console.warn('Failed to send verification email:', mailErr);
    }

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      requiresEmailVerification: true,
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

    if (!user.isEmailVerified) {
      res.status(403).json({ success: false, message: 'Please verify your email before logging in.', requiresEmailVerification: true });
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

// ---------- Verify Email ----------
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid verification token.' });
      return;
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification token.' });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const jwtToken = signUserToken(String(user._id));

    res.json({
      success: true,
      message: 'Email verified successfully.',
      token: jwtToken,
      user: serializeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Email verification failed.', error: err });
  }
};

// ---------- Resend Verification Email ----------
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ success: false, message: 'Email already verified.' });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    await sendMail({
      to: email,
      subject: 'Verify your email - RemoteChef',
      html: `
        <h2>Email Verification</h2>
        <p>Please verify your email address:</p>
        <p><a href="${verifyUrl}" style="background:#0066ff;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });

    res.json({ success: true, message: 'Verification email sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send verification email.', error: err });
  }
};
