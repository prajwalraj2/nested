// src/app/api/admin/applications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { APPLICATION_STATUSES } from '@/lib/job-types';

/**
 * `GET /api/admin/applications` (M-8).
 *
 * ⚠️ THE MOST SENSITIVE READ ON THE SITE — names, email addresses and a pointer to a CV. There is
 * no public counterpart to this route and there must never be one.
 */

const querySchema = z.object({
  status: z.enum(['all', ...APPLICATION_STATUSES]).default('all'),
  jobId: z.string().trim().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid filter.' }, { status: 400 });
  }

  const { status, jobId, limit } = parsed.data;

  try {
    const items = await prisma.jobApplication.findMany({
      where: {
        ...(status === 'all' ? {} : { status }),
        ...(jobId ? { jobId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      /*
        ⚠️ `resumeKey` IS DELIBERATELY NOT SELECTED. Nothing in the admin UI needs it: the download
        goes through `[id]/resume`, which looks the key up server-side from the id. Sending it to
        the browser would put an object path into a page's JSON for no purpose — and the moment it
        is there, someone will try to build a URL out of it, which is exactly the mistake the
        private bucket exists to prevent. `resumeBytes` is included because the UI shows a size.
      */
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        resumeBytes: true,
        createdAt: true,
        job: { select: { id: true, title: true } },
      },
    });

    const counts = await prisma.jobApplication.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return NextResponse.json({
      items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  } catch (error) {
    console.error('[admin/applications] list failed', error);
    return NextResponse.json({ error: 'Could not load applications.' }, { status: 500 });
  }
}
