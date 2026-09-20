# REPOSITORY FORENSICS REPORT — Convergence Cleanup 2026-06-10 (Phase 1)

**Phase:** 1 of N — REPOSITORY FORENSICS (fresh, independent re-derivation).
**Mode:** DISCOVERY ONLY. No source modified except this report. Read-only git. No implementation, no deletion, no migrations, no codex prompts.
**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `c4fc3cd6898215f53fb462800ca526f649ce37ae` (2026-06-10 08:42 +0530) · `main` is the only deploy branch, **30 commits behind**.
**Working tree (re-verified fresh):** `git status --porcelain` → **512 deleted (D) · 410 modified (M) · 78 untracked (??)**. Markdown files repo-wide: **1,254** (`find . -name '*.md' -not -path './node_modules/*' | wc -l`).
**Method:** Every material claim below is derived this phase from `grep`/`find`/`git`/`Read` against live source and cites `path:line` or the exact command. Prior audits (`REPOSITORY_TRUTH_AUDIT_2026_06_10/`, `CONVERGENCE_AUDIT_2026_06_10/`) were consulted for completeness; every reused claim was re-verified against source and any delta is flagged **[DELTA]**. Live infrastructure / DB / payment-provider state is **UNVERIFIED** throughout (repo evidence only).

---

## 1. Executive Summary

1. **Duplication in this repo is overwhelmingly *temporal* before it is *spatial*.** Three realities co-own every load-bearing domain: `main` (the only branch CI deploys), `HEAD` (`stepup/main`, +30), and the **uncommitted working tree** (the hardened end-state). The working tree is the only reality conforming to the Constitution and the only one with **zero version-control protection** — authority and durability are inversely correlated. Concretely re-verified this phase: 512 tracked deletions and 78 untracked files are the *entire* convergence end-state, including migrations 162–166 (untracked) and the deletion of 8 distributed-architecture packages and 77 validators that **still exist at `HEAD`**.

2. **The single largest spatial duplicate is an entire distributed/CQRS/multi-region architecture that exists at three layers at once** — package source (`packages/distributed-runtime` 77 files, `projection-runtime` 18, `orchestration` 16, `runtime-composition` 15, `application-services` 15, `app-engine` 5, `extension-host` 4, `search-core` 4 — **all present at `HEAD`**, all `D`-deleted only in the working tree), config contracts (`config/runtime/` carries `multi-region-runtime.json`, `distributed-consistency-contract.json`, `durable-execution-contract.json`, `projection-recovery-manifest.json`, `replay-*`, `runtime-causality-graph.json`), and **validators that mandate them** (`governance-common.mjs:142-150` declares 7 `rejectedPackageRoots`; the survivability + end-state validators *require* the 4-region runtime). The monolith/one-region decision condemns this layer; the law still enforces it.

3. **Two duplications are self-inflicted by the governance code itself (the survivability self-block).** Re-verified fresh: `scripts/validators/whole-repo-end-state-validator.mjs:172-177` asserts `productionTopology.regions.globalRegions` must include `india, apac, eu, us`; `scripts/validators/survivability-governance-validator.mjs:94-95,106-107` asserts the multi-region runtime contract must contain those 4 regions and that production topology must project `globalRegions.length >= 4`. The Constitution forbids certifying multi-region. **The gate mandates the architecture the Constitution voids.** `config/runtime/multi-region-runtime.json` indeed declares `india/apac/eu/us`.

4. **The two user-facing S0 duplicates survive the merge.** (a) **Auth/session mint** — `services/api-gateway/src/routes/auth.ts:1140` mints `const token = providedToken || randomHex(32)` (opaque, gateway-owned, present in committed reality) while `apps/identity-platform/src/lib/auth/identity-issued-session.ts` mints asymmetric EdDSA/ES256 JWTs (the named winner, working-tree-leaning). (b) **Payments capture** — `database/supabase/migrations/000_baseline.sql:1590` defines `confirm_order_payment_with_ledger(...)` which, re-read in full this phase (lines 1590-1709), writes **only** to `payment_transactions` and `payment_attempts` and performs **zero** inserts into any canonical ledger table. The function name asserts a ledger posting that does not occur, in all three realities.

5. **The canon already names a winner for almost every duplicate** — these are *decided conflicts whose losers still hold live authority*, kept alive by (a) the deciding documents being uncommitted, (b) the winner being undeployed/unwired, or (c) a validator structurally grandfathering the loser (e.g. `identity-sole-issuer-validator.mjs:10-15` and `canonical-ledger-only-validator.mjs:22-32` both ship explicit `legacyAllowed*` allowlists for the losing implementations).

6. **Fresh key counts (all re-derived this phase):** `getSupabaseAdmin` = **917 occurrences across 99 files**, all inside `services/api-gateway`. merchant-control-plane second-backend route surface = **62 `route.ts`**. Nested non-root `AGENTS.md` on disk = **79** (61 active + 18 archived) **[DELTA: prior CONVERGENCE audit said "38 nested" — the *active* count is 61]**. Validators on disk = **133** (`.mjs`), of which **77 are `D`-deleted in the working tree** and **90 are referenced by `scripts/validate-governance.mjs`**. CODEX prompt files repo-wide = **138**; MISSION files = **76**. Commission `300`-bps fallback survives only as test fixtures + the migration-162 rollback (default-300) and the validator regex that hunts `?? 300`. The payout adapter throws `PayoutProviderUnavailable` whenever no live provider client is configured (`payout-transfer-adapter/index.ts:84-87,103-105`) — money-out is a hard-fail stub.

---

## 2. Method & Independent-Verification Notes (deltas from prior reports)

**What I verified directly (commands run this phase):**
- Baseline: `git rev-parse HEAD` = `c4fc3cd6…`; `git rev-list --count main..HEAD` = `30`; `git status --porcelain | awk '{print $1}' | sort | uniq -c` = `78 ?? · 512 D · 410 M`.
- `getSupabaseAdmin`: `grep -rn "getSupabaseAdmin" services/ apps/ packages/ --include='*.ts' --include='*.tsx'` → 917 lines / 99 files; breakdown by root → **100% in `services/api-gateway`**.
- merchant-control-plane: `find apps/merchant-control-plane/src/app/api -name route.ts | wc -l` = **62**.
- Nested AGENTS.md: `find . -name 'AGENTS.md' -not -path './node_modules/*' | grep -v '^\./AGENTS.md$' | wc -l` = **79**; archived (`*/docs/archive/*`) = 18; active = 61.
- Survivability self-block: read `whole-repo-end-state-validator.mjs` and `survivability-governance-validator.mjs` in full (quoted in §6 and §3-Arch).
- Ledger emptiness: read `000_baseline.sql:1587-1709` (`confirm_order_payment_with_ledger`) in full.
- Commission: read `commission-bps-zero-validator.mjs` in full; `grep` for `300` bps in source → only `packages/billing-core/test/...:168` and `packages/payments/test/...:46` (both tests) + rollback file default-300.
- Payout: read `packages/infrastructure/payout-transfer-adapter/index.ts` in full.
- Rejected/canonical/reserved roots: read `governance-common.mjs:55-150`.
- Distributed packages at HEAD vs worktree: `git ls-tree -r --name-only HEAD -- packages/<p>` vs `git status --porcelain | grep '^.D'`.

