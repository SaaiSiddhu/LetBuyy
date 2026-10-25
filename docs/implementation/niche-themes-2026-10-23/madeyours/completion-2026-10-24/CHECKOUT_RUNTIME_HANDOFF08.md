# Oracle/fixture-only08 — reviewer reruns affected7

Native07 run `d398d3f84a88`: **4PASS/3FAIL/0SKIP**,27.9seconds, clean owned cleanup and no old-fixture reaping. All7 reached the Worker. Positive COD/recovery outcomes remain unqualified; preserve this run and sealed05/06/07. Existing15 native06 results remain reusable for unchanged implementation/suite inputs.

Successor `/private/tmp/madeyours-checkout-reentry-proposal-20261024-08` changes **one test source only**:

- Map the exact route step `payment-intent` to canonical receipt scope `payment_intent`; contact/delivery/confirm retain their exact names. Site/cart/key binding and immutable completed history remain strict; an active receipt's original request hash/identity fields also stay fixed.
- Save actual control before/after provenance before any comparison can fail.
- Require exact inventory version **+2** for reserve+commit and product version **+1** for the default-SKU stock mirror. Require one-unit available/stock decrement and committed increment, with full equality for every unrelated field/row. Refusal/replay full zero-delta assertions remain byte-identical.
- Seed only the new synthetic product stock50 to match its new inventory available50; no existing inventory is replenished.

Current SQL through393 establishes these deltas: last reserve definition141 updates the level once; last commit definition216 updates it once and the default-SKU product mirror once;141 and baseline version triggers call baseline `increment_version()`. The pure actual-oracle/SQL-trace cohort has **13PASS/0FAIL**, including wrong scopes/keys/carts/sites, changed request hash/completed history, unrelated outbox, incorrect version deltas, unrelated product/level data, duplicate stock/provider/ledger effects and pre-failure provenance controls. These are source/oracle tests, not native execution.

All ten production overlays and1,126 other files are byte-identical to07. Workspace links are rebound to08; runtime metadata/vendor identities and the existing15 suite are inherited unchanged. No harness/production/SQL/security guard is changed.

| Boundary | SHA256 |
| --- | --- |
| `packaging-receipts/sealed-boundary08.json` | `e2230ce8d22deefaf1f287d29acf66d3d465613453fcd657788b9209fe75400d` |
| `packaging-receipts/source-input-closure08.json` | `e85873a98eaf7b19ee48d7e0ba853d41a3a825f8c6600cfeec6e3fa0387419d6` |
| corrected7-test source | `2fcef3f55fb935c56b3c646ef54769a220136c447e171c649f393bd647793e10` |

[Structured handoff](CHECKOUT_RUNTIME_HANDOFF08.json) contains the exact diff/proof/source/link/command hashes. The unchanged runner lists only corrected7. The requesting reviewer owns the next native lane and output. From08:

```sh
env -u NODE_PATH -u NODE_OPTIONS -u TSX_TSCONFIG_PATH node scripts/governance/run-executable-suites.mjs \
  --kind gateway-db \
  --suite services/api-gateway/src/__tests__/owned-db/hosted-checkout-contact-reentry.postgres.test.ts \
  --jobs 1 --timeout 180 --through-migration 393 --no-reap --json
```

No native/DB/browser/provider run occurred here; MadeYours browser remains0/23.08 has not yet qualified the seven real outcomes. Do not report22PASS or provider Test Mode success.
