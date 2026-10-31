import { Router, Request, Response } from 'express';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';
import { invalidate } from '../../shared/redis/cache';

export const taxesRouter = Router();

function parseRate(value: unknown): number | null {
  const rate = Number(value);
  if (value === '' || value === null || value === undefined || Number.isNaN(rate)) return null;
  if (rate < 0 || rate > 100) return null;
  return Math.round(rate * 100) / 100;
}

// GET /api/taxes - List taxes (paginated)
taxesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const where: any = {};
    if (req.query.activeOnly === 'true') where.isActive = true;
    if (req.query.search) where.name = { contains: String(req.query.search), mode: 'insensitive' };

    const [taxes, total] = await Promise.all([
      prisma.tax.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tax.count({ where }),
    ]);

    res.json({
      data: { taxes, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to list taxes' });
  }
});

// GET /api/taxes/:id
taxesRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const tax = await prisma.tax.findUnique({ where: { id: req.params.id } });
    if (!tax) {
      res.status(404).json({ data: null, error: 'Tax not found' });
      return;
    }
    res.json({ data: tax, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to get tax' });
  }
});

// POST /api/taxes - Create tax rule (Admin only)
taxesRouter.post('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, ratePercent, isActive } = req.body;
    const rate = parseRate(ratePercent);
    if (!name || !String(name).trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }
    if (rate === null) {
      res.status(400).json({ data: null, error: 'Rate must be a number between 0 and 100' });
      return;
    }

    const tax = await prisma.tax.create({
      data: { name: String(name).trim(), ratePercent: rate, isActive: isActive !== false },
    });
    await invalidate('lookups-taxes');
    res.status(201).json({ data: tax, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to create tax' });
  }
});

// PUT /api/taxes/:id - Update tax rule (Admin only)
taxesRouter.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.tax.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ data: null, error: 'Tax not found' });
      return;
    }

    const data: any = {};
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        res.status(400).json({ data: null, error: 'Name is required' });
        return;
      }
      data.name = String(req.body.name).trim();
    }
    if (req.body.ratePercent !== undefined) {
      const rate = parseRate(req.body.ratePercent);
      if (rate === null) {
        res.status(400).json({ data: null, error: 'Rate must be a number between 0 and 100' });
        return;
      }
      data.ratePercent = rate;
    }
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const tax = await prisma.tax.update({ where: { id: req.params.id }, data });
    await invalidate('lookups-taxes');
    res.json({ data: tax, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to update tax' });
  }
});

// DELETE /api/taxes/:id - Delete tax rule (Admin only); in-use taxes must be deactivated instead
taxesRouter.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const [products, lines] = await Promise.all([
      prisma.product.count({ where: { taxId: req.params.id } }),
      prisma.subscriptionLine.count({ where: { taxId: req.params.id } }),
    ]);
    if (products + lines > 0) {
      res.status(409).json({ data: null, error: 'Tax is in use; deactivate it instead of deleting' });
      return;
    }
    await prisma.tax.delete({ where: { id: req.params.id } });
    await invalidate('lookups-taxes');
    res.json({ data: { id: req.params.id }, error: null });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ data: null, error: 'Tax not found' });
      return;
    }
    res.status(500).json({ data: null, error: err.message || 'Failed to delete tax' });
  }
});
