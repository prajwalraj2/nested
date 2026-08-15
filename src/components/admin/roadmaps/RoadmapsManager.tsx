// src/components/admin/roadmaps/RoadmapsManager.tsx

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, Plus, Route, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PAGE_STATUS_LABELS } from '@/lib/page-status';
import type { PageStatus } from '@/generated/prisma';

/**
 * Roadmap Management (L-3).
 * ============================================================================
 *
 * Pick a domain → see every page in it whose `contentType` is `roadmap` → create the roadmap
 * or open the tree editor.
 *
 * ⚠️ WRITTEN THEME-AWARE FROM THE START, UNLIKE THE TWO SCREENS IT MIRRORS.
 * `RichTextManager` and `TablesManager` both hardcode `text-gray-*`, `bg-gray-50`, `bg-red-50`
 * and friends, so they are light islands inside a themed admin. That was cheap to write and is
 * now expensive to unpick — #34 is the record of what a pinned surface costs once content
 * depends on it. Everything here uses tokens (`text-muted-foreground`, `bg-muted`,
 * `text-destructive`) which are redefined per theme, so this screen needs no second pass.
 */

type Domain = { id: string; name: string; slug: string };

type RoadmapPage = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  icon: string | null;
  /**
   * `null` until someone creates it. ⚠️ This is the normal state for a freshly created page,
   * and it is what drives the Create/Edit split below — see the note on the GET handler.
   */
  roadmap: {
    id: string;
    title: string;
    description: string | null;
    updatedAt: string;
  } | null;
  nodeCount: number;
  /**
   * Resolved SERVER-SIDE by walking the parent chain (#22.4). ⚠️ Do not rebuild it here from
   * `/domain/${domainSlug}/${page.slug}` — roadmap roles live under a `subcategory_list`
   * chooser (33.4), so that form is wrong for every role page in a multi-role domain.
   */
  previewUrl: string | null;
};

export function RoadmapsManager() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [pages, setPages] = useState<RoadmapPage[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  /** Which page id is mid-create, so only that row's button spins. */
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoadingDomains(true);
      setError('');
      try {
        const res = await fetch('/api/admin/domains');
        if (!res.ok) throw new Error('Failed to fetch domains');
        const data = await res.json();
        setDomains(data.domains || []);
      } catch (err) {
        setError('Could not load domains. Refresh to try again.');
        console.error(err);
      } finally {
        setLoadingDomains(false);
      }
    })();
  }, []);

  const loadPages = useCallback(async (domainId: string) => {
    setLoadingPages(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/roadmaps?domainId=${domainId}`);
      if (!res.ok) throw new Error('Failed to fetch roadmaps');
      const data = await res.json();
      setPages(data.pages || []);
    } catch (err) {
      setError('Could not load roadmaps for that domain.');
      console.error(err);
    } finally {
      setLoadingPages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDomainId) loadPages(selectedDomainId);
    else setPages([]);
  }, [selectedDomainId, loadPages]);

  async function handleCreate(pageId: string) {
    setCreating(pageId);
    setError('');
    try {
      const res = await fetch('/api/admin/roadmaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create roadmap');
      /*
        Re-fetch rather than patching the row in place. The response carries the new roadmap,
        but the list also shows a node count and an updatedAt that the server owns — rebuilding
        half of it here is how two sources of truth start disagreeing.
      */
      await loadPages(selectedDomainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roadmap');
      console.error(err);
    } finally {
      setCreating(null);
    }
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-8">
      {/* ── Domain picker ─────────────────────────────────────────────── */}
      <div className="max-w-md space-y-1.5">
        <Label htmlFor="roadmap-domain">Domain</Label>
        <Select
          value={selectedDomainId}
          onValueChange={setSelectedDomainId}
          disabled={loadingDomains}
        >
          <SelectTrigger id="roadmap-domain" className="w-full">
            {/* ⚠️ Radix needs explicit children here — a bare <SelectValue /> renders empty
                once a value is set. Same trap as the table toolbar's selects. */}
            <SelectValue placeholder={loadingDomains ? 'Loading domains…' : 'Choose a domain'}>
              {domains.find((d) => d.id === selectedDomainId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {domains.map((domain) => (
              <SelectItem key={domain.id} value={domain.id}>
                <span>
                  <span className="block">{domain.name}</span>
                  <span className="text-muted-foreground block text-xs">/{domain.slug}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
          <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* ── Nothing chosen yet ────────────────────────────────────────── */}
      {!selectedDomainId && !loadingDomains && (
        <div className="border-border rounded-lg border border-dashed py-16 text-center">
          <Route className="text-muted-foreground mx-auto mb-3 size-8" aria-hidden="true" />
          <p className="font-medium">Choose a domain to begin</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Roadmaps are built on pages whose content type is <strong>Roadmap</strong>. Create
            those in <Link href="/admin/pages" className="underline">Pages</Link> first.
          </p>
        </div>
      )}

      {/* ── The list ──────────────────────────────────────────────────── */}
      {selectedDomainId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Roadmap pages</h2>
            <Badge variant="outline">
              {pages.length} page{pages.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {loadingPages ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading roadmaps…
            </div>
          ) : pages.length === 0 ? (
            /*
              ⚠️ This empty state must explain the CAUSE, not just report emptiness. The reason
              is almost always "no page in this domain has contentType roadmap yet", and without
              saying so the screen looks broken rather than empty.
            */
            <div className="border-border rounded-lg border border-dashed py-16 text-center">
              <p className="font-medium">No roadmap pages in this domain</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Go to <Link href="/admin/pages" className="underline">Pages</Link>, create a page,
                and set its content type to <strong>Roadmap</strong>. It will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pages.map((page) => (
                <li
                  key={page.id}
                  className="border-border bg-card flex flex-wrap items-center gap-4 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{page.title}</span>

                      {/* ⚠️ Status is shown because a DRAFT role is absent from the public
                          role dropdown AND 404s on its own URL. Without it here, a roadmap
                          that has been built but not published looks identical to a live one. */}
                      {page.status !== 'PUBLISHED' && (
                        <Badge variant="outline" className="text-xs">
                          {PAGE_STATUS_LABELS[page.status]}
                        </Badge>
                      )}

                      {page.roadmap ? (
                        <Badge variant="secondary" className="text-xs">
                          {page.nodeCount} topic{page.nodeCount === 1 ? '' : 's'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Not set up
                        </Badge>
                      )}
                    </div>

                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {/* The server-resolved path, or an honest admission that there is none —
                          never a guessed URL. */}
                      {page.previewUrl ?? 'no public URL'}
                      {page.roadmap && (
                        <span> · updated {formatDate(page.roadmap.updatedAt)}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {page.previewUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={page.previewUrl} target="_blank">
                          <ExternalLink className="size-4" aria-hidden="true" />
                          View
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="This page has no reachable public URL"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        View
                      </Button>
                    )}

                    {page.roadmap ? (
                      <Button asChild size="sm">
                        <Link href={`/admin/roadmaps/${page.id}`}>Edit roadmap</Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleCreate(page.id)}
                        disabled={creating === page.id}
                      >
                        {creating === page.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Plus className="size-4" aria-hidden="true" />
                        )}
                        Create roadmap
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