**Deltas / corrections vs prior audits:**
- **[DELTA] Nested AGENTS.md = 79 (61 active), not 38.** The prior CONVERGENCE `DUPLICATE_AUTHORITY_REPORT` cites "38 nested generated AGENTS.md." Fresh on-disk count is 79 non-root; even excluding the 18 archived copies the *active* proliferation is **61** (packages 24, apps 12, services 10, infrastructure 7, docs 5, plus `load/`, `chaos/`). Treat 61 as the active scan-AGENTS authority count.
- **[DELTA / CORRECTION] `packages/token-core` is an AUTH-token package, not a design-token package.** Prior user-memory describes token-core as "the design-token package (0/9 shell adoption)." Source disagrees: `packages/token-core/src/index.ts:1-30` defines `TokenKind = id_token | access_token | refresh_token | authorization_code | … | machine_token` and `TokenEnvelope` — it imports `@letbuyy/auth-core/keys` and `@letbuyy/identity-core`. **Design tokens live in `packages/typescript/ui/src/tokens.ts → tokens.json`** (the authority enforced by `token-source-single-validator.mjs:11-15`). token-core belongs in the **identity/token-issuance** cluster, not the UI cluster. (token-core is imported in only 2 files — still low-adoption, but as an auth abstraction.)
- **[CONFIRMED EXACT] getSupabaseAdmin = 917, merchant-control-plane = 62, confirm_order_payment_with_ledger at `000_baseline.sql:1590`, randomHex at `auth.ts:1140`, multi-region self-block at the two validators** — all match prior audits to the line.
- **[DELTA, posture] The forbidden mobile token forks are now GONE from disk** (`mobile-tokens.ts`, `letbuyy_color_tokens.dart`, `light/dark/store_admin_colors.dart` all absent). The fork is historical; only the *validator* policing it remains. The mobile **model** fork (`theme_editor_models.dart` etc.) is still live (§13).
- **[CONFIRMED] migrations 162–166 are untracked (`??`)** — `162_phase_a_commission_zero.sql`, `163_d2_live_data_leak_rls.sql`, `164_d4_tenant_role_guc.sql`, `165_d5_canonical_money_paths.sql`, `166_d6_checkout_handoff_inventory.sql`. Plus `090` and `100` are `M` (modified, uncommitted).

---

## 3. DUPLICATION FORENSICS LEDGER (master)

One row per duplicate cluster. **Plane** = which reality each authority leans toward (M=`main`/committed, H=`HEAD`, W=working-tree, ALL=present in all three). **Kind:** system / ownership / arch / prompt / doc / service / package / infra / payment / identity / theme / ui.

