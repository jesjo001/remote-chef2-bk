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

// ─── Admin: Update Delivery Status ────────────────────────────────────────────
export const updateDeliveryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, driverNote } = req.body;
    const { id } = req.params;

    const delivery = await Delivery.findByIdAndUpdate(
      id,
      {
        status,
        driverNote,
        ...(status === 'delivered' && { deliveredAt: new Date() }),
      },
      { new: true }
    ).populate('user', 'name phone');

    if (!delivery) {
      res.status(404).json({ success: false, message: 'Delivery not found.' });
      return;
    }

    res.json({ success: true, delivery });
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
      .sort({ scheduledDate: -1 });

    res.json({ success: true, total: deliveries.length, deliveries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch deliveries.', error: err });
  }
};
