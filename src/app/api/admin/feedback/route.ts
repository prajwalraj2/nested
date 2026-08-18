// src/app/api/admin/feedback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { FEEDBACK_CATEGORY_VALUES, FEEDBACK_STATUSES } from '@/lib/feedback-categories';

/**
 * `GET /api/admin/feedback` — the review queue's data (M-5).
 *
 * ⚠️ ADMIN ONLY, AND THE GUARD IS THE FIRST LINE. Feedback rows can contain an email address and
 * whatever someone chose to type; none of it is public. `/api/feedback` (no `admin` segment) is the
 * open endpoint and it only WRITES — reading is gated here.
 */

const querySchema = z.object({
  status: z.enum(['all', ...FEEDBACK_STATUSES]).default('all'),
  category: z.enum(['all', ...FEEDBACK_CATEGORY_VALUES]).default('all'),
  /*
    ⚠️ CAPPED AT 100. An admin screen with no limit is one `SELECT *` away from loading every row
    ever submitted into a browser — fine today with none, unpleasant after a spam wave.
  */
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filter.' }, { status: 400 });
  }

  const { status, category, limit } = parsed.data;

  try {
    const items = await prisma.feedback.findMany({
      where: {
        ...(status === 'all' ? {} : { status }),
        ...(category === 'all' ? {} : { category }),
      },
      /*
        Newest first, which is what `@@index([status, createdAt])` on the model is shaped for —
        the common read is "the new ones, most recent at the top".
      */
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    /*
      ⚠️ COUNTED PER STATUS SO THE TABS CAN SHOW A NUMBER even while a filter is applied. Deriving
      the counts from `items` would only ever describe the current page of the current filter,
      which is exactly when the number matters least.
    */
    const counts = await prisma.feedback.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return NextResponse.json({
      items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  } catch (error) {
    console.error('[admin/feedback] list failed', error);
    return NextResponse.json({ error: 'Could not load feedback.' }, { status: 500 });
  }
}
