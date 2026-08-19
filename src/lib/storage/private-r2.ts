// src/lib/storage/private-r2.ts

import type { PrivateStorage } from './index';

/**
 * Private object storage on Cloudflare R2 (M-8).
 * ============================================================================
 *
 * ⚠️ A SEPARATE MODULE FROM `StorageAdapter`, NOT THREE MORE METHODS ON IT — AND THE AGREED PLAN
 * SAID OTHERWISE. The plan had the adapter "grow a private trio" with Vercel Blob throwing on all
 * three. That cannot work: `getStorage()` returns ONE adapter chosen by `STORAGE_PROVIDER`, which
 * is unset and therefore Blob — so every private upload would hit the throwing implementation
 * unless the PUBLIC provider were switched to R2, which decision 36.3(d) explicitly forbids.
 *
 * Splitting it is also closer to the intent of decision 36.3(g): private is not a mode of the
 * public adapter, it is separate infrastructure with its own bucket and its own credentials.
 * `vercel-blob.ts` and the commented-out public `cloudflare-r2.ts` are untouched by this file.
 *
 * ⚠️ THE BUCKET HAS NO PUBLIC ACCESS, NO `r2.dev` URL AND NO CUSTOM DOMAIN. There is deliberately
 * no `getUrl` here and no URL signing — objects are readable ONLY by the server, and reach a
 * browser only through `GET /api/admin/applications/[id]/resume` behind `requireAdmin()`.
 * A presigned URL would work for anyone holding it until it expired; an auth check does not.
 *
 * ⚠️ THEREFORE NO CORS CONFIGURATION IS NEEDED ON THE BUCKET. The browser never contacts R2 — the
 * upload goes to our own route and the server writes from there. CORS is the usual R2 stumbling
 * block and it simply does not apply to this design.
 */

/**
 * ⚠️ `.trim()` IS NOT DEFENSIVE PROGRAMMING FOR ITS OWN SAKE — IT ALREADY CAUGHT A REAL FAULT.
 *
 * The first connectivity test failed with `Credential access key has length 33, should be 32`:
 * `R2_ACCESS_KEY_ID` had picked up a trailing newline when it was pasted into `.env`. The error is
 * opaque enough that it reads as "wrong credentials" rather than "invisible extra character", and
 * the same paste has to happen again in Vercel's dashboard, where a stray space is even harder to
 * see. Trimming here fixes it once, everywhere.
 */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  /*
    Fail loudly and by name. A misconfigured bucket that silently accepts writes and then cannot
    read them back is far worse than a startup error — and the thing being written is a person's CV.
  */
  if (!value) {
    throw new Error(
      `[private-r2] ${name} is not set. Private file storage needs R2_ACCOUNT_ID, ` +
        'R2_PRIVATE_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY — in .env AND in Vercel.'
    );
  }
  return value;
}

/*
  ⚠️ THE CLIENT IS BUILT LAZILY AND CACHED, NOT CONSTRUCTED AT MODULE SCOPE.

  Reading credentials at import time means any route that merely touches this module throws when
  the variables are absent — including routes that never store a file. That is the shape of #23,
  where a module-scope import broke a production build for routes that never used it. Building on
  first use keeps the failure at the point of the actual operation.
*/
let cached: import('@aws-sdk/client-s3').S3Client | null = null;

async function client() {
  if (cached) return cached;
  const { S3Client } = await import('@aws-sdk/client-s3');
  cached = new S3Client({
    // R2 has no regions; the SDK still requires one, and 'auto' is what Cloudflare specify.
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
  return cached;
}

export const privateR2Storage: PrivateStorage = {
  async putPrivate(objectKey, body, contentType) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await client();

    await s3.send(
      new PutObjectCommand({
        Bucket: requireEnv('R2_PRIVATE_BUCKET'),
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      })
    );

    /*
      ⚠️ RETURNS THE KEY, NOT A URL — the one deliberate difference from the public adapter's
      `put`. There is no URL to return. Handing back something URL-shaped is precisely how an
      object ends up in an `href` and the private bucket stops being private.
    */
    return { key: objectKey };
  },

  async getPrivate(objectKey) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await client();

    const result = await s3.send(
      new GetObjectCommand({ Bucket: requireEnv('R2_PRIVATE_BUCKET'), Key: objectKey })
    );

    if (!result.Body) throw new Error(`[private-r2] ${objectKey} returned no body.`);

    /*
      ⚠️ BUFFERED, NOT STREAMED — a deliberate simplification for this payload. These are PDFs
      capped at 2 MB, so holding one in memory costs nothing, and buffering avoids threading a
      provider-specific stream type through the route. Revisit only if the cap ever rises far.
    */
    return Buffer.from(await result.Body.transformToByteArray());
  },

  async deletePrivate(objectKey) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await client();
    /*
      S3 delete is idempotent: removing a key that is not there succeeds. That is the behaviour we
      want — a retry after a half-failed cleanup must not error, and an application row whose
      object has already gone must still be deletable.
    */
    await s3.send(
      new DeleteObjectCommand({ Bucket: requireEnv('R2_PRIVATE_BUCKET'), Key: objectKey })
    );
  },
};
