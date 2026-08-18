// src/app/api/admin/feedback/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { FEEDBACK_STATUSES } from '@/lib/feedback-categories';

/**
 * `PATCH /api/admin/feedback/[id]` — move one report through the queue (M-5).
 *
 * ⚠️ STATUS IS THE ONLY MUTABLE FIELD, DELIBERATELY. The message, name, email and page are a
 * RECORD OF WHAT SOMEONE SENT. Editing them would quietly rewrite a report while leaving it
 * looking original, and there is no reason an admin would need to.
 *
 * ⚠️ THIS IS ALSO WHY THE PUBLIC ROUTE MUST NEVER ACCEPT `status`. Together the two rules mean the
 * visitor controls the content and the admin controls the workflow, with no overlap in either
 * direction — see the note on `data:` in `api/feedback/route.ts`.
 */

const patchSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

export async function PATCH(
  request: NextRequest,
  /*
    ⚠️ `params` IS A PROMISE in Next 15 and must be awaited. Reading `.id` off it directly gives
    `undefined` at runtime with no type error in some call shapes — a silent 404 rather than a
    compile failure.
  */
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
    return NextResponse.json(
      { error: `Status must be one of: ${FEEDBACK_STATUSES.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.feedback.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return NextResponse.json(updated);
  } catch (error) {
    /*
      ⚠️ A MISSING ROW IS A 404, NOT A 500. Prisma throws `P2025` when `update` matches nothing,
      which happens whenever two admin tabs act on the same item — a normal race, not a fault, and
      it should not surface as "something went wrong".
    */
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'That report no longer exists.' }, { status: 404 });
    }
    console.error('[admin/feedback] update failed', error);
    return NextResponse.json({ error: 'Could not update that report.' }, { status: 500 });
  }
}

/**
 * `DELETE /api/admin/feedback/[id]` — remove one report for good.
 *
 * ⚠️ A HARD DELETE, NOT A SOFT ONE, AND THAT IS THE POINT. A `deletedAt` column would leave every
 * row in the table forever, which is precisely the "it just keeps stacking up" problem this
 * exists to solve — the queue would look clear while the storage bill did not.
 *
 * ⚠️ IT IS THEREFORE IRREVERSIBLE, so the admin UI puts a confirmation in front of it. Deleting is
 * also the only destructive operation on this data: PATCH cannot touch the message, name, email or
 * page, so a report is either exactly as it was sent, or gone.
 *
 * ⚠️ NOT EXPOSED PUBLICLY IN ANY FORM. `/api/feedback` writes and nothing else; there is no route
 * by which a visitor could delete their own report, or anyone else's.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await prisma.feedback.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    /*
      ⚠️ ALREADY GONE IS A SUCCESS, NOT A 404 — the opposite call to PATCH above, deliberately.
      Deleting is idempotent by nature: if the row is not there, the caller's intent is already
      satisfied. Two admin tabs both deleting the same report should not produce an error in one
      of them. PATCH differs because "set this to reviewed" genuinely cannot be honoured.
    */
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ ok: true });
    }
    console.error('[admin/feedback] delete failed', error);
    return NextResponse.json({ error: 'Could not delete that report.' }, { status: 500 });
  }
}
