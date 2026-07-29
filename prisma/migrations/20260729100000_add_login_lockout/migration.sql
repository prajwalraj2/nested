-- Brute-force protection for admin sign-in.
--
-- Both columns are ADDITIVE and have safe defaults, which makes this migration
-- backward compatible: the currently-deployed code does not reference either column,
-- so applying this to production BEFORE deploying the new code is safe and is in fact
-- the required order (`npm run build` runs `prisma generate`, NOT `prisma migrate
-- deploy`, so migrations never apply themselves on Vercel).
--
-- `failedLoginAttempts` defaults to 0 rather than being nullable so the increment
-- logic never has to handle NULL arithmetic (in SQL, NULL + 1 is NULL, not 1).
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;

-- Nullable on purpose: NULL means "never locked", which is the correct initial state
-- for every existing row and avoids inventing a sentinel date.
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
