/**
 * Bootstrap the FIRST administrator account.
 * ============================================================================
 *
 * WHY THIS SCRIPT HAS TO EXIST
 * ----------------------------
 * Creating an admin through the app requires already being one — `POST
 * /api/admin/users` is guarded by `requireAdmin()`. That is a chicken-and-egg problem
 * on a database with no users, so something outside the request cycle has to break it.
 * This is that something.
 *
 * It matters more than it looks. A fresh `prisma migrate deploy` produces a schema with
 * an empty `User` table, and without this script such a database has NO way to log in at
 * all — not a bad password, no route in whatsoever. That covers restoring from backup,
 * a new Neon branch created empty rather than cloned, and a new developer setting up
 * locally.
 *
 * ⚠️ WHY THE CREDENTIALS COME FROM THE ENVIRONMENT — READ BEFORE "SIMPLIFYING"
 * ---------------------------------------------------------------------------
 * This file used to hardcode its credentials:
 *
 *     email:    'admin@example.com',   // ← Change this to your email
 *     password: 'Admin123!',           // ← Change this to your preferred password
 *
 * Those comments were never acted on. That account was created on 14 Sep 2025 and was
 * still live on production — `isAdmin: true`, `isActive: true` — on 29 Jul 2026, with the
 * password from this file still working. Anyone who read the repository had full
 * administrator access to the live site for about ten months. It was found by accident,
 * not by a security review. (Recorded as finding #17 in NEW-IMPROVEMENTS.md.)
 *
 * So there is deliberately **no default and no fallback**. If the variables are missing
 * the script refuses to run. A default value is precisely what turned a placeholder into
 * a production credential: the convenient path and the safe path have to be the same one,
 * or the convenient one wins.
 *
 * Note also that deleting the credential from this file did NOT revoke it — it stayed
 * valid until the row was deleted from the database, and it remains in git history
 * forever. Never commit a password on the assumption you will change it later.
 *
 * USAGE
 * -----
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-password>' npm run seed:admin
 *
 * In PowerShell (no inline VAR=value prefix — that is bash syntax and fails here):
 *   $env:ADMIN_EMAIL='you@example.com'; $env:ADMIN_PASSWORD='<strong>'; npm run seed:admin
 *
 * Prefer passing them on the command line over adding them to `.env`, so the password
 * does not sit on disk any longer than the one command needs it.
 */
import { PrismaClient } from '../src/generated/prisma'
import { PasswordUtils } from '../src/lib/password'

// A standalone script legitimately constructs its own client and disposes of it — the
// singleton in src/lib/prisma.ts exists to stop per-request modules leaking pools, which
// does not apply to a process that exits. eslint.config.mjs exempts `prisma/**/*.ts`.
const prisma = new PrismaClient()

/** Print guidance and exit non-zero. Used for every refusal so failures are never quiet. */
function fail(message: string, ...detail: string[]): never {
  console.error(`\n❌ ${message}\n`)
  detail.forEach(line => console.error(`   ${line}`))
  console.error('')
  process.exit(1)
}

async function createFirstAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  // Cosmetic only, so a default is harmless here — unlike the credentials.
  const name = process.env.ADMIN_NAME?.trim() || 'Admin User'

  // --- Refuse without explicit credentials ---------------------------------------
  if (!email || !password) {
    fail(
      'ADMIN_EMAIL and ADMIN_PASSWORD must both be set.',
      'There is deliberately no default. A hardcoded placeholder in this file',
      'became a live production credential for ~10 months (see #17), so the',
      'script now refuses rather than inventing one.',
      '',
      'bash:       ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=\'…\' npm run seed:admin',
      'PowerShell: $env:ADMIN_EMAIL=\'you@example.com\'; $env:ADMIN_PASSWORD=\'…\'; npm run seed:admin'
    )
  }

  // Cheap sanity check — a typo here creates an account nobody can sign in as, and the
  // failure would only show up later at the login screen.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(`ADMIN_EMAIL does not look like an email address: "${email}"`)
  }

  // --- Enforce the same password policy the admin UI enforces --------------------
  //
  // Reusing PasswordUtils.validatePassword keeps one definition of "strong enough". A
  // bootstrap account is the LAST place to accept a weak password: it is the most
  // privileged account and, unlike one created through the UI, nothing else checks it.
  const validation = PasswordUtils.validatePassword(password)
  if (!validation.isValid) {
    fail('ADMIN_PASSWORD does not meet the password policy:', ...validation.errors)
  }

  try {
    console.log('🔐 Creating first admin user…')

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isAdmin: true, isActive: true },
    })

    // Idempotent: re-running must not overwrite a password or silently re-enable a
    // deactivated account. Both would be surprising side effects of a "seed" command.
    if (existing) {
      console.log(`\n✅ A user already exists for ${email} — nothing changed.`)
      console.log(`   isAdmin=${existing.isAdmin}  isActive=${existing.isActive}`)
      console.log('   To change its password, use the admin panel.\n')
      return
    }

    const hashedPassword = await PasswordUtils.hash(password)

    await prisma.user.create({
      data: { email, name, password: hashedPassword, isAdmin: true, isActive: true },
    })

    console.log('\n✅ First admin user created.\n')
    // ⚠️ The email is echoed; the PASSWORD IS NOT. You supplied it, so you already have
    // it, and printing it would copy it into terminal scrollback and CI logs — which is
    // the same class of mistake as committing it. The old version printed it in full.
    console.log(`   Email: ${email}`)
    console.log('   Password: (the ADMIN_PASSWORD you supplied — not echoed)\n')
    console.log('🚀 Next: npm run dev, then sign in at http://localhost:3000/admin\n')
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createFirstAdmin()
