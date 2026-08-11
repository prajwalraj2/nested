// src/components/admin/images/ImagesManager.tsx

'use client';

import * as React from 'react';
import { AlertTriangle, ImageOff, Loader2, MoreHorizontal, Search, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

/**
 * Image Management (K-5b).
 * ============================================================================
 *
 * The screen the user designed in §29.7: a grid of every stored image, what uses it, an
 * "unused only" filter, and upload / rename / replace / delete.
 *
 * ⚠️ ORPHAN CLEANUP IS THE POINT, NOT A FEATURE. Images stop being referenced when rows
 * change, and without a list of what nothing uses, the bucket grows forever and nobody knows
 * what is safe to remove. That is why the unused filter exists and why every card carries a
 * usage count rather than hiding it behind a click.
 *
 * ⚠️ Counts are 0 for everything until K-5c, because no table column can reference an image
 * yet. That is correct, not broken — worth knowing before reading this screen.
 */

type TableImageRow = {
  id: string;
  key: string;
  url: string;
  provider: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  usageCount: number;
  usedIn: Array<{ tableName: string; pageTitle: string | null; rowLabel: string }>;
};

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

export function ImagesManager() {
  const [images, setImages] = React.useState<TableImageRow[]>([]);
  const [provider, setProvider] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [unusedOnly, setUnusedOnly] = React.useState(false);

  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const [renaming, setRenaming] = React.useState<TableImageRow | null>(null);
  const [renameValue, setRenameValue] = React.useState('');
  const [deleting, setDeleting] = React.useState<TableImageRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const replaceFor = React.useRef<string | null>(null);
  const replaceInput = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/table-images', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Could not load images.');
      setImages(body.images ?? []);
      setProvider(body.provider ?? '');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load images.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * Upload one or many.
   *
   * ⚠️ Sequential, not `Promise.all`. Each upload re-encodes an image server-side, and firing
   * twenty at once would hold twenty decode buffers open. It also means a rejected file
   * reports which one it was, rather than one message for the whole batch.
   */
  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setError(null);
    const failures: string[] = [];

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      // The key comes from the filename; the server normalises it and the person can rename
      // afterwards. Asking for a key per file before uploading twenty would be worse.
      form.append('key', file.name.replace(/\.[^.]+$/, ''));
      try {
        const res = await fetch('/api/admin/table-images', { method: 'POST', body: form });
        const body = await res.json();
        if (!res.ok) failures.push(`${file.name}: ${body.message ?? res.status}`);
      } catch {
        failures.push(`${file.name}: the upload could not be sent.`);
      }
    }

    setUploading(false);
    if (failures.length) setError(failures.join('\n'));
    await load();
  };

  const doRename = async () => {
    if (!renaming) return;
    setBusy(true);
    const form = new FormData();
    form.append('key', renameValue);
    const res = await fetch(`/api/admin/table-images/${renaming.id}`, { method: 'PATCH', body: form });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.message ?? 'Rename failed.');
      return;
    }
    setRenaming(null);
    await load();
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const res = await fetch(`/api/admin/table-images/${deleting.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      // The API refuses while rows still reference it and says how many — surfaced verbatim
      // rather than replaced with "could not delete", which would hide the reason.
      setError(body.message ?? 'Delete failed.');
      setDeleting(null);
      return;
    }
    setDeleting(null);
    await load();
  };

  const onReplaceChosen = async (files: FileList | null) => {
    const id = replaceFor.current;
    if (!id || !files?.[0]) return;
    setBusy(true);
    const form = new FormData();
    form.append('file', files[0]);
    const res = await fetch(`/api/admin/table-images/${id}`, { method: 'PATCH', body: form });
    const body = await res.json();
    setBusy(false);
    replaceFor.current = null;
    if (!res.ok) setError(body.message ?? 'Replace failed.');
    await load();
  };

  const visible = images.filter((img) => {
    if (unusedOnly && img.usageCount > 0) return false;
    if (search && !img.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unusedCount = images.filter((i) => i.usageCount === 0).length;
  const totalBytes = images.reduce((sum, i) => sum + i.bytes, 0);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          {/* `whitespace-pre-line` so a multi-file failure lists one per line. */}
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key…"
            className="h-9 pl-9"
            aria-label="Search images by key"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={unusedOnly}
            onCheckedChange={(v) => setUnusedOnly(!!v)}
            aria-label="Show only unused images"
          />
          Unused only
          {unusedCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{unusedCount}</span>
          )}
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline tabular-nums">
            {images.length} image{images.length === 1 ? '' : 's'} · {formatBytes(totalBytes)}
            {provider && ` · ${provider}`}
          </span>
          <Button onClick={() => fileInput.current?.click()} disabled={uploading} className="h-9">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload images
          </Button>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          // Reset so choosing the same file twice still fires a change event.
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void onReplaceChosen(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ── Drop zone / grid ────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => {
          // Without preventDefault the browser navigates to the dropped file.
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
          dragging ? 'border-primary bg-accent/40' : 'border-border'
        }`}
      >
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center">
            <ImageOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {images.length === 0 ? 'No images yet' : 'Nothing matches'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {images.length === 0
                ? 'Drop PNG or JPG files here, or use Upload images. They are resized to 64px WebP automatically.'
                : 'Try a different search, or clear the unused filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
            {visible.map((img) => (
              <Card key={img.id} className="flex flex-col gap-3 p-3">
                <div className="flex items-start gap-3">
                  {/*
                    ⚠️ A PLAIN `<img>`, NOT `next/image` — matching `ItemIcon` from Phase J and
                    for the same reason, which applies even more strongly here.

                    `next/image` exists to resize and re-encode. These objects are ALREADY
                    64px WebP, produced by the upload endpoint, so there is nothing left to
                    optimise: the component would re-encode a finished image and bill a
                    transformation for no benefit.

                    The first version used `next/image` with `unoptimized`, which disables the
                    only thing it provides while still requiring the blob host to be listed in
                    `next.config.ts`. Configuration for a feature deliberately switched off is
                    a trap for whoever reads it next.

                    The layout-shift protection people reach for `next/image` to get comes from
                    explicit `width`/`height`, which are set below.
                  */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 object-contain"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium text-foreground" title={img.key}>
                      {img.key}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {img.width}×{img.height} · {formatBytes(img.bytes)}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions for {img.key}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenaming(img);
                          setRenameValue(img.key);
                        }}
                      >
                        Rename key
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          replaceFor.current = img.id;
                          replaceInput.current?.click();
                        }}
                      >
                        Replace artwork
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleting(img)}
                        // Disabled rather than allowed-then-refused: the API would reject it,
                        // but a control that never works should not look available.
                        disabled={img.usageCount > 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/*
                  Usage is the reason this screen exists, so it is on the card rather than
                  behind a click — and "unused" is stated in words, not implied by a zero.
                */}
                {img.usageCount === 0 ? (
                  <p className="text-xs text-muted-foreground">Unused — safe to delete</p>
                ) : (
                  <p className="text-xs text-foreground">
                    Used in <span className="font-medium tabular-nums">{img.usageCount}</span>{' '}
                    row{img.usageCount === 1 ? '' : 's'}
                    <span className="block truncate text-muted-foreground" title={img.usedIn.map((u) => u.rowLabel).join(', ')}>
                      {img.usedIn.slice(0, 2).map((u) => u.rowLabel).join(', ')}
                      {img.usageCount > 2 && ` +${img.usageCount - 2} more`}
                    </span>
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Rename ─────────────────────────────────────────────────────────── */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename image key</DialogTitle>
            <DialogDescription>
              Rows reference an image by this key. Renaming one that is in use is refused,
              because those rows would be left pointing at nothing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-key">Key</Label>
            <Input
              id="rename-key"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="font-mono"
              placeholder="pixabay"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers and hyphens. Anything else is converted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doRename} disabled={busy || renameValue.trim() === ''}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete ─────────────────────────────────────────────────────────── */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.key}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stored file as well as the record. Nothing currently uses it,
              so no table will change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
