import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { Payment } from '../models/Payment';
import { ManualTransfer } from '../models/Payment';
import Subscription from '../models/Subscription';
import { activateSubscription, applyPortionUpgrade, applyAddOnUpgrade } from './subscription.controller';
import { verifyFlutterwavePayment, initiateFlutterwavePayment } from '../services/flutterwave.service';

const dev = process.env.NODE_ENV !== 'production';
const FLW_PUBLIC_KEY = dev ? process.env.FLUTTERWAVE_TEST_PUBLIC_KEY : process.env.FLW_PUBLIC_KEY;
// ---------- Flutterwave: Initiate Payment ----------
export const initiateFlutterwave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { subscriptionId } = req.body;

    const subscription = await Subscription.findOne({ _id: subscriptionId, user: req.user!._id });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found.' });
      return;
    }

    const payment = await Payment.findOne({ subscription: subscriptionId, status: 'pending' });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment record not found.' });
      return;
    }

    // Initiate payment via Flutterwave API
    const result = await initiateFlutterwavePayment(
      payment.amount,
      req.user!.email,
      req.user!.name,
      req.user!.phone,
      payment.txRef,
      String(subscription._id),
      String(payment._id)
    );

    if (result.success) {
      // Update payment with gateway response
      await Payment.findByIdAndUpdate(payment._id, { gatewayResponse: result.data });
      
      res.json({
        success: true,
        message: 'Payment initiated successfully.',
        payment: {
          id: payment._id,
          txRef: payment.txRef,
          amount: payment.amount,
        },
        // Return authorization URL for redirect or inline payment
        authorizationUrl: result.data?.authorization_url || result.data?.link,
        accessCode: result.data?.access_code,
        // Also return config for frontend fallback (inline payment)
        flutterwave: {
          public_key: FLW_PUBLIC_KEY,
          tx_ref: payment.txRef,
          amount: payment.amount,
          currency: 'NGN',
          payment_options: 'card,banktransfer,ussd',
          redirect_url: `${process.env.FRONTEND_URL}/payment/verify`,
          customer: {
            email: req.user!.email,
            name: req.user!.name,
            phone_number: req.user!.phone,
          },
          customizations: {
            title: 'RemoteChef Subscription',
            description: `${subscription.mealsPerDay}x daily meal — ${subscription.scheduleType}`,
            logo: `${process.env.FRONTEND_URL}/logo.png`,
          },
          meta: {
            subscriptionId: String(subscription._id),
            paymentId: String(payment._id),
          },
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to initiate payment.',
        error: result.error,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to initiate payment.', error: err });
  }
};

// ---------- Flutterwave: Webhook ----------
export const flutterwaveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify webhook signature
    const hash = req.headers['verif-hash'];
    if (hash !== process.env.FLW_WEBHOOK_HASH) {
      res.status(401).json({ message: 'Invalid webhook signature.' });
      return;
    }

    const payload = req.body;
    if (payload.event !== 'charge.completed') {
      res.status(200).json({ message: 'Event ignored.' });
      return;
    }

    const { tx_ref, status, id: flwRef } = payload.data;

    if (status !== 'successful') {
      await Payment.findOneAndUpdate({ txRef: tx_ref }, { status: 'failed', gatewayResponse: payload.data });
      res.status(200).json({ message: 'Payment not successful, recorded.' });
      return;
    }

    // Verify on Flutterwave API
    const verified = await verifyFlutterwavePayment(flwRef);
    if (!verified) {
      res.status(200).json({ message: 'Verification failed.' });
      return;
    }

    const payment = await Payment.findOneAndUpdate(
      { txRef: tx_ref, status: 'pending' },
      { status: 'successful', flwRef: String(flwRef), gatewayResponse: payload.data, paidAt: new Date() },
      { new: true }
    );

    if (payment) {
      if (payment.type === 'upgrade') {
        if (payment.metadata?.newPortions) {
          await applyPortionUpgrade(String(payment.subscription), payment.metadata.newPortions);
        } else if (payment.metadata?.newAddOns) {
          await applyAddOnUpgrade(String(payment.subscription), payment.metadata.newAddOns);
        }
      } else {
        await activateSubscription(String(payment.subscription));
      }
    }

    res.status(200).json({ message: 'Webhook processed.' });
  } catch (err) {
    res.status(500).json({ message: 'Webhook processing error.', error: err });
  }
};

