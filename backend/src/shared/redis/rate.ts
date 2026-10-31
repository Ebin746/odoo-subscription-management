import { redisIfReady } from './client';

// Fixed-window rate limit counter, shared by every server instance through Redis.
// Without Redis it counts in this process's memory.
export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();

export async function rateHit(key: string, max: number, windowSec: number): Promise<RateResult> {
  const redis = redisIfReady();
  if (redis) {
    try {
      const k = `rate:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, windowSec);
      const ttl = count === 1 ? windowSec : await redis.ttl(k);
      return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfterSec: Math.max(1, ttl) };
    } catch {
      /* fall through to the memory counter */
    }
  }
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: max - 1, retryAfterSec: windowSec };
  }
  entry.count += 1;
  return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

// Exposed for tests.
export function _clearMemoryRates(): void {
  memory.clear();
}
