# Domain and page icons

Every SVG in this folder becomes selectable in the admin panel, on the Domain form and the
Page form. Drop a file in, commit, push — that is the whole workflow.

This file also keeps the folder in git, which does not track empty directories.

---

## Adding an icon

1. Get the SVG.
   - **Brand logos** — <https://simpleicons.org>, then *Download coloured SVG* from the icon's
     menu. The plain download is monochrome; the coloured one is what you want.
     ⚠️ Simple Icons does **not** have LinkedIn — it was removed on trademark grounds. Source
     that one from LinkedIn's own brand resource page.
   - **Anything else** — wherever you like, as long as you are entitled to use it.
2. Name it `lowercase-with-hyphens.svg`. The filename becomes the id stored in the database,
   so it should describe the icon and not the page: `youtube.svg`, not `youtube-channels.svg`,
   because one icon serves many pages.
3. Drop it in this folder.
4. `git add . && git commit && git push`. Vercel deploys it.
5. It now appears in the icon picker in the admin panel.

`src/lib/icon-manifest.ts` is regenerated automatically at build time from whatever is in here,
so there is no list to keep in step.

---

## Rules

**SVG only.** Vector, so one file is sharp at every size and on every screen, and no
second file is needed for high-density displays.

**10 KB maximum.** `scripts/generate-icon-manifest.mjs` **fails the build** if any file exceeds
it — an oversized icon cannot slip in unnoticed. For scale, real coloured brand logos measure
418–2,116 bytes. If something is over the limit it is almost certainly a raster image that has
been wrapped in an SVG, or a logo carrying far more detail than is visible at 20 pixels.

**Changing an icon means a NEW FILENAME.** `next.config.ts` serves this folder with
`Cache-Control: immutable, max-age=31536000`, so a browser that has fetched `youtube.svg` will
keep it for a year and never ask again. Overwriting the file in place will not reach anyone who
has already seen it. Add `youtube-v2.svg` and re-point the affected rows instead.

**Deleting an icon is not automatic.** Rows in the database still reference it by id. Clear the
icon on those domains and pages first, or the picker will show a value it cannot resolve.

---

## Why files here rather than uploads

Recorded in full in `NEW-IMPROVEMENTS.md` §27.5. In short: icon additions are rare — 41 domains
in about a year, and 395 distinct page titles across 1,216 pages, so new pages overwhelmingly
reuse icons that already exist. An upload pipeline exists to make frequent, unpredictable
additions easy, which is the opposite of this situation.

Files here are also **faster**: they are served from `atno.io` itself, so they ride the
connection the page has already opened. A separate storage service is a different origin, which
forces DNS, TCP and TLS before the first byte — 100–300 ms on a cold load.

Uploads are deferred, not rejected (§27.8 / Phase J-4). Both approaches store a URL, so adding
them later needs no migration and no change to any render site.
