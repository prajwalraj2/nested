# NEW-IMPROVEMENTS-3

Item **#36** onward, and **Phase M** — the public site: header, static pages, and the four
systems behind them (blogs, submissions, feedback, changelog, careers).

Items #1–#28 and Phases A–J are in `NEW-IMPROVEMENTS.md`.
Items #29–#35 and Phases K–L are in `NEW-IMPROVEMENTS-2.md`.

> ⚠️ **The standing rule still applies.** Every data-dependent change runs on **both Neon
> branches** before the code deploys, and is stated explicitly in the record each time. Phase M
> adds six models; that is six chances to forget.

---

## 🟢 #36 — The public site

**Raised 17 Aug 2026.** Not a defect — the second genuinely new area after the roadmap. Recorded
because most of the decisions are about *scope and shape*, and those are the expensive ones to get
wrong.

### 36.1 — What exists today, which is less than it looks

| | |
| --- | --- |
| **Site header** | ⚠️ **None.** `AppHeader.tsx` exists and is rendered **nowhere** — referenced only in a comment in `domain/layout.tsx`. Dead code with a head start. |
| **`/`** | A **308 permanent redirect** to `/domain` |
| **Domain pages** | Sidebar + breadcrumb bar. No top navigation anywhere. |
| **Public routes** | `/domain`, `/login`, `/unauthorized`, `robots.txt`, `sitemap.xml` — and nothing else |
| **shadcn** | `navigation-menu` ✅, `sheet` ✅ installed. No `drawer`, no `accordion`. |

So this is not "add menus to the header". It is **the site's first header**, plus nine new
destinations and five new systems behind them.

### 36.2 — What was asked for

A header — `atno.io` · **Domains ▾** · **Company ▾** · **Resources ▾** · **Submit +** — and:

| Destination | Shape |
| --- | --- |
| About · Contact · Privacy · Terms | static, hard-coded |
| Career | ⚠️ **a system** — jobs posted in the admin, applications with a CV upload |
| Blogs | ⚠️ **a system** — full model, admin-authored |
| Submit | ⚠️ **a system** — public form, admin reviews |
| Feedback | ⚠️ **a system** — public form, categorised |
| Changelog | ⚠️ **a system** — a four-column board with a type filter and a detail modal |
| Status | an external hosted service — a link, not a page |

**User's words, and the framing for the whole phase:** *"Nothing is small here — everything with
proper system. Everything will be done via admin panel."*

---

## 36.3 — Decisions, with the reasoning that produced them

### (a) ⚠️ `/` becomes a REWRITE, not a redirect — and not a 307 either

The starting question was whether to change `permanentRedirect` (308) to `redirect` (307), because
the user noticed a delay when visiting `atno.io`.

**That would have made it worse.**

| | First visit | Repeat visit |
| --- | --- | --- |
| **308** (today) | round trip, then `/domain` | ⚡ browser skips the network entirely — it remembers |
| **307** | identical | ⚠️ **the same round trip, every single time** |

The delay is caused by **having a redirect at all**, not by its type. The 308 cache is precisely
why repeat visits feel instant. Switching to 307 would have traded the cache trap for a permanent
tax on every visit.

**The answer is the third option, which `page.tsx` already names under "BETTER LONG-TERM OPTION":**

```ts
// next.config.ts
async rewrites() {
  return [{ source: '/', destination: '/domain' }]
}
```

`atno.io` serves the domain listing directly. The URL stays `/`. **No redirect, no round trip, no
cached 308.**

| | Speed | Cache trap | Reversible | SEO |
| --- | --- | --- | --- | --- |
| 308 today | fast on repeats | ⚠️ **yes** | no | fine |
| 307 | ⚠️ slower always | no | yes | slightly weaker |
| **Rewrite** | ⚡ **fastest, always** | **no** | **yes** | fine — canonical still resolves to `/domain` |

⚠️ **And it makes the homepage question moot.** A real landing page at `/` later is one deleted
line in `next.config.ts` — there is no cached redirect to fight, because there never was one. The
warning in `page.tsx` ("*you cannot fix that from the server side*") stops applying the day this
ships.

### (b) Blogs get their own model — but the body is HTML

⚠️ **The same call as 33.2(c) for roadmap sheets, for the same reason.**

A blog post genuinely **is** a new model: it has a date, an author, an excerpt, a cover image and a
category, and it does not live in the domain tree. `Page` cannot carry that. So "properly built"
means a real `BlogPost` table regardless.

But its **body** is HTML, exactly like roadmap sheets and rich text — **not** a fourth authoring
paradigm. Designing a block schema first would put a month between now and the first post, which is
the identical trade already accepted at 33.2(c).

