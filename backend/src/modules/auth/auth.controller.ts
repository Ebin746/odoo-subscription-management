import { Request, Response } from 'express';
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

  logout: asyncHandler(async (_req: Request, res: Response) => {
    // JWT is stateless; client drops token
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

