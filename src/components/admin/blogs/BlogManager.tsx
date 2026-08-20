// src/components/admin/blogs/BlogManager.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, ImageUp, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { BLOG_CATEGORIES, blogCategoryLabel, slugifyTitle } from '@/lib/blog-types';

/**
 * The blog admin (M-9).
 * ============================================================================
 *
 * ⚠️ THIS DIRECTORY IS DELIBERATELY *NOT* IN THE `dangerouslySetInnerHTML` BAN in
 * `eslint.config.mjs` — the same call as `admin/changelog`. That rule exists because STRANGERS
 * write feedback, submissions and job applications. A blog post is admin-authored, exactly like
 * rich text and roadmap sheets, and the preview below genuinely needs raw HTML. Applying the rule
 * here would be copying it past the reason for it.
 *
 * ⚠️ A SELF-CONTAINED EDITOR RATHER THAN A REUSED `HtmlEditor`. That component takes a `pageId`
 * and fetches and saves through the rich-text API — it is coupled to `Page`, and making it generic
 * would mean refactoring a working feature to serve a new one. The duplication is accepted because
 * L-11 (content blocks) migrates rich text, roadmap sheets AND blogs in one pass, so any editor
 * unification done now is work thrown away twice.
 */

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  author: string;
  category: string | null;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string;
};

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  coverAlt: string;
  author: string;
  content: string;
  category: string;
  tags: string;
  published: boolean;
};

/** ⚠️ Radix forbids `value=""`, so "no category" needs a sentinel. Same trap as M-6's "not sure". */
const NO_CATEGORY = '__none__';

const EMPTY: Draft = {
  title: '',
  slug: '',
  excerpt: '',
  coverUrl: '',
  coverAlt: '',
  author: 'ATNO',
  content: '',
  category: NO_CATEGORY,
  tags: '',
  published: false,
};

