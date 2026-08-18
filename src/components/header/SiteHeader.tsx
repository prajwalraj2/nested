// src/components/header/SiteHeader.tsx

import { DomainService } from '@/services';
import { getUserCountryFromCookies } from '@/lib/server-country';
import { SiteNav, type NavDomainGroup } from './SiteNav';

/**
 * The site header (M-2).
 * ============================================================================
 *
 * ⚠️ A SERVER COMPONENT, AND THAT IS THE ENTIRE POINT OF THIS STEP.
 *
 * The header it replaces (`AppHeader.tsx`, which was rendered nowhere) fetched its domain list
 * client-side through `useHeaderDataFromContext()`. That would have put ~25 domain links behind
 * JavaScript on **every page of the site** — finding #30's failure applied to the one component
 * that appears everywhere, leaving the internal link graph largely invisible to a crawler.
 *
 * Fetching here and passing the result down as props means those links are in the initial HTML of
 * every page. The interactive parts (menus, the mobile sheet) are a client child layered on top.
 *
 * ⚠️ THE QUERY IS FREE IN PRACTICE. `DomainService.getAll` is wrapped in React `cache()` **and**
 * `unstable_cache`, and the domain listing page already calls it with the same argument on the
 * same request — so on `/` this is a memo hit, and elsewhere it is a Data Cache hit. What it must
 * not become is a second query with *different* arguments, which would silently double the count
 * (the trap documented in `domain/[...slug]/page.tsx`'s metadata note).
 */
export async function SiteHeader() {
  /*
    ⚠️ Country-filtered, like every other public read. A domain targeted away from this visitor
    must not appear in the header, or the menu advertises a URL that 404s for them — the soft-404
    chain of finding #15.4, on every page at once.
  */
  const userCountry = await getUserCountryFromCookies();
  const domains = await DomainService.getAll(userCountry);

  /*
    Group by category for the mega-menu's columns.

    ⚠️ Built with a Map rather than `filter()` per category — one pass instead of one pass per
    category, and it preserves the order `getAll` already applied (category column, then
    `orderInCategory`), so the menu matches the listing page rather than inventing its own order.

    Domains with no category fall into "Other" instead of vanishing. A domain that is live but
    absent from the header would be a link nobody can find, with nothing to indicate why.
  */
  const grouped = new Map<string, NavDomainGroup>();
  for (const domain of domains) {
    const key = domain.category?.slug ?? '__uncategorised__';
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        name: domain.category?.name ?? 'Other',
        icon: domain.category?.icon ?? null,
        /*
          ⚠️ THE TWO NUMBERS THAT DECIDE THE MENU'S ORDER. Both are admin-set fields on
          `Category`: `categoryOrder` is which ROW of the /domain board the group sits in,
          `columnPosition` is which of the three COLUMNS. They are carried through so the menu
          can rebuild the same board — see the sort below for why that was necessary.

          ⚠️ `MAX_SAFE_INTEGER` for an uncategorised domain, so "Other" sorts LAST. `0` was the
          tempting default and is exactly wrong — it would sort uncategorised leftovers to the
          FRONT of the menu, ahead of every curated category.
        */
        order: domain.category?.categoryOrder ?? Number.MAX_SAFE_INTEGER,
        column: domain.category?.columnPosition ?? 1,
        domains: [],
      });
    }
    grouped.get(key)!.domains.push({
      id: domain.id,
      name: domain.name,
      slug: domain.slug,
      icon: domain.icon ?? null,
    });
  }

  /*
    ⚠️ RE-SORTED ROW-FIRST, BECAUSE THE QUERY SORTS COLUMN-FIRST AND THE MENU IS A ROW-MAJOR GRID.

    `DomainService.getAll` orders by `columnPosition` THEN `categoryOrder`
    (`domain.service.ts:39-43`) — i.e. it walks the /domain board DOWN column 1, then down
    column 2, then column 3. The /domain page then re-arranges that into a board with
    `organizeDomainsIntoRows`, so the reading order there is row-major.

    The menu had no such step. It poured a COLUMN-major list into a three-column CSS grid, which
    fills ROW-major — so the board was transposed. Concretely, /domain reads
    Design · Development · Business, and the menu read Design · New Tech · Other. Both were
    "the database order"; they were just two different traversals of it.

    Sorting by (row, column) here makes the plain row-major grid in `SiteNav` reproduce the
    board, so the menu and the page finally agree.

    ⚠️ NOT the same as emitting the board's empty cells. Where /domain leaves a gap to keep rows
    aligned, this closes up — a dropdown is short on vertical space and holes in it are wasted
    screen, not alignment. The SEQUENCE matches; the exact grid geometry deliberately does not.
  */
  const groups = [...grouped.values()].sort((a, b) => a.order - b.order || a.column - b.column);

  return <SiteNav groups={groups} totalDomains={domains.length} />;
}