| # | Domain | Authorities / implementations found (path) | Plane | Kind | Evidence (path:line / cmd) |
|---|---|---|---|---|---|
| L1 | **Temporal triplication (meta)** | `main` (deployable) · `HEAD` +30 · working tree (512 D / 410 M / 78 ??) | M·H·W | arch/system | `git status --porcelain` counts; `git rev-list --count main..HEAD`=30 |
| L2 | **Distributed/CQRS architecture (packages)** | `packages/distributed-runtime` (77 f) · `projection-runtime` (18) · `orchestration` (16) · `runtime-composition` (15) · `application-services` (15) · `app-engine` (5) · `extension-host` (4) · `search-core` (4) | present **H**, deleted **W** | arch/package | `git ls-tree -r HEAD -- packages/distributed-runtime`=77; `git status` `^.D`; `governance-common.mjs:142-150` rejectedPackageRoots |
| L3 | **Multi-region runtime (config + validators)** | `config/runtime/multi-region-runtime.json` (india/apac/eu/us) · `production-topology.json` globalRegions · mandated by `survivability-governance-validator.mjs:94-107` + `whole-repo-end-state-validator.mjs:172-177` | ALL (config) / self-block | arch/infra | quoted §6; Constitution forbids multi-region (per memory) → **self-block** |
| L4 | **Distributed contracts (config family)** | `distributed-consistency-contract.json` · `distributed-execution-contract.json` · `durable-execution-contract.json` · `replay-{safety,evolution,branch}*.json` · `runtime-causality-graph.json` · `failure-domain-manifest.json` · `projection-recovery-manifest.json` | ALL (config) | arch/doc | `ls config/runtime/` (66 json/schema files) |
| L5 | **Auth — session mint** | gateway `auth.ts:1140` `randomHex(32)` (opaque) · identity-platform `identity-issued-session.ts` (EdDSA/ES256) · auth-core `customer-session.ts`/`session.ts` (HS256) | M/H (gateway) vs W (identity) | identity/system | `auth.ts:1140`; `identity-issued-session.ts:1-20`; `identity-sole-issuer-validator.mjs:10-15` legacy allowlist |
| L6 | **Token issuers (sole-issuer ratchet)** | `apps/identity-platform/*` (allowed) + `legacyAllowedUntilD3`: `auth-core/index.ts`, `auth-core/customer-session.ts`, `auth-core/storefront-access.ts`, `gateway/identity-foundation/mock-key-service.ts` | mixed | identity/ownership | `identity-sole-issuer-validator.mjs:10-37` |
| L7 | **AUTH_SECRET (HS256) reuse fanout** | webhook-svc, gateway (cart/checkout/internal-console/export/media), platform-console, identity-platform, auth-core — same secret, ≥7 signing purposes | ALL | identity/security | `grep AUTH_SECRET` → 15 non-test sites incl. `cart-routes.ts:307`, `checkout.ts:88`, `internal-console.ts:439`, `media.ts:60`, `console-session.ts:24`, `cookies.ts:13` |
| L8 | **OIDC issuer** | `apps/identity-platform/src/app/oauth2/*` (token/authorize/userinfo/consent/logout/callback — all 404/501 disabled) + `oidc-disabled.ts` placeholder JWKS (`disabled-x-coordinate`) | ALL | identity/system | `oidc-disabled.ts:1-37`; `grep 501/disabled` in `oauth2/` = 6 routes |
| L9 | **JWKS source** | published `/.well-known/jwks.json` → disabled placeholder · env-injected local set verified gateway-side | ALL | identity | `oidc-disabled.ts:4-15` (literal `disabled-x/y-coordinate`) |
| L10 | **Cookie realms** | storefront-runtime (host-only, no domain) · identity-platform `cookies.ts` (`COOKIE_DOMAIN`) · merchant-control-plane `auth/logout` (`COOKIE_DOMAIN`) · auth-core `storefront-access.ts` (`__Host-` gate) · gateway (random token) | ALL | identity/ownership | `cookie-realm-validator.mjs:10-58` enumerates all 4+ authorities |
| L11 | **Payments capture — ledger** | `confirm_order_payment_with_ledger` SQL (writes only payment_transactions + payment_attempts) vs canonical `ledger_transactions`/`ledger_entries` required by validator | ALL | payment/system | `000_baseline.sql:1590-1709`; `canonical-ledger-only-validator.mjs:39-40` |
| L12 | **Ledger table proliferation** | `gift_card_ledger_entries` (baseline) · `partner_payout_ledger_entries` (baseline) · canonical `ledger_transactions`/`ledger_entries` (migrations 119/139/151/160) · mutable balances | ALL | payment/system | `grep CREATE TABLE.*ledger` baseline + migrations 119/139/151/160/165 |
| L13 | **Money-mutation bypass allowlist** | 9 gateway files mutate money tables WITHOUT canonical ledger evidence | ALL | payment/ownership | `canonical-ledger-only-validator.mjs:22-32` `legacyAllowedUntilD5` (queue-execution.adapter, platform-queue-consumer, 5× app-store routes, internal-developer-ops, theme-marketplace-aux) |
| L14 | **Commission economics (300 bps)** | migration `162` sets default 0 · rollback `162` restores `DEFAULT 300` · validator hunts `?? 300`/`commission_bps = 300` · test fixtures `platform_fee_minor: 300` | M/H (old) vs W (162) | payment/system | `commission-bps-zero-validator.mjs:27-57`; `billing-core.test.ts:168`; `payments.test.ts:46` |
| L15 | **Payout rails** | `payout-transfer-adapter` (`razorpay_route|razorpayx|upi|manual`) throws `PayoutProviderUnavailable` if no provider · `partner_payout_ledger_entries` rail enum · no live client | ALL | payment/system | `payout-transfer-adapter/index.ts:1-124`; `000_baseline.sql:10252` rail check |
| L16 | **Commerce/merchant backend** | `services/api-gateway/src/routes` (84 route files, owns DB via 99× getSupabaseAdmin) · `apps/merchant-control-plane/src/app/api` (62 route.ts BFF proxies via `@letbuyy/api-client`) · `apps/storefront-runtime` (21 API routes, proxies) | ALL | ownership/system | `find … routes`=84; `find … api`=62; `products/route.ts:2,35` proxies `createMerchantApiClient()` |
| L17 | **Theme renderer** | React-component registry `renderer-registry.tsx` (default; `core.header`/`core.product-grid`… render fns) · Liquid path `liquid-hydration-islands.tsx` + `composition-engine.tsx` + `template-resolver.ts` | ALL | theme/system | `theme-engine/renderer-registry.tsx`; `liquid-hydration-islands.tsx`; `grep liquid` storefront=5 files |
| L18 | **Theme engine location** | `apps/storefront-runtime/src/lib/theme-engine/*` (live renderers) vs `packages/theme-engine/src/*` (8 ts, imported 62×) | ALL | theme/ownership | two theme-engine roots; `governance-common.mjs:131` lists `packages/theme-engine` |
| L19 | **Theme editors** | web `merchant-control-plane/.../themes/[themeId]/editor` + `components/theme-editor` + `api/themes/[themeId]/editor` · mobile `merchant-app/lib/screens/editor` + `widgets/editor` | ALL | theme/system | `find -iname '*editor*'` |
| L20 | **Design tokens** | `packages/typescript/ui/src/tokens.ts → tokens.json` (canonical) · `packages/dart/ui_kit/.../letbuyy_tokens.dart` (generated bridge) · forbidden forks (now gone) | ALL | ui/system | `token-source-single-validator.mjs:11-23` |
| L21 | **Marketplace UI components** | `app-marketplace/src/lib/logger.ts` + `theme-marketplace/src/lib/logger.ts` (local) must wrap `@letbuyy/ui/logging`; `MarketplaceUnavailable.tsx` vs `marketplace-unavailable.tsx` | ALL | ui/ownership | `marketplace-single-source-validator.mjs:40-67` |
| L22 | **Marketing dead twins** | dead: `Navbar/HeroSection/FeaturesSection/PricingSection/TestimonialsSection/Testimonials/CTASection/SocialProof/Capabilities.tsx` (archived) vs live `Header/Hero/Features/Pricing/Testimonials/CTA…` | ALL | doc/ui | `marketing-dead-twin-validator.mjs:9-45`; live forks removed, archive copies required |
| L23 | **Validators (alias/duplication)** | 133 `.mjs` on disk; 77 `D`-deleted in WT; 90 referenced by gate; 6 lane aliases → fewer real checks | 133 W / +distributed at H | system/governance | `ls scripts/validators/*.mjs`=133; `git status ^.D` validators=77 |
| L24 | **Governance law (two texts)** | root `AGENTS.md` (promoted) vs `GOVERNANCE_REWRITE_2026_06_10/` source copy · `docs/governance` (38 files `D`-deleted WT) · 61 active nested AGENTS.md | ALL | doc/governance | `find AGENTS.md`=79; `git status ^.D docs/governance`=38 |
| L25 | **Prompt / mission families** | `docs/Codex_waves` (16 MISSION + 5 TERMINAL + master + V1/V2 blueprints) · `docs/archive/prompts` (13, incl. `_RECREATED`/`_V2` twins) · 138 CODEX_* repo-wide · 76 MISSION repo-wide | ALL | prompt | `find -iname '*MISSION*'`=76; `find -iname 'CODEX_*.md'`=138 |
| L26 | **Reserved vs real services** | 4 real (api-gateway, mobile-bff, webhook-service, queue-workers — have wrangler.toml) vs 6 reserved manifest-only (checkout-runtime, search-service, media-service, notification-service, event-bus, analytics-pipeline) | ALL | service | `find wrangler.toml`=4; `governance-common.mjs:104-111` reservedServiceRoots |
| L27 | **Frozen vs canonical apps** | 6 canonical + 4 frozen apps still shipping code (app-marketplace 91, theme-marketplace 65, platform-operations-portal 32, developer-portal 20 ts/tsx) | ALL | service/ownership | `find apps/<frozen>/src`; `governance-common.mjs:66-71` frozenAppRoots |
| L28 | **Deploy matrices** | Cloudflare workers (4 wrangler.toml) · Vercel (9 vercel.json) · `config/runtime/deployment-topology.json` + `production-topology.json` (21 runtime roots incl. reserved+frozen) · k8s/helm (archived dead twin) | ALL | infra | `find wrangler.toml`=4, `vercel.json`=9; helm/k8s only under `docs/archive/infra-deployment-legacy-2026-06-10/` |
| L29 | **Mobile model forks** | `apps/mobile/merchant-app/lib/models/*` vs `packages/dart/models/lib/src/merchant_app/*` — 5 colliding basenames (order_model, store_auth_request_model, store_model, store_theme_model, theme_editor_models) | ALL | ui/ownership | `comm -12` of basenames; `theme_editor_models.dart` 7-line shim vs 160-line real |
| L30 | **Dart package (partial worktree deletion)** | `packages/dart` 69 files on disk / 70 at HEAD / 4 `D` in WT | H vs W | package | `git ls-tree HEAD -- packages/dart`=70; `git status ^.D packages/dart`=4 |
| L31 | **Admin DB client factory** | canonical `gateway/src/lib/supabase.ts getSupabaseAdmin` + re-decls in `internal-developer-ops.ts`, `internal-compliance.ts` | ALL | system | `grep 'export.*getSupabaseAdmin'` = 3 files |

