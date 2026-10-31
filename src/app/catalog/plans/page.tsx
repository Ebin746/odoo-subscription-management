import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { CalendarClock, Check, X, ShieldAlert } from 'lucide-react';
import { PlanModal } from './PlanModal';


export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { subscriptions: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CatalogNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <CalendarClock className="w-6 h-6 text-cyan-400" />
              Subscription Plans & Policies (R8, R9)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Admin configuration for billing terms, pricing, and self-service action permissions
            </p>
          </div>
          <PlanModal />
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {plan.billingPeriod}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2">{plan.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-white">
                      ${Number(plan.price).toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-500 block">
                      /{plan.billingPeriod.toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Minimum Quantity</span>
                    <span className="font-semibold text-white">{plan.minQuantity} unit(s)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Active Subscriptions</span>
                    <span className="font-semibold text-indigo-400">{plan._count.subscriptions}</span>
                  </div>
                </div>

                {/* Plan Policy Flags (R9) */}
                <div className="mt-5 pt-4 border-t border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                    Lifecycle Policies (R9)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      {plan.autoClose ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600" />
                      )}
                      <span className={plan.autoClose ? 'text-slate-200' : 'text-slate-500'}>
                        Auto-close at End
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {plan.allowPause ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600" />
                      )}
                      <span className={plan.allowPause ? 'text-slate-200' : 'text-slate-500'}>
                        Allow Pause
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {plan.allowRenew ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600" />
                      )}
                      <span className={plan.allowRenew ? 'text-slate-200' : 'text-slate-500'}>
                        Allow Renewal
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {plan.allowEarlyClose ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600" />
                      )}
                      <span className={plan.allowEarlyClose ? 'text-slate-200' : 'text-slate-500'}>
                        Allow Early Close
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Status: {plan.isActive ? 'Active' : 'Disabled'}</span>
                <span>ID: {plan.id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
