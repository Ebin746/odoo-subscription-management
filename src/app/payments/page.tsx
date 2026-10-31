import Link from 'next/link';
import { InvoiceStatus, PaymentMethod, SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cached } from '@backend/shared/redis/cache';
import { PaymentsNav } from '@/components/payments/PaymentsNav';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Repeat,
  CreditCard,
  Calendar,
  Filter,
  ArrowRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Receipt,
  RotateCcw,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    method?: string;
    customerId?: string;
  }>;
}

export default async function FinanceDashboardPage({ searchParams }: Props) {
  const params = await searchParams;

  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  const paymentWhere: any = {};
  if (params.method && Object.values(PaymentMethod).includes(params.method as PaymentMethod)) {
    paymentWhere.method = params.method as PaymentMethod;
  }
  if (params.customerId) {
    paymentWhere.invoice = { customerId: params.customerId };
  }
  if (params.startDate || params.endDate) {
    paymentWhere.paymentDate = {};
    if (params.startDate) paymentWhere.paymentDate.gte = new Date(params.startDate);
    if (params.endDate) paymentWhere.paymentDate.lte = new Date(params.endDate);
  }

  // Parallel database queries for performance under 2 seconds (R23)
  const [
    activeSubsCount,
    activeSubsTotals,
    paymentAggregate,
    paymentMethodRaw,
    confirmedInvoicesAgg,
    overdueInvoicesAgg,
    recentPayments,
    criticalOverdueInvoices,
  ] = await cached('dashboard', `page:${JSON.stringify(params)}`, 30, () => Promise.all([
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        isPaused: false,
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
    }),
    prisma.subscription.aggregate({
      where: {
        status: SubscriptionStatus.ACTIVE,
        isPaused: false,
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
      _sum: { total: true },
    }),
    prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: paymentWhere,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: InvoiceStatus.CONFIRMED,
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
      _sum: { total: true, amountPaid: true },
      _count: { id: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: InvoiceStatus.CONFIRMED,
        dueDate: { lt: todayDate },
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
      _sum: { total: true, amountPaid: true },
      _count: { id: true },
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      take: 8,
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            customerName: true,
            total: true,
          },
        },
        recordedBy: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.CONFIRMED,
        dueDate: { lt: todayDate },
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
      take: 6,
      orderBy: { dueDate: 'asc' },
      include: {
        subscription: { select: { id: true, number: true } },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
  ]));

  const totalRevenue = Number(paymentAggregate._sum.amount || 0);
  const totalPaymentsCount = paymentAggregate._count.id || 0;
  const avgPayment = Number(paymentAggregate._avg.amount || 0);

  const confirmedTotal = Number(confirmedInvoicesAgg._sum.total || 0);
  const confirmedPaid = Number(confirmedInvoicesAgg._sum.amountPaid || 0);
  const amountStillOwed = Math.max(0, Math.round((confirmedTotal - confirmedPaid) * 100) / 100);

  const overdueTotal = Number(overdueInvoicesAgg._sum.total || 0);
  const overduePaid = Number(overdueInvoicesAgg._sum.amountPaid || 0);
  const overdueAmount = Math.max(0, Math.round((overdueTotal - overduePaid) * 100) / 100);
  const overdueCount = overdueInvoicesAgg._count.id || 0;

  const activeSubsValue = Number(activeSubsTotals._sum.total || 0);

  const methodBreakdown = Object.values(PaymentMethod).map((m) => {
    const match = paymentMethodRaw.find((item) => item.method === m);
    const amount = Number(match?._sum.amount || 0);
    return {
      method: m,
      count: match?._count.id || 0,
      amount,
      percentage: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 1000) / 10 : 0,
    };
  });

  const methodColors: Record<string, string> = {
    CARD: 'bg-emerald-500',
    BANK_TRANSFER: 'bg-blue-500',
    UPI: 'bg-violet-500',
    CASH: 'bg-amber-500',
    OTHER: 'bg-slate-500',
  };

  const hasActiveFilter = Boolean(params.startDate || params.endDate || params.method || params.customerId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PaymentsNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1 w-full">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-emerald-400 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20" />
              Finance & Revenue Dashboard
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Person 4 Slice • Active Subscriptions, Revenue, Payments & Overdue Invoices (R20–R23)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/payments/invoices?filter=overdue"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium border border-rose-500/30 transition"
            >
              <AlertTriangle className="w-4 h-4" />
              Chase Overdue ({overdueCount})
            </Link>
            <Link
              href="/payments/record"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/30 transition"
            >
              <PlusCircle className="w-4 h-4" />
              Record Payment
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <form method="GET" className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <Filter className="w-3.5 h-3.5 text-emerald-400" />
                <span>Filters:</span>
              </div>

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

              <select
                name="method"
                defaultValue={params.method || ''}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Payment Methods</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI Payment</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>

              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition border border-slate-700"
              >
                Apply
              </button>

              {hasActiveFilter && (
                <Link
                  href="/payments"
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Link>
              )}
            </div>

            <div className="text-xs text-slate-400">
              Showing filtered revenue metrics & outstanding balances
            </div>
          </form>
        </div>

        {/* Primary 4 KPI Cards (R22) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Revenue Collected */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Total Revenue Collected
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">
                ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {totalPaymentsCount.toLocaleString()} payments recorded
              </p>
            </div>
          </div>

          {/* 2. Amount Still Owed */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Amount Still Owed
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">
                ${amountStillOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs text-blue-400 mt-1">
                On {(confirmedInvoicesAgg._count.id || 0).toLocaleString()} confirmed invoices
              </p>
            </div>
          </div>

          {/* 3. Overdue Invoices (Alert) */}
          <div className="p-5 rounded-xl bg-rose-950/20 border border-rose-900/40 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-rose-300">
                Overdue Invoices
              </span>
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-rose-300">
                ${overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {overdueCount.toLocaleString()} past due date (chase needed)
              </p>
            </div>
          </div>

          {/* 4. Active Subscriptions */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Active Subscriptions
              </span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Repeat className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-white">
                {activeSubsCount.toLocaleString()}
              </span>
              <p className="text-xs text-indigo-400 mt-1">
                ${activeSubsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} volume
              </p>
            </div>
          </div>
        </div>

        {/* Mid-Row: Payment Method Breakdown & Collection Efficiency */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Method Breakdown */}
          <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Revenue by Payment Method
              </h2>
              <span className="text-xs text-slate-400">
                Avg Payment: ${avgPayment.toFixed(2)}
              </span>
            </div>

            {/* Visual stacked bar */}
            <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
              {methodBreakdown.map((item) => (
                <div
                  key={item.method}
                  style={{ width: `${Math.max(item.percentage, item.amount > 0 ? 2 : 0)}%` }}
                  className={`${methodColors[item.method] || 'bg-slate-600'} transition-all`}
                  title={`${item.method}: $${item.amount.toLocaleString()} (${item.percentage}%)`}
                />
              ))}
            </div>

            {/* List breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              {methodBreakdown.map((item) => (
                <div key={item.method} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${methodColors[item.method] || 'bg-slate-400'}`} />
                    <span className="text-[11px] font-medium text-slate-300 truncate">
                      {item.method.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-1.5 font-bold text-white text-sm">
                    ${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {item.count} payments ({item.percentage}%)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Summary / Collection Status */}
          <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-400" />
                Billing & Collection Summary
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time snapshot across all Brightloop subscription contracts
              </p>
            </div>

            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Total Payments Recorded:</span>
                <span className="font-semibold text-white">{totalPaymentsCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Average Transaction Size:</span>
                <span className="font-semibold text-white">${avgPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Confirmed Invoices Outstanding:</span>
                <span className="font-semibold text-amber-400">${amountStillOwed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">Overdue Invoices at Risk:</span>
                <span className="font-semibold text-rose-400">{overdueCount} (${overdueAmount.toLocaleString()})</span>
              </div>
            </div>

            <Link
              href="/payments/invoices"
              className="w-full text-center py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              Inspect All Invoices & Aging <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Critical Overdue Invoices to Chase (R21) */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Critical Overdue Invoices to Chase (R21)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Invoices past payment terms requiring immediate follow-up
              </p>
            </div>
            <Link
              href="/payments/invoices?filter=overdue"
              className="text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              View all {overdueCount} overdue invoices <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {criticalOverdueInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              Great news! No overdue invoices are pending at this time.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Days Overdue</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Amount Owed</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {criticalOverdueInvoices.map((inv) => {
                    const totalVal = Number(inv.total);
                    const paidVal = Number(inv.amountPaid);
                    const owed = Math.max(0, Math.round((totalVal - paidVal) * 100) / 100);
                    const dueTime = new Date(inv.dueDate).getTime();
                    const daysOverdue = Math.max(1, Math.floor((todayDate.getTime() - dueTime) / (1000 * 60 * 60 * 24)));

                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-4 font-mono font-medium text-white">
                          <Link href={`/payments/invoices?search=${inv.number}`} className="hover:underline text-indigo-400">
                            {inv.number}
                          </Link>
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
                        <td className="py-3.5 px-4 text-slate-300">
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            +{daysOverdue} days overdue
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400">
                          ${totalVal.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-400">
                          ${owed.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/payments/record?invoiceId=${inv.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                          >
                            <CreditCard className="w-3 h-3" />
                            Record Payment
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Payments Stream (R20) */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              Recent Payments (R20)
            </h2>
            <Link
              href="/payments/history"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Full Payment History ({totalPaymentsCount.toLocaleString()}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-400">
                      {p.invoice.number}
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {p.invoice.customerName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {p.method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {p.recordedBy.name}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {p.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        Brightloop Software • Person 4 Slice (Payments & Reporting) • Responding in &lt;2s
      </footer>
    </div>
  );
}
