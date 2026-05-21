/**
 * Notification dispatch helper — write to notification table.
 *
 * Pattern: in mutation after success, call:
 *   await notify(userId, { kind: 'boq_changed', title: '...', href: '/app/projects/X' });
 */
import { db, notification } from '@sitelog/db';
import type { Notification } from '@sitelog/db';

type Kind = Notification['kind'];

export async function notify(userId: string, opts: {
  kind: Kind;
  title: string;
  body?: string;
  href?: string;
  organizationId?: string | null;
}) {
  try {
    await db.insert(notification).values({
      userId,
      organizationId: opts.organizationId ?? null,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      href: opts.href,
    });
  } catch (e) {
    console.error('[notify] failed', e);
  }
}

export async function notifyMany(userIds: string[], opts: Parameters<typeof notify>[1]) {
  if (!userIds.length) return;
  try {
    await db.insert(notification).values(userIds.map(uid => ({
      userId: uid,
      organizationId: opts.organizationId ?? null,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      href: opts.href,
    })));
  } catch (e) {
    console.error('[notify] batch failed', e);
  }
}
