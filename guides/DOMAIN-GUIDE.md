# Domains — the complete guide

**Admin → Domains** (`/admin/domains`)

A domain is a **subject area**, and it owns a real URL: `/domain/photography`. Everything a visitor
reads lives on pages *inside* a domain.

A domain decides four things:

| | |
| --- | --- |
| **Its URL and heading** | `slug` and `name` |
| **How its pages are shaped** | `pageType` — Direct or Hierarchical |
| **Who can see it** | Status, and Target countries |
| **What it says about itself** | Description, Search description, and its review date |

---

## 1. Creating a domain

**Admin → Domains → New domain.**

| Field | Rule |
| --- | --- |
| **Name** | Required. Free text. Pipes and ampersands are fine — "AI \| ML \| DL [ Traditional ]" |
| **Slug** | Required, **unique across all domains**, lowercase letters/numbers/hyphens |
| **Category** | Required |
| **Page type** | Direct or Hierarchical — ⚠️ **read section 3 before choosing** |
| **Order in category** | Position in the sidebar and menu within its category |
| **Icon** | Optional. An icon **id** from the picker (`youtube`, `figma`) |
| **Target countries** | Defaults to All countries |
| **Description** | Optional. One line under the heading |
| **Search description** | Optional. The Google snippet |
| **Status** | ⚠️ **Defaults to Draft** |

⚠️ **A new domain is DRAFT and therefore invisible.** Unlike pages, which default to Live, a domain
starts hidden and its URL returns **404** until you set it Live. This is deliberate — a half-built
domain should not be reachable — but it surprises people who create a domain, visit the URL and get
a 404.

### The slug is the URL

```
slug "photography"  →  /domain/photography
```

Allowed: `photography`, `web-dev`, `ai-ml`, `3d-tools`
Rejected: `Photography`, `web_dev`, `ai/ml`, `web dev`

⚠️ **Changing a slug breaks every existing link to it.** Old bookmarks, anything shared, and any
inbound link all 404 — there are no redirects. It also drops the page out of Google's index until
the new URL is recrawled. Set it once, at creation, and treat it as permanent.

---

## 2. ⚠️ The double-icon trap

**41 of 43 domains carry their emoji inside the Name string** — the name is literally
`"🖌️ Graphic Designing"`, not a name plus a separate icon.

So if you set an Icon on a domain whose name still contains an emoji, **both render, side by side.**

**Setting an icon is a two-step job:**

1. Pick the icon
2. **Delete the emoji from the Name field**

The form warns you: *"Remove any emoji from the name above, or both will show."*

⚠️ **Icons are ids, not emoji, and not uploads.** The picker lists what exists in
`public/icons/`. One icon serves many places — the same `youtube` id is used across a dozen
domains. See `ICON-GUIDE.md`.

---

## 3. ⚠️ Direct vs Hierarchical — the one decision that is hard to undo

This controls the URL depth of everything beneath the domain, so it shapes the whole domain.

### Direct

Content pages sit **straight under the domain**.

```
/domain/photography              ← the domain root: a grid of sections
/domain/photography/courses      ← a content page
/domain/photography/books
```

A Direct domain has a **hidden `__main__` page** created for it automatically. That row holds the
section layout for the root, and you will see it in the pages tree. See `PAGE-GUIDE.md` §2.

### Hierarchical

Content sits **one level deeper**, behind a chooser.

```
/domain/webdev                   ← the domain root: a list of subcategories
/domain/webdev/withcode          ← a subcategory, with its own sections
/domain/webdev/withcode/courses  ← a content page
```

Use this when a subject genuinely splits before it gets to content — "With Code" vs "No Code",
"Beginner" vs "Advanced".

### Which one?

| Choose | When |
| --- | --- |
| **Direct** | One coherent subject. Photography, Copywriting, Trading |
| **Hierarchical** | The subject splits into tracks a visitor must pick between first |

⚠️ **Switching Hierarchical → Direct creates a `__main__` page automatically** (if one is missing),
but your existing pages keep their current parents. You are left with content nested one level
deeper than a Direct domain expects, and you must re-parent it by hand.

⚠️ **Switching Direct → Hierarchical does NOT remove `__main__`.** The row stays, now meaningless.

**Both switches leave work behind. Decide at creation time.**

---

## 4. Status — the three states

| Status | The domain page | Listed in the menu / sidebar |
| --- | --- | --- |
| **Draft** | **404** | No |
| **Live** | Renders | Yes |
| **Upcoming** | **404** | Under "Upcoming Domains" — as text, **not a link** |

**Upcoming** is for announcing something you have not built. Visitors see the name in a list; the
URL still 404s.

⚠️ **Status can be changed from the row menu without opening the edit dialog** — Domains → `⋯` →
Live / Upcoming / Draft. Faster, and it does not touch any other field.

⚠️ **A Live domain still will not appear if its CATEGORY is inactive.** Two independent gates, both
must be open. This is the most common "my domain vanished" cause. See `CATEGORY-GUIDE.md` §5.

---

## 5. Target countries

Defaults to **All countries**, which is right for almost everything.

Selecting specific countries means the domain is shown **only** to visitors resolved to those
countries. Supported: **IN, US, GB, AU, CA**.

⚠️ **"All countries" and specific selections are mutually exclusive.** Choosing All clears the rest.

⚠️ **A country-restricted domain is also excluded from `sitemap.xml` and gets a `noindex` tag.**
That is correct — you should not advertise a page to Google that most visitors cannot see — but it
means restricting a domain removes it from search. Do not use this as a soft "hide"; that is what
Draft is for.

