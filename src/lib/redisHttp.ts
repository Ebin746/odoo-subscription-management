import { NextRequest, NextResponse } from 'next/server';
import { getCachedRaw, setCachedRaw } from '@backend/shared/redis/cache';
import { idempotent } from '@backend/shared/redis/idempotency';
import { rateHit } from '@backend/shared/redis/rate';

// Redis helpers for Next.js route handlers (the Express equivalents live in backend/src/shared/redis/http.ts).
// All of them do nothing special when Redis is not available.

// Caches a successful JSON GET response. Call it after the access check.
export async function cachedJson(ns: string, key: string, ttlSec: number, compute: () => Promise<NextResponse>): Promise<NextResponse> {
  const hit = await getCachedRaw<unknown>(ns, key);
  if (hit !== null) return NextResponse.json(hit, { headers: { 'X-Cache': 'HIT' } });
  const res = await compute();
  if (res.status === 200) {
    const body = await res.clone().json().catch(() => null);
    if (body && !body.error) void setCachedRaw(ns, key, body, ttlSec);
  }
  res.headers.set('X-Cache', 'MISS');
  return res;
}

// Returns a 429 response when the caller is over the limit, otherwise null.
export async function limitOr429(req: NextRequest, name: string, max: number, windowSec: number): Promise<NextResponse | null> {
  const who = req.headers.get('x-dev-user-id') || req.headers.get('x-forwarded-for') || 'anonymous';
  const r = await rateHit(`${name}:${who}`, max, windowSec);
  if (r.allowed) return null;
  return NextResponse.json(
    { data: null, error: 'Too many requests, please try again later.' },
    { status: 429, headers: { 'Retry-After': String(r.retryAfterSec) } }
  );
}

// Runs a POST once per Idempotency-Key header; repeats get the first answer.
export async function idempotentJson(req: NextRequest, scope: string, run: () => Promise<NextResponse>): Promise<NextResponse> {
  const key = req.headers.get('idempotency-key');
  const user = req.headers.get('x-dev-user-id') || 'anon';
  const out = await idempotent(`${scope}:${user}`, key, async () => {
    const res = await run();
    return { status: res.status, body: await res.json() };
  });
  return NextResponse.json(out.body, { status: out.status, headers: out.replayed ? { 'Idempotent-Replay': 'true' } : undefined });
}
