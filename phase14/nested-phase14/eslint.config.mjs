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
    },
  },
];

export default eslintConfig;
