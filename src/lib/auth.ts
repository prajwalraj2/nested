import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import { PasswordUtils } from "./password"
import { prisma } from "./prisma"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ============================================================================
// Brute-force protection
// ============================================================================

/**
 * How many consecutive failures before the account locks.
 *
 * Five is the usual balance: high enough that a real admin fat-fingering their
 * password twice and then pasting it is never inconvenienced, low enough that it
 * bites an attacker almost immediately.
 */
const MAX_FAILED_ATTEMPTS = 5

/**
 * How long the account stays locked.
 *
 * The point of a lockout is not to be permanent — it is to make guessing
 * arithmetically hopeless. With 5 attempts per 15 minutes an attacker gets 480
 * guesses per day instead of the ~200,000 that bcrypt's cost alone allowed. That
 * turns "feasible against a weak password" into "not feasible".
 *
 * Deliberately not permanent: a permanent lock hands an attacker a denial-of-service
 * against the real admin, who could be locked out of their own CMS by someone simply
 * guessing wrong five times on purpose.
 */
const LOCKOUT_MINUTES = 15

/**
 * A real bcrypt hash (cost 12) of a string no user could ever have as a password.
 *
 * ⚠️ THIS CLOSES A USER-ENUMERATION TIMING SIDE CHANNEL — it is not decoration.
 *
 * The previous version of this file returned `null` immediately when the email was
 * not found, BEFORE running bcrypt. That made the two outcomes measurably different:
 *
 *   unknown email     -> one indexed SELECT              ~5 ms
 *   real email, wrong password -> SELECT + bcrypt compare ~438 ms   (measured)
 *
 * An ~85x gap is trivially observable over the network, so anyone could discover which
 * email addresses have accounts just by timing the responses — no successful login
 * required. Comparing against this decoy hash when the user is missing makes both paths
 * do the same expensive work, so both take about the same time.
 *
 * It must be a genuine cost-12 hash for this to work; a fake string would make
 * `bcrypt.compare` fail fast on parsing and the gap would reopen. Generated once with
 * `bcrypt.hashSync(<random>, 12)` and pasted here so no cold start pays to recreate it.
 */
const DECOY_PASSWORD_HASH =
  "$2b$12$cQDXnTsqA/7HQtO2fuMCN.9ZgD7/xZlreinChUWO8hUELqAg3eMlq"

/**
 * Error codes sent to the browser.
 *
 * ⚠️ These land in a URL query parameter (`?code=…`), which is why Auth.js warns that
 * they must not hint at anything sensitive. Both values here are safe: one is
 * deliberately vague, and the other only confirms something the person triggering it
 * already knows.
 */
const ERROR_CODES = {
  /**
   * Covers *every* ordinary failure: unknown email, wrong password, and deactivated
   * account. One shared code on purpose — telling the browser which of the three it
   * was would undo the timing work above by leaking the same fact through the
   * response body instead.
   */
  INVALID: "invalid_credentials",

  /**
   * Account is locked. Suffixed with the whole minutes remaining, e.g. `locked-8`, so
   * the form can state an accurate time without a second round trip.
   *
   * ⚠️ ACKNOWLEDGED TRADE-OFF: this reveals that an account exists for the submitted
   * email, which is exactly what the timing fix above prevents elsewhere. It is the
   * right call anyway — an admin who is locked out and told only "invalid credentials"
   * will keep retrying, believe the password is broken, and have no idea to simply
   * wait. Being told the truth is worth more here than hiding the existence of an
   * account whose email is a publicly-known personal address. Reaching this state at
   * all already requires five failures.
   */
  LOCKED: "locked",
} as const

/**
 * The typed error Auth.js expects for a credentials failure.
 *
 * WHY A SUBCLASS: returning `null` from `authorize()` produces a single generic
 * `CredentialsSignin` with no detail, so the form could only ever say "invalid email or
 * password" — there would be no way to explain a lockout. Throwing a `CredentialsSignin`
 * subclass with a `code` gets that string through to `signIn()`'s response, which is the
 * only supported channel for it.
 */
class SignInFailure extends CredentialsSignin {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

/** Whole minutes from now until `until`, floored at 1 so we never say "0 minutes". */
function minutesUntil(until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000))
}

/**
 * Record a failed attempt and lock the account once the threshold is reached.
 *
 * Note this runs for a wrong password on a REAL account only — there is no row to
 * count against for an unknown email, and that is fine: the goal is to protect
 * accounts that exist.
 *
 * @returns the lock expiry if THIS attempt caused the lock, otherwise `null`. The caller
 *   uses that to tell the user they are locked on the very attempt that locked them,
 *   rather than leaving them to discover it on the next one — being told "invalid
 *   password" and only later "locked" is needlessly confusing.
 */
