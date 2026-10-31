import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { BillingNav } from '@/components/billing/BillingNav';
import { StatusBadge } from '@/components/billing/StatusBadge';
import { fmtDate, money } from '@/components/billing/format';
import { ArrowLeft } from 'lucide-react';
import { InvoiceActions } from './InvoiceActions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { kind: 'asc' } }, subscription: { select: { id: true, number: true } } },
  });
  if (!inv) notFound();

  const balance = Number(inv.total) - Number(inv.amountPaid);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BillingNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/billing/invoices" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> All invoices
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{inv.number}</h1>
              <StatusBadge status={inv.status} />
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Subscription {inv.subscription.number} · period {fmtDate(inv.periodStart)} to {fmtDate(inv.periodEnd)}
            </p>
            {inv.sentAt && <p className="text-xs text-slate-500 mt-1">Last sent {fmtDate(inv.sentAt)}</p>}
          </div>
          <InvoiceActions id={inv.id} status={inv.status} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 text-sm space-y-1">
            <div className="text-xs uppercase text-slate-500 mb-2">Bill to</div>
            <div className="text-white font-medium">{inv.customerName}</div>
            {inv.customerCompany && <div className="text-slate-300">{inv.customerCompany}</div>}
            {inv.customerAddress && <div className="text-slate-400">{inv.customerAddress}</div>}
            <div className="text-slate-400">{inv.customerEmail}</div>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 text-sm space-y-1">
            <div className="text-xs uppercase text-slate-500 mb-2">Dates</div>
            <div className="flex justify-between"><span className="text-slate-400">Issued</span><span>{fmtDate(inv.issueDate)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Due</span><span>{fmtDate(inv.dueDate)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Confirmed</span><span>{fmtDate(inv.confirmedAt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Paid</span><span>{fmtDate(inv.paidAt)}</span></div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Qty</th>
                <th className="text-right px-4 py-3">Unit price</th>
                <th className="text-right px-4 py-3">Tax</th>
                <th className="text-right px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-4 py-3 text-slate-200">{l.description}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{l.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{money(Number(l.unitPrice))}</td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {money(Number(l.taxAmount))} <span className="text-xs text-slate-600">({Number(l.taxPercent)}%)</span>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${l.kind === 'DISCOUNT' ? 'text-emerald-400' : 'text-white'}`}>
                    {money(Number(l.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full sm:w-72 rounded-xl bg-slate-900/60 border border-slate-800 p-5 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{money(Number(inv.subtotal))}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Discounts</span><span className="text-emerald-400">-{money(Number(inv.discountTotal))}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Tax</span><span>{money(Number(inv.taxTotal))}</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-2 text-white font-bold"><span>Total</span><span>{money(Number(inv.total))}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Paid</span><span>{money(Number(inv.amountPaid))}</span></div>
            <div className="flex justify-between font-semibold"><span className="text-slate-300">Balance due</span><span>{money(balance)}</span></div>
          </div>
        </div>
      </main>
    </div>
  );
}
