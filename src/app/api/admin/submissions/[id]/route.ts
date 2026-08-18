// src/app/api/admin/submissions/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { SUBMISSION_STATUSES } from '@/lib/submission-kinds';

/**
 * `PATCH` and `DELETE /api/admin/submissions/[id]` (M-6).
 *
 * ⚠️ ONLY `status` AND `adminNote` ARE MUTABLE. Everything else is a record of what someone sent
 * us — editing it would quietly rewrite a submission while leaving it looking original. The public
 * route controls the content, the admin controls the workflow, and neither can reach into the
 * other's half.
 *
 * ⚠️ `adminNote` IS OURS, NOT THEIRS. It is the one field on this model written by a trusted
 * admin, which is why it can be a free-text column with no scheme checks. It still renders as
 * text in the queue — the lint rule covers the whole directory and does not care who typed it.
 */

const patchSchema = z
  .object({
    status: z.enum(SUBMISSION_STATUSES).optional(),
    /*
      ⚠️ `.nullable()` SO A NOTE CAN BE CLEARED. Without it, `null` fails validation and the only
      way to remove a note is to save a single space — the `||` versus `??` problem from #28 in a
      different costume: "no value" and "deliberately empty" have to stay distinguishable.
    */
    adminNote: z.string().max(4000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNote !== undefined, {
    message: 'Nothing to update.',
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid update.' }, { status: 400 });
  }

  try {
    const updated = await prisma.submission.update({
      where: { id },
      /*
        ⚠️ BUILT FIELD BY FIELD FROM WHAT WAS ACTUALLY SENT, so a PATCH carrying only a status does
        not blank the note — and one carrying only a note does not reset the status. Spreading
        `parsed.data` would write `undefined` for the absent key, which Prisma ignores, but the
        explicit form states the intent rather than relying on that behaviour.
      */
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    // A row that vanished between load and save is a 404 — the update genuinely cannot be honoured.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'That submission no longer exists.' }, { status: 404 });
    }
    console.error('[admin/submissions] update failed', error);
    return NextResponse.json({ error: 'Could not update that submission.' }, { status: 500 });
  }
}

/**
 * ⚠️ A HARD DELETE, like feedback's — a `deletedAt` column would leave every row in the table
 * forever, which is the problem deleting exists to solve. The admin UI confirms first.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await prisma.submission.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Already gone is a success: deleting is idempotent, so two admin tabs must not disagree.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ ok: true });
    }
    console.error('[admin/submissions] delete failed', error);
    return NextResponse.json({ error: 'Could not delete that submission.' }, { status: 500 });
  }
}
