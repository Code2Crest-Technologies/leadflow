import { logger } from '../utils/logger.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendEmailResult {
  sent: boolean;
  provider: 'resend' | 'disabled';
  id?: string;
  reason?: string;
}

function defaultFrom() {
  return process.env.RESEND_FROM || process.env.SMTP_FROM || 'Code2Crest Technologies <hello@code2crest.com>';
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logger.info(
      {
        event: 'EMAIL_SEND_SKIPPED',
        to: input.to,
        subject: input.subject,
        reason: 'RESEND_API_KEY_NOT_CONFIGURED',
      },
      'Email delivery skipped because Resend is not configured',
    );
    return { sent: false, provider: 'disabled', reason: 'RESEND_API_KEY_NOT_CONFIGURED' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from || defaultFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ event: 'EMAIL_SEND_FAILED', status: response.status, body }, 'Resend email delivery failed');
    throw new Error('Email delivery failed');
  }

  const payload = (await response.json()) as { id?: string };
  return { sent: true, provider: 'resend', id: payload.id };
}
