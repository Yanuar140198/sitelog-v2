/**
 * Dispatch domain events to per-org integration channels (Slack/Discord/Email).
 *
 * Usage:
 *   await dispatchToChannels(orgId, 'entry.submit', { projectName, entryDate, userName });
 *
 * Channel rows are stored in notification_channel with an events[] jsonb whitelist.
 * Failures per-channel are logged but never throw — never block a domain mutation
 * because Slack is down.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db, notificationChannel } from '@sitelog/db';
import type { NotificationChannel } from '@sitelog/db';
import { sendEmail } from './email.js';
import { log } from './logger.js';

export type ChannelEvent =
  | 'entry.submit'
  | 'entry.approved'
  | 'webhook.failed'
  | 'project.created'
  | 'test.ping';

export interface DispatchPayload {
  [key: string]: unknown;
}

/**
 * Format a human-readable one-line message for a given event + payload.
 * Used as Slack/Discord text and as the email subject prefix.
 */
export function formatMessage(event: ChannelEvent | string, payload: DispatchPayload): string {
  switch (event) {
    case 'entry.submit':
      return `[Sitelog] New daily entry submitted${payload.projectName ? ` for ${payload.projectName}` : ''}${payload.entryDate ? ` (${payload.entryDate})` : ''}${payload.userName ? ` by ${payload.userName}` : ''}`;
    case 'entry.approved':
      return `[Sitelog] Daily entry approved${payload.projectName ? ` for ${payload.projectName}` : ''}${payload.entryDate ? ` (${payload.entryDate})` : ''}`;
    case 'webhook.failed':
      return `[Sitelog] Webhook delivery failed${payload.url ? ` to ${payload.url}` : ''}${payload.status ? ` (HTTP ${payload.status})` : ''}`;
    case 'project.created':
      return `[Sitelog] New project created${payload.projectName ? `: ${payload.projectName}` : ''}`;
    case 'test.ping':
      return `[Sitelog] Test notification — your channel is wired correctly.`;
    default:
      return `[Sitelog] ${event} ${JSON.stringify(payload)}`;
  }
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

/**
 * Dispatch one event to all matching enabled channels for an org.
 * Per-channel errors are caught and logged so a single bad channel
 * cannot break the rest (or the caller).
 */
export async function dispatchToChannels(
  orgId: string,
  event: ChannelEvent | string,
  payload: DispatchPayload = {},
): Promise<{ dispatched: number; failed: number }> {
  let dispatched = 0;
  let failed = 0;

  let rows: NotificationChannel[] = [];
  try {
    // jsonb ? operator: contains the event as a top-level array element.
    rows = await db.select().from(notificationChannel).where(and(
      eq(notificationChannel.organizationId, orgId),
      eq(notificationChannel.enabled, true),
      sql`${notificationChannel.events} @> ${JSON.stringify([event])}::jsonb`,
    ));
  } catch (e) {
    log.error('notification.dispatch.lookup_failed', { orgId, event, err: String(e) });
    return { dispatched: 0, failed: 0 };
  }

  const message = formatMessage(event, payload);

  for (const ch of rows) {
    try {
      switch (ch.channelType) {
        case 'slack': {
          if (!ch.webhookUrl) throw new Error('slack channel missing webhookUrl');
          const r = await postJson(ch.webhookUrl, { text: message });
          if (!r.ok) throw new Error(`slack HTTP ${r.status}`);
          break;
        }
        case 'discord': {
          if (!ch.webhookUrl) throw new Error('discord channel missing webhookUrl');
          const r = await postJson(ch.webhookUrl, { content: message });
          if (!r.ok) throw new Error(`discord HTTP ${r.status}`);
          break;
        }
        case 'email': {
          if (!ch.emailAddress) throw new Error('email channel missing emailAddress');
          await sendEmail({
            to: ch.emailAddress,
            subject: message,
            html: `<p>${message}</p><pre style="font-family:monospace;font-size:12px;background:#f5f5f5;padding:12px">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`,
            text: `${message}\n\n${JSON.stringify(payload, null, 2)}`,
          });
          break;
        }
        default:
          throw new Error(`unknown channelType: ${ch.channelType}`);
      }
      dispatched++;
      log.info('notification.dispatch.ok', {
        orgId, event, channelId: ch.id, channelType: ch.channelType, channelName: ch.name,
      });
    } catch (err) {
      failed++;
      log.warn('notification.dispatch.fail', {
        orgId, event, channelId: ch.id, channelType: ch.channelType, channelName: ch.name,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { dispatched, failed };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