⚠️ **When L-11 (content blocks) lands it migrates rich text, roadmap sheets AND blogs in one pass.**
Building a bespoke blog editor now would mean two migrations instead of one, and four content
systems instead of three.

### (c) About / Contact / Privacy / Terms stay hard-coded

**User's call.** They change perhaps twice a year, and making them admin-editable means either a
fifth content type or a synthetic "site" domain to hang `Page` rows off — machinery with no payoff.

⚠️ **Career is NOT in this group**, despite looking like it. Job postings open and close; that is
data with a lifecycle, not a paragraph.

### (d) ⚠️ Cloudflare R2 for PRIVATE files only. Public assets stay on Vercel Blob.

Not a migration — a split by **purpose**:

| | Provider | Why |
| --- | --- | --- |
| Table images, blog covers | **Vercel Blob** | public, working, immutably cached |
| **Resumes** | **R2, private bucket** | ⚠️ the one thing Blob genuinely cannot do |

**Why not move public assets too:** R2 public access needs a **custom domain**. The free
`*.r2.dev` URL is rate-limited and Cloudflare says not to use it for production. A private bucket
needs no domain at all, because nothing ever links to it. So scoping R2 to private files gets the
capability that is actually needed with **zero DNS work**.

⚠️ The trigger for moving public assets was already set at #29.6(e) — *"image data transfer
approaching 10 GB/month"* — and has not fired. This decision does not change it.

### (e) ⚠️ Resumes stream through an admin route. No presigned URLs.

```
GET /api/admin/applications/[id]/resume
  → requireAdmin()
  → server fetches from R2 with its own credentials
  → streams the PDF back
```

**Simpler and safer than a presigned URL:**

- There is **no URL that works outside the admin**. A presigned link, once generated, works for
  anyone holding it until it expires.
- The auth check is the gate, not the obscurity of a signature.
- ⚠️ The storage adapter needs only `getPrivate()`, not URL signing — one method instead of a whole
  signing concern leaking into an interface whose own comment says *"three methods deliberately;
  anything richer would leak a provider's model into the callers."*

### (f) Feedback and Submission stay two models

⚠️ **I argued for one `Submission` model with a `kind` column and was overruled — correctly, on
reflection.** The fields barely overlap: a tool submission carries a product name, URL, target
domain and target page; feedback carries a category and a message. One table would be half-empty
in both directions, and the admin queues answer different questions.

### (g) ⚠️ Two buckets on R2, not one bucket with prefixes

The public bucket could take a domain binding later; the private one never does. **That makes
"private" a property of infrastructure rather than of a code path someone can get wrong.**

---

## 36.4 — ⚠️ Public write endpoints break a premise. Deliberately.

Feedback, Submit and job applications are the **first public write endpoints on this site**.

**#35 removed HTML sanitisation on an explicit premise: only a single trusted admin ever writes
content.** A public form breaks that premise for a new surface. It does **not** invalidate #35 —
rich text and roadmaps are still admin-only — but these three routes need a different contract, and
it must be designed once rather than three times.

### The rules, and why each exists

**1. ⚠️ Submissions render as PLAIN TEXT in the admin. Never as HTML.**

No `dangerouslySetInnerHTML` anywhere near this data. Otherwise a submission becomes stored XSS
**against you**, on the very screen where you review it — executing in the same origin as the admin
API. This is the single most important rule in Phase M.

**2. ⚠️ Rate limiting lives in Postgres, not memory.**

Vercel runs this app as serverless functions and each instance has its own memory. A counter in a
JS `Map` resets on every cold start and is not shared between concurrent instances — an attacker
spreading requests across connections would never trip it. **This is the identical reasoning
already written on `User.failedLoginAttempts`**, and the same conclusion: Postgres is the one piece
of state every instance shares.

⚠️ **Hash the IP, do not store it.** A raw IP is personal data with no purpose here — the counter
only needs to know "same source", not "which source".

**3. A honeypot field, and a minimum fill time.**

A hidden input that humans never fill and bots usually do, plus a check that the form was on screen
for more than a couple of seconds. Together they stop the overwhelming majority of automated spam
at zero cost to a real person. Turnstile is the escalation if that stops being enough — not the
starting point.

**4. Length caps enforced server-side, on every field.**

The client cap is a courtesy. ⚠️ Without a server cap a single request can write a megabyte of text
into a `@db.Text` column, and nothing stops it happening ten thousand times.

**5. Email is validated loosely and never trusted.**

Enough to catch a typo. ⚠️ Not enough to reject a valid address — over-strict email regexes reject
real addresses, and there is nothing to gain here by being clever.

