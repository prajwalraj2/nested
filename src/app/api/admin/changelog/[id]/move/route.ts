// src/app/api/admin/changelog/[id]/move/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { renumber } from '@/lib/roadmap-tree';
import { invalidateChangelog } from '@/lib/cache-invalidation';
import { CHANGELOG_STATUS_VALUES } from '@/lib/changelog-types';

/**
 * `POST /api/admin/changelog/[id]/move` — reposition one card (M-7).
 * ============================================================================
 *
 * ⚠️ THE ARITHMETIC LIVES ON THE SERVER, NOT IN THE COMPONENT. This is the same decision
 * `RoadmapEditor` records and for the same reason: a move rewrites the `order` of several rows, so
 * doing it client-side means writing the logic twice, in two languages, and having the two drift.
 * The client sends an INTENT — "up", or "into that column" — and the server works out the writes.
 *
 * ⚠️ `renumber()` IS IMPORTED FROM `roadmap-tree.ts` RATHER THAN COPIED. Despite the filename it
 * is a pure function over `{ id, order }[]` with nothing roadmap-specific in it, and the plan for
 * this step said to reuse it by name. A second copy is a second thing to fix when the ordering
 * rule changes.
 */

const moveSchema = z.union([
  z.object({ direction: z.enum(['up', 'down']) }),
  z.object({ status: z.enum(CHANGELOG_STATUS_VALUES) }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid move.' }, { status: 400 });
  }

  try {
    const card = await prisma.changelogEntry.findUnique({
      where: { id },
      select: { id: true, status: true, order: true },
    });
    if (!card) {
      return NextResponse.json({ error: 'That entry no longer exists.' }, { status: 404 });
    }

    /*
      ⚠️ ONE TRANSACTION FOR THE WHOLE MOVE. A move touches several rows, and a half-applied one
      leaves two cards sharing an order — which sorts unpredictably and looks like a random
      reshuffle rather than a failure. Either every write lands or none does.
    */
    await prisma.$transaction(async (tx) => {
      if ('direction' in parsed.data) {
        // ── Within one column ──────────────────────────────────────────────────────────────────
        const siblings = await tx.changelogEntry.findMany({
          where: { status: card.status },
          orderBy: { order: 'asc' },
          select: { id: true, order: true },
        });

        const index = siblings.findIndex((s) => s.id === card.id);
        const target = parsed.data.direction === 'up' ? index - 1 : index + 1;

        // Already at the end it is being pushed towards — nothing to do, and not an error.
        if (target < 0 || target >= siblings.length) return;

        /*
          ⚠️ THE ARRAY IS REORDERED AND THE WHOLE COLUMN RENUMBERED — the two rows are NOT swapped.
          Swapping assumes the orders are contiguous, and they are not: deleting a card leaves a
          gap on purpose. With gaps, a swap can move a card past two neighbours at once or appear
          to do nothing, and it degrades further with every delete. Renumbering is correct whatever
          state the column is in.
        */
        const reordered = [...siblings];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

        for (const write of renumber(reordered)) {
          await tx.changelogEntry.update({ where: { id: write.id }, data: { order: write.order } });
        }
      } else {
        // ── Into a different column ────────────────────────────────────────────────────────────
        const nextStatus = parsed.data.status;
        if (nextStatus === card.status) return;

        /*
          Appended to the end of the destination, computed from its MAX rather than a count — see
          the note in the create route for why a count is wrong once anything has been deleted.
        */
        const last = await tx.changelogEntry.findFirst({
          where: { status: nextStatus },
          orderBy: { order: 'desc' },
          select: { order: true },
        });

        await tx.changelogEntry.update({
          where: { id: card.id },
          data: { status: nextStatus, order: last ? last.order + 1 : 0 },
        });

        /*
          ⚠️ THE COLUMN IT LEFT IS RENUMBERED TOO. Skipping this is the tempting shortcut and it is
          how the gaps compound: every move out of a column would leave one, until the orders are
          arbitrary numbers whose only remaining meaning is their relative sort. Closing it here
          costs one query and keeps the data readable.
        */
        const remaining = await tx.changelogEntry.findMany({
          where: { status: card.status },
          orderBy: { order: 'asc' },
          select: { id: true, order: true },
        });

        for (const write of renumber(remaining)) {
          await tx.changelogEntry.update({ where: { id: write.id }, data: { order: write.order } });
        }
      }
    });

    invalidateChangelog();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/changelog] move failed', error);
    return NextResponse.json({ error: 'Could not move that entry.' }, { status: 500 });
  }
}
