import { Router, Request, Response } from 'express';
import { DiscountScope, DiscountType } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireRole } from '../../shared/auth';

export const discountsRouter = Router();

// Discounts are admin only (R21): every route is guarded.
discountsRouter.use(requireRole('ADMIN'));

const include = {
  targets: {
    include: {
      product: { select: { id: true, name: true } },
      subscription: { select: { id: true, number: true } },
    },
  },
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// Validates a create/update body and returns { data, productIds, subscriptionIds } or an error string.
function parseBody(body: any, partial: boolean) {
  const data: any = {};

  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) return { error: 'Name is required' };
    data.name = String(body.name).trim();
  }
  if (!partial || body.type !== undefined) {
    if (!Object.values(DiscountType).includes(body.type)) return { error: 'Type must be FIXED or PERCENTAGE' };
    data.type = body.type;
  }
  if (!partial || body.scope !== undefined) {
    if (!Object.values(DiscountScope).includes(body.scope)) return { error: 'Scope must be PRODUCT or SUBSCRIPTION' };
    data.scope = body.scope;
  }
  if (!partial || body.value !== undefined) {
    const value = Number(body.value);
    if (body.value === '' || body.value == null || Number.isNaN(value) || value <= 0) {
      return { error: 'Value must be greater than 0' };
    }
    data.value = Math.round(value * 100) / 100;
  }
  if (!partial || body.startDate !== undefined) {
    const d = toDate(body.startDate);
    if (!d) return { error: 'Start date is required' };
    data.startDate = d;
  }
  if (!partial || body.endDate !== undefined) {
    const d = toDate(body.endDate);
    if (!d) return { error: 'End date is required' };
    data.endDate = d;
  }
  for (const field of ['minPurchaseAmount', 'minQuantity', 'usageLimit'] as const) {
    if (body[field] !== undefined) {
      const n = optionalNumber(body[field]);
      if (n === undefined || (n !== null && n < 0)) return { error: `${field} must be a non-negative number` };
      data[field] = n === null ? null : field === 'minPurchaseAmount' ? n : Math.floor(n);
    }
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const productIds: string[] | undefined = Array.isArray(body.productIds) ? body.productIds : undefined;
  const subscriptionIds: string[] | undefined = Array.isArray(body.subscriptionIds) ? body.subscriptionIds : undefined;
  return { data, productIds, subscriptionIds };
}

// GET /api/discounts - List (paginated)
discountsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const where: any = {};
    if (req.query.activeOnly === 'true') where.isActive = true;
    if (req.query.search) where.name = { contains: String(req.query.search), mode: 'insensitive' };

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include,
      }),
      prisma.discount.count({ where }),
    ]);

    res.json({
      data: { discounts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to list discounts' });
  }
});

// GET /api/discounts/:id
discountsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const discount = await prisma.discount.findUnique({ where: { id: req.params.id }, include });
    if (!discount) {
      res.status(404).json({ data: null, error: 'Discount not found' });
      return;
    }
    res.json({ data: discount, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to get discount' });
  }
});

// POST /api/discounts
discountsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = parseBody(req.body, false);
    if ('error' in parsed) {
      res.status(400).json({ data: null, error: parsed.error });
      return;
    }
    const { data, productIds = [], subscriptionIds = [] } = parsed;

    if (data.endDate < data.startDate) {
      res.status(400).json({ data: null, error: 'End date cannot be before start date' });
      return;
    }
    if (data.type === DiscountType.PERCENTAGE && data.value > 100) {
      res.status(400).json({ data: null, error: 'Percentage cannot exceed 100' });
      return;
    }
    if (data.scope === DiscountScope.PRODUCT && productIds.length === 0) {
      res.status(400).json({ data: null, error: 'Select at least one product for a product discount' });
      return;
    }

    const discount = await prisma.discount.create({
      data: {
        ...data,
        targets: {
          create:
            data.scope === DiscountScope.PRODUCT
              ? productIds.map((productId) => ({ productId }))
              : subscriptionIds.map((subscriptionId) => ({ subscriptionId })),
        },
      },
      include,
    });
    res.status(201).json({ data: discount, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to create discount' });
  }
});

// PUT /api/discounts/:id - targets are replaced when productIds / subscriptionIds are sent
discountsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.discount.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ data: null, error: 'Discount not found' });
      return;
    }

    const parsed = parseBody(req.body, true);
    if ('error' in parsed) {
      res.status(400).json({ data: null, error: parsed.error });
      return;
    }
    const { data, productIds, subscriptionIds } = parsed;

    const type = data.type ?? existing.type;
    const scope = data.scope ?? existing.scope;
    const value = data.value ?? Number(existing.value);
    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate ?? existing.endDate;
    if (endDate < startDate) {
      res.status(400).json({ data: null, error: 'End date cannot be before start date' });
      return;
    }
    if (type === DiscountType.PERCENTAGE && value > 100) {
      res.status(400).json({ data: null, error: 'Percentage cannot exceed 100' });
      return;
    }

    const replaceTargets = productIds !== undefined || subscriptionIds !== undefined || data.scope !== undefined;
    const newTargets =
      scope === DiscountScope.PRODUCT
        ? (productIds ?? []).map((productId) => ({ productId }))
        : (subscriptionIds ?? []).map((subscriptionId) => ({ subscriptionId }));
    if (replaceTargets && scope === DiscountScope.PRODUCT && newTargets.length === 0) {
      res.status(400).json({ data: null, error: 'Select at least one product for a product discount' });
      return;
    }

    const discount = await prisma.$transaction(async (tx) => {
      if (replaceTargets) await tx.discountTarget.deleteMany({ where: { discountId: existing.id } });
      return tx.discount.update({
        where: { id: existing.id },
        data: { ...data, ...(replaceTargets ? { targets: { create: newTargets } } : {}) },
        include,
      });
    });
    res.json({ data: discount, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to update discount' });
  }
});

// DELETE /api/discounts/:id - used discounts must be deactivated instead
discountsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const used = await prisma.invoiceLine.count({ where: { discountId: req.params.id } });
    if (used > 0) {
      res.status(409).json({ data: null, error: 'Discount already used on invoices; deactivate it instead' });
      return;
    }
    await prisma.discount.delete({ where: { id: req.params.id } });
    res.json({ data: { id: req.params.id }, error: null });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ data: null, error: 'Discount not found' });
      return;
    }
    res.status(500).json({ data: null, error: err.message || 'Failed to delete discount' });
  }
});
