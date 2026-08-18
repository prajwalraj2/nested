// src/components/admin/submissions/SubmissionsQueue.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  SUBMISSION_KINDS,
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABEL,
  isSafeHttpUrl,
  submissionKindLabel,
  type SubmissionStatus,
} from '@/lib/submission-kinds';

/**
 * The submissions review queue (M-6).
 * ============================================================================
 *
 * ⚠️ EVERY FIELD EXCEPT `adminNote` WAS TYPED BY A STRANGER. Same rule as the feedback queue: it
 * renders as TEXT, never as HTML, and `eslint.config.mjs` bans `dangerouslySetInnerHTML` across
 * this directory so that stays true.
 *
 * ⚠️ THIS SCREEN HAS A DANGER THE FEEDBACK QUEUE DID NOT: A SUBMITTED URL THAT WANTS TO BE A LINK.
 *
 * `dangerouslySetInnerHTML` is not the only route to stored XSS. `href={submittedValue}` accepts
 * `javascript:alert(1)`, and one click in a logged-in admin session runs it on the admin's own
 * origin — reaching the same outcome without tripping the lint rule at all.
 *
 * Two guards, both deliberate:
 *   1. `api/submit/route.ts` rejects any scheme but http/https on the way in.
 *   2. `isSafeHttpUrl` is checked AGAIN here, immediately before the anchor is rendered.
 *
 * The second is not redundant. It is the check nearest the danger, and it also covers rows that
 * predate the first — which on a table anyone can write to is not a theoretical set.
 */

type SubmissionRow = {
  id: string;
  kind: string;
  domainName: string | null;
  productName: string;
  productUrl: string | null;
  description: string;
  submitterName: string;
  submitterEmail: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

export default function SubmissionsQueue() {
  const [items, setItems] = useState<SubmissionRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<'all' | SubmissionStatus>('new');
  const [kind, setKind] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SubmissionRow | null>(null);

  /*
    ⚠️ NOTE DRAFTS ARE HELD PER ROW, KEYED BY ID, rather than one "currently editing" value. Two
    notes can be part-written at once, and `load()` replacing `items` must not wipe what has been
    typed but not saved.
  */
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/submissions?status=${status}&kind=${kind}`);
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      setItems(data.items ?? []);
      setCounts(data.counts ?? {});
    } catch {
      setError('Could not load submissions.');
    } finally {
      setLoading(false);
    }
  }, [status, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchRow(id: string, body: Record<string, unknown>, optimistic?: Partial<SubmissionRow>) {
    if (optimistic) {
      setItems((current) => current.map((row) => (row.id === id ? { ...row, ...optimistic } : row)));
    }
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('request failed');
      void load();
    } catch {
      setError('That change did not save. Reloading.');
      void load();
    }
  }

  async function deleteRow(id: string) {
    setItems((current) => current.filter((row) => row.id !== id));
    setPendingDelete(null);
    try {
      const response = await fetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('request failed');
      void load();
    } catch {
      setError('That submission was not deleted. Reloading.');
      void load();
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...SUBMISSION_STATUSES] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'default' : 'outline'}
            onClick={() => setStatus(value)}
          >
            {value === 'all' ? 'All' : SUBMISSION_STATUS_LABEL[value]}
            {counts[value] != null && (
              <span className="ml-1.5 text-xs opacity-70">{counts[value]}</span>
            )}
          </Button>
        ))}

        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="ml-auto w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {SUBMISSION_KINDS.map((option) => (
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
                {submissionKindLabel(row.kind)}
              </span>
              {/*
                ⚠️ THE SNAPSHOTTED NAME, NOT A LOOKUP. This is why `domainName` is stored beside
                `domainId` — the row stays readable after the domain it names is deleted, where a
                join would show a blank or drop the submission entirely.
              */}
              {row.domainName && <span className="text-muted-foreground">in {row.domainName}</span>}
              <span className="text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </span>
              <span className="text-muted-foreground ml-auto">
                {SUBMISSION_STATUS_LABEL[row.status] ?? row.status}
              </span>
            </div>

            <p className="mt-3 text-sm font-medium break-words">{row.productName}</p>

            {/*
              ⚠️ THE URL IS RE-CHECKED HERE, IMMEDIATELY BEFORE IT BECOMES AN `href`. See the file
              header. A value that fails renders as PLAIN TEXT instead of vanishing — hiding it
              would conceal the very thing worth seeing when reviewing a hostile submission.
            */}
            {row.productUrl &&
              (isSafeHttpUrl(row.productUrl) ? (
                <a
                  href={row.productUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs break-all underline"
                >
                  {row.productUrl}
                  <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                </a>
              ) : (
                <p className="text-destructive mt-1 text-xs break-all">
                  ⚠️ unsafe link, not clickable: {row.productUrl}
                </p>
              ))}

            <p className="mt-2 text-sm break-words whitespace-pre-wrap">{row.description}</p>

            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>{row.submitterName}</span>
              {/* `mailto:` with the value confined to the path — never `href={row.submitterEmail}`. */}
              <a
                href={`mailto:${encodeURIComponent(row.submitterEmail)}`}
                className="hover:text-foreground underline"
              >
                {row.submitterEmail}
              </a>
            </div>

            {/*
              The admin's own note. Saved on blur rather than behind a button — a note nobody
              remembers to save is a note that does not exist.
            */}
            <Textarea
              rows={2}
              className="mt-3 text-sm"
              placeholder="Note to self (optional) — why accepted, why rejected, what to check"
              value={noteDrafts[row.id] ?? row.adminNote ?? ''}
              onChange={(event) =>
                setNoteDrafts((current) => ({ ...current, [row.id]: event.target.value }))
              }
              onBlur={() => {
                const draft = noteDrafts[row.id];
                if (draft === undefined || draft === (row.adminNote ?? '')) return;
                // Empty clears the note. `null` rather than `''` so the column is genuinely empty.
                void patchRow(row.id, { adminNote: draft.trim() === '' ? null : draft });
              }}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {SUBMISSION_STATUSES.filter((value) => value !== row.status).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  onClick={() => patchRow(row.id, { status: value }, { status: value })}
                >
                  {SUBMISSION_STATUS_LABEL[value]}
                </Button>
              ))}

              {/* Destructive and pushed away from the workflow buttons — this one cannot be undone. */}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => setPendingDelete(row)}
                aria-label="Delete this submission"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>This cannot be undone. The submission is removed from the database entirely.</p>
                {pendingDelete && (
                  <p className="border-border bg-muted text-foreground mt-3 rounded border p-2 text-xs break-words">
                    {pendingDelete.productName}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
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
