import { NextRequest, NextResponse } from 'next/server';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('search');
    const customerId = searchParams.get('customerId');

    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    const where: any = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (filter === 'paid') {
      where.status = InvoiceStatus.PAID;
    } else if (filter === 'outstanding') {
      where.status = InvoiceStatus.CONFIRMED;
    } else if (filter === 'overdue') {
      where.status = InvoiceStatus.CONFIRMED;
      where.dueDate = { lt: todayDate };
    } else {
      where.status = { in: [InvoiceStatus.DRAFT, InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] };
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [invoices, total, allStats, overdueAgg] = await Promise.all([
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
      prisma.invoice.groupBy({
        by: ['status'],
        _sum: { total: true, amountPaid: true },
        _count: { id: true },
        where: customerId ? { customerId } : undefined,
      }),
      prisma.invoice.aggregate({
        where: {
          status: InvoiceStatus.CONFIRMED,
          dueDate: { lt: todayDate },
          ...(customerId ? { customerId } : {}),
        },
        _count: { id: true },
        _sum: { total: true, amountPaid: true },
      }),
    ]);

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

    return NextResponse.json({
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
    return NextResponse.json({ data: null, error: err.message || 'Failed to fetch invoices overview' }, { status: 500 });
  }
}

