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
  ignorePatterns: [".agents/**", ".claude/**", "dist/**", "coverage/**"],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
  },
  rules: {
    "typescript/no-explicit-any": "error",
  },
});
