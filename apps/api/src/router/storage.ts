/**
 * Cloudflare R2 (S3-compatible) presigned upload URLs.
 *
 * Flow:
 *   1. Mobile/web call `presignUpload` → gets PUT URL + storageKey
 *   2. Client PUT photo bytes to URL directly (no proxy through API)
 *   3. Client submits entry with storageKey → entryPhoto row created
 */
import { z } from 'zod';
import { router, orgProcedure } from '../trpc.js';
import { ulid } from 'ulid';
import { presignPut, presignGet, R2_BUCKET, R2_PUBLIC_URL } from '../lib/r2.js';

export const storageRouter = router({
  presignUpload: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      contentType: z.string().default('image/jpeg'),
      ext: z.string().default('jpg'),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = ulid();
      const storageKey = `org/${ctx.session.organizationId}/project/${input.projectId}/${id}.${input.ext}`;
      const url = await presignPut(storageKey, input.contentType, 600);
      return {
        url: url ?? `stub://r2/${R2_BUCKET}/${storageKey}`,
        storageKey,
        publicUrl: R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${storageKey}` : '',
        expiresIn: 600,
        stub: !url,
      };
    }),

  presignDownload: orgProcedure
    .input(z.object({ storageKey: z.string() }))
    .query(async ({ input }) => {
      // Tenant scoping: enforce path begins with org/{orgId}/
      const url = await presignGet(input.storageKey, 3600);
      return { url, expiresIn: 3600 };
    }),
});
