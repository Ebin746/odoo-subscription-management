'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

export function TemplateModal({ plans, products }: { plans: any[]; products: any[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  const [validityDays, setValidityDays] = useState('30');
  const [lines, setLines] = useState<Array<{ productId: string; variantId: string; quantity: string }>>([
    { productId: products[0]?.id || '', variantId: '', quantity: '1' },
  ]);

  const addLine = () => {
    setLines([...lines, { productId: products[0]?.id || '', variantId: '', quantity: '1' }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, val: string) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = val;
    if (field === 'productId') {
      updated[idx].variantId = '';
    }
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/catalog/quotation-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          planId,
          validityDays: parseInt(validityDays) || 30,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            quantity: parseInt(l.quantity) || 1,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create template');

      setOpen(false);
      setName('');
      setValidityDays('30');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium shadow-sm transition"
      >
        <Plus className="w-4 h-4" />
        New Template (Admin)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create Quotation Template (R10)</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise Full Stack Bundle"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Attached Plan *
                  </label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {plans.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} (${Number(pl.price)}/{pl.billingPeriod.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Validity (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase">
                    Template Product Lines
                  </span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                {lines.map((l, idx) => {
                  const selProd = products.find((p) => p.id === l.productId);
                  return (
                    <div key={idx} className="flex items-center gap-2 mb-2.5">
                      <select
                        value={l.productId}
                        onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (${Number(p.salesPrice)})
                          </option>
                        ))}
                      </select>

                      {selProd && selProd.variants && selProd.variants.length > 0 && (
                        <select
                          value={l.variantId}
                          onChange={(e) => updateLine(idx, 'variantId', e.target.value)}
                          className="w-32 bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">Base Product</option>
                          {selProd.variants.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.value} (+${Number(v.extraPrice)})
                            </option>
                          ))}
                        </select>
                      )}

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                        className="w-16 bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-white"
                      />

                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
