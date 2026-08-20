// src/app/api/admin/blog-covers/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getStorage } from '@/lib/storage';
import { ImageRejected, processUpload } from '@/lib/image-processing';

/**
 * `POST /api/admin/blog-covers` — upload one blog cover (M-9).
 * ============================================================================
 *
 * ⚠️ A SEPARATE ROUTE FROM `/api/admin/table-images`, BUT THE SAME PIPELINE. See the note on
 * `ImagePreset` in `image-processing.ts` for why: that route's job includes writing a `TableImage`
 * row and returning its id, and a cover has no such row. What must not be duplicated is the
 * PROCESSING — the magic-byte sniff, the SVG and GIF rejections, the pixel ceiling, the re-encode
 * — and that is shared by passing a preset rather than by copying the rules.
 *
 * ⚠️ VERCEL BLOB, NOT R2. Covers are PUBLIC assets, and decision 36.3(d) keeps public assets on
 * Blob — R2 is scoped to private files precisely because public R2 would need a custom domain.
 * `getStorage()` is the public adapter; `getPrivateStorage()` is a different thing entirely.
 *
 * ⚠️ NO DATABASE ROW IS WRITTEN HERE. The URL comes back and the admin form holds it until the
 * post is saved. That means an abandoned upload leaves an orphaned object in Blob — accepted
 * deliberately: the alternative is a draft-cover table whose rows also leak, and an unreferenced
 * public image costs a few KB rather than being personal data.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No image was attached.' }, { status: 400 });
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());

    // ⚠️ The preset is what makes this a 1200x630 JPEG rather than a 64x64 WebP.
    const processed = await processUpload(input, 'blog-cover');

    const storage = await getStorage();
    /*
      Named by the CONTENT HASH, like table images: two uploads of the same picture become one
      object, and the bytes under a given URL can never change — which is what makes an immutable
      cache header honest.
    */
    const { url } = await storage.put(
      `blog-covers/${processed.hash}.jpg`,
      processed.buffer,
      processed.contentType
    );

    return NextResponse.json({
      url,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
    });
  } catch (error) {
    /*
      `ImageRejected` carries a message written for a person — "that file is not a PNG, JPG or
      WebP; the check reads the file itself, not its name". Anything else is ours and is logged
      rather than returned, because sharp's errors name internal paths and codec details.
    */
    if (error instanceof ImageRejected) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[blog-covers] upload failed', error);
    return NextResponse.json({ error: 'Could not process that image.' }, { status: 500 });
  }
}
