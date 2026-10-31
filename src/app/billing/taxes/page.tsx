import { prisma } from '@/lib/prisma';
import { BillingNav } from '@/components/billing/BillingNav';
import { plain } from '@/components/billing/format';
import { Percent } from 'lucide-react';
import { TaxManager } from './TaxManager';

export default async function TaxesPage() {
  const taxes = await prisma.tax.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BillingNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Percent className="w-6 h-6 text-cyan-400" />
            Tax Rules
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Active taxes are applied automatically to invoice lines. Admin only.
          </p>
        </div>
        <TaxManager taxes={plain(taxes)} />
      </main>
    </div>
  );
}
