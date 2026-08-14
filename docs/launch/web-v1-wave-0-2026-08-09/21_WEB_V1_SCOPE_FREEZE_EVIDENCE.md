# Web V1 Scope Freeze — Evidence

**Evidence artifact, not governance authority.** Where this document conflicts with `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, a nested `AGENTS.md`, or `LETBUYY_CANONICAL_SYSTEMS.md`, those win and this document is defective. Nothing recorded here is an ARB act, an approval, or a deferral decision.

| Field | Value |
|---|---|
| Repo SHA (baseline) | `ee3711829d857e986014c5811bb94d86ebc3d343` |
| Branch / worktree described | `codex/w0-v1-perimeter` at `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/w0-v1-perimeter` (isolated git worktree, clean at baseline before this work) |
| Commit produced | `2c84e1a9` — local only, not pushed, no PR |
| Date | 2026-08-09 |
| Original repository | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — treated as read-only. Only this deliverable and `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/W0-V1-PERIMETER/` were written there. No Supabase, provider, deploy, or remote command was run from anywhere. |
| Raw evidence | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/W0-V1-PERIMETER/` (6 files, listed in §7) |

## What was EXECUTED vs INFERRED

**Executed** (command run, exit code observed, output captured):

- `node scripts/validators/web-v1-scope-perimeter-validator.mjs --report` → exit 0
- `node scripts/validators/web-v1-scope-perimeter-validator.mjs` → exit 0
- Negative test 1 — temporary fixture `services/api-gateway/src/routes/sms.ts` created, validator run, fixture deleted → exit 1
- Negative test 2 — temporary bogus baseline entry added to the registry, validator run, registry restored → exit 1
- `node scripts/validate-governance.mjs --lane=gate` → exit 1
- `node scripts/validators/validate-design-system.mjs` → non-zero
- `node scripts/validators/tooling-governance-validator.mjs` → exit 0
- `node scripts/validators/meta-no-theater-validator.mjs` → exit 0
- `node scripts/validators/whole-repo-end-state-validator.mjs` → exit 0
- `node scripts/validators/no-noop-test-script-validator.mjs` → exit 0
- `node scripts/validators/foundation-antifabrication-gate.mjs` → exit 0
- `node scripts/validators/architecture-validator.mjs` → exit 0
- `node scripts/validators/generated-artifact-validator.mjs` → exit 0
- `node scripts/validators/frozen-path-override-gate.mjs` → exit 0
- `git status --short`, `git rev-parse HEAD`, `git branch --show-current`, `git commit`, `git log`
- Read-only `grep` / `ls` / `find` source inspection to establish every probe's baseline state

**Inferred, not executed:**

- No app was built, no dev server started, no HTTP request issued. Every capability-activation claim is source-level (a file exists, a route is mounted, a regex matches), not runtime-observed.
- No deployed environment variable value was read. Where a capability is gated by an env var, this document says so and does not claim to know the deployed value.
- The database was not queried. No RLS, policy or row-level claim is made.

**UNVERIFIED / remaining gaps:**

- Whether `STRIPE_SECRET_KEY` is set in the real staging or production Cloudflare Worker environment (see §5, ESC-STRIPE-LIVE) is unknown. The finding is that the code path exists and executes when the secret is present; the deployed secret state was not accessible.
- Whether `services/api-gateway/src/extensions/app-functions-runtime.ts` is reachable through any route was established only by searching for importers inside `services/api-gateway/src` (none found). Dynamic or cross-package wiring was not exhaustively proven absent.
- Probe coverage is a perimeter, not a proof of absence. A capability could be reintroduced under a name none of the 55 probes matches. The ratchet catches known shapes; it is not a completeness guarantee.
- `apps/marketing-site` and `apps/platform-console` were only scanned by the forbidden-architecture `scan` probes; their route surfaces were not enumerated.
- The four reserved services and both reserved mobile roots were not independently re-audited; enforcement is delegated to the existing `no-reserved-service-activation-validator.mjs`.

