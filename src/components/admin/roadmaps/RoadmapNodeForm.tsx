// src/components/admin/roadmaps/RoadmapNodeForm.tsx

'use client';

import { useEffect, useState } from 'react';
import { Eye, Loader2, Pencil, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { IconPicker } from '@/components/admin/IconPicker';
import type { EditorNode } from './types';

/**
 * The detail pane of the roadmap editor (L-4).
 * ============================================================================
 *
 * Edits one topic. Saving sends only what changed.
 */

type Props = {
  node: EditorNode;
  saving: boolean;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
};

export function RoadmapNodeForm({ node, saving, onSave }: Props) {
  /*
    ⚠️ SEEDED FROM THE WHOLE NODE, THEN GAPS FILLED — NOT REBUILT FROM A FIELD LIST.

    Writing `useState({ title: node.title, slug: node.slug, icon: node.icon, ... })` is the
    rebuild-by-explicit-field-list bug, which has landed **seven times** in this project — most
    recently in K-5c's RowDialog, where a row's image silently vanished on every edit because
    the seeding list predated the field.

    Spreading the node first means a field added to the schema tomorrow arrives here for free.
    It cannot be dropped by a list that was written before it existed.
  */
  const [form, setForm] = useState(() => ({ ...node }));
  const [badgeDraft, setBadgeDraft] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  /*
    ⚠️ RE-SEED WHEN A DIFFERENT TOPIC IS SELECTED.

    Without this, `useState`'s initialiser runs once and the pane keeps showing the first topic's
    values while the tree highlights another — and the next save writes them onto the wrong node.
    Keyed on `node.id` rather than `node`, so a re-render from an unrelated parent update does
    not throw away in-progress typing.
  */
  useEffect(() => {
    setForm({ ...node });
    setBadgeDraft('');
    setTab('edit');
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof EditorNode>(key: K, value: EditorNode[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addBadge() {
    const value = badgeDraft.trim();
    // De-duplicated here as well as server-side: a repeated label takes a second colour slot in
    // `assignBadgeColors`, shifting every later badge's colour for no visible reason.
    if (!value || form.badges.includes(value)) {
      setBadgeDraft('');
      return;
    }
    update('badges', [...form.badges, value]);
    setBadgeDraft('');
  }

  async function handleSave() {
    /*
      Send only what actually differs. A PATCH carrying every field would work, but it turns
      every save into a full overwrite — so two people editing different fields of the same
      topic would clobber each other, and the diff in the server log would say nothing.
    */
    const patch: Record<string, unknown> = {};
    if (form.title !== node.title) patch.title = form.title;
    if (form.slug !== node.slug) patch.slug = form.slug;
    if (form.icon !== node.icon) patch.icon = form.icon;
    if (form.recommended !== node.recommended) patch.recommended = form.recommended;
    if (JSON.stringify(form.badges) !== JSON.stringify(node.badges)) patch.badges = form.badges;
    if ((form.htmlContent ?? '') !== (node.htmlContent ?? '')) {
      patch.htmlContent = form.htmlContent ?? '';
    }
    if (Object.keys(patch).length === 0) return;
    await onSave(node.id, patch);
  }

  const dirty =
    form.title !== node.title ||
    form.slug !== node.slug ||
    form.icon !== node.icon ||
    form.recommended !== node.recommended ||
    JSON.stringify(form.badges) !== JSON.stringify(node.badges) ||
    (form.htmlContent ?? '') !== (node.htmlContent ?? '');

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="node-title">Title</Label>
          <Input
            id="node-title"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="node-slug">Slug</Label>
          <Input
            id="node-slug"
            value={form.slug}
            onChange={(e) => update('slug', e.target.value)}
            className="font-mono text-sm"
          />
          {/* ⚠️ Says what the slug IS FOR. Without this it looks like a decorative field and
              gets renamed freely — which breaks every shared ?topic= link to this topic. */}
          <p className="text-muted-foreground text-xs">
            The deep link: <span className="font-mono">?topic={form.slug || '…'}</span> · unique
            within this roadmap · changing it breaks existing shared links
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="node-icon">Icon</Label>
          <IconPicker
            id="node-icon"
            value={form.icon}
            onChange={(iconId) => update('icon', iconId)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Flags</Label>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={form.recommended}
              onCheckedChange={(checked) => update('recommended', checked === true)}
            />
            <Star className="size-3.5 fill-current text-amber-500" aria-hidden="true" />
            Recommended
          </label>
          {/* ⚠️ Explains why this is a checkbox and not just a badge you could type. */}
          <p className="text-muted-foreground text-xs">
            Draws a filled marker on the spine — the happy path through the roadmap.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="node-badge">Badges</Label>
        <div className="flex flex-wrap items-center gap-2">
          {form.badges.map((badge) => (
            <Badge key={badge} variant="secondary" className="gap-1 pr-1">
              {badge}
              <button
                type="button"
                onClick={() => update('badges', form.badges.filter((b) => b !== badge))}
                className="hover:text-destructive rounded"
                aria-label={`Remove badge ${badge}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          <Input
            id="node-badge"
            value={badgeDraft}
            onChange={(e) => setBadgeDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds the badge rather than submitting anything — there is no form element
              // here, but a stray submit is exactly the kind of thing a wrapper adds later.
              if (e.key === 'Enter') {
                e.preventDefault();
                addBadge();
              }
            }}
            onBlur={addBadge}
            placeholder="Add a badge…"
            className="h-8 w-40"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Free text. Coloured automatically, and the same word keeps the same colour down the page.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="node-content">Sheet content</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={tab === 'edit' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab('edit')}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
            <Button
              type="button"
              variant={tab === 'preview' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab('preview')}
            >
              <Eye className="size-3.5" aria-hidden="true" />
              Preview
            </Button>
          </div>
        </div>

        {tab === 'edit' ? (
          <textarea
            id="node-content"
            value={form.htmlContent ?? ''}
            onChange={(e) => update('htmlContent', e.target.value)}
            spellCheck={false}
            className="border-input bg-background focus-visible:ring-ring min-h-[280px] w-full rounded-md border px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
            placeholder="<h3>Description</h3>&#10;<ul><li>…</li></ul>&#10;&#10;Leave empty for a topic with no sheet."
          />
        ) : (
          /*
            ⚠️ The preview uses the SAME container classes and theme tokens the public Sheet
            will (L-7). A preview on a fixed white background would look right here and wrong on
            the site, which is worse than having no preview at all.
          */
          <div className="border-input bg-background min-h-[280px] rounded-md border px-4 py-3">
            {form.htmlContent ? (
              <div
                className="roadmap-sheet text-sm"
                dangerouslySetInnerHTML={{ __html: form.htmlContent }}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                No content — this topic will render as a label, not a link.
              </p>
            )}
          </div>
        )}

        {/* ⚠️ Says plainly that nothing is cleaned. #35 removed sanitisation site-wide, and the
            guide is the only control left. An author who assumes otherwise is the risk. */}
        <p className="text-muted-foreground text-xs">
          Stored exactly as written — nothing is stripped. Never set a colour; see
          ROADMAP-CONTENT-GUIDE.md.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save topic
        </Button>
        {dirty && !saving && (
          <span className="text-muted-foreground text-xs">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
