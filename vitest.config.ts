import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/abstractions/**",
        "src/**/feature.ts",
        "src/**/index.ts",
        "src/**/types.ts",
        "src/**/errors.ts",
        "src/**/schema.ts",
        "src/**/entry.ts",
        "src/**/server.ts",
        "src/**/route.tsx",
        "src/**/routes/*/route.ts",
        "src/**/routes/*/index.ts",
        "src/**/migrations/**",
        "src/ui/**",
        "src/shared/routing/**",
        "src/shared/responses/**",
        "src/shared/routes/**",
      ],
      reporter: ["text", "text-summary"],
      thresholds: {
        statements: 45,
        branches: 30,
        functions: 50,
        lines: 45,
      },
    },
  },
});