## 1. What was built

| Artifact | Path (in the worktree) |
|---|---|
| Machine-readable scope registry | `config/governance/web-v1-scope-registry.json` |
| Enforcement | `scripts/validators/web-v1-scope-perimeter-validator.mjs` |
| Gate-lane wiring | `scripts/validate-governance.mjs` (one line appended) |
| Standalone scripts | `package.json` → `validate:web-v1-perimeter`, `validate:web-v1-perimeter:report` |
| Mechanism documentation | `docs/governance/web-v1-scope-perimeter-governance.md` |
| Validator index note | `scripts/validators/README.md` |

No application, payment, App Bridge, marketplace, theme or identity code was modified. No capability was removed, disabled, gated or flagged.

## 2. Location choice, justified against the authority chain

The registry lives at `config/governance/web-v1-scope-registry.json`.

- `config/governance/` already exists and already holds governance config consumed by the gate: `config/governance/anti-fabrication-allowlist.json` is read by `scripts/validators/foundation-antifabrication-gate.mjs:13`, which is validator index 0 of the gate lane. This is an established, gate-recognised location, not a new one.
- It is **config, not authority.** The registry carries `"artifactClass": "GOVERNANCE_CONFIG_NOT_AUTHORITY"` and an `authorityNote` restating the order Constitution → `AGENTS.md` → nested `AGENTS.md` → `LETBUYY_CANONICAL_SYSTEMS.md`. The validator hard-asserts that `artifactClass` value, so the file cannot be quietly re-badged as authority.
- It was **not** placed in `GOVERNANCE_REWRITE_2026_06_10/`, alongside the Constitution, or in root — any of which would imply peer or superior standing.
- It was **not** placed in `scripts/validators/`: `scripts/validators/tooling-governance-validator.mjs:49-54` permits only `.mjs`, `README.md` and `design-system-baseline.json` there.
- The validator lives in `scripts/validators/`, which `scripts/validators/README.md:3` names as the canonical home for executable governance checks, and it is wired into `scripts/validate-governance.mjs` as `scripts/validators/tooling-governance-validator.mjs:67-73` requires of every validator module.

## 3. The registry

50 capabilities, 55 probes.

| Classification | Count | Enforcement |
|---|---|---|
| `WEB_V1_REQUIRED` | 19 | none (this validator guards the exclusion side only) |
| `WEB_V1_DEFERRED` | 16 | ratchet |
| `FORBIDDEN_FROZEN` | 13 | 10 ratchet, 3 delegated |
| `HUMAN_DECISION_REQUIRED` | 2 | ratchet |

**Required (19):** merchant web auth, store creation and publication, storefront host routing, single-variant products, inventory and reservations, cart, checkout, Razorpay + COD, canonical money ledger, orders, fulfilment and tracking, refunds, coupons, GST and invoicing, shipping, one theme and editor path, transactional email, account/privacy/legal controls, deployment/monitoring/rollback.

**Deferred (16):** multi-variant products, collections, smart collections, gift cards, staff roles, multi-location inventory, purchase orders (+ suppliers), transfers, WhatsApp/SMS/push, AI features, alternative PSPs, subscription commerce, multi-currency, headless storefront API, reseller program, custom domains.

**Forbidden / frozen (13):** app-marketplace backend, App Bridge host, checkout extensions, third-party runtime execution, CQRS, event sourcing, distributed-transaction orchestration engine, multi-region topology, database sharding, service mesh, self-custody payout rail *(delegated)*, GMV take-rate fee *(delegated)*, reserved-service activation *(delegated)*.

Delegation is deliberate. Rather than add one-line alias validators — the antipattern recorded in `10_VALIDATOR_EXECUTION_MATRIX.md` for `undeclared-import-validator.mjs` and `wrangler-env-validator.mjs` — the registry names the existing enforcer and the validator asserts that the delegate file exists *and* is still wired into the gate lane. Recorded weakness: one delegate, `pricing-catalog-validator.mjs`, reports through `reporter.warn()` and cannot block; the registry says so in the `gmv_take_rate_fee` entry.

