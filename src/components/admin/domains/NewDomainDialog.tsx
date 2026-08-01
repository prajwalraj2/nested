'use client';

import { useState } from 'react';
// App Router's `useRouter` (`next/navigation`, not `next/router`) — we only need
// `.refresh()`, to re-run this page's server query after a domain is created.
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DomainForm } from './DomainForm';

/**
 * "New domain" behind a dialog (Phase G-3a).
 * ============================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * `DomainForm` used to sit permanently expanded at the top of `/admin/domains`, taking most
 * of the first screen before the list of 35 domains was reachable. That inverts how the
 * page is actually used: creating a domain is occasional, **looking at** domains is
 * constant. The form now opens on demand and the list starts at the top.
 *
 * ⚠️ A THIN CLIENT WRAPPER, ON PURPOSE. `Dialog` needs open/closed state, so it must be a
 * client component — but `/admin/domains/page.tsx` is a Server Component that queries the
 * database. Putting `'use client'` on the page would pull those queries client-side.
 * Isolating the interactive shell here keeps the page on the server, the same boundary
 * discipline as `ThemeProvider` (#21) and `AdminLayout` (G-1).
 *
 * `DomainForm` itself is untouched — this only changes where it appears. Rebuilding the
 * form is G-3c.
 */
/**
 * Mirrors `DomainForm`'s own `Category` type — `icon` is nullable and `columnPosition` is
 * required, both of which a hand-written guess got wrong and `tsc` caught.
 *
 * Declared here rather than imported because `DomainForm` does not export it. Exporting it
 * would be tidier and is worth doing when the form itself is rebuilt in G-3c; duplicating
 * a five-field shape is the smaller evil versus editing a 500-line file this step is not
 * touching.
 */
type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  columnPosition: number;
};

type NewDomainDialogProps = {
  /** Passed straight through to the form for its category picker. */
  categories: Category[];
};

export function NewDomainDialog({ categories }: NewDomainDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          New domain
        </Button>
      </DialogTrigger>
      {/*
        `max-h` + `overflow-y-auto` because the form is long (it has name, slug, category,
        page type, description and publish state). Without it the submit button falls below
        the fold on a laptop and the dialog cannot be scrolled to reach it.

        `sm:max-w-2xl` — the default dialog is ~425px, too narrow for this form's paired
        fields.
      */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a new domain</DialogTitle>
          <DialogDescription>
            Add a content domain, assign it a category, and choose how its pages are
            structured.
          </DialogDescription>
        </DialogHeader>
        {/*
          ⚠️ UPDATED IN G-3b — this used to pass no callbacks at all.
          ==========================================================================
          `DomainForm` branches on whether `onSuccess` was supplied: with no callback it
          falls back to `window.location.reload()`, which threw the whole document away
          (and with it this dialog) after every create.

          Now that we hand it callbacks, that fallback no longer runs — so closing the
          dialog and refreshing the list become OUR responsibility. Omitting `setOpen(false)`
          would leave the form sitting open on top of a list that had already updated behind
          it, which reads as "nothing happened".

          `router.refresh()` re-runs the page's Server Component so the new domain appears,
          without the full reload's white flash. Same reasoning as `DomainsTable`.
        */}
        <DomainForm
          categories={categories}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
