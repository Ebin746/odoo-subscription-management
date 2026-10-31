'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/components/billing/api';

interface Tax {
  id: string;
  name: string;
  ratePercent: string;
  isActive: boolean;
}

const empty = { name: '', ratePercent: '', isActive: true };

export function TaxManager({ taxes }: { taxes: Tax[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Tax | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = (tax: Tax | 'new') => {
    setEditing(tax);
    setError(null);
    setForm(tax === 'new' ? empty : { name: tax.name, ratePercent: String(Number(tax.ratePercent)), isActive: tax.isActive });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = { ...form, ratePercent: Number(form.ratePercent) };
      if (editing === 'new') await api('/api/taxes', 'POST', body);
      else await api(`/api/taxes/${(editing as Tax).id}`, 'PUT', body);
      setEditing(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (tax: Tax) => {
    if (!confirm(`Delete tax "${tax.name}"?`)) return;
    try {
      await api(`/api/taxes/${tax.id}`, 'DELETE');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => open('new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> New Tax
        </button>
      </div>

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-right px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {taxes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No taxes yet.
                </td>
              </tr>
            )}
            {taxes.map((tax) => (
              <tr key={tax.id} className="border-b border-slate-800/60 last:border-0">
                <td className="px-4 py-3 text-white font-medium">{tax.name}</td>
                <td className="px-4 py-3 text-right text-slate-200">{Number(tax.ratePercent)}%</td>
                <td className="px-4 py-3">
                  <span className={tax.isActive ? 'text-emerald-400' : 'text-slate-500'}>{tax.isActive ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => open(tax)} className="p-2 text-slate-400 hover:text-white" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(tax)} className="p-2 text-slate-400 hover:text-rose-400" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={save} className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editing === 'new' ? 'New Tax' : 'Edit Tax'}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">{error}</div>}
            <label className="block text-sm text-slate-300">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Rate (%)
              <input
                required
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.ratePercent}
                onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
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
