// src/app/(site)/feedback/page.tsx

import type { Metadata } from 'next';
import { PageIntro, SitePage } from '@/components/site/Prose';
import { FeedbackForm } from '@/components/site/FeedbackForm';
import { HONEYPOT_FIELD, issueFormToken } from '@/lib/public-forms';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/feedback` (M-5) — the first public form on the site.
 *
 * ⚠️ A SERVER COMPONENT THAT MINTS THE SIGNED TOKEN. Signing needs `AUTH_SECRET`, so it cannot
 * happen in the form itself: a secret reachable from a `'use client'` module is a secret shipped
 * in the JavaScript bundle. This is the boundary, and it is the whole reason the page and the form
 * are two files.
 *
 * ⚠️ THEREFORE THIS PAGE CANNOT BE STATIC. `issueFormToken()` stamps `Date.now()`, and a
 * prerendered page would serve the same build-time timestamp to every visitor forever — within two
 * hours of deploying, every submission would be rejected as `expired`. `force-dynamic` states that
 * rather than leaving it to be discovered.
 */

export const dynamic = 'force-dynamic';

const TITLE = 'Feedback';
const DESCRIPTION =
  'Report a broken link, a wrong listing or a bug — or suggest something ATNO should add.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/feedback' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/feedback' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default function FeedbackPage() {
  const { issuedAt, token } = issueFormToken();

  return (
    <SitePage>
      <PageIntro
        eyebrow="Feedback"
        title="Tell us what is wrong"
        lede="Broken links, out-of-date pricing, a listing that should not be here, or something you think is missing. Short reports are fine, one line about which page and what you expected is genuinely enough."
      />

      <FeedbackForm issuedAt={issuedAt} formToken={token} honeypotField={HONEYPOT_FIELD} />
    </SitePage>
  );
}
