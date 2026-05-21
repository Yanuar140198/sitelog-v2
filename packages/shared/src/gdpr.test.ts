import { describe, it, expect } from 'vitest';
import {
  DELETE_CONFIRMATION_PHRASE,
  isValidDeletionConfirmation,
  scheduledDeletionDate,
  anonymizeEmail,
} from './gdpr.js';

describe('GDPR Article 17 (Right to erasure)', () => {
  it('exposes exact required confirmation phrase', () => {
    expect(DELETE_CONFIRMATION_PHRASE).toBe('DELETE MY ACCOUNT');
  });

  it('accepts exact phrase', () => {
    expect(isValidDeletionConfirmation('DELETE MY ACCOUNT')).toBe(true);
  });

  it('rejects case-insensitive variants', () => {
    expect(isValidDeletionConfirmation('delete my account')).toBe(false);
    expect(isValidDeletionConfirmation('Delete My Account')).toBe(false);
  });

  it('rejects trimmed-but-padded input', () => {
    expect(isValidDeletionConfirmation(' DELETE MY ACCOUNT ')).toBe(false);
  });

  it('rejects empty/junk', () => {
    expect(isValidDeletionConfirmation('')).toBe(false);
    expect(isValidDeletionConfirmation('yes')).toBe(false);
  });

  it('scheduledDeletionDate is exactly 30 days out', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = scheduledDeletionDate(t0);
    const diffMs = t1.getTime() - t0.getTime();
    expect(diffMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('anonymizeEmail produces deterministic value per user', () => {
    const a = anonymizeEmail('user-abc-123');
    const b = anonymizeEmail('user-abc-123');
    expect(a).toBe(b);
    expect(a).toBe('deleted-user-abc-123@deleted.invalid');
  });

  it('anonymizeEmail isolates by userId', () => {
    expect(anonymizeEmail('a')).not.toBe(anonymizeEmail('b'));
  });
});
