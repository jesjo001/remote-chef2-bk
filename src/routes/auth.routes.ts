// ─── src/routes/auth.routes.ts ────────────────────────────────────────────────
import { Router } from 'express';
import {
  registerUser, loginUser, getMyProfile, updateMyProfile,
  adminLogin, getAdminProfile, verifyEmail, resendVerification,
} from '../controllers/auth.controller';
import { protect, adminProtect } from '../middleware/auth.middleware';

const router = Router();

// User auth
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMyProfile);
router.put('/me', protect, updateMyProfile);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Admin auth
router.post('/admin/login', adminLogin);
router.get('/admin/me', adminProtect, getAdminProfile);

export default router;
