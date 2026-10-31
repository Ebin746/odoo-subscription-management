import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subscription = await prisma.subscription.findUnique({
      where: { id },
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
      return NextResponse.json({ data: null, error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ data: subscription, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to get subscription' },
      { status: 500 }
    );
  }
}
