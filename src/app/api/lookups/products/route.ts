import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        salesPrice: true,
        variants: {
          select: { id: true, attribute: true, value: true, extraPrice: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = products.map((p) => ({
      id: p.id,
      label: `${p.name} ($${Number(p.salesPrice).toFixed(2)})`,
      variants: p.variants.map((v) => ({
        id: v.id,
        label: `${v.attribute}: ${v.value} (+$${Number(v.extraPrice).toFixed(2)})`,
      })),
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to fetch product lookups' },
      { status: 500 }
    );
  }
}
