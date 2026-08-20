// src/app/(site)/blogs/page.tsx

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { PageIntro, SitePage } from '@/components/site/Prose';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { POSTS_PER_PAGE, blogCategoryLabel, publishedFilter, readingMinutes } from '@/lib/blog-types';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/blogs` (M-9) — the listing.
 *
 * ⚠️ SERVER-RENDERED IN FULL, like the roadmap and unlike the tables of finding #30. A blog that
 * needs JavaScript to show its text is a blog that does not rank, and ranking is most of why a
 * blog exists on a site like this.
 *
 * ⚠️ `publishedFilter()` IS THE ONLY CORRECT `where` HERE. It excludes drafts (`null`) AND future
 * dates. `{ not: null }` alone would publish every scheduled post the instant it was saved.
 */

export const dynamic = 'force-dynamic';

const TITLE = 'Blog';
const DESCRIPTION = 'Guides, tool notes and occasional writing from the people building ATNO.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blogs' },
  openGraph: buildOpenGraph({ title: TITLE, description: DESCRIPTION, url: '/blogs' }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

export default async function BlogListingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  /*
    ⚠️ CLAMPED, not trusted. `?page=-5` would produce a negative `skip` and throw; `?page=abc`
    gives NaN. One expression handles both and the worst a crafted value can do is show page one.
  */
  const current = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);

  const where = publishedFilter();

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (current - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        coverAlt: true,
        author: true,
        category: true,
        publishedAt: true,
        plainText: true,
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  return (
    <SitePage>
      <PageIntro
        eyebrow="Blog"
        title="Writing"
        lede="Notes on the tools we list, how we choose them, and what goes into keeping a directory honest."
      />

      {posts.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nothing published yet.</p>
          <p className="text-muted-foreground mt-2 text-sm">
            The first posts are being written. This page is where they will appear.
          </p>
        </div>
      ) : (
        /*
          ⚠️ A DIVIDED LIST, NOT `space-y-8`. With the thumbnail beside the text each row is now a
          fixed-height band rather than a tall block, so gaps alone stop separating them — several
          short posts run together into one grey column. A rule per row is what the feed layouts
          this borrows from all use, and it is why the vertical padding moved onto the `<li>`.
        */
        <ul className="divide-border divide-y">
          {posts.map((post) => (
            <li key={post.id} className="py-6 first:pt-0">
              {/*
                ⚠️ THE IMAGE IS FIRST IN THE DOM BECAUSE IT IS ON THE LEFT. Ordering it visually
                with `order-*` instead would put the cover ahead of the headline for a screen reader
                and for anything reading the markup — a decorative thumbnail announced before the
                title it belongs to. Source order and visual order agree here, so neither needs a
                workaround.
              */}
              <article className="flex gap-4 sm:gap-5">
                {post.coverUrl && (
                  <Link href={`/blogs/${post.slug}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
                    {/*
                      ⚠️ `aspect-[1200/630]` MATCHES THE `blog-cover` PRESET EXACTLY, so the
                      thumbnail is a clean downscale rather than a second crop of an already-cropped
                      image — no faces sliced off that survived the first pass.

                      ⚠️ `sizes` IS NOT OPTIONAL HERE. Without it `next/image` assumes the image
                      fills the viewport and serves something around 1200px wide for a slot that is
                      112px on a phone — roughly ten times the bytes needed, on the connection least
                      able to afford them. The three values below are the rendered widths of the
                      three breakpoints on this row.
                    */}
                    <Image
                      src={post.coverUrl}
                      alt=""
                      width={1200}
                      height={630}
                      sizes="(min-width: 768px) 192px, (min-width: 640px) 160px, 112px"
                      className="border-border aspect-[1200/630] w-28 rounded-md border object-cover sm:w-40 md:w-48"
                    />
                  </Link>
                )}

                {/*
                  ⚠️ `min-w-0` IS LOAD-BEARING, AGAIN. A flex item defaults to `min-width: auto` and
                  refuses to shrink below its content — a long unbroken title would push the row
                  wider than the page instead of wrapping. Same rule as the table layout and the
                  header's truncating domain names.
                */}
                <div className="min-w-0 flex-1">
                  <Link href={`/blogs/${post.slug}`} className="group block">
                    <h2 className="group-hover:text-foreground/80 text-lg font-semibold break-words transition-colors sm:text-xl">
                      {post.title}
                    </h2>

                    {post.excerpt && (
                      /*
                        ⚠️ `line-clamp-2` so a long excerpt cannot make one row three times the
                        height of its neighbours. The full text is still on the post itself, and an
                        excerpt is a teaser rather than content being withheld.
                      */
                      <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm break-words">
                        {post.excerpt}
                      </p>
                    )}
                  </Link>

                  <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {post.category && (
                      <span className="bg-muted rounded px-1.5 py-0.5 font-medium">
                        {blogCategoryLabel(post.category)}
                      </span>
                    )}
                    <span>{post.author}</span>
                    {/*
                      ⚠️ `publishedAt` IS NEVER NULL HERE — `publishedFilter()` excluded those — but
                      TypeScript cannot know that from the query, hence the guard rather than a `!`.
                    */}
                    {post.publishedAt && (
                      <time dateTime={post.publishedAt.toISOString()}>
                        {post.publishedAt.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </time>
                    )}
                    <span>{readingMinutes(post.plainText)} min read</span>
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {/*
        ⚠️ REAL LINKS, NOT BUTTONS WITH `onClick`. Pagination that only works with JavaScript is
        pagination a crawler cannot follow — every post past the first ten would be unreachable,
        which defeats the reason this page is server-rendered at all.
      */}
      {totalPages > 1 && (
        <nav className="border-border mt-10 flex items-center justify-between border-t pt-6">
          {current > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={current === 2 ? '/blogs' : `/blogs?page=${current - 1}`}>Newer</Link>
            </Button>
          ) : (
            <span />
          )}

          <span className="text-muted-foreground text-xs">
            Page {current} of {totalPages}
          </span>

          {current < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/blogs?page=${current + 1}`}>Older</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </SitePage>
  );
}
