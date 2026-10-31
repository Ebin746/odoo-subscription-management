import { NextRequest, NextResponse } from 'next/server';
import { InvoiceStatus, PaymentMethod, SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cachedJson, limitOr429 } from '@/lib/redisHttp';

async function computeDashboard(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const method = searchParams.get('method');
    const customerId = searchParams.get('customerId');

    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const paymentWhere: any = {};
    if (method && Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      paymentWhere.method = method as PaymentMethod;
    }
    if (customerId) {
      paymentWhere.invoice = { customerId };
    }
    if (startDate || endDate) {
      paymentWhere.paymentDate = {};
      if (startDate) paymentWhere.paymentDate.gte = new Date(startDate);
      if (endDate) paymentWhere.paymentDate.lte = new Date(endDate);
    }

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
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: false,
          ...(customerId ? { customerId } : {}),
        },
      }),
      prisma.subscription.aggregate({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: false,
          ...(customerId ? { customerId } : {}),
        },
        _sum: { total: true },
      }),
      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          isPaused: true,
          ...(customerId ? { customerId } : {}),
        },
      }),
      prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: { id: true },
        _avg: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: paymentWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.CONFIRMED,
          ...(customerId ? { customerId } : {}),
        },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: todayDate },
          ...(customerId ? { customerId } : {}),
        },
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
      }),
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
      prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: todayDate },
          ...(customerId ? { customerId } : {}),
        },
        take: 10,
        orderBy: { dueDate: 'asc' },
        include: {
          subscription: { select: { id: true, number: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      }),
    ]);

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

    return NextResponse.json({
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
    return NextResponse.json({ data: null, error: err.message || 'Failed to fetch finance dashboard' }, { status: 500 });
  }
}

// Cached for 30 seconds per filter combination; recording a payment or changing an invoice clears it.
export async function GET(req: NextRequest) {
  const limited = await limitOr429(req, 'dashboard', 120, 60);
  if (limited) return limited;
  return cachedJson('dashboard', new URL(req.url).search, 30, () => computeDashboard(req));
}