---

## 36.5 — The schema

Six new models. All purely additive; nothing existing is altered.

### Blog

```prisma
/// A blog post (M-9).
///
/// ⚠️ ITS OWN MODEL, NOT A `Page`. A post has a date, an author, an excerpt and a cover image,
/// and it lives outside the domain tree — `Page` carries none of that. The same reasoning that
/// gave `Roadmap` its own table.
model BlogPost {
  id String @id @default(uuid())

  title String
  /// ⚠️ GLOBALLY unique, unlike `RoadmapNode.slug` which is scoped to its roadmap. A post has
  /// exactly one URL — `/blogs/<slug>` — so there is no scope to be unique within.
  slug  String @unique

  /// Shown on the listing and used as the meta description when set. Plain text.
  excerpt String?

  /// ⚠️ A URL, not a key. `TableImage`'s key indirection earns its keep because one image serves
  /// 40 rows (1.68x reuse, measured). A cover belongs to exactly one post, so the indirection
  /// would buy a join and nothing else.
  ///
  /// ⚠️ NOT PRODUCED BY THE EXISTING UPLOAD PIPELINE. `image-processing.ts` resizes everything to
  /// 64x64 — right for a logo beside a table row, useless for a social card. See M-9.
  coverUrl String?
  coverAlt String?

  author String

  /// HTML, same as roadmap sheets and rich text. ⚠️ NOT SANITISED (#35) — admin-authored, and
  /// `ROADMAP-CONTENT-GUIDE.md` §3 and §8 apply here verbatim.
  content String @db.Text

  /// Stripped text for search and word counts. Written by the API alongside the HTML in the same
  /// handler, so the two cannot disagree. Use `htmlToPlainText` from `src/lib/html-text.ts`.
  plainText String? @db.Text

  category String?
  tags     String[] @default([])

  /// ⚠️ PUBLICATION IS A DATE, NOT A STATUS ENUM.
  ///
  /// `null` = draft. Set = published. One field instead of a status column plus a date that can
  /// disagree with it — and filtering `publishedAt <= now()` gives scheduled posts for free,
  /// with no extra state to model.
  publishedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  /// The listing read: published posts, newest first.
  @@index([publishedAt])
}
```

### Submissions

```prisma
/// Someone proposing a tool, or requesting a new domain (M-6).
model Submission {
  id String @id @default(uuid())

  /// "tool" | "domain-request"
  kind String

  /*
    Where the submitter thinks it belongs. All four optional — the form explicitly says "leave it
    if you are not sure", and a domain REQUEST has no existing domain by definition.

    ⚠️ PLAIN STRINGS, NOT FOREIGN KEYS, AND THE NAMES ARE STORED ALONGSIDE THE IDS.

    A submission is a historical record. With an FK, deleting a domain would either cascade the
    submission away or block the delete — both wrong. And an id alone becomes meaningless the day
    its row disappears, so the label is snapshotted at submission time and the record stays
    readable forever.
  */
  domainId   String?
  domainName String?
  pageId     String?
  pageName   String?

  productName String
  productUrl  String
  description String @db.Text

  submitterName  String
  submitterEmail String

  /// "new" | "reviewed" | "accepted" | "rejected"
  status    String  @default("new")
  adminNote String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])
}
```

### Feedback

```prisma
/// A bug report or suggestion from a visitor (M-5).
model Feedback {
  id String @id @default(uuid())

  /// "ui-bug" | "feature-request" | "content-issue" | "other"
  category String
  message  String @db.Text

  /// ⚠️ Optional. Requiring an email to report a broken button loses most bug reports.
  email String?
  name  String?

  /// ⚠️ CAPTURED AUTOMATICALLY, NOT TYPED. A UI bug report without knowing which page it was on
  /// is close to useless, and nobody types their own URL accurately.
  pageUrl String?

  status    String   @default("new")
  createdAt DateTime @default(now())

  @@index([status, createdAt])
}
```

### Changelog

```prisma
/// One card on the public product board (M-7).
model ChangelogEntry {
  id String @id @default(uuid())

  title       String
  description String @db.Text

  /// "bug" | "ui-enhancement" | "new-feature" | "new-column" | "new-data"
  /// Shown as a badge on the card and drives the public filter.
  type String

  /// "not-started" | "in-progress" | "done" | "released"
  /// ⚠️ Four independent columns. The user was explicit that "done" and "released" carry no
  /// defined relationship beyond being different — do not invent one in the UI.
  status String

  /// Position within its column.
  /// ⚠️ Renumber the whole column on reorder, never swap two rows — gaps appear the first time a
  /// card is deleted, and swap-based ordering degrades silently from then on. `renumber()` in
  /// `src/lib/roadmap-tree.ts` already does exactly this and is not roadmap-specific.
  order Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, order])
}
```

