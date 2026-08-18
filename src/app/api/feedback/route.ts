// src/app/api/feedback/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { FEEDBACK_CATEGORY_VALUES } from '@/lib/feedback-categories';
import {
  checkRateLimit,
  isHoneypotFilled,
  optionalEmail,
  optionalText,
  publicText,
  verifyFormToken,
} from '@/lib/public-forms';

/**
 * `POST /api/feedback` — the first public write endpoint on this site (M-5).
 * ============================================================================
 *
 * ⚠️ NOTE THE PATH: `/api/feedback`, NOT `/api/admin/feedback`. Every other write route on this
 * site sits under `/api/admin/` and begins with `requireAdmin()`. This one deliberately does not,
 * which is exactly why every defence in `lib/public-forms.ts` exists. If a future route lands
 * outside `/api/admin/` without going through those checks, that is the bug to look for.
 *
 * ⚠️ IT STORES, IT DOES NOT RENDER. Nothing this endpoint writes is ever published. The only place
 * this data is displayed is the admin queue, and it renders there as text — see the lint rule in
 * `eslint.config.mjs`.
 */

const FeedbackSchema = z.object({
  /*
    ⚠️ A CLOSED SET, VALIDATED SERVER-SIDE. The `<select>` constrains the honest and nobody
    else — a posted `category` of anything at all would otherwise be stored and then never match
    a filter in the admin queue, so the report would be invisible rather than merely mislabelled.
  */
  category: z.enum(FEEDBACK_CATEGORY_VALUES),

  /*
    ⚠️ 4,000 CHARACTERS. Long enough for a genuinely detailed bug report — several paragraphs plus
    reproduction steps — and short enough that ten thousand automated posts cost megabytes rather
    than gigabytes. The `<textarea>` carries the same number, but that one is only a courtesy: it
    is absent from a `curl`, which is why this is the cap that counts.
  */
  message: publicText(4000),

  name: optionalText(120),
  email: optionalEmail,

  /*
    ⚠️ CAPPED EVEN THOUGH WE SET IT OURSELVES. It arrives in the request body like everything else,
    so "we set it" is a statement about the happy path, not about what can be posted.
  */
  pageUrl: optionalText(500),
});

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  /*
    ── 1. Honeypot ───────────────────────────────────────────────────────────────────────────────
    ⚠️ RETURNS SUCCESS. This is not a mistake and must not be "fixed" into an error.

    A bot that receives a distinct error learns which field tripped it and retries without that
    field; a bot that receives 200 has no signal at all and moves on believing it succeeded. The
    cost of being wrong is one lost message from a person with unusual autofill — which is why the
    field name was chosen to be one no browser autofills. See `HONEYPOT_FIELD`.
  */
  if (isHoneypotFilled(body)) {
    console.info('[feedback] honeypot tripped — accepted and discarded');
    return NextResponse.json({ ok: true });
  }

  /*
    ── 2. Timing ─────────────────────────────────────────────────────────────────────────────────
    The token is signed, so `issuedAt` cannot simply be back-dated. `invalid` means forged or
    absent; `too-fast` means submitted in under two seconds, which nobody typed.

    ⚠️ `expired` GETS A DIFFERENT, HONEST MESSAGE. A form left open overnight is a real person
    whose message would otherwise vanish with no explanation — telling them to reload is the whole
    difference between a recoverable annoyance and a lost report.
  */
  const token = verifyFormToken(body.issuedAt, body.formToken);
  if (token === 'expired') {
    return NextResponse.json(
      { error: 'This form has been open too long. Please reload the page and send it again.' },
      { status: 400 }
    );
  }
  if (token !== 'ok') {
    console.info(`[feedback] form token rejected: ${token}`);
    return NextResponse.json({ ok: true });
  }

  /*
    ── 3. Rate limit ─────────────────────────────────────────────────────────────────────────────
    ⚠️ AFTER the two free checks and BEFORE the database write. The cheap in-memory tests should
    reject obvious junk without touching Postgres at all; the limiter costs one query, so it goes
    ahead of the insert but behind them.

    `Retry-After` is a standard header and well-behaved clients honour it. It is also simply
    honest: "try again" without saying when is not useful.
  */
  const limit = await checkRateLimit('feedback', request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'That is a lot of feedback in a short time. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  // ── 4. Shape and length ─────────────────────────────────────────────────────────────────────
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    /*
      ⚠️ FIELD NAMES AND MESSAGES ONLY — never the submitted values echoed back. Reflecting input
      into a response is how a validation error becomes a reflected-XSS vector, and there is
      nothing useful in it for the person anyway: they can see what they typed.
    */
    return NextResponse.json(
      {
        error: 'Please check the form and try again.',
        fields: parsed.error.issues.map((i) => ({
          field: String(i.path[0] ?? ''),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    await prisma.feedback.create({
      /*
        ⚠️ THE PARSED OBJECT, NOT `body`. Spreading the raw request would let an attacker set
        `status: 'resolved'` — or `id`, or `createdAt` — because Prisma happily accepts any field
        it recognises. Passing only what the schema produced is what makes that impossible, and it
        is the same mass-assignment mistake the rebuild-by-field-list bug keeps producing in
        reverse.
      */
      data: {
        category: parsed.data.category,
        message: parsed.data.message,
        name: parsed.data.name ?? null,
        email: parsed.data.email ?? null,
        pageUrl: parsed.data.pageUrl ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[feedback] insert failed', error);
    return NextResponse.json(
      { error: 'Something went wrong saving that. Please try again.' },
      { status: 500 }
    );
  }
}
