// src/app/api/admin/applications/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getPrivateStorage } from '@/lib/storage';
import { APPLICATION_STATUSES } from '@/lib/job-types';

/** `PATCH` and `DELETE /api/admin/applications/[id]` (M-8). */

const patchSchema = z.object({ status: z.enum(APPLICATION_STATUSES) });

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
      { error: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    /*
      ⚠️ STATUS IS THE ONLY MUTABLE FIELD. The name, email and CV are a record of what somebody
      sent; editing them would rewrite an application while leaving it looking original.
    */
    const updated = await prisma.jobApplication.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, status: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'That application no longer exists.' }, { status: 404 });
    }
    console.error('[admin/applications] update failed', error);
    return NextResponse.json({ error: 'Could not update that application.' }, { status: 500 });
  }
}

/**
 * ⚠️ DELETES THE CV FROM R2 AS WELL AS THE ROW — and that is the point of this route existing.
 *
 * The privacy policy promises job applications are "kept for the role, then removed". Deleting the
 * database row alone would leave the PDF in the bucket indefinitely: still personal data, still
 * ours, and now invisible to the only screen that could have removed it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const application = await prisma.jobApplication.findUnique({
      where: { id },
      select: { resumeKey: true },
    });

    // Already gone: nothing to delete and nothing to clean up.
    if (!application) return NextResponse.json({ ok: true });

    /*
      ⚠️ THE OBJECT GOES FIRST, THEN THE ROW. The opposite order can strand the file: if the row is
      deleted and the object delete then fails, nothing remembers the key and the PDF is
      unreachable forever. This way a failure leaves the row intact and the delete can simply be
      retried — and R2's delete is idempotent, so a retry after a partial success is fine.
    */
    const storage = await getPrivateStorage();
    await storage.deletePrivate(application.resumeKey);

    await prisma.jobApplication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/applications] delete failed', error);
    return NextResponse.json(
      { error: 'Could not delete that application. Nothing was removed.' },
      { status: 500 }
    );
  }
}
