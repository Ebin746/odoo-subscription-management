import { Router, Request, Response } from 'express';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireAuth, requireRole } from '../../shared/auth';
import { invalidate } from '../../shared/redis/cache';
import { rateLimit } from '../../shared/redis/rateMiddleware';
import { runBilling } from './billing';
import { getActiveBillingRunId, getBillingRun, startQueuedBilling } from './billingRun';
import { sendInvoiceEmailQueued } from './mailJobs';
import { renderInvoicePdf } from './pdf';

export const invoicesRouter = Router();

const listInclude = {
  subscription: { select: { id: true, number: true } },
};

const detailInclude = {
  lines: { orderBy: { kind: 'asc' as const } },
  subscription: { select: { id: true, number: true } },
  customer: { select: { id: true, name: true, email: true } },
  discountUsages: true,
};

const fail = (res: Response, status: number, error: string) => res.status(status).json({ data: null, error });

function paging(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// Loads an invoice a user may see: staff and admin see all, customers only their own.
async function loadVisibleInvoice(req: Request, res: Response) {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: detailInclude });
  if (!invoice || (req.user!.role === 'CUSTOMER' && invoice.customerId !== req.user!.id)) {
    fail(res, 404, 'Invoice not found');
    return null;
  }
  return invoice;
}

// GET /api/invoices - Staff/admin list (paginated, filtered)
invoicesRouter.get('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = paging(req);
    const where: any = {};
    const { status, customerId, subscriptionId, search } = req.query;
    if (status && Object.values(InvoiceStatus).includes(status as InvoiceStatus)) where.status = status;
    if (customerId) where.customerId = String(customerId);
    if (subscriptionId) where.subscriptionId = String(subscriptionId);
    if (search) {
      where.OR = [
        { number: { contains: String(search), mode: 'insensitive' } },
        { customerName: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: listInclude }),
      prisma.invoice.count({ where }),
    ]);
    res.json({
      data: { invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to list invoices');
  }
});

// GET /api/invoices/mine - A customer's own invoices (R6)
invoicesRouter.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = paging(req);
    const where = { customerId: req.user!.id };
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: listInclude }),
      prisma.invoice.count({ where }),
    ]);
    res.json({
      data: { invoices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to list invoices');
  }
});

// POST /api/invoices/run-billing - "Run billing now". With Redis the run is queued and answers 202 with a run id
// to follow; without it the run happens here and the result comes back directly.
invoicesRouter.post('/run-billing', requireRole('ADMIN', 'STAFF'), rateLimit({ name: 'run-billing', max: 10, windowSec: 60 }), async (_req: Request, res: Response) => {
  try {
    const started = await startQueuedBilling();
    if (started) {
      res.status(202).json({ data: { queued: true, runId: started.runId, alreadyRunning: started.alreadyRunning }, error: null });
      return;
    }
    const result = await runBilling();
    await invalidate('lookups-invoices');
    res.json({ data: result, error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Billing run failed');
  }
});

// GET /api/invoices/run-billing/active - the run in progress, if any (so the screen can pick it up again)
invoicesRouter.get('/run-billing/active', requireRole('ADMIN', 'STAFF'), async (_req: Request, res: Response) => {
  try {
    const runId = await getActiveBillingRunId();
    res.json({ data: runId ? await getBillingRun(runId) : null, error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to read billing status');
  }
});

// GET /api/invoices/run-billing/:runId - progress and totals of a queued run
invoicesRouter.get('/run-billing/:runId', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const run = await getBillingRun(req.params.runId);
    if (!run) return fail(res, 404, 'Billing run not found');
    res.json({ data: run, error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to read billing status');
  }
});

// GET /api/invoices/:id
invoicesRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const invoice = await loadVisibleInvoice(req, res);
    if (invoice) res.json({ data: invoice, error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to get invoice');
  }
});

// POST /api/invoices/:id/confirm - Draft to Confirmed
invoicesRouter.post('/:id/confirm', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const updated = await prisma.invoice.updateMany({
      where: { id: req.params.id, status: InvoiceStatus.DRAFT },
      data: { status: InvoiceStatus.CONFIRMED, confirmedAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { status: true } });
      return fail(res, exists ? 409 : 404, exists ? `Only draft invoices can be confirmed (this one is ${exists.status})` : 'Invoice not found');
    }
    await invalidate('dashboard', 'lookups-invoices');
    res.json({ data: await prisma.invoice.findUnique({ where: { id: req.params.id }, include: detailInclude }), error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to confirm invoice');
  }
});

// POST /api/invoices/:id/cancel - Draft or Confirmed to Cancelled; releases any discount uses it consumed
invoicesRouter.post('/:id/cancel', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: req.params.id }, include: { discountUsages: true } });
      if (!invoice) return { status: 404, error: 'Invoice not found' };
      if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
        return { status: 409, error: `A ${invoice.status.toLowerCase()} invoice cannot be cancelled` };
      }
      if (Number(invoice.amountPaid) > 0) {
        return { status: 409, error: 'Invoice has payments recorded and cannot be cancelled' };
      }
      const claimed = await tx.invoice.updateMany({
        where: { id: invoice.id, status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.CONFIRMED] } },
        data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
      });
      if (claimed.count === 0) return { status: 409, error: 'Invoice status changed, please reload' };
      for (const usage of invoice.discountUsages) {
        await tx.discount.update({ where: { id: usage.discountId }, data: { usedCount: { decrement: 1 } } });
      }
      await tx.discountUsage.deleteMany({ where: { invoiceId: invoice.id } });
      return { status: 200, error: null };
    });
    if (outcome.error) return fail(res, outcome.status, outcome.error);
    await invalidate('dashboard', 'lookups-invoices');
    res.json({ data: await prisma.invoice.findUnique({ where: { id: req.params.id }, include: detailInclude }), error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to cancel invoice');
  }
});

// POST /api/invoices/:id/send - Email the invoice (PDF attached) to the customer.
// With Redis the email is queued (and retried if the mail server fails); the invoice is marked sent once it goes out.
invoicesRouter.post('/:id/send', requireRole('ADMIN', 'STAFF'), rateLimit({ name: 'invoice-send', max: 30, windowSec: 60 }), async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!invoice) return fail(res, 404, 'Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) return fail(res, 409, 'A cancelled invoice cannot be sent');

    const queued = await sendInvoiceEmailQueued(invoice.id);
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: detailInclude });
    res.status(queued ? 202 : 200).json({ data: { ...updated, queued }, error: null });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to send invoice');
  }
});

// GET /api/invoices/:id/pdf - Print: PDF of the invoice (customers only for their own)
invoicesRouter.get('/:id/pdf', requireAuth, rateLimit({ name: 'invoice-pdf', max: 60, windowSec: 60 }), async (req: Request, res: Response) => {
  try {
    const invoice = await loadVisibleInvoice(req, res);
    if (!invoice) return;
    const pdf = await renderInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
    res.send(pdf);
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to render invoice');
  }
});
