import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { mayActOn } from '@/lib/ownership';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!sub || !mayActOn(req, sub.customerId)) {
      return NextResponse.json({ data: null, error: 'Subscription not found' }, { status: 404 });
    }

    if (!sub.plan.allowEarlyClose) {
      return NextResponse.json({ data: null, error: 'Plan does not allow early close' }, { status: 400 });
    }

    if (sub.status === SubscriptionStatus.CLOSED) {
      return NextResponse.json({ data: null, error: 'Subscription is already closed' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to close subscription early' },
      { status: 500 }
    );
  }
}
