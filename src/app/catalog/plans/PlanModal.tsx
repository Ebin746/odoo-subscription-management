'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

export function PlanModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    billingPeriod: 'MONTHLY',
    minQuantity: '1',
    autoClose: false,
    allowEarlyClose: true,
    allowPause: true,
    allowRenew: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/catalog/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          minQuantity: parseInt(formData.minQuantity) || 1,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create plan');

      setOpen(false);
      setFormData({
        name: '',
        price: '',
        billingPeriod: 'MONTHLY',
        minQuantity: '1',
        autoClose: false,
        allowEarlyClose: true,
        allowPause: true,
        allowRenew: true,
      });
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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium shadow-sm transition"
      >
        <Plus className="w-4 h-4" />
        New Plan (Admin)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white">Create Subscription Plan (R8, R9)</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Enterprise Monthly"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="299.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Billing Period *
                  </label>
                  <select
                    value={formData.billingPeriod}
                    onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Minimum Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* R9 Flags */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-slate-300 uppercase mb-2">
                  Action Permissions (R9)
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.autoClose}
                    onChange={(e) => setFormData({ ...formData, autoClose: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-0"
                  />
                  <span>Auto-close automatically when expiry date reached</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allowEarlyClose}
                    onChange={(e) => setFormData({ ...formData, allowEarlyClose: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-0"
                  />
                  <span>Allow Early Close by customer/staff</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allowPause}
                    onChange={(e) => setFormData({ ...formData, allowPause: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-0"
                  />
                  <span>Allow Subscription Pause and Resume</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allowRenew}
                    onChange={(e) => setFormData({ ...formData, allowRenew: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-0"
                  />
                  <span>Allow Subscription Renewal (extending term)</span>
                </label>
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
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
