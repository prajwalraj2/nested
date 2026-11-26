# Categories — the complete guide

**Admin → Categories** (`/admin/categories`)

A category is a **heading in the Domains menu**. It holds no content of its own: its only job is to
group domains and decide where that group sits in the menu grid.

There are three things a category controls, and nothing else:

| | |
| --- | --- |
| **Its name and icon** | The heading a visitor reads in the menu |
| **Where it sits** | Which column, and which row inside that column |
| **Whether it appears at all** | The Active switch |

---

## 1. What a category is *not*

⚠️ **It is not a URL.** There is no `/category/design` page. A category never appears in an address
bar; it exists only as a heading inside the Domains dropdown and on `/domain`.

⚠️ **A category's slug is required but almost invisible.** It must be unique and it must be
lowercase letters, numbers and hyphens only — but nothing routes to it today. Give it something
sensible (`design`, `development`) and move on.

⚠️ **The Description field is admin-only.** Verified: it renders on the category's own card in
Admin → Categories and **nowhere on the public site**. Treat it as a note to yourself — "what
belongs in this category" — not as visitor-facing copy.

---

## 2. Creating a category

**Admin → Categories → New category.**

| Field | Rule |
| --- | --- |
| **Name** | Required. Free text. `&` and `\|` are fine — "Design & Creative", "AI \| ML \| DL" |
| **Slug** | Required, **unique**, lowercase letters/numbers/hyphens only |
| **Icon** | Optional. ⚠️ **An emoji, typed directly** — 🎨 💻 🎬. *Not* an icon from the icon picker |
| **Description** | Optional. See the warning above |
| **Column** | 1, 2 or 3 |
| **Row** | The position inside that column |
| **Active** | On by default |

⚠️ **The icon field here is an emoji, unlike domains and pages.** Domains and pages use
`public/icons/` ids through a picker (see `ICON-GUIDE.md`). Categories take a literal emoji
character. If you paste an icon id like `youtube` into a category, you will see the word
"youtube" in the menu.

### Slug rules, exactly

```
allowed:   design   web-dev   ai-ml   3d-tools
rejected:  Design   web_dev   ai/ml   web dev   café
```

An invalid slug returns **"Slug must contain only lowercase letters, numbers, and hyphens"**. A
duplicate returns **409 — "A category with this slug already exists"**.

---

## 3. ⚠️ Column and Row — the part that bites

The Domains menu is a **3-column grid**. A category occupies one cell: `Column 2, Row 1`.

### One cell holds one category

If you try to create or move a category into a cell that is already taken, the save is **refused**
with a message naming the occupant:

> *Row 2 of column 1 is already taken by "Development & Tech". Pick a different row, or move that
> category first.*

⚠️ **This is a refusal, not a swap.** Nothing is reordered for you. To exchange two categories you
move one out to a free row, move the second into the vacated cell, then move the first into place.
Three saves, in that order.

### Rows are a grid, not a list

Row numbers line up **across** columns, not just down them. `Row 1` in all three columns forms one
horizontal band in the rendered menu.

```
          Column 1              Column 2              Column 3
Row 0   Design & Creative     Development & Tech    Business
Row 1   Photography           AI & Data             (empty)
Row 2   Video                 (empty)               Marketing
```

⚠️ **A gap renders as a gap.** `Row 1, Column 3` being empty above leaves a visible hole in the
menu, because the layout reserves the cell. If the menu looks oddly spaced, look for a missing row
number rather than a CSS problem.

⚠️ **Leaving Row blank is not the same as choosing one.** Omit it and the category is appended to
the bottom of its column. That is fine for a new category and wrong if you meant to slot it into a
specific band.

---

## 4. Editing a category

Everything is editable at any time, including the slug.

⚠️ **Renaming a category is safe. Re-columning it is what changes the menu.** The name is only a
label; Column and Row decide layout, and a careless change there shuffles what a visitor sees on
every page of the site.

⚠️ **Changing the slug is harmless *today* and may not stay that way.** Nothing routes to a
category slug at the moment. If category pages are ever added, an old slug becomes a dead URL. Treat
it as you would a domain slug: set it once, leave it alone.

---

## 5. Deactivating vs deleting

### Deactivate — the reversible one

Turn **Active** off. The category and **every domain inside it** disappear from the menu. Nothing is
destroyed; turn it back on and everything returns.

⚠️ **Deactivating a category hides its domains even when those domains are Live.** This is the most
common "why did my domain vanish" cause, because the domain itself still says Live in the domains
list. The domain's own status and its category's Active switch are two independent gates and
**both** must be open.

⚠️ **Use this, not delete, for anything temporary.** Seasonal groupings, a section you are still
building, a category you want off the menu for a week.

### Delete — and why it usually refuses

⚠️ **A category holding any domain CANNOT be deleted.** The API refuses with **409**:

> *Cannot delete category. It contains 7 domain(s). Please reassign or remove the domains first.*

This is deliberate, and it is the one place the system protects you from yourself: deleting a
category with domains in it would leave those domains with no category, which is a state the menu
cannot render.

**To actually delete a category:**

1. Open **Admin → Domains**
2. Filter by that category to see exactly what is in it
3. Edit each domain and move it to a different category
4. Return to Categories and delete

⚠️ **There is no bulk reassign.** With 20 domains in a category that is 20 edits. Deactivating is
almost always the better answer.

---

## 6. Do / Don't

**Do**

- Use an **emoji** in the Icon field, not an icon id
- Decide Column and Row deliberately — they are layout, not metadata
- **Deactivate** rather than delete for anything you might want back
- Check for a wrong Row number before blaming the menu's spacing
- Keep names short. They are headings in a dropdown, not sentences

**Don't**

- Don't expect a category to have its own page or URL
- Don't paste an icon id (`youtube`) where an emoji belongs
- Don't try to swap two categories in one move — the second save will be refused
- Don't delete a category to hide it; that is what Active is for
- Don't assume a hidden domain is the domain's fault — check its category's Active switch first

---

## 7. Troubleshooting

| Symptom | Cause |
| --- | --- |
| **"Slug already exists"** | Another category has it. Slugs are unique across all categories |
| **"Row N of column M is already taken"** | One cell, one category. Move the occupant first |
| **"Cannot delete category. It contains N domain(s)"** | Working as intended. Reassign them, or deactivate instead |
| **A Live domain is missing from the menu** | Its category is probably inactive. Both gates must be open |
| **The menu has an odd gap** | A row number is skipped. Empty cells are rendered, not collapsed |
| **The category shows the word "youtube"** | An icon id was pasted where an emoji belongs |
| **The icon picker has nothing useful** | Categories do not use the picker at all — type an emoji |

---

## Related

| | |
| --- | --- |
| `DOMAIN-GUIDE.md` | Domains live inside categories |
| `PAGE-GUIDE.md` | Pages live inside domains |
| `ICON-GUIDE.md` | The icon picker — for **domains and pages**, not categories |
