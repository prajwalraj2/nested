# Pages — the complete guide

**Admin → Pages** (`/admin/pages?domain=…`)

A page is **one URL with one kind of content**. Pick a domain at the top of the screen, and the tree
below shows every page in it.

```
/domain/photography/courses          a page in a Direct domain
/domain/webdev/withcode/courses      a page in a Hierarchical domain
```

---

## 1. Creating a page

**Admin → Pages → New page.**

| Field | Rule |
| --- | --- |
| **Title** | Required. Free text |
| **URL slug** | Required, lowercase letters/numbers/hyphens, unique **within the same parent** |
| **Content type** | Required — ⚠️ **see section 3** |
| **Parent page** | Root level, or nested under another page |
| **Icon** | Optional. An icon **id** from the picker |
| **Description** | Optional. One line under the heading |
| **Search description** | Optional. The Google snippet |
| **Target countries** | Defaults to All countries |
| **Status** | ⚠️ **Defaults to Live** |

⚠️ **Pages default to LIVE — the opposite of domains.** A page is public the moment you create it.
This is intentional (a page inside an already-live domain is normally meant to be seen) but it means
**a half-built page is immediately reachable.** Set it to Draft first if you are not ready.

⚠️ **Slugs are unique per parent, not per domain.** Two different parents can each have a `courses`
child. A clash within the same parent is refused with **409**.

⚠️ **Changing a slug breaks every link to that page.** No redirects exist. Set it once.

---

## 2. ⚠️ `__main__` — the hidden page you must not touch

Every **Direct** domain has a page with the slug `__main__`. It is created automatically and it
holds the **section layout for the domain's root page**.

**What is special about it:**

| | |
| --- | --- |
| **The slug is read-only** | The field is disabled in the form. The API refuses to change it |
| **It cannot be deleted** | The API returns *"Cannot delete the main page"* |
| **Its Status is fixed at Live** | The form shows a note instead of a picker |
| **Its Title is ignored publicly** | The domain root's heading is the **domain's** name |

⚠️ **Editing `__main__`'s Title, Icon or Description changes nothing on the public site.** The
domain root reads all three from the **domain**, not from this row. This is the single most common
"I saved it and nothing happened" report. To change what the root shows, edit the **domain**.

⚠️ **Never set `__main__`'s Parent page to anything.** Its parent is `null` because it *is* the
root. Making it its own parent once **detached two entire domains** — 43 rows still in the database,
`/domain/gdesign` returning 404, and the admin showing "No pages yet". The form now guards against
it, but do not go looking for a way round the guard.

**What `__main__` is actually for:** open **Admin → Section Layout** to arrange the blocks that
appear on the domain's root page. That is the only reason to interact with it.

---

## 3. Content types — pick carefully

| Type | What it renders | Set up where |
| --- | --- | --- |
| **Section based** | A grid of section headings, each linking to child pages | Admin → Section Layout |
| **Subcategory list** | A chooser listing this page's children | Nothing — it lists children automatically |
| **Table** | Rows and columns, sortable and filterable | Admin → Tables |
| **Rich text** | Long-form written content | Admin → Rich Text |
| **Roadmap** | A step-by-step path with expandable topics | Admin → Roadmaps |
| **Narrative** | Story-style flow | ⚠️ See the warning below |
| **Mixed content** | A combination | Rarely used |

⚠️ **Changing the content type does not move your content.** Each type stores its data in a
different place. Switch a Table page to Rich text and the table rows are still in the database,
still attached — but the page now renders an empty rich-text body. Switch back and they reappear.
**Nothing is lost, but nothing is converted either.**

⚠️ **A page whose content has not been created yet renders a placeholder, not an error.** A Table
page with no table, or a Roadmap page with no roadmap, shows a "Coming soon" style box. That is a
real state, not a bug — but it is also public if the page is Live.

⚠️ **Avoid Narrative.** It is the fallback for any unrecognised type, and it has a known bug: its
heading is hardcoded to a near-black colour, so it is **effectively invisible in dark mode**.
Tracked in `OPEN-ITEMS.md` §3c.

---

## 4. Parents and nesting

The Parent page dropdown decides the URL and where the page appears.

### In a Direct domain

Top-level content pages are parented to **`__main__`**, which is the form's default — and that
default is correct. `__main__` is skipped in the URL:

```
__main__  →  courses        →  /domain/photography/courses
```

### In a Hierarchical domain

Top-level pages sit at **Root level (no parent)** and become the subcategories:

```
withcode  →  courses        →  /domain/webdev/withcode/courses
```

⚠️ **Re-parenting a page moves its whole subtree and changes every URL beneath it.** All of those
links break. This is the most far-reaching edit on this screen.

⚠️ **A page cannot be its own parent, and cannot be nested under its own descendant.** The API
refuses circular references — but the guard exists because a cycle once silently deleted a domain's
worth of pages from the rendered tree. Do not test it.

---

## 5. Status

| Status | The page | Listed in its section / sidebar |
| --- | --- | --- |
| **Draft** | **404** — and so is everything nested under it | No |
| **Live** | Renders | Yes |
| **Upcoming** | **404** | Under "Upcoming Resources" — text, **not a link** |

