// src/components/site/Prose.tsx

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Typography for the hand-written static pages (M-3).
 * ============================================================================
 *
 * ⚠️ NOT `prose` FROM TAILWIND TYPOGRAPHY — THAT PLUGIN IS NOT INSTALLED.
 *
 * `@tailwindcss/typography` is absent from `node_modules` and there is no `@plugin` line in
 * `globals.css`, so every `prose` class already scattered through this codebase does exactly
 * nothing (see the note in `RichTextLayout.tsx`). Adding the plugin now to style four pages would
 * pull a stylesheet into every route to solve a problem four files have.
 *
 * These are arbitrary-variant selectors instead: explicit, scoped to this wrapper, and using
 * theme tokens so both modes work without a `.dark` branch.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-foreground/90 text-[15px] leading-relaxed',
        '[&>*:first-child]:mt-0',
        // Section headings — the same small uppercase label the roadmap Sheet uses, so the two
        // hand-written surfaces of the site read as one thing.
        '[&_h2]:text-muted-foreground [&_h2]:border-border [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:tracking-[0.08em] [&_h2]:uppercase',
        '[&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold',
        '[&_p]:mb-4 [&_p]:max-w-[68ch]',
        '[&_ul]:mb-4 [&_ul]:max-w-[68ch] [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:mb-4 [&_ol]:max-w-[68ch] [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:mb-1.5',
        '[&_li]:marker:text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold',
        '[&_code]:bg-muted [&_code]:border-border [&_code]:rounded [&_code]:border [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]',
        className
      )}
    >
      {children}
    </div>
  );
}

/** The heading block every static page opens with. */
export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div className="border-border mb-10 border-b pb-8">
      {eyebrow && (
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.1em] uppercase">
          {eyebrow}
        </p>
      )}
      {/* `text-balance` stops a two-word orphan on the second line at narrow widths. */}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {lede && <p className="text-muted-foreground mt-3 max-w-[60ch] text-lg">{lede}</p>}
    </div>
  );
}

/** Shared page frame — one place to change the measure of every static page. */
export function SitePage({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl px-6 py-14">{children}</div>;
}
