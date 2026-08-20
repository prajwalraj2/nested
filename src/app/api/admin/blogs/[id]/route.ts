// src/app/api/admin/blogs/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { htmlToPlainText } from '@/lib/html-text';
import { BLOG_CATEGORY_VALUES, isSupportedCoverUrl } from '@/lib/blog-types';

/**
 * `GET`, `PATCH` and `DELETE /api/admin/blogs/[id]` (M-9).
 *
 * ⚠️ THE SCHEMA IS RE-DECLARED RATHER THAN IMPORTED FROM THE SIBLING ROUTE. A Next route file may
 * only export the HTTP verbs, so `postSchema` in `../route.ts` cannot be shared. Moving it to
 * `lib/` was the alternative and was rejected: it is one shape used by exactly two files that sit
 * next to each other, and a `lib/blog-schema.ts` holding a single zod object is more indirection
 * than the duplication costs. ⚠️ If a field changes, it changes in BOTH.
 */
const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only.')
      .optional(),
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
    author: z.string().trim().min(1).max(120).optional(),
    content: z.string().max(200_000).optional(),
    category: z.enum(BLOG_CATEGORY_VALUES).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    publishedAt: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

/** The editor needs the full body, which the list route omits. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: 'That post no longer exists.' }, { status: 404 });

  return NextResponse.json(post);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid update.' },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const updated = await prisma.blogPost.update({
      where: { id },
      /*
        ⚠️ BUILT KEY BY KEY, TESTING FOR `undefined` RATHER THAN FALSINESS. `null` is meaningful on
        four of these fields — it clears an excerpt, removes a cover, or UNPUBLISHES a post — so a
        `?? null` or a truthiness test would make unpublishing impossible while looking correct.
        This is #28's `||` versus `??` lesson, and it costs one line per field to get right.
      */
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
        ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
        ...(data.coverAlt !== undefined ? { coverAlt: data.coverAlt } : {}),
        ...(data.author !== undefined ? { author: data.author } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.publishedAt !== undefined
          ? { publishedAt: data.publishedAt ? new Date(data.publishedAt) : null }
          : {}),
        /*
          ⚠️ `plainText` IS REWRITTEN WHENEVER — AND ONLY WHENEVER — `content` IS. Regenerating it
          unconditionally would blank it on a PATCH that only changes a tag; not regenerating it on
          a body edit would leave it describing the previous version. Both are silent.
        */
        ...(data.content !== undefined
          ? { content: data.content, plainText: htmlToPlainText(data.content) }
          : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A post with that slug already exists. Choose a different one.' },
          { status: 409 }
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'That post no longer exists.' }, { status: 404 });
      }
    }
    console.error('[admin/blogs] update failed', error);
    return NextResponse.json({ error: 'Could not save that post.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    /*
      ⚠️ THE COVER IMAGE IS NOT DELETED FROM BLOB, AND THAT IS DELIBERATE — the opposite call to a
      job application's CV.

      A cover is named by its CONTENT HASH, so the same picture used on two posts is one object:
      deleting it with one post would break the other. It is also a public, non-personal asset of a
      few KB. A CV is neither — it is one person's document, referenced once, and leaving it is a
      privacy failure. Different data, different rule.
    */
    await prisma.blogPost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Already gone is a success: deleting is idempotent.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ ok: true });
    }
    console.error('[admin/blogs] delete failed', error);
    return NextResponse.json({ error: 'Could not delete that post.' }, { status: 500 });
  }
}
