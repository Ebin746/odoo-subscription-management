import { getAuthToken } from '@/lib/authToken';

const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Calls the billing API (proxied to the Express backend by next.config.ts) and unwraps { data, error }.
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) throw new Error(json?.error || `Request failed (${res.status})`);
  return json?.data as T;
}

// Opens an invoice PDF in a new tab. A plain link cannot send the login token, so fetch it first.
export async function openInvoicePdf(invoiceId: string): Promise<void> {
  const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { headers: authHeaders() });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error || `Could not load the PDF (${res.status})`);
  }
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
