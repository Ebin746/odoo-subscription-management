import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        billingPeriod: true,
      },
      orderBy: { name: 'asc' },
    });

    const result = plans.map((pl) => ({
      id: pl.id,
      label: `${pl.name} ($${Number(pl.price).toFixed(2)} / ${pl.billingPeriod.toLowerCase()})`,
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to fetch plan lookups' },
      { status: 500 }
    );
  }
}
