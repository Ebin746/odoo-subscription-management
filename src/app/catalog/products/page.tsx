import { prisma } from '@/lib/prisma';
import { CatalogNav } from '@/components/catalog/CatalogNav';
import { Package, Plus, DollarSign, Tag, Info } from 'lucide-react';
import { ProductModal } from './ProductModal';


export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const [products, taxes] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        variants: true,
        tax: true,
      },
    }),
    prisma.tax.findMany({ where: { isActive: true } }),
  ]);

  const serializedTaxes = taxes.map((t) => ({
    id: t.id,
    name: t.name,
    ratePercent: Number(t.ratePercent),
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CatalogNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-400" />
              Products & Variants (R6, R7)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Admin-controlled product catalog with sales/cost prices and variant pricing rules
            </p>
          </div>
          <ProductModal taxes={serializedTaxes} />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                      {product.type}
                    </span>
                    <h3 className="text-lg font-semibold text-white mt-2">{product.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-emerald-400">
                      ${Number(product.salesPrice).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Cost: ${Number(product.costPrice).toFixed(2)}
                    </div>
                  </div>
                </div>

                {product.notes && (
                  <p className="text-sm text-slate-400 mt-3 flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{product.notes}</span>
                  </p>
                )}

                {/* Tax rule badge */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    Tax: {product.tax ? `${product.tax.name} (${Number(product.tax.ratePercent)}%)` : 'None'}
                  </span>
                  <span>{product.isActive ? 'Active' : 'Archived'}</span>
                </div>

                {/* Variants Section (R7) */}
                <div className="mt-4">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Variants ({product.variants.length})
                  </span>
                  {product.variants.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-xs flex items-center gap-1.5"
                        >
                          <span className="text-slate-300 font-medium">
                            {v.attribute}: {v.value}
                          </span>
                          {Number(v.extraPrice) > 0 && (
                            <span className="text-emerald-400 font-semibold">
                              +${Number(v.extraPrice).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic mt-1">No variants configured</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
