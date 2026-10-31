// Shared scheduler: modules register daily jobs with registerDailyJob(), and startScheduler() actually
// fires them. With Redis, the schedule lives in a BullMQ queue, so with several server instances exactly
// one of them runs each job. Without Redis, a timer in this process fires them once a day.
import { withLock } from './redis/lock';
import { getQueue, registerHandler } from './redis/queue';
import { redisIfReady } from './redis/client';

type JobFunction = () => Promise<any> | any;

const jobs: Map<string, JobFunction> = new Map();
const timers: NodeJS.Timeout[] = [];

// Cron (server time). Default: every day at 02:00.
const CRON = process.env.DAILY_JOB_CRON || '0 2 * * *';
const DAILY_QUEUE = 'daily';

export function registerDailyJob(name: string, fn: JobFunction): void {
  jobs.set(name, fn);
  console.log(`[Scheduler] Registered daily job: ${name}`);
}

export async function runJob(name: string): Promise<void> {
  const job = jobs.get(name);
  if (!job) {
    throw new Error(`Job ${name} not found`);
  }
  // Never run the same job twice at once, whoever triggers it (schedule, manual button, another instance)
  const { acquired } = await withLock(`job:${name}`, 60 * 60 * 1000, async () => {
    console.log(`[Scheduler] Running job: ${name}`);
    await job();
    console.log(`[Scheduler] Finished job: ${name}`);
  });
  if (!acquired) console.log(`[Scheduler] Skipped ${name}: already running`);
}

registerHandler(DAILY_QUEUE, 'run', async (data: { job: string }) => runJob(data.job));

// Milliseconds until the next occurrence of the given hour (server time) for the no-Redis fallback.
function msUntilHour(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export async function startScheduler(): Promise<void> {
  const queue = redisIfReady() ? getQueue(DAILY_QUEUE) : null;
  if (queue) {
    for (const name of jobs.keys()) {
      await queue.upsertJobScheduler(`daily:${name}`, { pattern: CRON }, { name: 'run', data: { job: name }, opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } } });
      console.log(`[Scheduler] ${name} scheduled via Redis (${CRON})`);
    }
    return;
  }
  const hour = Number(process.env.DAILY_JOB_HOUR ?? 2);
  for (const name of jobs.keys()) {
    const arm = () => {
      const t = setTimeout(async () => {
        await runJob(name).catch((err) => console.error(`[Scheduler] ${name} failed: ${err.message}`));
        arm();
      }, msUntilHour(hour));
      t.unref();
      timers.push(t);
    };
    arm();
    console.log(`[Scheduler] ${name} scheduled in-process, daily at ${String(hour).padStart(2, '0')}:00`);
  }
}

export function stopScheduler(): void {
  timers.forEach(clearTimeout);
  timers.length = 0;
}
