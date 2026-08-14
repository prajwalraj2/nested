# Adding pictures to table rows

How to put a logo, avatar or thumbnail next to a row in a table — a YouTube channel's picture,
a tool's logo, a book's cover.

Written 12 Aug 2026. No prior knowledge assumed.

> **This is not the same as domain and page icons.** Those live in the repository and are
> covered by `ICON-GUIDE.md`. Row images work differently on purpose — see §10 if you want to
> know why.

---

## Contents

1. [What you are actually doing](#1-what-you-are-actually-doing)
2. [Getting the picture](#2-getting-the-picture)
3. [Uploading it](#3-uploading-it)
4. [Turning images on for a column](#4-turning-images-on-for-a-column)
5. [Choosing an image for a row](#5-choosing-an-image-for-a-row)
6. [Doing it in bulk with a CSV](#6-doing-it-in-bulk-with-a-csv)
7. [Changing and removing](#7-changing-and-removing)
8. [⚠️ Mistakes to avoid](#8-️-mistakes-to-avoid)
9. [Troubleshooting](#9-troubleshooting)
10. [Why this is not like the icons](#10-why-this-is-not-like-the-icons)

---

## 1. What you are actually doing

Three steps, and only the first two involve a picture:

| Step | Where | How often |
| --- | --- | --- |
| **A. Upload the image** | `/admin/images` | once per picture, ever |
| **B. Turn images on for a column** | the table's Schema tab | once per table |
| **C. Point rows at images** | the table's Data tab, or a CSV | per row |

**One image serves many rows.** The YouTube logo is uploaded once and used by every table that
needs it — across domains, across pages. That is not an optimisation, it is the design: change
that one picture later and every row using it changes at once.

**Nothing needs a deploy.** Unlike domain icons, everything here happens in the admin.

---

## 2. Getting the picture

Anywhere you are entitled to use it: a channel's avatar, a company's press page, a screenshot
you cropped yourself.

**Do not resize or convert it first.** The server does that — it produces a 64×64 WebP of
about 2 KB whatever you upload. Preparing files by hand is the most tedious step and the
easiest to do inconsistently.

### What to upload

| Format | Use it for |
| --- | --- |
| **PNG** ✅ | Logos, icons, anything cropped. **Keeps transparency**, which is why it is the default answer. |
| **JPG** | Photographs and screenshots with no transparent areas. |
| WebP | Accepted. No advantage — everything is re-encoded anyway. |
| ❌ **SVG** | **Rejected.** See §8 for why. |
| ❌ GIF, HEIC | Animation is invisible at this size; HEIC support is patchy. |

⚠️ **PNG is the default for a reason.** A logo saved as JPG carries a white background, and on
the dark theme that shows as a **white box around the logo**. PNG's transparency survives into
WebP and the picture sits on whatever colour the row is.

**Size:** up to 8 MB is accepted. Anything reasonable is fine — a 3 MB screenshot becomes the
same 2 KB thumbnail as a 40 KB one.

---

## 3. Uploading it

**Admin → System → Images**

Drag files anywhere onto the grid, or press **Upload images**. Several at once is fine.

Each image gets a **key** — a short name that rows use to refer to it. The key comes from the
filename, lowercased with hyphens:

```
Y Combinator.png   →   y-combinator
thefutur.PNG       →   thefutur
Krish Nayak.jpeg   →   krish-nayak
```

### ⚠️ Name it after the picture, not the row

This is the one that causes trouble later, and it is the same rule as `ICON-GUIDE.md` §4.

One image is used by **many** rows, across many tables. Name it `youtube`, not
`graphic-design-youtube-channel-row-3`.

| ✅ | ❌ |
| --- | --- |
| `figma` | `design-tools-figma` |
| `krish-nayak` | `ytube-row-4` |
| `y-combinator` | `startup-books-yc-logo` |

If you name it after a row, the next person needing that logo will not find it and will upload
a near-duplicate. A few rounds of that and the picker fills with variations of the same picture.

**Renaming later is possible but restricted** — see §7.

---

## 4. Turning images on for a column

Images attach to an existing column; they do not get a column of their own. The picture
appears **inside that column's cell, before the text**.

**Admin → Tables → open a table → Schema tab**, then on the column you want:

1. Tick **"Show an image beside this column"**
2. Choose a **Shape**:
   - **Rounded square** — apps, tools, websites, product logos
   - **Circle** — people, YouTube channels, anyone with a face
3. **Save**

Usually the right column is the name column — *Channel Name*, *Course Name*, *Tool*.

> **Why not a column of its own?** A dedicated image column would be mostly empty, would need
> hiding on narrow screens, and would separate the picture from the thing it identifies. Beside
> the name, it reads as one item.

⚠️ **Book covers are not available yet.** A 2:3 portrait cover forces every row in the table to
be taller, so shape and row height are linked. The code is written and switched off; ask if you
need it.

---

## 5. Choosing an image for a row

**Data tab → ⋯ on a row → Edit row.**

Under the column you enabled there is now **"Image beside \<column\>"**. Click it, search, pick.
The **×** beside it removes the image from that row.

Then **Save row**, and ⚠️ **Save the table** — row edits are staged until you save the table
itself. The dialog says so, and it is easy to miss.

**Rows without an image are normal.** They show their text with no gap and no placeholder. You
never have to fill them all in.

---

## 6. Doing it in bulk with a CSV

For a new table, or many rows at once, put the keys in the CSV.

Add a column holding the **key** — not a URL, not a filename:

```csv
Channel Name,Image,Channel Link,Speaking Language
Abi Connick,abi-connick,https://youtube.com/@abiconnick,English
Abris Studio,memoxi,https://youtube.com/@AbrisStudio,Only Music
Adobe Photoshop,,https://youtube.com/@Photoshop,English
```

**The blank row is deliberate** — an empty cell means "no image", which is a valid answer.

### Steps

1. **Turn images on for the column first** (§4). The import cannot offer a destination that
   does not exist yet.
2. **Tables → the table → Import/Export → upload the CSV.**
3. On the mapping screen, point your image column at **"\<Column\> — image key"**.
   ⚠️ It is a separate entry from the column itself — do not map it to the column.
4. Import.

**Naming the CSV column `Image`, `Logo`, `Icon`, `Picture` or `Thumbnail` gets it mapped
automatically.** Check the mapping screen anyway.

⚠️ **Upload the images before importing the CSV.** A key with no matching image imports fine
and shows nothing on the site — no error, no warning. §9 explains how to spot it.

---

## 7. Changing and removing

### Changing which image a row uses
Edit the row, pick a different one. Nothing else to do.

### Changing the picture itself, everywhere
**Images → ⋯ → Replace artwork.** Upload the new file.

**Every row using that key changes at once.** No hunting, no re-pointing, and — unlike the
domain icons — **no `-v2` filename discipline**. The stored file is named after its own
contents, so new artwork is automatically a new address that nobody's browser has cached.

### Renaming a key
**Images → ⋯ → Rename key.**

⚠️ **Refused while any row uses it**, and the message says how many. Rows refer to images *by
name*, with nothing linking them in the database — so renaming a key that 40 rows point at
would leave those 40 rows pointing at nothing, silently. Clear the image from those rows first,
or upload the new artwork under a new key instead.

### Deleting an image
**Images → ⋯ → Delete.**

⚠️ **Also refused while in use**, for the same reason. The **Unused only** filter shows exactly
what is safe to remove.

---

## 8. ⚠️ Mistakes to avoid

| ❌ Don't | What happens |
| --- | --- |
| **Name it after a row** — `courses-row-2` | Nobody finds it later; near-duplicates pile up |
| **Put a URL in the CSV** instead of a key | Imports as text, shows no picture, no error |
| **Import the CSV before uploading the images** | Keys import fine and silently show nothing |
| **Map the CSV image column to the column itself** | Overwrites the row's text with a key |
| **Save the row but not the table** | Row edits are staged; nothing is written |
| **Upload a JPG logo** | White box around it on the dark theme — use PNG |
| **Resize or convert before uploading** | Wasted effort, and inconsistent results |
| **Try to upload an SVG** | Rejected — see below |

### Why SVG is rejected

An SVG is a *document*, not a picture — it can contain scripts. Every other format is decoded
to raw pixels and re-encoded, which destroys anything hidden inside; an SVG served back to
visitors would keep whatever it carried.

That is also why the server re-encodes everything rather than checking files for problems:
**checks can be fooled, re-encoding cannot.** A useful side effect is that camera location data
in phone screenshots is destroyed before the file is ever stored.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| **No picker in the row editor** | The column has no image enabled | §4, then reopen the row |
| **Picker says "Missing: something" in red** | The row names an image that no longer exists — renamed or deleted | Pick a valid one, or re-upload under that key |
| **Uploaded, but the row shows nothing** | The key does not match | Compare the row's key with the Images grid — they must match exactly |
| **Nothing changed on the public page** | Row saved but table not saved, or the 60-second cache | Save the table, then wait a minute |
| **CSV imported, no pictures** | Image column not mapped, or mapped to the column | Re-import and check the mapping screen |
| **White box around a logo** | It was a JPG | Re-upload as PNG |
| **"An image with the key … already exists"** | That key is taken | Use another key, or **Replace artwork** on the existing one |
| **Cannot delete or rename** | Rows still use it | The message says how many; clear those rows first |
| **Image looks stretched** | It should not — pictures are fitted, never cropped | Tell someone; that is a bug |

### Finding rows that point at nothing

`/admin/images` shows a usage count on every image, so anything reading **"Unused"** is safe to
delete. It cannot show the opposite — a row naming an image that was never uploaded — because
there is no record of it. Spotting those means opening the table and looking for rows with no
picture where you expected one.

---

## 10. Why this is not like the icons

Both systems put small pictures on the site, and they work completely differently. The reasoning
is worth knowing, because it explains why the instructions differ.

| | **Domain & page icons** | **Table row images** |
| --- | --- | --- |
| Where they live | In the code repository | In cloud storage |
| How many | Around 30 | Potentially thousands |
| Adding one | Edit files, commit, deploy | Drag onto a screen |
| Who can | Someone with the repository | Anyone with an admin login |
| Changing artwork | New filename, re-point everything | Replace, and every row follows |
| Guide | `ICON-GUIDE.md` | this one |

**Icons are structure; row images are data.** An icon belongs to a domain or a page and changes
perhaps twice a year. A row image arrives whenever you import a CSV. Putting those in the
repository would make **every content update a deploy**, and every deleted picture would stay
in the project's history forever.

The decision, and the full reasoning behind it, is recorded in `NEW-IMPROVEMENTS-2.md` §29.6(d).

---

**Related:** `ICON-GUIDE.md` (domain and page icons) · `NEW-IMPROVEMENTS-2.md` §29 (the table
work and why it is built this way) · `BLOB-TO-R2-MIGRATION.md` (moving the stored files, if that
ever happens)
