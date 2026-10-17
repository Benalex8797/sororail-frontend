---
"@sororail/sdk": patch
---

Guard the public API in CI and refresh the generated declaration snapshot.

- `test/public-api.test.ts` snapshots the runtime exports of `src/index.ts`, so
  removing or renaming one fails CI until the list is updated on purpose.
- `api:check` now passes again: `api-surface.snapshot.d.ts` is regenerated for
  the `fromStroops` doc comment that had drifted from `src/`.
- `typecheck:examples` compiles every file in `examples/` against the client API
  on each PR.
- `bundle:check` (run by `tsup` after every build) fails when the shipped ESM
  bundle grows past its budget.
