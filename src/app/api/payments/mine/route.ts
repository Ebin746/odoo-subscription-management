import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // The proxy sets x-dev-user-id from the verified login token.
    const customerId = req.headers.get('x-dev-user-id') || '00000000-0000-0000-0000-000000000000';

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

