import { Router, Request, Response } from 'express';
import { PaymentTerms, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';
import { calculateLine } from '../../shared/pricing';

export const subscriptionsRouter = Router();

// Helper to extend date by billing period
function extendDateByPeriod(date: Date, period: string): Date {
  const next = new Date(date);
  switch (period) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

// GET /api/catalog/subscriptions - List subscriptions (Paginated, filters)
subscriptionsRouter.get('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const { status, customerId, planId, isPaused, search } = req.query;

    const where: any = {};
    if (status && Object.values(SubscriptionStatus).includes(status as SubscriptionStatus)) {
      where.status = status as SubscriptionStatus;
    }
    if (customerId) {
      where.customerId = String(customerId);
    }
    if (planId) {
      where.planId = String(planId);
    }
    if (isPaused !== undefined) {
      where.isPaused = isPaused === 'true';
    }
    if (search) {
      where.OR = [
        { number: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } },
        { customer: { email: { contains: String(search), mode: 'insensitive' } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true, companyName: true } },
          plan: { select: { id: true, name: true, billingPeriod: true, price: true } },
          lines: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, attribute: true, value: true } },
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    res.json({
      data: {
        subscriptions,
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
    res.status(500).json({ data: null, error: err.message || 'Failed to list subscriptions' });
  }
});

// GET /api/catalog/my-subscriptions - Customer portal subscriptions
subscriptionsRouter.get('/my-subscriptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const customerId = req.user?.id;
    if (!customerId) {
      res.status(401).json({ data: null, error: 'Unauthorized' });
      return;
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
        invoices: {
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            amountPaid: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    res.json({ data: subscriptions, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to fetch customer subscriptions' });
  }
});

// GET /api/catalog/subscriptions/:id - Single subscription
subscriptionsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, email: true } },
        plan: true,
        template: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
        invoices: {
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            amountPaid: true,
            issueDate: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      res.status(404).json({ data: null, error: 'Subscription not found' });
      return;
    }

    // Role check: customer can only view their own subscription
    if (req.user?.role === 'CUSTOMER' && subscription.customerId !== req.user.id) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    res.json({ data: subscription, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to get subscription' });
  }
});

// POST /api/catalog/subscriptions - Create subscription from scratch (Staff/Admin, R11)
subscriptionsRouter.post('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const { customerId, planId, startDate, paymentTerms, lines } = req.body;

    if (!customerId || !planId || !lines || !Array.isArray(lines) || lines.length === 0) {
      res.status(400).json({
        data: null,
        error: 'customerId, planId, and at least one line are required',
      });
      return;
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(404).json({ data: null, error: 'Plan not found' });
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();
    const expiry = extendDateByPeriod(start, plan.billingPeriod);

    // Calculate line amounts
    let subtotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const lineItemsData = [];
    for (const item of lines) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { tax: true },
      });
      if (!product) {
        res.status(404).json({ data: null, error: `Product ${item.productId} not found` });
        return;
      }

      let extraPrice = 0;
      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        if (variant) extraPrice = Number(variant.extraPrice);
      }

      const unitPrice = Number(product.salesPrice) + extraPrice;
      const taxRate = product.tax ? Number(product.tax.ratePercent) : 0;
      const quantity = Math.max(1, parseInt(item.quantity) || 1);

      const calc = calculateLine({
        quantity,
        unitPrice,
        taxRate,
      });

      subtotal += calc.subtotal;
      taxTotal += calc.taxAmount;
      grandTotal += calc.amount;

      lineItemsData.push({
        productId: product.id,
        variantId: item.variantId || null,
        taxId: product.taxId || null,
        quantity,
        unitPrice,
        taxAmount: calc.taxAmount,
        amount: calc.amount,
      });
    }

    // Auto-incremented sequence for human number
    const count = await prisma.subscription.count();
    const seq = count + 1;
    const number = `SUB-${String(seq).padStart(6, '0')}`;

    const subscription = await prisma.subscription.create({
      data: {
        number,
        customerId,
        planId,
        createdById: req.user?.id,
        status: SubscriptionStatus.DRAFT,
        startDate: start,
        expiryDate: expiry,
        paymentTerms: paymentTerms || PaymentTerms.IMMEDIATE,
        subtotal,
        taxTotal,
        total: grandTotal,
        lines: {
          create: lineItemsData,
        },
      },
      include: {
        customer: true,
        plan: true,
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
    res.status(500).json({ data: null, error: err.message || 'Failed to create subscription' });
  }
});

