// src/app/api/admin/submissions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { SUBMISSION_KIND_VALUES, SUBMISSION_STATUSES } from '@/lib/submission-kinds';

/**
 * `GET /api/admin/submissions` — the review queue's data (M-6).
 *
 * ⚠️ ADMIN ONLY. Submissions carry a name and email address; none of it is public. `/api/submit`
 * (no `admin` segment) is the open endpoint and it only WRITES.
 */

const querySchema = z.object({
  status: z.enum(['all', ...SUBMISSION_STATUSES]).default('all'),
  kind: z.enum(['all', ...SUBMISSION_KIND_VALUES]).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filter.' }, { status: 400 });
  }

  const { status, kind, limit } = parsed.data;

  try {
    const items = await prisma.submission.findMany({
      where: {
        ...(status === 'all' ? {} : { status }),
        ...(kind === 'all' ? {} : { kind }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    /*
      Counted across the whole table rather than derived from `items`, so the tab numbers stay
      correct while a filter is applied — which is exactly when they are worth having.
    */
    const counts = await prisma.submission.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return NextResponse.json({
      items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  } catch (error) {
    console.error('[admin/submissions] list failed', error);
    return NextResponse.json({ error: 'Could not load submissions.' }, { status: 500 });
  }
}
