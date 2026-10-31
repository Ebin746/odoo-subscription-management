import { Router, Request, Response } from 'express';
import { prisma } from '../../shared/db';

export const lookupsRouter = Router();

// GET /api/lookups/products
// Returns [{ id, label }] for product pickers
lookupsRouter.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        salesPrice: true,
        variants: {
          select: { id: true, attribute: true, value: true, extraPrice: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = products.map((p) => ({
      id: p.id,
      label: `${p.name} ($${Number(p.salesPrice).toFixed(2)})`,
      variants: p.variants.map((v) => ({
        id: v.id,
        label: `${v.attribute}: ${v.value} (+$${Number(v.extraPrice).toFixed(2)})`,
      })),
    }));

    res.json({ data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to fetch product lookups' });
  }
});

// GET /api/lookups/plans
// Returns [{ id, label }] for plan pickers
lookupsRouter.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        billingPeriod: true,
      },
      orderBy: { name: 'asc' },
    });

    const result = plans.map((pl) => ({
      id: pl.id,
      label: `${pl.name} ($${Number(pl.price).toFixed(2)} / ${pl.billingPeriod.toLowerCase()})`,
    }));

    res.json({ data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to fetch plan lookups' });
  }
});

// GET /api/lookups/subscriptions
// Returns [{ id, label }] for subscription pickers
lookupsRouter.get('/subscriptions', async (_req: Request, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      select: {
        id: true,
        number: true,
        customer: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const result = subscriptions.map((s) => ({
      id: s.id,
      label: `${s.number} - ${s.customer.name || s.customer.email}`,
    }));

    res.json({ data: result, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to fetch subscription lookups' });
  }
});
