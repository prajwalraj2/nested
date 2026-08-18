// src/components/header/SiteNav.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { getIcon } from '@/lib/icon-manifest';
import { cn } from '@/lib/utils';
import { COMPANY_LEGAL, COMPANY_LINKS, RESOURCE_LINKS, type SiteLink } from './site-nav-links';

/**
 * The header's interactive shell (M-2).
 * ============================================================================
 *
 * ⚠️ RECEIVES ITS DOMAINS AS PROPS AND FETCHES NOTHING. `SiteHeader` (a server component) does
 * the query, so every link here is already in the HTML before this file runs. See the note there.
 *
 * ⚠️ THEMED THROUGHOUT, unlike the `AppHeader` it replaces — which hard-coded `bg-white/95`,
 * `text-gray-900` and `text-blue-600` and would have been a white bar above a dark page. That is
 * the island problem of #34, and it is far cheaper to avoid now than to unpick later.
 */

export type NavDomain = { id: string; name: string; slug: string; icon: string | null };
export type NavDomainGroup = {
  key: string;
  name: string;
  icon: string | null;
  /** `Category.categoryOrder` - which ROW of the /domain board. See the sort in `SiteHeader`. */
  order: number;
  /** `Category.columnPosition` - which COLUMN of the /domain board (1-3). */
  column: number;
  domains: NavDomain[];
};

type Props = { groups: NavDomainGroup[]; totalDomains: number };