---

## 4. Category 1 — Duplicate SYSTEMS (two+ implementations of one problem)

The repo's defining anti-pattern (`ANTI-R1` "two parallel systems") reproduces across every money/identity/theme surface. Concrete system pairs (evidence in ledger):

- **Session minting** (L5): opaque `randomHex(32)` (gateway, committed) vs asymmetric JWT (identity-platform, working-tree). Two issuers, two crypto models, two revocation stories (Postgres `sessions` row vs stateless JWT).
- **Payments capture** (L11): a SQL function *named* `confirm_order_payment_with_ledger` that does not touch the canonical ledger, vs the validator-required `post_settlement_ledger_transaction` / `buildPaymentCaptureLedgerPosting` pathway. The name encodes a system that isn't wired.
- **Theme rendering** (L17): a React component registry (`renderer-registry.tsx`, 30+ `rendererKey` → render-fn pairs) is the default path; a Liquid path (`liquid-hydration-islands.tsx`, `composition-engine.tsx`, `template-resolver.ts`) is the canary. Two template languages, two compose engines, in the same `theme-engine/` directory.
- **Distributed vs monolith runtime** (L2/L4): a CQRS/event-sourced/replay runtime (8 packages + ~15 config contracts) parallels the monolithic gateway. The monolith is the decision; the distributed system is still committed at HEAD.
- **Validator aliasing** (L23): `scripts/validate-governance.mjs` references 90 validator names but several are lane-aliases of one underlying check; 133 `.mjs` exist on disk while 77 are slated for deletion — three populations (referenced / on-disk / surviving).

## 5. Category 2 — Duplicate OWNERSHIP (two+ owners of one domain/route/table)

- **Merchant domain owned twice** (L16): `services/api-gateway/src/routes` is the data owner (84 route files; **all 917 `getSupabaseAdmin` calls live here**), but `apps/merchant-control-plane/src/app/api` re-declares **62** of the same endpoints (`/stores/[store]/products`, `/orders`, `/customers`, `/coupons`, `/taxes`, `/inventory`, `/gift-cards`, `/payment-config`…) as Next.js BFF proxies that call `createMerchantApiClient()` (verified `products/route.ts:2,35`). This is duplicate **route/contract ownership** (two API surfaces for one domain), not a duplicate DB backend — merchant-control-plane holds **no** supabase/gateway-client of its own (grep for `@supabase`/`createServiceClient` in its src = 0). `apps/storefront-runtime` adds a **third** API surface (21 routes, also proxying — `orders/route.ts:48` `createStorefrontApiClient()`).
- **Token issuance owned by 2+ realms** (L6): `identity-sole-issuer-validator.mjs` says identity-platform must be the *only* signer, then grandfathers 4 non-identity-platform signing files.
- **Cookie realm owned by 4+** (L10): storefront-runtime / identity-platform / merchant-control-plane / auth-core each set or own cookies under different domain rules.
- **Money-table writes owned by 9 bypass files** (L13): the canonical-ledger ratchet allowlists 9 gateway files that write `payment_transactions`/`payout_statements`/`refunds`/`settlements` without ledger evidence.
- **Admin DB client owned 3×** (L31): one canonical factory + 2 internal re-declarations.

## 6. Category 3 — Duplicate ARCHITECTURE (monolith vs distributed/CQRS/multi-region)

**This is the largest cluster and the source of the self-block.** Fresh quotes:

`scripts/validators/whole-repo-end-state-validator.mjs:171-177`:
```
reporter.assert(productionTopology?.canonicalDomain === "letbuyy.com", …);
for (const region of ["india", "apac", "eu", "us"]) {
  reporter.assert(
    productionTopology?.regions?.globalRegions?.includes(region),
    `Production topology must include global region contract ${region}`,
  );
}
```
`scripts/validators/survivability-governance-validator.mjs:93-107`:
```
const regionIds = new Set((multiRegion?.regions || []).map((region) => region.id));
for (const region of ["india", "apac", "eu", "us"]) {
  reporter.assert(regionIds.has(region), `Multi-region runtime contract missing region: ${region}`);
}
…
reporter.assert(
  productionTopology?.regions?.globalRegions?.length >= 4,
  "Production topology must project globalRegions from the multi-region runtime contract",
);
```
`config/runtime/multi-region-runtime.json` → regions `india`, `apac`, `eu`, `us` (verified). So the law **requires** the 4-region, failover-paired, multi-region topology that the monolith/one-region decision forbids certifying. This is **S0 governance theater**: the gate cannot pass and honor the Constitution simultaneously.

