import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { FileText, Clock, Package, Plus, Send } from 'lucide-react';
import { StartQuoteButton } from './StartQuoteButton';
import { TemplateModal } from './TemplateModal';


export const dynamic = 'force-dynamic';

export default async function QuotationTemplatesPage() {
  const [templates, plans, products, customers] = await Promise.all([
    prisma.quotationTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        lines: {
          include: {
            product: { include: { tax: true } },
            variant: true,
          },
        },
      },
    }),
    prisma.plan.findMany({ where: { isActive: true } }),
    prisma.product.findMany({ where: { isActive: true }, include: { variants: true } }),
    prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true, name: true, email: true } }),
  ]);

  const serializedPlans = plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    billingPeriod: p.billingPeriod,
  }));

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    salesPrice: Number(p.salesPrice),
    variants: p.variants.map((v) => ({
      id: v.id,
      attribute: v.attribute,
      value: v.value,
      extraPrice: Number(v.extraPrice),
    })),
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CatalogNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-amber-400" />
              Quotation Templates (R10)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Admin-created bundles with pre-configured plans and lines. Sales reps start quotes with 1 click.
            </p>
          </div>
          <TemplateModal plans={serializedPlans} products={serializedProducts} />
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{template.name}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        {template.plan.name} (${Number(template.plan.price).toFixed(2)}/{template.plan.billingPeriod.toLowerCase()})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5" /> Valid for {template.validityDays} days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lines breakdown */}
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" />
                    Bundled Products ({template.lines.length})
                  </div>
                  <div className="space-y-2 mt-2">
                    {template.lines.map((line) => (
                      <div
                        key={line.id}
                        className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">{line.product.name}</span>
                          {line.variant && (
                            <span className="ml-2 text-indigo-400">
                              ({line.variant.attribute}: {line.variant.value})
                            </span>
                          )}
                        </div>
                        <div className="text-slate-300 font-medium">
                          {line.quantity} × ${(
                            Number(line.product.salesPrice) + (line.variant ? Number(line.variant.extraPrice) : 0)
                          ).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action: Start Quote from Template */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <span className="text-xs text-slate-500">
                  Created {new Date(template.createdAt).toLocaleDateString()}
                </span>
                <StartQuoteButton templateId={template.id} customers={customers} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
