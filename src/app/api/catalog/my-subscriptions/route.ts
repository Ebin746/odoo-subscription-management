import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // The proxy sets x-dev-user-id from the verified login token.
    const customerId = req.headers.get('x-dev-user-id');

    if (!customerId) {
      return NextResponse.json({ data: [], error: null });
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

    return NextResponse.json({ data: subscriptions, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to get customer subscriptions' },
      { status: 500 }
    );
  }
}
