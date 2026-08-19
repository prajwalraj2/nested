// src/app/api/admin/changelog/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidateChangelog } from '@/lib/cache-invalidation';
import { CHANGELOG_TYPE_VALUES } from '@/lib/changelog-types';

/**
 * `PATCH` and `DELETE /api/admin/changelog/[id]` (M-7).
 *
 * ⚠️ `status` AND `order` ARE ABSENT FROM THE PATCH SCHEMA ON PURPOSE. Both are changed through
 * `[id]/move`, which renumbers the affected columns in one transaction. Allowing a bare
 * `{ status }` here would move a card into a column without giving it a position — it would land
 * on whatever order it happened to carry, colliding with a card already there, and the two would
 * then sort unpredictably. One door in, one place the arithmetic lives.
 */

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    type: z.enum(CHANGELOG_TYPE_VALUES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid update.' },
      { status: 400 }
    );
  }

  try {
    /*
      ⚠️ `parsed.data` IS SAFE TO SPREAD HERE, unlike in the public routes. Its keys are fixed by
      the schema above and every one of them is meant to be writable — there is no `status`, `order`
      or `id` in it to smuggle through. The public routes build `data` field by field because their
      input comes from strangers; this one does not.
    */
    const updated = await prisma.changelogEntry.update({ where: { id }, data: parsed.data });
    invalidateChangelog();
    return NextResponse.json(updated);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'That entry no longer exists.' }, { status: 404 });
    }
    console.error('[admin/changelog] update failed', error);
    return NextResponse.json({ error: 'Could not update that entry.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    /*
      ⚠️ THE COLUMN IS NOT RENUMBERED AFTER A DELETE, AND THAT IS FINE. It leaves a gap — orders
      0,1,3 — which is why `POST` computes the next position from the MAX rather than from a count,
      and why `move` renumbers the whole column rather than swapping neighbours. Both were written
      to tolerate gaps, so closing them here would be work that buys nothing.
    */
    await prisma.changelogEntry.delete({ where: { id } });
    invalidateChangelog();
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Already gone is a success — deleting is idempotent, so two admin tabs must not disagree.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ ok: true });
    }
    console.error('[admin/changelog] delete failed', error);
    return NextResponse.json({ error: 'Could not delete that entry.' }, { status: 500 });
  }
}
