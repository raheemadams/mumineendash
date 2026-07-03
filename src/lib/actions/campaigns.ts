"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/db/auth";
import { writeAudit } from "@/lib/db/audit";
import { isDeliverableEmail, PAYMENT_URL, PAYMENT_BUTTON_LABEL } from "@/lib/config";
import { sendEmailsBatch, emailConfigured, type OutgoingEmail } from "@/lib/email/resend";

const Schema = z.object({
  status: z.string(), // "all" or a MembershipStatus
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Message is required"),
  includePayButton: z.boolean().default(true),
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const mergeName = (template: string, m: { fullName: string; firstName: string }) =>
  template
    .replace(/\{\{\s*name\s*\}\}/gi, m.fullName)
    .replace(/\{\{\s*firstName\s*\}\}/gi, m.firstName);

// A centered, inline-styled "Pay" button — email clients strip <style>/classes,
// so styling is inline. No visible URL (the button itself carries the link).
const PAY_BUTTON_HTML = `<div style="text-align:center;margin:28px 0;"><a href="${PAYMENT_URL}" style="display:inline-block;background:#0f5c4a;color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:600;">${PAYMENT_BUTTON_LABEL}</a></div>`;

/**
 * Fill merge fields and render plain-text + HTML. The `{{payButton}}` marker in
 * the body is where the button goes; if the marker is absent but the button is
 * enabled, it's appended at the end. Plain-text keeps the URL (no button there).
 */
function renderEmail(
  bodyTemplate: string,
  m: { fullName: string; firstName: string },
  includePayButton: boolean,
): { text: string; html: string } {
  const merged = mergeName(bodyTemplate, m);
  const hasMarker = /\{\{\s*payButton\s*\}\}/i.test(merged);

  const textButton = includePayButton ? `${PAYMENT_BUTTON_LABEL}: ${PAYMENT_URL}` : "";
  let text = merged.replace(/\{\{\s*payButton\s*\}\}/gi, textButton);

  let htmlBody = escapeHtml(merged)
    .replace(/\n/g, "<br>")
    .replace(/\{\{\s*payButton\s*\}\}/gi, includePayButton ? PAY_BUTTON_HTML : "");

  if (includePayButton && !hasMarker) {
    text += `\n\n${textButton}`;
    htmlBody += PAY_BUTTON_HTML;
  }

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1a2b26;line-height:1.6;">${htmlBody}</div>`;
  return { text, html };
}

export interface CampaignResult {
  recipients: number;
  sent: number;
  failed: number;
  skipped: number; // members in the group without a deliverable email
  configured: boolean;
  error?: string;
}

export async function sendCampaignAction(input: {
  status: string;
  subject: string;
  body: string;
  includePayButton?: boolean;
}): Promise<CampaignResult> {
  const user = await requireUser();
  const { status, subject, body, includePayButton } = Schema.parse(input);

  const members = await prisma.member.findMany({
    where: status === "all" ? {} : { membershipStatus: status as never },
    select: { fullName: true, firstName: true, email: true },
  });

  const deliverable = members.filter((m) => isDeliverableEmail(m.email));
  const skipped = members.length - deliverable.length;

  if (deliverable.length === 0) {
    return { recipients: 0, sent: 0, failed: 0, skipped, configured: emailConfigured() };
  }

  const emails: OutgoingEmail[] = deliverable.map((m) => {
    const person = { fullName: m.fullName, firstName: m.firstName };
    const subj = mergeName(subject, person);
    const msg = renderEmail(body, person, includePayButton);
    return { to: m.email as string, subject: subj, text: msg.text, html: msg.html };
  });

  const result = await sendEmailsBatch(emails);

  await writeAudit({
    action: "email",
    entityType: "Campaign",
    entityId: status,
    summary: `Emailed ${result.sent} ${status} member(s): "${subject}"${result.failed ? ` (${result.failed} failed)` : ""}`,
    actorId: user.id,
  });

  return {
    recipients: deliverable.length,
    sent: result.sent,
    failed: result.failed,
    skipped,
    configured: result.configured,
    error: result.error,
  };
}
