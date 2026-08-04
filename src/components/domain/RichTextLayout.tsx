// components/domain/RichTextLayout.tsx

import { PageHeading } from './PageHeading';

type Domain = {
  id: string;
  name: string;
  slug: string;
};

type RichTextContent = {
  id: string;
  htmlContent: string;
  title: string | null;
  wordCount: number;
  updatedAt: Date;
};

type Page = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  richTextContent?: RichTextContent | null;
};

type RichTextLayoutProps = {
  page: Page;
  domain: Domain;
};

export function RichTextLayout({ page, domain }: RichTextLayoutProps) {
  const hasContent = page.richTextContent?.htmlContent;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <PageHeading title={page.title} spacing="loose" />

        {/*
          ⚠️ THIS CARD STAYS LIGHT IN DARK MODE, DELIBERATELY. DO NOT "FIX" IT TO A TOKEN.
          ==========================================================================
          `bg-neutral-100` and `text-neutral-900` are fixed values on purpose — they are
          the one place in the public site that must NOT follow the theme.

          WHY: the stored HTML has colours baked into inline `style` attributes. Measured
          across all 415 rich-text rows: 395 of them carry inline text colours, 2,519
          declarations in total, of which **574 are dark colours** — 384 of those pure
          black (`#000000` ×216, `rgb(0,0,0)` ×168) plus `#292727` ×168 and `#1a1a1a` ×10.

          An inline style beats any stylesheet rule on specificity. So on a dark surface
          those 574 declarations would render near-black text on a near-black background
          and simply disappear. No CSS we can write in `globals.css` overrides them, short
          of `!important` — which would then also flatten the 168 deliberate
          `rgb(255,255,255)` white-text declarations that pair with the 57 rows carrying
          inline BACKGROUND colours, turning those white-on-colour.

          So the page chrome themes and this content card does not: a light "island" of
          author-styled content inside a dark page. That keeps every one of those 2,519
          author colours reading exactly as intended, costs nothing, and destroys no data.

          The alternative — a migration stripping inline colours from 395 rows so the
          content becomes themeable — is recorded as option C under finding #21.4. It is
          irreversible, so it is a product decision, not a styling one.

          `text-neutral-900` is set explicitly rather than relying on inheritance: without
          it, any text WITHOUT an inline colour would inherit `--foreground`, which is
          near-white in dark mode — invisible on this light card. That is the same bug in
          the opposite direction.
        */}
        <div className="border border-border rounded-lg p-8 bg-neutral-100 text-neutral-900">
          {hasContent ? (
            /*
              `dark:prose-invert` was removed. It flips prose's typography colours for a
              dark background — correct on a dark surface, wrong here, because this card
              is now permanently light. Leaving it would have inverted the heading, list
              and blockquote colours to near-white on a light card.
            */
            <div className="prose prose-neutral max-w-none">
              <div
                className="rich-text-content [&>div]:space-y-4"
                dangerouslySetInnerHTML={{
                  __html: page.richTextContent!.htmlContent
                }}
              />
            </div>
          ) : (
            /*
              Empty state.

              ⚠️ Fixed neutrals, NOT `text-foreground` / `text-muted-foreground` — which is
              what this used before. Those tokens resolve to near-white in dark mode, and
              this block sits inside the permanently-light card above, so the heading and
              body text would have been white-on-light and effectively invisible. Exactly
              the trap described in the comment on the card.
            */
            <div className="py-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-3">
                Data Coming Soon
              </h2>
              <p className="text-neutral-600 max-w-md mx-auto">
                We are working on getting the right data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
