// src/app/api/submit/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isSafeHttpUrl } from '@/lib/submission-kinds';
import {
  checkRateLimit,
  isHoneypotFilled,
  optionalText,
  publicText,
  verifyFormToken,
} from '@/lib/public-forms';

/**
 * `POST /api/submit` — a tool suggestion or a domain request (M-6).
 * ============================================================================
 *
 * ⚠️ PUBLIC, LIKE `/api/feedback`. Every defence in `lib/public-forms.ts` applies, in the same
 * order and for the same reasons. The differences from feedback are all below and each is
 * deliberate.
 */

/**
 * ⚠️ A DISCRIMINATED UNION, NOT ONE SCHEMA WITH OPTIONAL FIELDS.
 *
 * The two kinds genuinely have different requirements: a tool suggestion without a link is
 * useless, and a domain request cannot have one. A single schema with `productUrl` optional would
 * accept a linkless tool suggestion — which is the exact case worth rejecting — so the shape is
 * split and zod picks the branch from `kind`.
 *
 * ⚠️ `z.url()` IS NOT A SECURITY CHECK. It validates URL *shape*; `javascript:alert(1)` passes it
 * cleanly. The `refine` is what confines the value to http/https, and it is the reason the admin
 * queue is allowed to render this as a clickable link at all. See `isSafeHttpUrl`.
 */
const urlField = z
  .string()
  .trim()
  .max(2000)
  .refine(isSafeHttpUrl, { message: 'Give a full link starting with http:// or https://' });

const sharedFields = {
  productName: publicText(200),
  description: publicText(2000),

  /*
    ⚠️ REQUIRED HERE, UNLIKE FEEDBACK. Acting on a suggestion nearly always means asking a
    question first — "is this yours?", "which page did you mean?" — and a suggestion we cannot
    follow up on mostly gets dropped. Feedback is the opposite case: demanding an address to
    report a broken button loses the report.
  */
  submitterName: publicText(120),
  submitterEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'That does not look like an email address.',
    }),

  /*
    ⚠️ THE ID AND THE NAME ARE BOTH ACCEPTED, AND BOTH ARE SNAPSHOTTED. See the model comment: a
    submission is a historical record, so it must stay readable after the domain it names is
    deleted. Storing only the id would leave an orphaned uuid nobody can interpret.

    ⚠️ THE NAME IS NOT TRUSTED TO MATCH THE ID — it is re-derived server-side below. Taking the
    client's word would let someone post `domainId: <real>` with `domainName: "<script>…"`, which
    lands unchecked text in the admin's queue under the appearance of a verified field.
  */
  domainId: optionalText(64),
};

const SubmissionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tool'), ...sharedFields, productUrl: urlField }),
  z.object({
    kind: z.literal('domain-request'),
    ...sharedFields,
    /*
      ⚠️ OPTIONAL, BUT STILL SCHEME-CHECKED WHEN PRESENT. "Optional" must not become "unvalidated"
      — someone requesting a domain may well paste an example link, and it reaches the same admin
      screen as every other URL.
    */
    productUrl: urlField.optional(),
  }),
]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // ── 1. Honeypot — accepted-then-discarded, never an error. See the note in api/feedback. ─────
  if (isHoneypotFilled(body)) {
    console.info('[submit] honeypot tripped — accepted and discarded');
    return NextResponse.json({ ok: true });
  }

  // ── 2. Signed timing token ───────────────────────────────────────────────────────────────────
  const token = verifyFormToken(body.issuedAt, body.formToken);
  if (token === 'expired') {
    return NextResponse.json(
      { error: 'This form has been open too long. Please reload the page and send it again.' },
      { status: 400 }
    );
  }
  if (token !== 'ok') {
    console.info(`[submit] form token rejected: ${token}`);
    return NextResponse.json({ ok: true });
  }

  /*
    ── 3. Rate limit ─────────────────────────────────────────────────────────────────────────────
    ⚠️ `submission` IS A TIGHTER BUDGET THAN `feedback` — 5 per 10 minutes against 10. Reporting
    several bugs in one sitting is normal; proposing five tools in ten minutes is either a very
    productive afternoon or a link-spam run, and link spam is precisely what a "suggest a tool"
    form attracts.
  */
  const limit = await checkRateLimit('submission', request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'That is a lot of suggestions at once. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  // ── 4. Shape, length and URL scheme ──────────────────────────────────────────────────────────
  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the form and try again.',
        // Field names and messages only — never the submitted values echoed back.
        fields: parsed.error.issues.map((i) => ({
          field: String(i.path[0] ?? ''),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  /*
    ── 5. Resolve the domain NAME from the id, server-side ──────────────────────────────────────
    ⚠️ THE CLIENT'S `domainName` IS IGNORED ENTIRELY. This is the one field where a submission
    could otherwise smuggle arbitrary text into a position that LOOKS authoritative in the admin
    queue — a real domain id beside a fabricated name. Looking it up costs one indexed query.

    ⚠️ AND THE LOOKUP IS FILTERED TO PUBLISHED. An unfiltered `findUnique` would confirm whether a
    given id belongs to a DRAFT domain, by whether a name comes back — a small existence oracle,
    but the exact shape of leak the plan warns about for the cascade.

    An id that resolves to nothing simply stores nothing. That is the same outcome as "not sure",
    which is a first-class answer here, so there is no error to raise.
  */
  let domainId: string | null = null;
  let domainName: string | null = null;

  if (data.domainId) {
    const domain = await prisma.domain.findFirst({
      where: { id: data.domainId, status: 'PUBLISHED' },
      select: { id: true, name: true },
    });
    if (domain) {
      domainId = domain.id;
      domainName = domain.name;
    }
  }

  try {
    await prisma.submission.create({
      // The parsed object plus server-derived values — never a spread of `body`. See api/feedback.
      data: {
        kind: data.kind,
        productName: data.productName,
        productUrl: data.productUrl ?? null,
        description: data.description,
        submitterName: data.submitterName,
        submitterEmail: data.submitterEmail,
        domainId,
        domainName,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[submit] insert failed', error);
    return NextResponse.json(
      { error: 'Something went wrong saving that. Please try again.' },
      { status: 500 }
    );
  }
}