export default function BlogManager() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PostRow | null>(null);

  /*
    ⚠️ TRACKS WHETHER THE SLUG WAS TYPED BY HAND. While it is false the slug follows the title, so
    writing a headline fills it in automatically; the moment it is edited directly, auto-fill stops
    for good. Without this flag, correcting a slug and then fixing a typo in the title would
    silently throw the correction away.
  */
  const [slugTouched, setSlugTouched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/blogs');
      if (!response.ok) throw new Error('Could not load posts.');
      setPosts((await response.json()).items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openEditor(post: PostRow | null) {
    setPreview(false);
    setError(null);

    if (!post) {
      setEditingId(null);
      setDraft(EMPTY);
      setSlugTouched(false);
      setOpen(true);
      return;
    }

    /*
      ⚠️ THE FULL POST IS FETCHED BEFORE OPENING. The list route omits `content` and `coverAlt`
      deliberately — sending every body with the list would make the index heavy for no benefit —
      so opening the editor from list data alone would silently blank the body on save.
    */
    try {
      const response = await fetch(`/api/admin/blogs/${post.id}`);
      if (!response.ok) throw new Error('Could not open that post.');
      const full = await response.json();

      setEditingId(full.id);
      setDraft({
        title: full.title,
        slug: full.slug,
        excerpt: full.excerpt ?? '',
        coverUrl: full.coverUrl ?? '',
        coverAlt: full.coverAlt ?? '',
        author: full.author,
        content: full.content,
        category: full.category ?? NO_CATEGORY,
        tags: (full.tags ?? []).join(', '),
        published: full.publishedAt !== null,
      });
      setSlugTouched(true); // An existing post's slug is never auto-rewritten.
      setOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open that post.');
    }
  }

  async function uploadCover(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      // No Content-Type header — the browser must generate the multipart boundary itself.
      const response = await fetch('/api/admin/blog-covers', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not upload that image.');
      setDraft((d) => ({ ...d, coverUrl: data.url }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload that image.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);

    const body = {
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      excerpt: draft.excerpt.trim() || null,
      coverUrl: draft.coverUrl.trim() || null,
      coverAlt: draft.coverAlt.trim() || null,
      author: draft.author.trim(),
      content: draft.content,
      category: draft.category === NO_CATEGORY ? null : draft.category,
      tags: draft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      /*
        ⚠️ PUBLISHING STAMPS *NOW*; UNPUBLISHING SENDS `null`. The checkbox is a boolean but the
        column is a date — the translation happens here rather than in the API so the API keeps
        accepting an explicit timestamp, which is what a future "schedule for" control will send.

        ⚠️ Re-saving an already-published post pushes its date forward. Acceptable for now and
        worth knowing: the fix is to preserve the original when the post was already published,
        which needs the old value in state. Noted rather than silently wrong.
      */
      publishedAt: draft.published ? new Date().toISOString() : null,
    };

    try {
      const response = await fetch(
        editingId ? `/api/admin/blogs/${editingId}` : '/api/admin/blogs',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Could not save that post.');

      setOpen(false);
      setEditingId(null);
      setDraft(EMPTY);
      await load();
    } catch (caught) {
      // The server's message is surfaced — a duplicate slug returns a 409 explaining exactly that.
      setError(caught instanceof Error ? caught.message : 'Could not save that post.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setPendingDelete(null);
    try {
      const response = await fetch(`/api/admin/blogs/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete that post.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete that post.');
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </p>
        <Button size="sm" onClick={() => openEditor(null)}>
          <Plus className="size-4" aria-hidden="true" />
          New post
        </Button>
      </div>

      {error && (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!loading && posts.length === 0 && (
        <div className="border-border text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
          No posts yet. `/blogs` shows an honest empty state until one is published.
        </div>
      )}

      <ul className="space-y-2">
        {posts.map((post) => {
          /*
            ⚠️ THREE STATES, NOT TWO. A date in the FUTURE is scheduled, not published — the public
            filter hides it, so showing it as live here would contradict the site.
          */
          const scheduled =
            post.publishedAt !== null && new Date(post.publishedAt).getTime() > Date.now();
          const live = post.publishedAt !== null && !scheduled;

          return (
            <li key={post.id} className="border-border bg-card rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{post.title}</p>
                  <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span
                      className={
                        live
                          ? 'text-foreground font-medium'
                          : scheduled
                            ? 'font-medium'
                            : 'font-medium'
                      }
                    >
                      {live ? 'Published' : scheduled ? 'Scheduled' : 'Draft'}
                    </span>
                    <span className="break-all">/blogs/{post.slug}</span>
                    {post.category && <span>{blogCategoryLabel(post.category)}</span>}
                    <span>{post.author}</span>
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      aria-label={`Actions for ${post.title}`}
                    >
                      <MoreVertical className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void openEditor(post)}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </DropdownMenuItem>

                    {live && (
                      <DropdownMenuItem asChild>
                        <a href={`/blogs/${post.slug}`} target="_blank" rel="noopener noreferrer">
                          <Eye className="size-4" aria-hidden="true" />
                          View live
                        </a>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(post)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Editor ───────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-h-[88svh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit post' : 'New post'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bp-title">Title</Label>
                <Input
                  id="bp-title"
                  value={draft.title}
                  maxLength={200}
                  onChange={(e) => {
                    const title = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      title,
                      // Follows the title only until the slug is edited by hand.
                      slug: slugTouched ? d.slug : slugifyTitle(title),
                    }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bp-slug">Slug</Label>
                <Input
                  id="bp-slug"
                  value={draft.slug}
                  maxLength={80}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setDraft((d) => ({ ...d, slug: e.target.value }));
                  }}
                />
                <p className="text-muted-foreground text-xs break-all">/blogs/{draft.slug || '…'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bp-excerpt">Excerpt</Label>
              <Textarea
                id="bp-excerpt"
                rows={2}
                value={draft.excerpt}
                maxLength={320}
                placeholder="One or two sentences. Used on the listing and as the meta description."
                onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
              />
            </div>

            {/* ── Cover ────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="bp-cover">Cover image</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="bp-cover"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCover(file);
                  }}
                  className="file:text-foreground max-w-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
                {uploading && (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <ImageUp className="size-4" aria-hidden="true" />
                    Uploading…
                  </span>
                )}
                {draft.coverUrl && !uploading && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft((d) => ({ ...d, coverUrl: '', coverAlt: '' }))}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {draft.coverUrl && (
                <>
                  {/*
                    ⚠️ A PLAIN `<img>`, NOT `next/image`. This is an admin preview of a URL that has
                    only just been created; `next/image` would route it through the optimiser and
                    cache a size nobody needs. The PUBLIC pages use `next/image` with explicit
                    1200x630 dimensions, which is where it earns its keep.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.coverUrl}
                    alt=""
                    className="border-border mt-2 w-full max-w-sm rounded border"
                  />
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="bp-cover-alt">Cover alt text</Label>
                    <Input
                      id="bp-cover-alt"
                      value={draft.coverAlt}
                      maxLength={200}
                      placeholder="What the image shows. Leave blank if purely decorative."
                      onChange={(e) => setDraft((d) => ({ ...d, coverAlt: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bp-author">Author</Label>
                <Input
                  id="bp-author"
                  value={draft.author}
                  maxLength={120}
                  onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bp-category">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(value) => setDraft((d) => ({ ...d, category: value }))}
                >
                  <SelectTrigger id="bp-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                    {BLOG_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bp-tags">Tags</Label>
                <Input
                  id="bp-tags"
                  value={draft.tags}
                  placeholder="comma, separated"
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="bp-content">Body (HTML)</Label>
                <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}>
                  {preview ? (
                    <>
                      <EyeOff className="size-4" aria-hidden="true" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" aria-hidden="true" />
                      Preview
                    </>
                  )}
                </Button>
              </div>

              {preview ? (
                /*
                  ⚠️ THE SAME `rich-text-content` CLASS THE PUBLIC PAGE USES, so what is previewed
                  is what will be published. A preview styled differently from the live page is
                  worse than no preview — it is confidently wrong.

                  ⚠️ `dangerouslySetInnerHTML` is correct here and this directory is deliberately
                  outside the lint ban: this HTML was typed by the admin looking at the screen, not
                  submitted by a stranger. See the note at the top of this file.
                */
                <div
                  className="border-border rich-text-content min-h-[16rem] rounded-md border p-4 [&>div]:space-y-4"
                  dangerouslySetInnerHTML={{ __html: draft.content }}
                />
              ) : (
                <Textarea
                  id="bp-content"
                  rows={16}
                  value={draft.content}
                  maxLength={200_000}
                  placeholder="<h2>A heading</h2><p>Some text.</p>"
                  className="font-mono text-xs"
                  onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                />
              )}

              <p className="text-muted-foreground text-xs">
                ⚠️ Never write a hard-coded colour — it will be invisible in one theme. See
                ROADMAP-CONTENT-GUIDE.md §3 and §8.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
              />
              Published
              <span className="text-muted-foreground text-xs">
                (unchecked keeps it a draft — invisible on the site and 404 by URL)
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={
                saving ||
                draft.title.trim() === '' ||
                draft.slug.trim() === '' ||
                draft.author.trim() === '' ||
                draft.content.trim() === ''
              }
            >
              {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.title}" will be removed permanently, along with its URL. Anything linking to /blogs/${pendingDelete.slug} will 404.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => pendingDelete && void remove(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
