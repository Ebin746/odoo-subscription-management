import Link from 'next/link';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PaymentsNav } from '@/components/payments/PaymentsNav';
import {
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Mail,
  Phone,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    page?: string;
    filter?: string;
    search?: string;
  }>;
}

export default async function InvoicesOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  const currentFilter = params.filter || 'all';
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  const where: any = {};

  if (currentFilter === 'paid') {
    where.status = InvoiceStatus.PAID;
  } else if (currentFilter === 'outstanding') {
    where.status = InvoiceStatus.CONFIRMED;
  } else if (currentFilter === 'overdue') {
    where.status = InvoiceStatus.CONFIRMED;
    where.dueDate = { lt: todayDate };
  } else {
    // Exclude cancelled by default from primary operational view
    where.status = { in: [InvoiceStatus.DRAFT, InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] };
  }

  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerEmail: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Fast parallel queries indexed on status and dueDate (R23)
  const [invoices, total, allStats, overdueAgg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        subscription: { select: { id: true, number: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.groupBy({
      by: ['status'],
      _sum: { total: true, amountPaid: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: InvoiceStatus.CONFIRMED,
        dueDate: { lt: todayDate },
      },
      _count: { id: true },
      _sum: { total: true, amountPaid: true },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Compute summary values
  let paidCount = 0;
  let paidAmount = 0;
  let confirmedCount = 0;
  let confirmedTotal = 0;
  let confirmedPaid = 0;

  for (const s of allStats) {
    if (s.status === InvoiceStatus.PAID) {
      paidCount = s._count.id;
      paidAmount = Number(s._sum.amountPaid || s._sum.total || 0);
    } else if (s.status === InvoiceStatus.CONFIRMED) {
      confirmedCount = s._count.id;
      confirmedTotal = Number(s._sum.total || 0);
      confirmedPaid = Number(s._sum.amountPaid || 0);
    }
  }

  const outstandingOwed = Math.max(0, Math.round((confirmedTotal - confirmedPaid) * 100) / 100);
  const overdueCount = overdueAgg._count.id || 0;
  const overdueTotal = Number(overdueAgg._sum.total || 0);
  const overduePaid = Number(overdueAgg._sum.amountPaid || 0);
  const overdueOwed = Math.max(0, Math.round((overdueTotal - overduePaid) * 100) / 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PaymentsNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1 w-full">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-emerald-400" />
              Paid vs. Outstanding Invoices (R21)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time invoice status tracking, aging days calculation, and collections management
            </p>
          </div>

          <Link
            href="/payments/record"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/30 transition self-start sm:self-auto"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </Link>
        </div>

        {/* Status Ribbon Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/payments/invoices?filter=outstanding"
            className={`p-4 rounded-xl border transition ${
              currentFilter === 'outstanding'
                ? 'bg-blue-950/40 border-blue-500/50'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium uppercase tracking-wider">Total Outstanding</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white">
              ${outstandingOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-blue-400 mt-1">
              {confirmedCount.toLocaleString()} confirmed invoices awaiting payment
            </p>
          </Link>

          <Link
            href="/payments/invoices?filter=overdue"
            className={`p-4 rounded-xl border transition ${
              currentFilter === 'overdue'
                ? 'bg-rose-950/40 border-rose-500/60'
                : 'bg-rose-950/20 border-rose-900/40 hover:border-rose-800'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-rose-300">
              <span className="font-medium uppercase tracking-wider">Overdue (At Risk)</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-rose-300">
              ${overdueOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-rose-400 mt-1 font-medium">
              {overdueCount.toLocaleString()} invoices past due date (chasing priority)
            </p>
          </Link>

          <Link
            href="/payments/invoices?filter=paid"
            className={`p-4 rounded-xl border transition ${
              currentFilter === 'paid'
                ? 'bg-emerald-950/40 border-emerald-500/50'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium uppercase tracking-wider">Fully Paid Invoices</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white">
              ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-emerald-400 mt-1">
              {paidCount.toLocaleString()} invoices settled in full
            </p>
          </Link>
        </div>

        {/* Filter Navigation Tabs & Search */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'all', label: 'All Invoices' },
              { id: 'outstanding', label: `Outstanding (${confirmedCount})` },
              { id: 'overdue', label: `Overdue (${overdueCount})` },
              { id: 'paid', label: `Paid (${paidCount})` },
            ].map((tab) => (
              <Link
                key={tab.id}
                href={`/payments/invoices?filter=${tab.id}${params.search ? `&search=${encodeURIComponent(params.search)}` : ''}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  currentFilter === tab.id
                    ? tab.id === 'overdue'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {/* Search bar */}
          <form method="GET" className="flex items-center gap-2">
            <input type="hidden" name="filter" value={currentFilter} />
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                name="search"
                defaultValue={params.search || ''}
                placeholder="Search invoice #, customer..."
                className="w-56 sm:w-64 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition border border-slate-700"
            >
              Search
            </button>
            {params.search && (
              <Link
                href={`/payments/invoices?filter=${currentFilter}`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition"
                title="Clear search"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Link>
            )}
          </form>
        </div>

        {/* Invoices Table */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subscription</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Aging / Overdue</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Amount Owed</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 text-sm">
                      No invoices found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const invTotal = Number(inv.total);
                    const invPaid = Number(inv.amountPaid);
                    const amountOwed = Math.max(0, Math.round((invTotal - invPaid) * 100) / 100);
                    const dueTime = new Date(inv.dueDate).getTime();
                    const isOverdue = inv.status === InvoiceStatus.CONFIRMED && dueTime < todayDate.getTime() && amountOwed > 0;
                    const daysOverdue = isOverdue
                      ? Math.max(1, Math.floor((todayDate.getTime() - dueTime) / (1000 * 60 * 60 * 24)))
                      : 0;

                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-slate-800/30 transition ${
                          isOverdue ? 'bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-white whitespace-nowrap">
                          {inv.number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">{inv.customerName}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {inv.customerEmail}
                            </span>
                            {inv.customer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-500" />
                                {inv.customer.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-indigo-400 whitespace-nowrap">
                          {inv.subscription.number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 text-xs whitespace-nowrap">
                          {new Date(inv.issueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 text-xs whitespace-nowrap">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              +{daysOverdue} days overdue
                            </span>
                          ) : inv.status === InvoiceStatus.PAID ? (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Settled
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> On time
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-300 whitespace-nowrap">
                          ${invTotal.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                          {amountOwed > 0 ? (
                            <span className={isOverdue ? 'text-rose-400' : 'text-amber-400'}>
                              ${amountOwed.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-emerald-400">$0.00</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              inv.status === InvoiceStatus.PAID
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : inv.status === InvoiceStatus.CONFIRMED
                                ? isOverdue
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {amountOwed > 0 && inv.status !== InvoiceStatus.CANCELLED ? (
                            <Link
                              href={`/payments/record?invoiceId=${inv.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {invoices.length > 0 ? skip + 1 : 0} to {Math.min(skip + invoices.length, total)} of{' '}
              {total.toLocaleString()} invoices
            </div>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`/payments/invoices?page=${page - 1}&filter=${currentFilter}${
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
                  href={`/payments/invoices?page=${page + 1}&filter=${currentFilter}${
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
