import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**", // Ignore generated Prisma files
      "prisma/migrations/**", // Ignore migration files
    ],
  },
  {
    rules: {
      // Reduce severity for deployment
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "react/no-unescaped-entities": "warn", // Allow quotes in JSX for deployment
      "prefer-const": "warn", // Allow let instead of const for deployment
      "react-hooks/exhaustive-deps": "warn", // Reduce hook dependency warnings
      "@next/next/no-img-element": "warn", // Allow img tags for deployment

      /**
       * Block `new PrismaClient()` outside the shared singleton.
       *
       * Two route files used to construct their own client at module scope. In dev,
       * Next.js re-evaluates modules on every hot reload, so each save leaked another
       * connection pool until Postgres started refusing connections. On Vercel, every
       * serverless instance opened a redundant pool against a connection-limited
       * database.
       *
       * `src/lib/prisma.ts` caches the client on `globalThis` in non-production so
       * hot reloads reuse one pool. This rule stops the mistake coming back — it is
       * the kind of thing that looks harmless in review.
       *
       * `error`, not `warn`: warnings here are ignored in this config by design, and
       * a silent connection leak is exactly what we are trying to prevent.
       * `src/lib/prisma.ts` and `prisma/seed*.ts` are exempted below — the singleton
       * has to construct one, and standalone scripts legitimately cate their own
       * client and call `$disconnect()`.
       */
      "no-restricted-syntax": ["error", {
        selector: "NewExpression[callee.name='PrismaClient']",
        message:
          "Import the shared singleton instead: `import { prisma } from '@/lib/prisma'`. " +
          "Constructing a client per module leaks a connection pool on every hot reload.",
      }],
    },
  },
  {
    // The singleton itself, and standalone scripts that manage their own lifecycle.
    files: ["src/lib/prisma.ts", "prisma/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;
