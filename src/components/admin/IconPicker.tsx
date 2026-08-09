'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
import { ICON_MANIFEST, getIcon } from '@/lib/icon-manifest';

/**
 * Choose an icon for a domain or a page.
 * ============================================================================
 *
 * The list comes from `ICON_MANIFEST`, which is generated at build time from the contents of
 * `public/icons/` (see `scripts/generate-icon-manifest.mjs`). It therefore cannot disagree with
 * the files that actually exist — which is the whole reason it is generated rather than written
 * out by hand. Two bugs in this codebase came from hand-maintained lists: the status filter in
 * #24 silently offered two of three options, and `buildPageHierarchy` silently dropped a field
 * in #25. Neither errored.
 *
 * `Popover` + `Command` rather than a `Select`, matching `DomainSelector` and the sections
 * picker: it brings type-to-filter, arrow-key navigation, Enter to choose, Escape to dismiss and
 * correct combobox roles. With nine icons a plain select would do; the list only grows.
 *
 * ⚠️ CLEARING IS A FIRST-CLASS ACTION, not an afterthought. `null` is a meaningful value here —
 * it means "fall back to the emoji already in the name" — and that is the state of all 41
 * domains and 1,216 pages today. A picker that could only ever *set* an icon would make the
 * default state unreachable once you had left it.
 */

type IconPickerProps = {
  /** The current icon id, or null for "no icon — use the emoji in the name". */
  value: string | null;
  onChange: (iconId: string | null) => void;
  /** Ties the trigger to its `<Label>`. */
  id?: string;
  disabled?: boolean;
};

export function IconPicker({ value, onChange, id, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = getIcon(value);

  /*
    ⚠️ An id that is set but unknown is shown, not hidden.

    This happens if an SVG is deleted from `public/icons/` while rows still reference it. Falling
    back to "Select an icon…" would look identical to "no icon", so the row would appear
    unconfigured and the broken reference would sit there indefinitely. Naming the missing id is
    what makes it fixable.
  */
  const isMissing = Boolean(value) && !selected;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-auto min-w-0 flex-1 justify-between px-3 py-2"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                {/*
                  A plain <img>, deliberately not `next/image`. That component exists to resize
                  and re-encode raster images; an SVG has no pixels to resize, so it would add a
                  transform step for no gain. Explicit width/height is what prevents layout
                  shift, and this has it.
                */}
                <img
                  src={selected.url}
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 shrink-0"
                />
                <span className="truncate">{selected.label}</span>
              </span>
            ) : isMissing ? (
              <span className="text-destructive truncate">Missing icon: {value}</span>
            ) : (
              <span className="text-muted-foreground">No icon — use the emoji</span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search icons…" />
            <CommandList>
              {/*
                Names the folder, because the fix is to put a file in it — not to look for a
                setting in the admin panel. This is the empty state a fresh clone sees.
              */}
              <CommandEmpty>
                No icon found. Add an SVG to <code>public/icons/</code>.
              </CommandEmpty>
              <CommandGroup>
                {ICON_MANIFEST.map((icon) => (
                  <CommandItem
                    key={icon.id}
                    // Search matches the id as well as the label, so typing "chrome" finds
                    // "Google Chrome Extension" and typing the filename works too.
                    value={`${icon.label} ${icon.id}`}
                    onSelect={() => {
                      onChange(icon.id);
                      setOpen(false);
                    }}
                  >
                    {/*
                      Always rendered and toggled with opacity so every row keeps the same left
                      edge — mounting it conditionally makes the list shift sideways as the
                      selection moves.
                    */}
                    <Check
                      className={
                        'size-4 shrink-0 ' + (value === icon.id ? 'opacity-100' : 'opacity-0')
                      }
                      aria-hidden="true"
                    />
                    <img
                      src={icon.url}
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate">{icon.label}</span>
                    {/*
                      File size, shown because the 10 KB build limit is easy to forget and this
                      is where you would notice something anomalous before it is committed.
                    */}
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {(icon.bytes / 1024).toFixed(1)} KB
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Only rendered when there is something to clear, so it is never a dead control. */}
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Remove the icon and use the emoji instead"
          title="Remove icon"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
