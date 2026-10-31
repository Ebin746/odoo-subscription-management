import { prisma } from '@/lib/prisma';
import { BillingNav } from '@/components/billing/BillingNav';
import { plain } from '@/components/billing/format';
import { Tag } from 'lucide-react';
import { DiscountManager } from './DiscountManager';

export default async function DiscountsPage() {
  const [discounts, products, subscriptions] = await Promise.all([
    prisma.discount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { targets: { include: { product: { select: { name: true } }, subscription: { select: { number: true } } } } },
    }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.subscription.findMany({ select: { id: true, number: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BillingNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-cyan-400" />
            Discount Rules
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Valid discounts are added to the next invoice automatically and stop when expired or used up. Admin only.
          </p>
        </div>
        <DiscountManager discounts={plain(discounts)} products={products} subscriptions={subscriptions} />
      </main>
    </div>
  );
}
