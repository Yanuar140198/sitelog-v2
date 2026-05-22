'use client';
import { useState, useEffect } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { subscribeWebPush } from '@/lib/web-push';
import { Bell, BellOff, Plus, Send, Trash2, X } from 'lucide-react';

const CHANNEL_TYPES = [
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email' },
] as const;

const CHANNEL_EVENTS = [
  { value: 'entry.submit', label: 'Entry submitted' },
  { value: 'entry.approved', label: 'Entry approved' },
  { value: 'webhook.failed', label: 'Webhook failed' },
  { value: 'project.created', label: 'Project created' },
] as const;

type ChannelType = (typeof CHANNEL_TYPES)[number]['value'];
type ChannelEvent = (typeof CHANNEL_EVENTS)[number]['value'];

export default function NotificationsSettings() {
  const prefs = trpc.notification.preferences.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => utils.notification.preferences.invalidate(),
  });
  const pushList = trpc.push.list.useQuery();
  const registerPush = trpc.push.register.useMutation({
    onSuccess: () => utils.push.list.invalidate(),
  });
  const unregisterPush = trpc.push.unregister.useMutation({
    onSuccess: () => utils.push.list.invalidate(),
  });

  // Integration channels (Slack / Discord / Email)
  const channels = trpc.notification.channels.list.useQuery();
  const createChannel = trpc.notification.channels.create.useMutation({
    onSuccess: () => { utils.notification.channels.list.invalidate(); setShowAdd(false); },
  });
  const updateChannel = trpc.notification.channels.update.useMutation({
    onSuccess: () => utils.notification.channels.list.invalidate(),
  });
  const deleteChannel = trpc.notification.channels.delete.useMutation({
    onSuccess: () => utils.notification.channels.list.invalidate(),
  });
  const testChannel = trpc.notification.channels.test.useMutation();

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (prefs.data) setForm({
      emailDigestWeekly: prefs.data.emailDigestWeekly ?? true,
      emailMentions: prefs.data.emailMentions ?? true,
      emailBilling: prefs.data.emailBilling ?? true,
    });
  }, [prefs.data]);

  const [pushStatus, setPushStatus] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

  async function enableWebPush() {
    setPushStatus('Requesting permission...');
    try {
      const sub = await subscribeWebPush();
      if (!sub) { setPushStatus('Permission denied or VAPID key missing'); return; }
      await registerPush.mutateAsync({
        kind: 'web-push', token: sub.endpoint, p256dh: sub.p256dh, authKey: sub.authKey,
        deviceLabel: navigator.userAgent.slice(0, 64),
      });
      setPushStatus('✓ Browser notifications enabled');
    } catch (e: any) {
      setPushStatus(`Failed: ${e.message}`);
    }
  }

  function toggle(k: string, v: boolean) {
    setForm((p: any) => ({ ...p, [k]: v }));
    update.mutate({ [k]: v });
  }

  async function onTest(id: string) {
    setTestStatus(s => ({ ...s, [id]: 'Sending...' }));
    try {
      const r = await testChannel.mutateAsync({ id });
      setTestStatus(s => ({ ...s, [id]: `✓ Sent (${r.dispatched} ok, ${r.failed} failed)` }));
    } catch (e: any) {
      setTestStatus(s => ({ ...s, [id]: `Failed: ${e.message}` }));
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="EMAIL NOTIFICATIONS">
        <Toggle label="Weekly portfolio digest" checked={form.emailDigestWeekly ?? true} onChange={v => toggle('emailDigestWeekly', v)} />
        <Toggle label="Mentions in comments" checked={form.emailMentions ?? true} onChange={v => toggle('emailMentions', v)} />
        <Toggle label="Billing & receipts" checked={form.emailBilling ?? true} onChange={v => toggle('emailBilling', v)} />
      </Section>

      <Section title="PUSH NOTIFICATIONS">
        <Button onClick={enableWebPush} variant="primary">
          <Bell size={14} /> ENABLE BROWSER NOTIFICATIONS
        </Button>
        {pushStatus && <div className="font-mono text-xs text-neutral-600 mt-2">{pushStatus}</div>}
        <div className="mt-4">
          <Label>Registered devices</Label>
          {(pushList.data ?? []).length === 0 ? (
            <div className="font-mono text-xs text-neutral-500">No devices yet</div>
          ) : (
            <div className="space-y-2">
              {pushList.data?.map(d => (
                <div key={d.id} className="border border-[var(--color-ink)] p-3 flex justify-between items-center font-mono text-xs">
                  <div>
                    <span className="bg-[var(--color-brand)] text-white px-2 py-0.5 text-[10px] font-bold uppercase">{d.kind}</span>
                    <span className="ml-2">{d.deviceLabel ?? '—'}</span>
                    <div className="text-neutral-500 mt-1">Last seen {new Date(d.lastSeenAt).toLocaleString('id-ID')}</div>
                  </div>
                  <button onClick={() => unregisterPush.mutate({ token: d.id })} className="text-red-600 hover:underline"><BellOff size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="INTEGRATIONS">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs text-neutral-600">
            Route domain events to Slack, Discord, or email recipients.
          </div>
          <Button onClick={() => setShowAdd(true)} variant="primary">
            <Plus size={14} /> ADD CHANNEL
          </Button>
        </div>

        {channels.isLoading ? (
          <div className="font-mono text-xs text-neutral-500">Loading…</div>
        ) : (channels.data ?? []).length === 0 ? (
          <div className="font-mono text-xs text-neutral-500 mt-3">No channels configured yet.</div>
        ) : (
          <div className="space-y-2 mt-3">
            {channels.data!.map(c => {
              const events = (c.events ?? []) as string[];
              return (
                <div key={c.id} className="border border-[var(--color-ink)] p-3 font-mono text-xs">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--color-brand)] text-white px-2 py-0.5 text-[10px] font-bold uppercase">{c.channelType}</span>
                        <span className="font-bold truncate">{c.name}</span>
                      </div>
                      <div className="text-neutral-500 mt-1 truncate">
                        {c.channelType === 'email' ? c.emailAddress : c.webhookUrl}
                      </div>
                      <div className="text-neutral-600 mt-1">
                        {events.length} event{events.length === 1 ? '' : 's'}: {events.join(', ') || '—'}
                      </div>
                      {testStatus[c.id] && (
                        <div className="text-neutral-700 mt-1">{testStatus[c.id]}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Toggle
                        label=""
                        checked={c.enabled}
                        onChange={v => updateChannel.mutate({ id: c.id, enabled: v })}
                      />
                      <button
                        onClick={() => onTest(c.id)}
                        className="border border-[var(--color-ink)] px-2 py-1 hover:bg-[var(--color-ink)] hover:text-white"
                        title="Send test"
                      >
                        <Send size={12} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Delete channel "${c.name}"?`)) deleteChannel.mutate({ id: c.id }); }}
                        className="text-red-600 hover:underline px-1"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {showAdd && (
        <AddChannelModal
          onClose={() => setShowAdd(false)}
          submitting={createChannel.isPending}
          onSubmit={async input => {
            await createChannel.mutateAsync(input);
          }}
        />
      )}
    </div>
  );
}

function AddChannelModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (input: {
    type: ChannelType;
    name: string;
    webhookUrl?: string;
    emailAddress?: string;
    events: ChannelEvent[];
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [type, setType] = useState<ChannelType>('slack');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [events, setEvents] = useState<ChannelEvent[]>([]);
  const [err, setErr] = useState('');

  const isEmail = type === 'email';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) { setErr('Name is required'); return; }
    if (!target.trim()) { setErr(isEmail ? 'Email is required' : 'Webhook URL is required'); return; }
    if (events.length === 0) { setErr('Select at least one event'); return; }
    try {
      await onSubmit({
        type,
        name: name.trim(),
        webhookUrl: isEmail ? undefined : target.trim(),
        emailAddress: isEmail ? target.trim() : undefined,
        events,
      });
    } catch (e: any) {
      setErr(e.message ?? 'Failed to create');
    }
  }

  function toggleEvent(ev: ChannelEvent) {
    setEvents(prev => prev.includes(ev) ? prev.filter(x => x !== ev) : [...prev, ev]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border-2 border-[var(--color-ink)] w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex justify-between items-center">
          <span>ADD CHANNEL</span>
          <button onClick={onClose} className="hover:text-[var(--color-brand)]"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <Label>Type</Label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ChannelType)}
              className="w-full border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-sm bg-white"
            >
              {CHANNEL_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Site supervisor Slack" />
          </div>
          <div>
            <Label>{isEmail ? 'Email address' : 'Webhook URL'}</Label>
            <Input
              type={isEmail ? 'email' : 'url'}
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder={isEmail ? 'ops@example.com' : 'https://hooks.slack.com/services/...'}
            />
          </div>
          <div>
            <Label>Events</Label>
            <div className="space-y-1 mt-1">
              {CHANNEL_EVENTS.map(ev => (
                <label key={ev.value} className="flex items-center gap-2 font-mono text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="accent-[var(--color-brand)]"
                  />
                  <span>{ev.label} <span className="text-neutral-500">({ev.value})</span></span>
                </label>
              ))}
            </div>
          </div>
          {err && <div className="font-mono text-xs text-red-600">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={onClose} variant="secondary">CANCEL</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'SAVING…' : 'CREATE'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">{title}</div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex justify-between items-center cursor-pointer gap-3">
      {label && <span className="font-mono text-sm">{label}</span>}
      <button onClick={() => onChange(!checked)} type="button"
        className={`relative w-12 h-6 border-2 border-[var(--color-ink)] transition-colors ${checked ? 'bg-[var(--color-brand)]' : 'bg-white'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-[var(--color-ink)] transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}
