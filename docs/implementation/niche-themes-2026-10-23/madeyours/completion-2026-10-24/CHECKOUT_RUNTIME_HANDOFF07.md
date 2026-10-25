# Fixture-only07 — reviewer runs corrected7 only

Native06 run `34adae829d85` finished **15PASS / 7FAIL / 0SKIP / 0CANCELLED**,30.3seconds, owned cleanup green, no old fixtures reaped. The existing15 hosted-buyer/local-provider tests pass. All7 new cases failed before checkout because `reentry-` plus a full UUID produces44 characters against the unchanged canonical1–24 label guard. Preserve that failed run and sealed05/06.

Private successor `/private/tmp/madeyours-checkout-reentry-proposal-20261024-07` changes **one test-source line only**:

```diff
- seedBuyerAccount(psql, `reentry-${crypto.randomUUID()}`)
+ seedBuyerAccount(psql, `reentry-${crypto.randomUUID().slice(0, 16)}`)
```

The label is24 characters. The harness still generates a separate fresh buyer UUID. All ten production overlays, the existing15 suite,1,126 other source inputs, package metadata and vendor dependencies remain unchanged. All workspace links are rebound into07. No guard, business assertion, Main source, frozen version or environment/credential file changed.

Pure actual-harness label contract: **4PASS/0FAIL**, including old44 rejection before SQL, corrected24 reaching only an in-memory SQL callback, distinct generated buyer UUIDs and unchanged invalid-label rejection. Actual private buyer-binding/Worker exports load with0Main source/declarations/fetch/socket/subprocess calls. This is not native execution or a real database result.

- Immutable07 boundary SHA256: `8d19ca2e46fa4c360b1db70c848c83314710ed38308faa27d6bfbb041705f3ed`
- Source manifest SHA256: `f61a58b7c3be453a4b9615417e9372155ddc272a57c6071dc52c1535bcbd1fd1`
- Corrected7-test source SHA256: `b405b6c3ccaa1fa5ca59eb7eb0993a0a7345c793ba9acc5f4049ebc959287ce3`

[Structured handoff](CHECKOUT_RUNTIME_HANDOFF07.json) gives exact boundary/source/link/proof/command paths and hashes. Official runner listing selects only the corrected suite. Independent reviewer owns the native lane and new output; verify this immutable boundary before launch. Reuse the15 native results for their identical implementation/suite inputs; do not rerun them for a label-only change.

From candidate07:

```sh
env -u NODE_PATH -u NODE_OPTIONS -u TSX_TSCONFIG_PATH node scripts/governance/run-executable-suites.mjs \
  --kind gateway-db \
  --suite services/api-gateway/src/__tests__/owned-db/hosted-checkout-contact-reentry.postgres.test.ts \
  --jobs 1 --timeout 180 --through-migration 393 --no-reap --json
```

The7 real Worker outcomes remain unqualified and may expose further defects. No native/DB/browser/provider run occurred in this chat. MadeYours installed cases remain0/23. Do not report22PASS.
