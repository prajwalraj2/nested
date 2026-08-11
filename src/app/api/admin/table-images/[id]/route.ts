// src/app/api/admin/table-images/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { getStorage, currentProvider } from '@/lib/storage';
import { getImageUsage } from '@/lib/table-image-usage';
import {
  ImageRejected,
  isValidImageKey,
  normaliseImageKey,
  processUpload,
} from '@/lib/image-processing';

/**
 * One table image (K-5b).
 * ============================================================================
 *
 *   PATCH  rename the key, or replace the artwork
 *   DELETE remove it — refused while any row still references it
 *
 * ⚠️ Admin only, guarded before the body is read, as in the collection route.
 */
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await prisma.tableImage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, message: 'That image does not exist.' }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const rawKey = form.get('key');

    /*
      ── Replacing the artwork ────────────────────────────────────────────────
      ⚠️ THE KEY DOES NOT CHANGE, AND THAT IS THE POINT. Every row referencing this key picks
      up the new picture at once — no hunting, no per-row edit. The URL changes because it is
      a content hash of the new bytes, which is what makes the one-year immutable cache safe:
      nobody has the new URL cached, because it did not exist a moment ago.

      This is the mechanism `ICON-GUIDE.md` §9 has to substitute five manual steps for, since
      repository icons are served from a path someone chose by hand.
    */
    let updated = existing;
    if (file instanceof File) {
      const processed = await processUpload(Buffer.from(await file.arrayBuffer()));
      const storage = await getStorage();
      const { url } = await storage.put(
        `table-images/${processed.hash}.webp`,
        processed.buffer,
        processed.contentType,
      );

      const previousUrl = existing.url;

      updated = await prisma.tableImage.update({
        where: { id },
        data: {
          url,
          provider: currentProvider(),
          width: processed.width,
          height: processed.height,
          bytes: processed.bytes,
        },
      });

      /*
        ⚠️ THE OLD OBJECT IS DELETED **AFTER** THE ROW POINTS AT THE NEW ONE, AND FAILURE TO
        DELETE IS NOT FATAL.

        Order matters: delete first and a failure between the two operations leaves the row
        pointing at an object that no longer exists — every referencing thumbnail breaks. This
        way the worst case is an orphaned object, which costs a couple of kilobytes and shows
        up in the unused filter.

        ⚠️ Skipped when the URLs match: re-uploading identical bytes produces the same content
        hash and therefore the same URL, so deleting it would remove the object the row was
        just pointed at.
      */
      /*
        ⚠️ AND ONLY IF NO OTHER IMAGE SHARES THAT OBJECT.

        Content hashing means two keys holding identical bytes resolve to the SAME object —
        that is the dedup the design wants. It also means deleting "the old object" can pull
        the file out from under a different image that is perfectly healthy:

            upload logo.png as "a"   -> object H
            upload logo.png as "b"   -> object H   (same bytes, same hash, shared)
            replace "a"'s artwork    -> deletes H  -> "b" now points at nothing

        Found while testing exactly that sequence. The check is one query and it is the price
        of dedup: sharing objects requires reference counting before removal.
      */
      if (previousUrl !== url) {
        const stillReferenced = await prisma.tableImage.count({
          where: { url: previousUrl, id: { not: id } },
        });
        if (stillReferenced === 0) {
          try {
            await storage.delete(previousUrl);
          } catch (error) {
            console.error('[table-images] old object left behind:', previousUrl, error);
          }
        }
      }
    }

    // ── Renaming the key ──────────────────────────────────────────────────────
    if (typeof rawKey === 'string' && rawKey.trim() !== '') {
      const key = normaliseImageKey(rawKey);
      if (!isValidImageKey(key)) {
        return NextResponse.json(
          {
            success: false,
            message: 'The key must be lowercase letters, numbers and hyphens, 2-64 characters.',
          },
          { status: 400 },
        );
      }

      if (key !== existing.key) {
        const clash = await prisma.tableImage.findUnique({ where: { key } });
        if (clash) {
          return NextResponse.json(
            { success: false, message: `Another image already uses the key "${key}".` },
            { status: 409 },
          );
        }

        /*
          ⚠️ RENAMING BREAKS EVERY ROW THAT REFERENCES THE OLD KEY.

          Rows store the key as plain text inside a JSON blob; there is no foreign key, so
          nothing cascades. Renaming a key that 40 rows point at leaves those 40 rows pointing
          at nothing — and the thumbnails would simply vanish, with no error.

          Refused while in use rather than attempted: rewriting 40 rows across several tables'
          JSON blobs is a migration, and doing it silently inside a rename is how data gets
          corrupted. The message says how to proceed instead.
        */
        const usage = await getImageUsage(existing.key);
        if (usage.count > 0) {
          return NextResponse.json(
            {
              success: false,
              message:
                `"${existing.key}" is used by ${usage.count} row${usage.count === 1 ? '' : 's'}, which reference it by name. ` +
                'Renaming it would leave those rows pointing at nothing. Clear the image from those rows first, or upload a new image under the new key.',
              usage,
            },
            { status: 409 },
          );
        }

        updated = await prisma.tableImage.update({ where: { id }, data: { key } });
      }
    }

    return NextResponse.json({ success: true, image: updated });
  } catch (error) {
    if (error instanceof ImageRejected) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error('[table-images] update failed:', error);
    return NextResponse.json({ success: false, message: 'The update failed.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await prisma.tableImage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, message: 'That image does not exist.' }, { status: 404 });
  }

  /*
    ⚠️ REFUSED WHILE IN USE, AND THE REFUSAL SAYS WHERE.

    The public renderer shows nothing when a key resolves to no image — deliberately, so a
    missing image never becomes a broken-image box. That is right for the visitor and wrong
    for the admin: deleting an image used by 40 rows would blank 40 thumbnails and report
    success. G-6a's category delete established the pattern of naming what is in the way.
  */
  const usage = await getImageUsage(existing.key);
  if (usage.count > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `"${existing.key}" is used by ${usage.count} row${usage.count === 1 ? '' : 's'}. Clear the image from those rows before deleting it.`,
        usage,
      },
      { status: 409 },
    );
  }

  /*
    ⚠️ OBJECT FIRST, THEN THE ROW — the opposite order to the replace above, for the opposite
    reason. Here the row is going away regardless, so a failed object delete must not leave a
    row pointing at nothing; deleting the object first means a failure aborts before the row
    is touched, and the whole operation can simply be retried.
  */
  /*
    ⚠️ Same sharing problem as the replace above: another image may hold identical bytes and
    therefore the same object. When it does, only the row goes — removing the file would break
    an image nobody touched.
  */
  const sharedWith = await prisma.tableImage.count({
    where: { url: existing.url, id: { not: id } },
  });

  if (sharedWith === 0) {
    const storage = await getStorage();
    try {
      await storage.delete(existing.url);
    } catch (error) {
      console.error('[table-images] object delete failed:', existing.url, error);
      return NextResponse.json(
        {
          success: false,
          message: 'The stored file could not be removed, so nothing was deleted. Please try again.',
        },
        { status: 502 },
      );
    }
  }

  await prisma.tableImage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
