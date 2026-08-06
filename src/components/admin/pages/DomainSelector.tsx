'use client';

import type { DomainStatus } from '@/generated/prisma';
import { DOMAIN_STATUS_LABELS } from '@/lib/domain-status';
import { useState } from 'react';
import { Check, ChevronsUpDown, Globe, Network, Target } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Domain picker for the Pages screen (rebuilt in Phase G-4c).
 * ============================================================================
 *
 * WHY THIS BECAME A SEARCHABLE COMBOBOX
 * -------------------------------------
 * It was a hand-rolled dropdown: a `useState(isOpen)` and an absolutely-positioned div of
 * 37 buttons. Everything a real listbox does, it did not do —
 *
 *   • **No search.** 37 domains in a flat list, ordered by category then position, so
 *     finding "Videography" means scrolling and reading. This is the single biggest
 *     usability problem on the screen: it is the FIRST thing you touch on every visit.
 *   • **No Escape**, no click-outside, no focus trap. Once open it stayed open until you
 *     clicked an option — clicking anywhere else left it hanging over the page.
 *   • **Focus was never moved into the list**, and never returned to the trigger on close,
 *     so a keyboard user tabbed from the trigger straight past the open menu into the page
 *     behind it.
 *   • **No `role`/`aria-expanded`**, so assistive tech announced a button, not a picker.
 *
 * `Popover` + `Command` gives all of that for free: type-to-filter, arrow-key navigation,
 * Enter to choose, Escape to dismiss, focus returned to the trigger, and correct roles.
 * Both primitives were already vendored — **no new dependency**.
 *
 * 43 hardcoded colours → 0.
 */

type Domain = {
  id: string;
  name: string;
  slug: string;
  pageType: string;
  status: DomainStatus;
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
};

type DomainSelectorProps = {
  domains: Domain[];
  selectedDomain: Domain | null;
  onDomainChange: (domain: Domain) => void;
};

export function DomainSelector({ domains, selectedDomain, onDomainChange }: DomainSelectorProps) {
  const [open, setOpen] = useState(false);

  if (domains.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-1 py-8 text-center">
        <Globe className="size-6" aria-hidden="true" />
        <p className="text-sm font-medium">No domains available</p>
        <p className="text-xs">Create a domain first.</p>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/*
          `role="combobox"` + `aria-expanded` is what makes this announce as a picker rather
          than a plain button — the old markup had neither.

          `justify-between` and `h-auto` because the trigger holds two lines (name + slug)
          and a fixed button height would clip the second.
        */}
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto w-full justify-between px-3 py-2"
        >
          {selectedDomain ? (
            // `min-w-0` so the long domain names can truncate instead of forcing the
            // trigger wider than its container — the same flexbox rule as G-3a.
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 text-left">
                <span className="block truncate font-medium">{selectedDomain.name}</span>
                <span className="text-muted-foreground block truncate font-mono text-xs font-normal">
                  /domain/{selectedDomain.slug}
                </span>
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select a domain…</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      {/*
        `w-[--radix-popover-trigger-width]` matches the panel to the trigger, so it lines up
        with the field rather than sizing to its longest option.
        `p-0` because `Command` brings its own padding.
      */}
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          {/* The whole point of the rebuild — type to filter 37 domains. */}
          <CommandInput placeholder="Search domains…" />
          <CommandList>
            <CommandEmpty>No domain found.</CommandEmpty>
            <CommandGroup>
              {domains.map((domain) => (
                <CommandItem
                  key={domain.id}
                  /*
                    ⚠️ `value` is what `Command` FILTERS ON, not what it returns. Including
                    the slug and category name means typing "design" finds "🖌️ Graphic
                    Designing" via its name AND anything in the Design category — matching
                    how you actually remember these. Without this, only the visible label is
                    searchable, and 34 of the names start with an emoji.
                  */
                  value={`${domain.name} ${domain.slug} ${domain.category?.name ?? ''}`}
                  onSelect={() => {
                    onDomainChange(domain);
                    setOpen(false);
                  }}
                >
                  <Check
                    // Always rendered, made invisible when unselected, so every row keeps
                    // the same left edge — toggling the element itself would make the list
                    // jump horizontally as the selection moves.
                    className={cn(
                      'size-4 shrink-0',
                      selectedDomain?.id === domain.id ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{domain.name}</span>
                    <span className="text-muted-foreground block truncate font-mono text-xs">
                      /domain/{domain.slug}
                      {domain.category ? ` · ${domain.category.name}` : ''}
                    </span>
                  </span>

                  {/*
                    Page type stays visible in the list because it changes what creating a
                    page here will DO (direct nests under __main__, hierarchical does not) —
                    so it is worth knowing before you pick, not after.
                  */}
                  <Badge variant="outline" className="shrink-0 gap-1 font-normal">
                    {domain.pageType === 'direct' ? (
                      <Target className="size-3" aria-hidden="true" />
                    ) : (
                      <Network className="size-3" aria-hidden="true" />
                    )}
                    {domain.pageType === 'direct' ? 'Direct' : 'Hierarchical'}
                  </Badge>

                  {/*
                    Anything not live is the exception worth flagging; "Live" on 35 of 37 rows
                    is noise.

                    ⚠️ The badge now NAMES the state rather than always saying "Draft". With
                    three statuses, `!isPublished` was true for upcoming domains too, so an
                    upcoming domain would have been mislabelled as a draft.
                  */}
                  {domain.status !== 'PUBLISHED' && (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {DOMAIN_STATUS_LABELS[domain.status]}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
