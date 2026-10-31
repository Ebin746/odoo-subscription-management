import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const targetStatus = String(body.status).toUpperCase() as SubscriptionStatus;

    if (!Object.values(SubscriptionStatus).includes(targetStatus)) {
      return NextResponse.json({ data: null, error: `Invalid status: ${body.status}` }, { status: 400 });
    }

    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: 'Subscription not found' }, { status: 404 });
    }

    const validTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
      DRAFT: [SubscriptionStatus.QUOTATION, SubscriptionStatus.CONFIRMED, SubscriptionStatus.CLOSED],
      QUOTATION: [SubscriptionStatus.CONFIRMED, SubscriptionStatus.CLOSED],
      CONFIRMED: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CLOSED],
      ACTIVE: [SubscriptionStatus.CLOSED],
      CLOSED: [],
    };

    if (!validTransitions[existing.status]?.includes(targetStatus)) {
      return NextResponse.json(
        { data: null, error: `Invalid transition from ${existing.status} to ${targetStatus}` },
        { status: 400 }
      );
    }

    const updateData: any = { status: targetStatus };
    if (targetStatus === SubscriptionStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: { plan: true, customer: true, lines: true },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to update status' },
      { status: 500 }
    );
  }
}
