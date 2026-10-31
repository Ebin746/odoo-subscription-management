import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // In demo/dev mode, check dev user id header or first customer
    let customerId = req.headers.get('x-dev-user-id');
    if (!customerId) {
      const demoCustomer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
      customerId = demoCustomer?.id || 'demo-customer-id';
    }

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

    return NextResponse.json({
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
    return NextResponse.json({ data: null, error: err.message || 'Failed to fetch customer payments' }, { status: 500 });
  }
}
