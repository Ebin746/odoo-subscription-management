import Link from 'next/link';
import { InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BillingNav } from '@/components/billing/BillingNav';
import { StatusBadge } from '@/components/billing/StatusBadge';
import { fmtDate, money } from '@/components/billing/format';
import { Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { RunBillingButton } from './RunBillingButton';

interface Props {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}

const statuses = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'];

export default async function InvoicesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1'));
  const limit = 20;

  const where: any = {};
  if (params.status && Object.values(InvoiceStatus).includes(params.status as InvoiceStatus)) {
    where.status = params.status;
  }
  if (params.search) {
    where.OR = [
      { number: { contains: params.search, mode: 'insensitive' } },
      { customerName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { subscription: { select: { number: true } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const link = (p: number) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    q.set('page', String(p));
    return `/billing/invoices?${q.toString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BillingNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-cyan-400" />
              Invoices
            </h1>
            <p className="text-slate-400 text-sm mt-1">{total} invoice(s). Drafts are created automatically every day.</p>
          </div>
          <RunBillingButton />
        </div>

        <form className="flex flex-wrap gap-3" action="/billing/invoices">
          <input
            name="search"
            defaultValue={params.search || ''}
            placeholder="Search number or customer"
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white w-64"
          />
          <select name="status" defaultValue={params.status || ''} className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white">
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white">Filter</button>
        </form>

        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Subscription</th>
                <th className="text-left px-4 py-3">Issued</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No invoices found. Use "Run billing now" to generate them.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <Link href={`/billing/invoices/${inv.id}`} className="text-cyan-400 hover:underline font-medium">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{inv.customerName}</td>
                  <td className="px-4 py-3 text-slate-400">{inv.subscription.number}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right text-white">{money(Number(inv.total))}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={link(page - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white">
                <ChevronLeft className="w-4 h-4" /> Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={link(page + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white">
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
