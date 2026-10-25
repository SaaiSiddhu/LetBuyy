# Variant-bound review-v2 acceptance

23 October 2026. The canonical public helper now requires explicit `variant_id: UUID | null` and hashes the `letbuyy-personalization-review-v2` domain. This owner updated only the independent snapshot acceptance fixture and owned evidence, after that producer implementation landed.

**18/18 tests pass; focused TypeScript passes.** The two legitimate review calls now supply `selected_variant?.id ?? null`. No implementation, shared export, schema, writer, endpoint or parent was edited by this owner.

The added independent regression proves:

- Same product, version, capability facts, options and accepted text: variantA's review echo fails on variantB with `PERSONALIZATION_STALE`; B's own review succeeds, with different configuration and snapshot fingerprints.
- Explicit null can mint a review and accept an unvarianted product. That echo fails on a selected variant. Missing, undefined or empty variant identity cannot mint a review; the public context schema rejects missing variant identity.
- An independent SHA-256 oracle matches the exact review-v2 domain and selected UUID. A genuine old review-v1 product-only digest is rejected rather than accepted through a fallback.
- Historical saved snapshot version1 still reads correctly; the review token is not added to that historical schema.

All prior17 runtime cases remain. AST comparison confirms every original test declaration is unchanged after accounting for the legitimate advanced-review input field; no original assertion body was removed or weakened. Same-RGB/named beauty choices, exact Hindi/case/spacing, NFC correction, stale version/meaning/product, capability removal/re-addition, deep source erasure/frozen readback and duplicate saved-option-name rejection remain green. The original17 logs/report and original388 review/manifest remain intact.

Current test SHA-256: `bb0af5f8b0e7ace5f46567d6343d07949a1a2e3876514f3ddefc2b6f53a46f4d`. Canonical producer hash at this run: `0cbc6299ed4464bf7b46141ca786c98c7a01c2bea0ac93bb975caa790a1f3582`. Full source hashes, logs and limits are in `snapshot-variant-v2-acceptance-report.json`; oracle preservation is in `snapshot-variant-v2-oracle-preservation.json`.

```sh
node --import tsx --test packages/commerce-core/test/niche-order-snapshot-acceptance.test.ts
pnpm exec tsc --project docs/implementation/niche-themes-2026-10-23/kindred/tsconfig.snapshot-acceptance.json
```

This is pure public canonical API acceptance, not Worker endpoint/SDK, PostgreSQL, order-route, concurrency or provider qualification. MadeYours still owns production fixes and PG acceptance; the independent388 follow-up awaits its repinned source.

## Kindred factory release receipt

The separate inherited subtitle correction is already **complete and released**: `SUBTITLE_FACTORY_FIX.md`, `subtitle-fix-source-manifest.json` and `editor-source-roundtrip.json` are ready for the actual all10 probe. All21 editable source/JSON-wire flows pass, the unsupported-key negative control still rejects, buyer HTML/CSS is unchanged and all91 frozen M1 files are unchanged. Factory SHA-256 remains `643581f20c99ee39717a6db888309da0d3e5579c63a663ef5d583f5b829d6669`; theme-test SHA-256 remains `4a4a9875324b10dc92234a7751ff9aab514e4ced0605df5fd6c58176b7fc7a48`. This factory gate does not depend on the review-token fixture update.
