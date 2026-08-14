# CSV examples — tables with row images

Three importable CSVs showing how to put a picture next to a row. Full instructions are in
**`TABLE-IMAGES-GUIDE.md`**; these are the files to look at while reading it.

| File | Shows |
| --- | --- |
| `1-creators-circle-images.csv` | People and channels — **circle** images. This is the exact file used to build the `Demo · Row Images` table. |
| `2-tools-square-images.csv` | Apps and products — **rounded square** images, with a badge column and quoted text containing commas. |
| `3-minimal-name-and-image.csv` | The smallest thing that works: **two columns**. |

---

## The one rule that matters

**The `Image` column holds a KEY, not a URL and not a filename.**

```csv
Creator,Image
Krish Nayak,krish-nayak        ✅ the key from /admin/images
Krish Nayak,krish-nayak.png    ❌ a filename
Krish Nayak,https://…/x.webp   ❌ a URL
```

The key is what `/admin/images` shows under each picture. One key can be used by as many rows
as you like — that is the point of it.

---

## Before importing any of these

⚠️ **The images must already exist**, with these exact keys:

```
figma   thefutur   y-combinator   nate-hersk   some-name
coreyshafer   memoxi   krish-nayak   71uai28kjul-uf1000-1000-ql80
```

A key with no matching image **imports without complaint and shows nothing** — no error, no
broken picture. If a row comes in blank, that is almost always why.

Upload anything missing at **Admin → System → Images** first, or edit the CSV to use keys you
do have.

---

## How to import one

1. **Create the table** and, on its **Schema** tab, tick **"Show an image beside this column"**
   for the name column. Pick *Circle* for file 1, *Rounded square* for file 2.
   ⚠️ Do this first — the import cannot offer a destination that does not exist yet.
2. **Import/Export → upload the CSV.**
3. On the mapping screen, point the `Image` (or `Logo`) column at **"\<Column\> — image key"**.
   ⚠️ It is a **separate entry** from the column itself. Mapping it to the column would
   overwrite the row's text with a key.
4. Import, then **save the table**.

Headers named `Image`, `Logo`, `Icon`, `Picture` or `Thumbnail` are mapped automatically —
check the screen anyway.

---

## Things these files deliberately demonstrate

**Every file has a row with no image.** That is a normal, supported state: the row shows its
text with no gap and no placeholder. You never have to fill them all in.

**File 2 quotes fields containing commas** — standard CSV, but easy to get wrong when writing
one by hand:

```csv
Figma,figma,https://www.figma.com,Free Plan Available,"Collaborative interface design, in the browser.",ALL
```

**File 2 reuses `y-combinator` and `thefutur`**, which file 1 also uses. Import both and
`/admin/images` will show those images used by rows in **two different tables** — that is the
reuse the whole design exists for, and why replacing one picture updates every row at once.

**`Target Countries`** appears in files 1 and 2 because tables carry it for geo-filtering.
`ALL` means everyone. File 3 omits it, and the import fills in `ALL` on its own.

---

## The `71uai28kjul-uf1000-1000-ql80` key is a bad example on purpose

It came from an Amazon image filename, and it shows exactly what to avoid: nobody can search
for it, nobody can guess it, and nobody will reuse it — so the next person needing that picture
uploads it again under a different name.

**Name an image after what the picture is** — `figma`, `y-combinator`, `krish-nayak` — never
after where you got it or which row wanted it. `TABLE-IMAGES-GUIDE.md` §3 covers this.
