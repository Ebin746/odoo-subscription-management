import { Router } from 'express';
import { rateLimit } from '../../shared/redis/rateMiddleware';
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

// Rate limits on the public endpoints, counted in Redis so every server instance shares them
// (per IP address). Tunable with AUTH_RATE_MAX for tests and busy deployments.
const AUTH_MAX = Number(process.env.AUTH_RATE_MAX) || 100;
const authLimiter = rateLimit({ name: 'auth', max: AUTH_MAX, windowSec: 15 * 60, message: 'Too many requests, please try again later.' });
const signupLimiter = rateLimit({ name: 'signup', max: Math.max(5, Math.floor(AUTH_MAX / 2)), windowSec: 60 * 60, message: 'Too many sign-ups from this address, please try again later.' });
const resetLimiter = rateLimit({ name: 'reset-password', max: Math.max(5, Math.floor(AUTH_MAX / 3)), windowSec: 15 * 60, message: 'Too many attempts, please try again later.' });

// Public endpoints
authRoutes.post('/signup', signupLimiter, validateBody(signupSchema), authController.signup);
authRoutes.post('/login', authLimiter, validateBody(loginSchema), authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRoutes.post('/reset-password', resetLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

// Authenticated endpoints
authRoutes.get('/me', requireAuth, authController.me);

// Admin-only staff management
authRoutes.post('/staff', requireRole('ADMIN'), validateBody(createStaffSchema), authController.createStaff);
authRoutes.get('/staff', requireRole('ADMIN'), authController.listStaff);

