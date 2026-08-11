// src/lib/storage/cloudflare-r2.ts

/**
 * Cloudflare R2 implementation of `StorageAdapter` — WRITTEN AND COMMENTED OUT (K-5a).
 * ============================================================================
 *
 * ⚠️ THIS IS DELIBERATELY INERT. It exists so that moving providers is "uncomment this file,
 * install one package, set four environment variables" rather than a design task undertaken
 * under time pressure — which is when storage migrations go wrong.
 *
 * The full procedure, including copying existing objects without downtime, is
 * **`BLOB-TO-R2-MIGRATION.md`**. Do not enable this in isolation; step 3 of that document
 * (point new uploads at R2 *before* copying anything) is what keeps the set you are copying
 * from growing while you copy it.
 *
 * ── To enable ──────────────────────────────────────────────────────────────────
 *   1. npm install @aws-sdk/client-s3
 *      ⚠️ Not Amazon-specific. R2 speaks the S3 API; the client is simply pointed at
 *      Cloudflare. No AWS account is involved.
 *   2. Uncomment everything below.
 *   3. In `index.ts`, replace the `cloudflare-r2` branch's `throw` with:
 *          const { cloudflareR2Adapter } = await import('./cloudflare-r2');
 *          return cloudflareR2Adapter;
 *   4. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 *      — in `.env` AND in Vercel's project settings; they are separate.
 *   5. Keep BLOB_READ_WRITE_TOKEN until the copy finishes: the migration reads from Blob and
 *      writes to R2, so both sets of credentials must be live at once.
 *
 * ── Why the shape below ────────────────────────────────────────────────────────
 * `put` writes through the S3 API but returns a URL on `R2_PUBLIC_URL`, because the S3
 * endpoint is not publicly readable — the public URL is a custom domain (or r2.dev) bound to
 * the bucket. `delete` therefore has to turn that public URL back into an object key, which
 * is why `keyFromUrl` exists and why `R2_PUBLIC_URL` must never carry a trailing slash.
 */

// import {
//   DeleteObjectCommand,
//   HeadObjectCommand,
//   PutObjectCommand,
//   S3Client,
// } from '@aws-sdk/client-s3';
// import type { StorageAdapter } from './index';
//
// function client(): S3Client {
//   const accountId = requireEnv('R2_ACCOUNT_ID');
//   return new S3Client({
//     // R2 has no regions; the SDK still requires one and 'auto' is what Cloudflare specify.
//     region: 'auto',
//     endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
//     credentials: {
//       accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
//       secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
//     },
//   });
// }
//
// function requireEnv(name: string): string {
//   const value = process.env[name];
//   // Fail loudly and by name. A misconfigured bucket that silently accepts writes and
//   // returns unreachable URLs is far worse than a startup error.
//   if (!value) throw new Error(`${name} is not set. See BLOB-TO-R2-MIGRATION.md step 2.`);
//   return value;
// }
//
// /** Public URL -> object key. Requires R2_PUBLIC_URL to have NO trailing slash. */
// function keyFromUrl(url: string): string {
//   const base = requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '');
//   return url.startsWith(base) ? url.slice(base.length + 1) : url;
// }
//
// export const cloudflareR2Adapter: StorageAdapter = {
//   async put(objectKey, body, contentType) {
//     await client().send(
//       new PutObjectCommand({
//         Bucket: requireEnv('R2_BUCKET'),
//         Key: objectKey,
//         Body: body,
//         ContentType: contentType,
//         // Matches the Blob adapter. Safe for the same reason: the key is a content hash.
//         CacheControl: 'public, max-age=31536000, immutable',
//       }),
//     );
//     return { url: `${requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '')}/${objectKey}` };
//   },
//
//   async delete(url) {
//     await client().send(
//       new DeleteObjectCommand({ Bucket: requireEnv('R2_BUCKET'), Key: keyFromUrl(url) }),
//     );
//   },
//
//   async exists(url) {
//     try {
//       await client().send(
//         new HeadObjectCommand({ Bucket: requireEnv('R2_BUCKET'), Key: keyFromUrl(url) }),
//       );
//       return true;
//     } catch {
//       return false;
//     }
//   },
// };

export {};
