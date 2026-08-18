// src/app/(site)/contact/page.tsx

import Link from 'next/link';
import type { Metadata } from 'next';
import { Bug, Mail, Plus } from 'lucide-react';
import { Prose, PageIntro, SitePage } from '@/components/site/Prose';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/contact` (M-3).
 *
 * ⚠️ NO FORM ON THIS PAGE, DELIBERATELY.
 *
 * Feedback (M-5) and Submit (M-6) are the forms, and each exists because it collects something
 * specific and routes it somewhere specific. A third general-purpose form would collect
 * unstructured messages that overlap both — and two forms doing nearly the same job is how both
 * end up unmaintained. This page's job is to send people to the right one, and to give an email
 * address for everything else.
 *
 * ⚠️ THE EMAIL ADDRESS BELOW IS A PLACEHOLDER — replace it before this ships. A contact page
 * with a wrong address is worse than no contact page.
 */

const TITLE = 'Contact';
const DESCRIPTION =
  'How to reach ATNO — report a problem, suggest a tool, or get in touch about anything else.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/contact' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

/** ⚠️ PLACEHOLDER — set the real address before shipping. */
const CONTACT_EMAIL = 'hello@atno.io';

const ROUTES = [
  {
    icon: Bug,
    title: 'Something is broken or wrong',
    body: 'A dead link, an outdated price, a page that looks off, a feature that misbehaves.',
    action: { label: 'Send feedback', href: '/feedback' },
  },
  {
    icon: Plus,
    title: 'Something is missing',
    body: 'A tool, channel, course or community that belongs in a domain — or a domain we do not cover yet.',
    action: { label: 'Suggest it', href: '/submit' },
  },
] as const;

export default function ContactPage() {
  return (
    <SitePage>
      <PageIntro
        eyebrow="Contact"
        title="Get in touch"
        lede="Most messages fall into one of two buckets, and both have a faster route than email."
      />

      {/* The two structured routes first — they get a reply into the right queue. */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {ROUTES.map((route) => (
          <div key={route.title} className="border-border bg-card rounded-lg border p-5">
            <route.icon className="text-muted-foreground mb-3 size-5" aria-hidden="true" />
            <h2 className="mb-1.5 font-semibold">{route.title}</h2>
            <p className="text-muted-foreground mb-4 text-sm">{route.body}</p>
            <Link
              href={route.action.href}
              className="text-primary text-sm font-medium underline underline-offset-4"
            >
              {route.action.label} →
            </Link>
          </div>
        ))}
      </div>

      <Prose>
        <h2>Everything else</h2>
        <p>
          Partnerships, corrections you would rather not put in a form, press, or anything that
          does not fit above:
        </p>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-base font-medium">
            <Mail className="mr-1.5 inline size-4 align-[-2px]" aria-hidden="true" />
            {CONTACT_EMAIL}
          </a>
        </p>

        <h3>When you will hear back</h3>
        <p>
          ATNO is run by a very small team, so replies usually take{' '}
          <strong>two to three working days</strong>. If it is a broken link or a factual error,
          the <Link href="/feedback">feedback form</Link> is genuinely faster — it lands in a queue
          that gets checked, rather than an inbox.
        </p>

        <h3>Working with us</h3>
        <p>
          Open roles, when there are any, are listed on the{' '}
          <Link href="/careers">careers page</Link>.
        </p>
      </Prose>
    </SitePage>
  );
}
