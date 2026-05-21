'use client';
import { useState, useEffect } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { subscribeWebPush } from '@/lib/web-push';
import { Bell, BellOff } from 'lucide-react';

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

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (prefs.data) setForm({
      emailDigestWeekly: prefs.data.emailDigestWeekly ?? true,
      emailMentions: prefs.data.emailMentions ?? true,
      emailBilling: prefs.data.emailBilling ?? true,
    });
  }, [prefs.data]);

  const [pushStatus, setPushStatus] = useState<string>('');
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
    <label className="flex justify-between items-center cursor-pointer">
      <span className="font-mono text-sm">{label}</span>
      <button onClick={() => onChange(!checked)} type="button"
        className={`relative w-12 h-6 border-2 border-[var(--color-ink)] transition-colors ${checked ? 'bg-[var(--color-brand)]' : 'bg-white'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-[var(--color-ink)] transition-transform ${checked ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}
