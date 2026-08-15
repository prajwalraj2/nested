'use client';

import type { PageStatus } from '@/generated/prisma';
import { PAGE_STATUS_LABELS } from '@/lib/page-status';
import { getIcon } from '@/lib/icon-manifest';
import type { DomainStatus } from '@/generated/prisma';
import Link from 'next/link';
import {
  ChevronRight,
  ExternalLink,
  FileText,
  FolderTree,
  LayoutList,
  MoreHorizontal,
  Palette,
  PenLine,
  Plus,
  Route,
  Table2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The page hierarchy tree (rebuilt in Phase G-4c).
 * ============================================================================
 *
 * ⚠️ THIS WAS THE WORST-READING SCREEN IN THE ADMIN, AND THE REASON IS MEASURABLE.
 * ==========================================================================
 * Every row rendered a four-column grid in which each value carried its own LABEL
 * underneath it:
 *
 *     🖼️ UI/UX Designing      /__main__      /domain/uiux      Root
 *        Section Based           Slug          Preview URL      Parent
 *
 * With 50 pages in a domain that is **150 label renders** — "Slug", "Preview URL", "Parent"
 * repeated 50 times each — none of which tells you anything after the first row. They are
 * what made each row roughly 80px tall, so a 50-page domain became a wall of text you had
 * to scroll through to find one page.
 *
 * WHAT CHANGED, AND WHY EACH ONE
 * ------------------------------
 * 1. **The repeated labels are gone.** `/ytube` is self-evidently a slug; it does not need
 *    the word "Slug" beneath it on every row.
 *
 * 2. **The Parent column is gone entirely.** For a `direct` domain every child page read
 *    `__main__ (Hidden)` — the same six characters, 49 times, carrying zero information.
 *    And the tree's own indentation already shows parentage better than a text column can.
 *    That is what a tree IS.
 *
 * 3. **The preview URL is no longer printed in full on every row.** It was
 *    `/domain/uiux/ytube` where the `/domain/uiux` prefix is identical for all 50 rows. The
 *    row now shows the page's own path and links out from an icon.
 *
 * 4. **Rows are one line instead of three**, so roughly three times as many pages fit on
 *    screen — the actual fix for "I cannot find anything on this page".
 *
 * 5. ⚠️ **Actions are no longer invisible.** They were `opacity-0 group-hover:opacity-100`,
 *    which has a real accessibility bug hiding in it: `opacity-0` still leaves the buttons
 *    in the tab order, so a keyboard user tabs into four **invisible** controls per row —
 *    200 invisible stops in a 50-page tree — and on a touch screen there is no hover at all,
 *    so they were unreachable. One always-visible menu button per row replaces them.
 *
 * 6. **Real tree semantics** — `role="tree"`/`treeitem`/`group`, `aria-expanded` and
 *    `aria-level`. The old markup was nested `div`s, so assistive tech had no idea it was
 *    a hierarchy or how deep any row sat.
 *
 * 51 hardcoded colours → 0.
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  status: DomainStatus;
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  /** Lifecycle state. Optional so callers with the older shape still compile. */
  status?: PageStatus;
  /** Icon id from public/icons/, or null when the emoji in the title is used. */
  icon?: string | null;
  parentId: string | null;
  domainId: string;
  targetCountries?: string[];
  createdAt: Date;
  children: Page[];
  depth: number;
  fullPath: string;
  previewUrl: string;
};

type PageTreeProps = {
  pages: Page[];
  domain: Domain;
  expandedPages: Set<string>;
  onToggleExpand: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  onEditPage: (page: Page) => void;
  onDeletePage: (pageId: string) => void;
};

