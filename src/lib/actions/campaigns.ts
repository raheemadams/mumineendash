"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/db/auth";
import { writeAudit } from "@/lib/db/audit";
import { isDeliverableEmail } from "@/lib/config";
import { sendEmailsBatch, emailConfigured, type OutgoingEmail } from "@/lib/email/resend";

const Schema = z.object({
  status: z.string(), // "all" or a MembershipStatus
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Message is required"),
});

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Fill merge fields, then render both plain-text and simple HTML variants. */
function personalize(template: string, m: { fullName: string; firstName: string }): { text: string; html: string } {
  const text = template
    .replace(/\{\{\s*name\s*\}\}/gi, m.fullName)
    .replace(/\{\{\s*firstName\s*\}\}/gi, m.firstName);
  const html = escapeHtml(text).replace(/\n/g, "<br>");
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
}): Promise<CampaignResult> {
  const user = await requireUser();
  const { status, subject, body } = Schema.parse(input);

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
    const subj = personalize(subject, { fullName: m.fullName, firstName: m.firstName });
    const msg = personalize(body, { fullName: m.fullName, firstName: m.firstName });
    return { to: m.email as string, subject: subj.text, text: msg.text, html: msg.html };
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
