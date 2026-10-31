import { sendMail, type MailInput } from './mailer';
import { enqueue, registerHandler } from './redis/queue';

// Sends email in the background with retries when Redis is available; otherwise sends right away.
// Mail with attachments is not queued through here (attachments are not JSON): queue a job that builds
// the mail itself instead, like billing/mailJobs.ts does for invoices.
registerHandler('mail', 'send', async (data: MailInput) => sendMail(data));

export async function queueMail(input: Omit<MailInput, 'attachments'>): Promise<{ queued: boolean }> {
  const job = await enqueue('mail', 'send', input);
  if (job) return { queued: true };
  await sendMail(input);
  return { queued: false };
}
