import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { 
  Package, 
  CalendarClock, 
  Repeat, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  TrendingUp,
  Plus
} from 'lucide-react';


export const dynamic = 'force-dynamic';

export default async function CatalogDashboard() {
  const [productCount, planCount, templateCount, totalSubs, activeSubs, quotationSubs] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.plan.count({ where: { isActive: true } }),
    prisma.quotationTemplate.count(),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'QUOTATION' } }),
  ]);

  const recentSubscriptions = await prisma.subscription.findMany({
    take: 8,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true, email: true } },
      plan: { select: { name: true, billingPeriod: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CatalogNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Catalog & Subscription Management
            </h1>
            <p className="text-slate-400 mt-1">
              Person 2 Slice • Products, Variants, Plans, Quotation Templates & Subscription Lifecycles (R6–R12)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/catalog/products"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium border border-slate-700 transition"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              New Product
            </Link>
            <Link
              href="/catalog/quotation-templates"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg shadow-indigo-600/30 transition"
            >
              <FileText className="w-4 h-4" />
              Create Quote
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Total Subscriptions</span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Repeat className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-white">{totalSubs.toLocaleString()}</span>
              <span className="text-xs text-emerald-400 font-medium flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> High volume
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Seeded & response &lt; 2s</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Active Subscriptions</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-400">{activeSubs.toLocaleString()}</span>
              <span className="text-xs text-slate-400">billed by P3</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Status = ACTIVE</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Open Quotations</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-400">{quotationSubs.toLocaleString()}</span>
              <span className="text-xs text-slate-400">awaiting confirmation</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">R10 & R12 flow</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-400">Catalog Offerings</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-purple-400">{productCount}</span>
              <span className="text-xs text-slate-400">products • {planCount} plans</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">R6, R7 & R8 models</p>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/catalog/products"
            className="group p-6 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 group-hover:scale-110 transition duration-200">
                <Package className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition" />
            </div>
            <h3 className="text-lg font-semibold text-white mt-4">Products & Variants (R6, R7)</h3>
            <p className="text-sm text-slate-400 mt-2">
              Configure products with sales and cost prices, notes, and variants (e.g. Odoo brand +$560 price differential).
            </p>
            <div className="mt-4 text-xs font-medium text-indigo-400">
              {productCount} active products available &rarr;
            </div>
          </Link>

          <Link
            href="/catalog/plans"
            className="group p-6 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 group-hover:scale-110 transition duration-200">
                <CalendarClock className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
            </div>
            <h3 className="text-lg font-semibold text-white mt-4">Billing Plans & Rules (R8, R9)</h3>
            <p className="text-sm text-slate-400 mt-2">
              Set billing frequency (daily/weekly/monthly/yearly) and admin action flags: autoClose, allowPause, allowRenew, allowEarlyClose.
            </p>
            <div className="mt-4 text-xs font-medium text-cyan-400">
              {planCount} configured plans &rarr;
            </div>
          </Link>

          <Link
            href="/catalog/quotation-templates"
            className="group p-6 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 group-hover:scale-110 transition duration-200">
                <FileText className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition" />
            </div>
            <h3 className="text-lg font-semibold text-white mt-4">Quotation Templates (R10)</h3>
            <p className="text-sm text-slate-400 mt-2">
              Preset product bundles with validity duration; sales reps start new customer quotes with a single click.
            </p>
            <div className="mt-4 text-xs font-medium text-amber-400">
              {templateCount} prebuilt templates &rarr;
            </div>
          </Link>
        </div>

        {/* Recent Subscriptions Table */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 flex items-center justify-between border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Subscriptions</h2>
              <p className="text-sm text-slate-400">Live feed of subscription lifecycle and status flows</p>
            </div>
            <Link
              href="/catalog/subscriptions"
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View all ({totalSubs.toLocaleString()}) &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Number</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Plan</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Total</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {recentSubscriptions.map((sub) => {
                  const statusColors: Record<string, string> = {
                    DRAFT: 'bg-slate-700/50 text-slate-300 border-slate-600',
                    QUOTATION: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                    CONFIRMED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
                    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                    CLOSED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
                  };

                  return (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4 font-mono font-medium text-white">
                        <Link href={`/catalog/subscriptions/${sub.id}`} className="hover:underline text-indigo-400">
                          {sub.number}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{sub.customer.name}</div>
                        <div className="text-xs text-slate-500">{sub.customer.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 font-medium">{sub.plan.name}</span>
                        <span className="text-xs text-slate-500 ml-2">({sub.plan.billingPeriod})</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            statusColors[sub.status] || 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {sub.status}
                          {sub.isPaused && ' (PAUSED)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        ${Number(sub.total).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/catalog/subscriptions/${sub.id}`}
                          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                        >
                          Manage &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
