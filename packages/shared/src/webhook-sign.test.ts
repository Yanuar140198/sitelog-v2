import { describe, it, expect } from 'vitest';
import { signPayload, parseHeader, verifyWebhook } from './webhook-sign.js';

const SECRET = 'whsec_test_abc123';
const BODY = JSON.stringify({ event: 'entry.submitted', id: 'evt_1' });

describe('webhook signature (HMAC-SHA256)', () => {
  it('signPayload produces parseable header', () => {
    const h = signPayload(SECRET, BODY, 1700000000);
    expect(h).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });

  it('parseHeader extracts timestamp + signature', () => {
    const p = parseHeader('t=1700000000,v1=abc123');
    expect(p).toEqual({ t: 1700000000, v1: 'abc123' });
  });

  it('parseHeader returns null on malformed input', () => {
    expect(parseHeader('garbage')).toBeNull();
    expect(parseHeader('t=123')).toBeNull();
  });

  it('verifyWebhook accepts valid signature within tolerance', () => {
    const now = 1700000000;
    const h = signPayload(SECRET, BODY, now);
    expect(verifyWebhook(SECRET, BODY, h, { now: now + 10 })).toBe(true);
  });

  it('verifyWebhook rejects wrong secret', () => {
    const now = 1700000000;
    const h = signPayload(SECRET, BODY, now);
    expect(verifyWebhook('wrong_secret', BODY, h, { now })).toBe(false);
  });

  it('verifyWebhook rejects tampered body', () => {
    const now = 1700000000;
    const h = signPayload(SECRET, BODY, now);
    expect(verifyWebhook(SECRET, BODY + 'tampered', h, { now })).toBe(false);
  });

  it('verifyWebhook rejects replay outside tolerance window', () => {
    const old = 1700000000;
    const h = signPayload(SECRET, BODY, old);
    // 10 minutes later, beyond default 5 min tolerance
    expect(verifyWebhook(SECRET, BODY, h, { now: old + 600 })).toBe(false);
  });

  it('verifyWebhook accepts replay if tolerance widened', () => {
    const old = 1700000000;
    const h = signPayload(SECRET, BODY, old);
    expect(verifyWebhook(SECRET, BODY, h, { now: old + 600, toleranceSeconds: 900 })).toBe(true);
  });

  it('verifyWebhook handles empty body', () => {
    const now = 1700000000;
    const h = signPayload(SECRET, '', now);
    expect(verifyWebhook(SECRET, '', h, { now })).toBe(true);
  });

  it('verifyWebhook rejects header with mismatched hex length', () => {
    expect(verifyWebhook(SECRET, BODY, 't=1700000000,v1=deadbeef', { now: 1700000000 })).toBe(false);
  });

  it('parseHeader strips whitespace', () => {
    const p = parseHeader(' t=1700000000 , v1=abc123 ');
    expect(p?.t).toBe(1700000000);
    expect(p?.v1).toBe('abc123');
  });

  it('signPayload uses default now when timestamp omitted', () => {
    const before = Math.floor(Date.now() / 1000);
    const h = signPayload(SECRET, BODY);
    const parsed = parseHeader(h);
    expect(parsed?.t).toBeGreaterThanOrEqual(before);
    expect(parsed?.t).toBeLessThanOrEqual(before + 2);
  });
});
