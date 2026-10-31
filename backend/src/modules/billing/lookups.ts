import { Router, Request, Response } from 'express';
import { prisma } from '../../shared/db';
import { cacheResponse } from '../../shared/redis/http';

export const billingLookupsRouter = Router();

// GET /api/lookups/taxes - [{ id, label }] for tax pickers
billingLookupsRouter.get('/taxes', cacheResponse('lookups-taxes', 60), async (_req: Request, res: Response) => {
  try {
    const taxes = await prisma.tax.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({
      data: taxes.map((t) => ({ id: t.id, label: `${t.name} (${Number(t.ratePercent)}%)` })),
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to fetch tax lookups' });
  }
});

// GET /api/lookups/invoices - [{ id, label }] for invoice pickers (open invoices first, most recent 100)
billingLookupsRouter.get('/invoices', cacheResponse('lookups-invoices', 30), async (_req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['CONFIRMED', 'DRAFT'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, number: true, customerName: true, total: true, amountPaid: true },
    });
    res.json({
      data: invoices.map((i) => ({
        id: i.id,
        label: `${i.number} - ${i.customerName} (due ${(Number(i.total) - Number(i.amountPaid)).toFixed(2)})`,
      })),
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to fetch invoice lookups' });
  }
});
