// src/lib/api-auth.ts

/**
 * Admin API Authorization Guard
 * ============================================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Our middleware (`src/middleware.ts`) protects PAGE routes like `/admin` and
 * `/admin/domains`. But it used to check only `pathname.startsWith('/admin')`,
 * and the string "/api/admin/pages/123" does NOT start with "/admin" — it starts
 * with "/api/admin". So every API route under /api/admin was completely
 * unprotected, and anyone on the internet could call:
 *
 *     DELETE /api/admin/domains/<id>   → deletes a domain AND every page in it
 *     PUT    /api/admin/tables/<id>/data → wipes an entire table's rows
 *
 * We now fix that in TWO independent layers ("defence in depth"):
 *
 *   Layer 1 — middleware.ts  : one choke point, catches every /api/admin/* request
 *                              automatically, even on route files we haven't
 *                              written yet.
 *   Layer 2 — THIS FILE      : an explicit guard inside each route handler.
 *
 * Why bother with Layer 2 if Layer 1 already blocks everything?
 * Because Layer 1 can silently stop working. If someone edits the middleware
 * `matcher` regex, or a handler gets called in a way that bypasses middleware
 * (a Server Action, a direct function import, a future Next.js change), the
 * route would be wide open again with no warning. Layer 2 keeps each route safe
 * on its own. The redundant check costs ~1ms (it verifies a JWT already in the
 * cookie — no database query), so there is no real reason to skip it.
 *
 *
 * HOW TO USE IT
 * -------------
 * At the very top of every admin route handler, BEFORE reading the body or
 * touching the database:
 *
 *     export async function DELETE(request: NextRequest, { params }: RouteParams) {
 *       const guard = await requireAdmin()
 *       if (!guard.ok) return guard.response   // ← 401 or 403, we stop here
 *
 *       // ...from this line on, we KNOW the caller is an active admin.
 *       // `guard.session.user.id` is available if you need the current admin's id.
 *     }
 */

import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'

/**
 * The result of an authorization check.
 *
 * This is a "discriminated union" — a TypeScript pattern where one shared field
 * (`ok`) tells you which shape you're holding. After `if (!guard.ok) return ...`,
 * TypeScript automatically knows the remaining value must be the `ok: true`
 * variant, so `guard.session` is available WITHOUT a null check or a `!`.
 *
 * Why return a response object instead of `throw`ing an error?
 * A thrown error would be caught by the `try/catch` that every one of our route
 * handlers already has, and turned into a generic `500 Internal Server Error`.
 * That would be wrong and confusing — "you're not logged in" is a 401, not a
 * server crash. Returning a value keeps full control of the status code.
 */
type AdminGuardResult =
  | { ok: true; session: Session }        // caller IS an active admin
  | { ok: false; response: NextResponse } // caller is not — send this response back

/**
 * Verify that the current caller is a logged-in, active admin.
 *
 * Returns `{ ok: true, session }` on success, or `{ ok: false, response }`
 * carrying a ready-to-return JSON error response on failure.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  // `auth()` reads the session cookie and verifies its JWT signature.
  // Our session strategy is "jwt" (see src/lib/auth.ts), so the user's id,
  // isAdmin and isActive flags are all encoded inside the signed token —
  // this does NOT hit the database.
  // Returns `null` when there is no cookie, or the token is expired/tampered with.
  const session = await auth()

  // ---- Case 1: nobody is logged in at all → 401 Unauthorized -------------
  // 401 means "I don't know who you are — authenticate and try again."
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  // ---- Case 2: logged in, but not allowed here → 403 Forbidden -----------
  // 403 means "I know exactly who you are, and you still may not do this."
  // Retrying or logging in again won't help, which is why it is NOT a 401.
  //
  // Two separate flags, both required:
  //   isAdmin  — is this account allowed into the admin panel at all?
  //   isActive — has this account been deactivated? (Our DELETE /api/admin/users
  //              route does a "soft delete" by setting isActive = false instead of
  //              removing the row. Without this check, a deactivated admin would
  //              keep full access until their 24-hour JWT expired.)
  if (!session.user?.isAdmin || !session.user?.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      ),
    }
  }

  // ---- Success: the caller is an active admin ----------------------------
  // We hand the session back so routes that need it don't have to call `auth()`
  // a second time. For example POST /api/admin/users records who created a new
  // account: `createdBy: guard.session.user.id`
  return { ok: true, session }
}

/**
 * WHY WE ALWAYS RETURN JSON HERE, NEVER A REDIRECT
 * ------------------------------------------------
 * For a page route, redirecting an unauthenticated visitor to `/login` is exactly
 * right — a browser follows it and shows the login form.
 *
 * For an API route it is actively harmful. Our admin UI calls these endpoints with
 * `fetch()`, e.g. in src/components/admin/pages/PagesManager.tsx:
 *
 *     const response = await fetch(`/api/admin/pages/${pageId}`, { method: 'DELETE' })
 *     if (!response.ok) throw new Error('Failed to delete page')
 *     const data = await response.json()
 *
 * `fetch()` follows redirects transparently. So a redirect to /login would mean:
 *   1. fetch quietly follows it and receives the login PAGE
 *   2. the final status is 200, so `response.ok` is TRUE — the error check passes
 *   3. `response.json()` then tries to parse HTML ("<!DOCTYPE html>...") and throws
 *      a confusing "Unexpected token '<'" error
 *
 * The real problem (not logged in) is completely hidden behind a JSON parse error.
 * A 401/403 with a JSON body makes `response.ok` false and surfaces the actual cause.
 */
