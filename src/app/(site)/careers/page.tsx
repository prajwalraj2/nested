// src/app/(site)/careers/page.tsx

import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { PageIntro, SitePage } from '@/components/site/Prose';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { jobCategoryLabel } from '@/lib/job-types';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/careers` (M-8) — the open roles.
 *
 * ⚠️ `/careers`, PLURAL — the plan says `/career`. The header has linked to `/careers` since M-2
 * and is already live, so the page follows the link rather than the other way round.
 *
 * ⚠️ ONLY `status: 'open'` IS EVER SELECTED. A closed role is hidden here but NOT deleted, because
 * its applications are records of real people. See the note on `Job.status` in the schema.
 */

export const dynamic = 'force-dynamic';

const TITLE = 'Careers';
const DESCRIPTION = 'Open roles at ATNO.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/careers' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/careers' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default async function CareersPage() {
  const jobs = await prisma.job.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, location: true, category: true },
  });

  return (
    <SitePage>
      <PageIntro
        eyebrow="Careers"
        title="Work on ATNO"
        lede="ATNO is small and deliberately so. When there is something worth hiring for, it is listed here."
      />

      {jobs.length === 0 ? (
        /*
          ⚠️ AN HONEST EMPTY STATE, NOT A HIDDEN PAGE. The link is in the header on every page, so
          the page must exist and must say something true. "No open roles" is information; a 404
          reached from your own navigation is a fault.
        */
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No open roles right now.</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Nothing is being hired for at the moment. This page is where roles appear when there
            are any, so it is worth checking back.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/careers/${job.id}`}
                className="border-border bg-card hover:border-foreground/30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium break-words">{job.title}</span>
                  <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="bg-muted rounded px-1.5 py-0.5 font-medium">
                      {jobCategoryLabel(job.category)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden="true" />
                      {job.location}
                    </span>
                  </span>
                </span>
                <Button asChild variant="outline" size="sm" tabIndex={-1}>
                  <span>View role</span>
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SitePage>
  );
}