async function registerFailedAttempt(
  userId: string,
  currentAttempts: number
): Promise<Date | null> {
  const attempts = currentAttempts + 1
  const reachedLimit = attempts >= MAX_FAILED_ATTEMPTS
  // Only set an expiry on the attempt that crosses the threshold. On earlier attempts
  // this stays null, leaving the account usable.
  const lockedUntil = reachedLimit
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
    : null

  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: attempts, lockedUntil },
  })

  if (reachedLimit) {
    // Deliberately logged: a lock is the signal that someone is guessing, and this is
    // the only place it surfaces (there is no alerting yet). Shows up in Vercel logs.
    console.warn(
      `[auth] account ${userId} locked for ${LOCKOUT_MINUTES}m after ${attempts} failed attempts`
    )
  }

  return lockedUntil
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // `safeParse` rather than `parse`: a malformed submission is an ordinary
        // failure, not an exception to catch further down. Using `parse` inside a
        // try/catch (as this did before) meant a validation error and a database
        // outage took the identical path, which made real faults invisible.
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          throw new SignInFailure(ERROR_CODES.INVALID)
        }
        const { email, password } = parsed.data

        try {
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              isAdmin: true,
              isActive: true,
              failedLoginAttempts: true,
              lockedUntil: true,
            }
          })

          // --- 1. Refuse a locked account before spending anything on bcrypt ------
          //
          // Checked first because there is no point verifying a password we would
          // reject regardless. Timing does not matter here: the response says
          // "locked" outright, so a fast answer reveals nothing the body does not.
          if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
            throw new SignInFailure(
              `${ERROR_CODES.LOCKED}-${minutesUntil(user.lockedUntil)}`
            )
          }

          // --- 2. Always run bcrypt, even when there is no user -------------------
          //
          // The decoy hash keeps this branch as expensive as the real one. See the
          // note on DECOY_PASSWORD_HASH — skipping it here is the whole bug.
          const passwordMatches = await PasswordUtils.verify(
            password,
            user?.password ?? DECOY_PASSWORD_HASH
          )

          // --- 3. One shared failure path ----------------------------------------
          //
          // Unknown email, wrong password and deactivated account all produce the
          // same error. Note `isActive` is checked HERE rather than early-returning
          // before bcrypt, which is what the previous version did — that early return
          // leaked deactivated-account status through timing in the same way.
          if (!user || !user.isActive || !passwordMatches) {
            // Count the attempt only for a genuinely wrong password on a real, ACTIVE
            // account. There is no row to count for an unknown email, and a deactivated
            // account cannot be signed into at all, so locking it further would be
            // meaningless bookkeeping.
            if (user && user.isActive && !passwordMatches) {
              const lockedUntil = await registerFailedAttempt(
                user.id,
                user.failedLoginAttempts
              )

              // If this attempt is the one that tripped the threshold, say so straight
              // away. Without this the user is told "invalid password" on the attempt
              // that locked them and only sees "locked" if they try a sixth time —
              // which reads as the password having suddenly stopped working.
              if (lockedUntil) {
                throw new SignInFailure(
                  `${ERROR_CODES.LOCKED}-${minutesUntil(lockedUntil)}`
                )
              }
            }
            throw new SignInFailure(ERROR_CODES.INVALID)
          }

          // --- 4. Success: clear the counters ------------------------------------
          //
          // Resetting `failedLoginAttempts` is what makes the threshold count
          // *consecutive* failures. Without it a legitimate admin who mistyped four
          // times over several months would lock themselves out on one slip.
          //
          // `lockedUntil` is cleared too: an expired lock leaves a stale past
          // timestamp behind, and while a past date reads as "not locked", clearing it
          // keeps the row honest and makes the column easy to query for real locks.
          await prisma.user.update({
            where: { id: user.id },
            data: {
              lastLoginAt: new Date(),
              failedLoginAttempts: 0,
              lockedUntil: null,
            }
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin,
            isActive: user.isActive,
          }
        } catch (error) {
          // Re-thrown untouched: this is our own deliberate outcome carrying the code
          // the form needs. Swallowing it here (as the old blanket `catch` did) would
          // collapse every case back to a generic failure and lose the lockout message.
          if (error instanceof SignInFailure) throw error

          // Anything reaching this point is a genuine fault — database unreachable,
          // Neon cold-start timeout, malformed stored hash. Logged in full for
          // debugging, but reported to the browser as an ordinary failure so an
          // outage does not describe our infrastructure to the internet.
          console.error("[auth] unexpected error during sign-in:", error)
          throw new SignInFailure(ERROR_CODES.INVALID)
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.sub as string
        session.user.isAdmin = token.isAdmin || false
        session.user.isActive = token.isActive || false
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin
        token.isActive = user.isActive
      }
      return token
    }
  },
  pages: {
    signIn: "/login",
    signOut: "/login"
  },
  trustHost: true, // Allow localhost in production
  debug: process.env.NODE_ENV === "development",
})
