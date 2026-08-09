import { ChevronDown, Info } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AdminPageHeader } from '@/components/admin/layout/AdminPageHeader';
import { PagesManager } from '@/components/admin/pages/PagesManager';

/**
 * Admin — Pages (shell rebuilt in Phase G-4b).
 * ============================================================================
 *
 * Picks a domain, then manages that domain's page hierarchy. The interesting logic all
 * lives in `PagesManager` and below; this file is the server shell that supplies the
 * domain list.
 *
 * ⚠️ A DEAD `Roboto` IMPORT WAS REMOVED. This file called
 * `const roboto = Roboto({ subsets: ['latin'], weight: ['400','500','700'] })` and then
 * **never referenced `roboto` again** — not one `roboto.className` in the whole file. The
 * other three remaining importers at least use theirs. Pure dead weight, and it pulled a
 * second webfont into a build that already sets Geist app-wide in the root layout.
 *
 * ⚠️ THE GRADIENT BANNER WAS REMOVED, for the third time in this phase (dashboard in G-2,
 * domains in G-3a). `from-purple-50 to-blue-50` described the screen you are already looking
 * at, and was hardcoded light so it survived dark mode unchanged.
 *
 * ⚠️ THE "UNDERSTANDING DOMAIN TYPES" PANEL IS NOW COLLAPSED BY DEFAULT. It was a permanently
 * open two-column cyan/blue/purple explainer — genuinely useful the first time and pure
 * scroll-past on every visit after. Same treatment as the Domains tips box in G-3a, and the
 * content is kept verbatim because the direct-vs-hierarchical distinction is the one piece of
 * this app's model that is not self-evident from the UI.
 */

type SearchParams = {
  domain?: string; // Selected domain ID for filtering
  expand?: string; // Comma-separated list of expanded page IDs
};

type PagesPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function PagesManagePage({ searchParams }: PagesPageProps) {
  // Awaited because searchParams is a Promise in Next 15.
  const awaitedSearchParams = await searchParams;

  const domains = await fetchDomainsForPageManagement();

  return (
    <>
      <AdminPageHeader
        title="Pages"
        description={`Organise the page hierarchy across ${domains.length} domains.`}
      />

      {/*
        No `CardContent` padding wrapper — `PagesManager` draws its own sections with their
        own dividers, and an outer inset would double the padding on every one of them.
      */}
      <Card className="overflow-hidden">
        <PagesManager
          domains={domains}
          selectedDomainId={awaitedSearchParams.domain}
          // `?expand=a,b,c` persists which branches are open across a reload. An absent
          // parameter must become an empty array, not `['']`, which would be treated as a
          // page id that never matches.
          expandedPageIds={awaitedSearchParams.expand?.split(',').filter(Boolean) || []}
        />
      </Card>

      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            Understanding domain types
            <ChevronDown
              className="size-4 transition-transform [[data-state=open]_&]:rotate-180"
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="grid gap-6 text-sm md:grid-cols-2">
              <div className="space-y-2">
                <h5 className="font-medium">Direct domains</h5>
                <dl className="text-muted-foreground space-y-1">
                  {/*
                    A description list rather than a stack of <div><strong>…</strong></div>:
                    these are label/value pairs, and `<dt>`/`<dd>` is what conveys that
                    relationship to a screen reader.
                  */}
                  <div>
                    <dt className="text-foreground inline font-medium">Auto-creates: </dt>
                    <dd className="inline">a hidden <code>__main__</code> page</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Parent logic: </dt>
                    <dd className="inline">all pages → <code>__main__</code> → domain</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">URL: </dt>
                    <dd className="inline">
                      <code>/domain/gdesign/ytube</code>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Use for: </dt>
                    <dd className="inline">a single topic with organised sections</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2">
                <h5 className="font-medium">Hierarchical domains</h5>
                <dl className="text-muted-foreground space-y-1">
                  <div>
                    <dt className="text-foreground inline font-medium">Auto-creates: </dt>
                    <dd className="inline">nothing — a clean start</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Parent logic: </dt>
                    <dd className="inline">top-level pages attach to the domain directly</dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">URL: </dt>
                    <dd className="inline">
                      <code>/domain/webdev/with-code</code>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground inline font-medium">Use for: </dt>
                    <dd className="inline">several main categories under one domain</dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

/**
 * Fetch domains for page management.
 *
 * An explicit `select` rather than a bare `findMany`, so this does not haul every column of
 * all 35 rows across the wire for a picker that shows a name, an icon and a type — the same
 * payload discipline as #22.1.
 */
async function fetchDomainsForPageManagement() {
  try {
    const domains = await prisma.domain.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        pageType: true,
        // `status` replaces `isPublished` — the Pages screens badge a domain that is not
        // live, and with three states that badge needs to name which non-live state it is.
        status: true,
        icon: true,
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
      orderBy: [
        { category: { columnPosition: 'asc' } },
        { orderInCategory: 'asc' },
        { name: 'asc' },
      ],
    });

    return domains;
  } catch (error) {
    console.error('Error fetching domains for page management:', error);
    return [];
  }
}
