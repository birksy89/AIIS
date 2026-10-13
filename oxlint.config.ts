import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "error",
  },
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
  env: {
    builtin: true,
    node: true,
  },
  ignorePatterns: [
    ".agents/**",
    ".claude/**",
    "dist/**",
    "coverage/**",
    ".next/**",
    "src/generated/**",
    "next-env.d.ts",
  ],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
  },
  rules: {
    "typescript/no-explicit-any": "error",
    "import/no-unassigned-import": ["error", { allow: ["**/*.css", "dotenv/config"] }],
  },
});
