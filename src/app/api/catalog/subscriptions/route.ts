import { NextRequest, NextResponse } from 'next/server';
import { PaymentTerms, SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateLine } from '@/lib/pricing';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const planId = searchParams.get('planId');
    const isPaused = searchParams.get('isPaused');
    const search = searchParams.get('search');

    const where: any = {};
    if (status && Object.values(SubscriptionStatus).includes(status as SubscriptionStatus)) {
      where.status = status as SubscriptionStatus;
    }
    if (customerId) where.customerId = customerId;
    if (planId) where.planId = planId;
    if (isPaused !== null && isPaused !== undefined) {
      where.isPaused = isPaused === 'true';
    }
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true, companyName: true } },
          plan: { select: { id: true, name: true, billingPeriod: true, price: true, allowPause: true, allowRenew: true, allowEarlyClose: true } },
          lines: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, attribute: true, value: true } },
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        subscriptions,
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
      { data: null, error: err.message || 'Failed to list subscriptions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, planId, startDate, paymentTerms, lines } = body;

    if (!customerId || !planId || !lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { data: null, error: 'customerId, planId, and at least one line are required' },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ data: null, error: 'Plan not found' }, { status: 404 });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const expiry = new Date(start);
    switch (plan.billingPeriod) {
      case 'DAILY':
        expiry.setDate(expiry.getDate() + 1);
        break;
      case 'WEEKLY':
        expiry.setDate(expiry.getDate() + 7);
        break;
      case 'MONTHLY':
        expiry.setMonth(expiry.getMonth() + 1);
        break;
      case 'YEARLY':
        expiry.setFullYear(expiry.getFullYear() + 1);
        break;
    }

    let subtotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const lineItemsData = [];
    for (const item of lines) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { tax: true },
      });
      if (!product) {
        return NextResponse.json({ data: null, error: `Product not found: ${item.productId}` }, { status: 404 });
      }

      let extraPrice = 0;
      if (item.variantId) {
        const variant = await prisma.productVariant.findUnique({ where: { id: item.variantId } });
        if (variant) extraPrice = Number(variant.extraPrice);
      }

      const unitPrice = Number(product.salesPrice) + extraPrice;
      const taxRate = product.tax ? Number(product.tax.ratePercent) : 0;
      const quantity = Math.max(1, parseInt(item.quantity) || 1);

      const calc = calculateLine({
        quantity,
        unitPrice,
        taxRate,
      });

      subtotal += calc.subtotal;
      taxTotal += calc.taxAmount;
      grandTotal += calc.amount;

      lineItemsData.push({
        productId: product.id,
        variantId: item.variantId || null,
        taxId: product.taxId || null,
        quantity,
        unitPrice,
        taxAmount: calc.taxAmount,
        amount: calc.amount,
      });
    }

    const count = await prisma.subscription.count();
    const number = `SUB-${String(count + 1).padStart(6, '0')}`;

    const subscription = await prisma.subscription.create({
      data: {
        number,
        customerId,
        planId,
        status: SubscriptionStatus.DRAFT,
        startDate: start,
        expiryDate: expiry,
        paymentTerms: paymentTerms || PaymentTerms.IMMEDIATE,
        subtotal,
        taxTotal,
        total: grandTotal,
        lines: {
          create: lineItemsData,
        },
      },
      include: {
        customer: true,
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });

    return NextResponse.json({ data: subscription, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
