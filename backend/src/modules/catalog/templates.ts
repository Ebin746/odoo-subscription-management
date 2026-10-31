import { Router, Request, Response } from 'express';
import { PaymentTerms, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';
import { calculateLine } from '../../shared/pricing';

export const templatesRouter = Router();

// GET /api/catalog/quotation-templates - List templates
templatesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const templates = await prisma.quotationTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        lines: {
          include: {
            product: { include: { tax: true } },
            variant: true,
          },
        },
      },
    });

    res.json({ data: templates, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to list templates' });
  }
});

// GET /api/catalog/quotation-templates/:id - Single template
templatesRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        plan: true,
        lines: {
          include: {
            product: { include: { tax: true } },
            variant: true,
          },
        },
      },
    });

    if (!template) {
      res.status(404).json({ data: null, error: 'Quotation template not found' });
      return;
    }

    res.json({ data: template, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to get template' });
  }
});

// POST /api/catalog/quotation-templates - Create template (Admin only, R10)
templatesRouter.post('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { name, planId, validityDays, lines } = req.body;

    if (!name || !planId || validityDays === undefined) {
      res.status(400).json({
        data: null,
        error: 'name, planId, and validityDays are required',
      });
      return;
    }

    const template = await prisma.quotationTemplate.create({
      data: {
        name: String(name).trim(),
        planId: String(planId),
        validityDays: Math.max(1, parseInt(validityDays)),
        lines: lines && Array.isArray(lines) && lines.length > 0
          ? {
              create: lines.map((l: any) => ({
                productId: String(l.productId),
                variantId: l.variantId || null,
                quantity: Math.max(1, parseInt(l.quantity) || 1),
              })),
            }
          : undefined,
      },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    res.status(201).json({ data: template, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to create quotation template' });
  }
});

// POST /api/catalog/quotation-templates/:id/start-quote - Start a quote/subscription (Staff/Admin, R10)
templatesRouter.post(
  '/:id/start-quote',
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response) => {
    try {
      const { customerId, paymentTerms, startDate } = req.body;

      if (!customerId) {
        res.status(400).json({ data: null, error: 'customerId is required' });
        return;
      }

      const template = await prisma.quotationTemplate.findUnique({
        where: { id: req.params.id },
        include: {
          plan: true,
          lines: {
            include: {
              product: { include: { tax: true } },
              variant: true,
            },
          },
        },
      });

      if (!template) {
        res.status(404).json({ data: null, error: 'Template not found' });
        return;
      }

      const start = startDate ? new Date(startDate) : new Date();
      
      // Calculate expiry date from plan billing period
      const expiry = new Date(start);
      switch (template.plan.billingPeriod) {
        case 'DAILY':
          expiry.setDate(expiry.getDate() + 1);
          break;
        case 'WEEKLY':
          expiry.setDate(expiry.getDate() + 7);
          break;
        case 'MONTHLY':
          expiry.setMonth(expiry.getMonth() + 1);
          break;
        case 'YEARLY':
          expiry.setFullYear(expiry.getFullYear() + 1);
          break;
      }

      const validUntil = new Date(start);
      validUntil.setDate(validUntil.getDate() + template.validityDays);

      // Build subscription lines from template lines
      let subtotal = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      const linesData = template.lines.map((l) => {
        const basePrice = Number(l.product.salesPrice);
        const extra = l.variant ? Number(l.variant.extraPrice) : 0;
        const unitPrice = basePrice + extra;
        const taxRate = l.product.tax ? Number(l.product.tax.ratePercent) : 0;

        const calc = calculateLine({
          quantity: l.quantity,
          unitPrice,
          taxRate,
        });

        subtotal += calc.subtotal;
        taxTotal += calc.taxAmount;
        grandTotal += calc.amount;

        return {
          productId: l.productId,
          variantId: l.variantId || null,
          taxId: l.product.taxId || null,
          quantity: l.quantity,
          unitPrice,
          taxAmount: calc.taxAmount,
          amount: calc.amount,
        };
      });

      // Sequential human number: e.g. SUB-000123
      const count = await prisma.subscription.count();
      const seq = count + 1;
      const number = `SUB-${String(seq).padStart(6, '0')}`;

      const createdById = req.user?.id;

      const subscription = await prisma.subscription.create({
        data: {
          number,
          customerId,
          planId: template.planId,
          templateId: template.id,
          createdById,
          status: SubscriptionStatus.QUOTATION,
          startDate: start,
          expiryDate: expiry,
          quotationValidUntil: validUntil,
          paymentTerms: paymentTerms || PaymentTerms.IMMEDIATE,
          subtotal,
          taxTotal,
          total: grandTotal,
          lines: {
            create: linesData,
          },
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          plan: true,
          template: true,
          lines: {
            include: {
              product: true,
              variant: true,
              tax: true,
            },
          },
        },
      });

      res.status(201).json({ data: subscription, error: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: err.message || 'Failed to start quote from template' });
    }
  }
);
