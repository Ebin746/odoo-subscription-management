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

    if (!sub.plan.allowPause) {
      return NextResponse.json({ data: null, error: 'Plan does not allow pause' }, { status: 400 });
    }

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      return NextResponse.json({ data: null, error: 'Only ACTIVE subscriptions can be paused' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { isPaused: true, pausedAt: new Date() },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to pause subscription' },
      { status: 500 }
    );
  }
}
