import { NextRequest, NextResponse } from 'next/server';
import { PaymentTerms, SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateLine } from '@/lib/pricing';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { customerId, paymentTerms, startDate } = body;

    if (!customerId) {
      return NextResponse.json({ data: null, error: 'customerId is required' }, { status: 400 });
    }

    const template = await prisma.quotationTemplate.findUnique({
      where: { id },
      include: {
        plan: true,
        lines: {
          include: {
            product: { include: { tax: true } },
            variant: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ data: null, error: 'Template not found' }, { status: 404 });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const expiry = new Date(start);
    switch (template.plan.billingPeriod) {
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

    const validUntil = new Date(start);
    validUntil.setDate(validUntil.getDate() + template.validityDays);

    let subtotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    const linesData = template.lines.map((l) => {
      const basePrice = Number(l.product.salesPrice);
      const extra = l.variant ? Number(l.variant.extraPrice) : 0;
      const unitPrice = basePrice + extra;
      const taxRate = l.product.tax ? Number(l.product.tax.ratePercent) : 0;

      const calc = calculateLine({
        quantity: l.quantity,
        unitPrice,
        taxRate,
      });

      subtotal += calc.subtotal;
      taxTotal += calc.taxAmount;
      grandTotal += calc.amount;

      return {
        productId: l.productId,
        variantId: l.variantId || null,
        taxId: l.product.taxId || null,
        quantity: l.quantity,
        unitPrice,
        taxAmount: calc.taxAmount,
        amount: calc.amount,
      };
    });

    const count = await prisma.subscription.count();
    const number = `SUB-${String(count + 1).padStart(6, '0')}`;

    const subscription = await prisma.subscription.create({
      data: {
        number,
        customerId,
        planId: template.planId,
        templateId: template.id,
        status: SubscriptionStatus.QUOTATION,
        startDate: start,
        expiryDate: expiry,
        quotationValidUntil: validUntil,
        paymentTerms: paymentTerms || PaymentTerms.IMMEDIATE,
        subtotal,
        taxTotal,
        total: grandTotal,
        lines: {
          create: linesData,
        },
      },
      include: {
        customer: true,
        plan: true,
        template: true,
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
      { data: null, error: err.message || 'Failed to start quote from template' },
      { status: 500 }
    );
  }
}
