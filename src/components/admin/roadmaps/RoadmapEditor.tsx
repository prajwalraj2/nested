// src/components/admin/roadmaps/RoadmapEditor.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoadmapTree } from './RoadmapTree';
import { RoadmapNodeForm } from './RoadmapNodeForm';
import { allIds, findNode, type EditorNode, type MoveDirection, type RoadmapMeta, type RoadmapPageMeta } from './types';
import { resolveRoadmapSettings } from '@/lib/roadmap-settings';

/**
 * The roadmap tree editor (L-4).
 * ============================================================================
 *
 * Two panes: the topic tree on the left, the selected topic on the right.
 *
 * ⚠️ EVERY MUTATION RE-FETCHES THE WHOLE TREE RATHER THAN PATCHING STATE IN PLACE.
 *
 * A move rewrites the `order` of several rows and can change `parentId`; a delete cascades to an
 * unknown number of descendants and renumbers the siblings left behind. Reproducing that
 * arithmetic client-side means writing the reorder logic twice, in two languages, and having the
 * copies disagree the first time one is fixed. The tree is 30–60 nodes — re-reading it is a few
 * milliseconds, and it is always right.
 */

type Props = { pageId: string };

export function RoadmapEditor({ pageId }: Props) {
  const [page, setPage] = useState<RoadmapPageMeta | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapMeta | null>(null);
  const [tree, setTree] = useState<EditorNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newTopic, setNewTopic] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/roadmaps/${pageId}`);
      if (!res.ok) throw new Error('Failed to load roadmap');
      const data = await res.json();
      setPage(data.page);
      setRoadmap(data.roadmap);
      setTree(data.tree ?? []);

      /*
        ⚠️ PRUNE COLLAPSE STATE TO IDS THAT STILL EXIST.

        Collapse is keyed by node id, and a delete can remove several. Left alone the set grows
        forever with ids of deleted nodes — harmless today, but it also means a NEW node that
        happened to reuse an id would appear collapsed for no reason. Intersecting on every load
        keeps it honest.
      */
      const living = new Set(allIds(data.tree ?? []));
      setCollapsed((prev) => new Set([...prev].filter((id) => living.has(id))));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  /** One place for the fetch/refresh/error dance, so five call sites cannot each get it wrong. */
  const mutate = useCallback(
    async (url: string, init: RequestInit, nodeId?: string) => {
      setError('');
      if (nodeId) setBusyId(nodeId);
      try {
        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json' },
          ...init,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        await load();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        console.error(err);
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  async function handleCreateRoadmap() {
    setSaving(true);
    await mutate('/api/admin/roadmaps', {
      method: 'POST',
      body: JSON.stringify({ pageId }),
    });
    setSaving(false);
  }

  async function handleAddTopic(parentId: string | null, title: string) {
    if (!title.trim()) return;
    const data = await mutate(`/api/admin/roadmaps/${pageId}/nodes`, {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), parentId }),
    });
    // Select the new topic so the detail pane is immediately useful — adding a topic is almost
    // always followed by filling it in.
    if (data?.node?.id) setSelectedId(data.node.id);
  }

  async function handleSaveNode(id: string, patch: Record<string, unknown>) {
    setSaving(true);
    await mutate(`/api/admin/roadmap-nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }

  async function handleDelete(node: EditorNode) {
    const extra = countAll(node.children);
    const message =
      extra > 0
        ? `Delete "${node.title}" and its ${extra} sub-topic${extra === 1 ? '' : 's'}? This cannot be undone.`
        : `Delete "${node.title}"? This cannot be undone.`;
    // ⚠️ Names the blast radius. The self-relation cascades, so a step takes its whole subtree —
    // a bare "are you sure?" would hide that entirely.
    if (!window.confirm(message)) return;
    if (selectedId === node.id) setSelectedId(null);
    await mutate(`/api/admin/roadmap-nodes/${node.id}`, { method: 'DELETE' }, node.id);
  }

  const selected = selectedId ? findNode(tree, selectedId) : null;

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading roadmap…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/roadmaps">
            <ArrowLeft className="size-4" aria-hidden="true" />
            All roadmaps
          </Link>
        </Button>
        {page && (
          <p className="text-muted-foreground text-sm">
            {page.domain.name} · {page.title}
          </p>
        )}
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
          <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* ── Not set up yet ────────────────────────────────────────────── */}
      {!roadmap ? (
        <div className="border-border rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">This page has no roadmap yet</p>
          <p className="text-muted-foreground mx-auto mt-1 mb-4 max-w-sm text-sm">
            Create it to start adding topics. Nothing is published until the page itself is.
          </p>
          <Button onClick={handleCreateRoadmap} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Create roadmap
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* ── Tree ─────────────────────────────────────────────────── */}
          <div className="border-border bg-card space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Topics</h2>
              {tree.length > 0 && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() =>
                    setCollapsed((prev) =>
                      prev.size > 0 ? new Set() : new Set(allIds(tree))
                    )
                  }
                >
                  {collapsed.size > 0 ? 'Expand all' : 'Collapse all'}
                </button>
              )}
            </div>

            {tree.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No topics yet. Add the first step below.
              </p>
            ) : (
              <RoadmapTree
                nodes={tree}
                selectedId={selectedId}
                collapsed={collapsed}
                busyId={busyId}
                onSelect={setSelectedId}
                onToggle={(id) =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onAddChild={(parentId) => {
                  const title = window.prompt('Sub-topic title');
                  if (title) handleAddTopic(parentId, title);
                }}
                onMove={(id, direction: MoveDirection) =>
                  mutate(
                    `/api/admin/roadmap-nodes/${id}/move`,
                    { method: 'POST', body: JSON.stringify({ direction }) },
                    id
                  )
                }
                onDelete={handleDelete}
              />
            )}

            <div className="border-border flex gap-2 border-t pt-3">
              <Input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTopic(null, newTopic);
                    setNewTopic('');
                  }
                }}
                placeholder="New step…"
                className="h-9"
              />
              <Button
                size="sm"
                onClick={() => {
                  handleAddTopic(null, newTopic);
                  setNewTopic('');
                }}
                disabled={!newTopic.trim()}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>
          </div>

          {/* ── Detail ───────────────────────────────────────────────── */}
          <div className="border-border bg-card rounded-lg border p-5">
            {selected ? (
              <RoadmapNodeForm node={selected} saving={saving} onSave={handleSaveNode} />
            ) : (
              <RoadmapMetaForm
                roadmap={roadmap}
                pageId={pageId}
                onSaved={load}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The roadmap's own title and description, shown when no topic is selected.
 *
 * ⚠️ `description` is PLAIN TEXT and feeds the public meta description — markup here would be
 * rendered as literal characters in search results.
 */
function RoadmapMetaForm({
  roadmap,
  pageId,
  onSaved,
}: {
  roadmap: RoadmapMeta;
  pageId: string;
  onSaved: () => Promise<void>;
}) {
  const current = resolveRoadmapSettings(roadmap.settings);
  const [title, setTitle] = useState(roadmap.title);
  const [description, setDescription] = useState(roadmap.description ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = title !== roadmap.title || description !== (roadmap.description ?? '');

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/admin/roadmaps/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        /*
          ⚠️ The whole resolved settings object, not just the changed key. `settings` is one JSON
          column — sending `{ layout }` alone would replace the blob and drop `defaultExpanded`
          with it. That is the shallow-write trap `align-table-settings.mjs` was written to
          repair in K-2, and it costs nothing to avoid here.
        */
        body: JSON.stringify({ title, description, settings: current }),
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold">Roadmap details</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Select a topic on the left to edit it, or set the heading shown above the tree.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="roadmap-title">Heading</Label>
        <Input id="roadmap-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-muted-foreground text-xs">
          Shown above the tree, e.g. &ldquo;Frontend Developer&rdquo;. Separate from the page
          title, which is what appears in the sidebar and breadcrumb.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="roadmap-description">Intro line</Label>
        <Input
          id="roadmap-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Plain text, no HTML — it also becomes this page&rsquo;s search-result description.
        </p>
      </div>

      {/*
        A roadmap-wide LAYOUT selector lived here while `clustered` and `branching` were being
        compared. Branching won, clustered was deleted, and this went with it (L-13).

        ⚠️ The per-node connector controls are NOT this — they are on the topic form, because
        the choice is genuinely per node: one step's children are a sequence, the next step's are
        alternatives.
      */}

      <Button onClick={save} disabled={!dirty || saving}>
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Save details
      </Button>
    </div>
  );
}

function countAll(nodes: EditorNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countAll(node.children), 0);
}