export function SiteNav({ groups, totalDomains }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  /*
    ⚠️ `?from=` ONLY FROM A DOMAIN PAGE, NOT FROM EVERYWHERE.

    `/submit` uses this to PRE-SELECT the domain in its dropdown, and it resolves the slug out of
    the path. `?from=/about` carries nothing it can use, so appending it there would be a query
    string that exists only to be ignored — visible in the address bar, mirrored into analytics,
    and doing nothing.

    Kept inline rather than routed through `resolveHref`: that helper serves the fixed link lists
    in `site-nav-links.ts`, and this button is not one of them.
  */
  const submitHref = pathname.startsWith('/domain/')
    ? `/submit?from=${encodeURIComponent(pathname)}`
    : '/submit';

  return (
    <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur">
      {/*
        ⚠️ A THREE-COLUMN GRID, NOT A FLEX ROW WITH `ml-auto`.

        The nav has to be CENTRED IN THE HEADER, not merely "after the logo". With flex it would
        centre within the space the logo leaves, so it would shift left or right whenever the
        logo or the action group changed width. `1fr auto 1fr` gives the middle column the true
        centre regardless of what flanks it.

        ⚠️ THE EDGE INSET IS BUILT FROM THREE STEPS, AND THE SMALL ONE IS DELIBERATELY TIGHT.

            < md    px-4                                              16px
            md      px-6  + the logo's ml-6/pl-4 and its mirror       64px
            lg      px-10 + the logo's ml-10/pl-4 and its mirror      96px

        Below `md` the nav collapses to a wordmark and a hamburger, and generous side padding
        there just wastes the little width a phone has — so the two controls sit near their
        corners. The roomy inset is a wide-screen affordance only.

        ⚠️ THE EXTRA INSET LIVES ON THE LOGO AND THE ACTION GROUP, NOT HERE. Container padding
        applies to both edges at once, which is the wrong tool when only some breakpoints want
        it — and it would have re-opened the "Submit sits too far right" complaint the moment
        the left side was tuned. Keeping the two offsets separate but numerically equal is what
        makes them read as the same distance from their own edge.
      */}
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-6 lg:px-10">
        {/*
          ⚠️ TWO IMAGE FILES, SWAPPED BY CSS — NOT ONE FILE, AND NOT A JS THEME CHECK.

          Reading the theme in JS to pick a `src` would render the wrong logo on the server (where
          there is no theme) and swap it after hydration — a visible flash, and a hydration
          mismatch on every page. Both images are always in the DOM and `dark:` decides which is
          displayed, so the server output is already correct.

          ⚠️ THE WORDMARK IS `atno`, NOT `atno.io`, AND THAT IS DELIBERATE. `SITE_NAME` in
          `lib/seo.ts` is already 'ATNO', so every page title and OG card says the bare name — the
          header was the one place that disagreed with itself. The full domain still belongs
          off-site (OG images, the footer), where there is no address bar above it to supply it.
          It also survives a future TLD change without a rebrand.

          ⚠️ THE SOURCE FILES ARE UNUSABLE AS SUPPLIED: a solid background with heavy padding, at
          306 KB and 692 KB. They are generated into `public/logo-{dark,light}.png` — trimmed to
          the wordmark and with luminance converted to alpha, which is what makes the background
          transparent AND keeps the antialiased edges smooth. 8-10 KB each. See M-2's record.

          ⚠️ `width`/`height` MUST MATCH THE FILES ON DISK. They are not a display size — `h-6
          w-auto` decides that — they are the aspect ratio Next reserves before the image loads.
          Wrong numbers here mean the header visibly reflows on first paint. The two files differ
          slightly (307 vs 302 wide) because each was trimmed to its own ink, so they are not
          interchangeable.

          `priority` because this is above the fold on every page; without it the logo pops in.
        */}
        {/*
          ⚠️ EVERY OFFSET IS `md:`-PREFIXED — BELOW THAT THE LOGO SITS AT THE CORNER.

          It has an EXACT MIRROR on the action group at the other end (`md:mr-6 md:pr-4
          lg:mr-10`). The two must be changed together or the header stops looking centred: the
          eye reads the gap from each edge, not the grid columns, so an asymmetry of even a few
          pixels shows up as the whole bar leaning.

          ⚠️ `ml` AND `pl` DO DIFFERENT JOBS HERE, which is why both are present rather than one
          combined value. `ml-6` moves the element; `pl-4` grows its clickable box leftward, so
          the extra distance is not dead space — a near-miss on the logo still navigates home.
        */}
        <Link
          href="/"
          className="col-start-1 justify-self-start md:ml-6 md:pl-4 lg:ml-10"
          aria-label="ATNO home"
        >
          <Image
            src="/logo-light.png"
            alt="ATNO"
            width={302}
            height={96}
            priority
            className="h-6 w-auto dark:hidden"
          />
          <Image
            src="/logo-dark.png"
            alt="ATNO"
            width={307}
            height={96}
            priority
            className="hidden h-6 w-auto dark:block"
          />
        </Link>

        {/* ── Desktop ─────────────────────────────────────────────────── */}
        <NavigationMenu className="col-start-2 hidden justify-self-center md:flex" viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Domains</NavigationMenuTrigger>
              {/*
                ⚠️ FOUR OVERRIDES WITH `!`, AND EVERY ONE IS LOAD-BEARING.

                THE GOAL: this panel must be centred ON THE SCREEN. shadcn anchors dropdown
                content to its own trigger (`md:absolute` inside a `relative` menu item), so it
                opened at the "Domains" trigger's left edge and ran off the right of the window -
                which is why the domains at the end were unreachable.

                `md:fixed md:inset-x-0` turns this element into a full-width positioning shell;
                the visible card inside is then centred with a plain `mx-auto`. No transforms are
                involved, so nothing fights the open/close animation.

                ⚠️ WHY `!` IS NEEDED AND `cn()` IS NOT ENOUGH. The classes being overridden are
                `group-data-[viewport=false]/navigation-menu:*` variants. tailwind-merge only
                drops a class when the VARIANT PREFIX matches too - `bg-transparent` and
                `group-data-[...]:bg-popover` look like unrelated keys to it, so both survive, and
                the group-data selector then wins on specificity (two classes plus an attribute
                beats one class). `!` is the only lever that settles it from outside the file.

                  top-16!         the vendored rule is `top-full`. That currently lands correctly
                                  ONLY because the header's `backdrop-filter` happens to make it
                                  the containing block. Pinning 4rem survives that being removed.
                  bg-transparent! ⚠️ without these the popover background, border and shadow
                  border-0!       stretch across the FULL viewport width - a bar under the
                  shadow-none!    header rather than a panel.

                ⚠️ DO NOT DROP THE `md:` PREFIXES. `md:fixed` is what lets tailwind-merge delete
                the vendored `md:absolute`. A bare `fixed` leaves both, and `md:absolute` then
                wins inside its media query.
              */}
              <NavigationMenuContent className="md:fixed md:inset-x-0 md:w-auto md:top-16! md:border-0! md:bg-transparent! md:shadow-none!">
                {/*
                  ⚠️ `w-[min(96vw,64rem)]` is capped in BOTH directions. A fixed `64rem` overflows
                  a 1024px laptop; a bare `96vw` becomes an absurd 1800px panel on a wide monitor.
                */}
                <div className="bg-popover text-popover-foreground mx-auto w-[min(96vw,64rem)] overflow-hidden rounded-lg border shadow-lg">
                  {/*
                    ⚠️ THE HEIGHT CAP IS THE FIX FOR "SOME DOMAINS GO BELOW THE SCREEN".

                    With ~35 domains the panel was simply taller than the window, and a dropdown
                    has no scrollbar of its own - the overflow was unreachable rather than merely
                    off-screen. `100svh` and not `100vh`, because on mobile browsers `vh` is the
                    height WITHOUT the address bar, which would still hide the last row.

                    `9rem` covers the 4rem header, this panel's offset, the footer strip below,
                    and a little clearance at the bottom edge.
                  */}
                  <div className="max-h-[calc(100svh-9rem)] overflow-y-auto p-5">
                    {/*
                      ⚠️ THE GROUPS ARRIVE PRE-SORTED - see the long note in `SiteHeader.tsx`.
                      This is a plain row-major grid, so what it displays IS the order of the
                      array, which is now the same board the /domain page renders.

                      ⚠️ NO CATEGORY HEADINGS AND NO RULES, removed deliberately. /domain does not
                      label its columns either; the gap between groups is the separator. The
                      headings also cost roughly a third of the panel's height, which is part of
                      why it ran off the bottom of the screen.

                      2 columns then 3, matching the pages. One column is never reached: the whole
                      menu is `hidden md:flex`, and below that the Sheet takes over.
                    */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-3">
                      {groups.map((group) => (
                        <ul key={group.key} className="space-y-0.5">
                          {group.domains.map((domain) => (
                            <li key={domain.id}>
                              {/*
                                ⚠️ `flex-row` IS THE FIX FOR THE NAMES BREAKING ONTO A SECOND LINE,
                                AND IT HAS TO SIT ON THIS COMPONENT - not on the `<Link>` inside.

                                `NavigationMenuLink` ships with `flex flex-col gap-1`
                                (`ui/navigation-menu.tsx:135`). The `<Link>` used to carry
                                `flex items-center gap-2`, and `asChild` CONCATENATES the two
                                class strings - Radix's Slot joins them, it does not run
                                tailwind-merge. The element therefore had `flex-col` AND
                                `items-center`: a vertical, centre-aligned stack. Domains whose
                                icon is a real image (Facebook, TED, YouTube) pushed that image
                                onto its own line above the name. The other ~1,200 carry their
                                emoji INSIDE the name string, so they looked fine - which is
                                exactly why only some rows appeared broken.

                                Passing the classes HERE routes them through this component's own
                                `cn()`, where tailwind-merge properly deletes `flex-col` and
                                `gap-1`. The child `<Link>` now carries no layout classes at all.
                              */}
                              <NavigationMenuLink
                                asChild
                                className="hover:bg-accent flex-row items-center gap-2 rounded-md px-2 py-1.5"
                              >
                                <Link href={`/domain/${domain.slug}`}>
                                  <DomainIcon icon={domain.icon} />
                                  {/*
                                    ⚠️ `min-w-0` is what makes `truncate` work at all. A flex item
                                    defaults to `min-width: auto` and refuses to shrink below its
                                    own text, so the ellipsis never triggers and a long name
                                    overflows the column instead. Same rule as the table layout.
                                  */}
                                  <span className="min-w-0 truncate">{domain.name}</span>
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  </div>

                  {/*
                    ⚠️ OUTSIDE the scrolling box, so the count and the escape hatch stay visible
                    however far down the list you have scrolled.
                  */}
                  <div className="border-border text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-xs">
                    <span>{totalDomains} domains</span>
                    <NavigationMenuLink asChild className="flex-row p-0">
                      <Link href="/domain" className="hover:text-foreground text-xs font-medium">
                        View all domains →
                      </Link>
                    </NavigationMenuLink>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Company</NavigationMenuTrigger>
              <NavigationMenuContent>
                {/*
                  ⚠️ THE dub.co PATTERN: an icon tile, a title, and one line of description -
                  not a bare list of labels. The description is the point of the pattern; it is
                  what lets someone choose between "Contact" and "Feedback" without clicking
                  either. That is why `hint` is now filled in on EVERY link in
                  `site-nav-links.ts`, including the legal pair, which previously had none.

                  ⚠️ SECTION HEADINGS ARE KEPT HERE BUT REMOVED FROM THE DOMAINS MENU. Not an
                  inconsistency: "Company" and "Legal" are the only thing distinguishing two
                  otherwise identical columns of links, whereas the domain groups are already
                  told apart by the names inside them and by the gap between them.
                */}
                <div className="grid w-[34rem] grid-cols-2 gap-x-4 p-3">
                  <MenuColumn title="Company" links={COMPANY_LINKS} />
                  {/*
                    ⚠️ A LEFT BORDER, IN THE dub.co MANNER - the divider belongs to the second
                    column rather than being a separate element, so it cannot drift out of step
                    with the columns if one is added or removed.
                  */}
                  <MenuColumn title="Legal" links={COMPANY_LEGAL} className="border-border border-l pl-4" />
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
              <NavigationMenuContent>
                {/*
                  One column rather than Company's two - four links do not need splitting, and a
                  half-empty second column reads as a missing section.
                */}
                <div className="w-[22rem] p-3">
                  <MenuColumn title="Resources" links={RESOURCE_LINKS} />
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/*
          ⚠️ `col-start-3` IS NOT DECORATION — WITHOUT IT THIS GROUP DRIFTS TO THE CENTRE ON MOBILE.

          The `NavigationMenu` above is `hidden` below `md`, and `hidden` is `display: none`. A
          `display:none` grid item is NOT laid out at all — it does not merely become zero-width,
          it stops occupying a track. So under `md` the grid had only two items to auto-place,
          this one slid up into column 2 (the `auto` middle column), and column 3 sat empty.
          `justify-self-end` then aligned it to the end of a column that is exactly its own width
          — i.e. did nothing — leaving Submit and the hamburger floating in the middle of the bar.

          Pinning all three items to explicit columns makes the layout independent of how many of
          them happen to be visible at any breakpoint.
        */}
        {/*
          ⚠️ `md:mr-6 md:pr-4 lg:mr-10` IS THE EXACT MIRROR OF THE LOGO'S `md:ml-6 md:pl-4
          lg:ml-10`. Same numbers, opposite side, same breakpoints — so Submit stands off the
          right edge by precisely what the wordmark stands off the left. Change one and the
          other has to follow, or the bar looks like it is sliding sideways.

          Below `md` both drop away and the hamburger returns to the corner, matching the logo.
        */}
        <div className="col-start-3 flex items-center gap-2 justify-self-end md:mr-6 md:pr-4 lg:mr-10">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={submitHref}>
              Submit
              <Plus className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          {/* ── Mobile ────────────────────────────────────────────────── */}
          {/*
            ⚠️ A SHEET, NOT THE MEGA-MENU. `NavigationMenu` positions its content as a floating
            panel sized to the trigger — workable at 1200px, unusable at 390px with 25 domains in
            it. The sheet is a separate presentation of the same data, which is exactly why the
            fixed links live in one shared file.
          */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="size-4" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
              <SheetHeader className="border-border border-b">
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>

              <nav className="space-y-6 px-4 py-5">
                <MobileSection title="Domains">
                  {groups.map((group) => (
                    <div key={group.key} className="mb-3">
                      <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                        {group.name}
                      </p>
                      <ul>
                        {group.domains.map((domain) => (
                          <li key={domain.id}>
                            <Link
                              href={`/domain/${domain.slug}`}
                              onClick={() => setMobileOpen(false)}
                              className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                            >
                              <DomainIcon icon={domain.icon} />
                              <span className="truncate">{domain.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </MobileSection>

                <MobileSection title="Company">
                  {[...COMPANY_LINKS, ...COMPANY_LEGAL].map((link) => (
                    <MobileLink key={link.href} link={link} onNavigate={() => setMobileOpen(false)} />
                  ))}
                </MobileSection>

                <MobileSection title="Resources">
                  {RESOURCE_LINKS.map((link) => (
                    <MobileLink key={link.label} link={link} onNavigate={() => setMobileOpen(false)} />
                  ))}
                </MobileSection>

                <Button asChild className="w-full">
                  <Link href={submitHref} onClick={() => setMobileOpen(false)}>
                    Submit a tool
                    <Plus className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/*
        ⚠️ Not rendered, but not pointless: marks the current section for assistive tech without
        adding a visual state the design does not have. `aria-current` on a link the eye cannot
        distinguish is still meaningful to a screen reader.
      */}
      <span className="sr-only" aria-live="off">
        {pathname.startsWith('/domain') ? 'Browsing domains' : ''}
      </span>
    </header>
  );
}

/**
 * Resolve a link's `href`, adding `?from=` when the destination asked for it.
 *
 * ⚠️ THIS IS WHY EVERY FEEDBACK ROW ARRIVED WITH `pageUrl: NULL`. The form tried to read
 * `document.referrer`, which is set when a DOCUMENT loads — but a Next `<Link>` is a client-side
 * transition that never reloads the document, so the referrer stayed empty. The header is the only
 * place that reliably knows which page the visitor was on, so the link carries it.
 *
 * ⚠️ USED BY BOTH THE DESKTOP MENU AND THE MOBILE SHEET. Feedback opened from the hamburger
 * has to carry the page just as much as feedback opened from the mega-menu, and two copies of this
 * line is exactly how one of them ends up without it.
 *
 * ⚠️ `encodeURIComponent`, because a path can contain characters that would end the query
 * value early — an `&` in a slug would truncate it silently.
 *
 * Already on the destination? Then there is no useful "from" to record: `?from=/feedback` would
 * only say the visitor came from the feedback page.
 */
function resolveHref(link: SiteLink, pathname: string): string {
  if (!link.appendFrom) return link.href;
  if (pathname === link.href) return link.href;
  return `${link.href}?from=${encodeURIComponent(pathname)}`;
}

/**
 * A labelled column of dub.co-style link tiles.
 *
 * ⚠️ Shared by Company and Resources so the two menus cannot drift apart visually. The previous
 * version hand-rolled each menu's markup, which is how the Company menu ended up with a legal
 * strip in a different type size from everything around it.
 */
function MenuColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: SiteLink[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-1 px-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.label}>
            <MenuLink link={link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One entry in a dropdown - a link, or dimmed text when the destination does not exist yet. */
function MenuLink({ link }: { link: SiteLink }) {
  const Icon = link.icon;
  const pathname = usePathname();

  /*
    ⚠️ THE INNER MARKUP IS BUILT ONCE AND REUSED BY BOTH BRANCHES BELOW. A `soon` entry and a real
    link differ only in their WRAPPER - one is a `<div>`, the other an anchor - so duplicating the
    tile in both branches would be two copies to keep in step for no benefit.
  */
  const body = (
    <>
      {/*
        ⚠️ `shrink-0` on the tile. Without it the icon square is squashed into a rectangle by a
        long description, because a flex item's default `flex-shrink: 1` lets it give up width.
      */}
      <span className="bg-muted border-border/60 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      {/* `min-w-0` so a long hint wraps inside the column instead of widening the whole panel. */}
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          {link.label}
          {link.soon && (
            <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-semibold">soon</span>
          )}
        </span>
        {link.hint && <span className="text-muted-foreground block text-xs">{link.hint}</span>}
      </span>
    </>
  );

  /*
    ⚠️ NOT AN ANCHOR, AND NOT `href="#"`. A destination that does not exist yet renders as dimmed,
    non-clickable text - `#` would scroll to the top of the page, which reads as a broken link
    rather than an unfinished one. See the note on `soon` in site-nav-links.ts.
  */
  if (link.soon) {
    return (
      <div className="text-muted-foreground flex cursor-default items-center gap-3 rounded-md p-2 opacity-70">
        {body}
      </div>
    );
  }

  return (
    /*
      ⚠️ `flex-row` HERE FOR THE SAME REASON AS THE DOMAIN LINKS: this component's base class is
      `flex flex-col gap-1`, and `asChild` concatenates rather than merging. Passing layout through
      this component's `className` is the only route that reaches tailwind-merge.
    */
    <NavigationMenuLink asChild className="hover:bg-accent flex-row items-center gap-3 rounded-md p-2">
      <Link
        href={resolveHref(link, pathname)}
        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {body}
      </Link>
    </NavigationMenuLink>
  );
}

function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function MobileLink({ link, onNavigate }: { link: SiteLink; onNavigate: () => void }) {
  const pathname = usePathname();

  if (link.soon) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm">
        {link.label}
        <span className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-semibold">soon</span>
      </div>
    );
  }
  return (
    <Link
      href={resolveHref(link, pathname)}
      onClick={onNavigate}
      {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="hover:bg-accent block rounded-md px-2 py-1.5 text-sm"
    >
      {link.label}
    </Link>
  );
}

/**
 * A domain's icon, or nothing.
 *
 * ⚠️ `getIcon` returns null for an unrecognised id, and rendering nothing is correct — 1,200 of
 * the existing rows carry their emoji inside the NAME instead, so most domains legitimately have
 * no icon and a placeholder would be visual noise on almost every row.
 */
function DomainIcon({ icon }: { icon: string | null }) {
  const resolved = getIcon(icon);
  if (!resolved) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={resolved.url} alt="" className={cn('size-4 shrink-0')} aria-hidden="true" />;
}