**The same architecture exists as deletable source** (`governance-common.mjs:142-150`):
```
export const rejectedPackageRoots = [
  "packages/app-engine", "packages/application-services", "packages/distributed-runtime",
  "packages/extension-host", "packages/orchestration", "packages/projection-runtime",
  "packages/runtime-composition",
];
```
`whole-repo-end-state-validator.mjs:52-54` asserts each of these "must be deleted" — yet `git ls-tree -r HEAD` shows all 7 (+`search-core`) **present at HEAD** (150 files total: distributed-runtime 77, projection-runtime 18, orchestration 16, runtime-composition 15, application-services 15, app-engine 5, extension-host 4, search-core 4). They are `D` only in the uncommitted working tree. **The end-state validator therefore passes only against the working tree and would FAIL against HEAD** — the very reality CI deploys from.

The config layer (`config/runtime/`, 66 json/schema files) is the third face of this duplicate: `distributed-consistency-contract.json`, `distributed-execution-contract.json`, `durable-execution-contract.json`, `replay-{safety,evolution,branch-registry}.json`, `runtime-causality-graph.json`, `failure-domain-manifest.json`, `projection-recovery-manifest.json`, `runtime-survivability-intelligence.json`. These describe an event-sourced, replay-capable, geo-distributed system — orthogonal to the modular monolith.

## 7. Category 4 — Duplicate PROMPTS (mission families, factory, archived-vs-at-large twins)

- **138 `CODEX_*.md`** and **76 `*MISSION*`** files repo-wide.
- **`docs/Codex_waves/`** (active prompt factory): 16 `CODEX_*_MISSION.md` (API/GraphQL, Design-System, Developer-Ecosystem, Env-Cleanup, Extension-Platform, Identity-Marketing, Marketplace-UX, Master-Sequential, Merchant-UX, Mobile-Parity, Operations, Production-Hardening, Settings-Architecture, Storefront, Theme-Block-Engine, Remediation) + 5 `TERMINAL_*` parallel-agent prompts + `CLAUDE_OPUS_MASTER_PROMPT.md` + superseded twins `LETBUYY_MASTER_EXECUTION_BLUEPRINT.md` **and** `…_V2.md`.
- **`docs/archive/prompts/`** (13 archived missions) holds *its own* versioned twins: `CODEX_APPS_MARKETPLACE_UIUX_MISSION.md` + `…_2026-06-07_RECREATED.md`; `CODEX_UI_FOUNDATION_HARDENING_MISSION.md` + `CODEX_UI_FOUNDATION_MISSION_V2.md`.
- **Archive-vs-root prompt twin enforced by validator** (`whole-repo-end-state-validator.mjs:38-42`): `CODEX_MASTER_IMPLEMENTATION_PROMPT.md` must NOT be at root and MUST exist under `docs/archive/codex-prompts/` — the canonical "one archived copy, no root copy" pattern, implying the root copy historically existed.
- MISSION sprawl spans 20+ directories (Codex_waves 16, archive/prompts 13, themes-marketplace-audit 7, archive/root-residue/2026-06-05 7, …) — a prompt for nearly every domain, frequently in both an active and an archived location.

## 8. Category 5 — Duplicate DOCUMENTATION (superseded/contradictory copies; stale README tree)

- **Two texts of the governance law** (L24): promoted root `AGENTS.md` vs its `GOVERNANCE_REWRITE_2026_06_10/` source copy (prior audits document a CODE-R1 divergence; both files present this phase).
- **61 active nested `AGENTS.md`** (`packages/*` 24, `apps/*` 12, `services/*` 10, `infrastructure/*` 7, `docs/*` 5, plus `load/`, `chaos/`) each a ranked local authority per `CLAUDE.md` precedence, **plus 18 archived copies** under `docs/archive/legacy-packages/` + `firebase-legacy/`. The `docs/agents/` directory is itself a "central constitution" (AGENTS.md + anti-patterns + 9 rule docs).
- **`docs/governance/` = 38 files `D`-deleted in the working tree** — an entire governance-doc tree slated for removal but still committed.
- **103 `README.md`** files repo-wide; the generated package-README tree co-exists with the per-package `AGENTS.md` tree (two doc systems per package).
- **Root markdown budget enforced** (`whole-repo-end-state-validator.mjs:16-36`): only 7 root `.md` allowed (`AGENTS, CLAUDE, README, EXECUTION_LEDGER, SKIPPED_HUMAN_DECISIONS, EXECUTABLE_HUMAN_REQUIRED, MERGE_RUNBOOK`) — the existence of this gate documents prior root-markdown sprawl now pushed to `docs/archive/root-governance-2026-06-10/` and `…/governance-theater-2026-06-10/`.

## 9. Category 6 — Duplicate SERVICES (real 4 vs reserved 6; overlap)

- **4 real services** (have `wrangler.toml`, deployable Cloudflare Workers): `api-gateway`, `mobile-bff`, `webhook-service`, `queue-workers` (`governance-common.mjs:97-102`).
- **6 reserved services** (manifest-only, must stay non-deployable per `whole-repo-end-state-validator.mjs:59-85`): `checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline` (`governance-common.mjs:104-111`). Each has a `runtime.manifest.json` + `AGENTS.md` but **no** `package.json`/`src`/`wrangler.toml`.
- **Overlap/ownership gap:** the reserved roots name capabilities (checkout, search, media, notification, events, analytics) that the **real** services/apps already implement inside the monolith (checkout in api-gateway, notifications in `148/149` migrations + gateway routes, events in `event-core` package). So the reserved-service manifests are a *future* duplicate of capabilities already owned elsewhere — placeholder duplication of ownership. All 6 also appear in `production-topology.json` as `environment:"reserved", deploymentKind:"manifest-only"` (verified `runtimeRoot` list).
- **2 reserved mobile roots** (`apps/mobile/shopper-app`, `apps/mobile/operator-app`) — manifest-only, must NOT appear in production topology (`…:87-89`).

## 10. Category 7 — Duplicate PACKAGES (live + worktree-deleted; zero-import; forks)

