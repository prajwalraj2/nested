// src/lib/public-forms.ts

import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Shared defences for every PUBLIC form on the site (M-4).
 * ============================================================================
 *
 * ⚠️ BUILT ONCE, BEFORE THE SECOND AND THIRD FORMS EXIST. Feedback (M-5), Submissions (M-6) and
 * job applications (M-8) all need the same protections; writing them per-route means three
 * implementations and two of them will be weaker than the first.
 *
 * ⚠️ WHY THIS FILE EXISTS AT ALL — THE PREMISE THAT CHANGED.
 *
 * #35 removed HTML sanitisation on an explicit premise: **only a single trusted admin ever writes
 * content here.** That was sound, and it still holds for rich text and roadmaps. A public form
 * breaks it for a NEW surface — for the first time, strangers write into this database. This file
 * is the different contract that surface needs. It does not undo #35; it fences off the one area
 * where #35's assumption stops being true.
 *
 * ⚠️ TWO DIFFERENT THREATS LIVE HERE, AND THEY HAVE DIFFERENT ATTACKERS. Keeping them apart is
 * what stops the defences being mixed up:
 *
 *   1. VOLUME — a bot, not aimed at us. It found a form and posts link spam to it. Costs: junk in
 *      the admin, rows in Neon, money. Countered by `checkRateLimit`, the honeypot and the timing
 *      check. Annoying if it gets through; not dangerous.
 *
 *   2. CONTENT — ⚠️ a person, aimed at US. They submit `<script>` hoping it runs when the admin
 *      opens the review screen, where it would execute in a logged-in session on the same origin
 *      as the admin API — able to do anything the admin can. This is STORED XSS, it needs exactly
 *      ONE submission, and rate limiting is irrelevant to it. The only defence is the rule that
 *      this data renders as TEXT and never as HTML, enforced in `eslint.config.mjs`.
 *
 * ⚠️ NONE OF THIS MAKES THE FORMS "SECURE" IN AN ABSOLUTE SENSE. It raises the cost. An attacker
 * with many addresses defeats the rate limit; that is expected, and why Turnstile is recorded as
 * the ESCALATION if spam actually arrives rather than as the starting point.
 */

/* ────────────────────────────────────────────────────────────────────────────
   Key derivation
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ AN HMAC, NOT A PLAIN HASH — AND THE DIFFERENCE IS NOT PEDANTRY.
 *
 * The plan specified `sha256("feedback:" + ip)`. A bare hash of an IP address is **not
 * anonymisation**: there are only ~4 billion IPv4 addresses, so every possible digest can be
 * computed on a laptop in minutes and the table reversed wholesale. It is a reversible encoding
 * of personal data wearing a disguise.
 *
 * Keying the digest with a server-side secret is what makes the output a genuine pseudonym —
 * without the key there is nothing to enumerate against.
 *
 * ⚠️ `AUTH_SECRET` IS REUSED DELIBERATELY, AND SAFELY. A dedicated variable would be one more
 * thing to set on every environment and one more thing to forget in a new one, and a rate limiter
 * that silently stops working is worse than this. The `ratelimit-v1:` label DOMAIN-SEPARATES the
 * derivation: an HMAC under a distinct label cannot be substituted for one under another, so this
 * can never collide with or weaken NextAuth's own use of the same secret.
 */
function sourceKey(action: PublicAction, ip: string): string {
  const secret = process.env.AUTH_SECRET;

  /*
    ⚠️ THROW RATHER THAN FALL BACK TO A CONSTANT. A missing secret with a hard-coded default would
    give every deployment the same key — a silently degraded limiter, which is the failure mode
    hardest to notice. This is a startup-time misconfiguration and should read like one.
  */
  if (!secret) {
    throw new Error(
      '[public-forms] AUTH_SECRET is not set. It derives the rate-limit key; refusing to run with a predictable one.'
    );
  }

  return createHmac('sha256', secret).update(`ratelimit-v1:${action}:${ip}`).digest('hex');
}

/**
 * The visitor's address, as best the platform will tell us.
 *
 * ⚠️ `x-real-ip` FIRST. Vercel sets it to the connecting client. `x-forwarded-for` is a
 * comma-separated chain and the FIRST entry is the client, but it is the header a proxy is most
 * likely to have had appended to, so it is the fallback rather than the primary.
 *
 * ⚠️ 'unknown' IS A REAL BUCKET, NOT AN ERROR. Locally there is no such header, so every request
 * shares one counter — which would mean tripping your own limit within a minute of testing. That
 * is why `checkRateLimit` treats non-production differently; see the note there.
 */
