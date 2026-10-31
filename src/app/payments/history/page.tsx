import Link from 'next/link';
import { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PaymentsNav } from '@/components/payments/PaymentsNav';
import {
  History,
  Search,
  Filter,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  PlusCircle,
  FileText,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    page?: string;
    method?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function PaymentHistoryPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.method && Object.values(PaymentMethod).includes(params.method as PaymentMethod)) {
    where.method = params.method as PaymentMethod;
  }

  if (params.startDate || params.endDate) {
    where.paymentDate = {};
    if (params.startDate) where.paymentDate.gte = new Date(params.startDate);
    if (params.endDate) where.paymentDate.lte = new Date(params.endDate);
  }

  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { invoice: { number: { contains: q, mode: 'insensitive' } } },
      { invoice: { customerName: { contains: q, mode: 'insensitive' } } },
      { note: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [payments, total, paymentAgg] = await Promise.all([
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
          },
        },
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const totalVolume = Number(paymentAgg._sum.amount || 0);

  const hasFilter = Boolean(params.method || params.search || params.startDate || params.endDate);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PaymentsNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1 w-full">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <History className="w-6 h-6 text-emerald-400" />
              Payment History & Receipts (R20)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Audit log of all payments applied against subscription invoices ({total.toLocaleString()} records, ${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} volume)
            </p>
          </div>

          <Link
            href="/payments/record"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/30 transition self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            Record Payment
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <form method="GET" className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  name="search"
                  defaultValue={params.search || ''}
                  placeholder="Search invoice #, customer, note..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                name="method"
                defaultValue={params.method || ''}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Payment Methods</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-slate-500">From</span>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={params.startDate || ''}
                  className="bg-transparent text-white focus:outline-none text-xs"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-slate-500">To</span>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={params.endDate || ''}
                  className="bg-transparent text-white focus:outline-none text-xs"
                />
              </div>

              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition border border-slate-700"
              >
                Filter
              </button>

              {hasFilter && (
                <Link
                  href="/payments/history"
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Link>
              )}
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Receipt ID</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap text-xs">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                        #{p.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-indigo-400 whitespace-nowrap">
                        <Link href={`/payments/invoices?search=${p.invoice.number}`} className="hover:underline">
                          {p.invoice.number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{p.invoice.customerName}</div>
                        <div className="text-xs text-slate-400">{p.invoice.customerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {p.method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {p.recordedBy.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {p.note || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {payments.length > 0 ? skip + 1 : 0} to {Math.min(skip + payments.length, total)} of{' '}
              {total.toLocaleString()} payments
            </div>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`/payments/history?page=${page - 1}${params.method ? `&method=${params.method}` : ''}${
                    params.search ? `&search=${encodeURIComponent(params.search)}` : ''
                  }`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-600 cursor-not-allowed">
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </span>
              )}

              <span className="px-2">
                Page {page} of {Math.max(1, totalPages)}
              </span>

              {page < totalPages ? (
                <Link
                  href={`/payments/history?page=${page + 1}${params.method ? `&method=${params.method}` : ''}${
                    params.search ? `&search=${encodeURIComponent(params.search)}` : ''
                  }`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-600 cursor-not-allowed">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