### Careers

```prisma
/// An open role (M-8).
model Job {
  id String @id @default(uuid())

  title       String
  description String @db.Text
  location    String
  category    String

  /// "open" | "closed". ⚠️ Closing a job must NOT delete it — its applications are records.
  status String @default("open")

  applications JobApplication[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

/// Someone applying (M-8).
model JobApplication {
  id String @id @default(uuid())

  jobId String
  job   Job    @relation(fields: [jobId], references: [id], onDelete: Cascade)

  name  String
  email String

  /// ⚠️ A KEY, NOT A URL — AND THE NAMING IS THE POINT.
  ///
  /// The object lives in a PRIVATE R2 bucket and has no public address at all. Calling this
  /// `resumeUrl` would invite someone to render it in an `href`, which is exactly the mistake
  /// the private bucket exists to prevent. It is readable only through
  /// `GET /api/admin/applications/[id]/resume`, behind `requireAdmin()`.
  resumeKey   String
  resumeBytes Int

  status    String   @default("new")
  createdAt DateTime @default(now())

  @@index([jobId, createdAt])
}
```

### Rate limiting

```prisma
/// Per-source request counters for public forms (M-4).
///
/// ⚠️ IN POSTGRES, NOT IN MEMORY. Each serverless instance has its own memory, so a JS `Map`
/// resets on every cold start and is not shared between concurrent instances — an attacker
/// spreading requests across connections would never trip it. Identical reasoning to
/// `User.failedLoginAttempts`.
model RateLimit {
  /// ⚠️ A HASH of the source plus the action — e.g. sha256("feedback:" + ip). The raw IP is
  /// personal data with no purpose here: the counter needs "same source", not "which source".
  key String @id

  count       Int
  windowStart DateTime

  @@index([windowStart])
}
```

---

## Phase M — The public site (#36) — PLAN (agreed 18 Aug 2026)

**Shipped:** M-1 · M-2 · M-3 (18 Aug) · M-4 · M-5 · M-6 · M-7 · M-8 (19 Aug).
**Next:** M-9 Blogs · M-10 dependency bump.

⚠️ **One menu link still points at nothing: `/blogs`.** Down from five.
`PENDING_ROUTES` in `site-nav-links.ts` is the live record; an entry leaves it as its step ships.

| Step | What | Ships alone? |
| --- | --- | --- |
| ~~**M-1**~~ | ~~The `/` rewrite~~ | ✅ shipped 18 Aug |
| ~~**M-2**~~ | ~~The site header~~ | ✅ shipped 18 Aug |
| ~~**M-3**~~ | ~~Static pages: About · Contact · Privacy · Terms~~ | ✅ shipped 18 Aug |
| ~~**M-4**~~ | ~~Public form foundations~~ | ✅ shipped 19 Aug |
| ~~**M-5**~~ | ~~Feedback~~ | ✅ shipped 19 Aug |
| ~~**M-6**~~ | ~~Submissions~~ | ✅ shipped 19 Aug — ⚠️ **domain only, page cascade cut** |
| ~~**M-7**~~ | ~~Changelog board + admin~~ | ✅ shipped 19 Aug |
| ~~**M-8**~~ | ~~Careers — jobs, applications, R2 private storage~~ | ✅ shipped 19 Aug |
| **M-9** | Blogs | ✅ the largest |
| **M-10** | Dependency bump — `next` patch, plus the auth criticals | ✅ ⚡ deferred by choice, see below |

⚠️ **The order is by dependency and by risk, not by size.** M-4 comes before any form so the
security work is done once. M-5 is the simplest form, so it proves that foundation before M-6 and
M-8 rely on it.

---

### M-1 — The `/` rewrite

```ts
// next.config.ts
async rewrites() {
  return [{ source: '/', destination: '/domain' }];
}
```

…and `src/app/page.tsx` is **deleted** — a rewrite cannot take effect while a real route file
exists at `/`.

⚠️ **Keep the reasoning from `page.tsx`.** That file's comment is the clearest explanation in the
repository of why 308 was chosen and what it costs. Move it into `next.config.ts` beside the
rewrite rather than losing it with the file.

⚠️ **Anyone who has already visited `atno.io` still has the 308 cached** and will keep being sent
to `/domain` until their cache clears. That is not fixable from the server — it is exactly the trap
`page.tsx` warned about, now realised. **New visitors get the fast path immediately; existing ones
eventually.** Shipping sooner strictly reduces the number of people affected.

