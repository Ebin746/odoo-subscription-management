import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { requireAuth, requireRole } from '../../shared/auth';
import {
  validateBody,
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createStaffSchema,
} from './auth.validation';

export const authRoutes = Router();

// Rate limiter for sensitive public endpoints (login, forgot-password)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: 'Too many requests, please try again later.' },
});

// Public endpoints
authRoutes.post('/signup', validateBody(signupSchema), authController.signup);
authRoutes.post('/login', authLimiter, validateBody(loginSchema), authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRoutes.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

// Authenticated endpoints
authRoutes.get('/me', requireAuth, authController.me);

// Admin-only staff management
authRoutes.post('/staff', requireRole('ADMIN'), validateBody(createStaffSchema), authController.createStaff);
authRoutes.get('/staff', requireRole('ADMIN'), authController.listStaff);

