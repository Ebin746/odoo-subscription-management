// Shared scheduler helper
// Owned by P1/Shared; stubbed for background daily jobs

type JobFunction = () => Promise<any> | any;

const jobs: Map<string, JobFunction> = new Map();

export function registerDailyJob(name: string, fn: JobFunction): void {
  jobs.set(name, fn);
  console.log(`[Scheduler] Registered daily job: ${name}`);
}

export async function runJob(name: string): Promise<void> {
  const job = jobs.get(name);
  if (!job) {
    throw new Error(`Job ${name} not found`);
  }
  console.log(`[Scheduler] Running job: ${name}`);
  await job();
  console.log(`[Scheduler] Finished job: ${name}`);
}
