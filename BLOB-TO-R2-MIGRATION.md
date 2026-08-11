# Moving table images from Vercel Blob to Cloudflare R2

Written 11 Aug 2026, before a single image exists — which is the point. This document is what
makes the choice in `NEW-IMPROVEMENTS-2.md` §29.6(e) reversible, and it is written for the
awkward case, not the easy one:

> **You are mid-flight.** There are already thousands of images in Vercel Blob, referenced by
> live tables that visitors are looking at right now. You want to be on R2.

Nothing here is hypothetical about the code — the adapter in K-5a exists precisely so this
document can be short.

---

## Contents

1. [Should you move at all?](#1-should-you-move-at-all)
2. [What actually has to change](#2-what-actually-has-to-change)
3. [Why this is not a big job](#3-why-this-is-not-a-big-job)
4. [Before you start](#4-before-you-start)
5. [Step 1 — Create the bucket and a public URL](#step-1--create-the-bucket-and-a-public-url)
6. [Step 2 — Enable the R2 adapter](#step-2--enable-the-r2-adapter)
7. [Step 3 — Point new uploads at R2](#step-3--point-new-uploads-at-r2)
8. [Step 4 — Copy the existing objects](#step-4--copy-the-existing-objects)
9. [Step 5 — Flip the URLs](#step-5--flip-the-urls)
10. [Step 6 — Verify](#step-6--verify)
11. [Step 7 — Delete the Vercel bucket](#step-7--delete-the-vercel-bucket)
12. [Rolling back](#12-rolling-back)
13. [⚠️ Mistakes to avoid](#13-️-mistakes-to-avoid)

---

## 1. Should you move at all?

Do not move for tidiness. There is one honest reason and one secondary one.

### The trigger

**Image data transfer approaching 10 GB/month** — the free allowance on Vercel Blob. Visible in
the Vercel dashboard under Usage → Blob.

At roughly 50 KB of images per table page view, 10 GB is about **200,000 page views a month**.
Below that you are paying nothing on either service and the move buys you nothing at all.

Past it:

```
Vercel Blob   $0.05/GB egress   ->   ~$5/month at 100 GB,  ~$50/month at 1 TB
Cloudflare R2 $0 egress, always ->   $0
```

### The secondary reason

You want objects on a domain you control (`img.atno.io`) rather than a Vercel-issued hostname.
R2 makes that straightforward with a custom domain.

### The reason NOT to move

**Storage cost is not a reason.** At ~2 KB per image, even 50,000 images is 100 MB — pennies on
either service, and inside R2's free 10 GB and near Vercel's free 1 GB. If you are moving because
storage looks expensive, re-read the bill: it will be egress.

---

## 2. What actually has to change

Four things. That is the whole list.

| # | Thing | Effort |
| --- | --- | --- |
| 1 | An R2 bucket with public read access | 15 min, in Cloudflare's dashboard |
| 2 | `src/lib/storage/cloudflare-r2.ts` uncommented | 2 min — the file already exists |
| 3 | Four environment variables | 5 min |
| 4 | Copy N objects, then rewrite N rows in `TableImage` | one script, minutes |

**No table rows change. No CSV changes. No component changes.** That is what the id-indirection
bought.

---

## 3. Why this is not a big job

Two design decisions from K-5a do the heavy lifting. Understanding them is what makes the rest of
this document make sense.

### Rows store a key, not a URL

```
row in a table          { "image": "pixabay" }        <- never changes
                                  │
                                  ▼
TableImage              key  "pixabay"
                        url  https://…blob…/a3f9c2.webp   <- only this moves
```

**A table row has never contained a storage URL.** `pixabay` is referenced by 40 rows across
several tables; all 40 keep working through the move because none of them names a host.

Had rows stored URLs, this migration would mean rewriting thousands of rows inside 654 JSON blobs,
each one a chance to corrupt a table. Instead it rewrites **one column in one table**.

### Nothing imports a provider directly

```
routes, components, scripts
            │
            ▼
   src/lib/storage/index.ts        <- the only thing anyone imports
       ├── vercel-blob.ts
       └── cloudflare-r2.ts
```

Every caller uses `put` / `delete` / `exists` from the adapter. Swapping the implementation
changes no call site.

⚠️ **This rule is load-bearing.** If any file ever imports `@vercel/blob` directly, this document
stops being accurate and the migration grows by however many such files exist.

**Check before starting:**

```bash
grep -rn "@vercel/blob" src --include=*.ts --include=*.tsx | grep -v "lib/storage/"
```

Anything listed must be routed through the adapter first.

### And `provider` was on the table from day one

```prisma
provider  String  @default("vercel-blob")
```

⚠️ **This column is what makes a partial migration safe.** Objects can live on both services at
once, each row knowing where its own object is, so the copy does not have to complete before the
site keeps working. Without it the move would be all-or-nothing with a broken window in between.

---

## 4. Before you start

- [ ] Confirm the trigger — check Vercel → Usage → Blob, don't guess
- [ ] Run the `grep` above; it must return nothing
- [ ] Have a Cloudflare account with R2 enabled (needs a card on file even on the free tier)
- [ ] Note how many images you have: `SELECT count(*) FROM "TableImage";`
- [ ] **Do this on the development branch first.** The whole procedure, end to end, including the
      verification step. Production second.

⚠️ **Never edit `.env` to production and run a copy script in the same sitting as local
development work.** This is the exact footgun recorded in `NEW-IMPROVEMENTS.md` §H — switch,
do the one thing, switch back.

---

## Step 1 — Create the bucket and a public URL

1. Cloudflare dashboard → **R2** → **Create bucket**. Name it `atno-table-images`.
2. Choose a location hint near your readers.
3. **Settings → Public access.** Two options:
   - **Custom domain** (recommended) — `img.atno.io`. Cloudflare adds the DNS record; you get a
     domain you own and can point somewhere else later.
   - **r2.dev subdomain** — instant, but rate-limited and explicitly not for production. Fine for
     the development-branch rehearsal only.
4. **Settings → CORS.** Only needed if the browser ever fetches an object with JavaScript; plain
   `<img>` tags do not require it. Skip unless something breaks.
5. **Cache rules.** Objects are content-hashed, so set
   `Cache-Control: public, max-age=31536000, immutable` — same reasoning as `/icons/` in
   `next.config.ts`.
6. **R2 → Manage API Tokens → Create** with **Object Read & Write**, scoped to this one bucket.
   Copy the Access Key ID and Secret — the secret is shown once.

---

## Step 2 — Enable the R2 adapter

The file already exists, commented out, written when Blob was chosen.

```bash
# uncomment the body of:
src/lib/storage/cloudflare-r2.ts
```

It speaks the S3 API, so it needs one dependency:

```bash
npm install @aws-sdk/client-s3
```

⚠️ **`@aws-sdk/client-s3` is not Amazon-specific.** R2 is S3-compatible; the client just needs the
endpoint pointed at Cloudflare. Nothing about this involves an AWS account.

Then add to `.env` (and to Vercel's environment variables — **both**, they are separate):

```bash
STORAGE_PROVIDER="cloudflare-r2"      # leave as "vercel-blob" until step 3
R2_ACCOUNT_ID="…"
R2_ACCESS_KEY_ID="…"
R2_SECRET_ACCESS_KEY="…"
R2_BUCKET="atno-table-images"
R2_PUBLIC_URL="https://img.atno.io"
```

⚠️ **Keep `BLOB_READ_WRITE_TOKEN` in place.** Step 4 reads from Vercel Blob and writes to R2, so
both sets of credentials must be live at once. Remove it only at step 7.

---

## Step 3 — Point new uploads at R2

Set `STORAGE_PROVIDER="cloudflare-r2"` and deploy.

From this moment:

- **New uploads** go to R2 and their `TableImage.provider` records `cloudflare-r2`
- **Existing images** keep serving from Vercel Blob, because their rows still hold Blob URLs
- **Every table on the site keeps working**, mixed across both services

⚠️ **Do not skip to step 4.** Point new writes at the destination first, so the set you have to
copy stops growing while you copy it.

Confirm with one upload through `/admin/images` before continuing. Check the new row:

```sql
SELECT key, provider, url FROM "TableImage" ORDER BY "createdAt" DESC LIMIT 1;
```

`provider` must read `cloudflare-r2` and the URL must be on your R2 domain.

---

## Step 4 — Copy the existing objects

`scripts/migrate-images-to-r2.mjs` — written to be run **more than once safely**.

What it does, per row where `provider = 'vercel-blob'`:

1. `GET` the object from its current URL
2. Verify the bytes — length and content hash — against `TableImage.bytes`
3. `PUT` to R2 under the **same content-hashed object name**
4. Read it back from the public R2 URL and compare bytes
5. Only then update that one row: `url` and `provider`
6. Log every id, before and after

⚠️ **One row at a time, verified before the row is updated.** A batch that copies everything and
then updates everything has a window where a crash leaves rows pointing at objects that were never
written. Per-row means an interruption leaves a mix — which `provider` already models correctly.

⚠️ **Re-running is safe** because it only selects rows still marked `vercel-blob`, and because the
object name is derived from the content hash, so a re-copy overwrites with identical bytes.

**Dry run first:**

```bash
node scripts/migrate-images-to-r2.mjs --dry-run
```

Prints what it would do, writes nothing. Then:

```bash
node scripts/migrate-images-to-r2.mjs
```

Expect roughly a second per hundred small objects. 5,000 images is a few minutes.

---

## Step 5 — Flip the URLs

There is no separate step 5. **Step 4 did it**, one row at a time, each only after its object was
verified in the new location.

This is the deliberate shape: no moment exists where the database claims an object is somewhere it
is not.

---

## Step 6 — Verify

```sql
SELECT provider, count(*) FROM "TableImage" GROUP BY provider;
```

Expect a single row: `cloudflare-r2`. Anything still on `vercel-blob` failed the byte comparison —
re-run the script and read its log; do not update those rows by hand.

Then, and this is the part not to skip:

| Check | How | Expect |
| --- | --- | --- |
| Images render | Open 3 table pages with images | All visible |
| **Most-reused image** | The page using `pixabay` (40 rows) | All 40 render |
| Cache header | `curl -I` an object URL | `immutable, max-age=31536000` |
| Upload still works | Upload one via `/admin/images` | Lands on R2 |
| **Delete still works** | Delete a test image | Gone from the bucket, not just the row |
| Admin usage counts | `/admin/images` | Unchanged from before |
| No mixed content | Browser console on a table page | No blocked requests |

⚠️ **Test delete explicitly.** It is the one adapter method the migration never exercises, so a
broken `delete` in the R2 implementation would sit undetected until someone tried to remove an
image and the object silently stayed in the bucket forever.

---

## Step 7 — Delete the Vercel bucket

**Wait at least a week.** Not for the code — for you, in case something surfaces that the checks
above missed.

Then:

1. Confirm again that no `TableImage` row has `provider = 'vercel-blob'`
2. Vercel dashboard → Storage → the Blob store → delete
3. Remove `BLOB_READ_WRITE_TOKEN` from `.env` and from Vercel
4. `npm uninstall @vercel/blob`
5. **Keep `src/lib/storage/vercel-blob.ts`**, commented out, exactly as `cloudflare-r2.ts` was
   kept. The next move is cheaper for the same reason this one was.

---

## 12. Rolling back

Genuinely easy, at any point before step 7:

| When | How |
| --- | --- |
| Before step 4 | `STORAGE_PROVIDER="vercel-blob"`, redeploy. Nothing was copied. |
| Mid-copy | Stop the script. Mixed state is valid — `provider` is per row. Set the env var back; already-moved images keep serving from R2. |
| After step 4, before step 7 | The Blob objects **still exist**; nothing deletes them. Run the reverse script, or restore `TableImage.url`/`provider` from a snapshot. |
| After step 7 | **No rollback.** The bucket is gone. This is why step 7 waits a week. |

⚠️ **Snapshot `TableImage` before step 4.** It is one small table and it is the only thing that
changes:

```bash
pg_dump "$DATABASE_URL" -t '"TableImage"' > tableimage-before-r2.sql
```

---

## 13. ⚠️ Mistakes to avoid

| ❌ Don't | Why |
| --- | --- |
| **Copy objects before pointing new uploads at R2** | The set you are copying keeps growing while you copy it, and images uploaded mid-migration get missed |
| Update `TableImage.url` in bulk, then copy | Leaves rows pointing at objects that do not exist yet — a visible outage. Per-row, after verification |
| Delete the Vercel store as soon as the script finishes | No rollback, and no time to notice a subtle failure. A week costs nothing |
| Skip the byte comparison | A truncated copy produces a broken image, not an error. The size and hash are already in `TableImage` — use them |
| Forget Vercel's environment variables | `.env` is local only. The deployed site reads Vercel's, and will keep writing to Blob |
| Assume CORS is needed | Plain `<img>` tags do not need it. Adding a wrong CORS policy creates a problem where none existed |
| Use the `r2.dev` URL in production | Rate-limited and documented as not for production. Custom domain |
| Let anything import `@vercel/blob` outside `lib/storage/` | The one rule that keeps this document accurate |
| Run the copy against production while `.env` points at development | Copies the wrong set and updates the wrong database. Switch, do the one thing, switch back |

---

## What this does not cover

**Domain and page icons** stay in `public/icons/` and are unaffected — a deliberately different
decision, recorded in `NEW-IMPROVEMENTS-2.md` §29.6(d) and explained in `ICON-GUIDE.md`. If K-7 is
ever taken and icons move onto the upload path, they inherit this document automatically, because
they would use the same adapter.