- **Live workspace packages (TS):** 18 `domainPackageRoots` + `infrastructure` + `typescript/{api-client,api-types,ui}` (`governance-common.mjs:118-160`). Import counts (this phase, `grep -rl @letbuyy/<pkg>` minus self): `shared-types` 148, `theme-engine` 62, `infrastructure` 57, `auth-core` 56, `tenant-core` 32, `commerce-core` 29, `checkout-core` 21, `billing-core` 20, `cms-core` 19, `identity-core` 14, `payments` 11, `event-core` 10, `notification-core` 6, **`audit-core` 3, `permission-core` 3, `session-core` 3, `organization-core` 2, `token-core` 2**. The bottom five (≤3 importers) are redundancy candidates.
- **8 worktree-deleted-at-HEAD packages** (the L2 distributed family) — present at HEAD, `D` in WT: distributed-runtime, projection-runtime, orchestration, runtime-composition, application-services, app-engine, extension-host, search-core. (Note: prior baseline said "8 worktree-deleted-at-HEAD"; this matches — the set is exactly these 8.)
- **Single-module packages:** most `*-core` packages are one large `src/index.ts` (billing-core 1243 lines, commerce-core 1188, payments 546) — monolithic modules, not facades; not "empty" but coarse.
- **Money primitives forked** (L12/L14): `packages/payments` owns INR/minor-unit/payment-session types (`payments/src/index.ts:9-25`) and `packages/billing-core` owns subscription/invoice/plan schemas — both overlap the gateway SQL functions and the canonical-ledger validator's vocabulary; commission `300` appears in both packages' tests.
- **Dart packages:** `packages/dart` (api_client, core, models, ui_kit) is in the worktree-deletion list but only 4/70 files are `D` (partial). Mobile **models** are forked between `apps/mobile/merchant-app/lib/models` and `packages/dart/models` (5 colliding basenames, L29).

## 11. Category 8 — Duplicate INFRASTRUCTURE (staging vs prod; vercel vs topology; helm/k8s)

- **Two deploy substrates:** Cloudflare Workers (4 `wrangler.toml`, the services) + Vercel (9 `vercel.json`: root + 8 apps incl. all 4 frozen apps — app-marketplace, platform-operations-portal, theme-marketplace each ship a `vercel.json`). So the Vercel matrix includes apps the topology marks frozen/non-deployable.
- **Topology config family:** `config/runtime/deployment-topology.json`, `production-topology.json` (21 `runtimeRoot` entries incl. 6 reserved services + 4 frozen apps as non-deployable rows), `cloudflare-topology.json`, `cloudflare-binding-ownership.json`, `deployment-lineage-manifest.json`, `environment-lifecycle.json`, `rollout-lifecycle.json`. Multiple overlapping descriptions of "what deploys where."
- **Helm/k8s dead twin:** Kubernetes + Helm manifests exist **only** under `docs/archive/infra-deployment-legacy-2026-06-10/` (namespace.yaml, runtime-health-probes.yaml, helm/letbuyy-production/Chart.yaml + templates + values.yaml) — a fully-archived alternative deployment model contradicting the Cloudflare/Vercel reality. `infrastructure/deployment/` shows 6 files `D`-deleted in WT.
- **Validators for infra duplication:** `cloudflare-topology-validator.mjs`, `cloudflare-binding-validator.mjs`, `deploy-matrix-topology-validator.mjs`, `deployment-lineage-validator.mjs`, `env-isolation-validator.mjs`, `environment-honesty-validator.mjs` — six validators policing deploy-matrix consistency, themselves evidence of historical matrix drift.

## 12. Category 9 — Duplicate PAYMENT systems

- **Capture path** (L11): `confirm_order_payment_with_ledger` (`000_baseline.sql:1590-1709`) writes `payment_transactions` (UPDATE→INSERT fallback) + `payment_attempts` (`ON CONFLICT DO NOTHING`) and returns `confirm_order_payment(...)`'s JSON. **No** `INSERT INTO ledger_transactions/ledger_entries`. The buyer-facing capture is un-ledgered despite the name.
- **Canonical ledger requirement** (`canonical-ledger-only-validator.mjs:9-40`): money mutations on `payment_transactions, payments, payout_statements, payouts, refund_transactions, refunds, cod_reconciliation_entries, settlements, wallet_ledger_entries, partner_payout_ledger_entries` must carry evidence of `ledger_transactions|ledger_entries|post_settlement_ledger_transaction|buildPaymentCaptureLedgerPosting|…`. Nine files are explicitly allowlisted to violate this (`legacyAllowedUntilD5`, lines 22-32) — the duplicate (legacy, non-ledgered) money system that persists.
- **Ledger table sprawl** (L12): `gift_card_ledger_entries` and `partner_payout_ledger_entries` are full ledgers **in baseline**, while the *canonical* `ledger_transactions`/`ledger_entries` are created later (migrations `119_mobile_money_ledgers`, `139_executable_foundation_ledger_core`, `151_executable_settlement_ledger`, `160_foundation_money_ledger_authority`, untracked `165_d5_canonical_money_paths`). At least 3 distinct ledger concepts + mutable balances coexist.
- **Commission economics** (L14): migration `162_phase_a_commission_zero.sql` sets `commission_schedules.commission_bps` and `commission_reconciliation_entries.commission_bps` defaults to **0** (`commission-bps-zero-validator.mjs:44-52`), but the **rollback** restores `DEFAULT 300` (`…:54-57`) and the validator regex actively hunts `commission_bps = 300` / `?? 300` / `gmv_percentage = [1-9]` in live source (`…:27-32`). The 3%/300-bps rake survives in the pre-162 realities and in test fixtures (`billing-core.test.ts:168`, `payments.test.ts:46`). **Migration 162 is untracked** — the zero-commission winner is uncommitted.
- **Payout rails** (L15): `payout-transfer-adapter/index.ts` supports `razorpay_route|razorpayx|upi|manual`, normalizes default rail to `razorpay_route` (`:73`), refuses `manual` (`:81-83`), and throws `PayoutProviderUnavailable` when no provider client/credentials (`:84-87, 103-105`). With no live provider wired, **every payout is a hard-fail stub** — the settlement writer exists, the rail to the bank does not. `partner_payout_ledger_entries` enforces the same rail enum at the DB (`000_baseline.sql:10252`).

## 13. Category 10 — Duplicate IDENTITY systems

