'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/components/billing/api';
import { fmtDate } from '@/components/billing/format';

interface Discount {
  id: string;
  name: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: string;
  scope: 'PRODUCT' | 'SUBSCRIPTION';
  minPurchaseAmount: string | null;
  minQuantity: number | null;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  targets: { productId: string | null; subscriptionId: string | null; product?: { name: string } | null; subscription?: { number: string } | null }[];
}

interface Option {
  id: string;
  name?: string;
  number?: string;
}

const today = new Date().toISOString().slice(0, 10);
const emptyForm = {
  name: '',
  type: 'PERCENTAGE',
  value: '',
  scope: 'SUBSCRIPTION',
  minPurchaseAmount: '',
  minQuantity: '',
  startDate: today,
  endDate: '',
  usageLimit: '',
  isActive: true,
  productIds: [] as string[],
  subscriptionIds: [] as string[],
};

const input = 'mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white';

export function DiscountManager({
  discounts,
  products,
  subscriptions,
}: {
  discounts: Discount[];
  products: Option[];
  subscriptions: Option[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Discount | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = (d: Discount | 'new') => {
    setEditing(d);
    setError(null);
    setForm(
      d === 'new'
        ? emptyForm
        : {
            name: d.name,
            type: d.type,
            value: String(Number(d.value)),
            scope: d.scope,
            minPurchaseAmount: d.minPurchaseAmount ? String(Number(d.minPurchaseAmount)) : '',
            minQuantity: d.minQuantity != null ? String(d.minQuantity) : '',
            startDate: d.startDate.slice(0, 10),
            endDate: d.endDate.slice(0, 10),
            usageLimit: d.usageLimit != null ? String(d.usageLimit) : '',
            isActive: d.isActive,
            productIds: d.targets.map((t) => t.productId).filter(Boolean) as string[],
            subscriptionIds: d.targets.map((t) => t.subscriptionId).filter(Boolean) as string[],
          }
    );
  };

  const toggle = (key: 'productIds' | 'subscriptionIds', id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        ...form,
        value: Number(form.value),
        minPurchaseAmount: form.minPurchaseAmount === '' ? null : Number(form.minPurchaseAmount),
        minQuantity: form.minQuantity === '' ? null : Number(form.minQuantity),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      };
      if (editing === 'new') await api('/api/discounts', 'POST', body);
      else await api(`/api/discounts/${(editing as Discount).id}`, 'PUT', body);
      setEditing(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (d: Discount) => {
    if (!confirm(`Delete discount "${d.name}"?`)) return;
    try {
      await api(`/api/discounts/${d.id}`, 'DELETE');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const state = (d: Discount) => {
    const now = new Date().toISOString().slice(0, 10);
    if (!d.isActive) return ['Inactive', 'text-slate-500'];
    if (d.usageLimit != null && d.usedCount >= d.usageLimit) return ['Used up', 'text-amber-400'];
    if (d.endDate.slice(0, 10) < now) return ['Expired', 'text-rose-400'];
    if (d.startDate.slice(0, 10) > now) return ['Scheduled', 'text-sky-400'];
    return ['Live', 'text-emerald-400'];
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => open('new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New Discount
        </button>
      </div>

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Discount</th>
              <th className="text-left px-4 py-3">Applies to</th>
              <th className="text-left px-4 py-3">Conditions</th>
              <th className="text-left px-4 py-3">Valid</th>
              <th className="text-right px-4 py-3">Used</th>
              <th className="text-left px-4 py-3">State</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No discounts yet.
                </td>
              </tr>
            )}
            {discounts.map((d) => {
              const [label, color] = state(d);
              const names = d.targets.map((t) => t.product?.name || t.subscription?.number).filter(Boolean);
              return (
                <tr key={d.id} className="border-b border-slate-800/60 last:border-0 align-top">
                  <td className="px-4 py-3 text-white font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-slate-200">
                    {d.type === 'PERCENTAGE' ? `${Number(d.value)}%` : `$${Number(d.value).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {d.scope === 'PRODUCT' ? 'Products' : 'Subscriptions'}
                    <div className="text-xs text-slate-500">{names.length ? names.join(', ') : d.scope === 'SUBSCRIPTION' ? 'All' : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {d.minPurchaseAmount ? <div>Min spend ${Number(d.minPurchaseAmount).toFixed(2)}</div> : null}
                    {d.minQuantity != null ? <div>Min qty {d.minQuantity}</div> : null}
                    {!d.minPurchaseAmount && d.minQuantity == null ? '-' : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {fmtDate(d.startDate)} to {fmtDate(d.endDate)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {d.usedCount}
                    {d.usageLimit != null ? ` / ${d.usageLimit}` : ''}
                  </td>
                  <td className={`px-4 py-3 font-medium ${color}`}>{label}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => open(d)} className="p-2 text-slate-400 hover:text-white" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(d)} className="p-2 text-slate-400 hover:text-rose-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={save} className="w-full max-w-xl rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing === 'new' ? 'New Discount' : 'Edit Discount'}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">{error}</div>}

            <label className="block text-sm text-slate-300">
              Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Type
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={input}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Value {form.type === 'PERCENTAGE' ? '(%)' : '($)'}
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={form.type === 'PERCENTAGE' ? 100 : undefined}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className={input}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm text-slate-300">
                Minimum purchase ($)
                <input type="number" step="0.01" min="0" value={form.minPurchaseAmount} onChange={(e) => setForm({ ...form, minPurchaseAmount: e.target.value })} className={input} />
              </label>
              <label className="block text-sm text-slate-300">
                Minimum quantity
                <input type="number" min="0" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} className={input} />
              </label>
              <label className="block text-sm text-slate-300">
                Start date
                <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
              </label>
              <label className="block text-sm text-slate-300">
                End date
                <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={input} />
              </label>
              <label className="block text-sm text-slate-300">
                Usage limit (blank = unlimited)
                <input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className={input} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 mt-6">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </div>

            <label className="block text-sm text-slate-300">
              Applies to
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className={input}>
                <option value="SUBSCRIPTION">Whole subscription</option>
                <option value="PRODUCT">Specific products</option>
              </select>
            </label>

            {form.scope === 'PRODUCT' ? (
              <div>
                <div className="text-sm text-slate-300 mb-1">Products (select at least one)</div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-2 space-y-1">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggle('productIds', p.id)} />
                      {p.name}
                    </label>
                  ))}
                  {products.length === 0 && <div className="text-xs text-slate-500">No products yet.</div>}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm text-slate-300 mb-1">Subscriptions (leave empty to cover all)</div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-2 space-y-1">
                  {subscriptions.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" checked={form.subscriptionIds.includes(s.id)} onChange={() => toggle('subscriptionIds', s.id)} />
                      {s.number}
                    </label>
                  ))}
                  {subscriptions.length === 0 && <div className="text-xs text-slate-500">No subscriptions yet.</div>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800">
                Cancel
              </button>
              <button disabled={loading} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-50">
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
