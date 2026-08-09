'use client';

import { useState } from 'react';
import Link from 'next/link';
// `useRouter` gives us `router.refresh()` — see the long note on it in `handleStatusChange`.
// It comes from `next/navigation` (the App Router version), NOT `next/router` (Pages Router,
// which would throw here).
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  MoreHorizontal,
  Network,
  Pencil,
  Target,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DomainForm } from './DomainForm';
import type { DomainStatus } from '@/generated/prisma';
import { DOMAIN_STATUSES, DOMAIN_STATUS_LABELS } from '@/lib/domain-status';
import { getIcon } from '@/lib/icon-manifest';

/**
 * How each status is drawn in the table.
 *
 * ⚠️ Deliberately NOT colour-only. The three variants differ in weight and border as well as
 * hue — solid, outlined, muted — so the distinction survives dark mode and does not depend on
 * a reader distinguishing two similar colours. Same reasoning as the section badges in G-6c.
 */
const STATUS_BADGE_VARIANT: Record<DomainStatus, 'default' | 'secondary' | 'outline'> = {
  PUBLISHED: 'default',
  UPCOMING: 'outline',
  DRAFT: 'secondary',
};

/** Icon per status in the row menu — `Clock` reads as "later" without needing the label. */
const STATUS_ICON: Record<DomainStatus, typeof Eye> = {
  PUBLISHED: Eye,
  UPCOMING: Clock,
  DRAFT: EyeOff,
};

/**
 * Domains table (rebuilt in Phase G-3b).
 * ============================================================================
 *
 * WHAT THIS SCREEN IS FOR
 * -----------------------
 * One row per content domain (35 of them today), with the four actions you actually
 * perform on a domain: edit it, look at it live, change its status, delete it.
 *
 * WHAT THE REBUILD FIXED — four genuine bugs, not just styling
 * -----------------------------------------------------------
 * 1. ⚠️ THE PUBLISH TOGGLE DID NOTHING. The old handler was literally
 *
 *        onPublishToggle={() => setPublishingDomain(domain.id)}
 *
 *    — it set a state flag and stopped. No network request, and nothing ever cleared
 *    the flag, so clicking it swapped the icon to an hourglass FOREVER and never changed
 *    the domain. Meanwhile `PATCH /api/admin/domains/[id]` already accepted
 *    `{ isPublished }`, already worked, and already called `invalidateDomains()` to bust
 *    the public cache. The endpoint was fine; the button was never wired to it. It is
 *    wired now — see `handleStatusChange`, which in Phase H replaced the boolean toggle
 *    with an explicit status set, because a toggle cannot reach a third state.
 *
 * 2. ⚠️ BOTH MODAL BACKDROPS RENDERED SOLID BLACK. They used
 *    `className="fixed inset-0 bg-black bg-opacity-50"`, but `bg-opacity-*` is Tailwind
 *    **v3** syntax and was REMOVED in v4 — which is what this project runs. An unknown
 *    utility is simply dropped, so only `bg-black` survived and the "translucent" overlay
 *    blacked out the entire page behind the dialog. Radix's own overlay (inside
 *    `DialogContent` / `AlertDialogContent`) uses `bg-black/50`, the v4 slash-opacity
 *    syntax, so this class of bug cannot recur here.
 *
 * 3. ⚠️ DELETE CASCADED WITHOUT SAYING HOW FAR. `DELETE /api/admin/domains/[id]` runs a
 *    transaction that deletes every ContentBlock, then every Page, then the Domain — with
 *    no guard on page count. The old dialog said pages "will also be deleted" but never
 *    said that "Graphic Designing" means 70 of them. It now states the exact number and
 *    requires typing the domain name (see `DeleteDomainDialog`).
 *
 * 4. Two controls did nothing: a `⋯` "More actions" button with no `onClick` (just a
 *    `TODO`), and `w-mx` on the delete modal, which is not a real Tailwind class.
 *
 * Plus 64 hardcoded colour utilities (`bg-gray-50`, `text-blue-800`, …) became semantic
 * tokens, so the table now follows dark mode from #21 instead of staying light.
 *
 * ⚠️ WHY THIS IS STILL A CLIENT COMPONENT. Every row action needs event handlers and
 * dialog state. The DATA still arrives as props from the Server Component page, so no
 * database query crosses the boundary — the same split as `NewDomainDialog`.
 *
 * `DomainForm` is deliberately untouched; rebuilding it is G-3c.
 */

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  columnPosition: number;
};

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  /** Lifecycle state — replaces the old `isPublished` boolean. */
  status: DomainStatus;
  /** Icon id from public/icons/, or null when the emoji in the name is used. */
  icon: string | null;
  orderInCategory: number;
  targetCountries?: string[];
  createdAt: Date;
  category: Category | null;
  pageCount: number;
  previewUrl: string;
};

