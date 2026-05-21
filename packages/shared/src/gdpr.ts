/**
 * GDPR confirmation validation — extracted for unit testing.
 */
export const DELETE_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

export function isValidDeletionConfirmation(input: string): boolean {
  return input === DELETE_CONFIRMATION_PHRASE;
}

/**
 * Compute scheduled hard-delete date — 30 days from request.
 */
export function scheduledDeletionDate(now: Date = new Date()): Date {
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

/**
 * Anonymize email — replace local part with deterministic UUID-derived value.
 * Used after deletion request to prevent re-identification while preserving FK integrity.
 */
export function anonymizeEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`;
}
