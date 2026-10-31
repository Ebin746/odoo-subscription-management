import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const templates = await prisma.quotationTemplate.findMany({
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({ data: templates, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to list templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, planId, validityDays, lines } = body;

    if (!name || !planId || validityDays === undefined) {
      return NextResponse.json(
        { data: null, error: 'name, planId, and validityDays are required' },
        { status: 400 }
      );
    }

    const template = await prisma.quotationTemplate.create({
      data: {
        name: String(name).trim(),
        planId: String(planId),
        validityDays: Math.max(1, parseInt(validityDays)),
        lines: lines && Array.isArray(lines) && lines.length > 0
          ? {
              create: lines.map((l: any) => ({
                productId: String(l.productId),
                variantId: l.variantId || null,
                quantity: Math.max(1, parseInt(l.quantity) || 1),
              })),
            }
          : undefined,
      },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    return NextResponse.json({ data: template, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to create quotation template' },
      { status: 500 }
    );
  }
}