## 4. The two human decisions, honoured

**MOBILE — `apps/mobile/merchant-app` is registered `HUMAN_DECISION_REQUIRED`, not deferred and not `MOBILE_V1_1`.**

The registry records the reason: Constitution ART-04, `AGENTS.md` ARCH-R1 and `LETBUYY_CANONICAL_SYSTEMS.md` row 28 currently classify the runtime as CANONICAL with no V1/V1.1 split, and no ARB amendment authorising a deferral was found. This is enforced in code, not only asserted in prose:

- `invariants.mustBeHumanDecisionRequired` lists `mobile_merchant_app`; the validator fails if its classification changes.
- `invariants.forbiddenClassificationsFor.mobile_merchant_app` lists `WEB_V1_DEFERRED`, `MOBILE_V1_1`, `WEB_V1_REQUIRED`; the validator fails if any of those is set.
- The validator requires a `humanDecisionNote` of substance on every such capability.

Its baseline signal is `mobile_merchant_app::source_root`, explicitly annotated as **existence only** — a record that the Flutter runtime is preserved, not a scope decision. A second probe, `web_deploy_matrix_entry`, is INACTIVE and fails if `merchant-app` is ever added to the Web V1 production deploy matrix, which keeps mobile out of the Web V1 integration path.

**APP BRIDGE — untouched.** No App Bridge, app-store or marketplace file was read into a change or modified. The surface is registered `FORBIDDEN_FROZEN`, its current activation is baselined with `expectedRemoval: true`, and the registry names `codex/emergency-appbridge-killswitch` as the owner under escalation `ESC-APPBRIDGE`. `expectedRemoval` means that when the killswitch task removes the code, this ratchet emits an informational note rather than hard-failing, so the two workstreams do not collide at integration.

**`services/lcis-api` is registered `HUMAN_DECISION_REQUIRED`** as an undocumented runtime: a built Hono service (`@letbuyy/lcis-api`, with `src/`, `test/` and build/typecheck/test/start scripts) that appears in no governance topology document and in neither `canonicalServiceRoots` nor `reservedServiceRoots` in `scripts/validators/governance-common.mjs:97-111`. Same invariant enforcement as mobile. Additional probes fail if it is added to the web deploy matrix or pulled in as a gateway runtime dependency; both are INACTIVE today (`services/api-gateway/package.json` contains no `lcis` dependency).

## 5. The known-violations baseline — recorded, not hidden

**The baseline is NOT a clean state, and the artifact says so in three places.** The validator hard-asserts that `knownActivationsBaseline.heading` contains the literal string `NOT A CLEAN STATE`, so the disclaimer cannot be edited away without failing the check. It also asserts `recordedCount === signals.length`, so the count cannot drift from reality, and requires ≥20 characters of file-level evidence on every entry.

**32 activation signals were already live at `ee371182`.** Four are marked `expectedRemoval` (owned by the App Bridge killswitch task and the Wasm escalation). Summary:

| Capability | Baselined signals | Status |
|---|---|---|
| multi-variant products | merchant variant editor, storefront variant selector | live, unflagged |
| collections | merchant UI, merchant API, storefront collection page | live, unflagged |
| smart collections | merchant UI, gateway mount | live, unflagged |
| gift cards | merchant UI, gateway router file, gateway registration | live merchant-side; storefront checkout redemption INACTIVE (probe armed) |
| staff roles | merchant UI | live, unflagged |
| multi-location inventory | merchant UI, merchant API | live, unflagged |
| purchase orders | merchant UI, merchant API, suppliers UI | live, unflagged |
| transfers | merchant UI, merchant API | live, unflagged |
| WhatsApp/SMS/push | gateway router file, gateway mount | WhatsApp live at API layer, no feature gate; no nav entry; SMS router INACTIVE (probe armed) |
| AI features | merchant UI, gateway mount | live, unflagged |
| headless storefront API | gateway GraphQL gate | mounted behind `graphQLFeatureGate` |
| custom domains | merchant UI, gateway mount | live, unflagged |
| alternative PSPs | runtime client wiring | **see ESC-STRIPE-LIVE below** |
| app-marketplace backend | gateway app-store routes | live in a deploy target (`expectedRemoval`) |
| App Bridge host | merchant bridge client | live in a deploy target (`expectedRemoval`) |
| checkout extensions | gateway extension gate | mounted (`expectedRemoval`) |
| third-party runtime execution | gateway Wasm runtime | **see ESC-WASM-APPFUNCTIONS below** (`expectedRemoval`) |
| mobile merchant app | source root | existence only, no scope decision |
| services/lcis-api | source root | existence only, pending classification |

