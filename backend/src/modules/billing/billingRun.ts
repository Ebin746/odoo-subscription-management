import { randomUUID } from 'crypto';
import { redisIfReady } from '../../shared/redis/client';
import { invalidate } from '../../shared/redis/cache';
import { enqueue, registerHandler } from '../../shared/redis/queue';
import { registerDailyJob } from '../../shared/scheduler';
import { BillingResult, billChunk, runBilling, startOfUtcDay, subscriptionIdPages } from './billing';

// Queued billing: one coordinator job lists the subscriptions to bill and fans them out as chunk jobs that
// any worker can pick up. Progress and totals live in a Redis hash so the screen can follow the run.
// Without Redis, runBilling() does the same work inline.
const QUEUE = 'billing';
const ACTIVE_KEY = 'billing:active'; // the run currently in progress; also stops two runs overlapping
const runKey = (id: string) => `billing:run:${id}`;
const RUN_TTL_SEC = 24 * 3600;
const ACTIVE_TTL_SEC = 2 * 3600;
const CHUNK_ATTEMPTS = 3;

export interface BillingRunStatus extends BillingResult {
  runId: string;
  status: 'running' | 'done';
  chunksTotal: number;
  chunksDone: number;
}

export async function getBillingRun(runId: string): Promise<BillingRunStatus | null> {
  const redis = redisIfReady();
  if (!redis) return null;
  const h = await redis.hgetall(runKey(runId));
  if (!h || !h.status) return null;
  return {
    runId,
    status: h.status as 'running' | 'done',
    runDate: h.runDate,
    subscriptionsChecked: Number(h.checked || 0),
    invoicesCreated: Number(h.created || 0),
    skippedExisting: Number(h.skipped || 0),
    failed: JSON.parse(h.failed || '[]'),
    chunksTotal: Number(h.total || 0),
    chunksDone: Number(h.done || 0),
  };
}

export async function getActiveBillingRunId(): Promise<string | null> {
  const redis = redisIfReady();
  return redis ? redis.get(ACTIVE_KEY) : null;
}

// Starts a queued run. Returns null when queues are unavailable (the caller then runs inline).
// If a run is already in progress, returns that run instead of starting another.
export async function startQueuedBilling(runDate = new Date()): Promise<{ runId: string; alreadyRunning: boolean } | null> {
  const redis = redisIfReady();
  if (!redis) return null;

  const runId = randomUUID();
  const day = startOfUtcDay(runDate);
  const claimed = await redis.set(ACTIVE_KEY, runId, 'EX', ACTIVE_TTL_SEC, 'NX');
  if (claimed !== 'OK') {
    const current = await redis.get(ACTIVE_KEY);
    return current ? { runId: current, alreadyRunning: true } : null;
  }

  await redis.hset(runKey(runId), { status: 'running', runDate: day.toISOString().slice(0, 10), checked: 0, created: 0, skipped: 0, failed: '[]', total: 0, done: 0, listed: 0 });
  await redis.expire(runKey(runId), RUN_TTL_SEC);

  const job = await enqueue(QUEUE, 'run', { runId, runDate: day.toISOString() }, { attempts: 1 });
  if (!job) {
    await redis.del(ACTIVE_KEY, runKey(runId));
    return null;
  }
  return { runId, alreadyRunning: false };
}

async function finishIfComplete(runId: string): Promise<void> {
  const redis = redisIfReady();
  if (!redis) return;
  const h = await redis.hmget(runKey(runId), 'listed', 'total', 'done', 'status');
  if (h[0] === '1' && h[3] === 'running' && Number(h[1]) === Number(h[2])) {
    await redis.hset(runKey(runId), 'status', 'done');
    await invalidate('lookups-invoices');
    if ((await redis.get(ACTIVE_KEY)) === runId) await redis.del(ACTIVE_KEY);
    const s = await getBillingRun(runId);
    console.log(`[BillingJob] run ${runId.slice(0, 8)} done: ${s?.invoicesCreated} created, ${s?.skippedExisting} already billed, ${s?.failed.length} failed`);
  }
}

// Coordinator: lists subscription ids and enqueues one job per chunk.
registerHandler(QUEUE, 'run', async (data: { runId: string; runDate: string }) => {
  const redis = redisIfReady()!;
  const runDate = new Date(data.runDate);
  for await (const ids of subscriptionIdPages(runDate)) {
    await redis.hincrby(runKey(data.runId), 'total', 1);
    await enqueue(QUEUE, 'chunk', { runId: data.runId, runDate: data.runDate, ids }, { attempts: CHUNK_ATTEMPTS, backoff: { type: 'exponential', delay: 3000 } });
  }
  await redis.hset(runKey(data.runId), 'listed', 1);
  await finishIfComplete(data.runId);
});

// One chunk of subscriptions. Retries are safe because billing a period twice is impossible.
registerHandler(QUEUE, 'chunk', async (data: { runId: string; runDate: string; ids: string[] }, job) => {
  const redis = redisIfReady()!;
  const key = runKey(data.runId);
  try {
    const r = await billChunk(data.ids, new Date(data.runDate));
    await redis.hincrby(key, 'checked', r.checked);
    await redis.hincrby(key, 'created', r.created);
    await redis.hincrby(key, 'skipped', r.skipped);
    if (r.failed.length) {
      const cur = JSON.parse((await redis.hget(key, 'failed')) || '[]');
      await redis.hset(key, 'failed', JSON.stringify([...cur, ...r.failed].slice(0, 50)));
    }
  } catch (err: any) {
    if (job.attemptsMade + 1 < (job.opts.attempts || 1)) throw err; // let the queue retry it
    const cur = JSON.parse((await redis.hget(key, 'failed')) || '[]');
    await redis.hset(key, 'failed', JSON.stringify([...cur, { subscriptionId: `chunk of ${data.ids.length}`, error: String(err.message) }].slice(0, 50)));
  }
  await redis.hincrby(key, 'done', 1);
  await finishIfComplete(data.runId);
});

// Daily job: queued when Redis is available, otherwise done inline.
registerDailyJob('runBilling', async () => {
  const started = await startQueuedBilling();
  if (!started) await runBilling();
});