**Test:** `curl -sI https://atno.io/` returns **200, not 308**; the page shows the domain listing;
the address bar stays `/`; `/domain` still works; ⚠️ **in a fresh incognito window** the root loads
with no redirect hop in the network panel.

---

### M-2 — The site header

`AppHeader.tsx` already has the hard part — a three-column Domains mega-menu grouped by category.
Three things are wrong with it, and it is rendered nowhere.

**1. ⚠️ It fetches client-side.** `useHeaderDataFromContext()` → `/api/page-context`. So ~25 domain
links would be **absent from the HTML of every page on the site**. That is finding #30's shape
applied to the header — which means the site's internal link graph is largely invisible without
JavaScript.

⚠️ **Server-rendering the header is probably the highest-leverage internal-linking change available
on this project.** It is bigger than anything L-8 did, because it is on every page rather than one.

**2. ⚠️ It is pinned light** — `bg-white/95`, `text-gray-900`, `text-blue-600`. In dark mode it
would be a white bar above a dark page. The same island problem as #34, and cheap to avoid now
rather than expensive to unpick later.

**3. No mobile treatment.** `NavigationMenu` is desktop-oriented; a 25-item mega-menu needs a
`Sheet`. Already installed.

**Structure:** `atno.io` · **Domains ▾** · **Company ▾** · **Resources ▾** · **Submit +**

| Menu | Contents |
| --- | --- |
| Domains | all domains, grouped by category, plus "View all domains →" |
| Company | About · Contact · Career · Privacy Policy · Terms · social links |
| Resources | Blogs · Feedback · Changelog · Status |

⚠️ **Link only what resolves.** A menu item pointing at a 404 is worse than an absent one. Items
appear as M-3 … M-9 land. Status is a **non-link with a "soon" hint** until the hosted URL exists —
`href="#"` jumps to the top of the page and reads as broken.

⚠️ **Drop the gradient wordmark.** The current code renders "ATNO" in a blue-to-purple gradient; the
design shows a plain `atno.io`. Plain reads as more established, and a gradient wordmark is the one
element of that mockup worth arguing against.

**Test:** the header appears on every public page; ⚠️ `curl -s <any page> | grep -c 'domain/'`
finds the domain links **in the HTML**; dark mode; 375px opens a Sheet, not a mega-menu; keyboard
navigation reaches every item; the active section is marked.

---

### M-3 — Static pages

`/about` · `/contact` · `/privacy` · `/terms`. Four routes, hard-coded content, no schema.

⚠️ **Real content, not placeholders.** A published `/privacy` that says "coming soon" is worse than
no page: it is linked from the footer, indexed, and read as neglect.

⚠️ **`/contact` has no form.** Feedback (M-5) is the form; contact is an address, an email and a
response-time expectation. Two forms doing nearly the same thing is how both end up unmaintained.

**Test:** all four render in both themes; they appear in `sitemap.xml`; `<title>` and description
are set per page; the header links resolve.

---

### M-4 — Public form foundations

⚠️ **Built once, before any form exists.** Doing this per-form means three implementations and two
of them will be weaker.

**`src/lib/public-forms.ts`:**

| Piece | Detail |
| --- | --- |
| `checkRateLimit(action, request)` | Postgres-backed, sliding window, **hashed** source key |
| `isHoneypotFilled(body)` | a hidden field humans never fill |
| `isTooFast(renderedAt)` | a form submitted in under ~2s was not typed by a person |
| `capped(value, max)` | ⚠️ server-side length limits on every field |
| `looksLikeEmail(value)` | loose on purpose — over-strict regexes reject real addresses |

**And one rule, enforced by review:**

⚠️ **Everything a visitor submits is rendered as TEXT in the admin. Never as HTML.** No
`dangerouslySetInnerHTML` on this data, ever. Otherwise a submission becomes stored XSS against the
admin, in the same origin as the admin API. This is the most important line in Phase M.

**Test:** eleven rapid submissions → the eleventh is refused; a filled honeypot is silently
accepted-then-discarded (⚠️ **not** rejected with an error — an error tells a bot what tripped it);
a 2 MB message is refused; `<script>` in a message appears as literal text in the admin, with the
DOM inspected to confirm no element was created.

---

### M-5 — Feedback

`/feedback` — category dropdown, message, optional name and email.

- ⚠️ **`pageUrl` is captured automatically**, from the referrer or a query parameter. A UI bug
  report without the page is close to useless, and nobody types their own URL accurately.
- ⚠️ **Email optional.** Requiring it to report a broken button loses most reports.
- Success state says what happens next, not just "thanks".

Admin: a simple queue at `/admin/feedback`, filterable by status and category.