### Two conflicts this work found that Phase 1 did not report

**ESC-STRIPE-LIVE — alternative PSPs are not cleanly deferred.** `07_WEB_V1_SCOPE_REGISTER.md` §5 recorded alternative PSPs as *"No — genuinely deferred, cleanly stubbed"* and cited them as the pattern the other deferrals should follow. That conclusion is falsified at the gateway layer:

- `services/api-gateway/src/routes/payments.ts:13` imports `createStripeCheckoutSessionWithFetch` from `@letbuyy/infrastructure/stripe-adapter`; `:1265-1284` returns 503 when `c.env.STRIPE_SECRET_KEY` is unset and otherwise creates a live Stripe Checkout session.
- `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:23` imports `createStripePaymentProvider`; `:961-993` applies the same env check and then creates a payment intent through the idempotency adapter.
- `services/api-gateway/src/index.ts:142` declares `STRIPE_SECRET_KEY` on the gateway `Env`.

Deferral is achieved by the **absence of a deployed secret**, which is an environment condition, not a code perimeter. Phase 1 reached the opposite conclusion because it inspected `checkout-client.tsx` (which carries the `// V1 ships Razorpay+COD; Stripe and PayPal deferred (LB-2)` comment) and searched for dedicated PSP route files, of which there are none. The wiring is inside the shared payments and storefront-checkout routers. Recorded as an escalation; **no payment code was changed.** The dedicated-PSP-router probes remain INACTIVE, so adding `routes/stripe.ts` or mounting `/stripe` still fails the ratchet.

**ESC-WASM-APPFUNCTIONS — a third-party Wasm runtime exists in the canonical gateway.** `services/api-gateway/src/extensions/app-functions-runtime.ts:437` calls `WebAssembly.instantiate` on a verified third-party module and feeds its output into `createAppFunctionCheckoutDecision`. `AGENTS.md` NEVER-R3 names *"checkout extensions / app-functions / Wasm runtime in the live path"* as MUST NOT BUILD. No importer of this module was found inside `services/api-gateway/src`, so it is present and compiled but not currently mounted. Ownership is unresolved — it sits adjacent to the App Bridge killswitch scope — so it is baselined with `expectedRemoval: true` and escalated. **No extension code was changed.**

## 6. The check, and proof that it actually fails

Ratchet semantics:

| Situation | Result |
|---|---|
| Probe active, signal in baseline | pass |
| Probe active, signal **not** in baseline | **hard failure** (`reporter.assert`) |
| Probe inactive, signal in baseline, `expectedRemoval: false` | **hard failure** — tighten the baseline |
| Probe inactive, signal in baseline, `expectedRemoval: true` | informational note |
| Probe inactive, signal not in baseline | pass |

There is deliberately **no `--update` flag**. Absorbing a new activation requires a human edit to the registry, so it is always a reviewable diff. `--report` prints every probe state and never asserts.

**Enforce run** — `node scripts/validators/web-v1-scope-perimeter-validator.mjs`, **exit 0**:

```
Web V1 scope perimeter validator passed (50 capabilities registered; 28 ratcheted, 3 delegated; 32 known pre-existing activations held flat; 0 new activations).
```

