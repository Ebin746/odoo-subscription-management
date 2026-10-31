import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { denyToken } from '../../shared/redis/session';
import { authService } from './auth.service';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/errorHandler';

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.signup(req.body);
    res.status(201).json(ok(user));
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.status(200).json(ok(result));
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    // End the token for real (deny-list in Redis), not just on the client
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.substring(7).trim();
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me-in-production') as { exp?: number };
        if (payload.exp) await denyToken(token, payload.exp - Math.floor(Date.now() / 1000));
      } catch {
        /* an invalid or expired token needs no ending */
      }
    }
    res.status(200).json(ok({ message: 'Logged out successfully' }));
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.id);
    res.status(200).json(ok(user));
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body);
    res.status(200).json(ok(result));
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body);
    res.status(200).json(ok(result));
  }),

  createStaff: asyncHandler(async (req: Request, res: Response) => {
    const staff = await authService.createStaff(req.body);
    res.status(201).json(ok(staff));
  }),

  listStaff: asyncHandler(async (_req: Request, res: Response) => {
    const staff = await authService.listStaff();
    res.status(200).json(ok(staff));
  }),
};