export function PageTree({
  pages,
  domain,
  expandedPages,
  onToggleExpand,
  onCreateChild,
  onEditPage,
  onDeletePage,
}: PageTreeProps) {
  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <FileText className="text-muted-foreground size-8" aria-hidden="true" />
        <p className="font-medium">No pages yet</p>
        <p className="text-muted-foreground text-sm">
          Create the first page for <strong className="text-foreground">{domain.name}</strong>.
        </p>
        <p className="text-muted-foreground max-w-md text-xs">
          {domain.pageType === 'direct'
            ? 'Pages will be created under the hidden __main__ page.'
            : 'You can create root-level pages that attach directly to the domain.'}
        </p>
      </div>
    );
  }

  const total = getTotalPageCount(pages);

  return (
    <div className="space-y-2">
      {/*
        The count bar. The old one also carried two hint strings — "🔍 Use + to add child
        pages" and "🔗 Click links to preview" — permanent instructions for controls that
        are now labelled in a menu, so the hints have nothing left to explain.
      */}
      <p className="text-muted-foreground text-xs">
        {total} page{total === 1 ? '' : 's'} in this domain
      </p>

      {/*
        `role="tree"` — the container declaration that makes the `treeitem`s below mean
        something. Without it they are announced as generic list items with no hierarchy.
      */}
      <div role="tree" aria-label={`Pages in ${domain.name}`} className="rounded-md border">
        {pages.map((page) => (
          <PageTreeNode
            key={page.id}
            page={page}
            expandedPages={expandedPages}
            onToggleExpand={onToggleExpand}
            onCreateChild={onCreateChild}
            onEditPage={onEditPage}
            onDeletePage={onDeletePage}
            level={0}
          />
        ))}
      </div>
    </div>
  );
}

type PageTreeNodeProps = {
  page: Page;
  expandedPages: Set<string>;
  onToggleExpand: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  onEditPage: (page: Page) => void;
  onDeletePage: (pageId: string) => void;
  level: number;
};

