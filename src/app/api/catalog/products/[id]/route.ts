import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        tax: true,
      },
    });

    if (!product) {
      return NextResponse.json({ data: null, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ data: product, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to get product' },
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
    const { name, type, salesPrice, costPrice, notes, taxId, isActive } = body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(type !== undefined && { type: String(type).trim() }),
        ...(salesPrice !== undefined && { salesPrice: Number(salesPrice) }),
        ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...(taxId !== undefined && { taxId: taxId || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: {
        variants: true,
        tax: true,
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to update product' },
      { status: 500 }
    );
  }
}
