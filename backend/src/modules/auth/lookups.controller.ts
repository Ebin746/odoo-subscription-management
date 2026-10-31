// Lookups controller — thin layer, no business logic
// Owner: P1

import { Request, Response } from 'express';
import { prisma } from '../../shared/db';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/errorHandler';

export const lookupsController = {
  // GET /api/lookups/customers?search=<string>&limit=<number>
  // Returns [{ id, label }] — searchable, capped at 100
  listCustomers: asyncHandler(async (req: Request, res: Response) => {
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const customers = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    const data = customers.map((c) => ({
      id: c.id,
      label: c.companyName ? `${c.name} (${c.companyName}) — ${c.email}` : `${c.name} — ${c.email}`,
    }));

    res.json(ok(data));
  }),
};

