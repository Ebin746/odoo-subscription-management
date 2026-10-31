import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/catalog/products - List products (Paginated)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly');

    const where: any = {};
    if (activeOnly === 'true') where.isActive = true;
    if (type) where.type = type;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          variants: true,
          tax: { select: { id: true, name: true, ratePercent: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        products,
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
      { data: null, error: err.message || 'Failed to list products' },
      { status: 500 }
    );
  }
}

// POST /api/catalog/products - Create product (Admin only, R6 & R7)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, salesPrice, costPrice, notes, taxId, variants } = body;

    if (!name || !type || salesPrice === undefined || costPrice === undefined) {
      return NextResponse.json(
        { data: null, error: 'name, type, salesPrice, and costPrice are required' },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        type: String(type).trim(),
        salesPrice: Number(salesPrice),
        costPrice: Number(costPrice),
        notes: notes ? String(notes).trim() : null,
        taxId: taxId || null,
        variants: variants && Array.isArray(variants) && variants.length > 0
          ? {
              create: variants.map((v: any) => ({
                attribute: String(v.attribute).trim(),
                value: String(v.value).trim(),
                extraPrice: Number(v.extraPrice) || 0,
              })),
            }
          : undefined,
      },
      include: {
        variants: true,
        tax: true,
      },
    });

    return NextResponse.json({ data: product, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
