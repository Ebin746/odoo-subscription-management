'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { apiFetch } from '@/lib/api';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Building2,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  Shield,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  billingAddress: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CustomerListResponse {
  items: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function CustomersManagementPage() {
  const user = useCurrentUser();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyName: '',
    phone: '',
    billingAddress: '',
    isActive: true,
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const fetchCustomers = useCallback(async (page: number, searchQuery: string) => {
    setLoading(true);
    const query = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(searchQuery ? { search: searchQuery } : {}),
    });

    const res = await apiFetch<CustomerListResponse>(`/api/users/customers?${query.toString()}`);
    if (res.data) {
      setCustomers(res.data.items);
      setPagination(res.data.pagination);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'STAFF')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCustomers(1, search);
    }
  }, [user, search, fetchCustomers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(1, search);
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      companyName: '',
      phone: '',
      billingAddress: '',
      isActive: true,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name,
      email: cust.email,
      companyName: cust.companyName || '',
      phone: cust.phone || '',
      billingAddress: cust.billingAddress || '',
      isActive: cust.isActive,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSaving(true);

    try {
      if (editingCustomer) {
        // PATCH /api/users/customers/:id
        const res = await apiFetch<Customer>(`/api/users/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: formData.name,
            companyName: formData.companyName || null,
            phone: formData.phone || null,
            billingAddress: formData.billingAddress || null,
            isActive: formData.isActive,
          }),
        });

        if (res.error) {
          setModalError(res.error);
        } else {
          setModalOpen(false);
          fetchCustomers(pagination.page, search);
        }
      } else {
        // POST /api/users/customers
        const res = await apiFetch<Customer>('/api/users/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            companyName: formData.companyName || null,
            phone: formData.phone || null,
            billingAddress: formData.billingAddress || null,
          }),
        });

        if (res.error) {
          setModalError(res.error);
        } else {
          setModalOpen(false);
          fetchCustomers(1, search);
        }
      }
    } catch {
      setModalError('Failed to save customer.');
    } finally {
      setModalSaving(false);
    }
  };

  // Role Gate: Admin or Staff Only
  if (user && user.role === 'CUSTOMER') {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Customers cannot access the directory of other customer accounts (R4). Please use your customer portal.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <Users className="w-4 h-4" /> CRM & Directory
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Customer Accounts</h1>
            <p className="text-slate-400 text-sm mt-1">
              Search, view, create and manage customer profiles and billing addresses (R4, R5).
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-800">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </form>

          <div className="text-xs text-slate-400 font-mono self-end sm:self-auto">
            Total Customers: <span className="font-bold text-white">{pagination.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No customers found matching your query.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Billing Address</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/20 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-white">{c.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {c.email}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-300">
                        {c.companyName ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500" /> {c.companyName}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {c.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400 max-w-xs truncate">
                        {c.billingAddress || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            c.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {c.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => openEditModal(c)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-indigo-400" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchCustomers(pagination.page - 1, search)}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchCustomers(pagination.page + 1, search)}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Create or Edit Customer */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleSaveCustomer} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Acme Global Inc"
                  />
                </div>

                {!editingCustomer && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="billing@acmeglobal.com"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300">Company Name</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Acme Inc"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="+1 555-0100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300">Billing Address</label>
                  <textarea
                    rows={2}
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="100 Enterprise Way, Floor 12"
                  />
                </div>

                {editingCustomer && (
                  <div className="pt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isActive" className="text-xs font-medium text-slate-300 cursor-pointer">
                      Account is Active
                    </label>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSaving}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition"
                  >
                    {modalSaving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
