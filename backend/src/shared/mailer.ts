import nodemailer from 'nodemailer';

// Shared mailer (contract: sendMail via Nodemailer). SMTP settings come from the environment.
export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(input: MailInput): Promise<void> {
  if (!process.env.SMTP_HOST) {
    throw new Error('Email is not configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM');
  }
  await getTransporter().sendMail({ from: process.env.MAIL_FROM, ...input });
}
