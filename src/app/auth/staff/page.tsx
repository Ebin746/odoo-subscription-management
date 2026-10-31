'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { apiFetch } from '@/lib/api';
import { PasswordChecklist, validatePasswordRules } from '@/components/auth/PasswordChecklist';
import { Shield, Plus, AlertCircle, CheckCircle2, Phone, Mail } from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function StaffManagementPage() {
  const user = useCurrentUser();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const rules = validatePasswordRules(password);
  const isPasswordValid = rules.hasMinLength && rules.hasUppercase && rules.hasLowercase && rules.hasSpecial;

  const loadStaff = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<StaffUser[]>('/api/auth/staff');
    if (res.data) {
      setStaffList(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStaff();
    }
  }, [user, loadStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    if (!isPasswordValid) {
      setFormError('Password does not meet the security requirements.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<StaffUser>('/api/auth/staff', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone }),
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(true);
        setName('');
        setEmail('');
        setPassword('');
        setPhone('');
        loadStaff();
      }
    } catch {
      setFormError('Failed to create staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Role Gate: Admin Only (R5)
  if (user && user.role !== 'ADMIN') {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Only administrators are authorized to access the staff provisioning screen (Requirement R5).
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Shield className="w-4 h-4" /> Administration
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Staff Management</h1>
          <p className="text-slate-400 text-sm mt-1">
            Provision internal team members with STAFF access (R5: Only ADMIN can add staff).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Staff Form */}
          <div className="lg:col-span-1">
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                <Plus className="w-4 h-4 text-indigo-400" /> New Staff Member
              </h2>

              {formError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Staff account created successfully!</span>
                </div>
              )}

              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Alex Morgan"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="alex@brightloop.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Initial Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="•••••••••"
                  />
                  <div className="mt-2">
                    <PasswordChecklist password={password} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="+1 (555) 0199"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !isPasswordValid}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 px-4 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition duration-150"
                >
                  {submitting ? 'Creating...' : 'Create Staff User'}
                </button>
              </form>
            </div>
          </div>

          {/* Current Staff Table */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden shadow-sm">
              <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Current Staff Members</h2>
                  <p className="text-xs text-slate-400">Team members with internal access</p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {staffList.length} staff
                </span>
              </div>

              {loading ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading staff directory...</div>
              ) : staffList.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No staff members created yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3">Member</th>
                        <th className="px-5 py-3">Contact</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {staffList.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/20 transition">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-white text-sm">{s.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {s.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-400">
                            {s.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {s.phone}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                              {s.role}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                s.isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {s.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