**Test:** submit each category; submit with and without an email; ⚠️ the recorded `pageUrl` matches
where the visitor came from; the admin queue shows it; marking it reviewed persists; ⚠️ rate limit
and honeypot both fire.

---

### M-6 — Submissions

`/submit` — propose a tool, or request a domain.

⚠️ **BUILT AS DOMAIN-ONLY. The page half of the cascade was cut on 19 Aug 2026** — pick a domain,
and that is all. `Submission.pageId` / `pageName` exist but nothing writes them, so adding the page
step later needs no migration.

**"Not sure" is a first-class answer**, not an empty select the visitor has to guess at.
⚠️ It needs a SENTINEL VALUE (`__not_sure__`), because Radix's `Select` **throws** on
`value=""` — it reserves the empty string for the placeholder state.

⚠️ **NO NEW PUBLIC READ ROUTE WAS NEEDED, and that is the better outcome.** The plan assumed the
cascade required one. With only the domain list left, it is server-rendered into the page as props
— the `SiteHeader` pattern. An endpoint that lists content is an endpoint whose filters can be got
wrong; the one never written can never leak a draft.

⚠️ **`productUrl` BECAME OPTIONAL** (agreed 19 Aug), because a domain request has no product URL.
Validation is conditional via a zod discriminated union: required for `kind: "tool"`, optional
otherwise — a single schema with an optional field would have accepted a linkless tool suggestion.

⚠️ **A SUBMITTED URL IS A SECOND XSS ROUTE, AND THE LINT RULE DOES NOT COVER IT.**
`href={submittedValue}` accepts `javascript:alert(1)`; one click in a logged-in admin session runs
it on the admin's origin, without `dangerouslySetInnerHTML` ever appearing. ⚠️ **`z.url()` is not a
defence** — it validates URL *shape*, and `javascript:` is a well-formed URL. `isSafeHttpUrl` in
`lib/submission-kinds.ts` confines the scheme, checked BOTH on the way in and again immediately
before the anchor is rendered (the second covers rows written before the first existed).

⚠️ **The submitted `domainName` is ignored and re-derived server-side** from the id, filtered to
`PUBLISHED`. Trusting the client's label would let a real id travel beside a fabricated name into a
position that looks verified — and an unfiltered lookup would confirm whether a draft domain exists.

⚠️ **Nothing existing changes.** Additive routes only; the admin endpoints are untouched.

**Test:** the cascade lists only published, globally-targeted pages; ⚠️ a DRAFT page is absent;
"not sure" submits successfully; a domain request with no domain selected works; the snapshot
`domainName` survives ⚠️ **deleting that domain afterwards**; the admin can accept/reject.

---

### M-7 — Changelog

`/changelog` — four columns: **Not started · In progress · Done · Tested & Released**.

- A **type filter** — Bugs, UI enhancements, and the rest.
- Cards show **title + type badge** only.
- Clicking one opens a **modal**: title, description, type, status.
- A **"Send feedback"** button linking to `/feedback`.

Admin: its own sidebar entry, cards created and moved between columns.

⚠️ **Reordering renumbers the whole column.** `renumber()` in `src/lib/roadmap-tree.ts` already
does this and is not roadmap-specific — the swap-two-rows approach degrades silently the first time
a card is deleted.

⚠️ **Badge colours come from `assignBadgeColors`** (K-1), computed over the WHOLE board — not per
column and not over the filtered set. It allocates by sorted position among the distinct values it
is handed, so feeding it one column gives "bug" a different colour in each, and feeding it the
filtered set makes colours change as the filter changes. ✅ It already sorts with plain `<`
(`badge-colors.ts:196`), so the `localeCompare` hydration trap is avoided.

⚠️ **The public board and the admin both call it over their full set**, so a type carries the same
colour on the page and on the screen that manages it.

⚠️ **CACHED VIA `unstable_cache` WITH A `CHANGELOG` TAG**, invalidated by every write route —
create, update, delete AND move. Missing it on any ONE leaves the admin correct and the public page
stale, which reads as a caching bug long after the cause is forgotten.

⚠️ **`status` AND `order` ARE ABSENT FROM THE PATCH SCHEMA.** Both change only through
`[id]/move`, which assigns a position in the destination column. A bare `{ status }` PATCH would
move a card into a column carrying whatever order it already had, colliding with a card there.

⚠️ **`POST` AND `move` COMPUTE THE NEXT POSITION FROM THE MAX, NEVER FROM A COUNT** — deleting
does not renumber, so five cards minus one leaves orders 0,1,2,4 and a count would produce a
duplicate 4. Everything here is written to tolerate gaps.

