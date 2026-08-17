// src/components/domain/RoadmapLayout.tsx

import { PageHeading } from './PageHeading';
import { RoadmapView, type RoleLink } from './roadmap/RoadmapView';
import type { SpineNode } from './roadmap/RoadmapSpine';
import { resolveRoadmapSettings } from '@/lib/roadmap-settings';
import { buildTree } from '@/lib/roadmap-tree';
import type { PageWithContent, PageBasic } from '@/services/types';

/**
 * The public roadmap page (L-6).
 * ============================================================================
 *
 * ⚠️ A SERVER COMPONENT. The tree, every topic title and every Sheet body are in the initial
 * HTML. That is the deliberate opposite of `TableLayout`, which is `'use client'` and fetches
 * its rows in a `useEffect` — leaving ~650 table pages returning 200 with no content in the
 * document at all (finding #30). A roadmap ships indexable on day one.
 */

type Domain = { id: string; name: string; slug: string };

type Props = {
  page: PageWithContent & { title: string; icon?: string | null };
  domain: Domain;
  /**
   * Published sibling pages whose `contentType` is `roadmap` — the "Choose your role" options.
   *
   * ⚠️ DERIVED FROM THE PAGE TREE, NOT CONFIGURED ANYWHERE (33.2a). A role IS a page, so its
   * order, icon, status and geo-targeting all come from `Page`, and a role cannot appear in
   * this dropdown while 404ing on click — the same row decides both.
   */
  siblingRoles: PageBasic[];
  /** The current page's own public path, used to mark the active option. */
  currentPath: string;
  /** `?topic=` from the request, so a deep link arrives with its Sheet already open. */
  openTopic: string | null;
};

export function RoadmapLayout({ page, domain, siblingRoles, currentPath, openTopic }: Props) {
  const roadmap = page.roadmap;

  /*
    A roadmap page whose `Roadmap` row has not been created yet. This is a real state — L-2
    creates the page, L-3's button creates the roadmap — so it renders an honest placeholder
    rather than an error. Same treatment as an empty rich-text page.
  */
  if (!roadmap) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <PageHeading title={page.title} icon={page.icon} spacing="loose" />
          <div className="border-border rounded-lg border border-dashed py-16 text-center">
            <p className="font-medium">Coming soon</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              This roadmap is being put together.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const settings = resolveRoadmapSettings(roadmap.settings);

  /*
    Nested here rather than in the service: the database has no notion of a tree, and the other
    consumers of this data want different shapes entirely (the sitemap wants one timestamp, the
    meta description wants one string). Nesting is a render concern.
  */
  const tree = buildTree(roadmap.nodes) as SpineNode[];

  /*
    ⚠️ EVERY badge in the roadmap, collected before rendering, so `assignBadgeColors` sees the
    complete set. Computing colours per-branch would give the same word different colours in
    different parts of the page — the exact defect K-1 was written to fix in tables.
  */
  const allBadges = roadmap.nodes.flatMap((node) => node.badges);

  const roles: RoleLink[] = siblingRoles.map((sibling) => ({
    id: sibling.id,
    title: sibling.title,
    icon: sibling.icon ?? null,
    // Siblings share a parent, so swapping the last segment is correct here — unlike the admin
    // screens, which have no parent chain in scope and must resolve the path server-side.
    href: `${currentPath.split('/').slice(0, -1).join('/')}/${sibling.slug}`,
  }));

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/*
          ⚠️ THE TITLE COMES THROUGH `PageHeading`, NOT FROM `RoadmapView`'s OWN <h1>.

          It rendered its own heading until 17 Aug 2026, and the cost was exactly what
          PageHeading's comment predicts: **the roadmap shipped with no Share button and nobody
          noticed**, because a missing share button renders nothing and errors nothing. Every
          other public layout goes through this component and gets one by default.

          The heading shows the ROADMAP's title, falling back to the page's. They differ on
          purpose — the page is "Frontend" in the sidebar and breadcrumb, the roadmap can be
          "Frontend Developer" on the page itself.
        */}
        <PageHeading title={roadmap.title || page.title} icon={page.icon} share />

        {roadmap.description && (
          <p className="text-muted-foreground -mt-6 mb-8 max-w-prose">{roadmap.description}</p>
        )}

        <RoadmapView
          tree={tree}
          allBadges={allBadges}
          expandFirst={settings.expandFirst}
          // Keyed by roadmap id, so two roadmaps in the same domain never share collapse state.
          storageKey={`atno:roadmap:${roadmap.id}:collapsed`}
          roles={roles}
          currentRoleHref={currentPath}
          initialTopic={openTopic}
        />
      </div>
    </div>
  );
}