// ---------- Flutterwave: Frontend verify after redirect ----------
export const verifyPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const tx_ref = (req.query.tx_ref || req.query.txRef) as string;
    const transaction_id = req.query.transaction_id as string;
    const status = req.query.status as string;

    if (!tx_ref) {
      res.status(400).json({ success: false, message: 'Transaction reference is required.' });
      return;
    }

    let payment = await Payment.findOne({ txRef: tx_ref }).populate('subscription');
    
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment record not found.' });
      return;
    }

    // If payment is already successful, just return it
    if (payment.status === 'successful') {
      res.json({ success: true, payment });
      return;
    }

    // If status from gateway is successful but DB is still pending, verify with Flutterwave
    if ((status === 'successful' || status === 'success') && transaction_id) {
      const verified = await verifyFlutterwavePayment(transaction_id);
      
      if (verified) {
        payment.status = 'successful';
        payment.flwRef = transaction_id;
        payment.paidAt = new Date();
        await payment.save();

        if (payment.type === 'upgrade') {
          if (payment.metadata?.newPortions) {
            await applyPortionUpgrade(String(payment.subscription._id || payment.subscription), payment.metadata.newPortions);
          } else if (payment.metadata?.newAddOns) {
            await applyAddOnUpgrade(String(payment.subscription._id || payment.subscription), payment.metadata.newAddOns);
          }
        } else {
          await activateSubscription(String(payment.subscription._id || payment.subscription));
        }
        
        // Refetch to get populated subscription if needed, or just return updated payment
        payment = await Payment.findById(payment._id).populate('subscription');
      } else {
        payment.status = 'failed';
        await payment.save();
      }
    }

    res.json({ success: true, payment });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ success: false, message: 'Verification failed.', error: err });
  }
};

// ---------- User: Get My Payments ----------
export const getMyPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find({ user: req.user!._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      payments: payments.map((payment) => ({
        id: payment._id,
        userId: payment.user,
        amount: payment.amount,
        method: payment.gateway,
        status: payment.status === 'successful' ? 'success' : payment.status,
        createdAt: payment.paidAt || payment.createdAt,
        reference: payment.txRef,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments.', error: err });
  }
};

// ---------- Manual Transfer: Upload Receipt ----------
export const uploadManualReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Receipt file is required.' });
      return;
    }

    const { subscriptionId, bankRef, senderName } = req.body;

    const subscription = await Subscription.findOne({ _id: subscriptionId, user: req.user!._id });
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Subscription not found.' });
      return;
    }

    const payment = await Payment.findOne({ subscription: subscriptionId, status: 'pending' });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment record not found.' });
      return;
    }

    const receiptUrl = path.join('uploads', 'receipts', req.file.filename);

    const manualTransfer = await ManualTransfer.create({
      payment: payment._id,
      user: req.user!._id,
      subscription: subscription._id,
      receiptUrl,
      bankRef,
      senderName,
      amount: payment.amount,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Receipt uploaded. Awaiting admin confirmation (usually within 2–4 hours).',
      manualTransfer,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Receipt upload failed.', error: err });
  }
};

// ---------- Admin: Get Pending Manual Transfers ----------
export const getPendingTransfers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const transfers = await ManualTransfer.find({ status: 'pending' })
      .populate('user', 'name email phone')
      .populate('subscription', 'mealsPerDay scheduleType snapshot')
      .sort({ createdAt: 1 });

    res.json({ success: true, transfers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch transfers.', error: err });
  }
};

// ---------- Admin: Approve / Reject Manual Transfer ----------
export const reviewManualTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, adminNote } = req.body as { status: 'approved' | 'rejected'; adminNote?: string };
    const { id } = req.params;

    const transfer = await ManualTransfer.findById(id);
    if (!transfer) {
      res.status(404).json({ success: false, message: 'Transfer not found.' });
      return;
    }

    if (transfer.status !== 'pending') {
      res.status(400).json({ success: false, message: 'Transfer already reviewed.' });
      return;
    }

    transfer.status = status;
    transfer.adminNote = adminNote;
    transfer.reviewedBy = req.admin!._id as any;
    transfer.reviewedAt = new Date();
    await transfer.save();

    if (status === 'approved') {
      const payment = await Payment.findByIdAndUpdate(transfer.payment, { status: 'successful', paidAt: new Date() }, { new: true });
      if (payment && payment.type === 'upgrade') {
        if (payment.metadata?.newPortions) {
          await applyPortionUpgrade(String(transfer.subscription), payment.metadata.newPortions);
        } else if (payment.metadata?.newAddOns) {
          await applyAddOnUpgrade(String(transfer.subscription), payment.metadata.newAddOns);
        }
      } else {
        await activateSubscription(String(transfer.subscription));
      }
    } else {
      await Payment.findByIdAndUpdate(transfer.payment, { status: 'failed' });
    }

    res.json({
      success: true,
      message: `Transfer ${status}. Subscription ${status === 'approved' ? 'activated' : 'remains pending'}.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Review failed.', error: err });
  }
};
