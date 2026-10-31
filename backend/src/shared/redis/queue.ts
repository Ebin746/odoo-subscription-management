import { Queue, Worker, type Job, type JobsOptions } from 'bullmq';
import { newQueueConnection, redisIfReady, waitForRedis } from './client';

// Background job queues (BullMQ on Redis). Producers call enqueue(); if it returns null (no Redis) the
// caller runs the work inline instead. Handlers are registered by the module that owns the work, and
// startWorkers() begins processing them once at server start.
type Handler = (data: any, job: Job) => Promise<unknown>;

const handlers = new Map<string, Map<string, Handler>>(); // queue -> job name -> handler
const queues = new Map<string, Queue>();
const workers: Worker[] = [];
let sharedConnection: ReturnType<typeof newQueueConnection> | null = null;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

export function registerHandler(queue: string, name: string, handler: Handler): void {
  if (!handlers.has(queue)) handlers.set(queue, new Map());
  handlers.get(queue)!.set(name, handler);
}

export function getQueue(name: string): Queue | null {
  if (!redisIfReady()) return null;
  if (!queues.has(name)) {
    sharedConnection ||= newQueueConnection();
    queues.set(name, new Queue(name, { connection: sharedConnection, defaultJobOptions: DEFAULT_JOB_OPTIONS }));
  }
  return queues.get(name)!;
}

// Adds a job. Returns its id, or null when queues are unavailable so the caller can run the work inline.
export async function enqueue(queue: string, name: string, data: unknown, opts: JobsOptions = {}): Promise<{ id: string } | null> {
  const q = getQueue(queue);
  if (!q) return null;
  try {
    const job = await q.add(name, data, opts);
    return { id: String(job.id) };
  } catch (err: any) {
    console.warn(`[Queue] could not enqueue ${queue}/${name}: ${err.message}`);
    return null;
  }
}

const CONCURRENCY: Record<string, number> = { mail: 5, billing: 4, daily: 1 };

export async function startWorkers(): Promise<boolean> {
  if (!(await waitForRedis())) {
    console.log('[Queue] Redis not available: background jobs will run inline');
    return false;
  }
  for (const [queue, byName] of handlers) {
    const worker = new Worker(
      queue,
      async (job) => {
        const handler = byName.get(job.name);
        if (!handler) throw new Error(`No handler for ${queue}/${job.name}`);
        return handler(job.data, job);
      },
      { connection: newQueueConnection(), concurrency: CONCURRENCY[queue] || 2 }
    );
    worker.on('failed', (job, err) => console.warn(`[Queue] ${queue}/${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`));
    worker.on('error', (err) => console.warn(`[Queue] ${queue} worker error: ${err.message}`));
    workers.push(worker);
    console.log(`[Queue] worker started for "${queue}" (${[...byName.keys()].join(', ')})`);
  }
  return true;
}

export async function closeQueues(): Promise<void> {
  await Promise.all(workers.map((w) => w.close().catch(() => {})));
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => {})));
  workers.length = 0;
  queues.clear();
  if (sharedConnection) {
    await sharedConnection.quit().catch(() => {});
    sharedConnection = null;
  }
}
