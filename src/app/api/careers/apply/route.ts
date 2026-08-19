// src/app/api/careers/apply/route.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getPrivateStorage } from '@/lib/storage';
import { RESUME_MAX_BYTES, looksLikePdf, resumeObjectKey } from '@/lib/job-types';
import {
  HONEYPOT_FIELD,
  checkRateLimit,
  publicText,
  verifyFormToken,
} from '@/lib/public-forms';

/**
 * `POST /api/careers/apply` — a job application, with a CV (M-8).
 * ============================================================================
 *
 * ⚠️ MULTIPART, NOT JSON — the first form on this site that is. Every M-4 defence still applies,
 * but each one reads its input differently: the honeypot and the signed token arrive as form
 * FIELDS rather than JSON keys. `isHoneypotFilled` expects an object, so the check is inlined
 * below rather than reused; that is a two-line duplication in exchange for not bending a helper
 * around a second input shape.
 *
 * ⚠️ THIS IS THE MOST SENSITIVE ENDPOINT ON THE SITE. It accepts a document containing a person's
 * full name, email, and usually their phone number and address, from an unauthenticated stranger,
 * and stores it verbatim. Everything unusual below follows from that.
 */

const FieldsSchema = z.object({
  jobId: z.string().trim().min(1).max(64),
  name: publicText(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'That does not look like an email address.',
    }),
});

export async function POST(request: Request) {
  /*
    ── 1. Size, from the header, BEFORE reading the body ─────────────────────────────────────────
    ⚠️ `Content-Length` IS CLIENT-SUPPLIED AND CAN LIE, so this is a cheap early rejection and NOT
    the real cap — the actual byte count is checked again after the file is read. Neither check is
    sufficient alone: this one can be spoofed, and the later one only runs once the whole body has
    already been buffered into memory. Together they mean an honest 10 MB upload is refused before
    it is transferred, and a dishonest one is still refused.
  */
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > RESUME_MAX_BYTES + 64 * 1024) {
    return NextResponse.json(
      { error: 'That file is too large. Please attach a PDF under 2 MB.' },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  // ── 2. Honeypot — accepted-then-discarded, never an error. See api/feedback for why. ─────────
  const honeypot = form.get(HONEYPOT_FIELD);
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    console.info('[careers] honeypot tripped — accepted and discarded');
    return NextResponse.json({ ok: true });
  }

  // ── 3. Signed timing token ───────────────────────────────────────────────────────────────────
  const token = verifyFormToken(form.get('issuedAt'), form.get('formToken'));
  if (token === 'expired') {
    return NextResponse.json(
      { error: 'This form has been open too long. Please reload the page and apply again.' },
      { status: 400 }
    );
  }
  if (token !== 'ok') {
    console.info(`[careers] form token rejected: ${token}`);
    return NextResponse.json({ ok: true });
  }

  /*
    ── 4. Rate limit ─────────────────────────────────────────────────────────────────────────────
    ⚠️ `application` IS THE TIGHTEST BUDGET OF THE THREE — 3 per HOUR, against feedback's 10 per
    ten minutes. Applying for three roles in an hour is already the top of plausible, and every
    accepted request here costs a database row AND an object in R2, which the other two do not.
  */
  const limit = await checkRateLimit('application', request);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many applications from here. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  // ── 5. Text fields ───────────────────────────────────────────────────────────────────────────
  const parsed = FieldsSchema.safeParse({
    jobId: form.get('jobId'),
    name: form.get('name'),
    email: form.get('email'),
  });
  if (!parsed.success) {
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

  /*
    ── 6. The job must exist AND be open ─────────────────────────────────────────────────────────
    ⚠️ `status: 'open'` IS PART OF THE LOOKUP, NOT A SEPARATE CHECK AFTERWARDS. A closed role stops
    accepting applications the moment it closes, and someone holding a stale form page must not be
    able to post into it. Filtering in the query also means a closed job's existence is never
    confirmed by the difference between two error messages.
  */
  const job = await prisma.job.findFirst({
    where: { id: parsed.data.jobId, status: 'open' },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json(
      { error: 'That role is no longer accepting applications.' },
      { status: 400 }
    );
  }

  // ── 7. The file ──────────────────────────────────────────────────────────────────────────────
  const file = form.get('resume');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Please attach your CV as a PDF.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // The real cap. The header check above can be spoofed; this cannot.
  if (buffer.byteLength > RESUME_MAX_BYTES) {
    return NextResponse.json(
      { error: 'That file is too large. Please attach a PDF under 2 MB.' },
      { status: 413 }
    );
  }

  /*
    ⚠️ MAGIC BYTES. Neither the filename nor `file.type` is evidence of anything — both come from
    the uploader. And unlike an image, this file is never re-encoded, so nothing downstream will
    incidentally strip a payload out of it. See `looksLikePdf`.
  */
  if (!looksLikePdf(buffer)) {
    return NextResponse.json(
      { error: 'That does not look like a PDF. Please attach your CV as a PDF file.' },
      { status: 400 }
    );
  }

  /*
    ── 8. Store, then record ─────────────────────────────────────────────────────────────────────
    ⚠️ THE ID IS GENERATED HERE RATHER THAN LET PRISMA DEFAULT IT, because the object key is
    derived from it and the object is written BEFORE the row exists. Writing the row first would
    mean a row briefly pointing at an object that is not there yet, which is the worse of the two
    orderings: a missing object is a broken download, whereas an extra object is invisible.
  */
  const applicationId = randomUUID();
  const objectKey = resumeObjectKey(applicationId);

  let storage;
  try {
    storage = await getPrivateStorage();
    await storage.putPrivate(objectKey, buffer, 'application/pdf');
  } catch (error) {
    console.error('[careers] resume upload failed', error);
    return NextResponse.json(
      { error: 'Could not store your CV. Please try again.' },
      { status: 500 }
    );
  }

  try {
    await prisma.jobApplication.create({
      data: {
        id: applicationId,
        jobId: job.id,
        name: parsed.data.name,
        email: parsed.data.email,
        resumeKey: objectKey,
        resumeBytes: buffer.byteLength,
      },
    });
  } catch (error) {
    /*
      ⚠️ THE OBJECT IS CLEANED UP WHEN THE ROW FAILS. Without this, a failed insert leaves someone's
      CV sitting in the bucket with nothing referencing it — unreachable through the admin and
      therefore undeletable through it, while still being personal data we are holding.

      Best-effort: if the cleanup itself fails there is nothing further to do here, and the
      original error is the one worth returning. It is logged so the orphan can be found.
    */
    console.error('[careers] application insert failed; removing orphaned object', error);
    await storage
      .deletePrivate(objectKey)
      .catch((cleanupError) =>
        console.error(`[careers] ORPHANED OBJECT ${objectKey} — delete it manually`, cleanupError)
      );

    return NextResponse.json(
      { error: 'Something went wrong saving your application. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
