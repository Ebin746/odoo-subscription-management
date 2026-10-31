import Link from 'next/link';
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { Repeat, Search, Filter, ChevronLeft, ChevronRight, CheckCircle2, PauseCircle } from 'lucide-react';


interface Props {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
    isPaused?: string;
  }>;
}

export default async function SubscriptionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1'));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (params.status && Object.values(SubscriptionStatus).includes(params.status as SubscriptionStatus)) {
    where.status = params.status as SubscriptionStatus;
  }
  if (params.isPaused !== undefined && params.isPaused !== '') {
    where.isPaused = params.isPaused === 'true';
  }
  if (params.search) {
    where.OR = [
      { number: { contains: params.search, mode: 'insensitive' } },
      { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      { customer: { email: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, email: true } },
        plan: { select: { name: true, billingPeriod: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Repeat className="w-6 h-6 text-indigo-400" />
              Subscription Management (R11, R12)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              High-performance paginated subscription registry ({total.toLocaleString()} total subscriptions)
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <form method="GET" className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                name="search"
                defaultValue={params.search || ''}
                placeholder="Search SUB number, customer name, email..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              name="status"
              defaultValue={params.status || ''}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="QUOTATION">Quotation</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              name="isPaused"
              defaultValue={params.isPaused || ''}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Running States</option>
              <option value="false">Active Only</option>
              <option value="true">Paused Only</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              Apply Filter
            </button>
          </form>
        </div>

        {/* Subscriptions Table */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Number</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Plan</th>
                  <th className="px-6 py-3.5">Terms</th>
                  <th className="px-6 py-3.5">Dates</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Total</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-mono font-semibold text-white">
                      <Link href={`/catalog/subscriptions/${sub.id}`} className="hover:underline text-indigo-400">
                        {sub.number}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{sub.customer.name}</div>
                      <div className="text-xs text-slate-500">{sub.customer.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-200">{sub.plan.name}</div>
                      <div className="text-xs text-slate-500">{sub.plan.billingPeriod}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {sub.paymentTerms}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      <div>Start: {new Date(sub.startDate).toLocaleDateString()}</div>
                      <div>Expiry: {new Date(sub.expiryDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          statusColors[sub.status] || 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {sub.status}
                        {sub.isPaused && (
                          <span className="text-amber-400 font-bold ml-1">● PAUSED</span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      ${Number(sub.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/catalog/subscriptions/${sub.id}`}
                        className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                      >
                        Details &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
            <div>
              Showing <span className="font-semibold text-white">{skip + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(skip + limit, total)}
              </span>{' '}
              of <span className="font-semibold text-white">{total.toLocaleString()}</span> subscriptions
            </div>

            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/catalog/subscriptions?page=${page - 1}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}
                  className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Link>
              )}
              <span className="text-xs text-slate-400 px-2">
                Page {page} of {totalPages || 1}
              </span>
              {page < totalPages && (
                <Link
                  href={`/catalog/subscriptions?page=${page + 1}${params.status ? `&status=${params.status}` : ''}${params.search ? `&search=${params.search}` : ''}`}
                  className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
