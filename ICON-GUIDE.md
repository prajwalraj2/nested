# Adding an icon to a Domain or a Page

How to put a real logo — YouTube, Reddit, LinkedIn — next to a domain or page instead of an
emoji, from a completely fresh start.

Written 10 Aug 2026. No prior knowledge of this codebase assumed. If you have never cloned a
repository before, start at §2 and follow it literally.

---

## Contents

1. [What you are actually doing](#1-what-you-are-actually-doing)
2. [One-time setup](#2-one-time-setup)
3. [Getting the icon file](#3-getting-the-icon-file)
4. [Naming the file](#4-naming-the-file) ← the part people get wrong
5. [Adding it to the project](#5-adding-it-to-the-project)
6. [Using it in the admin panel](#6-using-it-in-the-admin-panel)
7. [⚠️ The emoji trap](#7-️-the-emoji-trap) ← read this one properly
8. [Mistakes to avoid](#8-mistakes-to-avoid)
9. [Changing, replacing or removing an icon later](#9-changing-replacing-or-removing-an-icon-later) ← replacing artwork has a trap
10. [Troubleshooting](#10-troubleshooting)
11. [Quick reference](#11-quick-reference)

---

## 1. What you are actually doing

Two separate steps, and they happen in **two different places**:

| Step | Where | Who can do it |
| --- | --- | --- |
| **A. Add the icon file** to the project | your computer → GitHub | someone with the repository |
| **B. Point a domain or page at it** | the admin panel at `/admin` | anyone with an admin login |

Step A is a code change and needs a deploy (about 90 seconds, automatic). Step B is instant.

**You only do step A once per icon.** The YouTube logo is added once and then used by as many
pages as you like — a page under Graphic Designing and one under UI/UX Designing both point at
the same file.

> **Why not just upload from the admin panel?** Because icons are added rarely — roughly 30 of
> them in total — and an upload feature means a storage service, an upload endpoint, file-type
> and size checks, and security work, all to save one `git push`. The decision and its reasoning
> are recorded in `NEW-IMPROVEMENTS.md` §27.5. If adding icons ever becomes frequent, that
> section explains how to add uploads later without changing anything else.

---

## 2. One-time setup

Skip this if you already have the project on your machine.

**You need:** [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org) (version 20
or newer).

```bash
git clone <the repository URL>
cd nested-app
npm install
```

`npm install` takes a couple of minutes the first time.

To see your changes locally before pushing:

```bash
npm run dev
```

Then open <http://localhost:3000>. Press `Ctrl+C` in the terminal to stop it.

---

## 3. Getting the icon file

### For a brand logo (YouTube, Reddit, Instagram, Discord…)

Go to **<https://simpleicons.org>** and search for the brand.

⚠️ **Use *Download coloured SVG*, not the plain download.** Click the icon, open the menu
(the ☰ in the corner of the popup) and choose **Download coloured SVG**. The plain download is a
single-colour silhouette — on a dark background it often disappears entirely.

⚠️ **LinkedIn is not on Simple Icons.** It was removed after a trademark request and is not
coming back. Get it from LinkedIn's own brand page instead. Any brand may disappear this way, so
if a logo is missing, that is why — the site is not broken.

### For anything else (Blockchain, AI/ML, Entrepreneurship…)

Anywhere you are entitled to use the image. Good sources for free SVGs:

- <https://lucide.dev> — plain, consistent line icons
- <https://icones.js.org> — a searchable front-end for many icon sets
- <https://www.svgrepo.com>

**Check the licence.** Most are free for any use; a few require attribution.

---

## 4. Naming the file

The filename **becomes the name you pick in the admin panel**, so it matters.

### The rules

| Rule | Good | Bad |
| --- | --- | --- |
| Lowercase only | `youtube.svg` | `YouTube.svg` |
| Hyphens between words, never spaces or underscores | `google-chrome-extension.svg` | `google chrome extension.svg`, `google_chrome_ext.svg` |
| `.svg` extension | `reddit.svg` | `reddit.png` |
| Name the **icon**, not the page | `youtube.svg` | `youtube-channels-for-graphic-design.svg` |

### ⚠️ Name the icon, not the page — this is the one that causes trouble

One icon is used by **many** pages. "YouTube Channels" exists under a dozen different domains,
and they all use the same file.

If you name it `graphic-design-youtube.svg`, the next person adding a YouTube icon to UI/UX
Designing will not realise it already exists and will add a near-duplicate. Do that a few times
and the picker fills with variations of the same logo.

**Name it after what the picture is:** `youtube.svg`, `reddit.svg`, `blockchain.svg`.

### Brand capitalisation

The admin panel generates a display name from the filename, so `youtube.svg` shows as
**"Youtube"** — not how the brand writes it. That is cosmetic, but if it bothers you, add one
line to `scripts/generate-icon-manifest.mjs`:

```js
const LABEL_OVERRIDES = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  ted: 'TED',
  youtube: 'YouTube',
  // add yours here
};
```

There is no rule that recovers `YouTube` from `youtube`, which is why this list exists.

---

## 5. Adding it to the project

### Step 1 — get the latest code

```bash
git checkout dev-3.0
git pull
```

⚠️ **Do not skip the `git pull`.** Working from an old copy is how you end up overwriting
someone else's work.

### Step 2 — put the file in the folder

Drop your `.svg` into:

```
public/icons/
```

That is the only place it can go. There is a `README.md` in that folder repeating these rules.

### Step 3 — check the size

An icon should be **under 10 KB**. Real brand logos are 400 bytes to 2 KB.

You do not have to check by hand — the project checks for you, and **refuses to build** if a
file is too big:

```
✗ Icon size limit exceeded — build stopped.

    public/icons/blockchain.svg  247.8 KB  (limit 10 KB)
```

If you see that, the file is almost certainly a photograph or a screenshot that has been wrapped
in an SVG. Find a proper vector version.

### Step 4 — look at it (optional but recommended)

```bash
npm run dev
```

Open <http://localhost:3000/admin/domains>, edit any domain, and open the **Icon** dropdown. Your
new icon should be in the list. Close the dropdown without saving.

### Step 5 — commit and push

```bash
git add public/icons/
git commit -m "Add the Blockchain icon"
git push
```

The site rebuilds automatically. Give it about 90 seconds.

You do **not** need to update any list of icons — the project reads the folder at build time and
generates that list itself.

---

## 6. Using it in the admin panel

Once the deploy finishes:

### For a domain

1. Go to **`/admin/domains`**
2. Find the domain → **⋯** → **Edit**
3. Scroll to **Icon** → open the dropdown → search → pick yours
4. ⚠️ **Remove the emoji from the Name field** — see §7
5. **Save**

### For a page

1. Go to **`/admin/pages`**
2. Pick the domain from the selector at the top
3. Find the page in the tree → **⋯** → **Edit page**
4. Scroll to **Icon** → pick yours
5. ⚠️ **Remove the emoji from the Title field** — see §7
6. **Save**

The icon now appears on the public site: on `/domain`, in the sidebar, in its section, and as
the large icon beside the page's heading.

---

## 7. ⚠️ The emoji trap

**This is the mistake almost everyone makes the first time.**

Most domain names and page titles have the emoji **inside the text**:

```
Title:  🖌️ Graphic Designing
```

That ✏️ is not a setting — it is a character in the title, like a letter.

So if you add an icon and change nothing else, the visitor sees **both**:

```
[🔵 Facebook logo]  🖌️ Graphic Designing
```

**The fix:** when you set an icon, delete the emoji from the Name/Title field in the same edit.

```
Before:   Title: 🖌️ Graphic Designing      Icon: (none)
After:    Title: Graphic Designing         Icon: facebook
```

The form reminds you — once an icon is chosen, the help text under it changes to
*"Remove any emoji from the title above, or both will show."*

### The reverse also works

Leave the Title alone and set **no** icon, and the emoji keeps working exactly as before. You do
not have to convert anything. Add icons to the handful of pages that deserve a real logo and
leave the rest.

---

## 8. Mistakes to avoid

| ❌ Don't | Why | ✅ Instead |
| --- | --- | --- |
| Name it after the page (`gdesign-youtube.svg`) | One icon serves many pages; page-specific names cause duplicates | Name the picture: `youtube.svg` |
| Use spaces or underscores | Breaks the naming convention and reads badly in the picker | `google-chrome-extension.svg` |
| Upload a big PNG | 20 icons at 500 KB is 10 MB on one page | SVG, under 10 KB |
| Use the plain (monochrome) Simple Icons download | Often invisible on a dark background | **Download coloured SVG** |
| **Overwrite an existing icon file with new artwork** | Browsers cache these for a year — people who visited before keep the old picture, while you and every new visitor see the new one | Follow the five steps in §9 — new filename, re-point the rows, then delete |
| Delete an SVG that pages still use | Those pages reference a file that no longer exists | Clear the icon on those pages first (§9) |
| Set an icon and leave the emoji in the title | Two icons side by side | Delete the emoji in the same edit (§7) |
| Edit `src/lib/icon-manifest.ts` by hand | It is generated; your edit is overwritten at the next build | Just add the file — the list rebuilds itself |
| Put the SVG anywhere other than `public/icons/` | The project only looks there | `public/icons/` |

---

## 9. Changing, replacing or removing an icon later

### Swapping an icon on a page

Just edit the page and pick a different one. Nothing else to do.

### Removing an icon

Edit the page and press the **×** next to the icon picker → Save. It goes back to showing the
emoji in the title — so if you deleted the emoji when you set the icon, put it back, or the row
will have neither.

### Replacing the artwork of an existing icon

*"We already have `youtube.svg`, but YouTube changed their logo / ours looks wrong. I want a new
picture, still called YouTube."*

This is the one job in this whole guide where **the obvious approach is the wrong one.**

#### ⚠️ Why you cannot just overwrite the file

The obvious move — download the new logo, save it over `public/icons/youtube.svg`, push — looks
like it works. You reload the site and see the new logo, so you assume it is done.

**It is not.** Icons are served with this instruction to the browser:

```
Cache-Control: public, max-age=31536000, immutable
```

`31536000` seconds is **one year**, and `immutable` means *"never even ask whether this changed"*.
So a browser that has ever loaded `youtube.svg` will keep showing the **old** picture, from its
own disk, without contacting the site at all — for up to a year.

That gives you the worst possible outcome: **the site is split.** New visitors see the new logo.
Everyone who has been there before sees the old one. You see the new one, because you cleared
your cache while testing, so it looks fixed from where you are sitting.

> This is not a bug or an oversight — the long cache is *why* icons load instantly and cost
> nothing on repeat visits. It is a deliberate trade, and the price of it is exactly this: **the
> content at a given icon URL must never change.** A new picture is a new URL.

#### ✅ The correct way — five steps

Replacing `youtube.svg` with new artwork, start to finish:

---

**Step 1 — Find out who is using it.** Do this *first*; it tells you how much work step 4 is.

```bash
node scripts/find-icon-usage.mjs youtube
```

```
icon "youtube" — 1 domain(s), 2 page(s)

DOMAINS  (edit at /admin/domains)
  YouTuber   /domain/youtuber

PAGES  (edit at /admin/pages — pick the domain first)
  YouTube Channel    in Graphic Designing  (/ytube)
  YouTube Channels   in 😊 UI/UX Designing  (/ytube)

file: public/icons/youtube.svg exists
```

**Write this list down.** It is the checklist for step 4, and there is no screen in the admin
that will give it to you again once you are halfway through.

> Run with no argument — `node scripts/find-icon-usage.mjs` — to see every icon, how many rows
> use it, and which files nothing points at.
>
> ⚠️ It prints which **database** it read at the top. Development and production hold different
> rows, so the answer differs between them. Run it against the one you are about to change.

---

**Step 2 — Add the new artwork under a NEW name.**

Get the new logo (§3) and save it as a *different* file:

```
public/icons/youtube.svg       ← leave this exactly as it is, for now
public/icons/youtube-2026.svg  ← the new artwork
```

Suffix suggestions: the year (`youtube-2026.svg`) or a version (`youtube-v2.svg`). Either is
fine — it only has to be different and to read sensibly in the picker. Same rules as always:
lowercase, hyphens, `.svg`, under 10 KB.

⚠️ **Do not touch `youtube.svg` in this step.** While it still exists, everything that points at
it keeps working. That is what makes this whole process safe to do slowly, or to abandon halfway
through with nothing broken.

---

**Step 3 — Commit, push, and wait for the deploy.**

```bash
git add public/icons/youtube-2026.svg
git commit -m "Add updated YouTube icon"
git push
```

Wait roughly 90 seconds. **The new icon must exist on the live site before step 4** — you cannot
select it in the admin until it does.

---

**Step 4 — Re-point each row from your step-1 list.**

For every domain and page you wrote down:

1. Open it in the admin (`/admin/domains` or `/admin/pages` → ⋯ → Edit)
2. Open the **Icon** dropdown
3. Pick **YouTube 2026** instead of **YouTube**
4. **Save**

Each save is instant and independent. Half-finished is not broken — some rows show the new logo,
the rest still show the old one, and both are real files.

**Check your work:**

```bash
node scripts/find-icon-usage.mjs youtube
```

```
icon "youtube" — 0 domain(s), 0 page(s)
Nothing uses it. The file can be replaced or deleted freely.
```

⚠️ If that still lists rows, **you missed some — do not go to step 5.** Deleting the file now
would leave those rows with no icon at all.

---

**Step 5 — Delete the old file.**

Only once step 4 reports zero uses:

```bash
git rm public/icons/youtube.svg
git commit -m "Remove superseded YouTube icon"
git push
```

Done. Every row shows the new logo, and no visitor is stuck on a cached old one — because they
are looking at a URL their browser has never seen before.

---

#### The whole thing at a glance

```
1.  node scripts/find-icon-usage.mjs youtube      ← write the list down
2.  add public/icons/youtube-2026.svg              ← NEW name; leave the old file alone
3.  commit, push, wait ~90s                        ← must be live before step 4
4.  re-point every row in the admin                ← then re-run step 1 to confirm 0 uses
5.  git rm public/icons/youtube.svg                ← only after it reports 0
```

#### ⚠️ Common mistakes when replacing an icon

| ❌ Don't | What happens |
| --- | --- |
| Overwrite `youtube.svg` in place | Returning visitors keep the old logo for up to a year. The site shows two different logos to two different people, indefinitely. |
| Check with a hard refresh and conclude it works | A hard refresh bypasses *your* cache. It tells you nothing about anyone else's. |
| Delete the old file before re-pointing the rows | Those rows show no icon at all until you fix them one by one. |
| Skip step 1 and re-point "the ones you remember" | The rows you forget are the ones nobody looks at — so nobody reports them, and they stay wrong. |
| Re-point rows before the deploy finishes | The new icon is not in the dropdown yet, and you conclude the upload failed. |

#### When overwriting *is* acceptable

Two cases, and only these:

- **Nobody has seen it yet.** You added `blockchain.svg` an hour ago, noticed it is the wrong
  shade, and the deploy has not gone out. Overwrite freely.
- **`find-icon-usage.mjs` reports 0 uses** and the file is not live yet.

If the icon has been on the public site for any real length of time, use the five steps.

### Deleting an icon file

Only after nothing uses it. If a page still references a deleted icon:

- the public site simply shows no icon (it does **not** break, and there is no broken-image box)
- the admin picker shows **"Missing icon: youtube"** in red so you can find and fix it

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| The build fails with *"Icon size limit exceeded"* | The SVG is over 10 KB | Get a proper vector version; a wrapped photo will not do |
| My icon is not in the dropdown | The deploy has not finished, or the file is not in `public/icons/`, or it is not `.svg` | Wait ~90 s; check the folder and extension |
| Locally it is missing but the file is there | The dev server has not regenerated the list | Stop with `Ctrl+C` and run `npm run dev` again |
| **Two icons show on the public page** | The emoji is still in the Name/Title | Remove it (§7) |
| The icon shows in lists but not on the page heading | Nothing — this was a real bug, fixed 10 Aug 2026 | Make sure you are on the latest code |
| A domain's page shows the old emoji after I edited the domain | Fixed 10 Aug 2026. The heading used to read the hidden `__main__` page rather than the domain | Update to the latest code |
| The icon is invisible on the dark theme | You used the monochrome download; it is dark-on-dark | Re-download as **coloured SVG** |
| The picker says *"Missing icon: something"* | The SVG was deleted while rows still used it | Put the file back, or clear the icon on those rows |

---

## 11. Quick reference

```
FILE
  format     SVG only
  size       under 10 KB (build fails otherwise)
  name       lowercase-with-hyphens.svg
  names the  ICON, not the page          youtube.svg  ✓
                                          gdesign-youtube.svg  ✗
  location   public/icons/

GETTING ONE
  brands     simpleicons.org → "Download coloured SVG"
             (LinkedIn is not there — use LinkedIn's brand page)
  others     lucide.dev · icones.js.org · svgrepo.com

ADDING IT
  git checkout dev-3.0 && git pull
  cp your-icon.svg public/icons/
  git add public/icons/ && git commit -m "Add X icon" && git push
  wait ~90 seconds

USING IT
  /admin/domains → Edit → Icon        (and delete the emoji from Name)
  /admin/pages   → Edit page → Icon   (and delete the emoji from Title)

REPLACING AN ICON'S ARTWORK          (full steps in section 9)
  1  node scripts/find-icon-usage.mjs youtube    write the list down
  2  add public/icons/youtube-2026.svg           NEW name; keep the old file
  3  commit, push, wait ~90s
  4  re-point every row in the admin             re-run step 1: must say 0 uses
  5  git rm public/icons/youtube.svg

NEVER
  overwrite a live icon file       → 1-year browser cache; old visitors keep
                                     the old picture. Use the 5 steps above.
  delete before re-pointing rows   → those rows show no icon at all
  edit src/lib/icon-manifest.ts    → it is generated
```

---

**Related:** `public/icons/README.md` for the short version, and `NEW-IMPROVEMENTS.md` §27 for
why the system is built this way — including the measurements behind the size limit, why files
live in the repository rather than a storage service, and what adding uploads would involve.