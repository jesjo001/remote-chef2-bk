// ─── src/routes/pricing.routes.ts ─────────────────────────────────────────────
import { Router } from 'express';
import {
  getPublicPricing, calculatePrice, get12MonthBreakdown,
  getAdminPricingConfig, updatePricingConfig,
} from '../controllers/pricing.controller';
import { adminProtect } from '../middleware/auth.middleware';

const pricingRouter = Router();
pricingRouter.get('/', getPublicPricing);
pricingRouter.post('/calculate', calculatePrice);
pricingRouter.post('/breakdown-12months', get12MonthBreakdown);
pricingRouter.get('/admin', adminProtect, getAdminPricingConfig);
pricingRouter.put('/admin', adminProtect, updatePricingConfig);

export { pricingRouter };

// ─── src/routes/subscription.routes.ts ────────────────────────────────────────
import { Router as Router2 } from 'express';
import {
  createSubscription, getMySubscriptions,
  getActiveSubscription, cancelSubscription,
} from '../controllers/subscription.controller';
import { protect as protect2 } from '../middleware/auth.middleware';

const subscriptionRouter = Router2();
subscriptionRouter.post('/', protect2, createSubscription);
subscriptionRouter.get('/', protect2, getMySubscriptions);
subscriptionRouter.get('/active', protect2, getActiveSubscription);
subscriptionRouter.put('/:id/cancel', protect2, cancelSubscription);

export { subscriptionRouter };

// ─── src/routes/payment.routes.ts ─────────────────────────────────────────────
import { Router as Router3 } from 'express';
import {
  initiateFlutterwave, flutterwaveWebhook, verifyPaymentStatus, getMyPayments,
  uploadManualReceipt, getPendingTransfers, reviewManualTransfer,
} from '../controllers/payment.controller';
import { protect as protect3, adminProtect as adminProtect3 } from '../middleware/auth.middleware';
import { uploadReceipt } from '../middleware/upload.middleware';

const paymentRouter = Router3();
paymentRouter.post('/flutterwave/initiate', protect3, initiateFlutterwave);
paymentRouter.post('/flutterwave/webhook', flutterwaveWebhook); // No auth — Flutterwave hits this
paymentRouter.get('/verify', protect3, verifyPaymentStatus);
paymentRouter.get('/my', protect3, getMyPayments);
paymentRouter.post('/manual/upload', protect3, uploadReceipt.single('receipt') as any, uploadManualReceipt);
paymentRouter.get('/manual/pending', adminProtect3, getPendingTransfers);
paymentRouter.put('/manual/:id/review', adminProtect3, reviewManualTransfer);

export { paymentRouter };

// ─── src/routes/delivery.routes.ts ────────────────────────────────────────────
import { Router as Router4 } from 'express';
import {
  getMyDeliveries, getTodayDeliveries,
  updateDeliveryStatus, getDeliveriesByRange,
} from '../controllers/delivery.controller';
import { protect as protect4, adminProtect as adminProtect4 } from '../middleware/auth.middleware';

const deliveryRouter = Router4();
deliveryRouter.get('/my', protect4, getMyDeliveries);
deliveryRouter.get('/admin/today', adminProtect4, getTodayDeliveries);
deliveryRouter.get('/admin/range', adminProtect4, getDeliveriesByRange);
deliveryRouter.put('/admin/:id/status', adminProtect4, updateDeliveryStatus);

export { deliveryRouter };

// ─── src/routes/admin.routes.ts ───────────────────────────────────────────────
import { Router as Router5 } from 'express';
import {
  getDashboardStats, getAllSubscribers, getAllUsers, getAllAdmins,
  getRevenueReport, createAdmin, toggleUserStatus, toggleSubscriptionStatus,
  deleteUser, toggleAdminStatus,
} from '../controllers/admin.controller';
import { adminProtect as adminProtect5, superAdminOnly } from '../middleware/auth.middleware';

const adminRouter = Router5();
adminRouter.get('/dashboard', adminProtect5, getDashboardStats);
adminRouter.get('/subscribers', adminProtect5, getAllSubscribers);
adminRouter.get('/users', adminProtect5, getAllUsers);
adminRouter.get('/admins', adminProtect5, superAdminOnly, getAllAdmins);
adminRouter.get('/revenue', adminProtect5, getRevenueReport);
adminRouter.post('/create-admin', adminProtect5, superAdminOnly, createAdmin);

// User management
adminRouter.put('/users/:userId/status', adminProtect5, toggleUserStatus);
adminRouter.delete('/users/:userId', adminProtect5, deleteUser);

// Subscription management
adminRouter.put('/subscriptions/:subscriptionId/status', adminProtect5, toggleSubscriptionStatus);

// Admin management (superadmin only)
adminRouter.put('/admins/:adminId/status', adminProtect5, superAdminOnly, toggleAdminStatus);

export { adminRouter };