function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

/* ────────────────────────────────────────────────────────────────────────────
   Rate limiting
   ──────────────────────────────────────────────────────────────────────────── */

export type PublicAction = 'feedback' | 'submission' | 'application';

/**
 * ⚠️ PER ACTION, NOT ONE GLOBAL NUMBER. Reporting three bugs in ten minutes is normal behaviour;
 * applying for three jobs in ten minutes is not. A single shared limit has to be set loose enough
 * for the most frequent action, which makes it useless for the rarest.
 */
const LIMITS: Record<PublicAction, { max: number; windowSeconds: number }> = {
  feedback: { max: 10, windowSeconds: 600 },
  submission: { max: 5, windowSeconds: 600 },
  application: { max: 3, windowSeconds: 3600 },
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

/**
 * Count this request against its source's budget.
 *
 * ⚠️ ONE ATOMIC SQL STATEMENT, NOT READ-THEN-WRITE. The obvious `findUnique` → decide → `update`
 * loses races: two simultaneous requests both read 9, both write 10, and the limit is quietly one
 * higher than configured under exactly the concurrency an attacker produces. `INSERT … ON CONFLICT
 * DO UPDATE` performs the window reset AND the increment in a single statement the database
 * serialises for us.
 *
 * ⚠️ FAILS OPEN. If Postgres is unreachable this ALLOWS the submission and logs loudly. The
 * alternative — refusing on error — turns any database blip into a free denial of service against
 * our own contact form. This is spam control, not authentication: the cost of letting one through
 * is junk in a queue, the cost of blocking everyone is silence from real users. ⚠️ Do NOT copy
 * this posture to anything that guards access.
 */
export async function checkRateLimit(
  action: PublicAction,
  request: Request
): Promise<RateLimitResult> {
  const ip = clientIp(request);

  /*
    ⚠️ NON-PRODUCTION IS EXEMPT, AND THIS IS NOT LAZINESS. Locally every request resolves to the
    same 'unknown' source, so the eleventh page reload while building a form would lock you out of
    your own site for ten minutes. The log line keeps it visible rather than invisible.

    `VERCEL_ENV` is set by the platform, so this is false on preview and production deployments and
    true only under `npm run dev` — the same gate `ClarityAnalytics` uses.
  */
  if (process.env.VERCEL_ENV !== 'production' && ip === 'unknown') {
    console.info(`[public-forms] rate limit skipped for "${action}" — no client IP outside production`);
    return { ok: true };
  }

  const { max, windowSeconds } = LIMITS[action];
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);

  try {
    /*
      Reads as: insert a fresh counter, or — if one exists — restart it when its window has expired
      and otherwise add one to it. `RETURNING` hands back the post-increment state, so the decision
      below needs no second query.
    */
    const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart")
      VALUES (${sourceKey(action, ip)}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count"       = CASE WHEN "RateLimit"."windowStart" <= ${cutoff} THEN 1     ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
      RETURNING "count", "windowStart";
    `;

    const row = rows[0];
    if (!row) return { ok: true };

    if (row.count > max) {
      const resetsAt = row.windowStart.getTime() + windowSeconds * 1000;
      return { ok: false, retryAfter: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)) };
    }

    /*
      ⚠️ OPPORTUNISTIC PRUNING, BECAUSE NOTHING ELSE EVER DELETES FROM THIS TABLE. Without it the
      row count grows with every distinct visitor forever. Running it on roughly 1% of requests
      keeps it off the hot path while still being certain to happen on any site with traffic — and
      a cron job for a table this trivial is more moving parts than it is worth.

      Not awaited: the caller must not wait on housekeeping. `.catch` is mandatory because an
      unhandled rejection from a floating promise can take down the process.
    */
    if (Math.random() < 0.01) {
      const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.rateLimit
        .deleteMany({ where: { windowStart: { lt: staleBefore } } })
        .catch((error) => console.error('[public-forms] prune failed', error));
    }

    return { ok: true };
  } catch (error) {
    console.error(`[public-forms] rate limit unavailable for "${action}" — allowing`, error);
    return { ok: true };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Honeypot
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ THE NAME IS CHOSEN TO AVOID BROWSER AUTOFILL, WHICH IS THE WHOLE DIFFICULTY.
 *
 * `company`, `website`, `organization` and `url` are the obvious-looking choices and are all
 * WRONG: browsers and password managers autofill them, so a real visitor with autofill enabled
 * silently fails the check and never learns why. A false positive here is invisible to us and
 * infuriating to them.
 *
 * `subject_line` is plausible enough that a naive bot fills every field it sees, while matching no
 * autofill heuristic in any browser.
 *
 * ⚠️ HIDE IT WITH OFF-SCREEN POSITIONING, NOT `type="hidden"` AND NOT `display: none`. A hidden
 * input is skipped by the very bots this targets, and some skip `display: none` too. The field
 * must be present and fillable in the DOM but invisible to a person. Give it `tabIndex={-1}`,
 * `autoComplete="off"` and `aria-hidden="true"` so keyboard and screen-reader users skip it.
 */
export const HONEYPOT_FIELD = 'subject_line';

export function isHoneypotFilled(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD];
  return typeof value === 'string' && value.trim().length > 0;
}

/* ────────────────────────────────────────────────────────────────────────────
   Timing token
   ──────────────────────────────────────────────────────────────────────────── */

/** Below this, nobody typed it. */
const MIN_FILL_SECONDS = 2;
/** Above this, the page has been open long enough that the form should be reloaded. */
const MAX_FORM_AGE_SECONDS = 2 * 60 * 60;

/**
 * Issue the pair of hidden fields that prove when the form was rendered.
 *
 * ⚠️ SIGNED, BECAUSE AN UNSIGNED TIMESTAMP IS DECORATION. The plan called for `isTooFast(
 * renderedAt)` reading a plain hidden field — which a bot defeats by writing "two minutes ago"
 * into it. Ten extra lines turn a check that only stops the laziest scripts into one that cannot
 * be forged without the server secret.
 */
export function issueFormToken(): { issuedAt: string; token: string } {
  const issuedAt = String(Date.now());
  return { issuedAt, token: signIssuedAt(issuedAt) };
}

export type FormTokenResult = 'ok' | 'invalid' | 'too-fast' | 'expired';

export function verifyFormToken(issuedAt: unknown, token: unknown): FormTokenResult {
  if (typeof issuedAt !== 'string' || typeof token !== 'string') return 'invalid';

  const expected = signIssuedAt(issuedAt);

  /*
    ⚠️ `timingSafeEqual`, NOT `===`. String comparison exits at the first differing byte, so how
    long it takes leaks how much of the prefix was right — enough, over many attempts, to
    reconstruct a signature. It also THROWS on length mismatch, hence the explicit guard.
  */
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'invalid';

  const ageSeconds = (Date.now() - Number(issuedAt)) / 1000;
  if (!Number.isFinite(ageSeconds)) return 'invalid';
  if (ageSeconds < MIN_FILL_SECONDS) return 'too-fast';
  if (ageSeconds > MAX_FORM_AGE_SECONDS) return 'expired';

  return 'ok';
}

function signIssuedAt(issuedAt: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('[public-forms] AUTH_SECRET is not set; cannot sign form tokens.');
  return createHmac('sha256', secret).update(`formtoken-v1:${issuedAt}`).digest('hex');
}

/* ────────────────────────────────────────────────────────────────────────────
   Field validation
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ ZOD PIECES RATHER THAN THE BESPOKE `capped()` AND `looksLikeEmail()` THE PLAN LISTED.
 *
 * This codebase already validates with zod — `api/admin/users/route.ts` and its `[id]` sibling do.
 * A second hand-rolled validator living beside it is precisely how two conventions drift and how
 * one of them ends up missing a case the other handles. Same guarantees, one idiom.
 *
 * ⚠️ THE SERVER CAP IS THE ONLY REAL ONE. A `maxLength` on the input is a courtesy to the person
 * typing; it is absent from a `curl`. Without a cap here a single request can write a megabyte
 * into a `@db.Text` column, and nothing stops that happening ten thousand times.
 *
 * ⚠️ REJECT, DO NOT TRUNCATE. Silently storing the first 2,000 characters of a longer message
 * loses what someone wrote and tells them nothing. If the client already capped it, exceeding the
 * limit means either a bug or an attack — both deserve an error rather than quiet data loss.
 */
export const publicText = (max: number) => z.string().trim().min(1).max(max);

/** Same, but an empty string becomes `undefined` rather than a validation error. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();

/**
 * ⚠️ DELIBERATELY LOOSE. "Has an @, has a dot after it, no spaces" catches the typos worth
 * catching. Stricter regexes routinely reject valid addresses — plus-addressing, new TLDs, unicode
 * local parts — and the only thing rejecting a real address achieves is losing the message. The
 * address is never trusted for anything either way; nothing is authorised by it.
 */
export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((value) => value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: 'That does not look like an email address.',
  })
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();
