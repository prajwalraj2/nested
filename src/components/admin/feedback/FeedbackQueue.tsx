// src/components/admin/feedback/FeedbackQueue.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  feedbackCategoryLabel,
  type FeedbackStatus,
} from '@/lib/feedback-categories';

/**
 * The feedback review queue (M-5).
 * ============================================================================
 *
 * ⚠️ EVERY VALUE RENDERED HERE WAS TYPED BY A STRANGER. This is the screen the whole of M-4 exists
 * to protect, and the rule is one line: it renders as TEXT, never as HTML.
 *
 * WHY IT MATTERS ON THIS SCREEN SPECIFICALLY. Someone submits `<script>` as their message. It sits
 * inertly in Postgres — nothing publishes it, no visitor ever sees it. Then an admin opens this
 * page. If the message were passed to `dangerouslySetInnerHTML`, that script would execute in a
 * LOGGED-IN ADMIN SESSION on the SAME ORIGIN as the admin API: able to create a user, delete
 * pages, or read the database through our own endpoints. Stored XSS needs exactly ONE submission,
 * so rate limiting does nothing about it.
 *
 * ⚠️ Putting `{value}` in JSX is already safe — React escapes it. The danger is not this code as
 * written; it is the day someone wants "just a bit of formatting" in the message. `eslint.config.mjs`
 * bans `dangerouslySetInnerHTML` in this directory so that day produces a build error rather than a
 * plausible-looking commit.
 *
 * ⚠️ `mailto:` IS THE ONE PLACE A SUBMITTED VALUE REACHES AN ATTRIBUTE. It is safe because it is
 * `mailto:` and not `href={value}` — an arbitrary submitted URL there would allow `javascript:`.
 */

type FeedbackRow = {
  id: string;
  category: string;
  message: string;
  name: string | null;
  email: string | null;
  pageUrl: string | null;
  status: string;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  done: 'Done',
};

export default function FeedbackQueue() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<'all' | FeedbackStatus>('new');
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
    ⚠️ THE WHOLE ROW IS HELD, NOT JUST ITS ID. The confirmation quotes the message being deleted,
    and looking it back up out of `items` inside the dialog would break at exactly the wrong
    moment: `load()` can replace the array while the dialog is open, and the lookup would then
    find nothing and render a confirmation for a blank report.
  */
  const [pendingDelete, setPendingDelete] = useState<FeedbackRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/feedback?status=${status}&category=${category}`);
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      setItems(data.items ?? []);
      setCounts(data.counts ?? {});
    } catch {
      setError('Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }, [status, category]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRowStatus(id: string, next: FeedbackStatus) {
    /*
      ⚠️ OPTIMISTIC, THEN RECONCILED. The row moves immediately so the queue feels responsive, and
      `load()` afterwards refreshes the per-status counts — which cannot be derived locally, since
      they describe every row rather than the filtered page on screen.
    */
    setItems((current) => current.map((row) => (row.id === id ? { ...row, status: next } : row)));

    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error('request failed');
      void load();
    } catch {
      setError('That change did not save. Reloading.');
      void load();
    }
  }

  async function deleteRow(id: string) {
    /*
      ⚠️ REMOVED FROM THE LIST FIRST, then reconciled by `load()` — which also refreshes the
      per-status counts in the tabs. Those counts describe every row in the table, so they cannot
      be recomputed locally from the filtered page on screen.
    */
    setItems((current) => current.filter((row) => row.id !== id));
    setPendingDelete(null);

    try {
      const response = await fetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('request failed');
      void load();
    } catch {
      setError('That report was not deleted. Reloading.');
      void load();
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...FEEDBACK_STATUSES] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'default' : 'outline'}
            onClick={() => setStatus(value)}
          >
            {value === 'all' ? 'All' : STATUS_LABEL[value]}
            {counts[value] != null && (
              <span className="ml-1.5 text-xs opacity-70">{counts[value]}</span>
            )}
          </Button>
        ))}

        {/* shadcn `Select`, matching every other filter in the admin. */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="ml-auto w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {FEEDBACK_CATEGORIES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          Nothing here. {status !== 'all' && 'Try a different status.'}
        </div>
      )}

      {/* ── The queue ────────────────────────────────────────────────────── */}
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id} className="border-border bg-card rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-muted rounded px-2 py-0.5 font-medium">
                {feedbackCategoryLabel(row.category)}
              </span>
              <span className="text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </span>
              <span className="text-muted-foreground ml-auto">{STATUS_LABEL[row.status] ?? row.status}</span>
            </div>

            {/*
              ⚠️ `whitespace-pre-wrap` SO LINE BREAKS SURVIVE. Someone reporting a bug in numbered
              steps writes newlines; without this they collapse into one paragraph and the report
              becomes markedly harder to act on. It preserves the breaks WITHOUT interpreting any
              markup, which is exactly the trade this screen wants.

              ⚠️ `break-words` because a submitted value can be one 4,000-character string with no
              spaces, which would otherwise stretch the card past the viewport.
            */}
            <p className="mt-3 text-sm break-words whitespace-pre-wrap">{row.message}</p>

            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {row.name && <span>{row.name}</span>}
              {row.email && (
                /*
                  ⚠️ `mailto:` WITH THE VALUE ONLY IN THE PATH — never `href={row.email}`. A
                  submitted string placed directly in `href` could be `javascript:…`, which is a
                  click away from the same stored-XSS outcome this whole screen guards against.
                */
                <a href={`mailto:${encodeURIComponent(row.email)}`} className="hover:text-foreground underline">
                  {row.email}
                </a>
              )}
              {row.pageUrl && <span className="truncate">on {row.pageUrl}</span>}
            </div>

            <div className="mt-3 flex gap-2">
              {FEEDBACK_STATUSES.filter((value) => value !== row.status).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  onClick={() => setRowStatus(row.id, value)}
                >
                  Mark {STATUS_LABEL[value].toLowerCase()}
                </Button>
              ))}

              {/*
                ⚠️ PUSHED TO THE FAR RIGHT AND STYLED AS DESTRUCTIVE, away from the workflow
                buttons. "Mark done" and "Delete" sitting side by side in matching outlines is how
                a report gets destroyed by someone meaning to clear it — and unlike a status
                change, this one cannot be undone.
              */}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => setPendingDelete(row)}
                aria-label="Delete this report"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/*
        ⚠️ A CONFIRMATION, BECAUSE THE DELETE IS A HARD ONE. There is no `deletedAt` column and no
        recovery — see the note on `DELETE` in `api/admin/feedback/[id]/route.ts` for why a soft
        delete would defeat the purpose.

        ⚠️ THE MESSAGE IS QUOTED BACK, TRUNCATED. "Delete this report?" gives nothing to check
        against when several look alike in the queue. It renders as `{...}` text like everything
        else on this screen — a confirmation dialog is not an exception to the rule this whole
        directory is linted for.
      */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>This cannot be undone. The report is removed from the database entirely.</p>
                {pendingDelete && (
                  <p className="border-border bg-muted text-foreground mt-3 rounded border p-2 text-xs break-words whitespace-pre-wrap">
                    {pendingDelete.message.slice(0, 300)}
                    {pendingDelete.message.length > 300 && '…'}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => pendingDelete && deleteRow(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
