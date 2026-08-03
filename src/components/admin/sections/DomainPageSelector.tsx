// src/components/admin/sections/DomainPageSelector.tsx

'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  LayoutPanelTop,
  Network,
  Target,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Domain and page picker for the Section Layout screen.
 * ============================================================================
 *
 * Pick a domain, then one of its section-based pages.
 *
 * ⚠️ REBUILT ON SHADCN AT THE USER'S REQUEST (after G-6c).
 * ==========================================================================
 * G-6c converted this file's colours but left the two controls as native `<select>`s. The
 * result themed correctly and was still awkward to use: **31 domains in an unsearchable list**,
 * every option prefixed with an emoji, and no way to filter. The user asked why it did not have
 * the searchable picker the Pages and Tables screens already had — a fair question, since the
 * pattern existed and this file simply had not been given it.
 *
 * `Popover` + `Command` brings type-to-filter, arrow-key navigation, Enter to choose, Escape to
 * dismiss, focus returned to the trigger, and proper combobox roles. A styled `<select>` can
 * offer none of that.
 *
 * ⚠️ This file previously had **no imports at all** — it was hand-rolled markup using nothing
 * from the design system. That was the hint worth noticing.
 *
 * ⚠️ This is the SECOND `DomainPageSelector`; `admin/tables/DomainPageSelector.tsx` is a
 * separate file with a different prop contract. They are not shared — see the correction note
 * in NEW-IMPROVEMENTS.md. Consolidating them is still an open question.
 */

// Type definitions
type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  pages: SectionablePage[];
};

type SectionablePage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  sections?: any;
  subPages: ChildPage[];
  _count: {
    subPages: number;
  };
};

type ChildPage = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
};

type DomainPageSelectorProps = {
  domains: Domain[];
  selectedDomain: Domain | null;
  selectedPage: SectionablePage | null;
  onDomainChange: (domain: Domain | null) => void;
  onPageChange: (page: SectionablePage | null) => void;
};