- **Asymmetric vs symmetric vs opaque** (L5/L6/L7): identity-platform `identity-issued-session.ts` (EdDSA/ES256, JWK private key, issuer `accounts.letbuyy.com`, `MERCHANT_SESSION_AUDIENCE`) vs auth-core HS256 (`customer-session.ts`, `session.ts`) vs gateway `randomHex(32)` (`auth.ts:1140`). The sole-issuer validator (`identity-sole-issuer-validator.mjs:17-37`) forbids `SignJWT`/`jwt.sign`/HS256/`AUTH_SECRET…sign` **outside** identity-platform — then exempts 4 legacy signers (`:10-15`).
- **AUTH_SECRET as a universal signing key** (L7): one secret backs cart-token signing (`cart-routes.ts:307`), checkout signing (`checkout.ts:88`), internal-console (`internal-console.ts:439`), export (`export.ts:174`), media upload (`media.ts:60`), platform-console session (`console-session.ts:24`), identity-platform cookie (`cookies.ts:13`), webhook internal (`webhook-service/index.ts:543`). A shared HS256 secret is an identity+money forgery surface across ≥7 purposes.
- **Gateway "identity-foundation" shadow stack** (L5): `services/api-gateway/src/identity-foundation/` contains `oauth-skeleton.ts`, `mock-key-service.ts`, `auth-verifier-registry.ts`, `admin-mfa-scaffold.ts`, `csrf-scaffold.ts`, `migration-scaffold.ts`, `audit-dual-write.ts`, `compliance-rights.ts` — a second identity foundation (scaffolds + mock keys) paralleling the real identity-platform.
- **OIDC skeleton** (L8/L9): the entire `apps/identity-platform/src/app/oauth2/*` tree (token, authorize, userinfo, consent, logout, callback) is disabled; `oidc-disabled.ts:4-15` serves a placeholder JWKS with literal `x:'disabled-x-coordinate', y:'disabled-y-coordinate'` and `disabledIdentityProviderResponse()` returns 404. The OIDC issuer is non-functional; `/.well-known/jwks.json` and `/jwks` both route to the disabled set.
- **Cookie realms** (L10): four cookie authorities with different domain semantics (host-only storefront vs `COOKIE_DOMAIN` platform vs `__Host-` gate), policed by `cookie-realm-validator.mjs`.

## 14. Category 11 — Duplicate THEME systems

- **Renderer duplication** (L17): React-component `renderer-registry.tsx` is the live default (a `SECTION_RENDERER_DEFINITIONS` table mapping `core.header`/`core.product-grid`/`commerce.category-grid`/`apps.app-block-slot` → React render functions, with `configuredRendererKey` resolution at `:375`). A parallel **Liquid** path lives beside it: `liquid-hydration-islands.tsx`, `composition-engine.tsx`, `template-resolver.ts`. Both occupy `apps/storefront-runtime/src/lib/theme-engine/`. The canon names Liquid the winner; the React renderer is the deployed default. (Liquid-related refs in 5 storefront files.)
- **Two theme-engine roots** (L18): the live renderers are in the **app** (`apps/storefront-runtime/src/lib/theme-engine`), while a separate `packages/theme-engine` (8 ts files, imported 62×) also claims theme-engine ownership — app-local vs package duplication of the same concern.
- **Dead/duplicate editors** (L19): web theme editor (`merchant-control-plane/.../themes/[themeId]/editor` + `components/theme-editor` + an `api/themes/[themeId]/editor` route) and mobile theme editor (`merchant-app/lib/screens/editor` + `widgets/editor`). Plus the **model fork**: `theme_editor_models.dart` exists as a 7-line shim in the app and a 160-line definition in `packages/dart/models` (L29).
- **Schema/compose forks** (per prior THEME_PARITY, re-grounded here): the React registry's per-section `schema` and the Liquid `template-resolver`/`composition-engine` are two schema+compose authorities for one theme model. A `marketplace-single-source`/freeze-style validator governs parity.

## 15. Category 12 — Duplicate UI systems

- **Design-token pipeline** (L20): canonical `packages/typescript/ui/src/tokens.ts → tokens.json → (scripts/generators/generate-mobile-tokens.mjs) → packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` (generated bridge, header-checked). The bridge's existence + the `token-source-single-validator.mjs` allow/forbid lists prove a **web↔mobile token fork** that was reconciled into a generator; the forbidden forks (`mobile-tokens.ts`, `letbuyy_color_tokens.dart`, `light/dark/store_admin_colors.dart`) are now **gone from disk** but the policing validator remains. `token-core` is **not** part of this pipeline (it is auth tokens — see §2 DELTA).
- **Marketplace UI component forks** (L21): `app-marketplace` and `theme-marketplace` each keep a local `src/lib/logger.ts` and a `MarketplaceUnavailable` component (named `MarketplaceUnavailable.tsx` in one app, `marketplace-unavailable.tsx` in the other) that must wrap the shared `@letbuyy/ui/{logging,marketplace}` — a per-app fork of shared UI policed by `marketplace-single-source-validator.mjs:40-67`.
- **Marketing dead twins** (L22): two parallel marketing component sets — dead (`Navbar/HeroSection/FeaturesSection/PricingSection/TestimonialsSection/Testimonials/CTASection/SocialProof/Capabilities.tsx`, archived to `docs/archive/dead-code/marketing-site/components/`) vs live (`Header/Hero/Features/Pricing/Testimonials/CTA/…`). Note `Testimonials.tsx` appears in *both* lists — a name collision between a dead twin and a live component.
- **Two navigation systems (mobile + web)**: web nav authority `apps/merchant-control-plane/src/components/merchantNavigation.ts`; mobile carries its own navigation in `apps/mobile/merchant-app` (prior MOBILE_TRUTH documents two mobile navigation systems + same-name duplicate widget classes — the dart model collisions in L29 are the file-level evidence).
- **Shell adoption gap:** the design-system token surface is consumed narrowly (token-core itself is auth, and the web token authority `typescript/ui` underpins the apps, but mobile historically forked) — `validate-design-system.mjs` + `design-system-baseline.json` + `mobile-token-validator.mjs` exist precisely to ratchet adoption, implying incomplete uptake.

---

## 16. Duplication Heat Map (which domains carry the most parallel realities)

Ranked by number of co-existing authorities/planes (★ = user-facing money/identity/security S0).

