// src/lib/storage/vercel-blob.ts

import { del, head, put } from '@vercel/blob';
import type { StorageAdapter } from './index';

/**
 * Vercel Blob implementation of `StorageAdapter` (K-5a).
 * ============================================================================
 *
 * ⚠️ Nothing outside `src/lib/storage/` may import this file. See the rule in `index.ts`.
 *
 * Configuration is one variable, `BLOB_READ_WRITE_TOKEN`, which Vercel injects into the
 * project automatically when a Blob store is created and connected. Locally it has to be
 * pulled down (`npx vercel env pull .env.local`) — uploads from `localhost` go to the same
 * store as production, deliberately, so there is no dev-only code path that behaves
 * differently once deployed.
 */
export const vercelBlobAdapter: StorageAdapter = {
  async put(objectKey, body, contentType) {
    const result = await put(objectKey, body, {
      access: 'public',
      contentType,
      /*
        ⚠️ `addRandomSuffix: false` IS REQUIRED, and the default is the opposite.

        Vercel Blob appends a random suffix to the pathname by default, so uploading the
        same bytes twice would produce two different URLs and two stored objects. The whole
        point of the caller's content hash is that identical bytes reach the same URL —
        which is what makes re-uploading an unchanged image free, and what makes
        `immutable, max-age=31536000` safe.
      */
      addRandomSuffix: false,
      /*
        ⚠️ `allowOverwrite: true` IS REQUIRED, AND ITS ABSENCE WAS A REAL BUG.

        Vercel Blob throws if the destination pathname already exists —
        *"By default an error will be thrown if the destination blob already exists."* The
        end-to-end test caught it as a 500 when the **same image was uploaded under a second
        key**: identical bytes produce an identical content hash, therefore the same pathname,
        therefore a collision.

        That is not an edge case. The same logo under two keys, or re-adding an image after
        deleting it, both hit it — and both are things a person would reasonably do.

        Overwriting is safe **precisely because the name is a content hash**: the only file
        that can ever collide is one containing byte-for-byte identical content. The write is
        idempotent by construction, which is the property the hash was chosen for.
      */
      allowOverwrite: true,
      /*
        A year, immutable. Safe for the same reason: new artwork is new bytes, therefore a new
        hash, therefore a new URL that no browser has cached. Same reasoning as `/icons/` in
        `next.config.ts`.
      */
      cacheControlMaxAge: 31_536_000,
    });
    return { url: result.url };
  },

  async delete(url) {
    await del(url);
  },

  async exists(url) {
    try {
      await head(url);
      return true;
    } catch {
      // `head` throws rather than returning null for a missing object. The admin screen
      // uses this to spot a row whose object has gone, so "unknown" must read as absent.
      return false;
    }
  },
};
