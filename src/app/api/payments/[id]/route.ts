import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payment = await prisma.payment.findUnique({
      where: { id },
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
      return NextResponse.json({ data: null, error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ data: payment, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message || 'Failed to get payment' }, { status: 500 });
  }
}

