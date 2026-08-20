// src/app/api/admin/blogs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { htmlToPlainText } from '@/lib/html-text';
import { BLOG_CATEGORY_VALUES, isSupportedCoverUrl } from '@/lib/blog-types';

/** `GET` and `POST /api/admin/blogs` (M-9). */

/**
 * ⚠️ SHARED BY CREATE AND UPDATE so a field cannot be validated one way on the way in and another
 * on the way back. `[id]/route.ts` imports nothing from here — it re-declares its own `.partial()`
 * version, because a route file may only export handlers; this shape is duplicated there rather
 * than exported, which is the one place that constraint costs something.
 */
const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /*
    ⚠️ THE SLUG IS VALIDATED, NOT GENERATED, HERE. `slugifyTitle` runs in the admin form as a
    suggestion; the server accepts whatever was typed as long as it is URL-safe. Regenerating it
    server-side would silently rewrite a slug an editor had deliberately chosen — and a changed URL
    on an existing post is a broken link and a lost ranking.
  */
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.'),
  excerpt: z.string().trim().max(320).nullable().optional(),
  coverUrl: z
    .string()
    .trim()
    .url()
    .max(2000)
    /*
      ⚠️ RESTRICTED TO THE HOST `next/image` IS CONFIGURED FOR. A URL anywhere else is not
      merely unoptimised — it makes `next/image` THROW, which 500s the whole `/blogs`
      listing. Rejecting it here means a cover that cannot render can never be stored.
    */
    .refine(isSupportedCoverUrl, {
      message: 'A cover must be an uploaded image, not a pasted URL.',
    })
    .nullable()
    .optional(),
  coverAlt: z.string().trim().max(200).nullable().optional(),
  author: z.string().trim().min(1).max(120),
  content: z.string().max(200_000),
  category: z.enum(BLOG_CATEGORY_VALUES).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  /*
    ⚠️ AN ISO STRING OR `null`, AND `null` IS A REAL VALUE — it means draft. `.nullable().optional()`
    keeps "not sent" and "deliberately cleared" distinguishable, which is the `||` versus `??`
    lesson from #28 in schema form: unpublishing a post has to be expressible.
  */
  publishedAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const items = await prisma.blogPost.findMany({
      /*
        ⚠️ DRAFTS FIRST, THEN NEWEST. Postgres sorts NULLs last on `desc` by default, so a plain
        `publishedAt: 'desc'` would bury every draft below every published post — the opposite of
        what an editing screen wants. `updatedAt` is what an author is actually looking for.
      */
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverUrl: true,
        author: true,
        category: true,
        tags: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[admin/blogs] list failed', error);
    return NextResponse.json({ error: 'Could not load posts.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid post.' },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.blogPost.create({
      data: {
        ...parsed.data,
        excerpt: parsed.data.excerpt ?? null,
        coverUrl: parsed.data.coverUrl ?? null,
        coverAlt: parsed.data.coverAlt ?? null,
        category: parsed.data.category ?? null,
        publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
        /*
          ⚠️ `plainText` IS DERIVED HERE, IN THE SAME HANDLER THAT WRITES THE HTML. The schema
          comment insists on it and the reason is that any other arrangement lets the two disagree:
          a body edited without its stripped text regenerated leaves a search index describing the
          previous version. One write, one source.
        */
        plainText: htmlToPlainText(parsed.data.content),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    /*
      ⚠️ `P2002` IS A 409 WITH A SENTENCE, NOT A 500. A duplicate slug is a normal editing mistake —
      two posts about the same tool — and Prisma's own message names the constraint and the column,
      which is internal detail leaking to a screen that should just say what to change.
    */
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A post with that slug already exists. Choose a different one.' },
        { status: 409 }
      );
    }
    console.error('[admin/blogs] create failed', error);
    return NextResponse.json({ error: 'Could not create that post.' }, { status: 500 });
  }
}
