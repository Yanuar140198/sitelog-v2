/**
 * Resend transactional email. Falls back to console.log if RESEND_API_KEY not set.
 */
import { Resend } from 'resend';

const key = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'Sitelog <noreply@sitelog.app>';
const resend = key ? new Resend(key) : null;

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  if (!resend) {
    console.log(`[email/stub] to=${opts.to} subject="${opts.subject}"`);
    return { ok: true, stub: true };
  }
  const res = await resend.emails.send({
    from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text,
  });
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  return { ok: true, id: res.data?.id };
}

export function inviteEmailHtml(opts: { orgName: string; inviterName: string; acceptUrl: string }) {
  return `<!doctype html>
<html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 40px auto; padding: 24px;">
  <p style="color: #FF5500; font-family: monospace; letter-spacing: 2px; font-size: 11px;">SITELOG · INVITATION</p>
  <h1 style="font-size: 28px; margin: 8px 0 16px;">You've been invited</h1>
  <p><strong>${opts.inviterName}</strong> invited you to join <strong>${opts.orgName}</strong> on Sitelog.</p>
  <p><a href="${opts.acceptUrl}" style="display: inline-block; background: #FF5500; color: white; padding: 14px 24px; text-decoration: none; font-family: monospace; letter-spacing: 1px; font-weight: bold; margin: 24px 0;">ACCEPT INVITATION →</a></p>
  <p style="color: #888; font-size: 13px;">Or copy this link: <a href="${opts.acceptUrl}">${opts.acceptUrl}</a></p>
  <p style="color: #888; font-size: 12px; font-family: monospace; border-top: 1px solid #eee; padding-top: 16px; margin-top: 32px;">SITELOG · construction SaaS</p>
</body></html>`;
}
