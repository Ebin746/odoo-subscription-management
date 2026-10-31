// Calls the billing API (proxied to the Express backend by next.config.ts) and unwraps { data, error }.
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) throw new Error(json?.error || `Request failed (${res.status})`);
  return json?.data as T;
}