⚠️ **Cards are `<button>`, not `<a>`.** Deep-linking is unsupported, and an anchor promises
middle-click, copy-link and a working back button that this cannot deliver.

**Test:** all four columns render; the filter narrows without reloading; the modal opens and closes;
⚠️ deep-linking a card is **not** supported and nothing suggests it is; empty columns show a state
rather than collapsing; dark mode; mobile stacks the columns.

---

### M-8 — Careers

`/career` — open roles, and an application form on each.

**Storage — the sensitive part.**

⚠️ **Resumes go to a PRIVATE R2 bucket and have no public URL at all.** They carry a person's full
name, email, and often their phone and address. A public blob URL is unguessable but **permanent
and unauthenticated** — anyone who ever obtains it has it forever, and it cannot be revoked.

⚠️ **BUILT AS A SEPARATE MODULE, NOT AS THREE METHODS ON `StorageAdapter` — the shape below
could not work.** `getStorage()` returns ONE adapter chosen by `STORAGE_PROVIDER`, which is unset
and therefore Vercel Blob. With the private trio on the adapter and Blob throwing on it, every
private upload would fail unless the PUBLIC provider were switched to R2 — which decision 36.3(d)
forbids. `src/lib/storage/private-r2.ts` plus `getPrivateStorage()` is the fix, and it is closer to
36.3(g)'s intent anyway: private is separate infrastructure, not a mode of the public adapter.

The private trio (on `PrivateStorage`, not `StorageAdapter`):

```ts
putPrivate(objectKey, body, contentType): Promise<{ key: string }>
getPrivate(key): Promise<Buffer>
deletePrivate(key): Promise<void>
```

⚠️ **Vercel Blob throws on all three, deliberately, with a message naming R2.** That is honest: it
is a capability Blob does not have, not a bug to work around.

**Upload rules — ⚠️ a different risk class from images:**

| Rule | Why |
| --- | --- |
| **PDF only, by magic bytes** | An extension proves nothing — the same rule the image upload already follows |
| **2 MB cap** | A resume that is not 2 MB is unusual. 5 MB if headroom is wanted |
| ⚠️ **No re-encoding is possible** | `sharp` re-encodes images, which destroys anything embedded. **A PDF is stored as given.** That is precisely why it must never be public |
| **Streamed via an admin route** | `GET /api/admin/applications/[id]/resume`, behind `requireAdmin()` |

⚠️ **SIZE IS CHECKED TWICE, AND NEITHER CHECK ALONE IS ENOUGH.** "Refused before it is read"
means `Content-Length` — which is client-supplied and can lie. The real cap is the byte length
after `formData()` has buffered it. Both are present: the header check saves an honest 10 MB
transfer, the buffer check catches a dishonest one.

⚠️ **THE CASCADE ON `JobApplication.jobId` MUST NEVER FIRE.** It runs inside Postgres, so no
application code executes and the CVs stay in R2 forever — unreferenced and therefore unreachable
through the admin. `DELETE /api/admin/jobs/[id]` returns **409** for a job with applications and
tells you to close it instead, the same guard `CategoryList` uses for a category with domains.

⚠️ **`resumeKey` IS NOT SELECTED BY THE ADMIN LIST ROUTE.** Nothing in the UI needs it, and the
moment an object path is in a page's JSON somebody will try to build a URL from it.

⚠️ **THE DOWNLOAD IS `Content-Disposition: attachment` + `nosniff` + `no-store`.** A PDF is
stored byte for byte as uploaded — nothing re-encodes it, unlike `sharp` with an image — so
rendering it inline would put an untrusted document in the browser's viewer on the admin's own
origin. `no-store` because a cached CV outlives the session that was allowed to see it.

⚠️ **DELETING AN APPLICATION DELETES THE OBJECT FIRST, THEN THE ROW.** The other order strands
the file: if the row goes and the object delete then fails, nothing remembers the key.

⚠️ **NO CORS CONFIGURATION IS NEEDED ON THE BUCKET** — the browser never contacts R2. It is the
usual R2 stumbling block and this design sidesteps it entirely.

⚠️ **CREDENTIALS ARE `.trim()`ED WHEN READ.** The first connectivity test failed with
`Credential access key has length 33, should be 32`: a trailing newline had come along with the
paste into `.env`. The error reads as "wrong key" rather than "invisible character", and the same
paste has to happen again in Vercel.

**Test:** post a job, apply to it; a non-PDF is refused; a `.pdf` that is really a `.exe` is refused
by magic bytes; a 10 MB file is refused **before** it is read; ⚠️ **the resume key never appears in
any public response** — grep the page source; the admin download works and **fails when logged
out**; closing a job keeps its applications; ⚠️ deleting an application removes the object from
R2 as well as the row.

