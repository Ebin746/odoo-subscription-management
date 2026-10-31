import { NextRequest, NextResponse } from 'next/server';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId, amount, method, paymentDate, note } = body;

    if (!invoiceId) {
      return NextResponse.json({ data: null, error: 'invoiceId is required' }, { status: 400 });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ data: null, error: 'Payment amount must be greater than zero' }, { status: 400 });
    }

    if (!method || !Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      return NextResponse.json(
        { data: null, error: `Invalid payment method. Allowed: ${Object.values(PaymentMethod).join(', ')}` },
        { status: 400 }
      );
    }

    const date = paymentDate ? new Date(paymentDate) : new Date();
    if (isNaN(date.getTime())) {
      return NextResponse.json({ data: null, error: 'Invalid paymentDate' }, { status: 400 });
    }

    // Default admin user or dev header for recordedById
    const recordedById = req.headers.get('x-dev-user-id') || '00000000-0000-0000-0000-000000000001';

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        return { error: 'Invoice not found', status: 404 };
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        return { error: 'Cannot record payment for a cancelled invoice', status: 409 };
      }

      const total = Number(invoice.total);
      const currentPaid = Number(invoice.amountPaid);
      const remainingOwed = Math.round((total - currentPaid) * 100) / 100;

      if (remainingOwed <= 0 || invoice.status === InvoiceStatus.PAID) {
        return { error: 'Invoice is already fully paid', status: 409 };
      }

      const roundedPay = Math.round(payAmount * 100) / 100;
      if (roundedPay > remainingOwed) {
        return {
          error: `Payment amount (${roundedPay.toFixed(2)}) exceeds remaining amount owed (${remainingOwed.toFixed(2)})`,
          status: 400,
        };
      }

      // Ensure user exists for foreign key constraint in demo/dev mode
      let recorder = await tx.user.findUnique({ where: { id: recordedById } });
      if (!recorder) {
        recorder = await tx.user.findFirst({ where: { role: { in: ['ADMIN', 'STAFF'] } } });
        if (!recorder) {
          recorder = await tx.user.create({
            data: {
              id: recordedById,
              email: 'admin@brightloop.com',
              name: 'Brightloop Admin',
              passwordHash: 'dev-hash',
              role: 'ADMIN',
            },
          });
        }
      }

      const newAmountPaid = Math.round((currentPaid + roundedPay) * 100) / 100;
      const isFullyPaid = newAmountPaid >= total;

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          recordedById: recorder.id,
          amount: roundedPay,
          method: method as PaymentMethod,
          paymentDate: date,
          note: note ? String(note).trim() : null,
        },
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              customerName: true,
              total: true,
              amountPaid: true,
              status: true,
            },
          },
          recordedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.CONFIRMED,
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      });

      return { payment, invoice: updatedInvoice, isFullyPaid };
    });

    if ('error' in result) {
      return NextResponse.json({ data: null, error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({
      data: {
        payment: result.payment,
        invoice: {
          id: result.invoice.id,
          number: result.invoice.number,
          total: Number(result.invoice.total),
          amountPaid: Number(result.invoice.amountPaid),
          status: result.invoice.status,
          isFullyPaid: result.isFullyPaid,
        },
      },
      error: null,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message || 'Failed to record payment' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const invoiceId = searchParams.get('invoiceId');
    const method = searchParams.get('method');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const where: any = {};

    if (invoiceId) where.invoiceId = invoiceId;
    if (method && Object.values(PaymentMethod).includes(method as PaymentMethod)) {
      where.method = method as PaymentMethod;
    }
    if (customerId) where.invoice = { customerId };

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { invoice: { number: { contains: q, mode: 'insensitive' } } },
        { invoice: { customerName: { contains: q, mode: 'insensitive' } } },
        { note: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerEmail: true,
              total: true,
              amountPaid: true,
              status: true,
              dueDate: true,
            },
          },
          recordedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        payments,
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
    return NextResponse.json({ data: null, error: err.message || 'Failed to list payments' }, { status: 500 });
  }
}

