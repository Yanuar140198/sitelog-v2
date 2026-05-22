-- Notification channel preferences: Slack/Discord/Email integrations per org.

CREATE TABLE IF NOT EXISTS notification_channel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  channel_type varchar(32) NOT NULL,  -- 'slack', 'discord', 'email'
  name varchar(120) NOT NULL,         -- 'Site supervisor Slack', 'Ops Discord'
  webhook_url text,                   -- for slack/discord
  email_address varchar(255),         -- for email
  events jsonb NOT NULL DEFAULT '[]', -- ['entry.submit', 'webhook.failed', ...]
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notif_channel_org_idx ON notification_channel(organization_id);
