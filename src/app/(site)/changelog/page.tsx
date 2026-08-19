// src/app/(site)/changelog/page.tsx

import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { PageIntro, SitePage } from '@/components/site/Prose';
import { ChangelogBoard } from '@/components/site/ChangelogBoard';
import { prisma } from '@/lib/prisma';
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/cache';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/changelog` (M-7) — the public product board.
 *
 * ⚠️ SERVER-RENDERED IN FULL. Every card is in the HTML before any JavaScript runs; the client
 * component only filters and opens a dialog over data it is handed. Same principle as the roadmap
 * and unlike the tables of finding #30 — a page that needs JS to show its text does not rank.
 *
 * ⚠️ NOT COUNTRY-FILTERED, unlike every other public read on this site. The board describes what
 * WE are building, not content targeted at a visitor, so there is nothing to filter by. Stated
 * because the absence of `getUserCountryFromCookies()` here would otherwise look like an omission.
 *
 * ⚠️ NO `status: PUBLISHED` EQUIVALENT EITHER. Every card on this model is public by existing —
 * "not started" is a column, not a draft state. Anything you would not want read by a visitor must
 * simply not be entered.
 */

/*
  Cached across requests and invalidated by the admin routes on write, matching how domains, pages
  and categories are handled. This board changes a few times a week at most and is hit on every
  visit to the page, so `unstable_cache` earns its keep here more than almost anywhere else.
*/
const getChangelogEntries = unstable_cache(
  async () =>
    prisma.changelogEntry.findMany({
      /*
        ⚠️ ORDERED HERE, ONCE. `groupByStatus` deliberately does NOT re-sort — a second sort would
        be a second place for the ordering rule to live and drift from this one. The model is
        indexed on `(status, order)` precisely for this query.
      */
      orderBy: [{ status: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        order: true,
        updatedAt: true,
      },
    }),
  ['changelog-entries'],
  { revalidate: CACHE_DURATIONS.MEDIUM, tags: [CACHE_TAGS.CHANGELOG] }
);

const TITLE = 'Changelog';
const DESCRIPTION =
  'What is being built on ATNO right now — fixes, improvements and new data, from planned to released.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/changelog' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/changelog' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();

  return (
    <SitePage>
      <PageIntro
        eyebrow="Changelog"
        title="What we are building"
        lede="Everything currently planned, in progress or shipped. The four columns are independent — a card sits in one of them, it does not travel along them."
      />

      <ChangelogBoard
        /*
          ⚠️ `updatedAt` IS SERIALISED TO A STRING HERE. A `Date` cannot cross the server/client
          boundary as a prop — Next throws on a non-serialisable value — and doing it at the edge
          keeps the client component's type honest about what it actually receives.
        */
        cards={entries.map((entry) => ({ ...entry, updatedAt: entry.updatedAt.toISOString() }))}
      />
    </SitePage>
  );
}
