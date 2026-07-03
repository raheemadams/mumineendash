// Thin Resend wrapper (via fetch — no SDK dependency). Sends already-personalized
// emails through Resend's batch endpoint (up to 100 per request). Configuration
// comes from env: RESEND_API_KEY and RESEND_FROM (a verified sender, e.g.
// "Masjid Mumineen <noreply@masjidulmumineen.org>").

const BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
const CHUNK = 100;

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  configured: boolean;
  error?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmailsBatch(emails: OutgoingEmail[]): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    return {
      sent: 0,
      failed: emails.length,
      configured: false,
      error: "Email is not configured. Set RESEND_API_KEY and RESEND_FROM in the environment.",
    };
  }

  let sent = 0;
  let failed = 0;
  let error: string | undefined;

  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK).map((e) => ({
      from,
      to: e.to,
      subject: e.subject,
      text: e.text,
      html: e.html,
    }));
    try {
      const res = await fetch(BATCH_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        sent += chunk.length;
      } else {
        failed += chunk.length;
        error = `Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`;
      }
    } catch (e) {
      failed += chunk.length;
      error = e instanceof Error ? e.message : "Network error sending email.";
    }
  }

  return { sent, failed, configured: true, error };
}
