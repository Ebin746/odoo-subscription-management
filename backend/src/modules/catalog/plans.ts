import { Router, Request, Response } from 'express';
import { BillingPeriod } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';

export const plansRouter = Router();

// GET /api/catalog/plans - List plans (Paginated, filtered)
plansRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { billingPeriod, activeOnly, search } = req.query;

    const where: any = {};
    if (activeOnly === 'true') {
      where.isActive = true;
    }
    if (billingPeriod && Object.values(BillingPeriod).includes(billingPeriod as BillingPeriod)) {
      where.billingPeriod = billingPeriod as BillingPeriod;
    }
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }

    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { subscriptions: true } },
        },
      }),
      prisma.plan.count({ where }),
    ]);

    res.json({
      data: {
        plans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to list plans' });
  }
});

// GET /api/catalog/plans/:id - Single plan
plansRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: req.params.id },
      include: {
        quotationTemplates: true,
        _count: { select: { subscriptions: true } },
      },
    });

    if (!plan) {
      res.status(404).json({ data: null, error: 'Plan not found' });
      return;
    }

    res.json({ data: plan, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to get plan' });
  }
});

// POST /api/catalog/plans - Create plan (Admin only, R8 & R9)
plansRouter.post('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const {
      name,
      price,
      billingPeriod,
      minQuantity,
      availableFrom,
      availableTo,
      autoClose,
      allowEarlyClose,
      allowPause,
      allowRenew,
    } = req.body;

    if (!name || price === undefined || !billingPeriod) {
      res.status(400).json({
        data: null,
        error: 'name, price, and billingPeriod are required',
      });
      return;
    }

    const periodUpper = String(billingPeriod).toUpperCase();
    if (!Object.values(BillingPeriod).includes(periodUpper as BillingPeriod)) {
      res.status(400).json({
        data: null,
        error: `Invalid billingPeriod. Must be one of: ${Object.values(BillingPeriod).join(', ')}`,
      });
      return;
    }

    const plan = await prisma.plan.create({
      data: {
        name: String(name).trim(),
        price: Number(price),
        billingPeriod: periodUpper as BillingPeriod,
        minQuantity: minQuantity !== undefined ? Math.max(1, parseInt(minQuantity)) : 1,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
        autoClose: Boolean(autoClose),
        allowEarlyClose: Boolean(allowEarlyClose),
        allowPause: Boolean(allowPause),
        allowRenew: Boolean(allowRenew),
      },
    });

    res.status(201).json({ data: plan, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to create plan' });
  }
});

// PUT /api/catalog/plans/:id - Update plan (Admin only)
plansRouter.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const {
      name,
      price,
      billingPeriod,
      minQuantity,
      availableFrom,
      availableTo,
      isActive,
      autoClose,
      allowEarlyClose,
      allowPause,
      allowRenew,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (price !== undefined) data.price = Number(price);
    if (billingPeriod !== undefined) {
      const periodUpper = String(billingPeriod).toUpperCase();
      if (!Object.values(BillingPeriod).includes(periodUpper as BillingPeriod)) {
        res.status(400).json({
          data: null,
          error: `Invalid billingPeriod: ${billingPeriod}`,
        });
        return;
      }
      data.billingPeriod = periodUpper as BillingPeriod;
    }
    if (minQuantity !== undefined) data.minQuantity = Math.max(1, parseInt(minQuantity));
    if (availableFrom !== undefined) data.availableFrom = availableFrom ? new Date(availableFrom) : null;
    if (availableTo !== undefined) data.availableTo = availableTo ? new Date(availableTo) : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (autoClose !== undefined) data.autoClose = Boolean(autoClose);
    if (allowEarlyClose !== undefined) data.allowEarlyClose = Boolean(allowEarlyClose);
    if (allowPause !== undefined) data.allowPause = Boolean(allowPause);
    if (allowRenew !== undefined) data.allowRenew = Boolean(allowRenew);

    const updated = await prisma.plan.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ data: updated, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to update plan' });
  }
});
