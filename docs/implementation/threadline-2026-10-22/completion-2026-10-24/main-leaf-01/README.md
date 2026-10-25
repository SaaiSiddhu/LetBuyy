# Threadline 2.0.1 Main leaf handoff

24 October 2026. Implemented within allocation `completion-threadline-main-v201-leaf01`: exactly the two new allowed Main paths. **20 focused schema/render/preservation tests pass; strict scoped typecheck has zero diagnostics; focused TypeScript/boundary lint has zero errors or warnings.**

`packages/theme-engine/src/threadline-theme-v201.ts` is a 69-line wrapper over the frozen `createThreadlineTheme`. It consumes the admitted `withConfiguredOrderHeading` helper and verifies its configured heading source. It does not copy the original builder or change shared `theme-bundle.ts`, Core, helper, catalogue, package metadata files or migrations.

The wrapper makes the declared silhouette subtitle and collection-list heading effective, using nonblank trimmed heading → actual collection name → existing fallback. Shared order-heading behavior retains the authoritative order number, escaping and guarded states.

Fresh canonical Core distribution construction clears only the two proven inert inherited default values, so the 21 default page bodies, headers, footers and style outputs remain exact. A saved Threadline 2.0.0 bundle is cloned directly and **never passed through the defaults factory**: its values, layout, resource bindings, section/block identities and ordering, unknown settings and unrelated definitions survive. Values equal to the old stock strings also survive. An existing valid 2.0.1 bundle is checked and cloned idempotently; unknown identity/version or damaged seams fail closed. Output version is 2.0.1 / version_number 3; stale package checksum is removed on version creation for the catalogue owner to derive anew.

`packages/theme-engine/test/threadline-successor.test.ts` binds the previous 15 canonical private controls to the actual new Main leaf, then adds five saved-document/identity/idempotency controls. Its evidence output is optional; normal package test discovery does not require the receipt environment variable. Actual schema/manifest validation, undeclared-field rejection, ThemeDocument/JSON roundtrip and real Liquid rendering remain in place.

## Actual results and retained attempts

- `runs/01/`: 20 PASS / 0 FAIL / 0 SKIP on the initial Main test binding.
- The first strict check found one real test-fixture typing error and a missing Node type-root setup. Both diagnostics and the prior test source are retained. The fixture now validates its settings overlay through the canonical Zod bundle schema; the checker resolves the already installed canonical test type dependencies and emits nothing.
- `runs/02/`: final source/test binding, **20 PASS / 0 FAIL / 0 SKIP**, including all 21 default page body/header/footer/style comparisons.
- `typecheck.json` / `typecheck.log`: strict scoped no-emit check, zero diagnostics.
- `eslint.json` / `eslint.log`: repository-installed TypeScript recommendations and LetBuyy boundary rules, zero errors/warnings on the two files.

The two 20-case runs overlap. They are not 40 unique tests. The historical private setup error, three original behavioral failures, initial private 12/14 result and corrected 15/15 proof are preserved in `../private-successor-01/`; they are not new Main or browser passes.

## Reproduce

From `/Volumes/Projects/LetBuyy`:

```sh
node --import tsx --test packages/theme-engine/test/threadline-successor.test.ts
node docs/implementation/threadline-2026-10-22/completion-2026-10-24/main-leaf-01/check-types.mjs
node docs/implementation/threadline-2026-10-22/completion-2026-10-24/main-leaf-01/check-lint.mjs
```

For separate rendered-output and runtime-input receipts, create a new unused directory beneath this folder's `runs/`, set its absolute path as `TL_RENDER_RUN_DIR`, and add `--import ./docs/implementation/threadline-2026-10-22/completion-2026-10-24/main-leaf-01/capture-runtime.mjs` before `--import tsx`. Existing receipts must not be overwritten.

## Root-owned integration remains separate

`first-party-threadline-dispatch.UNAPPLIED.diff` proposes only the new import, optional `threadlineVersion: '2.0.1'`, and explicit Sense dispatch. Default 2.0.0 and the other version options remain unchanged. Its exact base hash and required Root checks are in `CATALOGUE_PROPOSAL.json`. This diff was **not applied** and its dispatch is not yet tested.

`SEALED_HANDOFF.json` ends this leaf lease and gives exact source/test/dependency/result/input hashes for independent review. No further Main edits are made under this completed grant. There was no browser/native/build/database/provider action, app restart, migration, catalogue promotion, commit or deployment. Existing drafts, data and frozen 2.0.0/M1 artifacts remain untouched.

Full theme certification stays open. These are source/schema/render tests, not admitted editor save/reload/publish, normal buyer/COD/Razorpay, immutable post-purchase history, responsive/accessibility/performance or independently accepted end-to-end evidence.
