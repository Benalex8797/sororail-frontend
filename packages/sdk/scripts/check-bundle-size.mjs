#!/usr/bin/env node
/**
 * Fails the build when the ESM bundle for @sororail/sdk grows past a budget.
 *
 * Run after `pnpm --filter @sororail/sdk build`. It measures the shipped
 * `dist/index.js` — the file consumers actually import — both raw and gzipped,
 * prints both, and exits non-zero once the gzipped size exceeds
 * SDK_BUNDLE_BUDGET_KB (default 40). It is also run automatically at the end of
 * every `tsup` build (see `onSuccess` in tsup.config.ts), so a regression fails
 * `pnpm build` before it can ship.
 *
 * The SDK's only runtime dependency, `@stellar/stellar-sdk`, is external, so
 * this budget is small. The usual cause of a jump is a dependency being pulled
 * into the bundle instead of left external.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const esmBundle = path.join(root, "dist", "index.js");
const budgetKb = Number(process.env.SDK_BUNDLE_BUDGET_KB ?? 40);

if (!fs.existsSync(esmBundle)) {
  console.error(
    "No dist/index.js found. Run `pnpm --filter @sororail/sdk build` first.",
  );
  process.exit(2);
}

const raw = fs.readFileSync(esmBundle);
const rawKb = raw.length / 1024;
const gzipKb = zlib.gzipSync(raw).length / 1024;

console.log(
  `@sororail/sdk ESM bundle: ${rawKb.toFixed(1)} kB raw, ` +
    `${gzipKb.toFixed(1)} kB gzip (budget ${budgetKb} kB gzip).`,
);

if (gzipKb > budgetKb) {
  console.error(
    `\nThe ESM bundle is ${gzipKb.toFixed(1)} kB gzipped, over the ${budgetKb} kB budget. ` +
      "Check for a dependency that should be external, or raise SDK_BUNDLE_BUDGET_KB deliberately.",
  );
  process.exit(1);
}
