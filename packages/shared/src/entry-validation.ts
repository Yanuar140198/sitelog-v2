/**
 * Daily entry validation — extracted for unit testing.
 */
export interface EntryInput {
  effectiveHours: number;
  workforce: number;
  activities: Array<{ quantity: number; satuan: string }>;
  photoKeys: string[];
}

export interface EntryValidation {
  ok: boolean;
  errors: string[];
}

export const MAX_HOURS_PER_SHIFT = 12;
export const MAX_PHOTOS_PER_ENTRY = 20;
export const MAX_WORKFORCE = 999;
export const MAX_ACTIVITIES = 50;

export function validateEntry(input: EntryInput): EntryValidation {
  const errors: string[] = [];
  if (input.effectiveHours < 0 || input.effectiveHours > MAX_HOURS_PER_SHIFT) {
    errors.push(`effectiveHours must be 0..${MAX_HOURS_PER_SHIFT}`);
  }
  if (input.workforce < 0 || input.workforce > MAX_WORKFORCE) {
    errors.push(`workforce must be 0..${MAX_WORKFORCE}`);
  }
  if (input.photoKeys.length > MAX_PHOTOS_PER_ENTRY) {
    errors.push(`max ${MAX_PHOTOS_PER_ENTRY} photos per entry`);
  }
  if (input.activities.length > MAX_ACTIVITIES) {
    errors.push(`max ${MAX_ACTIVITIES} activities per entry`);
  }
  for (const a of input.activities) {
    if (a.quantity < 0) errors.push('activity quantity cannot be negative');
  }
  return { ok: errors.length === 0, errors };
}
