// src/components/admin/changelog/ChangelogEditor.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignBadgeColors, badgeClassFor } from '@/lib/badge-colors';
import {
  CHANGELOG_STATUSES,
  CHANGELOG_TYPES,
  changelogTypeLabel,
  groupByStatus,
  type ChangelogCard,
} from '@/lib/changelog-types';

/**
 * The changelog board's admin (M-7).
 * ============================================================================
 *
 * ⚠️ THIS DIRECTORY IS DELIBERATELY *NOT* COVERED BY THE `dangerouslySetInnerHTML` BAN in
 * `eslint.config.mjs`, unlike `admin/feedback` and `admin/submissions`. That rule exists because
 * STRANGERS write those rows. Changelog entries are written by the admin, so applying it here
 * would be copying the rule past the reason for it. Nothing here needs raw HTML today — but if it
 * ever does, that is a design conversation, not a security one.
 *
 * ⚠️ MOVES ARE SENT AS AN INTENT, NOT AS AN ORDER NUMBER. `/move` recomputes the affected columns
 * server-side; see the long note there for why the arithmetic must not be duplicated here.
 */

const EMPTY = {
  title: '',
  description: '',
  type: CHANGELOG_TYPES[0].value as string,
  status: CHANGELOG_STATUSES[0].value as string,
};

export default function ChangelogEditor() {
  const [cards, setCards] = useState<ChangelogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ChangelogCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChangelogCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/changelog');
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      setCards(data.items ?? []);
    } catch {
      setError('Could not load the changelog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /*
    ⚠️ COMPUTED OVER EVERY CARD, so a type keeps one colour across all four columns — and the SAME
    colour the public board gives it, because both call `assignBadgeColors` on the full set. Colour
    that differs between the admin and the page it manages is worse than no colour at all.
  */
  const badgeColors = assignBadgeColors(cards.map((c) => c.type));
  const columns = groupByStatus(cards);

  async function send(url: string, init: RequestInit, failure: string) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? failure);
      }
      /*
        ⚠️ ALWAYS RELOADED FROM THE SERVER, NEVER PATCHED LOCALLY. A move rewrites the `order` of
        rows this component was not told about, so reproducing the result client-side would mean
        reimplementing `renumber` here — exactly the duplication the move route exists to avoid.
      */
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : failure);
      await load();
      return false;
    }
  }

  async function save() {
    setSaving(true);
    const isEdit = editing !== null;

    const ok = await send(
      isEdit ? `/api/admin/changelog/${editing.id}` : '/api/admin/changelog',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        /*
          ⚠️ `status` IS SENT ONLY WHEN CREATING. The PATCH schema rejects it — a card changes
          column through `/move`, which also gives it a position. See the note in `[id]/route.ts`.
        */
        body: JSON.stringify(
          isEdit
            ? { title: draft.title, description: draft.description, type: draft.type }
            : draft
        ),
      },
      isEdit ? 'Could not save that entry.' : 'Could not create that entry.'
    );

    setSaving(false);
    if (ok) {
      setEditing(null);
      setCreating(false);
      setDraft(EMPTY);
    }
  }

  const dialogOpen = creating || editing !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {cards.length} {cards.length === 1 ? 'entry' : 'entries'}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setDraft(EMPTY);
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          New entry
        </Button>
      </div>

      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CHANGELOG_STATUSES.map((status) => {
          const items = columns[status.value] ?? [];

          return (
            <section key={status.value} className="min-w-0">
              <div className="border-border mb-3 flex items-baseline justify-between border-b pb-2">
                <h2 className="text-sm font-semibold">{status.label}</h2>
                <span className="text-muted-foreground text-xs">{items.length}</span>
              </div>

              {items.length === 0 ? (
                <p className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
                  Empty
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((card, index) => (
                    <li
                      key={card.id}
                      className="border-border bg-card rounded-lg border p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-sm font-medium break-words">
                          {card.title}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 shrink-0"
                              aria-label={`Actions for ${card.title}`}
                            >
                              <MoreVertical className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setCreating(false);
                                setEditing(card);
                                setDraft({
                                  title: card.title,
                                  description: card.description,
                                  type: card.type,
                                  status: card.status,
                                });
                              }}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>

                            {/*
                              ⚠️ DISABLED AT THE ENDS RATHER THAN HIDDEN. A menu whose items move
                              around as you use it is hard to aim at; a greyed row keeps the
                              positions stable and says why nothing happened.
                            */}
                            <DropdownMenuItem
                              disabled={index === 0}
                              onSelect={() =>
                                send(
                                  `/api/admin/changelog/${card.id}/move`,
                                  {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ direction: 'up' }),
                                  },
                                  'Could not move that entry.'
                                )
                              }
                            >
                              <ChevronUp className="size-4" aria-hidden="true" />
                              Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === items.length - 1}
                              onSelect={() =>
                                send(
                                  `/api/admin/changelog/${card.id}/move`,
                                  {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ direction: 'down' }),
                                  },
                                  'Could not move that entry.'
                                )
                              }
                            >
                              <ChevronDown className="size-4" aria-hidden="true" />
                              Move down
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/*
                              ⚠️ "MOVE TO" LISTS EVERY OTHER COLUMN, not just the neighbouring one.
                              The four columns are independent — a card can go straight from
                              "Not started" to "Released" — so offering only left/right would imply
                              a pipeline the model explicitly does not have.
                            */}
                            {CHANGELOG_STATUSES.filter((s) => s.value !== card.status).map((s) => (
                              <DropdownMenuItem
                                key={s.value}
                                onSelect={() =>
                                  send(
                                    `/api/admin/changelog/${card.id}/move`,
                                    {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: s.value }),
                                    },
                                    'Could not move that entry.'
                                  )
                                }
                              >
                                Move to {s.label}
                              </DropdownMenuItem>
                            ))}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setPendingDelete(card)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <span
                        className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClassFor(
                          card.type,
                          badgeColors
                        )}`}
                      >
                        {changelogTypeLabel(card.type)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* ── Create / edit ────────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (next) return;
          setCreating(false);
          setEditing(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit entry' : 'New entry'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cl-title">Title</Label>
              <Input
                id="cl-title"
                value={draft.title}
                maxLength={200}
                onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                placeholder="Shown on the card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cl-description">Description</Label>
              <Textarea
                id="cl-description"
                rows={5}
                value={draft.description}
                maxLength={4000}
                onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
                placeholder="Shown when a visitor opens the card. Plain text; line breaks are kept."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cl-type">Type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => setDraft((d) => ({ ...d, type: value }))}
                >
                  <SelectTrigger id="cl-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGELOG_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/*
                ⚠️ THE COLUMN IS CHOSEN ONLY WHEN CREATING. On an edit it is absent, because moving
                a card is `/move`'s job — it has to assign a position in the destination, and a
                plain status change here would drop the card in with a colliding order.
              */}
              {!editing && (
                <div className="space-y-2">
                  <Label htmlFor="cl-status">Column</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(value) => setDraft((d) => ({ ...d, status: value }))}
                  >
                    <SelectTrigger id="cl-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANGELOG_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {editing && (
              <p className="text-muted-foreground text-xs">
                To change the column, use <strong>Move to…</strong> in the card&rsquo;s menu.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || draft.title.trim() === '' || draft.description.trim() === ''}
            >
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" will be removed from the public board and cannot be recovered.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (!pendingDelete) return;
                const { id } = pendingDelete;
                setPendingDelete(null);
                void send(
                  `/api/admin/changelog/${id}`,
                  { method: 'DELETE' },
                  'Could not delete that entry.'
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
