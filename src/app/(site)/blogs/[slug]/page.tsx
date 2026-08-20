// src/app/(site)/blogs/[slug]/page.tsx

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { SitePage } from '@/components/site/Prose';
import { JsonLd } from '@/components/JsonLd';
import { prisma } from '@/lib/prisma';
import { blogCategoryLabel, publishedFilter, readingMinutes } from '@/lib/blog-types';
import { buildArticleJsonLd } from '@/lib/structured-data';
import { buildOpenGraph, buildTwitter } from '@/lib/seo';

/**
 * `/blogs/[slug]` (M-9) — one post.
 *
 * ⚠️ A DRAFT OR SCHEDULED POST **404s**, it does not 403 and does not redirect. A 403 confirms the
 * URL exists, which turns a guessed slug into a way to learn what is being written. `notFound()`
 * makes an unpublished post indistinguishable from one that was never created.
 *
 * ⚠️ THE SAME `publishedFilter()` GUARDS THE PAGE, ITS METADATA AND THE SITEMAP. Three reads of
 * the same rule; one shared helper, so a draft cannot leak through whichever one was forgotten.
 */

export const dynamic = 'force-dynamic';

async function getPublishedPost(slug: string) {
  return prisma.blogPost.findFirst({ where: { slug, ...publishedFilter() } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: 'Post not found' };

  /*
    ⚠️ THE EXCERPT IS THE DESCRIPTION WHEN SET, otherwise a trimmed slice of the stripped body.
    Falling back to nothing would leave search results and social cards to invent their own
    summary from whatever text happens to come first, which is usually a heading.
  */
  const description =
    post.excerpt ?? (post.plainText ? `${post.plainText.slice(0, 155).trim()}…` : undefined);

  return {
    title: post.title,
    description,
    alternates: { canonical: `/blogs/${post.slug}` },
    openGraph: {
      ...buildOpenGraph({
        title: post.title,
        description: description ?? post.title,
        url: `/blogs/${post.slug}`,
      }),
      /*
        ⚠️ `article`, NOT the site-wide `website` type, and the cover replaces the default card.
        The preset produces exactly 1200x630, which is the ratio every platform crops toward — see
        `PRESETS` in `image-processing.ts` for why it is a JPEG rather than a WebP.
      */
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      ...(post.coverUrl
        ? { images: [{ url: post.coverUrl, width: 1200, height: 630, alt: post.coverAlt ?? post.title }] }
        : {}),
    },
    twitter: buildTwitter({ title: post.title, description: description ?? post.title }),
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  return (
    <SitePage>
      {/*
        `BlogPosting` structured data, emitted only on a post's own page — never on the listing,
        which is a collection rather than an article. See `buildArticleJsonLd`.

        `publishedAt` cannot be null here: `publishedFilter()` excluded those. The `??` satisfies
        TypeScript, which cannot infer that from the query shape.
      */}
      <JsonLd
        data={buildArticleJsonLd({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          coverUrl: post.coverUrl,
          author: post.author,
          publishedAt: post.publishedAt ?? post.updatedAt,
          updatedAt: post.updatedAt,
        })}
      />

      <Link
        href="/blogs"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All posts
      </Link>

      <article>
        <h1 className="text-3xl font-bold break-words sm:text-4xl">{post.title}</h1>

        <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {post.category && (
            <span className="bg-muted rounded px-1.5 py-0.5 text-xs font-medium">
              {blogCategoryLabel(post.category)}
            </span>
          )}
          <span>{post.author}</span>
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

        {post.coverUrl && (
          <Image
            src={post.coverUrl}
            alt={post.coverAlt ?? ''}
            width={1200}
            height={630}
            priority
            className="border-border mt-6 w-full rounded-lg border object-cover"
          />
        )}

        {/*
          ⚠️ `rich-text-content`, AND DELIBERATELY NO `prose` WRAPPER.

          `RichTextLayout` wraps its body in `prose prose-neutral` — which does NOTHING on this
          site, because `@tailwindcss/typography` is not installed. Copying that here would look
          like styling and be inert. `.rich-text-content` in `globals.css` is what actually styles
          this HTML, and using it means posts inherit the same headings, lists, links and dark-mode
          colour rules that #34 and the rich-text guide established — for free, and consistently.

          ⚠️ NOT SANITISED (#35). This body is admin-authored, exactly like rich text and roadmap
          sheets, and `ROADMAP-CONTENT-GUIDE.md` §3 and §8 apply to it verbatim — in particular the
          rule about never writing a hard-coded colour, which would be invisible in one theme.
        */}
        <div
          className="rich-text-content mt-8 [&>div]:space-y-4"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 && (
          <div className="border-border mt-10 flex flex-wrap gap-2 border-t pt-6">
            {post.tags.map((tag) => (
              /*
                ⚠️ TEXT, NOT LINKS. There is no tag archive route, and a link to a page that does
                not exist is worse than a label. If `/blogs?tag=` ever lands, these become links.
              */
              <span
                key={tag}
                className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </SitePage>
  );
}
