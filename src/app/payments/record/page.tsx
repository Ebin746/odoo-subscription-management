import { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PaymentsNav } from '@/components/payments/PaymentsNav';
import { RecordPaymentForm } from './RecordPaymentForm';
import { CreditCard, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    invoiceId?: string;
  }>;
}

export default async function RecordPaymentPage({ searchParams }: Props) {
  const params = await searchParams;

  // Load unpaid / partially paid invoices for the picker
  const invoicesRaw = await prisma.invoice.findMany({
    where: {
      status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.DRAFT] },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      number: true,
      customerName: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      status: true,
    },
  });

  const availableInvoices = invoicesRaw
    .map((i) => {
      const total = Number(i.total);
      const paid = Number(i.amountPaid);
      const owed = Math.max(0, Math.round((total - paid) * 100) / 100);
      return {
        id: i.id,
        number: i.number,
        customerName: i.customerName,
        total,
        amountPaid: paid,
        amountOwed: owed,
        dueDate: i.dueDate.toISOString(),
        status: i.status,
      };
    })
    .filter((i) => i.amountOwed > 0);

  // If a specific invoiceId was passed that is not in the top 100, fetch it specifically
  if (params.invoiceId && !availableInvoices.some((i) => i.id === params.invoiceId)) {
    const specific = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
      select: {
        id: true,
        number: true,
        customerName: true,
        total: true,
        amountPaid: true,
        dueDate: true,
        status: true,
      },
    });

    if (specific && specific.status !== InvoiceStatus.CANCELLED) {
      const total = Number(specific.total);
      const paid = Number(specific.amountPaid);
      const owed = Math.max(0, Math.round((total - paid) * 100) / 100);
      availableInvoices.unshift({
        id: specific.id,
        number: specific.number,
        customerName: specific.customerName,
        total,
        amountPaid: paid,
        amountOwed: owed,
        dueDate: specific.dueDate.toISOString(),
        status: specific.status,
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PaymentsNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1 w-full">
        <div>
          <Link
            href="/payments"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Record Payment (R20)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Apply payments against invoices under the strict payment rules (covers total → PAID; partial → CONFIRMED)
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl">
          <RecordPaymentForm
            initialInvoiceId={params.invoiceId}
            availableInvoices={availableInvoices}
          />
        </div>
      </main>
    </div>
  );
}
