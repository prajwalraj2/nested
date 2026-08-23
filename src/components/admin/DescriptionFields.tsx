'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DESCRIPTION_MAX,
  DESCRIPTION_HINT,
  META_DESCRIPTION_HINT_MIN,
  META_DESCRIPTION_HINT_MAX,
} from '@/lib/descriptions';

/**
 * The `description` + `metaDescription` pair, for both admin forms (#38, Phase O-2).
 * ============================================================================
 *
 * ⚠️ ONE COMPONENT BECAUSE `PageForm` AND `DomainForm` BOTH NEED THE IDENTICAL PAIR. Two copies
 * would be two counters, two hint strings and two sets of thresholds — and `PageHeading` exists in
 * this codebase precisely because the same markup hand-written in six places had already drifted
 * four ways. Not repeating that for a feature that starts out with two call sites.
 *
 * ⚠️ THE TWO FIELDS ARE NOT INTERCHANGEABLE, and the copy here is the only place a content editor
 * will ever learn the difference:
 *
 *   • `description`     — rendered on the page, under the heading. Absent renders nothing.
 *   • `metaDescription` — the search-result snippet. Absent falls back to a generated one, which
 *                         is usually fine; this is for where it is not.
 *
 * The lengths differ for a real reason rather than a stylistic one: the measured median of the only
 * three author-written descriptions that existed before this feature was **36 characters**, which is
 * a good line under a heading and far too short for a search snippet.
 */

type DescriptionFieldsProps = {
  /** Prefix for `id`/`htmlFor` — "page" or "domain". Two of these can be mounted on one screen. */
  idPrefix: string;
  description: string;
  metaDescription: string;
  onDescriptionChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  /** What this description belongs to, for the help text: "page" or "domain". */
  subject?: string;
  disabled?: boolean;
};

/**
 * The character counter.
 *
 * ⚠️ COLOUR IS NOT THE ONLY SIGNAL — the count itself is always the text, so the state is readable
 * without distinguishing two similar hues. Same rule as the status badges in G-6c.
 *
 * ⚠️ `over` IS THE ONLY HARD STATE. `low` and `high` are guidance: a 20-character
 * `metaDescription` is deliberately allowed (see the asymmetry note in `lib/descriptions.ts`), so
 * flagging it amber must not look like an error.
 */
function Counter({ length, min, max }: { length: number; min?: number; max: number }) {
  const over = length > DESCRIPTION_MAX;
  const outsideGuidance = length > 0 && (length > max || (min !== undefined && length < min));

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        // ⚠️ Only two colours, not three. `outsideGuidance` deliberately does NOT get its own
        // colour — it changes the TEXT ("aim for 40–160") and nothing else, because guidance
        // rendered in a warning colour reads as an error, and a 20-character metaDescription is
        // explicitly allowed. Only exceeding the hard limit is a failure.
        over ? 'text-destructive font-medium' : 'text-muted-foreground'
      )}
    >
      {/*
        `tabular-nums` so the counter does not shift width as digits change — without it the
        number jitters horizontally on every keystroke, which is surprisingly distracting in a
        field you are actively typing into.
      */}
      {length}
      {over ? ` / ${DESCRIPTION_MAX} — too long` : outsideGuidance ? ` (aim for ${min ?? 1}–${max})` : ''}
    </span>
  );
}

export function DescriptionFields({
  idPrefix,
  description,
  metaDescription,
  onDescriptionChange,
  onMetaDescriptionChange,
  subject = 'page',
  disabled,
}: DescriptionFieldsProps) {
  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${idPrefix}-description`}>Description</Label>
          <Counter length={description.length} max={DESCRIPTION_HINT} />
        </div>
        {/*
          A single-line `Input`, not a `Textarea`, and that is a deliberate constraint rather than
          laziness: this renders as ONE line under the heading. A multi-line box invites a
          paragraph, and a paragraph in this field looks broken on the page.
        */}
        <Input
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="e.g. Curated YouTube channels for learning DevOps."
          maxLength={DESCRIPTION_MAX}
          disabled={disabled}
        />
        <p className="text-muted-foreground text-xs">
          Shown under the {subject}&rsquo;s heading. Leave it empty to show nothing. Plain text, no
          HTML.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={`${idPrefix}-meta-description`}>Search description</Label>
          <Counter
            length={metaDescription.length}
            min={META_DESCRIPTION_HINT_MIN}
            max={META_DESCRIPTION_HINT_MAX}
          />
        </div>
        {/*
          A `Textarea` here, unlike above — this one is genuinely 1–2 sentences and is never
          rendered on the page, so there is no layout to protect. Seeing the whole thing at once
          matters more than keeping it short.
        */}
        <Textarea
          id={`${idPrefix}-meta-description`}
          value={metaDescription}
          onChange={(event) => onMetaDescriptionChange(event.target.value)}
          placeholder="Optional. Leave empty to use the generated one."
          maxLength={DESCRIPTION_MAX}
          rows={2}
          disabled={disabled}
        />
        <p className="text-muted-foreground text-xs">
          {/*
            ⚠️ IT SAYS "OPTIONAL" FIRST, ON PURPOSE. There are 1,236 pages; anyone reading this as
            a field they must fill in will either burn weeks or leave the admin half-done. The
            generated fallback is good enough almost everywhere — this is for the exceptions.
          */}
          Optional. Used in Google results and link previews. Empty falls back to a generated
          description, which is usually fine. Aim for {META_DESCRIPTION_HINT_MIN}&ndash;
          {META_DESCRIPTION_HINT_MAX} characters.
        </p>
      </div>
    </div>
  );
}
