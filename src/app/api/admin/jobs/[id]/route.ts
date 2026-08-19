// src/app/api/admin/jobs/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { JOB_CATEGORY_VALUES, JOB_STATUSES } from '@/lib/job-types';

/** `PATCH` and `DELETE /api/admin/jobs/[id]` (M-8). */

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(20000).optional(),
    location: z.string().trim().min(1).max(160).optional(),
    category: z.enum(JOB_CATEGORY_VALUES).optional(),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const updated = await prisma.job.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'That role no longer exists.' }, { status: 404 });
    }
    console.error('[admin/jobs] update failed', error);
    return NextResponse.json({ error: 'Could not update that role.' }, { status: 500 });
  }
}

/**
 * ⚠️ REFUSES TO DELETE A ROLE THAT HAS APPLICATIONS. This guard is the whole reason the schema's
 * `onDelete: Cascade` is safe to leave in place.
 *
 * A cascade runs INSIDE POSTGRES. No application code executes, so the CVs in R2 are never
 * deleted — they would sit in the bucket forever, unreferenced by any row and therefore
 * unreachable through the admin that is supposed to be able to remove them. Personal data we hold
 * and cannot see is the worst of both.
 *
 * The same guard `CategoryList` uses for a category that still has domains, and the answer is the
 * same: close the role instead. `status: 'closed'` hides it from `/careers` and stops it accepting
 * applications, while keeping the record.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const count = await prisma.jobApplication.count({ where: { jobId: id } });
    if (count > 0) {
      return NextResponse.json(
        {
          error:
            `This role has ${count} application${count === 1 ? '' : 's'}. ` +
            'Close it instead — deleting would discard those records and leave their CVs stored with nothing pointing at them.',
        },
        { status: 409 }
      );
    }

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Already gone is a success: deleting is idempotent.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ ok: true });
    }
    console.error('[admin/jobs] delete failed', error);
    return NextResponse.json({ error: 'Could not delete that role.' }, { status: 500 });
  }
}
