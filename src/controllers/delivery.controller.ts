import { Request, Response } from 'express';
import Delivery from '../models/Delivery';

// ─── User: Get My Deliveries ───────────────────────────────────────────────────
export const getMyDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const query: Record<string, unknown> = { user: req.user!._id };

    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
      query.scheduledDate = { $gte: start, $lte: end };
    }

    const deliveries = await Delivery.find(query)
      .populate('user', 'name phone address')
      .populate('subscription', 'mealsPerDay')
      .sort({ scheduledDate: 1 });
    res.json({ success: true, deliveries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch deliveries.', error: err });
  }
};

// ─── Admin: Get Today's Delivery Board ────────────────────────────────────────
export const getTodayDeliveries = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const deliveries = await Delivery.find({
      scheduledDate: { $gte: today, $lte: todayEnd },
      status: { $in: ['scheduled', 'out_for_delivery'] },
    })
      .populate('user', 'name phone address')
      .populate('subscription', 'mealsPerDay scheduleType')
      .populate('assignedDriver', 'name phone')
      .sort({ 'user.address.area': 1 });

    res.json({
      success: true,
      date: today.toISOString().split('T')[0],
      total: deliveries.length,
      deliveries,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch delivery board.', error: err });
  }
};

// ─── Driver: Get My Assigned Deliveries ───────────────────────────────────────
export const getDriverDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, status } = req.query;
    const query: Record<string, unknown> = { assignedDriver: req.user!._id };

    if (from || to) {
      const dateQuery: Record<string, unknown> = {};
      if (from) {
        const start = new Date(from as string);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (to) {
        const end = new Date(to as string);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      query.scheduledDate = dateQuery;
    } else {
      // Default to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      query.scheduledDate = { $gte: today, $lte: todayEnd };
    }

    if (status) query.status = status;

    console.log(`Fetching deliveries for driver ${req.user!._id}:`, query);

    const deliveries = await Delivery.find(query)
      .populate('user', 'name phone address email')
      .populate('subscription', 'mealsPerDay')
      .sort({ scheduledDate: 1 });

    console.log(`Found ${deliveries.length} deliveries for driver ${req.user!._id}`);

    res.json({ success: true, total: deliveries.length, deliveries });
  } catch (err) {
    console.error('getDriverDeliveries error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch driver deliveries.', error: err });
  }
};

// ─── Driver/Admin: Update Delivery Status ────────────────────────────────────
export const updateDeliveryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, driverNote, receiptImage } = req.body;
    const { id } = req.params;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      res.status(404).json({ success: false, message: 'Delivery not found.' });
      return;
    }

    // Authorization: Admin can update any, Driver can only update theirs
    if (!req.admin && String(delivery.assignedDriver) !== String(req.user!._id)) {
      res.status(403).json({ success: false, message: 'Not authorized to update this delivery.' });
      return;
    }

    delivery.status = status;
    if (driverNote !== undefined) delivery.driverNote = driverNote;
    if (receiptImage !== undefined) delivery.receiptImage = receiptImage;
    if (status === 'delivered') delivery.deliveredAt = new Date();

    await delivery.save();
    
    const populated = await Delivery.findById(id).populate('user', 'name phone');

    res.json({ success: true, delivery: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Status update failed.', error: err });
  }
};

// ─── Admin: Get Deliveries by Date Range ──────────────────────────────────────
export const getDeliveriesByRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, status } = req.query;
    const query: Record<string, unknown> = {};

    if (from && to) {
      query.scheduledDate = { $gte: new Date(from as string), $lte: new Date(to as string) };
    }
    if (status) query.status = status;

    const deliveries = await Delivery.find(query)
      .populate('user', 'name phone address')
      .populate('assignedDriver', 'name phone')
      .sort({ scheduledDate: -1 });

    res.json({ success: true, total: deliveries.length, deliveries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch deliveries.', error: err });
  }
};
