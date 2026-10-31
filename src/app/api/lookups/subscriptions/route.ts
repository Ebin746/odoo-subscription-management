import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      select: {
        id: true,
        number: true,
        customer: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const result = subscriptions.map((s) => ({
      id: s.id,
      label: `${s.number} - ${s.customer.name || s.customer.email}`,
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to fetch subscription lookups' },
      { status: 500 }
    );
  }
}
