import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Runs after every build so the shipped ESM bundle cannot grow past its
  // budget unnoticed: the check exits non-zero over the threshold, which fails
  // `pnpm build` and therefore CI. See scripts/check-bundle-size.mjs for the
  // budget (SDK_BUNDLE_BUDGET_KB) and the measurements it prints.
  onSuccess: "node scripts/check-bundle-size.mjs",
});
