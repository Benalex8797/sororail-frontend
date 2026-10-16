import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "lcov", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        branches: 87.16,
        functions: 76.59,
        lines: 36.6,
        statements: 36.6,
      },
    },
  },
});