**Negative test 1 — new activation must fail.** A temporary empty file `services/api-gateway/src/routes/sms.ts` was created (SMS is deferred and its probe was INACTIVE), the validator was run, and the file was deleted immediately. **exit 1**:

```
Web V1 scope perimeter validator failed:
- NEW activation of an excluded or forbidden Web V1 capability detected.
The Web V1 perimeter is frozen at ee3711829d857e986014c5811bb94d86ebc3d343.
If this activation is intended, it needs a human decision recorded in config/governance/web-v1-scope-registry.json before the gate can pass.
  - whatsapp_sms_push::sms_gateway_router_file [WEB_V1_DEFERRED] activated by: services/api-gateway/src/routes/sms.ts
```

`git status --short` after the test showed only the two intended new files; the fixture left no residue.

**Negative test 2 — a baseline that stops being true must fail.** A bogus baseline entry for the INACTIVE `cqrs::runtime_wiring` signal was added, the validator was run, and the registry was restored from a backup. **exit 1**:

```
Web V1 scope perimeter validator failed:
- Stale known-violations baseline entries: these capabilities are no longer active, so the ratchet must tighten.
Remove these entries from knownActivationsBaseline.signals (and decrement recordedCount) in the same change:
  - cqrs::runtime_wiring
```

The restored run returned exit 0 again. This is what makes it a ratchet rather than a permanent amnesty: the baseline can only shrink.

**Regression check on the validators that police the gate itself** — all exit 0 after the change: `tooling-governance-validator` (13 tooling directories, new validator correctly wired), `meta-no-theater-validator` (the new name introduces no forbidden gate fragment), `whole-repo-end-state-validator`, `no-noop-test-script-validator`, `foundation-antifabrication-gate` (1,905 source files), `architecture-validator` and `generated-artifact-validator` (6,904 tracked files each), `frozen-path-override-gate`.

### The check does not currently run inside `pnpm validate:governance` — and the clean baseline is worse than Phase 1 recorded

`scripts/validate-governance.mjs:194-207` runs validators sequentially and exits on the first non-zero status. Measured fresh on this clean worktree at the baseline SHA, `node scripts/validate-governance.mjs --lane=gate` returns **exit 1 at validator position 2 of 109** — `tenant-isolation-validator.mjs`, not `validate-design-system.mjs`:

```
Foundation anti-fabrication gate passed (1905 active source files scanned; 0 temporary entries tracked).
Tenant isolation validator failed:
- services/api-gateway/src/tenant/tenant-tables.registry.ts must match schema-derived tenant table registry; run scripts/generators/generate-tenant-table-registry.mjs
```

This **differs from and is worse than** the Phase 1 finding of "exits 1 at validator #6". Phase 1 measured on the dirty original working tree, which contains an uncommitted regenerated `tenant-tables.registry.ts`; on the clean committed baseline that regeneration is absent and the gate dies four validators earlier. **107 of 109 gate-lane validators never execute at the committed baseline.** Remeasured independently, not copied.

Run standalone on the clean worktree, `validate-design-system.mjs` reports **1 hard invariant violation + 9 ratchet regressions** (`marketing-site` dark-mode reachability; `appCssRawHex` 0→98, `appCssNakedRgbHsl` 572→849, `appLocalLbTokenRedefs` 112→220, `rawPxFontSize` 533→604, `rawPxSpacing` 1365→1568, `tsxInlineStyles` 635→673, `tsxRawHex` 0→5, `tsxArbitraryRadius` 327→387, `tsxArbitraryShadow` 8→9). Phase 1 reported 2 hard invariants (`marketing-site` **and** `developer-portal`); the second does not reproduce on the clean tree. Also remeasured, not copied.

Consequence, stated plainly: **wiring this validator into the gate lane does not make it run today.** That is why it is also exposed as `pnpm validate:web-v1-perimeter`, which is what was executed for every result above. Both facts are recorded in the registry as escalation `ESC-GATE-FAILFAST` and in `docs/governance/web-v1-scope-perimeter-governance.md`.