| Rank | Domain | Parallel realities | Severity |
|---|---|---|---|
| 1 ★ | **Identity / sessions / tokens / cookies** | ≥6: gateway randomHex · identity-platform asymmetric · auth-core HS256 · token-core envelope · gateway identity-foundation shadow stack · OIDC disabled skeleton · 4 cookie realms · AUTH_SECRET fanout (≥7 uses) | **S0** |
| 2 ★ | **Payments (capture / ledger / commission / payout)** | ≥5: un-ledgered `confirm_order_payment_with_ledger` · canonical ledger requirement · gift-card + partner-payout + canonical ledger tables · 300-bps vs 0 (migration vs rollback) · payout hard-fail stub · 9 bypass writers | **S0** |
| 3 ★ | **Architecture (monolith vs distributed/multi-region)** | 3 layers × 3 planes: 8 distributed packages (HEAD-present/WT-deleted) · 15+ config contracts · 2 validators *mandating* 4 regions = self-block | **S0** |
| 4 | **Governance law / AGENTS** | 2 law texts · 61 active + 18 archived nested AGENTS.md · docs/governance (38 D-deleted) · docs/agents central constitution | S1 |
| 5 | **Validators** | 133 on disk · 77 D-deleted in WT · 90 gate-referenced · 6-lane aliasing · self-mandating multi-region | S1 |
| 6 | **Themes** | React renderer (default) vs Liquid (canary) · 2 theme-engine roots · web+mobile editors · model fork | S1 |
| 7 | **Merchant/commerce backend ownership** | gateway (84 routes, data owner) · merchant-control-plane (62 proxy routes) · storefront-runtime (21 routes) | S2 |
| 8 | **Prompts / missions** | 138 CODEX_* · 76 MISSION · Codex_waves (active factory) vs archive/prompts (RECREATED/V2 twins) · root-vs-archive master prompt | S2 |
| 9 | **Services topology** | 4 real vs 6 reserved (manifest-only) vs 4 frozen-but-shipping apps | S2 |
| 10 | **Infrastructure / deploy** | Cloudflare (4) vs Vercel (9, incl. frozen apps) vs topology config family vs archived helm/k8s twin | S2 |
| 11 | **UI / tokens / mobile** | typescript/ui ↔ dart/ui_kit generated bridge (+ removed forks) · marketplace component forks · marketing dead twins · 2 nav systems · 5 dart model collisions | S2/S3 |
| 12 | **Documentation / README** | 103 README + per-package AGENTS (two doc systems/pkg) · root-markdown budget gate · 1,254 md total | S3 |

**Hotspot concentration:** the top 3 (identity, payments, architecture) are all **S0** and all **survive the merge** — the committed/`main` realities carry the losing implementation on every path a real shopper or a real rupee touches.

---

## 17. Fresh-verified key counts (this phase)

| Metric | Value | Command / source |
|---|---|---|
| Branch / HEAD / ahead-of-main | `stepup/main` / `c4fc3cd6` / 30 | `git rev-parse`, `git rev-list --count main..HEAD` |
| Working tree D / M / ?? | **512 / 410 / 78** | `git status --porcelain` |
| Markdown files (excl node_modules) | **1,254** | `find . -name '*.md' …` |
| `getSupabaseAdmin` occurrences / files | **917 / 99** (100% in api-gateway) | `grep -rn getSupabaseAdmin services apps packages` |
| merchant-control-plane `route.ts` | **62** | `find apps/merchant-control-plane/src/app/api -name route.ts` |
| api-gateway route files | **84** | `find services/api-gateway/src/routes -name '*.ts'` (non-test) |
| storefront-runtime API routes | **21** | `find apps/storefront-runtime/src -name route.ts` |
| Nested non-root AGENTS.md | **79** (61 active + 18 archived) | `find . -name AGENTS.md …` **[DELTA vs prior "38"]** |
| Validators on disk (.mjs) | **133** | `ls scripts/validators/*.mjs` |
| Validators D-deleted in WT | **77** | `git status ^.D scripts/validators/*.mjs` |
| Validators referenced by gate | **90** | `grep -oE '…-validator.mjs' validate-governance.mjs` |
| CODEX_* prompt files | **138** | `find -iname 'CODEX_*.md'` |
| MISSION files | **76** | `find docs -iname '*MISSION*'` |
| Distributed packages present-at-HEAD / deleted-in-WT | **8** (150 files) | `git ls-tree HEAD` vs `git status ^.D` |
| rejectedPackageRoots declared | **7** | `governance-common.mjs:142-150` |
| Multi-region self-block | regions `india/apac/eu/us` mandated | `survivability-…:94-95,106-107`; `whole-repo-…:172-177` |
| `confirm_order_payment_with_ledger` ledger writes | **0** (only payment_transactions + payment_attempts) | `000_baseline.sql:1590-1709` |
| Commission 300-bps in live source | **0** (tests + rollback only) | `grep 300 … --include='*.ts'`; `commission-bps-zero-validator.mjs` |
| Payout `initiateTransfer` without provider | **throws `PayoutProviderUnavailable`** | `payout-transfer-adapter/index.ts:84-87,103-105` |
| Untracked money migrations | **162–166** (+ 090/100 modified) | `git status … database/supabase/migrations` |
| wrangler.toml / vercel.json | **4 / 9** | `find -name wrangler.toml`, `-name vercel.json` |
| Frozen apps still shipping src (ts/tsx) | app-marketplace 91 · theme-marketplace 65 · platform-operations-portal 32 · developer-portal 20 | `find apps/<frozen>/src` |
| Lowest-import packages (≤3) | organization-core 2 · token-core 2 · permission-core 3 · session-core 3 · audit-core 3 | `grep -rl @letbuyy/<pkg>` |

---

## 18. Unknowns / UNVERIFIED (out of scope for repo forensics)

- **Live production state** (which `main` commit is actually deployed; whether the multi-region topology is provisioned; whether RLS leaks are live). Repo evidence only — CI deploys from committed refs, so live ≈ `main`, but not verified against running infra.
- **DB runtime** (whether `ledger_transactions` is populated in prod; whether `confirm_order_payment_with_ledger` is the path actually invoked at checkout vs a newer RPC in migrations 165). The SQL function exists and is un-ledgered as written; runtime call-graph not traced to a live capture.
- **Payment-provider wiring** (whether Razorpay/RazorpayX/UPI credentials exist in any environment). The adapter throws without a provider; whether a provider is injected at runtime is UNVERIFIED.
- **Turnstile double-verify** (BFF pre-verify vs identity re-verify) — flagged by prior audits as breaking prod mobile login; not re-traced this phase (mobile/runtime concern).
- **Exact validator-alias mapping** (which of the 90 gate-referenced names resolve to one underlying check) — counted, not fully de-aliased.
- **Whether every `M` (410 modified) file is part of the convergence end-state** vs incidental — sampled (migrations 090/100, validators), not exhaustively diffed.
- **`docs/archive/` completeness** — confirmed archives exist for prompts/governance/marketing-dead-code/infra-legacy; not every archived twin was diffed against its live counterpart.

---

*End of Phase 1 Repository Forensics Report. Discovery only — no source modified, no deletions, no migrations. All counts re-derived this phase against `stepup/main` @ `c4fc3cd6`.*
