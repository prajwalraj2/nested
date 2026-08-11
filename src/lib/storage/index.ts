// src/lib/storage/index.ts

/**
 * Object storage, behind one interface (K-5a).
 * ============================================================================
 *
 * ⚠️ **THIS IS THE ONLY MODULE ANYTHING MAY IMPORT FOR STORAGE.**
 *
 * No route, component, script or test may import `@vercel/blob` — or an S3 client — directly.
 * That single rule is what makes `BLOB-TO-R2-MIGRATION.md` a short document: switching
 * providers changes one file and one environment variable, and no call site at all.
 *
 * The check that keeps it true, run before any provider move:
 *
 *     grep -rn "@vercel/blob" src --include=*.ts --include=*.tsx | grep -v "lib/storage/"
 *
 * ⚠️ Note the shape of that grep. The equivalent check for `export-table.ts` in K-2 excluded
 * `lib/export-table`, which also excluded the very `from '@/lib/export-table'` import lines it
 * was looking for, and reported a file as dead while two components imported it. Here the
 * exclusion is the *directory*, so imports of `@/lib/storage` from elsewhere still show up.
 *
 * ── Why Vercel Blob and not Cloudflare R2 ──────────────────────────────────────
 * Recorded in full at #29.6(e). In short: storage need is ~9 MB, both free tiers swallow it,
 * and the difference is $0 versus $0 until roughly 200,000 page views a month. R2 is
 * genuinely cheaper — zero egress, forever — but costs setup complexity now for a bill that
 * does not exist yet. The indirection here makes that reversible.
 *
 * **Switch trigger:** image data transfer approaching 10 GB/month, visible in Vercel's usage
 * dashboard.
 */

/**
 * What every provider must do. Deliberately three methods — anything richer would leak a
 * provider's model into the callers and stop being swappable.
 */
export type StorageAdapter = {
  /**
   * Store `body` and return its public URL.
   *
   * @param objectKey path within the bucket, e.g. `table-images/a3f9c2e1b8.webp`. ⚠️ The
   *        caller supplies a **content hash**, so identical bytes always land on the same
   *        URL and different bytes never do — which is what makes a one-year immutable
   *        cache safe and removes any need for `-v2` filenames.
   */
  put(objectKey: string, body: Buffer, contentType: string): Promise<{ url: string }>;

  /** Remove an object by the URL previously returned from `put`. */
  delete(url: string): Promise<void>;

  /** Does the object still exist? Used by the admin screen to spot a bucket/DB divergence. */
  exists(url: string): Promise<boolean>;
};

export type StorageProvider = 'vercel-blob' | 'cloudflare-r2';

/**
 * Which provider is in use.
 *
 * ⚠️ Defaults to `vercel-blob` rather than throwing when unset. `TableImage.provider` records
 * per row where each object actually lives, so a half-migrated bucket keeps working; a hard
 * failure here would take the whole admin down over a missing environment variable.
 */
export function currentProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER === 'cloudflare-r2' ? 'cloudflare-r2' : 'vercel-blob';
}

/**
 * The adapter for the configured provider.
 *
 * ⚠️ The import is **dynamic and inside the function**, not at module scope. `@vercel/blob`
 * reads its token when the module loads, and `cloudflare-r2.ts` will pull in an S3 client —
 * importing both eagerly would mean every route that touches this module loads a client it
 * does not use, and a missing token for the *unused* provider could throw at import time.
 * This is the same lesson as #23's jsdom import, which broke a production build by being
 * loaded at module scope for routes that never sanitised anything.
 */
export async function getStorage(): Promise<StorageAdapter> {
  const provider = currentProvider();

  if (provider === 'cloudflare-r2') {
    /*
      ⚠️ NOT YET ENABLED. `cloudflare-r2.ts` ships written and commented out, so the move is
      "uncomment one file, install one package, set four env vars" rather than a design task
      under time pressure. Until it is uncommented this branch is unreachable in practice —
      `STORAGE_PROVIDER` is unset everywhere — and the error names the document that explains
      what to do rather than failing anonymously.
    */
    throw new Error(
      'STORAGE_PROVIDER is "cloudflare-r2" but src/lib/storage/cloudflare-r2.ts is still ' +
        'commented out. Follow BLOB-TO-R2-MIGRATION.md step 2 before setting this.',
    );
  }

  const { vercelBlobAdapter } = await import('./vercel-blob');
  return vercelBlobAdapter;
}
