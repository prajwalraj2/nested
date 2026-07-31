import Link from 'next/link';
import {
  Globe,
  FileText,
  Table2,
  FolderTree,
  FileType2,
  Columns3,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Dashboard shortcuts (Phase G-2).
 * ============================================================================
 *
 * ⚠️ THREE OF THE SIX PREVIOUS ACTIONS WERE BROKEN OR REDUNDANT — fixed here, not just
 * restyled:
 *
 *   "Edit Content"      -> /admin/content   **this route does not exist** — a 404, the
 *                                           same class of dead link as the `/admin/editor`
 *                                           sidebar entry found in G-1
 *   "View All Domains"  -> /admin/domains   identical destination to "Create New Domain"
 *   "System Overview"   -> /admin           a link to the page you are already on
 *
 * They are replaced with the three real create/manage routes that had no shortcut at all:
 * tables, rich text and section layout. Six actions, six distinct working destinations.
 *
 * ⚠️ The old list carried a `color` field (`'blue'`, `'green'`, `'purple'`…) driving
 * hardcoded classes, plus a `primary` flag rendering one action as a large
 * `bg-blue-600 text-white` panel. Both are gone: colour-coding six equally-weighted
 * shortcuts adds decoration rather than meaning, and every one of those classes was fixed
 * light. The primary action keeps its emphasis through `variant="default"` instead.
 */

type QuickAction = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  /** Exactly one action is primary — the most common thing to do from here. */
  primary?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: 'New domain',
    description: 'Add a content domain',
    icon: Globe,
    href: '/admin/domains',
    primary: true,
  },
  {
    title: 'New page',
    description: 'Add a page to a domain',
    icon: FileText,
    href: '/admin/pages',
  },
  {
    title: 'New table',
    description: 'Create a data table',
    icon: Table2,
    // A real create route, unlike the three it replaces.
    href: '/admin/tables/new',
  },
  {
    title: 'Categories',
    description: 'Organise domain categories',
    icon: FolderTree,
    href: '/admin/categories',
  },
  {
    title: 'Rich text',
    description: 'Edit page content',
    icon: FileType2,
    href: '/admin/rich-text',
  },
  {
    title: 'Section layout',
    description: 'Arrange page sections',
    icon: Columns3,
    href: '/admin/sections',
  },
];

export function QuickActions() {
  const [primary, ...secondary] = QUICK_ACTIONS;

  return (
    <div className="space-y-3">
      {/*
        The primary action spans the full width so it reads first, but it is a normal
        `Button` — the old version was a bespoke `bg-blue-600` panel twice the height of
        everything else, which made the dashboard's loudest element a shortcut rather than
        the data.
      */}
      <Button asChild className="h-auto w-full justify-start py-3">
        <Link href={primary.href}>
          <primary.icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex flex-col items-start text-left">
            <span className="font-medium">{primary.title}</span>
            <span className="text-xs font-normal opacity-80">{primary.description}</span>
          </span>
        </Link>
      </Button>

      <div className="grid gap-2 sm:grid-cols-2">
        {secondary.map(action => (
          <Button
            key={action.href}
            asChild
            variant="outline"
            className="h-auto justify-start py-3"
          >
            <Link href={action.href}>
              <action.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="truncate font-medium">{action.title}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
