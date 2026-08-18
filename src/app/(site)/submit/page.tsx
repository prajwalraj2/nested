// src/app/(site)/submit/page.tsx

import type { Metadata } from 'next';
import { PageIntro, SitePage } from '@/components/site/Prose';
import { SubmitForm } from '@/components/site/SubmitForm';
import { DomainService } from '@/services';
import { getUserCountryFromCookies } from '@/lib/server-country';
import { HONEYPOT_FIELD, issueFormToken } from '@/lib/public-forms';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/submit` (M-6) — suggest a tool, or request a domain.
 *
 * ⚠️ THE DOMAIN LIST IS SERVER-RENDERED INTO THE PAGE, NOT FETCHED BY THE FORM.
 *
 * The plan called for "new public read routes" to feed a domain → page cascade. The page step was
 * cut on 19 Aug 2026, and with only the domain list left there is nothing to fetch on demand — so
 * NO new public read route exists at all. That is the better outcome: an endpoint that lists
 * content is an endpoint whose filters can be got wrong, and the one that never gets written can
 * never leak a draft.
 *
 * ⚠️ COUNTRY-FILTERED, like every other public read. `DomainService.getAll` applies both
 * `status: PUBLISHED` and the country filter. Offering a domain the visitor cannot browse would
 * be the header's soft-404 problem (finding #15.4) reappearing inside a form.
 *
 * ⚠️ DYNAMIC FOR TWO INDEPENDENT REASONS, either of which alone would be enough:
 *   1. `issueFormToken()` stamps `Date.now()`. Prerendered, every visitor would get the same
 *      build-time timestamp and every submission would be rejected as `expired` within two hours.
 *   2. The domain list is country-filtered, so there is no single correct static output.
 */

export const dynamic = 'force-dynamic';

const TITLE = 'Submit a tool';
const DESCRIPTION =
  'Suggest a tool, course or channel for a page on ATNO — or request a field we do not cover yet.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/submit' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/submit' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const userCountry = await getUserCountryFromCookies();
  const domains = await DomainService.getAll(userCountry);

  const { issuedAt, token } = issueFormToken();

  /*
    ⚠️ `?from=` IS RESOLVED TO A DOMAIN HERE, ON THE SERVER, SO THE SELECT IS PRE-FILLED IN THE
    FIRST HTML — no flash of an empty control, and no effect needed.

    The header's Submit button appends the current path when it is a domain page, so `from` looks
    like `/domain/gdesign` or `/domain/gdesign/networking`. The slug is always the segment after
    `/domain/`, which is why one `split` is enough for both depths.

    ⚠️ MATCHED AGAINST THE ALREADY-FILTERED LIST, not looked up in the database. A path naming a
    domain this visitor cannot see simply finds nothing and the select stays on "not sure" — so
    the pre-fill cannot become a way to discover that a hidden domain exists.
  */
  const fromSlug = from?.startsWith('/domain/') ? from.split('/')[2] : undefined;
  const preselected = fromSlug ? domains.find((d) => d.slug === fromSlug)?.id : undefined;

  return (
    <SitePage>
      <PageIntro
        eyebrow="Submit"
        title="Suggest something for ATNO"
        lede="Found a tool, course or channel that belongs here? Tell us where it fits and why. Everything is read by a person, and good suggestions usually go up within a week."
      />

      <SubmitForm
        domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        preselectedDomainId={preselected}
        issuedAt={issuedAt}
        formToken={token}
        honeypotField={HONEYPOT_FIELD}
      />
    </SitePage>
  );
}
