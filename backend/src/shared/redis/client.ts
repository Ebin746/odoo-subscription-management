// Redis connection shared by the Express backend and the Next.js server code.
// Redis is optional: without REDIS_URL, or while Redis is down, every helper in this folder falls back
// to running the work directly, so the app keeps working (just without caching, queues or shared limits).
import IORedis from 'ioredis';

const g = globalThis as unknown as { __redis?: IORedis; __redisWarned?: boolean };

export function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedis(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!g.__redis) {
    const client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // fail fast while disconnected so callers can fall back
      retryStrategy: (times) => Math.min(times * 250, 3000),
    });
    client.on('error', (err) => {
      if (!g.__redisWarned) {
        g.__redisWarned = true;
        console.warn(`[Redis] unavailable (${err.message}); falling back to direct execution`);
      }
    });
    client.on('ready', () => {
      if (g.__redisWarned) console.log('[Redis] connection restored');
      g.__redisWarned = false;
    });
    g.__redis = client;
  }
  return g.__redis;
}

// The client only when it is connected right now.
export function redisIfReady(): IORedis | null {
  const client = getRedis();
  return client && client.status === 'ready' ? client : null;
}

// BullMQ needs its own connections with unlimited retries per request.
export function newQueueConnection(): IORedis {
  return new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });
}

export async function closeRedis(): Promise<void> {
  if (g.__redis) {
    await g.__redis.quit().catch(() => {});
    g.__redis = undefined;
  }
}

// Waits until Redis is connected (or the timeout passes). Used at startup before workers are created.
export async function waitForRedis(timeoutMs = 5000): Promise<boolean> {
  if (!redisConfigured()) return false;
  getRedis();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (redisIfReady()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return Boolean(redisIfReady());
}
