# Roadmaps — building one, and the rules that keep it working

A roadmap is a step-by-step learning path: a tree of topics, drawn as a branching diagram, where
any topic can open a panel of detail. `/admin/roadmaps`.

> ⚠️ **Nothing you write here is cleaned or checked.** HTML sanitisation was removed site-wide
> (#35), and the roadmap colour rule is enforced by discipline rather than by code — that was a
> deliberate decision, recorded in `SANITISER-REMOVAL.md`. **This document is the control.** §3 and
> §7 are the two sections that matter most; read them once properly.

> ⚠️ **This file names Tailwind class strings.** Tailwind v4 scans `.md` files, so any literal
> class written here is generated into the CSS whether or not a component uses it. That is
> harmless, but it means **a class cannot be proven safe by finding it in documentation** — see §7.

---

## 1. The shape of a roadmap

```
Domain: Web Development
└── Page "Roadmap"            type: Subcategory list   →  /domain/webdev/roadmap
      ├── Page "Frontend"     type: Roadmap            →  /domain/webdev/roadmap/frontend
      ├── Page "Backend"      type: Roadmap            →  /domain/webdev/roadmap/backend
      └── Page "Full-stack"   type: Roadmap            →  /domain/webdev/roadmap/fullstack
```

**Each role is its own page.** That is why every role has its own URL, its own status, its own
icon and its own place in the sidebar — and why the "Choose your role" dropdown needs no
configuring at all. It is simply *"my sibling pages that are also roadmaps"*.

⚠️ **A domain with only one roadmap skips the chooser entirely.** One page, type Roadmap, done.
The dropdown does not render when there is nothing to choose between.

---

## 2. Setting one up

| | |
| --- | --- |
| 1 | **Admin → Pages** → new page, content type **Roadmap**. For multiple roles, first make a **Subcategory list** page to hold them, then one Roadmap page per role underneath it. |
| 2 | **Admin → Roadmaps** → pick the domain → **Create roadmap** on that page. |
| 3 | Set the **heading** and **intro line**. |
| 4 | Add topics. |

### Heading vs page title

They are different fields on purpose.

- **Page title** — what the sidebar, the breadcrumb and the role dropdown show. Keep it short:
  *Frontend*.
- **Roadmap heading** — the `<h1>` on the page itself. Room to be fuller: *Frontend Developer*.

### The intro line

⚠️ **Plain text, no HTML.** It also becomes this page's description in search results, where
markup would render as literal characters.

---

## 3. ⚠️ The one rule: never set a colour

**Not with `style`. Not with a `class`. Not anywhere — not in a topic title, not in sheet content.**

```html
<h3>Description</h3>                                    ✅
<p style="margin-bottom: 0.75rem;">Text</p>             ✅ spacing is fine
<hr style="border-color: #9ca3af;">                     ✅ a mid-grey rule reads on both themes
<p style="color: #000000;">Text</p>                     ❌ NEVER
<p class="text-⟨any-colour⟩">Text</p>                   ❌ NEVER
<div style="background-color: #fff;">…</div>            ❌ NEVER
```

*(The `⟨…⟩` brackets are deliberate — a real class name written here would be generated into the
CSS and then look safe. See the note at the top.)*

### Why, with the worked example

Rich-text pages were authored the same way, without this rule. When their container was changed to
follow the site theme, **26 pages became unreadable in dark mode overnight** — black text on a
near-black ground. They were only two documents, duplicated across domains, but they were
invisible until someone looked in the right theme.

⚠️ **An inline `style` beats every stylesheet rule**, so no CSS anywhere in the app can rescue a
colour you bake in. It has to not be there.

⚠️ **Roadmap content is new, which is the whole advantage.** Rich text has a cleanup waiting for
it. If this rule holds, roadmaps never accumulate one.

---

## 4. Topics

### Title

What appears in the box. Keep it short — every character makes the box wider, and in a branching
layout width is the scarce resource.

### Slug

The deep link: `…/roadmap/frontend?topic=kubernetes`.

- Generated from the title, editable.
- ⚠️ **Unique within one roadmap**, not globally. `docker` can exist in both the Frontend and the
  DevOps roadmap — they are independent topics.
- ⚠️ **Changing it breaks every link anyone has already shared to that topic.** Treat a published
  slug as permanent unless it is actually wrong.

### Icon

From the same set as page and domain icons. Optional, and better used sparingly — an icon on every
node is noise, an icon on the five that matter is signal.

### Order

⚠️ **The first two top-level steps are open when someone arrives for the first time.** Everything
else starts collapsed. So put the two steps that best explain the shape of the path at the top —
that is what a first-time visitor sees before they touch anything.

Returning visitors see whatever they last left expanded; the default does not override them.

### Depth

Three levels works and is what the design was built for. ⚠️ **Four is possible in the data and a
bad idea in practice** — by the fourth level the boxes are far enough right that the branching is
hard to follow. If you need it, the content probably wants restructuring into another step.

---

## 5. Connectors — two choices per topic

Both are set on the topic, in the editor, and they are independent.

### Where children appear

```
BELOW                                RIGHT
┌──────────────┐                     ┌──────────────┐
│ Networking   │                     │ Kubernetes   │─(‹)─┐
└──────(˄)─────┘                            └──────────────┘     │
       │                                                  ├─ EKS
       ├─── OSI Model                                     ├─ GKE
       └─── Subnets / CIDR                                └─ AKS
```

The expand circle sits wherever the children come out — bottom edge or right edge.

⚠️ **"To the right" costs a full extra step of horizontal space.** Below 640px wide it
automatically falls back to "below" (and the circle moves with it), so a phone never scrolls
sideways. Use it where it genuinely reads better on desktop, not by default.

### How they attach

```
ONE ARM EACH                         SHARED RAIL
├──── OSI Model                      └──┐
├──── Network Protocol                  │[ AWS ]
└──── Subnets / CIDR                    │[ Azure ]
                                        │[ GCP ]
```

⚠️ **The rule of thumb, so this is not a coin flip every time:**

| Use | When the children are | Example |
| --- | --- | --- |
| **One arm each** | a sequence — learn all of them | OSI Model · Network Protocol · Subnets |
| **Shared rail** | alternatives — pick one | AWS · Azure · GCP · · · EKS · GKE · AKS |

The shape carries that meaning without a legend. Follow it and the diagram explains itself.

---

## 6. Badges

Free text, floating on the **top-right corner** of the box: *Recommended*, *Start with this*,
*Very Important*, *Free*, *Steep curve*.

- ⚠️ **One or two per topic.** Nothing enforces this — three will overlap the expand circle. A
  silent cap would be worse, because you would never learn a badge had been dropped.
- The same word keeps the same colour down the whole page, automatically.
- Keep them short. They sit on the box edge, not inside it, so a long badge overhangs.

### The "Recommended" checkbox

⚠️ **It is stored and it does nothing on the public page.** Badges replaced it — a free-text badge
says "Recommended" just as well and can also say "Start with this". The checkbox survives in case
the data is wanted later. **Use a badge.**

---

## 7. Sheet content

The panel that opens when a topic is clicked. HTML, written directly.

⚠️ **A topic with no content is not a link.** It renders as a plain label on the diagram, with no
pointer and no hover. That is a real and useful state — several topics exist only to name an option
(*Azure*, *GCP*, *AKS*). Leave the content empty and it behaves correctly.

### What is styled for you

`.roadmap-sheet` handles the typography. Reach for plain tags and it will look right:

| Tag | Renders as |
| --- | --- |
| `<h2>` `<h3>` | a small uppercase section label with a rule under it |
| `<h4>` `<h5>` | a normal-weight subheading |
| `<p>` | body text, capped at a readable width |
| `<ul>` `<ol>` | bulleted / numbered lists |
| `<a>` | a themed link |
| `<code>` | inline code |
| `<hr>` | a divider |
| `<table>` | ⚠️ gets its **own** horizontal scroll — a wide table never drags the panel sideways |
| `<img>` | scaled to fit, rounded |

### A worked pattern

```html
<h3>Description</h3>
<ul>
  <li>What this is, in one or two sentences.</li>
  <li>Why it comes at this point in the path.</li>
</ul>

<h3>Free resources</h3>
<ul>
  <li><a href="https://example.com" target="_blank" rel="noopener noreferrer">A course</a></li>
</ul>

<h3>Tools</h3>
<table>
  <thead><tr><th>Tool</th><th>Link</th><th>Pricing</th></tr></thead>
  <tbody>
    <tr><td>kubectl</td><td><a href="…" target="_blank" rel="noopener noreferrer">docs</a></td><td>Free</td></tr>
  </tbody>
</table>
```

### ⚠️ You do NOT write the "Next" chips

The chips at the foot of the panel are generated from the topic's **children**. Add a sub-topic and
it appears there automatically. Writing your own list of links to sub-topics duplicates them.

### ⚠️ Links opening in a new tab need `rel` by hand

```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>
```

This used to be added automatically by the sanitiser. It no longer is. Without `noopener`, the page
you opened can reach back through `window.opener` and navigate the original tab.

### ⚠️ Tailwind classes are not reliable here — use `style`

Tailwind scans **source files** to decide what CSS to generate. **It never reads the database.** A
class that appears only inside your stored content produces no CSS at all: the attribute is there,
the styling is not, and nothing warns you.

- ✅ **Always safe** — inline `style`. No build step, cannot be tree-shaken away.
- ✅ **Safe** — anything already used elsewhere in the app.
- ⚠️ **Not safe** — a class you invented for this content.

**When in doubt, use `style`.**

---

## 8. ⚠️ Nothing is stripped — check what you paste

Before the sanitiser was removed, saving silently deleted `<script>`, every `on*` handler,
`javascript:` hrefs and `<iframe>`. **None of that happens now.** If you paste it, it ships to every
visitor.

Search any pasted block for:

| Search for | Why |
| --- | --- |
| `<script` | runs in every visitor's browser, same origin as the admin panel |
| `onclick` `onerror` `onload` `onmouseover` | any `on…=` attribute is executable JavaScript |
| `javascript:` | an `href` that runs code on click |
| `<iframe` `<embed` `<object` | loads someone else's page inside yours |
| `<form` `<input` | can post your visitors' data elsewhere |

⚠️ **The risk is not typing these — it is pasting a block you did not read line by line.** ChatGPT
output, a Google Docs export and a site's "copy HTML" button can all carry them.

---

## 9. Roles

- Order in the dropdown follows the **page order**, set in Admin → Pages.
- ⚠️ A **Draft** role is absent from the dropdown **and** its URL 404s. Both come from the same
  page status, so they cannot disagree — a role can never be listed and then fail to open.
- An icon on the role page shows in the dropdown.
- Roles are independent trees. A topic that belongs in two roles is **duplicated**, deliberately:
  a shared topic would need two different positions at once.

---

## 10. Before you publish

| Check | |
| --- | --- |
| Open the page in **light mode** | reads correctly |
| Open the page in **dark mode** | ⚠️ **the check that catches colour mistakes** — every box, line and word visible |
| Open on a **phone** | right-branching falls back to below; nothing scrolls sideways |
| Click a topic **with** content | panel opens; the URL gains `?topic=…` |
| Click a topic **without** content | nothing — no pointer, no hover. That is correct |
| Copy a `?topic=` URL into a new tab | opens with that panel already showing |
| Every `target="_blank"` link | has `rel="noopener noreferrer"` |
| Any pasted block | searched for the §8 list |
| The first two steps | are the two that best explain the path |

⚠️ **Dark mode is the one that matters.** A colour mistake looks perfect in light mode and
invisible in dark, and you will not notice unless you look.

---

## 11. If a second person ever gets admin access

⚠️ **Reopen the sanitiser decision.** Everything in §8 rests on one person authoring everything and
reviewing their own pastes. That does not generalise, and the failure is silent — a bad paste looks
exactly like a good one until a visitor's browser runs it.

`NEW-IMPROVEMENTS-2.md` **#35** has the full recipe to put sanitisation back, including every trap
found the hard way.

---

## Related

| Document | Contents |
| --- | --- |
| `RICH-TEXT-GUIDE.md` | The same rules for rich-text pages — §3 and §8 are shared |
| `SANITISER-REMOVAL.md` | Why nothing is sanitised, and the risk that was accepted |
| `NEW-IMPROVEMENTS-2.md` #33 | The roadmap design: why a role is a page, why topics are a table |
| `NEW-IMPROVEMENTS-2.md` #34 | The 26 pages that broke, and the measurement behind §3 |
| `ICON-GUIDE.md` | Adding an icon to the set topics can choose from |
