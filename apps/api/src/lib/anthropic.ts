/**
 * Anthropic (Claude) client — lazily initialized from ANTHROPIC_API_KEY.
 * Null when the key is absent (AI features degrade gracefully), mirroring the
 * stripe/r2 optional-integration pattern.
 */
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

export const AI_MODEL = 'claude-opus-4-7';

export function aiConfigured(): boolean {
  return anthropic !== null;
}

export interface AiResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
}

/**
 * Single-shot Claude call. `system` is cached (stable prefix); `user` carries
 * the per-request, volatile payload so the cache stays warm across calls.
 */
export async function runClaude(system: string, user: string, maxTokens = 4000): Promise<AiResult> {
  if (!anthropic) {
    throw new Error('AI is not configured on this server (missing ANTHROPIC_API_KEY).');
  }
  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return {
    text,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: res.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
