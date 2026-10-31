import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { 
  Repeat, 
  User, 
  Calendar, 
  CreditCard, 
  Package, 
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { SubscriptionActions } from './SubscriptionActions';


interface Props {
  params: Promise<{ id: string }>;
}

export default async function SubscriptionDetailPage({ params }: Props) {
  const { id } = await params;

  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
      template: true,
      lines: {
        include: {
          product: true,
          variant: true,
          tax: true,
        },
      },
    },
  });

  if (!sub) {
    notFound();
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-700/50 text-slate-300 border-slate-600',
    QUOTATION: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    CLOSED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CatalogNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/catalog/subscriptions"
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-white font-mono tracking-tight">
                  {sub.number}
                </h1>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                    statusColors[sub.status] || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {sub.status}
                  {sub.isPaused && ' • PAUSED'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">ID: {sub.id}</p>
            </div>
          </div>

          {/* Interactive State & Action Bar */}
          <SubscriptionActions subscription={sub} />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customer Card */}
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
              <User className="w-4 h-4" /> Customer Details
            </div>
            <div className="text-lg font-bold text-white">{sub.customer.name}</div>
            <div className="text-sm text-slate-400">{sub.customer.email}</div>
            {sub.customer.companyName && (
              <div className="text-xs text-slate-500">Company: {sub.customer.companyName}</div>
            )}
            {sub.customer.billingAddress && (
              <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                {sub.customer.billingAddress}
              </div>
            )}
          </div>

          {/* Plan Card */}
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
              <Repeat className="w-4 h-4" /> Plan & Terms
            </div>
            <div className="text-lg font-bold text-white">{sub.plan.name}</div>
            <div className="text-sm text-slate-300 font-medium">
              ${Number(sub.plan.price).toFixed(2)} / {sub.plan.billingPeriod.toLowerCase()}
            </div>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
              <span>Payment Terms:</span>
              <span className="font-mono text-white">{sub.paymentTerms}</span>
            </div>
            {sub.template && (
              <div className="text-xs text-amber-400">
                Template: {sub.template.name}
              </div>
            )}
          </div>

          {/* Timeline Card */}
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <Calendar className="w-4 h-4" /> Lifecycle Dates
            </div>
            <div className="text-xs text-slate-400 flex justify-between">
              <span>Start Date:</span>
              <span className="font-semibold text-white">
                {new Date(sub.startDate).toLocaleDateString()}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between">
              <span>Expiry Date:</span>
              <span className="font-semibold text-white">
                {new Date(sub.expiryDate).toLocaleDateString()}
              </span>
            </div>
            {sub.quotationValidUntil && (
              <div className="text-xs text-amber-400 flex justify-between pt-1 border-t border-slate-800">
                <span>Quote Valid Until:</span>
                <span className="font-semibold">
                  {new Date(sub.quotationValidUntil).toLocaleDateString()}
                </span>
              </div>
            )}
            {sub.closedAt && (
              <div className="text-xs text-rose-400 flex justify-between pt-1 border-t border-slate-800">
                <span>Closed At:</span>
                <span className="font-semibold">
                  {new Date(sub.closedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Product Lines Breakdown (R11) */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-400" />
              Subscription Lines (R11)
            </h2>
            <span className="text-xs text-slate-400">
              {sub.lines.length} configured product line(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Variant</th>
                  <th className="px-6 py-3.5">Quantity</th>
                  <th className="px-6 py-3.5">Unit Price</th>
                  <th className="px-6 py-3.5">Tax Rate</th>
                  <th className="px-6 py-3.5">Tax Amount</th>
                  <th className="px-6 py-3.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {sub.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-medium text-white">{line.product.name}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {line.variant ? `${line.variant.attribute}: ${line.variant.value}` : '—'}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium">{line.quantity}</td>
                    <td className="px-6 py-4 font-mono">${Number(line.unitPrice).toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {line.tax ? `${line.tax.name} (${Number(line.tax.ratePercent)}%)` : '0%'}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400">
                      ${Number(line.taxAmount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-white">
                      ${Number(line.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900/90 border-t border-slate-800 text-sm">
                <tr>
                  <td colSpan={6} className="px-6 py-3 text-right font-medium text-slate-400">
                    Subtotal:
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-white">
                    ${Number(sub.subtotal).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-6 py-2 text-right font-medium text-slate-400">
                    Taxes:
                  </td>
                  <td className="px-6 py-2 text-right font-mono font-semibold text-white">
                    ${Number(sub.taxTotal).toFixed(2)}
                  </td>
                </tr>
                <tr className="border-t border-slate-800 text-base">
                  <td colSpan={6} className="px-6 py-3 text-right font-bold text-white">
                    Grand Total:
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-extrabold text-emerald-400">
                    ${Number(sub.total).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
