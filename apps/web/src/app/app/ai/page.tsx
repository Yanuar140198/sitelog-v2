'use client';
import { useState, useRef, useEffect } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; content: string }

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const ask = trpc.ai.ask.useMutation({
    onSuccess: (data) => setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]),
    onError: (e) => setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${e.message}` }]),
  });

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  async function send() {
    if (!input.trim()) return;
    const m = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: m }]);
    setInput('');
    ask.mutate({ message: m });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="p-6 border-b-2 border-[var(--color-ink)]">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] flex items-center gap-2">
          <Sparkles size={12} /> AI ASSISTANT
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight mt-1">Sitelog AI</h1>
        <p className="font-mono text-xs text-neutral-500 mt-1">Powered by Claude. Ask about AHSP, BOQ scoping, unit rates, report drafts.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16 max-w-md mx-auto">
            <Sparkles size={32} className="mx-auto text-[var(--color-brand)] mb-4" />
            <h3 className="font-display text-xl font-bold">How can I help?</h3>
            <div className="mt-6 space-y-2">
              {[
                'Buatkan BOQ scoping untuk project road construction 5km',
                'Jelaskan AHSP EI-311 (Cut soil dengan Excavator)',
                'Suggest unit rate untuk Fill compaction tanah lokal',
              ].map(p => (
                <button key={p} onClick={() => setInput(p)}
                  className="block w-full text-left px-4 py-3 border-2 border-neutral-200 hover:border-[var(--color-brand)] font-mono text-xs">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-3xl ${m.role === 'user' ? 'ml-auto' : ''}`}>
            <div className="font-mono text-[10px] tracking-wider opacity-50 mb-1">{m.role === 'user' ? 'YOU' : 'SITELOG AI'}</div>
            <div className={`p-4 border-2 ${m.role === 'user' ? 'bg-[var(--color-ink)] text-white border-[var(--color-ink)]' : 'bg-white border-[var(--color-ink)]'}`}>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
            </div>
          </div>
        ))}
        {ask.isPending && (
          <div className="font-mono text-xs text-neutral-500 max-w-3xl">SITELOG AI is thinking...</div>
        )}
      </div>

      <form onSubmit={e => { e.preventDefault(); send(); }} className="border-t-2 border-[var(--color-ink)] p-4 flex gap-2 bg-white">
        <Input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Tanya apa saja tentang BOQ, AHSP, rate..." className="flex-1" />
        <Button type="submit" variant="primary" disabled={ask.isPending || !input.trim()}>SEND →</Button>
      </form>
    </div>
  );
}
