// src/app/(site)/terms/page.tsx

import Link from 'next/link';
import type { Metadata } from 'next';
import { Prose, PageIntro, SitePage } from '@/components/site/Prose';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/terms` (M-3).
 *
 * ============================================================================
 * ⚠️ A DRAFT WRITTEN AGAINST WHAT THIS SITE ACTUALLY IS. NOT LEGAL ADVICE.
 * ============================================================================
 *
 * It describes a curated directory with no visitor accounts, no payments and no user-generated
 * content beyond form submissions — which is what ATNO is today. ⚠️ **Each of those becoming
 * untrue needs this page revisited**, and the second and third are on the roadmap:
 *
 *   • payments or a paid tier            → consumer contract terms, refunds, cancellation
 *   • visitor accounts                   → account, suspension and termination clauses
 *   • public-facing user content         → a licence to publish it, and a takedown process
 *
 * ⚠️ It deliberately does not name a governing jurisdiction. Guessing one is worse than omitting
 * it, and it is the one clause that genuinely needs a person who knows where the business is
 * registered. **Fill in the placeholder before relying on this page.**
 */

const TITLE = 'Terms & conditions';
const DESCRIPTION =
  'The terms for using ATNO — what you can expect from the site, and what we ask of you.';

const LAST_UPDATED = '18 August 2026';
const CONTACT_EMAIL = 'hello@atno.io';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/terms' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default function TermsPage() {
  return (
    <SitePage>
      <PageIntro
        eyebrow={`Last updated ${LAST_UPDATED}`}
        title="Terms & conditions"
        lede="ATNO is a free, curated directory. These terms cover what you can expect from it, and the few things we ask in return."
      />

      <Prose>
        <h2>Using ATNO</h2>
        <p>
          By using this site you accept these terms. If you do not, please do not use it. ATNO is
          free to browse, requires no account, and you may link to any page on it.
        </p>

        <h2>What ATNO is</h2>
        <p>
          A curated directory: hand-picked links to other people&rsquo;s tools, courses, channels,
          books and communities, organised by field. We choose what to include and how to describe
          it.
        </p>
        <p>
          <strong>We are not affiliated with the things we list</strong> unless a page says
          otherwise, and listing something is not an endorsement or a guarantee that it will suit
          you.
        </p>

        <h2>Accuracy, and its limits</h2>
        <p>
          We try to keep everything correct and current, and we fix things when they are reported.
          But prices change, tools shut down, links rot and features move.
        </p>
        <p>
          <strong>
            Everything here is provided &ldquo;as is&rdquo;, without warranty of any kind.
          </strong>{' '}
          Check anything that matters — particularly pricing and terms — with the provider before
          relying on it. If you spot something wrong,{' '}
          <Link href="/feedback">please tell us</Link>.
        </p>

        <h2>Other people&rsquo;s sites</h2>
        <p>
          Most of ATNO is links off it. We do not control those sites, are not responsible for
          them, and their terms and privacy policies apply once you arrive.
        </p>

        <h2>What you send us</h2>
        <p>
          If you submit a suggestion, feedback or a job application, you confirm that what you
          send is yours to send and is accurate to the best of your knowledge.
        </p>
        <ul>
          <li>
            You give us permission to use a suggestion to decide whether to list something, and to
            publish the resulting listing.
          </li>
          <li>
            <strong>We are not obliged to act on anything sent to us</strong>, and we may edit,
            decline or remove a suggestion.
          </li>
          <li>
            ⚠️ <strong>Do not send confidential information</strong> through these forms. Job
            applications are the exception and are handled privately — see the{' '}
            <Link href="/privacy">privacy policy</Link>.
          </li>
        </ul>

        <h2>Our content</h2>
        <p>
          The organisation, descriptions, design and code of ATNO belong to us. You are welcome to
          link to it and quote it with attribution. Please do not copy the site wholesale, scrape
          it in bulk, or republish it as your own.
        </p>
        <p>
          The tools, logos and materials we link to belong to their own owners, and their rights
          are unaffected by appearing here.
        </p>

        <h2>Fair use of the site</h2>
        <p>Please do not:</p>
        <ul>
          <li>attempt to break, overload or gain unauthorised access to the site</li>
          <li>scrape it at a volume that affects other people&rsquo;s use of it</li>
          <li>submit anything unlawful, misleading or malicious through our forms</li>
        </ul>

        <h2>Availability</h2>
        <p>
          We aim to keep ATNO up but do not promise uninterrupted access. We may change, suspend or
          remove any part of it at any time, including individual listings.
        </p>

        <h2>Liability</h2>
        <p>
          To the fullest extent permitted by law, we are not liable for any loss arising from your
          use of ATNO, from anything you found through it, or from any third-party site it links
          to. Nothing here limits liability that cannot lawfully be limited.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms. The date at the top shows when they last changed in substance,
          and continuing to use the site means accepting the current version.
        </p>

        <h2>Governing law</h2>
        {/*
          ⚠️ PLACEHOLDER. Naming the wrong jurisdiction is worse than naming none, and this is the
          one clause that genuinely needs a person who knows where the business is registered.
        */}
        <p>
          These terms are governed by the laws of{' '}
          <strong>[jurisdiction to be confirmed]</strong>, and any dispute will be handled by the
          courts there.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or
          via the <Link href="/contact">contact page</Link>.
        </p>
      </Prose>
    </SitePage>
  );
}
