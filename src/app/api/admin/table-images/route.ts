// src/app/api/admin/table-images/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { getStorage, currentProvider } from '@/lib/storage';
import { getAllImageUsage } from '@/lib/table-image-usage';
import {
  ImageRejected,
  MAX_UPLOAD_BYTES,
  isValidImageKey,
  normaliseImageKey,
  processUpload,
} from '@/lib/image-processing';

/**
 * Table row images (K-5a).
 * ============================================================================
 *
 *   GET  /api/admin/table-images   list, newest first
 *   POST /api/admin/table-images   upload one image  (multipart: file, key)
 *
 * ⚠️ ADMIN ONLY, GUARDED BEFORE THE BODY IS READ. `requireAdmin()` runs first in both
 * handlers, matching every other admin route — an upload endpoint that parses a stranger's
 * multipart body before checking who they are has already done the expensive, attackable
 * work.
 *
 * The image validation and re-encoding live in `src/lib/image-processing.ts`, where they can
 * be tested without a server or a session. This file is auth, parsing and persistence.
 */

/**
 * ⚠️ `nodejs`, not `edge`. `sharp` is a native binary and cannot run on the edge runtime, and
 * the failure is a build-time module resolution error rather than anything obvious at the
 * point of use.
 */
export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  /*
    Usage comes back with the list, in ONE pass over the tables. Asking per image would mean
    N scans of the same 8,120 rows — see the note in `table-image-usage.ts`.
  */
  const [images, usage] = await Promise.all([
    prisma.tableImage.findMany({ orderBy: { createdAt: 'desc' } }),
    getAllImageUsage(),
  ]);

  return NextResponse.json({
    success: true,
    provider: currentProvider(),
    images: images.map((image) => ({
      ...image,
      usageCount: usage.get(image.key)?.count ?? 0,
      usedIn: usage.get(image.key)?.places ?? [],
    })),
  });
}

export async function POST(request: NextRequest) {
  // Before anything is parsed.
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    /*
      ⚠️ Check the declared length BEFORE reading the stream. Reading first and measuring
      afterwards means a hostile client can make the server buffer as much as it likes; the
      header is not trustworthy, but rejecting on it is free and it stops the honest-but-huge
      case immediately. `processUpload` re-checks the real length regardless.
    */
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_UPLOAD_BYTES * 1.2) {
      return NextResponse.json(
        { success: false, message: `That file is too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    const rawKey = String(form.get('key') ?? '');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'No file was provided.' }, { status: 400 });
    }

    /*
      The key defaults to the filename when none is given, so uploading `pixabay.png` needs
      no typing. `normaliseImageKey` applies the same lowercase-and-hyphens convention as
      `public/icons/`, because contributors meet both systems.
    */
    const key = normaliseImageKey(rawKey || file.name.replace(/\.[^.]+$/, ''));
    if (!isValidImageKey(key)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'The key must be lowercase letters, numbers and hyphens, 2–64 characters. ' +
            'For example: pixabay, google-fonts.',
        },
        { status: 400 },
      );
    }

    const existing = await prisma.tableImage.findUnique({ where: { key } });
    if (existing) {
      /*
        ⚠️ A duplicate key is a CONFLICT, not an overwrite. Silently replacing the artwork
        would change every row referencing that key — 40 of them for `pixabay` — as a side
        effect of an upload someone thought was new. Replacing is a deliberate act and gets
        its own control in K-5b.
      */
      return NextResponse.json(
        {
          success: false,
          message: `An image with the key "${key}" already exists. Choose another key, or replace that image from the Images screen.`,
          conflictingId: existing.id,
        },
        { status: 409 },
      );
    }

    const processed = await processUpload(Buffer.from(await file.arrayBuffer()));

    /*
      The object name is the content hash, so identical bytes always land on the same URL and
      different bytes never do. That is what makes the one-year immutable cache safe, and it
      is why replacing artwork needs no `-v2` discipline (`ICON-GUIDE.md` §9 exists because
      repository-hosted icons have no equivalent).
    */
    const storage = await getStorage();
    const { url } = await storage.put(
      `table-images/${processed.hash}.webp`,
      processed.buffer,
      processed.contentType,
    );

    const image = await prisma.tableImage.create({
      data: {
        key,
        url,
        provider: currentProvider(),
        width: processed.width,
        height: processed.height,
        bytes: processed.bytes,
      },
    });

    return NextResponse.json({ success: true, image }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageRejected) {
      // Written for the person uploading, so it is returned as-is.
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error('[table-images] upload failed:', error);
    return NextResponse.json(
      { success: false, message: 'The upload failed. Please try again.' },
      { status: 500 },
    );
  }
}
