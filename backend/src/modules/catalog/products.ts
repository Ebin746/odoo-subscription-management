import { Router, Request, Response } from 'express';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';

export const productsRouter = Router();

// GET /api/catalog/products - List products (Paginated)
productsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { type, search, activeOnly } = req.query;

    const where: any = {};
    if (activeOnly === 'true') {
      where.isActive = true;
    }
    if (type) {
      where.type = String(type);
    }
    if (search) {
      where.name = { contains: String(search), mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          variants: true,
          tax: { select: { id: true, name: true, ratePercent: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: {
        products,
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
    res.status(500).json({ data: null, error: err.message || 'Failed to list products' });
  }
});

// GET /api/catalog/products/:id - Single product
productsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        variants: true,
        tax: true,
      },
    });

    if (!product) {
      res.status(404).json({ data: null, error: 'Product not found' });
      return;
    }

    res.json({ data: product, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to get product' });
  }
});

// POST /api/catalog/products - Create product (Admin only, R6 & R7)
productsRouter.post('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, type, salesPrice, costPrice, notes, taxId, variants } = req.body;

    if (!name || !type || salesPrice === undefined || costPrice === undefined) {
      res.status(400).json({
        data: null,
        error: 'name, type, salesPrice, and costPrice are required',
      });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        type: String(type).trim(),
        salesPrice: Number(salesPrice),
        costPrice: Number(costPrice),
        notes: notes ? String(notes).trim() : null,
        taxId: taxId || null,
        variants: variants && Array.isArray(variants) && variants.length > 0
          ? {
              create: variants.map((v: any) => ({
                attribute: String(v.attribute).trim(),
                value: String(v.value).trim(),
                extraPrice: Number(v.extraPrice) || 0,
              })),
            }
          : undefined,
      },
      include: {
        variants: true,
        tax: true,
      },
    });

    res.status(201).json({ data: product, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to create product' });
  }
});

// PUT /api/catalog/products/:id - Update product (Admin only)
productsRouter.put('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, type, salesPrice, costPrice, notes, taxId, isActive } = req.body;

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(type !== undefined && { type: String(type).trim() }),
        ...(salesPrice !== undefined && { salesPrice: Number(salesPrice) }),
        ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...(taxId !== undefined && { taxId: taxId || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: {
        variants: true,
        tax: true,
      },
    });

    res.json({ data: updated, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to update product' });
  }
});

// POST /api/catalog/products/:id/variants - Add variant (Admin only, R7)
// Example: brand "Odoo" adds 560 to price
productsRouter.post('/:id/variants', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { attribute, value, extraPrice } = req.body;

    if (!attribute || !value) {
      res.status(400).json({ data: null, error: 'attribute and value are required' });
      return;
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: req.params.id,
        attribute: String(attribute).trim(),
        value: String(value).trim(),
        extraPrice: Number(extraPrice) || 0,
      },
    });

    res.status(201).json({ data: variant, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to add variant' });
  }
});

// DELETE /api/catalog/products/:id/variants/:variantId - Delete variant
productsRouter.delete(
  '/:id/variants/:variantId',
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      await prisma.productVariant.delete({
        where: { id: req.params.variantId },
      });
      res.json({ data: { success: true }, error: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: err.message || 'Failed to delete variant' });
    }
  }
);
