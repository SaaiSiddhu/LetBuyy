# Corrected 389 candidate — wire integrity passes; source admission pending

Candidate **`81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f`** is saved in [its immutable manifest](./proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/manifest.json). It remains **PROPOSED_NOT_FROZEN**, pending root review. Exactly one corrected CLI dry run was executed. No applied SQL, database, build, browser, deployment or cross-chat message was performed.

## Result and concurrent source change

The generator correction passes **13/13 tests**, focused TypeScript noEmit, actual disk reload integrity, and byte-identical in-memory versus disk UP/DOWN strings. All nine raw factory bundle hashes match Editor checkpoint 03. The corrected candidate retains the same nine canonical bundle hashes as failed `0cf62…`; only the persistence approved-key array order and derived payload/file hashes change.

**The final whole-source guard is not green:** while this work ran, one of the 88 Editor inputs changed outside our lease:

- Path: `services/api-gateway/src/execution/schema-registry-execution.adapter.ts`
- Admitted/pre-generation SHA-256: `a7133ae2003a23253ac7c9cbb16a92392dbcc8ffb199531ca0fd230ff70114ae`
- Observed final SHA-256: `a742187900a03f2c1c74745c06bf46d797653d4e1309d98762332286972d5a43`

The other 87 inputs are unchanged. This adapter is outside the generator's 47 dependencies, all of which remain unchanged after the authorized fix. No adapter edit, automatic baseline replacement or proposal regeneration was made here. Root must admit the new adapter source and its relevant Editor proof; the earlier whole-source checkpoint cannot be claimed current. The candidate's actual wire/content proof is saved separately from that source-admission gap.

## Narrow implementation

Only the leased generator and its tests were edited. The generator first validates each fresh v2 factory result, then round-trips it through sorted canonical JSON **before** deriving persistence, document and artifact. Semantic arrays, including `template.order`, retain their order. Global factories, the canonical persistence builder, runtime sources and strict integrity/hash/capture comparisons were not edited.

```diff
-    const bundle = LiquidThemePackageBundleSchema.parse(factory(slug, { designVersion: VERSION }));
+    const validatedBundle = LiquidThemePackageBundleSchema.parse(factory(slug, { designVersion: VERSION }));
+    // Derive captures from the same JSON object-key order that distribution will load.
+    // Canonical JSON preserves semantic arrays, including every template.order.
+    const bundle = JSON.parse(canonicalJson(validatedBundle)) as LiquidThemePackageBundle;
```

| Leased source | Before SHA-256 | Corrected SHA-256 |
| --- | --- | --- |
| Generator | `49cd6c472ddbe94e5ff66a6b3a98ca300ae48c153c2003a4c431d4ac6139dbe7` | `ccbd78a2b0b47e8a6cfb33390965a32ddc611711cc4c369772199db5adb389b3` |
| Tests | `66dea8ff5bf38d8741c259d95073e9cbf67327ec8bcbac06a03614e582a917dd` | `569485559353562215f96529f4e486e4216b64b0a676930c9b913a5f56163ca0` |

Three added regressions cover:

1. Actual `writeDryRun` → load manifest and all nine files → strict `assertProposalIntegrity` → `renderPromotionPair`, with exact in-memory/disk SQL equality.
2. Reordered approved keys and altered key membership, with envelope hashes recomputed so strict payload/capture checks must reject the tampering. Comparisons remain order-sensitive.
3. Preservation of every factory template order array, plus rejection of a resealed changed template order. Actual verification preserved **207 arrays** across nine bundles.

The new tests were run against the old generator first: **10 pass / 3 fail**. With the correction, all **13 pass**, with zero failures, skips or cancellations. The original `0cf62…` disk-loaded candidate still fails the unchanged strict integrity guard; its files and original failing proof remain untouched.

## Explicit hash conventions

Editor admission uses `SHA256(JSON.stringify(rawFactoryBundle))`. Each raw factory was checked against its exact checkpoint 03 hash before normalization. Distribution uses `SHA256(canonicalJson(bundle))`. The stored normalized wire bundle is semantically equal to the raw factory, with all array order retained. Raw JSON.stringify hash equality **after normalization is not claimed**. [The verification JSON](./wire-correction-verification.json) records both conventions, each raw and canonical hash, all nine UUID/preset/slug identities, artifact file hashes and the exact diff from failed `0cf62…`.

The stored persistence payload now exactly equals the canonical builder result derived from the reloaded bundle, including the approved-key array's exact order. Approved key membership is unchanged. No array-as-set comparison replaces any integrity check.

## Preservation, SQL and limits

All **40 earlier proposal files** remain byte-identical, including `1686…`, `0cf62…` and every older directory. Original failure receipts and the existing `PROPOSAL.json` index remain unchanged. Default-v1 hashes and frozen catalogue 372 remain exact. Threadline's pinned capture remains `61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e` and is excluded from the nine-theme promotion.

Pure in-memory SQL comparison produced:

- UP SHA-256: `3d9a5e0344db7537558554b723ffc134707bf7b98fe4941bc6bf268bd7330e61` (5824537 bytes).
- DOWN SHA-256: `aecbd647393ac9dcec1466d8b7f80e21cd89a1522b6956bd0c9c479529e45927` (2744 bytes).
- Both strings are byte-identical between the fresh in-memory and actual disk-loaded proposals. **Zero SQL files were written or executed.** No 389 file exists in the applied migration/rollback scans.

Actual database package UUIDs and immutable captures were not observed or minted. Stable catalogue UUIDs, preset aliases and package slugs are verified offline; strict identity/status/conflict guards remain intact. Root acceptance of the exact manifest, repaired 387 catalogue qualification, 390 native SQL qualification, actual package/capture checks and installed lifecycle acceptance remain external gates.

Evidence: [verification/diff](./wire-correction-verification.json), [pre-correction preservation baseline](./wire-correction-before.json), [post-test source guard](./wire-correction-source-before-proposal.json), [CLI stdout](./wire-correction.stdout.json), [red regression output](./wire-correction-before.tests.tap), [green regression output](./wire-correction-after.tests.tap), and [typecheck log](./wire-correction.typecheck.log).

This saved handoff is the delivery surface requested by root. No previously rejected cross-chat message was retried.
