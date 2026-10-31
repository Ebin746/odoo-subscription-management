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

    if (!sub.plan.allowRenew) {
      return NextResponse.json({ data: null, error: 'Plan does not allow renewal' }, { status: 400 });
    }

    if (sub.status === SubscriptionStatus.CLOSED) {
      return NextResponse.json({ data: null, error: 'Closed subscription cannot be renewed' }, { status: 400 });
    }

    const next = new Date(sub.expiryDate);
    switch (sub.plan.billingPeriod) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { expiryDate: next },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to renew subscription' },
      { status: 500 }
    );
  }
}
