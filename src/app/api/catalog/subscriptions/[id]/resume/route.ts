import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sub = await prisma.subscription.findUnique({ where: { id } });

    if (!sub) {
      return NextResponse.json({ data: null, error: 'Subscription not found' }, { status: 404 });
    }

    if (!sub.isPaused) {
      return NextResponse.json({ data: null, error: 'Subscription is not paused' }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { isPaused: false, pausedAt: null },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to resume subscription' },
      { status: 500 }
    );
  }
}
