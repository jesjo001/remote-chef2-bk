import { Request, Response } from 'express';
import User from '../models/User';
import Subscription from '../models/Subscription';
import Delivery from '../models/Delivery';
import { Payment, ManualTransfer } from '../models/Payment';
import Admin from '../models/Admin';

// ─── Dashboard Overview ────────────────────────────────────────────────────────
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeSubscriptions,
      pendingPayments,
      todayDeliveries,
      thisMonthRevenue,
      allTimeRevenue,
      allTimeProfit,
      pendingTransfers,
      recentPayments,
    ] = await Promise.all([
      User.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'pending_payment' }),
      Delivery.countDocuments({
        scheduledDate: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
        status: { $in: ['scheduled', 'out_for_delivery'] },
      }),
      Payment.aggregate([
        { $match: { status: 'successful', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Profit from subscription snapshots
      Subscription.aggregate([
        { $match: { status: { $in: ['active', 'expired'] } } },
        { $group: { _id: null, totalProfit: { $sum: '$snapshot.totalProfit' } } },
      ]),
      ManualTransfer.countDocuments({ status: 'pending' }),
      Payment.find().sort({ createdAt: -1 }).limit(6),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeSubscriptions,
        pendingPayments,
        todayDeliveries,
        thisMonthRevenue: thisMonthRevenue[0]?.total || 0,
        allTimeRevenue: allTimeRevenue[0]?.total || 0,
        estimatedProfit: allTimeProfit[0]?.totalProfit || 0,
        pendingTransfers,
        recent: recentPayments.map((payment) => ({
          id: payment._id,
          method: payment.gateway,
          amount: payment.amount,
          status: payment.status === 'successful' ? 'success' : payment.status,
          createdAt: payment.paidAt || payment.createdAt,
          reference: payment.txRef,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Dashboard stats failed.', error: err });
  }
};

// ─── Admin: Get All Subscribers ────────────────────────────────────────────────
export const getAllSubscribers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query: Record<string, unknown> = {};
    if (status && ['active', 'pending_payment', 'paused', 'expired', 'cancelled'].includes(String(status))) {
      query.status = status;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [subscriptions, total] = await Promise.all([
      Subscription.find(query)
        .populate('user', 'name email phone address')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Subscription.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
      subscriptions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscribers.', error: err });
  }
};

// ─── Admin: Get All Users ──────────────────────────────────────────────────────
export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.', error: err });
  }
};

// ─── Admin: Revenue Report ─────────────────────────────────────────────────────
export const getRevenueReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'successful', paidAt: { $gte: new Date(`${year}-01-01`) } } },
      {
        $group: {
          _id: { $month: '$paidAt' },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const profitByMonth = await Subscription.aggregate([
      { $match: { status: { $in: ['active', 'expired'] } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          totalProfit: { $sum: '$snapshot.totalProfit' },
          totalCost: { $sum: '$snapshot.totalCost' },
          totalRevenue: { $sum: '$snapshot.totalAmount' },
        },
      },
    ]);

    res.json({ success: true, monthlyRevenue, profitByMonth });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Revenue report failed.', error: err });
  }
};

// ─── Admin: Create Admin User ──────────────────────────────────────────────────
export const createAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await Admin.findOne({ email });
    if (existing) {
      res.status(409).json({ success: false, message: 'Admin email already exists.' });
      return;
    }
    const admin = await Admin.create({ name, email, password, role });
    res.status(201).json({
      success: true,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create admin.', error: err });
  }
};

// ─── Admin: Get All Admins ────────────────────────────────────────────────────
export const getAllAdmins = async (_req: Request, res: Response): Promise<void> => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch admins.', error: err });
  }
};

// ─── Admin: Deactivate/Activate User ───────────────────────────────────────────
export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}.`,
      user: { id: user._id, email: user.email, isActive: user.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user status.', error: err });
  }
};

// ─── Admin: Deactivate/Activate Subscription ───────────────────────────────────
export const toggleSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subscriptionId } = req.params;
    const { status } = req.body; // 'active', 'paused', 'cancelled'

    if (!['active', 'paused', 'cancelled'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }

    const subscription = await Subscription.findByIdAndUpdate(
      subscriptionId,
      { status },
      { new: true }
    ).populate('user', 'name email');

    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found.' });
      return;
    }

    res.json({
      success: true,
      message: `Subscription ${status}.`,
      subscription,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update subscription status.', error: err });
  }
};

// ─── Admin: Delete User ────────────────────────────────────────────────────────
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Soft delete: just deactivate
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({ success: true, message: 'User deactivated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user.', error: err });
  }
};

// ─── Admin: Update Admin Status ────────────────────────────────────────────────
export const toggleAdminStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId } = req.params;
    const { isActive } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin not found.' });
      return;
    }

    res.json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'}.`,
      admin: { id: admin._id, email: admin.email, isActive: admin.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update admin status.', error: err });
  }
};
