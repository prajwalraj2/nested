// src/app/api/admin/applications/[id]/resume/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getPrivateStorage } from '@/lib/storage';

/**
 * `GET /api/admin/applications/[id]/resume` — the only way a CV ever reaches a browser (M-8).
 * ============================================================================
 *
 * ⚠️ THE AUTH CHECK IS THE GATE. NOT OBSCURITY, AND NOT A SIGNATURE.
 *
 * The obvious alternative is a presigned R2 URL. It was rejected in decision 36.3(e) and the
 * reason is worth restating: a presigned link, once generated, works for ANYONE who ends up
 * holding it until it expires — in a chat message, a browser history, a proxy log, a screenshot.
 * There is no way to revoke it and no way to know it leaked. A route behind `requireAdmin()` has
 * no such artefact: sign out and it stops working, for everyone, immediately.
 *
 * It also keeps `PrivateStorage` to three methods. URL signing would have leaked a provider's
 * model into an interface whose own comment warns against exactly that.
 *
 * ⚠️ THE KEY IS LOOKED UP FROM THE ID, NEVER ACCEPTED FROM THE CALLER. A route taking an object
 * key would be a read-any-object endpoint with an admin check in front of it; this one can only
 * ever return the CV belonging to the application named in the URL.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const application = await prisma.jobApplication.findUnique({
    where: { id },
    select: { resumeKey: true, name: true, job: { select: { title: true } } },
  });

  if (!application) {
    return NextResponse.json({ error: 'That application no longer exists.' }, { status: 404 });
  }

  try {
    const storage = await getPrivateStorage();
    const pdf = await storage.getPrivate(application.resumeKey);

    /*
      ⚠️ A HUMAN-READABLE FILENAME, BUILT FROM OUR DATA AND STRIPPED.

      The applicant's name reaches this header, so it is reduced to letters, digits, spaces,
      hyphens and underscores first. A raw value could contain a quote or a newline and break out
      of the `filename="…"` parameter — header injection, from a field a stranger filled in. The
      uploaded filename is never used at all; it was discarded at upload time.
    */
    const safeName = `${application.name} - ${application.job.title}`
      .replace(/[^A-Za-z0-9 _-]/g, '')
      .trim()
      .slice(0, 80);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.byteLength),

        /*
          ⚠️ `attachment`, NOT `inline`. This PDF was uploaded by a stranger and — unlike an image,
          which `sharp` re-encodes — it is stored byte for byte as received. Rendering it inside
          the admin's own origin puts an untrusted document in the browser's PDF viewer on the same
          origin as the admin session. Downloading it costs one extra click and takes that whole
          class of question off the table.
        */
        'Content-Disposition': `attachment; filename="${safeName || 'resume'}.pdf"`,

        // Do not let the browser second-guess the type it was told.
        'X-Content-Type-Options': 'nosniff',

        /*
          ⚠️ NEVER CACHED, ANYWHERE. `private` alone would still permit the browser's own disk
          cache, leaving a CV on the machine after sign-out. This is the one response on the site
          where a stale copy is a privacy problem rather than a correctness one.
        */
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  } catch (error) {
    /*
      ⚠️ A ROW WHOSE OBJECT IS MISSING IS A REAL STATE, not an impossible one — it is what a
      half-failed cleanup leaves behind. Saying so plainly beats a generic 500, because the fix
      (delete the application) is different from the fix for a broken bucket connection.
    */
    console.error(`[admin/applications] resume fetch failed for ${id}`, error);
    return NextResponse.json(
      { error: 'Could not read that CV. The file may no longer exist in storage.' },
      { status: 502 }
    );
  }
}
