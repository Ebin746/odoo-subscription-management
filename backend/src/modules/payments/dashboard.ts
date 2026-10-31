import { Router, Request, Response } from 'express';
import { InvoiceStatus, PaymentMethod, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { requireRole } from '../../shared/auth';

export const paymentsDashboardRouter = Router();

const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ data: null, error });

// GET /api/payments/dashboard - Finance Dashboard (R22)
// Role: ADMIN or STAFF
paymentsDashboardRouter.get('/', requireRole('ADMIN', 'STAFF'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, method, customerId } = req.query;

    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    // 1. Payment filter where clause
    const paymentWhere: any = {};
    if (method && Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      paymentWhere.method = method as PaymentMethod;
    }
    if (customerId) {
      paymentWhere.invoice = { customerId: String(customerId) };
    }
    if (startDate || endDate) {
      paymentWhere.paymentDate = {};
      if (startDate) paymentWhere.paymentDate.gte = new Date(String(startDate));
      if (endDate) paymentWhere.paymentDate.lte = new Date(String(endDate));
    }

    // 2. Query KPIs in parallel for high performance (<2s)
    const [
      activeSubscriptionsCount,
      activeSubsTotals,
      pausedSubscriptionsCount,
      paymentAggregate,
      paymentMethodBreakdownRaw,
      confirmedInvoicesAgg,
      overdueInvoicesAgg,
      recentPayments,
      criticalOverdueInvoicesRaw,
    ] = await Promise.all([
      // Active non-paused subscriptions
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: false,
          ...(customerId ? { customerId: String(customerId) } : {}),
        },
      }),
      // Active subscriptions monetary volume
      prisma.subscription.aggregate({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: false,
          ...(customerId ? { customerId: String(customerId) } : {}),
        },
        _sum: { total: true },
      }),
      // Paused subscriptions count
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: true,
          ...(customerId ? { customerId: String(customerId) } : {}),
        },
      }),
      // Revenue & payment count (under filters)
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true },
      }),
      // Breakdown by payment method
      prisma.payment.groupBy({
        by: ['method'],
        where: paymentWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Confirmed invoices total and amount paid (amount still owed)
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.CONFIRMED,
          ...(customerId ? { customerId: String(customerId) } : {}),
        },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      // Overdue invoices aggregate
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: todayDate },
          ...(customerId ? { customerId: String(customerId) } : {}),
        },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      // Recent payments (latest 10)
      prisma.payment.findMany({
        where: paymentWhere,
        take: 10,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerEmail: true,
              total: true,
            },
          },
          recordedBy: {
            select: { id: true, name: true },
          },
        },
      }),
      // Top 10 critical overdue invoices to chase (longest overdue first)
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: todayDate },
          ...(customerId ? { customerId: String(customerId) } : {}),
        },
        take: 10,
        orderBy: { dueDate: 'asc' },
        include: {
          subscription: { select: { id: true, number: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      }),
    ]);

    // Compute derived metrics
    const totalRevenue = Number(paymentAggregate._sum.amount || 0);
    const paymentsCount = paymentAggregate._count.id || 0;
    const avgPayment = Number(paymentAggregate._avg.amount || 0);

    const confirmedTotal = Number(confirmedInvoicesAgg._sum.total || 0);
    const confirmedPaid = Number(confirmedInvoicesAgg._sum.amountPaid || 0);
    const amountStillOwed = Math.max(0, Math.round((confirmedTotal - confirmedPaid) * 100) / 100);

    const overdueTotal = Number(overdueInvoicesAgg._sum.total || 0);
    const overduePaid = Number(overdueInvoicesAgg._sum.amountPaid || 0);
    const overdueAmount = Math.max(0, Math.round((overdueTotal - overduePaid) * 100) / 100);
    const overdueCount = overdueInvoicesAgg._count.id || 0;

    const activeSubsValue = Number(activeSubsTotals._sum.total || 0);

    // Method breakdown dictionary
    const methodBreakdown = Object.values(PaymentMethod).map((m) => {
      const match = paymentMethodBreakdownRaw.find((item) => item.method === m);
      return {
        method: m,
        count: match?._count.id || 0,
        totalAmount: Number(match?._sum.amount || 0),
        percentage:
          totalRevenue > 0
            ? Math.round((Number(match?._sum.amount || 0) / totalRevenue) * 10000) / 100
            : 0,
      };
    });

    // Format top overdue invoices
    const overdueInvoices = criticalOverdueInvoicesRaw.map((inv) => {
      const invTotal = Number(inv.total);
      const invPaid = Number(inv.amountPaid);
      const owed = Math.max(0, Math.round((invTotal - invPaid) * 100) / 100);
      const dueTime = new Date(inv.dueDate).getTime();
      const daysOverdue = Math.max(1, Math.floor((todayDate.getTime() - dueTime) / (1000 * 60 * 60 * 24)));

      return {
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        customerPhone: inv.customer.phone,
        subscriptionNumber: inv.subscription.number,
        dueDate: inv.dueDate,
        total: invTotal,
        amountPaid: invPaid,
        amountOwed: owed,
        daysOverdue,
      };
    });

    res.json({
      data: {
        summary: {
          activeSubscriptionsCount,
          activeSubscriptionsValue: Math.round(activeSubsValue * 100) / 100,
          pausedSubscriptionsCount,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          paymentsCount,
          averagePaymentAmount: Math.round(avgPayment * 100) / 100,
          amountStillOwed,
          confirmedInvoicesCount: confirmedInvoicesAgg._count.id || 0,
          overdueCount,
          overdueAmount,
        },
        methodBreakdown,
        overdueInvoices,
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice.number,
          customerName: p.invoice.customerName,
          amount: Number(p.amount),
          method: p.method,
          paymentDate: p.paymentDate,
          note: p.note,
          recordedByName: p.recordedBy.name,
          createdAt: p.createdAt,
        })),
      },
      error: null,
    });
  } catch (err: any) {
    fail(res, 500, err.message || 'Failed to fetch finance dashboard');
  }
});

