import { NextRequest, NextResponse } from 'next/server';
import { BillingPeriod } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        quotationTemplates: true,
        _count: { select: { subscriptions: true } },
      },
    });

    if (!plan) {
      return NextResponse.json({ data: null, error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ data: plan, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to get plan' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      price,
      billingPeriod,
      minQuantity,
      availableFrom,
      availableTo,
      isActive,
      autoClose,
      allowEarlyClose,
      allowPause,
      allowRenew,
    } = body;

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (price !== undefined) data.price = Number(price);
    if (billingPeriod !== undefined) {
      const periodUpper = String(billingPeriod).toUpperCase();
      if (!Object.values(BillingPeriod).includes(periodUpper as BillingPeriod)) {
        return NextResponse.json(
          { data: null, error: `Invalid billingPeriod: ${billingPeriod}` },
          { status: 400 }
        );
      }
      data.billingPeriod = periodUpper as BillingPeriod;
    }
    if (minQuantity !== undefined) data.minQuantity = Math.max(1, parseInt(minQuantity));
    if (availableFrom !== undefined) data.availableFrom = availableFrom ? new Date(availableFrom) : null;
    if (availableTo !== undefined) data.availableTo = availableTo ? new Date(availableTo) : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (autoClose !== undefined) data.autoClose = Boolean(autoClose);
    if (allowEarlyClose !== undefined) data.allowEarlyClose = Boolean(allowEarlyClose);
    if (allowPause !== undefined) data.allowPause = Boolean(allowPause);
    if (allowRenew !== undefined) data.allowRenew = Boolean(allowRenew);

    const updated = await prisma.plan.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to update plan' },
      { status: 500 }
    );
  }
}
