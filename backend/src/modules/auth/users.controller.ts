import { Request, Response } from 'express';
import { usersService } from './users.service';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/errorHandler';

export const usersController = {
  listCustomers: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await usersService.listCustomers({ page, limit, search });
    res.status(200).json(ok(result));
  }),

  createCustomer: asyncHandler(async (req: Request, res: Response) => {
    const customer = await usersService.createCustomer(req.body);
    res.status(201).json(ok(customer));
  }),

  getCustomerById: asyncHandler(async (req: Request, res: Response) => {
    const customer = await usersService.getCustomerById(req.params.id);
    res.status(200).json(ok(customer));
  }),

  updateCustomer: asyncHandler(async (req: Request, res: Response) => {
    const customer = await usersService.updateCustomer(req.params.id, req.body);
    res.status(200).json(ok(customer));
  }),

  getMyProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await usersService.getMyProfile(req.user!.id);
    res.status(200).json(ok(profile));
  }),
};

