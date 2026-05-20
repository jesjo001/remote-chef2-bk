import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Admin, { IAdmin } from '../models/Admin';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      admin?: IAdmin;
    }
  }
}

interface JwtPayload {
  id: string;
  role?: string;
}

// ─── User Auth ─────────────────────────────────────────────────────────────────
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized. No token.' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User not found or inactive.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// ─── Admin Auth ────────────────────────────────────────────────────────────────
export const adminProtect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, message: 'Admin access denied. No token.' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET as string) as JwtPayload;
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin || !admin.isActive) {
      res.status(401).json({ success: false, message: 'Admin not found or inactive.' });
      return;
    }

    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid admin token.' });
  }
};

// ─── Superadmin Only ───────────────────────────────────────────────────────────
export const superAdminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.admin?.role !== 'superadmin') {
    res.status(403).json({ success: false, message: 'Superadmin access required.' });
    return;
  }
  next();
};