---

### M-9 — Blogs

`/blogs` and `/blogs/[slug]`.

**Admin:** title, slug, excerpt, cover, author, category, tags, HTML body with preview, publish.

⚠️ **Cover images cannot use the existing pipeline.** `image-processing.ts` hard-codes
`OUTPUT_SIZE = 64` — right for a logo beside a table row, useless for a social card, which wants
about 1200×630. **One upload endpoint with a `preset` parameter**, not a second endpoint: two
pipelines is how they drift.

**Public:**

- Listing: published posts, newest first, paginated.
- ⚠️ **Server-rendered**, like the roadmap and unlike the tables of #30. A blog that needs
  JavaScript to show its text is a blog that does not rank.
- `Article` JSON-LD, `og:image` from the cover, canonical per post.
- ⚠️ **`publishedAt <= now()`** on every public read, so a future date schedules rather than leaks.
- Posts belong in `sitemap.xml` — ⚠️ and `pageLastModified()` does not cover them, because they are
  not `Page` rows. That file's own warning applies again.

**Test:** a draft is invisible publicly and 404s by URL; a future `publishedAt` stays hidden until
it passes; ⚠️ `curl` a post and grep for a sentence from the body — **it is in the HTML**; the cover
renders at a sensible size in a social preview; the slug is unique; posts appear in the sitemap
with honest dates; dark mode; the guide's colour rule holds.

---

### M-10 — Dependency bump

⚠️ **Deferred deliberately on 18 Aug 2026, not overlooked.** It was offered ahead of M-4 and the
decision was to finish the feature work first. Recording it here so it cannot quietly become
"nobody remembered".

**Measured on 18 Aug 2026** with `npm audit` — not copied from an older note:

| | |
| --- | --- |
| Totals | **20 vulnerabilities — 4 critical, 14 high, 1 moderate, 1 low** |
| `next` | 15.5.9 → **15.5.23**. ⚠️ **Patch-level, `isSemVerMajor: false`** — the cheapest item here |
| `next-auth` | **critical**, fix available |
| `@auth/core`, `@auth/prisma-adapter` | **critical**, fix available |
| `tar` | **critical**, fix available |
| `sharp` | high — resolves via the same `next` bump |
| `prisma` | high, but npm proposes a **downgrade** to 6.12.0 flagged semver-major. ⚠️ Handle separately; do not let `npm audit fix --force` touch it |

**Why the auth ones matter most on this project:** one `@auth/core` advisory is *"OAuth state, nonce
and PKCE check cookies are not bound to the request"*. This app puts its entire admin behind that
library, so it is the one dependency whose failure mode is "someone else gets in", not "the site
gets slower".

⚠️ **`npm audit` lists every advisory filed against a package — it does not prove each one applies
to how this app uses it.** Many of the `next` entries are self-hosting or custom-server scenarios
that Vercel's platform already handles. **That is an argument for taking the patch bump, not for
studying the list**: the upgrade costs less than the investigation.

⚠️ **Do NOT run `npm audit fix --force`.** It will take the `prisma` downgrade and any other
semver-major it fancies. Bump the named packages explicitly.

**Test:** `npm run build` passes; `npm audit` totals drop; ⚠️ **log in and out of the admin** —
`next-auth` is a beta pinned at `5.0.0-beta.29` and is the single most likely thing to break;
a public page, a table page and an image upload all still render; `middleware.ts` geo-detection
still sets `user-country`.

---

## Deferred, and why

| | |
| --- | --- |
| **Public assets on R2** | ⚠️ Trigger unchanged from #29.6(e): image transfer approaching 10 GB/month. Needs a custom domain, which private storage does not |
| **Blogs on content blocks** | Waits for L-11 — which will migrate rich text, roadmap sheets and blogs together |
| **A real homepage at `/`** | ⚠️ Unblocked by M-1 rather than done by it. One deleted line when it is wanted |
| **Turnstile / captcha** | Honeypot plus timing first. Escalate only if spam actually arrives |

---

## Related documents

| Document | Contents |
| --- | --- |
| `NEW-IMPROVEMENTS.md` | Items #1–#28, Phases A–J |
| `NEW-IMPROVEMENTS-2.md` | Items #29–#35, Phases K–L |
| `BLOB-TO-R2-MIGRATION.md` | Moving public objects to R2 — ⚠️ **not** what M-8 does |
| `ROADMAP-CONTENT-GUIDE.md` | §3 and §8 apply verbatim to blog post bodies |
| `RICH-TEXT-GUIDE.md` | The same rules for rich-text pages |