⚠️ **Draft is inherited downward.** Drafting a parent 404s every descendant, even Live ones. Useful
for taking a whole branch offline in one edit; surprising if you forget.

⚠️ **`__main__` cannot be drafted.** To hide a Direct domain, change the **domain's** status.

---

## 6. Description and Search description

| Field | Where it shows | Empty means |
| --- | --- | --- |
| **Description** | One line under the page's `<h1>` | Nothing renders |
| **Search description** | The Google result and link previews | A generated description is used |

### ⚠️ The borrowing rule

If **Search description is empty** and **Description is 40 characters or more**, the Description is
used as the search snippet too.

| Description | Search description | What Google sees |
| --- | --- | --- |
| 40+ chars | empty | **the Description** |
| 39 or fewer | empty | the generated description |
| anything | set | **the Search description** |
| empty | empty | the generated description |

**Exactly 40 characters, after trimming.** A 45-character description *is* borrowed; a 39-character
one is not.

⚠️ **Search description has no minimum.** A deliberate 15-character snippet is used verbatim. Only
the borrowed Description is judged on length — if you explicitly write a snippet, that is the answer.

**Both are plain text**, limit **300 characters**. HTML is rejected; a literal `<` is fine.

⚠️ **On a Direct domain's root, these fields are the DOMAIN's, not `__main__`'s.** See §2.

### Where the description sits

With a description present, the review badge and Share button move down to sit level with it. Without
one, they sit level with the title. Both are correct — the group aligns to the bottom of the heading
block.

---

## 7. Target countries

Same rules as domains. Defaults to All countries; specific selections are mutually exclusive with it.

⚠️ **A country-restricted page is excluded from `sitemap.xml` and gets `noindex`.** Restricting a
page removes it from search. Use **Draft** to hide something, not country targeting.

⚠️ **A page cannot out-reach its domain.** If the domain is restricted to IN, a page inside it set to
All countries is still only visible to IN visitors. The narrower of the two wins.

---

## 8. Deleting a page

⚠️ **Deletion is recursive.** Deleting a page deletes, in one transaction:

1. Every **content block** on the page and on all of its descendants
2. Every **descendant page**, deepest first
3. The page itself

**Deleting a parent with 12 children deletes 13 pages.** Check the tree before confirming.

⚠️ **No undo, no soft delete.** Recovery means a database restore.

⚠️ **`__main__` cannot be deleted** — the API refuses it.

**Use Draft instead** for anything you might want back.

---

## 9. Do / Don't

**Do**

- Set the slug once, at creation
- Leave `__main__` alone except through **Section Layout**
- Edit the **domain** to change what the domain root shows
- Set a page to **Draft** if it is not ready — pages go Live by default
- Pick the content type before building the content
- Check the child count before deleting a parent
- Use Draft on a parent to take a whole branch offline

**Don't**

- Don't touch `__main__`'s slug, parent or status
- Don't expect `__main__`'s Title/Icon/Description to appear anywhere
- Don't change the content type expecting content to convert
- Don't re-parent a page casually — every URL beneath it changes
- Don't use Narrative; it is invisible in dark mode
- Don't use country targeting to hide a page
- Don't assume a description under 40 characters reaches Google

---

## 10. Troubleshooting

| Symptom | Cause |
| --- | --- |
| **Page 404s** | It is Draft or Upcoming — **or a parent is** |
| **Page is public before I finished** | Pages default to **Live**, unlike domains |
| **"Slug must contain only lowercase letters, numbers, and hyphens"** | Uppercase, spaces or underscores in the slug |
| **409 on save** | A sibling under the same parent already has that slug |
| **Edited `__main__`, nothing changed** | The domain root reads the **domain's** fields |
| **Page renders empty / "Coming soon"** | The content type's data has not been created yet |
| **Heading invisible in dark mode** | Content type is Narrative. Known bug, `OPEN-ITEMS.md` §3c |
| **Two icons on the heading** | The Title still contains an emoji. Remove it |
| **Table rows vanished** | Content type was switched. Switch back — they are still there |
| **Description saved but not showing** | Under 40 chars affects *search* only; on the page it always shows. If nothing shows at all, check you edited the right row |
| **Google shows a generic description** | Search description empty **and** Description under 40 chars |
| **Child pages disappeared from the tree** | A parent is Draft, or a re-parent created a cycle |
| **Page missing from `sitemap.xml`** | Draft/Upcoming, or restricted to specific countries |

---

## Related

| | |
| --- | --- |
| `DOMAIN-GUIDE.md` | The domain a page belongs to, and Direct vs Hierarchical |
| `CATEGORY-GUIDE.md` | Categories, and the Active gate that can hide everything |
| `ROW-ORDERING-GUIDE.md` · `ROW-TAGS-GUIDE.md` | Table page features |
| `../TABLE-GUIDE.md` | Table content |
| `../RICH-TEXT-GUIDE.md` | Rich text content |
| `../ROADMAP-CONTENT-GUIDE.md` | Roadmap content |
| `../ICON-GUIDE.md` | The icon picker |
