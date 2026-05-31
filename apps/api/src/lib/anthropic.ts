/**
 * Claude call helper. The API key is supplied per call — resolved by the caller
 * from the org's own stored key (BYO) with the server-level ANTHROPIC_API_KEY as
 * an optional fallback (self-hosted / single-tenant).
 */
import Anthropic from '@anthropic-ai/sdk';

export const AI_MODEL = 'claude-opus-4-7';

/** Optional server-wide fallback key (self-hosting). Null in a BYO-key deployment. */
export const ENV_ANTHROPIC_KEY: string | null = process.env.ANTHROPIC_API_KEY ?? null;

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
 * Single-shot Claude call with the given API key. `system` is cached (stable
 * prefix); `user` carries the per-request payload so the cache stays warm.
 */
export async function runClaude(apiKey: string, system: string, user: string, maxTokens = 4000): Promise<AiResult> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
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