Two ordering choices were deliberately **not** made: existing validators were not reordered to move this one ahead of the failures (that would change gate semantics without authority), and the `fs.rmSync` generated-directory purge at `scripts/validate-governance.mjs:170-200`, gated behind `stale-artifact-validator.mjs`, was not touched. The gate run above terminated long before that step; the worktree has no `node_modules`, so nothing was deleted.

## 7. Raw evidence

`/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/W0-V1-PERIMETER/`

| File | Contents |
|---|---|
| `01-perimeter-report.txt` | Full 55-probe state listing, exit 0 |
| `02-perimeter-enforce.txt` | Enforce run, exit 0 |
| `03-negative-test-new-activation.txt` | New-activation failure, exit 1 |
| `04-negative-test-stale-baseline.txt` | Stale-baseline failure, exit 1 |
| `05-full-gate-run-clean-worktree.txt` | Full gate, exit 1 at position 2 of 109 |
| `06-design-system-clean-worktree.txt` | Design-system standalone, 1 hard + 9 ratchet |

## 8. Commit

`2c84e1a9` on `codex/w0-v1-perimeter`, 6 files, +911 lines, **local only — not pushed, no PR, no deploy.**

`git commit --no-verify` was used. Disclosed in full: `core.hooksPath` is not configured in this worktree, so no hook would have executed either way. The two hook stages relevant to this change were run manually and both passed (`frozen-path-override-gate.mjs` → "no locked paths staged", `foundation-antifabrication-gate.mjs` → 1,905 files, 0 entries). The hook's third stage, `validate-design-system.mjs`, fails identically at the untouched baseline (§6) and is unrelated to this change, which touches only `.json`, `.mjs` and `.md` files.

## 9. What was deliberately NOT done

- No Wave 1 removal or cutover was implemented.
- No capability was disabled, removed, gated or feature-flagged. The nine already-live deferred capabilities remain reachable exactly as they were.
- No App Bridge, app-store, marketplace, extension or payment code was modified.
- No file outside the worktree was created or edited except this deliverable and the six raw-evidence files, both under the authorised paths.
- The original repository's working tree was not cleaned, staged, stashed, reset, restored or committed.
- No push, PR, deploy, provider call, or Supabase command of any kind was run.

## 10. Open items requiring a human

1. **ESC-STRIPE-LIVE** — decide whether the Stripe path in the canonical gateway is removed, hard-gated in code, or accepted for Web V1 with the env-var-only deferral documented as the actual control. Phase 1 doc 07 §5 should be corrected either way.
2. **ESC-WASM-APPFUNCTIONS** — assign ownership of `services/api-gateway/src/extensions/app-functions-runtime.ts` and decide removal versus a Constitution amendment. It is currently unimported but compiled into a deploy target.
3. **ESC-APPBRIDGE** — resolved by the separate `codex/emergency-appbridge-killswitch` task; the baseline entries are pre-marked `expectedRemoval` so this ratchet will not obstruct it.
4. **ESC-DEFERRED-LIVE** — decide, per capability, whether each of the nine live-but-deferred capabilities ships in Web V1 or is gated. There is no feature-flag pattern in `apps/merchant-control-plane/src` or `apps/storefront-runtime/src` to gate them with today.
5. **`apps/mobile/merchant-app`** — the governance chain calls it CANONICAL. Either an ARB amendment authorises a V1.1 deferral, or Web V1 scope must accommodate it. Wave 0 asserts neither.
6. **`services/lcis-api`** — classify the undocumented runtime: canonical, reserved, tooling-only, or delete.
7. **ESC-GATE-FAILFAST** — until the gate stops dying at position 2 of 109, this validator and 106 others contribute nothing to `pnpm validate:governance`. Wire `validate:web-v1-perimeter` into CI independently, or fix the gate.
