import { redisIfReady } from './client';

// Namespaced cache with cheap invalidation: keys carry a per-namespace version, and invalidating
// a namespace just bumps that version (no key scanning). Values must be JSON-safe.
const verKey = (ns: string) => `cache:ver:${ns}`;

export async function cached<T>(ns: string, key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const redis = redisIfReady();
  if (!redis) return load();

  let fullKey: string;
  try {
    const ver = (await redis.get(verKey(ns))) || '0';
    fullKey = `cache:${ns}:${ver}:${key}`;
    const hit = await redis.get(fullKey);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    return load();
  }

  const value = await load();
  try {
    await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    /* a failed cache write is harmless */
  }
  return value;
}

export async function invalidate(...namespaces: string[]): Promise<void> {
  const redis = redisIfReady();
  if (!redis) return;
  try {
    await Promise.all(namespaces.map((ns) => redis.incr(verKey(ns))));
  } catch {
    /* entries expire on their own */
  }
}

// Single values with an explicit key (used for the auth user cache and the token deny-list).
export async function getJson<T>(key: string): Promise<T | null> {
  const redis = redisIfReady();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const redis = redisIfReady();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSec)));
  } catch {
    /* ignore */
  }
}

export async function del(...keys: string[]): Promise<void> {
  const redis = redisIfReady();
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    /* ignore */
  }
}

// Lower-level read/write of one namespaced entry (used by the HTTP response cache).
export async function getCachedRaw<T>(ns: string, key: string): Promise<T | null> {
  const redis = redisIfReady();
  if (!redis) return null;
  try {
    const ver = (await redis.get(verKey(ns))) || '0';
    const hit = await redis.get(`cache:${ns}:${ver}:${key}`);
    return hit === null ? null : (JSON.parse(hit) as T);
  } catch {
    return null;
  }
}

export async function setCachedRaw(ns: string, key: string, value: unknown, ttlSec: number): Promise<void> {
  const redis = redisIfReady();
  if (!redis) return;
  try {
    const ver = (await redis.get(verKey(ns))) || '0';
    await redis.set(`cache:${ns}:${ver}:${key}`, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    /* ignore */
  }
}
