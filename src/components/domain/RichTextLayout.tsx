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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <PageHeading title={page.title} icon={page.icon} spacing="loose" />

        {/*
          THIS CARD FOLLOWS THE THEME.
          ==========================================================================
          It was pinned light with a fixed neutral background and text colour until
          15 Aug 2026; both were removed and the page now themes end to end. See
          SANITISER-REMOVAL.md step 0 for what changed and what was checked.

          ⚠️ WHY IT WAS PINNED — AND WHY THAT REASON WAS MOSTLY WRONG (#34)
          ==========================================================================
          An inline `style` beats any stylesheet rule on specificity, so a dark inline
          `color:` on a dark ground renders near-black on near-black and disappears. That
          much is true. The pinning rested on a measurement claiming "395 of 415 rows carry
          inline text colours, 2,519 declarations" — but that figure had summed THREE
          different colour families and called the total text colour. Re-measured, counting
          each separately:

              color:              58 of 415 rows (14%)   568 declarations
              background-color:   37 of 415 rows  (9%)   532 declarations
              border-color:      393 of 415 rows (95%) 1,411 declarations   <- the "395"

          Only `color:` can make text vanish. `background-color` paints its own ground, so
          it stays self-consistent either way, and the near-universal `border-color` on
          <hr> elements merely looks pale on dark.

          ⚠️ THE RESIDUAL RISK IS REAL, SMALL, AND NAMED
          ==========================================================================
          Filtering to colours genuinely too dark to read on the themed ground leaves
          **26 pages of 416** — and they are only TWO documents duplicated across domains:

              /domain/<many>/coldemailing    "Cold Emailing"    rgb(0, 0, 0) x12   14 pages
              /domain/<many>/facebookgroups  "Facebook Groups"  #000000      x4    12 pages

          390 pages carry no dark text colour and were never at risk here. The two documents
          are being cleared by hand — one find-and-replace each, not a migration.

          ⚠️ `#767c7c` (x180) sits just above that cut and is NOT among the 26. It lands
          near 4.4:1 on the dark ground: passes AA for large text, borderline for body.
        */}
        <div className="border border-border rounded-lg p-8">
          {hasContent ? (
            /*
              ⚠️ `prose prose-neutral` DOES NOTHING HERE. `@tailwindcss/typography` is not
              installed — it is absent from `node_modules`, and `globals.css` has no
              `@plugin` line for it. That is why dropping `dark:prose-invert` alongside the
              theme change produced no visible difference: none of these classes were ever
              active.

              Kept because they are harmless and they record the intent, but do NOT reason
              about typography from them — every type size and margin you see comes from the
              inline styles inside the stored HTML.
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
              Empty state. Both lines inherit `--foreground` now, which is correct in either
              theme. They carried fixed neutral colours only because this block used to sit
              inside a permanently-light card — on a themed card those pins are what would
              break it, which is the same trap in the opposite direction.

              ⚠️ The paragraph is a candidate for `text-muted-foreground` rather than plain
              inheritance — it is secondary text and currently renders at the same weight as
              the heading's colour. That is a design call, not a bug: the token is redefined
              per theme, so either choice is legible in both.
            */
            <div className="py-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-xl font-semibold mb-3">
                Data Coming Soon
              </h2>
              <p className="max-w-md mx-auto">
                We are working on getting the right data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
