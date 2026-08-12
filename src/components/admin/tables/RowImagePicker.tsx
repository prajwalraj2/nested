// src/components/admin/tables/RowImagePicker.tsx

'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, ImageOff, X } from 'lucide-react';

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

/**
 * Choose an image for one row (K-5c).
 * ============================================================================
 *
 * Deliberately the same shape as `IconPicker` from Phase J — a `Popover` + `Command`
 * combobox with a clear button — because an admin meets both and two different pickers for
 * "choose a picture" would be one too many to learn.
 *
 * ⚠️ IT WRITES A KEY, NOT A URL. The row stores `TableImage.key`; the public renderer
 * resolves it server-side. That indirection is what lets one image serve 40 rows and what
 * makes changing storage provider a one-column rewrite (see the `TableImage` model).
 *
 * ⚠️ CLEARING IS A FIRST-CLASS ACTION. `null` means "this row has no picture", which is the
 * state of every row until someone chooses one. A picker that could only ever *set* an image
 * would make the default unreachable once left — the same trap `IconPicker` had to avoid.
 */

type TableImageOption = {
  id: string;
  key: string;
  url: string;
};

type RowImagePickerProps = {
  /** Current key, or empty when the row has no image. */
  value: string;
  onChange: (key: string) => void;
  id?: string;
};

export function RowImagePicker({ value, onChange, id }: RowImagePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [images, setImages] = React.useState<TableImageOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  /**
   * ⚠️ FETCHED WHEN THERE IS A VALUE TO RESOLVE, OR WHEN THE PICKER OPENS.
   *
   * The first version fetched **only** on open, to avoid loading the whole library for a
   * field most rows never touch. That was right for empty rows and wrong for filled ones: a
   * row that already has a key needs the URL to render at all, so the trigger showed
   * "Missing: thefutur" in red on every single open — about images that were perfectly fine.
   *
   * ⚠️ **A warning that fires when nothing is wrong stops being read.** The missing-key state
   * exists because J-2 established that a dangling reference must name itself or it sits
   * there indefinitely; making it appear routinely would have destroyed exactly the signal it
   * was built to carry.
   *
   * So: a row WITH an image fetches immediately, because the URL is the field's content. A
   * row WITHOUT one still waits for the popover, which keeps the original saving for the
   * common case.
   */
  React.useEffect(() => {
    if ((!open && !value) || loaded) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/admin/table-images', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setImages(body.images ?? []);
        setLoaded(true);
      })
      .catch(() => {
        // Silent: the trigger still shows the current key, and the field remains editable
        // through the table's JSON. An error toast here would interrupt row editing for a
        // list that is only an aid.
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, value, loaded]);

  const selected = images.find((img) => img.key === value);

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
            className="h-9 flex-1 justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.url}
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 shrink-0 rounded-[3px] object-contain"
                  />
                  <span className="truncate font-mono text-xs">{selected.key}</span>
                </>
              ) : value && !loaded ? (
                /*
                  ⚠️ NOT YET LOOKED UP — show the key plainly, never the alarm.

                  "Missing" must mean "this key does not exist", not "I have not checked".
                  Conflating the two made the red state appear on every open.
                */
                <span className="truncate font-mono text-xs text-muted-foreground">{value}</span>
              ) : value ? (
                /*
                  ⚠️ A key that is SET but genuinely unknown is shown, not hidden.

                  If an image is deleted while rows still reference it, falling back to
                  "No image" would look identical to a row that never had one, and the broken
                  reference would sit there indefinitely. Naming it is how it gets fixed —
                  the same reasoning as `IconPicker`'s missing-icon state in J-2.
                */
                <span className="flex items-center gap-2 text-destructive">
                  <ImageOff className="h-4 w-4 shrink-0" />
                  <span className="truncate font-mono text-xs">Missing: {value}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">No image</span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[18rem] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search images…" className="h-9" />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Loading…' : 'No images. Upload some under System → Images.'}
              </CommandEmpty>
              <CommandGroup>
                {images.map((img) => (
                  <CommandItem
                    key={img.id}
                    // `value` is what Command searches on, so it must be the key rather than
                    // the id — nobody searches for a uuid.
                    value={img.key}
                    onSelect={() => {
                      onChange(img.key);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 shrink-0 ${value === img.key ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt=""
                      width={20}
                      height={20}
                      className="mr-2 h-5 w-5 shrink-0 rounded-[3px] object-contain"
                    />
                    <span className="truncate font-mono text-xs">{img.key}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onChange('')}
          aria-label="Remove this row's image"
          title="Remove image"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
