// src/app/api/admin/jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { JOB_CATEGORY_VALUES, JOB_STATUSES } from '@/lib/job-types';

/** `GET` and `POST /api/admin/jobs` (M-8). */

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20000),
  location: z.string().trim().min(1).max(160),
  category: z.enum(JOB_CATEGORY_VALUES),
  status: z.enum(JOB_STATUSES).default('open'),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const items = await prisma.job.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      /*
        ⚠️ THE APPLICATION COUNT COMES BACK WITH THE LIST. The admin needs it in two places: to
        show how many people applied, and — more importantly — to explain why Delete is disabled on
        a job that has any. Fetching it per row afterwards would be one query per job.
      */
      include: { _count: { select: { applications: true } } },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[admin/jobs] list failed', error);
    return NextResponse.json({ error: 'Could not load roles.' }, { status: 500 });
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
      { error: parsed.error.issues[0]?.message ?? 'Invalid role.' },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.job.create({ data: parsed.data });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[admin/jobs] create failed', error);
    return NextResponse.json({ error: 'Could not create that role.' }, { status: 500 });
  }
}
