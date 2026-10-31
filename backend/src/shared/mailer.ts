import nodemailer, { type SendMailOptions } from 'nodemailer';

// Shared mailer (contract: sendMail via Nodemailer).
// Owner: P1. Used by P1 (password reset) and P3 (invoice sending).
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
  attachments?: MailAttachment[] | SendMailOptions['attachments'];
}

// EMAIL_USER / EMAIL_PASS (Gmail app password) take precedence over the generic SMTP_* settings.
function isGmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function isSmtpConfigured(): boolean {
  return (
    isGmailConfigured() ||
    Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    )
  );
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = isGmailConfigured()
      ? nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        })
      : nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
  }
  return transporter;
}

export async function sendMail(input: MailInput): Promise<void> {
  const from =
    process.env.MAIL_FROM ||
    (isGmailConfigured() ? process.env.EMAIL_USER : undefined) ||
    'noreply@brightloop.com';

  if (!isSmtpConfigured()) {
    console.log('─── [sendMail fallback — SMTP not configured] ───');
    console.log(`  To:      ${input.to}`);
    console.log(`  From:    ${from}`);
    console.log(`  Subject: ${input.subject}`);
    if (input.text) console.log(`  Text:    ${input.text}`);
    if (input.html) console.log(`  Body:    ${input.html}`);
    console.log('─────────────────────────────────────────────────');
    return;
  }

  await getTransporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}
