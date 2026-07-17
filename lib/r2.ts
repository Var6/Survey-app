import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) helper for storing images:
 * requisition receipts and survey consent photos.
 */

let client: S3Client | null = null;

export function r2Configured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );
}

function getClient(): S3Client {
  if (!r2Configured()) {
    throw new Error("R2 is not configured (check R2_* vars in .env.local)");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return client;
}

export function publicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return `${base}/${key}`;
}

/** Namespaced object key, e.g. receipts/2026/ab12cd-file.jpg */
export function buildKey(prefix: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-80);
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}/${stamp}/${rand}-${safe}`;
}

export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<{ key: string; url: string }> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { key, url: publicUrl(key) };
}

/** Presigned PUT url for direct browser → R2 uploads (requires bucket CORS). */
export async function presignPut(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}