export function DomainPageSelector({
  domains,
  selectedDomain,
  selectedPage,
  onDomainChange,
  onPageChange,
}: DomainPageSelectorProps) {
  const [domainOpen, setDomainOpen] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);

  // Only domains that actually hold a section-based page are worth offering.
  const availableDomains = domains.filter((domain) => domain.pages.length > 0);
  const availablePages = selectedDomain?.pages || [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Choose a page to configure</h3>
        <p className="text-muted-foreground text-sm">
          Pick a domain, then one of its section-based pages.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Domain ── */}
        <div className="space-y-1.5">
          <Label htmlFor="section-domain">Domain</Label>
          <Popover open={domainOpen} onOpenChange={setDomainOpen}>
            <PopoverTrigger asChild>
              {/* `h-auto` because the trigger holds two lines; a fixed button height clips it. */}
              <Button
                id="section-domain"
                variant="outline"
                role="combobox"
                aria-expanded={domainOpen}
                className="h-auto w-full justify-between px-3 py-2"
              >
                {selectedDomain ? (
                  // `min-w-0` so long names truncate rather than widening the trigger.
                  <span className="flex min-w-0 items-center gap-2">
                    <DomainTypeIcon pageType={selectedDomain.pageType} />
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-medium">{selectedDomain.name}</span>
                      <span className="text-muted-foreground block truncate font-mono text-xs font-normal">
                        /domain/{selectedDomain.slug} · {selectedDomain.pageType}
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select a domain…</span>
                )}
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search domains…" />
                <CommandList>
                  <CommandEmpty>No domain found.</CommandEmpty>
                  <CommandGroup>
                    {availableDomains.map((domain) => (
                      <CommandItem
                        key={domain.id}
                        /*
                          ⚠️ Searches the SLUG and TYPE as well as the name. Most domain names
                          begin with an emoji ("🌐 Web Development"), so matching only the
                          visible label is close to useless — the same reasoning as the Tables
                          and Pages pickers.
                        */
                        value={`${domain.name} ${domain.slug} ${domain.pageType}`}
                        onSelect={() => {
                          onDomainChange(domain);
                          setDomainOpen(false);
                        }}
                      >
                        {/*
                          Always rendered and toggled with opacity, so every row keeps the same
                          left edge — mounting it conditionally makes the list shift sideways as
                          the selection moves.
                        */}
                        <Check
                          className={
                            'size-4 shrink-0 ' +
                            (selectedDomain?.id === domain.id ? 'opacity-100' : 'opacity-0')
                          }
                          aria-hidden="true"
                        />
                        <DomainTypeIcon pageType={domain.pageType} />
                        <span className="min-w-0 flex-1 truncate">{domain.name}</span>
                        {/* How many section-based pages this domain has. */}
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {domain.pages.length}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Page ── */}
        <div className="space-y-1.5">
          <Label htmlFor="section-page">Section-based page</Label>
          <Popover open={pageOpen} onOpenChange={setPageOpen}>
            <PopoverTrigger asChild>
              <Button
                id="section-page"
                variant="outline"
                role="combobox"
                aria-expanded={pageOpen}
                /*
                  Disabled until a domain is chosen — the list would be empty anyway, and the
                  placeholder says which step is missing rather than leaving you to guess.
                */
                disabled={!selectedDomain}
                className="h-auto w-full justify-between px-3 py-2"
              >
                {selectedPage ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <LayoutPanelTop
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-medium">{selectedPage.title}</span>
                      <span className="text-muted-foreground block truncate font-mono text-xs font-normal">
                        /{selectedPage.slug} · {selectedPage._count.subPages} child pages
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {selectedDomain ? 'Select a page…' : 'Choose a domain first'}
                  </span>
                )}
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search pages…" />
                <CommandList>
                  <CommandEmpty>No page found.</CommandEmpty>
                  <CommandGroup>
                    {availablePages.map((page) => {
                      const sectionCount = Array.isArray(page.sections)
                        ? page.sections.length
                        : 0;

                      return (
                        <CommandItem
                          key={page.id}
                          value={`${page.title} ${page.slug}`}
                          onSelect={() => {
                            onPageChange(page);
                            setPageOpen(false);
                          }}
                        >
                          <Check
                            className={
                              'size-4 shrink-0 ' +
                              (selectedPage?.id === page.id ? 'opacity-100' : 'opacity-0')
                            }
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{page.title}</span>
                            <span className="text-muted-foreground block truncate font-mono text-xs">
                              /{page.slug} · {page._count.subPages} children
                            </span>
                          </span>
                          {/*
                            Whether a page is already configured, shown BEFORE you pick it —
                            previously you had to select one to find out. `secondary` vs
                            `outline` carries the state without relying on colour.
                          */}
                          <Badge
                            variant={sectionCount > 0 ? 'secondary' : 'outline'}
                            className="shrink-0 font-normal"
                          >
                            {sectionCount > 0 ? `${sectionCount} sections` : 'unconfigured'}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/*
        Clear buttons — were two hand-rolled `<button>`s with their own hover classes. Rendered
        only when there is something to clear, so they are never dead controls.
      */}
      {(selectedDomain || selectedPage) && (
        <div className="flex gap-2">
          {selectedPage && (
            <Button variant="ghost" size="sm" onClick={() => onPageChange(null)}>
              <X className="size-4" aria-hidden="true" />
              Clear page
            </Button>
          )}
          {selectedDomain && (
            <Button variant="ghost" size="sm" onClick={() => onDomainChange(null)}>
              <X className="size-4" aria-hidden="true" />
              Clear domain
            </Button>
          )}
        </div>
      )}

      {availableDomains.length === 0 && (
        <Alert>
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            <span className="font-medium">No section-based pages found.</span> Create a page with
            the &ldquo;Section based&rdquo; content type under Pages first.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * The domain's page-type as an icon.
 *
 * ⚠️ Replaces `getDomainIcon()`, which returned an **emoji string** (🎯 for direct, 📁 for
 * hierarchical). Emoji cannot inherit `currentColor`, so they ignored the theme entirely, and
 * they render at a different size and baseline on every platform.
 *
 * These are the same two icons the Domains table (G-3b) and the Pages screen (G-4c) use for
 * direct vs hierarchical, so the distinction now looks identical everywhere in the admin.
 */
function DomainTypeIcon({ pageType }: { pageType: string }) {
  const Icon = pageType === 'direct' ? Target : Network;
  return <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />;
}