---

## 6. Description and Search description

Two fields, two jobs. Both optional.

| Field | Where it shows | Empty means |
| --- | --- | --- |
| **Description** | One line under the `<h1>` on the domain's root page | Nothing renders |
| **Search description** | The Google result and link previews | A generated description is used |

⚠️ **These belong to the DOMAIN, not to its `__main__` page.** Setting a description on the
`__main__` page in Admin → Pages does **nothing visible** on the domain root. The root's heading,
icon and description all come from the domain. Same rule for both Direct and Hierarchical roots.

### ⚠️ The borrowing rule — the one genuinely surprising behaviour

If **Search description is empty** and **Description is 40 characters or more**, the description is
**used as the search snippet too**.

| Description | Search description | What Google sees |
| --- | --- | --- |
| 40+ chars | empty | **the Description** |
| 39 or fewer | empty | the generated description |
| anything | set | **the Search description** |
| empty | empty | the generated description |

**The threshold is exactly 40 characters, after trimming.**

Why: the generated descriptions are near-identical across hundreds of pages, and search engines
largely ignore boilerplate. A real sentence you wrote beats one of 690 clones. The 40-character
floor stops a fragment like `"Data analyst roadmap"` being used where it would read badly.

⚠️ **Search description itself has no minimum.** A deliberate 15-character snippet is used exactly
as typed. Only the *borrowed* Description is judged on length.

**Both fields are plain text.** HTML is rejected with *"must be plain text — HTML tags are not
allowed here"*, because markup in a meta tag renders as literal characters in search results. A
literal `<` is fine — `Tools for < $10/month` saves.

**Limit: 300 characters**, enforced by the input.

---

## 7. Review dates

**Domains → `⋯` → Mark reviewed** stamps today's date. The domain's pages then show
**"⟳ Reviewed Aug 2026"** beside their Share button.

| | |
| --- | --- |
| **One button, whole domain** | Every page under it shows the same date |
| **Month precision** | The cadence is a monthly pass, so a day-level date would overclaim |
| **Expires after 90 days** | Past that the badge simply stops rendering |

⚠️ **The badge says "Reviewed", never "Updated".** Reviewing and finding nothing to fix is a real
outcome — the most common one — and the wording has to allow for it.

⚠️ **A stale badge is worse than no badge**, which is why it disappears at 90 days rather than
ageing in public. "Reviewed February" in November advertises neglect.

**Doing a review pass:**

1. Filter **Review → Needs review**
2. Work through those domains
3. **Mark all listed as reviewed**

⚠️ **"Mark all listed" acts on what the filter is currently showing** — that is the point, paired
with the filter. Marking all 43 blind is a rotating fake date with extra steps.

⚠️ **Editing a table does not move the review date.** Content edits and review passes are separate
by design.

---

## 8. Deleting a domain

⚠️ **This is the single most destructive action in the admin.**

Deleting a domain deletes, in one transaction:

1. Every **content block** on every page
2. Every **page** in the domain
3. The domain itself

**"Graphic Designing" means 70 pages.** The confirm dialog states the exact number and requires you
to **type the domain's name**. That friction is deliberate.

⚠️ **There is no undo and no soft delete.** Recovery means a database restore.

**Use Draft instead** for anything you might want back. Draft is invisible and instantly reversible;
delete is neither.

---

## 9. Do / Don't

**Do**

- Set the slug once, at creation, and leave it
- Decide Direct vs Hierarchical **before** creating pages
- Remove the emoji from the Name when you set an Icon
- Remember a new domain is **Draft** — set it Live when ready
- Use the row menu (`⋯`) for quick status changes
- Write Descriptions on the **domain**, not on `__main__`
- Check the **category's Active switch** when a Live domain is missing
- Use the **Needs review** filter before Mark all listed

**Don't**

- Don't change a slug on a live domain — every link to it breaks
- Don't set an Icon and leave the emoji in the Name
- Don't switch Page type after building pages — both directions leave manual work
- Don't use Target countries as a way to hide something; it removes it from search
- Don't delete a domain to hide it; Draft does that reversibly
- Don't expect a description under 40 characters to reach Google
- Don't press "Mark all listed" without a filter applied

---

## 10. Troubleshooting

| Symptom | Cause |
| --- | --- |
| **New domain 404s** | It is Draft. Domains default to Draft; pages default to Live |
| **Live domain missing from the menu** | Its category is inactive, or its Order clashes |
| **Two icons on the heading** | The Name still contains an emoji. Remove it |
| **The icon is a broken image** | An id was typed that is not in `public/icons/` |
| **Description saved but not showing** | You set it on `__main__`. It belongs on the domain |
| **Google shows a generic description** | Search description empty **and** Description under 40 chars |
| **"must be plain text"** | HTML in a description field. Both are plain text |
| **Review badge missing after marking** | Over 90 days old, or the page type does not show one |
| **Nested pages one level too deep** | Page type was switched. Re-parent them by hand |
| **Domain not in `sitemap.xml`** | Draft/Upcoming, or restricted to specific countries |

---

## Related

| | |
| --- | --- |
| `CATEGORY-GUIDE.md` | The category a domain sits in — and its Active gate |
| `PAGE-GUIDE.md` | Pages inside a domain, and the `__main__` row |
| `ICON-GUIDE.md` | The icon picker and available ids |
| `../TABLE-GUIDE.md` | Table pages |
