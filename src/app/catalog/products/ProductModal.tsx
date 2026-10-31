'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Tag } from 'lucide-react';

interface Tax {
  id: string;
  name: string;
  ratePercent: any;
}

export function ProductModal({ taxes }: { taxes: Tax[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Software',
    salesPrice: '',
    costPrice: '',
    notes: '',
    taxId: '',
  });

  const [variants, setVariants] = useState<Array<{ attribute: string; value: string; extraPrice: string }>>([]);

  const addVariantField = () => {
    setVariants([...variants, { attribute: 'Brand', value: '', extraPrice: '0' }]);
  };

  const removeVariantField = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, val: string) => {
    const updated = [...variants];
    (updated[index] as any)[field] = val;
    setVariants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          salesPrice: parseFloat(formData.salesPrice),
          costPrice: parseFloat(formData.costPrice),
          variants: variants.map((v) => ({
            ...v,
            extraPrice: parseFloat(v.extraPrice) || 0,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create product');

      setOpen(false);
      setFormData({
        name: '',
        type: 'Software',
        salesPrice: '',
        costPrice: '',
        notes: '',
        taxId: '',
      });
      setVariants([]);
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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-sm transition"
      >
        <Plus className="w-4 h-4" />
        Add Product (Admin)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create New Product (R6, R7)</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
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
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Brightloop CRM"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Type *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="e.g. Software, Add-on"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Tax Rule
                  </label>
                  <select
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">No Tax</option>
                    {taxes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({Number(t.ratePercent)}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Sales Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.salesPrice}
                    onChange={(e) => setFormData({ ...formData, salesPrice: e.target.value })}
                    placeholder="1200.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Cost Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="400.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal description or notes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Variants Section (R7) */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase">
                    Variants (e.g. Odoo brand +$560)
                  </span>
                  <button
                    type="button"
                    onClick={addVariantField}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Variant
                  </button>
                </div>

                {variants.map((v, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Attribute (e.g. Brand)"
                      value={v.attribute}
                      onChange={(e) => updateVariant(idx, 'attribute', e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. Odoo)"
                      value={v.value}
                      onChange={(e) => updateVariant(idx, 'value', e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="number"
                      placeholder="+Price"
                      value={v.extraPrice}
                      onChange={(e) => updateVariant(idx, 'extraPrice', e.target.value)}
                      className="w-24 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeVariantField(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
