import { InvoiceStatus } from '@prisma/client';
import { prisma } from '../../shared/db';
import { sendMail } from '../../shared/mailer';
import { enqueue, registerHandler } from '../../shared/redis/queue';
import { renderInvoicePdf } from './pdf';

// Emails an invoice (PDF attached) to the customer and marks it as sent once the mail went out.
export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === InvoiceStatus.CANCELLED) throw new Error('A cancelled invoice cannot be sent');

  const pdf = await renderInvoicePdf(invoice);
  await sendMail({
    to: invoice.customerEmail,
    subject: `Invoice ${invoice.number} from Brightloop Software`,
    text: `Hello ${invoice.customerName},\n\nPlease find invoice ${invoice.number} attached. Total due: ${Number(invoice.total).toFixed(2)}, payable by ${invoice.dueDate.toISOString().slice(0, 10)}.\n\nBrightloop Software`,
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
  await prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } });
}

registerHandler('mail', 'send-invoice', async (data: { invoiceId: string }) => sendInvoiceEmail(data.invoiceId));

// Queues the email when possible. Returns true if it was queued, false if it was sent inline.
export async function sendInvoiceEmailQueued(invoiceId: string): Promise<boolean> {
  const job = await enqueue('mail', 'send-invoice', { invoiceId });
  if (job) return true;
  await sendInvoiceEmail(invoiceId);
  return false;
}
