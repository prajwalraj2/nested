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
  {
    /**
     * Visitor-submitted content renders as TEXT. Never as HTML. (M-4)
     * ========================================================================
     *
     * This is the single most important rule in Phase M, and until now it existed only as a
     * sentence in a document reading "enforced by review". Review is the weakest enforcement
     * available for the rule whose failure mode is worst.
     *
     * ⚠️ WHAT GOES WRONG WITHOUT IT. Someone submits `<script>` as their feedback message. It
     * sits harmlessly in Postgres — nothing publishes it, no visitor ever sees it. Then the
     * admin opens the review queue, and if that screen renders the message as HTML the script
     * executes in a LOGGED-IN ADMIN SESSION on the SAME ORIGIN as the admin API. It can do
     * anything the admin can: create a user, delete pages, read the database through our own
     * endpoints. That is stored XSS, it needs exactly ONE submission, and no amount of rate
     * limiting touches it.
     *
     * ⚠️ SCOPED TO THESE THREE DIRECTORIES, NOT TO THE ADMIN AS A WHOLE. A blanket ban would be
     * wrong and would be turned off within a week: `admin/rich-text/HtmlEditor.tsx` and
     * `admin/roadmaps/RoadmapNodeForm.tsx` use `dangerouslySetInnerHTML` legitimately, on content
     * the trusted admin authored. The distinction is not the API, it is WHO WROTE THE STRING.
     *
     * ⚠️ TWO OF THESE PATHS DO NOT EXIST YET — M-6 and M-8 create them. That is deliberate: the
     * rule is in place BEFORE the code it governs, so the first version of those screens is
     * written under it rather than retrofitted after a review catches it. An eslint `files`
     * pattern that matches nothing is inert, not an error.
     *
     * ⚠️ THE PRISMA SELECTOR IS REPEATED HERE ON PURPOSE. Flat config REPLACES a rule's options
     * rather than merging them, so a block that sets `no-restricted-syntax` for these files would
     * silently disable the `new PrismaClient()` guard inside them. Both selectors have to travel
     * together.
     */
    files: [
      "src/components/admin/feedback/**",
      "src/components/admin/submissions/**",
      "src/components/admin/careers/**",
      "src/app/admin/feedback/**",
      "src/app/admin/submissions/**",
      "src/app/admin/careers/**",
    ],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector: "NewExpression[callee.name='PrismaClient']",
          message:
            "Import the shared singleton instead: `import { prisma } from '@/lib/prisma'`. " +
            "Constructing a client per module leaks a connection pool on every hot reload.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "Visitor-submitted content renders as TEXT, never as HTML — rendering it here is " +
            "stored XSS against your own admin session. See NEW-IMPROVEMENTS-3.md section 36.4, rule 1.",
        },
      ],
    },
  },
];

export default eslintConfig;