// PUT /api/catalog/subscriptions/:id/status - Update status (R12 status flow)
// Draft -> Quotation -> Confirmed -> Active -> Closed
subscriptionsRouter.put(
  '/:id/status',
  requireRole('ADMIN', 'STAFF'),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const targetStatus = String(status).toUpperCase() as SubscriptionStatus;

      if (!Object.values(SubscriptionStatus).includes(targetStatus)) {
        res.status(400).json({ data: null, error: `Invalid status: ${status}` });
        return;
      }

      const existing = await prisma.subscription.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        res.status(404).json({ data: null, error: 'Subscription not found' });
        return;
      }

      // Valid state flow
      const validTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
        DRAFT: [SubscriptionStatus.QUOTATION, SubscriptionStatus.CONFIRMED, SubscriptionStatus.CLOSED],
        QUOTATION: [SubscriptionStatus.CONFIRMED, SubscriptionStatus.CLOSED],
        CONFIRMED: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED],
        ACTIVE: [SubscriptionStatus.CLOSED],
        CLOSED: [],
      };

      if (!validTransitions[existing.status]?.includes(targetStatus)) {
        res.status(400).json({
          data: null,
          error: `Invalid status transition from ${existing.status} to ${targetStatus}`,
        });
        return;
      }

      const updateData: any = { status: targetStatus };
      if (targetStatus === SubscriptionStatus.CLOSED) {
        updateData.closedAt = new Date();
      }

      const updated = await prisma.subscription.update({
        where: { id: req.params.id },
        data: updateData,
        include: { plan: true, customer: true, lines: true },
      });

      res.json({ data: updated, error: null });
    } catch (err: any) {
      res.status(500).json({ data: null, error: err.message || 'Failed to update subscription status' });
    }
  }
);

// POST /api/catalog/subscriptions/:id/pause - Pause subscription (R9, R12)
subscriptionsRouter.post('/:id/pause', requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });

    if (!sub) {
      res.status(404).json({ data: null, error: 'Subscription not found' });
      return;
    }

    if (req.user?.role === 'CUSTOMER' && sub.customerId !== req.user.id) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (!sub.plan.allowPause) {
      res.status(400).json({ data: null, error: 'Plan does not allow pausing subscriptions' });
      return;
    }

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      res.status(400).json({ data: null, error: 'Only ACTIVE subscriptions can be paused' });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { isPaused: true, pausedAt: new Date() },
    });

    res.json({ data: updated, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to pause subscription' });
  }
});

// POST /api/catalog/subscriptions/:id/resume - Resume subscription
subscriptionsRouter.post('/:id/resume', requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });

    if (!sub) {
      res.status(404).json({ data: null, error: 'Subscription not found' });
      return;
    }

    if (req.user?.role === 'CUSTOMER' && sub.customerId !== req.user.id) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (!sub.isPaused) {
      res.status(400).json({ data: null, error: 'Subscription is not paused' });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { isPaused: false, pausedAt: null },
    });

    res.json({ data: updated, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to resume subscription' });
  }
});

// POST /api/catalog/subscriptions/:id/renew - Renew subscription (R9)
subscriptionsRouter.post('/:id/renew', requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });

    if (!sub) {
      res.status(404).json({ data: null, error: 'Subscription not found' });
      return;
    }

    if (req.user?.role === 'CUSTOMER' && sub.customerId !== req.user.id) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (!sub.plan.allowRenew) {
      res.status(400).json({ data: null, error: 'Plan does not allow renewal' });
      return;
    }

    if (sub.status === SubscriptionStatus.CLOSED) {
      res.status(400).json({ data: null, error: 'Closed subscription cannot be renewed' });
      return;
    }

    const newExpiry = extendDateByPeriod(new Date(sub.expiryDate), sub.plan.billingPeriod);

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { expiryDate: newExpiry },
    });

    res.json({ data: updated, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to renew subscription' });
  }
});

// POST /api/catalog/subscriptions/:id/close-early - Close early (R9)
subscriptionsRouter.post('/:id/close-early', requireAuth, async (req: Request, res: Response) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });

    if (!sub) {
      res.status(404).json({ data: null, error: 'Subscription not found' });
      return;
    }

    if (req.user?.role === 'CUSTOMER' && sub.customerId !== req.user.id) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (!sub.plan.allowEarlyClose) {
      res.status(400).json({ data: null, error: 'Plan does not allow early closure' });
      return;
    }

    if (sub.status === SubscriptionStatus.CLOSED) {
      res.status(400).json({ data: null, error: 'Subscription is already closed' });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    res.json({ data: updated, error: null });
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message || 'Failed to close subscription early' });
  }
});
