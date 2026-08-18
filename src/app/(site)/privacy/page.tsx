// src/app/(site)/privacy/page.tsx

import Link from 'next/link';
import type { Metadata } from 'next';
import { Prose, PageIntro, SitePage } from '@/components/site/Prose';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/privacy` (M-3).
 *
 * ============================================================================
 * ⚠️ THIS IS A DRAFT WRITTEN AGAINST WHAT THE CODE ACTUALLY DOES. IT IS NOT LEGAL ADVICE.
 * ============================================================================
 *
 * It was written by reading the codebase rather than from a template, so every claim below is
 * checkable:
 *
 *   Google Analytics 4        src/app/layout.tsx        — production only, GA_MEASUREMENT_ID
 *   Vercel Web Analytics      src/app/layout.tsx        — all environments
 *   Vercel Speed Insights     src/app/layout.tsx        — all environments
 *   Microsoft Clarity         src/app/domain/layout.tsx — ⚠️ production AND domain pages only,
 *                                                          deliberately not the admin panel
 *   `user-country` cookie     src/middleware.ts         — 30 days, httpOnly:false, sameSite lax
 *   Admin session cookie      NextAuth                  — staff only, never set for visitors
 *
 * ⚠️ IF ANY OF THOSE CHANGE, THIS PAGE BECOMES WRONG, and a privacy policy that misdescribes what
 * a site does is worse than a vague one. Specifically:
 *   • adding a collector to a layout
 *   • M-5/M-6/M-8 shipping the forms (name, email, message, CV) — the sections below already
 *     describe them, so check the wording matches what was actually built
 *   • moving Clarity out of `domain/layout.tsx`
 *
 * ⚠️ HAVE THIS REVIEWED before relying on it, particularly if ATNO ever has EU or UK visitors in
 * numbers — GDPR's consent rules for analytics cookies are stricter than what this page currently
 * describes, and that is a product decision, not a wording one.
 */

const TITLE = 'Privacy policy';
const DESCRIPTION =
  'What ATNO collects, why, who it is shared with, and how to ask for it to be removed.';

/** ⚠️ Update whenever the substance changes — not on every typo fix. */
const LAST_UPDATED = '18 August 2026';
const CONTACT_EMAIL = 'hello@atno.io';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/privacy' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default function PrivacyPage() {
  return (
    <SitePage>
      <PageIntro
        eyebrow={`Last updated ${LAST_UPDATED}`}
        title="Privacy policy"
        lede="The short version: you can read everything on ATNO without giving us anything. We use analytics to see which pages get used, and we only hold personal details if you choose to send them."
      />

      <Prose>
        <h2>What we collect when you just browse</h2>
        <p>
          Nothing you type, because there is nothing to type. Reading ATNO requires no account and
          no sign-in.
        </p>
        <p>Three things happen automatically:</p>
        <ul>
          <li>
            <strong>A country cookie.</strong> We store a two-letter country code — for example{' '}
            <code>IN</code> or <code>GB</code> — in a cookie named <code>user-country</code>, kept
            for 30 days. It is worked out from your IP address by our hosting provider and is used
            for one thing: showing content meant for your region. It holds a country and nothing
            else, and it is not a login or an identifier.
          </li>
          <li>
            <strong>Analytics.</strong> We use Google Analytics 4, Vercel Web Analytics and Vercel
            Speed Insights to see which pages are visited, roughly where visitors are, and how fast
            pages load.
          </li>
          <li>
            <strong>Session recording on domain pages.</strong> On the browsing pages we use
            Microsoft Clarity, which records anonymised page interactions — scrolling, clicks,
            where attention goes. It is deliberately <strong>not</strong> loaded on our admin
            pages, and not in development.
          </li>
        </ul>
        <p>
          Our host also keeps standard server logs, including IP addresses, for security and
          reliability.
        </p>

        <h2>What we collect if you send it</h2>
        <p>These are all optional, and each only exists if you fill it in.</p>

        <h3>Feedback</h3>
        <p>
          The category and message you write, the page you were on when you opened the form, and
          your name and email <strong>if you choose to add them</strong> — both are optional,
          because requiring an email to report a broken button loses most reports.
        </p>

        <h3>Suggesting a tool or a domain</h3>
        <p>
          The product name, link and description you give, plus your name and email, which are
          required so we can follow up on a suggestion.
        </p>

        <h3>Applying for a job</h3>
        <p>
          Your name, email and the CV file you upload. ⚠️ CVs are stored in{' '}
          <strong>private storage with no public web address</strong> — they can only be opened by
          a signed-in ATNO administrator, and there is no link that works outside our admin panel.
        </p>

        <h2>Why we are allowed to hold it</h2>
        <ul>
          <li>
            <strong>Analytics and the country cookie</strong> — our legitimate interest in
            understanding and improving the site.
          </li>
          <li>
            <strong>Anything you type into a form</strong> — your consent, given by sending it. You
            can withdraw it at any time by asking us to delete it.
          </li>
        </ul>

        <h2>Who else sees it</h2>
        <p>
          <strong>We do not sell your data, and we do not share it for advertising.</strong> It
          reaches only the companies that run the site for us:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — hosting, analytics and file storage
          </li>
          <li>
            <strong>Neon</strong> — our database
          </li>
          <li>
            <strong>Google</strong> — Google Analytics
          </li>
          <li>
            <strong>Microsoft</strong> — Clarity session insights
          </li>
          <li>
            <strong>Cloudflare</strong> — private file storage for CVs
          </li>
        </ul>
        <p>
          We may also disclose information if the law requires it. These providers operate
          internationally, so your information may be processed outside your country.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li>
            <strong>The country cookie</strong> — 30 days, then it is set again on your next visit.
          </li>
          <li>
            <strong>Analytics</strong> — per each provider&rsquo;s own retention settings.
          </li>
          <li>
            <strong>Feedback and suggestions</strong> — kept while they are useful for improving
            the site.
          </li>
          <li>
            <strong>Job applications</strong> — kept for the role, then removed.
          </li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Ask for a copy, or ask us to delete it.</strong> Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and tell us roughly when and
            what you sent, so we can find it.
          </li>
          <li>
            <strong>Block the cookie.</strong> Your browser can block or clear cookies for this
            site. The only consequence is that region-specific content may not match where you are.
          </li>
          <li>
            <strong>Opt out of Google Analytics</strong> using Google&rsquo;s{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
            >
              browser add-on
            </a>
            .
          </li>
        </ul>

        <h2>Children</h2>
        <p>
          ATNO is not aimed at children under 13, and we do not knowingly collect their
          information. If you believe a child has sent us something, email us and we will remove it.
        </p>

        <h2>Links to other sites</h2>
        <p>
          Most of ATNO is links to other people&rsquo;s tools, courses and channels. Once you leave
          this site you are on theirs, and their privacy policy applies — not this one.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes in substance we will update the date at the top of this page.
          Questions go to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or through the{' '}
          <Link href="/contact">contact page</Link>.
        </p>
      </Prose>
    </SitePage>
  );
}