type DomainsTableProps = {
  domains: Domain[];
  categories: Category[];
};

export function DomainsTable({ domains, categories }: DomainsTableProps) {
  const router = useRouter();

  /**
   * Which domain each dialog is open for, held as an id rather than the object itself.
   *
   * Storing the id and looking the object up on render means that after `router.refresh()`
   * re-runs the server query, an open dialog shows the FRESH row. If we stored a copy of
   * the object, it would display stale values (e.g. the old publish state) until closed.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * The id of the domain whose publish request is in flight, or `null`.
   *
   * Scoped to a single id rather than a plain `isLoading` boolean so only the row you
   * clicked shows a spinner — a shared boolean would grey out all 35 rows at once.
   */
  const [publishingId, setPublishingId] = useState<string | null>(null);

  /**
   * Failure message shown in a banner above the table.
   *
   * Replaces `alert('Failed to delete domain. Please try again.')` — a blocking browser
   * dialog that cannot be styled, cannot be themed, and says nothing about WHY. This shows
   * the server's actual message and lets you keep working. (Part of #22.6's alert() sweep.)
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const domainToEdit = editingId ? domains.find((d) => d.id === editingId) : null;
  const domainToDelete = deletingId ? domains.find((d) => d.id === deletingId) : null;

  /**
   * Move a domain to a named status.
   *
   * ⚠️ WAS A TOGGLE, AND A TOGGLE CANNOT EXPRESS THREE STATES.
   *
   * This sent `{ isPublished: !domain.isPublished }` — "whatever it is now, make it the other
   * thing". With DRAFT / PUBLISHED / UPCOMING there is no "other thing": the opposite of
   * published is ambiguous, and there is no sequence of flips that reaches UPCOMING at all.
   *
   * It now takes the target status explicitly, and the row menu offers the two states the
   * domain is not currently in.
   */
  async function handleStatusChange(domain: Domain, status: DomainStatus) {
    setPublishingId(domain.id);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/domains/${domain.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      // `fetch` only rejects on network failure — a 404 or 500 still resolves with
      // `ok === false`. Without this check a server error would look like success.
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed (${response.status})`);
      }

      /**
       * ⚠️ `router.refresh()` INSTEAD OF `window.location.reload()`.
       *
       * The old code did a full page reload: the browser threw away the document, re-ran
       * the whole JS bundle, and re-rendered from scratch — several hundred milliseconds
       * and a visible white flash for a change to one cell.
       *
       * `router.refresh()` re-runs only the Server Components for the current route and
       * patches the new HTML in. React state elsewhere on the page survives (your search
       * box keeps its text, the tips section stays open, scroll position holds).
       *
       * This is #22.6 landing early for this one file — six other `window.location.reload()`
       * calls remain elsewhere in the admin.
       */
      router.refresh();
    } catch (error) {
      // Narrowed rather than assumed: a thrown value in JS can be anything, not just Error.
      setErrorMessage(
        error instanceof Error
          ? `Could not update "${domain.name}": ${error.message}`
          : `Could not update "${domain.name}".`
      );
    } finally {
      // `finally` so the spinner clears on the error path too. In a `try`-only version a
      // failed request would leave the row spinning forever — bug #1's exact failure mode.
      setPublishingId(null);
    }
  }

  /**
   * Delete a domain and everything under it.
   *
   * Returns the error message on failure instead of setting state, so `DeleteDomainDialog`
   * can show it INSIDE the dialog (next to the button you just pressed) and keep the
   * dialog open. The old version popped an `alert()` and left a dead modal behind it.
   */
  async function handleDelete(domain: Domain): Promise<string | null> {
    try {
      const response = await fetch(`/api/admin/domains/${domain.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        return body?.message ?? `Request failed (${response.status})`;
      }

      setDeletingId(null);
      router.refresh();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Network error.';
    }
  }

  return (
    <>
      {errorMessage && (
        // `mx-4` / `mb-4` because the table draws edge-to-edge inside its card; without the
        // inset the banner would touch the card border.
        <Alert variant="destructive" className="mx-4 mb-4">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/*
        `Table` supplies its own `relative w-full overflow-x-auto` wrapper, so the six
        columns scroll INSIDE the card on a narrow window instead of widening the page.
        That is the other half of the `min-w-0` fix in AdminLayout — this owns the overflow
        so the document does not.
      */}
      <Table>
        <TableHeader>
          {/*
            The old header hardcoded `bg-gray-50` plus six copies of
            `text-xs font-medium text-gray-500 uppercase tracking-wider`. `TableHead`
            carries the typography itself, and `bg-muted/50` derives the tint from the
            theme, so it darkens correctly instead of staying pale grey.
          */}
          <TableRow className="bg-muted/50">
            <TableHead>Domain</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            {/* Numbers read better right-aligned — the digits line up column-wise. */}
            <TableHead className="text-right">Pages</TableHead>
            {/* `w-0` collapses the column to its content; the menu button needs no more. */}
            <TableHead className="w-0 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {domains.length > 0 ? (
            domains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                isPublishing={publishingId === domain.id}
                onEdit={() => setEditingId(domain.id)}
                onDelete={() => setDeletingId(domain.id)}
                onStatusChange={(status) => handleStatusChange(domain, status)}
              />
            ))
          ) : (
            <TableRow>
              {/*
                `colSpan={6}` must match the header count — if a column is ever added and
                this is not updated, the empty state stops spanning the full width.
              */}
              <TableCell colSpan={6} className="h-48 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Globe className="text-muted-foreground size-8" aria-hidden="true" />
                  <p className="font-medium">No domains found</p>
                  <p className="text-muted-foreground text-sm">
                    Create your first domain, or clear the filters above.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/*
        EDIT — a real `Dialog` replacing a hand-rolled `fixed inset-0` overlay.

        What the hand-rolled one lacked, and Radix gives for free: Escape to close, focus
        trapped inside so Tab cannot wander into the page behind, focus returned to the
        trigger on close, `aria-modal` + labelling for screen readers, and scroll lock on
        the body. It also fixes bug #2 — its overlay is `bg-black/50`, not the dead
        `bg-opacity-50`.

        `open` is derived from `editingId`, so there is one source of truth for "is the edit
        dialog open". `onOpenChange` fires for Escape and backdrop clicks as well as the
        close button, which is why we clear the id there rather than on a single handler.
      */}
      <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit domain</DialogTitle>
            <DialogDescription>
              {/* Naming the domain confirms which row you opened. */}
              Update settings for {domainToEdit ? `"${domainToEdit.name}"` : 'this domain'}.
            </DialogDescription>
          </DialogHeader>

          {/*
            Rendered only when the lookup succeeded. `DomainForm` initialises its fields
            from this prop, so mounting it with a placeholder and filling in later would
            leave the inputs empty.
          */}
          {domainToEdit && (
            <DomainForm
              categories={categories}
              domain={{
                id: domainToEdit.id,
                name: domainToEdit.name,
                slug: domainToEdit.slug,
                pageType: domainToEdit.pageType,
                categoryId: domainToEdit.category?.id || '',
                orderInCategory: domainToEdit.orderInCategory,
                status: domainToEdit.status,
                /*
                  ⚠️ THE THIRD TIME AN EXPLICIT FIELD LIST HAS SILENTLY DROPPED A NEW COLUMN.

                  This object is rebuilt field by field rather than spread, so a column the
                  literal does not name simply never reaches the form — no error, no warning.
                  The icon saved correctly, rendered correctly in the row, and was present in
                  the database; it was only missing when you REOPENED the edit dialog, which is
                  the one place that looks like "it did not save".

                  Previous two: `buildPageHierarchy` dropped `status` in I-1, and would have
                  dropped `icon` in J-2 had it not been added deliberately.

                  ⚠️ `PagesManager` does not have this problem because it passes the whole page
                  object (`editingPage={editingPage}`). Spreading, or passing the object, is the
                  shape that cannot rot.
                */
                icon: domainToEdit.icon,
                // `['ALL']` is the "visible everywhere" default — see the country
                // targeting in #8. A domain with no explicit list must not become invisible.
                targetCountries: domainToEdit.targetCountries || ['ALL'],
                /*
                  Passed purely so the form's slug-change warning can state how many pages
                  would move if the slug is edited (G-3c). We already have the count here —
                  the table renders it in the Pages column — so this costs nothing.
                */
                pageCount: domainToEdit.pageCount,
              }}
              onSuccess={() => {
                setEditingId(null);
                router.refresh();
              }}
              onCancel={() => setEditingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/*
        DELETE — see `DeleteDomainDialog`. Keyed by id so the typed confirmation text is
        thrown away between domains: without the key, React would reuse the component
        instance and you could carry a satisfied confirmation from one domain to the next.
      */}
      {domainToDelete && (
        <DeleteDomainDialog
          key={domainToDelete.id}
          domain={domainToDelete}
          onConfirm={() => handleDelete(domainToDelete)}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </>
  );
}

/**
 * One table row.
 */
type DomainRowProps = {
  domain: Domain;
  isPublishing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: DomainStatus) => void;
};

function DomainRow({ domain, isPublishing, onEdit, onDelete, onStatusChange }: DomainRowProps) {
  // Resolved from the generated manifest; null when unset OR when the SVG has been deleted
  // from public/icons/ while rows still reference it.
  const domainIcon = getIcon(domain.icon);

  const isHierarchical = domain.pageType !== 'direct';

  return (
    <TableRow>
      {/* ── Domain name, slug and a link to the live page ── */}
      <TableCell>
        <div className="flex items-center gap-3">
          {/*
            The glyph tile. The old version tried to derive an icon by regex-matching the
            first non-word character out of the domain NAME
            (`domain.name.match(/[^\w\s]/)`) — so a domain called "C++ Tutorials" showed a
            "+". It now uses the category's own icon, which is a real field an admin sets,
            and falls back to a neutral globe.

            `shrink-0` stops the tile being squashed when the name is long: it is a flex
            item, and flex items shrink by default.
          */}
          <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
            {domain.category?.icon ? (
              <span className="text-base" aria-hidden="true">
                {domain.category.icon}
              </span>
            ) : (
              <Globe className="text-muted-foreground size-4" aria-hidden="true" />
            )}
          </div>

          {/*
            `min-w-0` again — the same flexbox rule behind the page-level scrollbar fix.
            Without it this column will not shrink below the full width of the longest
            domain name, so `truncate` below can never take effect.
          */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {/*
                The chosen icon, shown so it is obvious at a glance which rows have one — and,
                more usefully, so a row carrying BOTH an icon and an emoji in its name is
                visible here rather than only on the public page (§27.6).
              */}
              {domainIcon && (
                <img
                  src={domainIcon.url}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 shrink-0"
                />
              )}
              <span className="truncate font-medium">{domain.name}</span>
              {/*
                "View live" was a 🔗 emoji styled `text-blue-600`. Now a real icon link.
                `target="_blank"` because you are checking the public page while staying in
                the admin — matching the sidebar's "View site" from G-1.
              */}
              <Link
                href={domain.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                // A visually-hidden label, because an icon-only link announces nothing
                // useful to a screen reader.
                aria-label={`Open ${domain.name} in a new tab`}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            {/* The public path. `font-mono` because it is a URL, not prose. */}
            <p className="text-muted-foreground truncate font-mono text-xs">
              /domain/{domain.slug}
            </p>
          </div>
        </div>
      </TableCell>

      {/* ── Category ── */}
      <TableCell>
        {domain.category ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">{domain.category.name}</span>
            {/*
              Which of the three homepage columns this category sits in. Kept because it
              explains the table's own sort order (the page orders by `columnPosition`
              first), but demoted to muted text since it is reference detail, not identity.
            */}
            <span className="text-muted-foreground text-xs">
              Col {domain.category.columnPosition}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm italic">No category</span>
        )}
      </TableCell>

      {/* ── Page type ── */}
      <TableCell>
        {/*
          Was a hand-rolled pill: `inline-flex items-center px-2 py-1 rounded-full text-xs
          font-medium` plus a `bg-blue-100 text-blue-800` / `bg-purple-100 text-purple-800`
          ternary — light-mode-only, and pale-on-pale in dark mode.

          `variant="outline"` reads as a neutral classification (this is a fact about the
          domain, not a warning), and the icon distinguishes the two types at a glance
          without relying on colour alone — which matters for colour-blind users.
        */}
        <Badge variant="outline" className="gap-1 font-normal">
          {isHierarchical ? (
            <Network className="size-3" aria-hidden="true" />
          ) : (
            <Target className="size-3" aria-hidden="true" />
          )}
          {isHierarchical ? 'Hierarchical' : 'Direct'}
        </Badge>
      </TableCell>

      {/* ── Publication status ── */}
      <TableCell>
        {/*
          Three states now, so the two-way ternary became a lookup.

          `default` (solid) for Live, since "is this public yet" is the state you scan for.
          `outline` for Upcoming — publicly visible, but not the same kind of live as a real
          page — and `secondary` (muted) for Draft. The three are distinguishable by weight
          and border, not only by colour, so the distinction survives in both themes.
        */}
        <Badge variant={STATUS_BADGE_VARIANT[domain.status]} className="font-normal">
          {DOMAIN_STATUS_LABELS[domain.status]}
        </Badge>
      </TableCell>

      {/* ── Page count ── */}
      <TableCell className="text-right">
        <span className="font-medium">{domain.pageCount}</span>
        {/*
          Singular/plural, so a domain with one page does not read "1 pages".
          `hidden sm:inline` drops the word on narrow screens where the number is enough.
        */}
        <span className="text-muted-foreground ml-1 hidden text-xs sm:inline">
          page{domain.pageCount === 1 ? '' : 's'}
        </span>
      </TableCell>

      {/* ── Actions ── */}
      <TableCell className="text-right">
        {/*
          FOUR ICON BUTTONS BECAME ONE MENU.

          The old row carried ✏️ / 🚀 / 🗑️ / ⋯ side by side — four emoji targets about 24px
          wide, unlabelled, with a destructive delete sitting two pixels from edit. Emoji
          also render differently per platform and cannot inherit a theme colour.

          A single trigger opening a labelled menu means each action has a NAME, delete is
          separated and marked destructive, and the fourth (dead) button is gone. It also
          reclaims the horizontal space that was contributing to the page overflow.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              // The menu is the only way to reach these actions, so the trigger must be
              // announced. Without a label it reads as just "button".
              aria-label={`Actions for ${domain.name}`}
            >
              {/*
                While a publish request is in flight, the trigger itself becomes the
                spinner. That puts the feedback exactly where the click happened, and is
                what the old code only pretended to do (its hourglass never cleared).
                `animate-spin` is a Tailwind built-in, no custom keyframes needed.
              */}
              {isPublishing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <MoreHorizontal className="size-4" aria-hidden="true" />
              )}
            </Button>
          </DropdownMenuTrigger>

          {/*
            `align="end"` so the menu's right edge lines up with the trigger and it opens
            leftwards — anchored at the left it would hang off the table's right edge and
            trigger the horizontal scroll we just fixed.
          */}
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit domain
            </DropdownMenuItem>

            {/*
              `asChild` makes the Link the menu item, so this is a real anchor —
              middle-click and "open in new tab" work, which a `router.push` in an onClick
              would silently break.
            */}
            <DropdownMenuItem asChild>
              <Link href={domain.previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                View live page
              </Link>
            </DropdownMenuItem>

            {/*
              ⚠️ ONE ITEM BECAME A SHORT LIST — the two statuses this domain is NOT in.

              A single "Publish / Unpublish" item worked when there were two states and one
              was always the opposite of the other. With three, the menu names each
              destination outright, so "Set to Upcoming" is reachable and nothing depends on
              guessing what the opposite of the current state is.

              Filtering out the current status means the menu never offers a no-op.
            */}
            {DOMAIN_STATUSES.filter((status) => status !== domain.status).map((status) => {
              const Icon = STATUS_ICON[status];
              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(status)}
                  disabled={isPublishing}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  Set to {DOMAIN_STATUS_LABELS[status]}
                </DropdownMenuItem>
              );
            })}

            {/* A visual break so Delete is never the item you hit by momentum. */}
            <DropdownMenuSeparator />

            {/*
              `variant="destructive"` is shadcn's own red-on-hover treatment for the item,
              rather than a hardcoded `text-red-600` — so it stays legible in dark mode.
            */}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
              Delete domain
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/**
 * Delete confirmation, with a guard proportional to the damage.
 * ============================================================================
 *
 * ⚠️ WHY THIS IS NOT JUST AN "ARE YOU SURE".
 * `DELETE /api/admin/domains/[id]` runs a transaction that deletes every ContentBlock,
 * then every Page, then the Domain. It does not refuse when pages exist. So deleting
 * "Graphic Designing" destroys 70 pages of content, and there is no undo — no soft delete,
 * no trash, no revision history anywhere in this app.
 *
 * The old dialog was a red button one click away from that, with prose that never named a
 * number. So:
 *   • an EMPTY domain gets a plain confirm — nothing is lost, do not add friction;
 *   • a domain WITH pages states the exact count and requires typing its SLUG.
 *
 * Type-to-confirm is the standard pattern for this (GitHub repo deletion, Stripe, AWS)
 * because it defeats the actual failure mode: muscle memory. You cannot type an identifier
 * by reflex, and doing so forces you to read which domain you are on.
 *
 * ⚠️ WHY THE SLUG AND NOT THE NAME. 34 of the 35 domains in this database have names that
 * START WITH AN EMOJI — "🖌️ Graphic Designing", "🍄 Social Media Marketing". You cannot
 * type those on a keyboard, and 🖌️ is two code points (U+1F58C U+FE0F), so even
 * copy-pasting is fragile: a paste that drops the variation selector compares unequal and
 * the button stays dead with no explanation. The slug ("gdesign") is plain ASCII, short,
 * already visible in the row, and is the stable identifier the public URL is built from.
 *
 * `AlertDialog` rather than `Dialog` on purpose — it does not close on a click outside or
 * on Escape-by-accident the way a plain dialog does, and it starts with focus on Cancel.
 */
type DeleteDomainDialogProps = {
  domain: Domain;
  /** Resolves to an error message, or `null` on success. */
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
};

function DeleteDomainDialog({ domain, onConfirm, onCancel }: DeleteDomainDialogProps) {
  const [typedSlug, setTypedSlug] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPages = domain.pageCount > 0;

  /**
   * `.trim()` so a stray space from a paste does not block a correct slug.
   *
   * Case-INSENSITIVE via `toLowerCase()`, unlike a name comparison would be: slugs are
   * lowercase by construction (they are URL segments), so an admin who types "GDESIGN"
   * has demonstrated exactly the same intent. Being strict there would only produce a
   * dead button with no visible reason.
   */
  const slugMatches = typedSlug.trim().toLowerCase() === domain.slug.toLowerCase();
  const canDelete = (!hasPages || slugMatches) && !isDeleting;

  async function handleConfirm() {
    setIsDeleting(true);
    setError(null);

    const failure = await onConfirm();

    if (failure) {
      // Stay open and show why. The old code fired an `alert()` and left the modal
      // sitting there, so it looked like the delete had gone through.
      setError(failure);
      setIsDeleting(false);
    }
    // On success the parent clears `deletingId`, which unmounts this component — so there
    // is deliberately no `setIsDeleting(false)` here. Calling it would be a state update
    // on an unmounted component.
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{domain.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasPages ? (
              <>
                This will permanently delete this domain and{' '}
                {/*
                  The count in bold, in the sentence. This is the fact the old dialog
                  omitted, and the reason the extra step below exists.
                */}
                <strong className="text-foreground">
                  all {domain.pageCount} of its page{domain.pageCount === 1 ? '' : 's'}
                </strong>
                , including their content. This cannot be undone.
              </>
            ) : (
              <>
                This will permanently delete this domain. It has no pages, so no content
                will be lost. This cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasPages && (
          <div className="space-y-2">
            <Label htmlFor="confirm-domain-slug" className="text-sm font-normal">
              Type the domain's slug{' '}
              {/*
                `select-all` makes one click highlight the whole slug. A convenience, not a
                bypass — you still have to paste it deliberately into the field below.
                `font-mono` because it is an identifier, and it makes an "l" vs "1" visible.
              */}
              <span className="text-foreground bg-muted rounded px-1 font-mono font-medium select-all">
                {domain.slug}
              </span>{' '}
              to confirm.
            </Label>
            <Input
              id="confirm-domain-slug"
              value={typedSlug}
              onChange={(event) => setTypedSlug(event.target.value)}
              // Browsers autofill, autocapitalise and spell-correct text inputs by default.
              // The first would fill in an unrelated saved value, and the second would send
              // "Gdesign" — harmless here only because the match is case-insensitive.
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={domain.slug}
              disabled={isDeleting}
            />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          {/*
            ⚠️ `event.preventDefault()` IS LOAD-BEARING HERE.

            `AlertDialogAction` renders Radix's `Action` primitive, which closes the dialog
            as soon as it is clicked. That is the right default for a synchronous confirm,
            but our delete is a network request that can FAIL — and if the dialog has
            already vanished, the error has nowhere to appear and it looks like the delete
            succeeded.

            Radix composes handlers with `composeEventHandlers(props.onClick, close)`, which
            skips its own `close` when `event.defaultPrevented` is true. So calling
            `preventDefault()` keeps the dialog open and hands control of closing to us:
            `handleConfirm` closes it (via the parent clearing `deletingId`) only on success.
          */}
          <AlertDialogAction
            variant="destructive"
            disabled={!canDelete}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isDeleting ? 'Deleting…' : 'Delete domain'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
