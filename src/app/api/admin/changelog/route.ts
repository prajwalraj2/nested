// src/app/api/admin/changelog/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { invalidateChangelog } from '@/lib/cache-invalidation';
import { CHANGELOG_STATUS_VALUES, CHANGELOG_TYPE_VALUES } from '@/lib/changelog-types';

/**
 * `GET` and `POST /api/admin/changelog` (M-7).
 *
 * ⚠️ ADMIN ONLY, EVEN THOUGH THE DATA IS PUBLIC. The public board reads through
 * `unstable_cache` in the page component, not through an API — so these routes exist purely to
 * WRITE, and gating the read half costs nothing while keeping the surface uniform.
 */

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  type: z.enum(CHANGELOG_TYPE_VALUES),
  status: z.enum(CHANGELOG_STATUS_VALUES),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const items = await prisma.changelogEntry.findMany({
      orderBy: [{ status: 'asc' }, { order: 'asc' }],
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[admin/changelog] list failed', error);
    return NextResponse.json({ error: 'Could not load the changelog.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid entry.' },
      { status: 400 }
    );
  }

  try {
    /*
      ⚠️ APPENDED TO THE END OF ITS COLUMN, computed from the current maximum rather than from a
      count. `count()` would collide the moment a card is deleted: five cards minus one leaves four
      rows whose orders are 0,1,2,4, and a new card at order 4 duplicates an existing one. The max
      is correct whatever gaps exist — and gaps DO exist, because deleting does not renumber.
    */
    const last = await prisma.changelogEntry.findFirst({
      where: { status: parsed.data.status },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const created = await prisma.changelogEntry.create({
      data: { ...parsed.data, order: last ? last.order + 1 : 0 },
    });

    invalidateChangelog();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[admin/changelog] create failed', error);
    return NextResponse.json({ error: 'Could not create that entry.' }, { status: 500 });
  }
}
