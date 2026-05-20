import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import connectDB from './config/db';
import { startCronJobs } from './services/cron.service';

// Routes
import authRoutes from './routes/auth.routes';
import { pricingRouter } from './routes/index';
import { subscriptionRouter } from './routes/index';
import { paymentRouter } from './routes/index';
import { deliveryRouter } from './routes/index';
import { adminRouter } from './routes/index';

const app = express();

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded receipts)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'RemoteChef API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/pricing', pricingRouter);
app.use('/api/subscriptions', subscriptionRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/deliveries', deliveryRouter);
app.use('/api/admin', adminRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  startCronJobs();
  app.listen(PORT, () => {
    console.log(`\n🍱 RemoteChef API running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 CORS origin: ${process.env.FRONTEND_URL}\n`);
  });
};

start();

export default app;