function PageTreeNode({
  page,
  expandedPages,
  onToggleExpand,
  onCreateChild,
  onEditPage,
  onDeletePage,
  level,
}: PageTreeNodeProps) {
  const hasChildren = page.children.length > 0;
  const isExpanded = expandedPages.has(page.id);

  /**
   * `__main__` is the invisible root the app creates for every `direct` domain (#11). It is
   * never reachable on the public site and cannot be deleted — the API refuses — so it is
   * shown but marked, rather than hidden. Hiding it would make its children look parentless.
   */
  const isMainPage = page.slug === '__main__';
  // Null when unset, or when the SVG was deleted while rows still referenced it.
  const pageIcon = getIcon(page.icon);

  const TypeIcon = CONTENT_TYPE_ICONS[page.contentType] ?? FileText;

  return (
    <div role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-level={level + 1}>
      <div
        className={
          // `border-b last:border-b-0` gives rows a shared rule instead of the old
          // `space-y-1` gaps, which made a 50-row tree read as 50 separate cards.
          'group flex items-center gap-2 border-b py-1.5 pr-2 last:border-b-0 ' +
          (isMainPage ? 'bg-muted/50' : 'hover:bg-muted/50')
        }
        /*
          ⚠️ Indentation as inline padding, not a Tailwind class. Depth is unbounded, so
          `pl-${level*6}` cannot work — Tailwind only emits classes it can see in the source
          at build time, and a computed class name is invisible to that scan. The `+ 8`
          keeps the shallowest row off the border.
        */
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {/* Expand / collapse */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            onClick={() => onToggleExpand(page.id)}
            // Names the row, so it is not just "button" repeated 50 times.
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${page.title}`}
          >
            {/*
              A rotating `ChevronRight`, replacing a `▶` TEXT CHARACTER in a rotated span.
              The glyph rendered at a different size and baseline on every platform, and
              could not inherit the theme colour.
            */}
            <ChevronRight
              className={'size-4 transition-transform ' + (isExpanded ? 'rotate-90' : '')}
              aria-hidden="true"
            />
          </Button>
        ) : (
          // A spacer of exactly the button's width, so leaf rows align with parent rows.
          // The old version drew a small grey dot here, which read as a bullet rather than
          // as alignment.
          <span className="size-6 shrink-0" aria-hidden="true" />
        )}

        {/*
          The content-type glyph. Was an emoji in a coloured 32px tile — six hardcoded
          `bg-*-100 text-*-700` pairs. A lucide icon inherits `currentColor`, so it themes,
          and at `size-4` it stops competing with the title for attention.
        */}
        <TypeIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />

        {/* Title + path. `min-w-0` so long titles truncate instead of pushing the row wide. */}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {/*
            The public-facing icon, shown alongside the content-type icon rather than replacing
            it — they say different things: `TypeIcon` is what KIND of page this is (table, rich
            text), this is what visitors will see beside its name.

            ⚠️ Mainly here so a row carrying BOTH an icon and an emoji in its title is visible
            in the admin, not only on the live page. See NEW-IMPROVEMENTS.md §27.6.
          */}
          {pageIcon && (
            <img
              src={pageIcon.url}
              alt=""
              width={16}
              height={16}
              className="size-4 shrink-0 self-center"
            />
          )}
          <span className="truncate text-sm font-medium">{page.title}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-xs">/{page.slug}</span>
          {isMainPage && (
            <Badge variant="secondary" className="shrink-0 font-normal">
              Hidden
            </Badge>
          )}
          {/*
            Status, shown ONLY when it is not the norm. "Live" on 1,205 rows would be noise —
            the same reasoning as the Draft badge on the domain picker. `outline` for Upcoming
            and `secondary` for Draft differ in border as well as weight, so the two are
            distinguishable without relying on colour.
          */}
          {page.status && page.status !== 'PUBLISHED' && (
            <Badge
              variant={page.status === 'UPCOMING' ? 'outline' : 'secondary'}
              className="shrink-0 font-normal"
            >
              {PAGE_STATUS_LABELS[page.status]}
            </Badge>
          )}
        </div>

        {/*
          Content type as text, `hidden md:inline` so it drops out on narrow screens where
          the title matters more. The icon still carries it at any width.
        */}
        <span className="text-muted-foreground hidden shrink-0 text-xs md:inline">
          {formatContentType(page.contentType)}
        </span>

        {/*
          Preview as an icon link rather than the full URL printed on every row.

          ⚠️ `__main__` has no public URL of its own — its `previewUrl` is the domain root —
          so the link still works and points where you would expect.
        */}
        <Link
          href={page.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          aria-label={`Open ${page.title} in a new tab`}
          title={page.previewUrl}
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>

        {/*
          One menu replacing four hover-only emoji buttons — see point 5 in the header note
          for why the old `opacity-0` pattern was a keyboard trap.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={`Actions for ${page.title}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onCreateChild(page.id)}>
              <Plus className="size-4" aria-hidden="true" />
              Add child page
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => onEditPage(page)}>
              <PenLine className="size-4" aria-hidden="true" />
              Edit page
            </DropdownMenuItem>

            {/* `asChild` keeps it a real anchor, so middle-click and "open in new tab" work. */}
            <DropdownMenuItem asChild>
              <Link href={page.previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                Preview page
              </Link>
            </DropdownMenuItem>

            {/*
              Delete is omitted for `__main__` rather than shown-and-disabled: the API
              rejects it outright (#11), so offering it would be a control that can only
              ever fail.
            */}
            {!isMainPage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDeletePage(page.id)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete page
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/*
        `role="group"` wraps the children so the tree structure is explicit. Rendered only
        when expanded — mounting collapsed subtrees would build DOM for pages nobody is
        looking at, which on a deep tree is most of them.
      */}
      {hasChildren && isExpanded && (
        <div role="group">
          {page.children.map((child) => (
            <PageTreeNode
              key={child.id}
              page={child}
              expandedPages={expandedPages}
              onToggleExpand={onToggleExpand}
              onCreateChild={onCreateChild}
              onEditPage={onEditPage}
              onDeletePage={onDeletePage}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Total pages including every nested level.
 *
 * `pages.length` alone counts only the roots — for a `direct` domain that is always 1, the
 * `__main__` page, no matter how many pages the domain really has.
 */
function getTotalPageCount(pages: Page[]): number {
  return pages.reduce((count, page) => count + 1 + getTotalPageCount(page.children), 0);
}

/**
 * Content type → icon.
 *
 * Replaces two parallel maps: one of emoji and one of `bg-*-100 text-*-700` pairs. The
 * colours were decorative — six content types in six different pastels, none of which
 * signalled anything — and emoji cannot inherit `currentColor`, so they ignored the theme.
 */
const CONTENT_TYPE_ICONS: Record<string, LucideIcon> = {
  narrative: FileText,
  section_based: LayoutList,
  subcategory_list: FolderTree,
  table: Table2,
  rich_text: PenLine,
  mixed_content: Palette,
  // Phase L. ⚠️ `Route` is also the icon used for Roadmaps in the admin sidebar and in
  // SectionEditor's PageTypeIcon — one content type, one glyph, everywhere it appears.
  roadmap: Route,
};

/** Content type → human label. Falls back to the raw value for anything unmapped. */
function formatContentType(contentType: string): string {
  const formatted: Record<string, string> = {
    narrative: 'Narrative',
    section_based: 'Section based',
    subcategory_list: 'Subcategory list',
    table: 'Table',
    rich_text: 'Rich text',
    mixed_content: 'Mixed content',
    roadmap: 'Roadmap',
  };
  return formatted[contentType] || contentType;
}
