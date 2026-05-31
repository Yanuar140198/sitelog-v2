import { describe, it, expect, beforeAll } from 'vitest';

// Encryption key must be present before importing the module under test.
beforeAll(() => {
  process.env.SECRET_ENCRYPTION_KEY ??= 'test-secret-encryption-key-32-bytes-min';
});

describe('secret-box (AES-256-GCM envelope)', () => {
  it('round-trips plaintext through seal → open', async () => {
    const { seal, open } = await import('./secret-box.js');
    const key = 'sk-ant-api03-EXAMPLE-1234567890';
    const sealed = seal(key);
    expect(sealed.ciphertext).not.toContain(key);     // not stored in cleartext
    expect(sealed.iv).toMatch(/^[0-9a-f]{32}$/);       // 16-byte hex
    expect(sealed.authTag).toMatch(/^[0-9a-f]{32}$/);
    expect(open(sealed)).toBe(key);
  });

  it('produces a unique iv/ciphertext each call (random nonce)', async () => {
    const { seal } = await import('./secret-box.js');
    const a = seal('same-value');
    const b = seal('same-value');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('fails to open when the auth tag is tampered (integrity check)', async () => {
    const { seal, open } = await import('./secret-box.js');
    const sealed = seal('tamper-me');
    const badTag = sealed.authTag.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    expect(() => open({ ...sealed, authTag: badTag })).toThrow();
  });
});
