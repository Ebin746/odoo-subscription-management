import { Router, Request, Response } from 'express';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';

export const paymentsRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ data: null, error });

function paging(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// POST /api/payments - Record a payment against an invoice (R20)
// Role: ADMIN or STAFF
paymentsRouter.post('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const { invoiceId, amount, method, paymentDate, note } = req.body;

    if (!invoiceId) {
      return fail(res, 400, 'invoiceId is required');
    }
    if (!UUID.test(String(invoiceId))) {
      return fail(res, 404, 'Invoice not found');
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return fail(res, 400, 'Payment amount must be greater than zero');
    }

    if (!method || !Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      return fail(
        res,
        400,
        `Invalid payment method. Allowed values: ${Object.values(PaymentMethod).join(', ')}`
      );
    }

    const date = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(date.getTime())) {
      return fail(res, 400, 'Invalid paymentDate');
    }

    const recordedById = req.user!.id;

    // Execute payment and invoice update atomically in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lock the invoice row so two simultaneous payments are checked one after the other
      await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: { select: { id: true, name: true, email: true } } },
      });

      if (!invoice) {
        return { error: 'Invoice not found', status: 404 };
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        return { error: 'Cannot record payment for a cancelled invoice', status: 409 };
      }

      const total = Number(invoice.total);
      const currentPaid = Number(invoice.amountPaid);
      const remainingOwed = Math.round((total - currentPaid) * 100) / 100;

      if (remainingOwed <= 0 || invoice.status === InvoiceStatus.PAID) {
        return { error: 'Invoice is already fully paid', status: 409 };
      }

      const roundedPay = Math.round(payAmount * 100) / 100;
      if (roundedPay > remainingOwed) {
        return {
          error: `Payment amount (${roundedPay.toFixed(2)}) exceeds remaining amount owed (${remainingOwed.toFixed(2)})`,
          status: 400,
        };
      }

      const newAmountPaid = Math.round((currentPaid + roundedPay) * 100) / 100;
      const isFullyPaid = newAmountPaid >= total;

      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          recordedById,
          amount: roundedPay,
          method: method as PaymentMethod,
          paymentDate: date,
          note: note ? String(note).trim() : null,
        },
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerEmail: true,
              total: true,
              amountPaid: true,
              status: true,
            },
          },
          recordedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 2. Update Invoice: amountPaid and status (R20 payment rules)
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.CONFIRMED,
          paidAt: isFullyPaid ? new Date() : undefined,
          // A payment on a draft invoice confirms it
          confirmedAt: invoice.confirmedAt ?? new Date(),
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
        isFullyPaid,
      };
    });

    if ('error' in result) {
      return fail(res, result.status || 400, result.error || 'Payment failed');
    }

    res.status(201).json({
      data: {
        payment: result.payment,
        invoice: {
          id: result.invoice.id,
          number: result.invoice.number,
          total: Number(result.invoice.total),
          amountPaid: Number(result.invoice.amountPaid),
          status: result.invoice.status,
          isFullyPaid: result.isFullyPaid,
        },
      },
      error: null,
    });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to record payment');
  }
});

// GET /api/payments - List payments with filters & pagination (Staff/Admin)
paymentsRouter.get('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = paging(req);
    const { invoiceId, method, customerId, startDate, endDate, search } = req.query;

    const where: any = {};

    if (invoiceId) where.invoiceId = String(invoiceId);
    if (method && Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      where.method = method as PaymentMethod;
    }
    if (customerId) {
      where.invoice = { customerId: String(customerId) };
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(String(startDate));
      if (endDate) where.paymentDate.lte = new Date(String(endDate));
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { invoice: { number: { contains: q, mode: 'insensitive' } } },
        { invoice: { customerName: { contains: q, mode: 'insensitive' } } },
        { note: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerEmail: true,
              total: true,
              amountPaid: true,
              status: true,
              dueDate: true,
            },
          },
          recordedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: {
        payments,
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
    fail(res, 500, err.message || 'Failed to list payments');
  }
});

// GET /api/payments/mine - Customer portal: view own payments (R4 & P4)
paymentsRouter.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = paging(req);
    const customerId = req.user!.id;

    const where = {
      invoice: { customerId },
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              customerName: true,
              total: true,
              amountPaid: true,
              status: true,
              dueDate: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      data: {
        payments,
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
    fail(res, 500, err.message || 'Failed to fetch customer payments');
  }
});

// GET /api/payments/:id - Get single payment details
paymentsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!UUID.test(req.params.id)) {
      return fail(res, 404, 'Payment not found');
    }
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            customerId: true,
            customerName: true,
            customerEmail: true,
            total: true,
            amountPaid: true,
            status: true,
            dueDate: true,
            issueDate: true,
          },
        },
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!payment) {
      return fail(res, 404, 'Payment not found');
    }

    // Customer role can only see their own payments
    if (req.user!.role === 'CUSTOMER' && payment.invoice.customerId !== req.user!.id) {
      return fail(res, 404, 'Payment not found');
    }

    res.json({ data: payment, error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to get payment');
  }
});
