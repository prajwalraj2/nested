import type { ReactNode } from 'react';

/**
 * The title block every admin screen opens with (Phase G-2).
 * ============================================================================
 *
 * WHY THIS IS SHARED RATHER THAN COPIED
 * -------------------------------------
 * All 13 screens render a heading and a one-line description, and before this each one
 * hand-rolled it — `<h1 className="text-3xl font-bold text-gray-900 flex items-center">`
 * with an emoji, then a `<p className="text-gray-600 mt-2">`. Thirteen copies meant
 * thirteen chances for the size, weight, spacing or colour to drift, and thirteen places
 * to change when the theme arrived.
 *
 * ⚠️ This is the PAGE title, distinct from the breadcrumb in `AdminHeader`. The breadcrumb
 * answers "where am I in the hierarchy"; this answers "what is this screen". The old
 * header rendered both, which is why it duplicated every page's `<h1>` — see G-1.
 *
 * `actions` is for controls that belong to the screen as a whole (e.g. "New table"). Page
 * actions can also be passed to `AdminHeader`, which puts them in the sticky bar; use that
 * for a primary action that should stay reachable while scrolling, and this for secondary
 * ones that can scroll away with the heading.
 */
type AdminPageHeaderProps = {
  title: string;
  description?: string;
  /** Right-aligned controls, vertically centred against the title. */
  actions?: ReactNode;
};

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
      <div className="min-w-0">
        {/*
          `text-xl`, down from the original `text-3xl` (and briefly `text-2xl`).
          With the breadcrumb bar directly above naming the same screen, a large heading
          repeated information at size — and at 100% zoom the two together dominated the
          viewport before any data appeared.
        */}
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
