import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { UserCheck, Shield, Repeat, Clock } from 'lucide-react';
import { CustomerSubCard } from './CustomerSubCard';


export const dynamic = 'force-dynamic';

export default async function MySubscriptionsPage() {
  // Query customer subscriptions for the demo customer (Acme Corp)
  const customer = await prisma.user.findFirst({
    where: { email: 'customer@acmecorp.com' },
  });

  const subscriptions = customer
    ? await prisma.subscription.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          lines: {
            include: {
              product: true,
              variant: true,
              tax: true,
            },
          },
        },
      })
    : [];

  const plainSubscriptions = JSON.parse(JSON.stringify(subscriptions));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CatalogNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Customer Portal
              </span>
              <span className="text-xs text-slate-500">
                Logged in as: <strong className="text-slate-300">{customer?.name || 'Acme Corp'}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-emerald-400" />
              My Subscriptions
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              View your active plans and self-serve actions permitted by your plan terms
            </p>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800">
            <Repeat className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No active subscriptions found</h3>
            <p className="text-sm text-slate-400 mt-1">
              Contact our sales team to request a quotation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plainSubscriptions.map((sub: any) => (
              <CustomerSubCard key={sub.id} subscription={sub} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
