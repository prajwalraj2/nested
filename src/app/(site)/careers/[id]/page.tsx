// src/app/(site)/careers/[id]/page.tsx

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, MapPin } from 'lucide-react';
import { PageIntro, SitePage } from '@/components/site/Prose';
import { JobApplicationForm } from '@/components/site/JobApplicationForm';
import { prisma } from '@/lib/prisma';
import { jobCategoryLabel } from '@/lib/job-types';
import { HONEYPOT_FIELD, issueFormToken } from '@/lib/public-forms';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/careers/[id]` (M-8) — one role, with its application form.
 *
 * ⚠️ A CLOSED ROLE 404s RATHER THAN RENDERING WITHOUT A FORM. Someone arriving from a stale link
 * to a filled role should be told it is gone, not shown a job advert they cannot act on — and the
 * apply endpoint refuses closed roles anyway, so a form here would only ever produce an error.
 *
 * ⚠️ DYNAMIC, because `issueFormToken()` stamps `Date.now()`. A prerendered page would hand every
 * visitor the same build-time timestamp and every application would be rejected as `expired`
 * within two hours of deploying.
 */

export const dynamic = 'force-dynamic';

async function getOpenJob(id: string) {
  return prisma.job.findFirst({
    where: { id, status: 'open' },
    select: { id: true, title: true, description: true, location: true, category: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await getOpenJob(id);
  if (!job) return { title: 'Role not found' };

  const description = `${jobCategoryLabel(job.category)} · ${job.location}`;
  return {
    title: job.title,
    description,
    alternates: { canonical: `/careers/${job.id}` },
    openGraph: buildOpenGraph({
      title: job.title,
      description,
      url: `/careers/${job.id}`,
    }),
    twitter: buildTwitter({ title: job.title, description }),
  };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getOpenJob(id);
  if (!job) notFound();

  const { issuedAt, token } = issueFormToken();

  return (
    <SitePage>
      <Link
        href="/careers"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All roles
      </Link>

      <PageIntro
        eyebrow={jobCategoryLabel(job.category)}
        title={job.title}
        lede={job.location}
      />

      <p className="text-muted-foreground mb-6 flex items-center gap-1 text-sm">
        <MapPin className="size-4" aria-hidden="true" />
        {job.location}
      </p>

      {/*
        ⚠️ `whitespace-pre-wrap`, NOT rich text. The description is written by the admin as plain
        text with line breaks — making this another HTML surface would mean another editor, another
        sanitisation question, and another thing to keep in step with the rich-text rules.
      */}
      <div className="border-border mb-8 border-b pb-8 text-sm break-words whitespace-pre-wrap">
        {job.description}
      </div>

      <h2 className="mb-4 text-lg font-semibold">Apply</h2>
      <JobApplicationForm
        jobId={job.id}
        jobTitle={job.title}
        issuedAt={issuedAt}
        formToken={token}
        honeypotField={HONEYPOT_FIELD}
      />
    </SitePage>
  );
}
