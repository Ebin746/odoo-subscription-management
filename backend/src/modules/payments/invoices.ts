import { Router, Request, Response } from 'express';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireRole } from '../../shared/auth';

export const paymentsInvoicesRouter = Router();

const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ data: null, error });

function paging(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// GET /api/payments/invoices/overview - Paid vs Outstanding vs Overdue invoices (R21)
// Role: ADMIN or STAFF
paymentsInvoicesRouter.get('/overview', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = paging(req);
    const { filter = 'all', search, customerId } = req.query;

    const today = new Date();
    // Normalize to start of today UTC
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const where: any = {};

    if (customerId) {
      where.customerId = String(customerId);
    }

    if (filter === 'paid') {
      where.status = InvoiceStatus.PAID;
    } else if (filter === 'outstanding') {
      where.status = InvoiceStatus.CONFIRMED;
    } else if (filter === 'overdue') {
      where.status = InvoiceStatus.CONFIRMED;
      where.dueDate = { lt: todayDate };
    } else {
      // 'all' excludes cancelled invoices by default unless requested, but shows draft, confirmed, paid
      where.status = { in: [InvoiceStatus.DRAFT, InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] };
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [invoices, total, allStats] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          subscription: { select: { id: true, number: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
          payments: {
            select: { id: true, amount: true, method: true, paymentDate: true },
            orderBy: { paymentDate: 'desc' },
          },
        },
      }),
      prisma.invoice.count({ where }),
      // Global summaries for the KPI banner
      prisma.invoice.groupBy({
        by: ['status'],
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
        where: customerId ? { customerId: String(customerId) } : undefined,
      }),
    ]);

    // Query overdue count and amount
    const overdueAgg = await prisma.invoice.aggregate({
      where: {
        status: InvoiceStatus.CONFIRMED,
        dueDate: { lt: todayDate },
        ...(customerId ? { customerId: String(customerId) } : {}),
      },
      _count: { id: true },
      _sum: { total: true, amountPaid: true },
    });

    const overdueCount = overdueAgg._count.id || 0;
    const overdueTotal = Number(overdueAgg._sum.total || 0);
    const overduePaid = Number(overdueAgg._sum.amountPaid || 0);
    const overdueOwed = Math.max(0, Math.round((overdueTotal - overduePaid) * 100) / 100);

    let paidCount = 0;
    let paidAmount = 0;
    let confirmedCount = 0;
    let confirmedTotal = 0;
    let confirmedPaid = 0;

    for (const stat of allStats) {
      if (stat.status === InvoiceStatus.PAID) {
        paidCount = stat._count.id;
        paidAmount = Number(stat._sum.amountPaid || stat._sum.total || 0);
      } else if (stat.status === InvoiceStatus.CONFIRMED) {
        confirmedCount = stat._count.id;
        confirmedTotal = Number(stat._sum.total || 0);
        confirmedPaid = Number(stat._sum.amountPaid || 0);
      }
    }

    const outstandingOwed = Math.max(0, Math.round((confirmedTotal - confirmedPaid) * 100) / 100);

    // Format invoice items with computed fields
    const formattedInvoices = invoices.map((inv) => {
      const invTotal = Number(inv.total);
      const invPaid = Number(inv.amountPaid);
      const amountOwed = Math.max(0, Math.round((invTotal - invPaid) * 100) / 100);
      const dueTime = new Date(inv.dueDate).getTime();
      const isOverdue = inv.status === InvoiceStatus.CONFIRMED && dueTime < todayDate.getTime() && amountOwed > 0;
      const daysOverdue = isOverdue
        ? Math.max(1, Math.floor((todayDate.getTime() - dueTime) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        customerPhone: inv.customer.phone,
        subscriptionNumber: inv.subscription.number,
        subscriptionId: inv.subscriptionId,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        total: invTotal,
        amountPaid: invPaid,
        amountOwed,
        isOverdue,
        daysOverdue,
        paymentsCount: inv.payments.length,
      };
    });

    res.json({
      data: {
        invoices: formattedInvoices,
        summary: {
          paidCount,
          paidAmount: Math.round(paidAmount * 100) / 100,
          outstandingCount: confirmedCount,
          outstandingAmount: outstandingOwed,
          overdueCount,
          overdueAmount: overdueOwed,
        },
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
    fail(res, 500, err.message || 'Failed to fetch invoices overview');
  }
});
