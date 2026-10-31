import { NextRequest, NextResponse } from 'next/server';
import { BillingPeriod } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const billingPeriod = searchParams.get('billingPeriod');
    const activeOnly = searchParams.get('activeOnly');
    const search = searchParams.get('search');

    const where: any = {};
    if (activeOnly === 'true') where.isActive = true;
    if (billingPeriod && Object.values(BillingPeriod).includes(billingPeriod as BillingPeriod)) {
      where.billingPeriod = billingPeriod as BillingPeriod;
    }
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [plans, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { subscriptions: true } },
        },
      }),
      prisma.plan.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        plans,
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
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to list plans' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      price,
      billingPeriod,
      minQuantity,
      availableFrom,
      availableTo,
      autoClose,
      allowEarlyClose,
      allowPause,
      allowRenew,
    } = body;

    if (!name || price === undefined || !billingPeriod) {
      return NextResponse.json(
        { data: null, error: 'name, price, and billingPeriod are required' },
        { status: 400 }
      );
    }

    const periodUpper = String(billingPeriod).toUpperCase();
    if (!Object.values(BillingPeriod).includes(periodUpper as BillingPeriod)) {
      return NextResponse.json(
        { data: null, error: `Invalid billingPeriod: ${billingPeriod}` },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        name: String(name).trim(),
        price: Number(price),
        billingPeriod: periodUpper as BillingPeriod,
        minQuantity: minQuantity !== undefined ? Math.max(1, parseInt(minQuantity)) : 1,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
        autoClose: Boolean(autoClose),
        allowEarlyClose: Boolean(allowEarlyClose),
        allowPause: Boolean(allowPause),
        allowRenew: Boolean(allowRenew),
      },
    });

    return NextResponse.json({ data: plan, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to create plan' },
      { status: 500 }
    );
  }
}
