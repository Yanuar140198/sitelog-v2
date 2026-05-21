/**
 * Slack / Microsoft Teams webhook formatter.
 *
 * Detects target by URL pattern:
 *   - hooks.slack.com → Slack message block format
 *   - *.webhook.office.com → Teams MessageCard
 *   - else: generic JSON
 */

export type ChatTarget = 'slack' | 'teams' | 'generic';

export function detectChatTarget(url: string): ChatTarget {
  if (url.includes('hooks.slack.com')) return 'slack';
  if (url.includes('webhook.office.com')) return 'teams';
  return 'generic';
}

export function formatForChat(target: ChatTarget, event: string, data: Record<string, unknown>): unknown {
  const title = `Sitelog · ${event}`;
  const text = JSON.stringify(data, null, 2).slice(0, 1000);
  if (target === 'slack') {
    return {
      text: title,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: title } },
        { type: 'section', text: { type: 'mrkdwn', text: '```' + text + '```' } },
      ],
    };
  }
  if (target === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: 'FF5500',
      summary: title,
      title,
      text: '```\n' + text + '\n```',
    };
  }
  return { event, data };
}
