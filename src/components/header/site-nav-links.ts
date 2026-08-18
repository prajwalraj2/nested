// src/components/header/site-nav-links.ts

import {
  Activity,
  Briefcase,
  Feather,
  Mail,
  MessageSquare,
  Scale,
  ShieldCheck,
  SquareStack,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * The site header's fixed menus — Company and Resources (M-2).
 * ============================================================================
 *
 * ⚠️ ONE LIST, USED BY BOTH THE DESKTOP MENU AND THE MOBILE SHEET.
 *
 * The header renders twice — a `NavigationMenu` above `md` and a `Sheet` below it — and two
 * hand-maintained copies of the same links is how a menu item ends up on desktop and missing on
 * mobile, with nothing to catch it. Adding a page means editing this file only.
 *
 * ⚠️ The Domains menu is NOT here. It is built from the database at request time, because a
 * hard-coded list of 25 domains would drift the moment one is added or renamed.
 */

export type SiteLink = {
  label: string;
  href: string;
  /**
   * ⚠️ A COMPONENT REFERENCE, NOT A NAME STRING — e.g. `Users`, not `'users'`.
   *
   * A string would need a lookup map somewhere, and a typo in it fails at RUNTIME with a blank
   * tile. Storing the component itself means a wrong name is a TypeScript error, and it lets
   * the bundler drop every lucide icon we do not use.
   *
   * ⚠️ This file stays `.ts`, not `.tsx` — a component REFERENCE is just a value, so no JSX
   * syntax is needed here. The JSX (`<Icon />`) happens in `SiteNav.tsx`.
   */
  icon: LucideIcon;
  /** One line under the label in the dropdown. Omitted in the mobile sheet, which is tighter. */
  hint?: string;
  /**
   * ⚠️ Renders as dimmed, non-clickable text with a "soon" tag.
   *
   * For a destination that genuinely does not exist yet — the status page lives on a hosted
   * service whose URL we do not have. `href="#"` was the obvious alternative and is worse: it
   * scrolls to the top of the page, which reads as a broken link rather than an unfinished one.
   */
  soon?: boolean;
  /** Opens in a new tab with `rel="noopener noreferrer"`. */
  external?: boolean;
  /**
   * ⚠️ APPEND `?from=<current path>` WHEN RENDERING THIS LINK.
   *
   * The feedback form needs to know which page the visitor was looking at, and it CANNOT work
   * that out for itself. `document.referrer` is set when a DOCUMENT loads; a Next `<Link>` is a
   * client-side transition that never reloads the document, so the referrer stays empty on a
   * direct visit and stale on any other. Every report arrived with `pageUrl: NULL`.
   *
   * The only reliable source is the header, which knows the path it is being rendered on. So the
   * link carries it.
   */
  appendFrom?: boolean;
};

/**
 * ⚠️ EVERY LINK NOW CARRIES A `hint`, INCLUDING THE LEGAL PAIR.
 *
 * The dropdowns render as icon + title + one line of description (the dub.co pattern the user
 * asked for), and a tile with a blank second line looks like the description failed to load
 * rather than like a deliberate omission. So the field went from optional-in-practice to
 * filled-everywhere, and `COMPANY_LEGAL` — which previously had labels only — gained hints.
 */
export const COMPANY_LINKS: SiteLink[] = [
  { label: 'About us', href: '/about', icon: Users, hint: 'What ATNO is, and who builds it' },
  { label: 'Contact', href: '/contact', icon: Mail, hint: 'Get in touch' },
  { label: 'Careers', href: '/careers', icon: Briefcase, hint: 'Open roles' },
];

export const COMPANY_LEGAL: SiteLink[] = [
  { label: 'Privacy policy', href: '/privacy', icon: ShieldCheck, hint: 'What we collect, and why' },
  { label: 'Terms & conditions', href: '/terms', icon: Scale, hint: 'The rules for using ATNO' },
];

export const RESOURCE_LINKS: SiteLink[] = [
  { label: 'Blog', href: '/blogs', icon: Feather, hint: 'Guides and writing' },
  { label: 'Changelog', href: '/changelog', icon: SquareStack, hint: 'What we are building' },
  { label: 'Feedback', href: '/feedback', icon: MessageSquare, hint: 'Report a bug or suggest a feature', appendFrom: true },
  /*
    ⚠️ A hosted uptime service on its own subdomain, not a page on this site. Marked `soon`
    until the URL exists — see the note on the field.
  */
  { label: 'Status', href: '#', icon: Activity, soon: true, hint: 'Uptime and incidents' },
];

/**
 * ⚠️ Several of these point at pages that do not exist yet (M-3 … M-9 build them).
 *
 * That is a deliberate call by the user — the menus describe the site being built rather than
 * only what is finished. The cost is real: **a menu item that 404s is worse than an absent one**,
 * so M-3 must land in the same release as this header, and the remaining ones should not sit
 * broken for long.
 *
 * The honest alternative was to add each link as its page shipped. It was rejected because a
 * header with one working menu is not worth deploying.
 */
/*
  ⚠️ ENTRIES LEAVE THIS LIST AS THEIR STEP SHIPS — `/feedback` with M-5, `/submit` with M-6.
  The list is the honest record of which menu items still 404, so removing an entry is part of
  finishing a step, not a tidy-up. Three to go: M-7 clears `/changelog`, M-8 `/careers`,
  M-9 `/blogs`.
*/
export const PENDING_ROUTES = ['/careers', '/blogs', '/changelog'] as const;
