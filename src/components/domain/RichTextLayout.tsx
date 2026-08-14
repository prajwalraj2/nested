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
  /** Icon id from public/icons/, shown beside the heading. */
  icon?: string | null;
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
        <PageHeading title={page.title} icon={page.icon} spacing="loose" />

        {/*
          ⚠️ THIS CARD STAYS LIGHT IN DARK MODE, DELIBERATELY. DO NOT "FIX" IT TO A TOKEN.
          ==========================================================================
          `bg-neutral-100` and `text-neutral-900` are fixed values on purpose — they are
          the one place in the public site that must NOT follow the theme.

          WHY: the stored HTML has colours baked into inline `style` attributes, and an
          inline style beats any stylesheet rule on specificity. On a dark surface a dark
          `color:` renders near-black text on a near-black background and simply
          disappears. No CSS in `globals.css` overrides that, short of `!important` — which
          would then also flatten the 168 deliberate `rgb(255,255,255)` white-text
          declarations that pair with the rows carrying inline BACKGROUND colours, turning
          those white-on-white.

          ⚠️ THE NUMBER THAT USED TO BE QUOTED HERE WAS WRONG — corrected 14 Aug 2026, see
          NEW-IMPROVEMENTS-2.md #34. It claimed "395 of 415 rows carry inline text colours,
          2,519 declarations". Re-measured with the three colour families counted
          separately:

              color:              58 of 415 rows (14%)   568 declarations, 396 dark
              background-color:   37 of 415 rows  (9%)   532 declarations
              border-color:      393 of 415 rows (95%) 1,411 declarations

          The old figure had summed all three and called the total text colour — 393
          border-colour rows became "395 rows", and 568+532+1,411 = 2,511 became "2,519
          declarations". Only `color:` can make text vanish; `background-color` paints its
          own ground, and the 393 `border-color: #dcdada` rules on <hr> elements merely look
          pale on dark.

          ⚠️ THIS CARD STILL STAYS LIGHT, because those 58 rows are real and would break.
          What changed is the COST of fixing it: 58 rows to clean rather than 395, and four
          find-and-replaces cover all but 4 of the 568 declarations. That is a decision for
          #21.4 / #34, not something to change here.

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
