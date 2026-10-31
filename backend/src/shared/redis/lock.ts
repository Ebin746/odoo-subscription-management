import { randomUUID } from 'crypto';
import { redisIfReady } from './client';

// Mutual exclusion across server instances (Redis SET NX with an owner token). Without Redis it
// falls back to a lock inside this one process, which is enough for a single server.
const local = new Set<string>();

const RELEASE = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export async function acquireLock(name: string, ttlMs: number): Promise<(() => Promise<void>) | null> {
  const redis = redisIfReady();
  if (!redis) {
    if (local.has(name)) return null;
    local.add(name);
    return async () => {
      local.delete(name);
    };
  }
  const token = randomUUID();
  try {
    const ok = await redis.set(`lock:${name}`, token, 'PX', ttlMs, 'NX');
    if (ok !== 'OK') return null;
  } catch {
    // Redis hiccup: do not block the work, fall back to the in-process lock
    if (local.has(name)) return null;
    local.add(name);
    return async () => {
      local.delete(name);
    };
  }
  return async () => {
    try {
      await redis.eval(RELEASE, 1, `lock:${name}`, token);
    } catch {
      /* the lock expires on its own */
    }
  };
}

// Runs fn while holding the lock. Returns { acquired: false } if someone else holds it.
export async function withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<{ acquired: boolean; result?: T }> {
  const release = await acquireLock(name, ttlMs);
  if (!release) return { acquired: false };
  try {
    return { acquired: true, result: await fn() };
  } finally {
    await release();
  }
}
