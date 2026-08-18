// src/app/(site)/about/page.tsx

import Link from 'next/link';
import type { Metadata } from 'next';
import { Prose, PageIntro, SitePage } from '@/components/site/Prose';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/about` (M-3).
 *
 * ⚠️ Hard-coded, deliberately. It changes perhaps twice a year, and making it admin-editable
 * would mean either a fifth content type or a synthetic "site" domain to hang a `Page` row off —
 * machinery with no payoff. Recorded as decision 36.3(c).
 */

const TITLE = 'About ATNO';
const DESCRIPTION =
  'ATNO is a hand-curated directory of the tools, courses, channels and communities worth knowing in each field — organised by domain rather than scattered across search results.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/about' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default function AboutPage() {
  return (
    <SitePage>
      <PageIntro
        eyebrow="About"
        title="Everything worth knowing in one field, in one place"
        lede="ATNO is a curated directory. Someone has already done the searching, filtering and dead-link removal, so you can start from a shortlist instead of a search box."
      />

      <Prose>
        <h2>The problem</h2>
        <p>
          Starting anything new means the same slow work every time. You search, you open twenty
          tabs, you find a &ldquo;top 10 tools&rdquo; list written three years ago, and half the
          links are dead. Then you do it again for the next question, and the next.
        </p>
        <p>
          The information exists. It is just scattered, undated, and mixed in with a great deal
          that is not worth your time.
        </p>

        <h2>What we do instead</h2>
        <p>
          Every domain on ATNO — <Link href="/domain">there are dozens</Link> — is organised the
          same way: the courses, YouTube channels, books, podcasts, communities, tools and
          platforms that are actually used by people working in that field, grouped so you can see
          the shape of it at a glance.
        </p>
        <ul>
          <li>
            <strong>Curated, not scraped.</strong> Everything here was chosen by a person who
            looked at it.
          </li>
          <li>
            <strong>Organised by domain.</strong> Graphic design, web development, data science,
            video editing and the rest each get their own structure rather than one flat list.
          </li>
          <li>
            <strong>Comparable.</strong> Where it helps, things sit in tables with the details
            that actually decide a choice — pricing, what it does, who it is for.
          </li>
          <li>
            <strong>Roadmaps where order matters.</strong> Some fields are not a list, they are a
            path. Those get one.
          </li>
        </ul>

        <h2>What this is not</h2>
        <p>
          It is not a review site, an affiliate farm, or an attempt to list everything. Being
          exhaustive is the opposite of being useful — a directory that lists forty options has
          moved the decision back onto you.
        </p>

        <h2>Who builds it</h2>
        <p>
          A very small team, currently one person doing most of it. That is worth saying plainly:
          it is why some domains are deeper than others, and why the fastest way to improve a
          section is to tell us what is missing from it.
        </p>

        <h2>Help make it better</h2>
        <p>
          If you know a tool, channel or resource that belongs here,{' '}
          <Link href="/submit">suggest it</Link>. If something is wrong, outdated or broken,{' '}
          <Link href="/feedback">tell us</Link> — that is the single most useful thing you can do,
          and it takes a minute.
        </p>
        <p>
          For anything else, <Link href="/contact">get in touch</Link>.
        </p>
      </Prose>
    </SitePage>
  );
}
