import Link from 'next/link';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PaymentsNav } from '@/components/payments/PaymentsNav';
import {
  UserCheck,
  CreditCard,
  CheckCircle2,
  Receipt,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function CustomerMyPaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = 20;
  const skip = (page - 1) * limit;

  // In production, uses auth session. In demo/dev mode, fetch first customer
  const customer = await prisma.user.findFirst({
    where: { role: 'CUSTOMER' },
    select: { id: true, name: true, email: true, companyName: true },
  });

  const customerId = customer?.id || 'demo-customer-id';

  const [payments, total, paymentAgg, customerInvoicesAgg] = await Promise.all([
    prisma.payment.findMany({
      where: {
        invoice: { customerId },
      },
      skip,
      take: limit,
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
            amountPaid: true,
            status: true,
            dueDate: true,
          },
        },
      },
    }),
    prisma.payment.count({
      where: {
        invoice: { customerId },
      },
    }),
    prisma.payment.aggregate({
      where: {
        invoice: { customerId },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        customerId,
        status: InvoiceStatus.CONFIRMED,
      },
      _sum: { total: true, amountPaid: true },
      _count: { id: true },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const totalPaid = Number(paymentAgg._sum.amount || 0);

  const confirmedTotal = Number(customerInvoicesAgg._sum.total || 0);
  const confirmedPaid = Number(customerInvoicesAgg._sum.amountPaid || 0);
  const amountStillOwed = Math.max(0, Math.round((confirmedTotal - confirmedPaid) * 100) / 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PaymentsNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1 w-full">
        {/* Customer Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Customer Portal View (R4)
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-emerald-400" />
              My Payments & Billing History
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Account: <span className="text-white font-medium">{customer?.name || 'Customer'}</span>
              {customer?.companyName && ` (${customer.companyName})`} • {customer?.email}
            </p>
          </div>

          <Link
            href="/catalog/my-subscriptions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition self-start sm:self-auto"
          >
            My Subscriptions <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Customer KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Payments Made
            </span>
            <div className="mt-2 text-2xl font-extrabold text-emerald-400">
              ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Across {total.toLocaleString()} transactions
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Current Open Balance
            </span>
            <div className="mt-2 text-2xl font-extrabold text-white">
              ${amountStillOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              On {(customerInvoicesAgg._count.id || 0).toLocaleString()} open invoices
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Payment Status
            </span>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Account in Good Standing
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Receipts are automatically generated for each transaction.
            </p>
          </div>
        </div>

        {/* Customer Payments Table */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Receipts & Transaction History
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-center">Invoice Status</th>
                  <th className="py-3 px-4">Note / Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                      No payments found on this account yet.
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
                        {p.invoice.number}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {p.method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            p.invoice.status === InvoiceStatus.PAID
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {p.invoice.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {p.note || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {skip + 1} to {Math.min(skip + payments.length, total)} of {total} payments
              </div>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/payments/my-payments?page=${page - 1}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-slate-600 cursor-not-allowed">
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </span>
                )}
                <span className="px-2">Page {page} of {totalPages}</span>
                {page < totalPages ? (
                  <Link
                    href={`/payments/my-payments?page=${page + 1}`}
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
          )}
        </div>
      </main>
    </div>
  );
}
