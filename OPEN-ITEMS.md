# 📌 Open Items — from the analytics + layout session

**Created:** 4 August 2026
**Branch:** `dev-3.0`
**Context:** Items that arose while wiring up analytics (Bing, GA4, Vercel, Clarity) and
fixing the public-page horizontal scroll. **Everything here is NEW** — findings #1–#23 are
tracked in `NEW-IMPROVEMENTS.md` and are deliberately not duplicated.

> Scope note: this is a short, actionable list, not an archive. When an item is done,
> delete it from here rather than ticking it — the history lives in git. If an item grows
> big enough to need its own investigation, promote it to a numbered finding in
> `NEW-IMPROVEMENTS.md` instead.

---

## 1. `ARCHITECTURE.md` is missing the analytics layer

**Priority: high** (the doc is only useful if it's trustworthy)

`ARCHITECTURE.md` was written before any analytics existed. It now omits a genuinely
non-obvious part of the system:

- **Four collectors** — Bing Webmaster Tools (imported from GSC), GA4, Vercel Web
  Analytics, Vercel Speed Insights, Microsoft Clarity
- **Two mount points** — three in `src/app/layout.tsx`, Clarity alone in
  `src/app/domain/layout.tsx`
- **Two different gating rules**, and the reason they differ:

  | Collector | Gate | Why |
  | --- | --- | --- |
  | GA4 | `VERCEL_ENV === 'production'` | one property, one bucket, **events cannot be deleted retroactively** |
  | Vercel Analytics | none | separates environments server-side |
  | Vercel Speed Insights | none | same — *confirmed empirically*: the package logs `"Debug mode is enabled by default in development. No requests will be sent to the server."` |
  | Clarity | `VERCEL_ENV === 'production'` | one project, **no environment filter** |

- **Clarity's idle-deferred `init`** and the fact that it protects INP/CLS, **not** FCP
- **The Speed Insights baseline** (below) as the first real evidence for finding #8

**Action:** add an *Analytics & measurement* section, and fold the baseline numbers into
the finding-#8 entry in §13.

---

## 2. ⚠️ Speed Insights baseline — the first real evidence for finding #8

**Priority: high (as evidence), no action yet**

First production measurement, **4 Aug 2026, Desktop, P75** — ⚠️ **n = 1 visitor, 1
pageview of `/domain`.** Statistically meaningless on its own; recorded because the
*shape* is informative and because a baseline taken before Clarity was added is worth
having.

| Metric | Value | |
| --- | --- | --- |
| **TTFB** | **1.36 s** | amber |
| **FCP** | **3.15 s** | red |
| **LCP** | **3.15 s** | amber |
| INP | 8 ms | ✅ excellent |
| CLS | 0 | ✅ perfect |
| **Real Experience Score** | **85** | Needs Improvement (<90) |

What the shape says:

1. `FCP == LCP == 3.15s` **exactly** — the largest element paints at the same instant as
   the first content, consistent with one server-delivered chunk rather than progressive
   rendering.
2. **TTFB is 43% of time-to-first-paint.** A CDN-cached page should be 50–200 ms. 1.36 s
   is the signature of per-request server work — a function invocation plus a Neon round
   trip on every view, which is exactly what `force-dynamic` costs.
3. **INP and CLS are excellent.** The client-side code is not the problem. The problem is
   entirely server latency.

**Action:** let traffic accumulate for a few days, then re-read. If TTFB holds around
1.3 s at a real sample size, that is the strongest argument yet for resolving the
**#8-DR** geo decision and making the public pages static.

⚠️ Re-read the **baseline vs. current** distinction when you do: Clarity was added *after*
these numbers. It is idle-deferred specifically to avoid disturbing INP/CLS, but that is a
prediction, not a measurement.

---

## 3. Two table-overflow follow-ups (deliberately parked, now unblocked)

Both were held until the `min-w-0` fix was verified. It is, so both are now decidable.

### 3a. Redundant nested overflow container

`src/components/table/DataTable.tsx:261` uses `overflow-auto` on the bordered card, and
`src/components/ui/table.tsx:11` has `relative w-full overflow-x-auto` immediately inside
it. **Two nested scroll containers.** The inner one wins, so the outer is dead weight.

Harmless today, but it is the kind of thing that produces a puzzling double scrollbar
later. Also note the outer is `overflow-auto` (**both axes**) where only the x axis is
wanted.

**Action:** collapse to one container, on the x axis only. Low risk, small diff.

### 3b. ⚠️ Rich-text tables have no overflow container at all

`sanitize-html.ts` permits `<table>`, and the content scan found **3 uses across 415
rows**. Those render via `dangerouslySetInnerHTML` with no wrapper, so a wide one has
nothing to scroll inside.

Now that `<main>` is capped by `min-w-0`, such a table would **spill or clip rather than
scroll** — arguably worse than the old behaviour for those specific pages.

**Action:** a CSS rule scoped to `.rich-text-content` in `globals.css`. ⚠️ Non-obvious:
`display: block; overflow-x: auto` on a `<table>` changes its rendering, so the fix needs
care rather than the first snippet you find.

**Not yet verified** which 3 pages these are, or whether any is actually wide enough to
overflow. Worth checking before writing the CSS — the fix may be unnecessary.

---

## 3c. ⚠️ `NarrativeLayout` is invisible in dark mode — DEFERRED BY DECISION

**Priority: real bug, consciously deferred on 4 Aug 2026. Not an oversight.**

`src/components/domain/NarrativeLayout.tsx:31`:

```tsx
<h1 className="text-3xl font-bold text-slate-800 mb-6">{page.title}</h1>
```

`text-slate-800` is `#1e293b` — near-black text on a dark background, so **the page title
is effectively invisible in dark mode.** Exactly the class of hardcoded-colour bug that
#21 spent seven phases removing; this file was missed because #21 covered the admin panel,
not the public layouts.

It is also the only public layout with **no divider** under its heading, so it is visually
inconsistent with the other five regardless of theme.

**Why it is still here:** when `PageHeading` was extracted (which fixed the same class of
problem in the other five layouts and normalised the spacing), converting this file was
explicitly excluded from scope. Everything needed is ready — swapping its heading for
`<PageHeading title={page.title} />` deletes the hardcoded colour and adds the missing
divider in one line.

⚠️ **Reachability not measured.** `NarrativeLayout` is the `default` case in the
`contentType` switch in `src/app/domain/[...slug]/page.tsx`, and `narrative` is the schema
default for `Page.contentType` — so it is reachable. But the known counts (table 666,
rich_text 418, subcategory_list 74, section_based 5 = 1,163 of ~1,198) leave only ~35 pages
unaccounted for, some of which are `__main__` rows. **Worth counting how many pages
actually render this layout before deciding urgency** — if it is zero, deleting the
component is a better fix than styling it.

---

## 3d. ⚠️ Focus ring sticks on the Share and Theme buttons — ONE-TOKEN FIX, NOT APPLIED

**Priority: small, visible, and already diagnosed. Should be quick.**

**Reproduce:** open the Share menu → click *Copy link* → click outside to dismiss. The
button keeps a pale ring around it until focus moves elsewhere.

**Cause:** Radix returns focus to the trigger when the menu closes (correct accessibility
behaviour). Closing by **mouse** means the browser's last input modality is pointer, so the
trigger matches `:focus` but **not** `:focus-visible`. Both files gate the outline reset
behind `focus-visible`, so nothing removes the user-agent outline in that state — and
`src/app/globals.css:117` applies `outline-ring/50` to `*`, which colours it with the theme
ring token. Hence a pale ring rather than Chrome's usual white one.

**Fix — drop the `focus-visible:` prefix from `outline-none` only, in two files:**

```
src/components/domain/ShareButton.tsx:280
src/components/ThemeToggle.tsx:54
```

```diff
- 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
+ 'outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer'
```

⚠️ Killing the outline unconditionally is safe **only** because `focus-visible:ring-2
ring-ring` stays — that is what keyboard users see. Remove both halves and this becomes an
accessibility regression. This is also exactly what shadcn's own
`src/components/ui/button.tsx` does: a bare `outline-none` plus a `focus-visible` ring.

**Both files together**, because they sit side by side in the breadcrumb bar — fixing one
would give two adjacent, visually identical buttons different focus behaviour.

⚠️ Recorded here because this fix was attempted twice and silently failed to apply both
times, and was reported as done when it was not. **Verify with a grep after editing**, not
by assumption:

```bash
grep -n "outline-none" src/components/domain/ShareButton.tsx src/components/ThemeToggle.tsx
# both lines must show a BARE `outline-none`, not `focus-visible:outline-none`
```

---

## 4. Bingbot JavaScript rendering — the biggest unknown

**Priority: high. Cheap to check, and it gates whether Bing SEO is worth any effort.**

**Over half the site's content is fetched client-side:**

- `TableLayout.tsx` is `'use client'` and loads rows in a `useEffect` → **table rows are
  not in the server-rendered HTML**
- That is **~652 of ~1,198 pages**, and the rows *are* the content
- The sidebar and header are likewise client-fetched via `/api/page-context`

`robots.ts:78` explicitly allows both endpoints — but read its own comment: *"**Googlebot**
renders JavaScript…"*. The allow-list is correct; the assumption behind it is about
Googlebot. **Bingbot's JS rendering is weaker and less predictable.**

**Action:** Bing Webmaster Tools → **URL Inspection** on a table page (e.g.
`https://atno.io/domain/gdesign/ytubeplaylist`) → look at the **rendered HTML / Bingbot
view**. Either the rows are there or they are not.

If they are missing, that is not a Bing problem to patch — it is another argument for #8,
which would put the content in the initial HTML for **every** crawler.

---

## 5. IndexNow — instant recrawl on content change

**Priority: low. Do after #4 confirms Bing can read the pages.**

Bing's instant-submission protocol: ping a URL, Bing recrawls within minutes instead of
days. It fits this project unusually well, because **content is created through the admin
panel, not by deploying** — so there is no build event for a crawler to notice.

The natural hook is `src/lib/cache-invalidation.ts`, which already fires on every mutation
and already knows what changed.

⚠️ Pointless until #4 shows Bing renders the content. Ordering matters.

---

## 6. Consent Mode — EEA visitors

**Priority: low, but it is a legal question rather than a technical one**

`targetCountries` names IN/US/GB/AU/CA, but **the site is publicly reachable worldwide** —
EEA visitors land on it and get the US view. GA4 and Clarity both run with no consent
banner.

Running analytics this way is a common practical setup and the exposure for a small
directory is low. Noting it because it is a decision, not an oversight.

The mechanisms if it is ever wanted:
- **Clarity** — `Clarity.consentV2({ ad_Storage, analytics_Storage })`, already available
  and typed via `@microsoft/clarity` (this is why the npm package was chosen over the raw
  snippet)
- **GA4** — Google Consent Mode v2
- **Vercel Analytics / Speed Insights** — cookieless, so largely outside the question

---

## 7. `npm audit` — 18 vulnerabilities, 3 critical

**Priority: unknown, needs 20 minutes to triage**

Reported across the 570-package tree during the analytics installs. **Not investigated,
and not attributed** — almost certainly pre-existing given the dependency set (Next,
Prisma, Lexical, Radix), but that was assumed rather than checked.

**Action:** run `npm audit`, separate direct dependencies from transitive ones, and check
whether anything reachable at runtime is affected. Deliberately *not* folded into a feature
commit.

---

## 8. Should the horizontal-scroll fix become finding #24?

**Priority: bookkeeping**

The `min-w-0` fix on `src/app/domain/layout.tsx` was a real, user-reported, user-visible
bug with a measured cause and a verified fix — and its **sibling in the admin panel is
already numbered** (G-3a). `NEW-IMPROVEMENTS.md` currently stops at #23.

Arguments for numbering it: consistency, and the finding generalises (any wide child of
`<main>`, not just tables — which is exactly what item 3b is about).

Argument against: `NEW-IMPROVEMENTS.md` is already 438 KB, and the reasoning is fully
captured in the code comment plus the commit message.

**Action:** decide, then either add it or note explicitly that it was decided against so
nobody re-opens the question.

---

*Companion documents: `ARCHITECTURE.md` (how the system works) · `NEW-IMPROVEMENTS.md`
(findings #1–#23) · `REORDERED-EXECUTION-PLAN.md` (phase status).*
