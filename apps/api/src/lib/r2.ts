/**
 * Cloudflare R2 S3-compatible client + presign helper.
 *
 * R2 endpoint format: https://{ACCOUNT_ID}.r2.cloudflarestorage.com
 * Requires R2 API token with R/W on bucket.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET = process.env.R2_BUCKET ?? 'sitelog-photos';
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? '';

export const s3 = accountId && accessKeyId && secretAccessKey
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

export async function presignPut(key: string, contentType: string, expiresIn = 600) {
  if (!s3) return null;
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }), { expiresIn });
}

export async function presignGet(key: string, expiresIn = 3600) {
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn });
}

export async function deleteObject(key: string) {
  if (!s3) return;
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
