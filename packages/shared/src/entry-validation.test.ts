import { describe, it, expect } from 'vitest';
import { validateEntry, MAX_HOURS_PER_SHIFT, MAX_PHOTOS_PER_ENTRY } from './entry-validation.js';

const baseEntry = {
  effectiveHours: 9,
  workforce: 18,
  activities: [{ quantity: 7800, satuan: 'm3' }],
  photoKeys: [],
};

describe('daily entry validation', () => {
  it('accepts valid entry', () => {
    expect(validateEntry(baseEntry).ok).toBe(true);
  });

  it('rejects negative hours', () => {
    const r = validateEntry({ ...baseEntry, effectiveHours: -1 });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/effectiveHours/);
  });

  it('rejects hours exceeding shift max', () => {
    const r = validateEntry({ ...baseEntry, effectiveHours: MAX_HOURS_PER_SHIFT + 1 });
    expect(r.ok).toBe(false);
  });

  it('accepts max hours boundary', () => {
    expect(validateEntry({ ...baseEntry, effectiveHours: MAX_HOURS_PER_SHIFT }).ok).toBe(true);
  });

  it('rejects negative workforce', () => {
    expect(validateEntry({ ...baseEntry, workforce: -5 }).ok).toBe(false);
  });

  it('rejects too many photos', () => {
    const photos = Array.from({ length: MAX_PHOTOS_PER_ENTRY + 1 }, (_, i) => `key-${i}`);
    const r = validateEntry({ ...baseEntry, photoKeys: photos });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/20 photos/);
  });

  it('accepts exactly max photos', () => {
    const photos = Array.from({ length: MAX_PHOTOS_PER_ENTRY }, (_, i) => `key-${i}`);
    expect(validateEntry({ ...baseEntry, photoKeys: photos }).ok).toBe(true);
  });

  it('rejects negative activity quantity', () => {
    const r = validateEntry({ ...baseEntry, activities: [{ quantity: -100, satuan: 'm3' }] });
    expect(r.ok).toBe(false);
  });

  it('accumulates multiple errors', () => {
    const r = validateEntry({ ...baseEntry, effectiveHours: -1, workforce: -1 });
    expect(r.errors.length).toBe(2);
  });

  it('accepts 0 hours (rest day, no production)', () => {
    expect(validateEntry({ ...baseEntry, effectiveHours: 0 }).ok).toBe(true);
  });

  it('accepts 0 workforce (entry for documentation only)', () => {
    expect(validateEntry({ ...baseEntry, workforce: 0 }).ok).toBe(true);
  });

  it('rejects too many activities', () => {
    const activities = Array.from({ length: 51 }, () => ({ quantity: 1, satuan: 'm3' }));
    const r = validateEntry({ ...baseEntry, activities });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/50 activities/);
  });

  it('accepts empty activities array (no production day)', () => {
    expect(validateEntry({ ...baseEntry, activities: [] }).ok).toBe(true);
  });
});
