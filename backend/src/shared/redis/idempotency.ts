import { redisIfReady } from './client';

// Makes a POST safe to repeat: the first request with a given key does the work and stores its result;
// repeats with the same key get that stored result back instead of doing the work again.
export interface StoredResponse {
  status: number;
  body: unknown;
}

const PENDING = '__pending__';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function idempotent(
  scope: string,
  key: string | null | undefined,
  run: () => Promise<StoredResponse>,
  ttlSec = 24 * 60 * 60
): Promise<StoredResponse & { replayed: boolean }> {
  const redis = redisIfReady();
  if (!key || !redis) return { ...(await run()), replayed: false };

  const k = `idem:${scope}:${key}`;
  try {
    const first = await redis.set(k, PENDING, 'EX', 60, 'NX');
    if (first !== 'OK') {
      // someone already used this key: wait for their result
      for (let i = 0; i < 50; i++) {
        const stored = await redis.get(k);
        if (stored && stored !== PENDING) return { ...(JSON.parse(stored) as StoredResponse), replayed: true };
        if (!stored) break; // the first attempt failed and released the key
        await sleep(100);
      }
      const again = await redis.get(k);
      if (again && again !== PENDING) return { ...(JSON.parse(again) as StoredResponse), replayed: true };
      return { status: 409, body: { data: null, error: 'A request with this idempotency key is still in progress' }, replayed: true };
    }
  } catch {
    return { ...(await run()), replayed: false };
  }

  try {
    const response = await run();
    // Only successful responses are remembered; a failed attempt may be retried with the same key.
    if (response.status < 400) await redis.set(k, JSON.stringify(response), 'EX', ttlSec).catch(() => {});
    else await redis.del(k).catch(() => {});
    return { ...response, replayed: false };
  } catch (err) {
    await redis.del(k).catch(() => {});
    throw err;
  }
}
