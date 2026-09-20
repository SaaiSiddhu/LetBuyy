# 05 — Drift and Conflict Register

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `f52abca7ef6b2ddfc39f03b38206779cbe543e46` · branch `stepup/main` · 2026-08-16.

---

## 0. Conclusion first

Four things are true at this SHA, in this order of consequence.

| # | Conclusion | Evidence state |
|---|---|---|
| 1 | **R-15 ("exactly one canonical system per domain") is unmet in 12 of 22 checked domains.** The winners are named and mostly built; the losers are still wired. Two winners (Liquid renderer, hosted checkout origin) are built and **not serving at all**. | `VERIFIED-SOURCE` (§A) |
| 2 | **ART-08 is the single largest open constitutional obligation and it is not partially met — it is entirely unwired.** `withResolvedTenantTx` has **zero** non-test callers repo-wide; 114 gateway files use a `service_role` (BYPASSRLS) client. Migration 164's `app_tenant` role, FORCE-RLS and GUC policies never engage. This is the one adversarially-**CONFIRMED S0**. | `VERIFIED-SOURCE` (§C) |
| 3 | **The governance corpus is stale on facts it states in the present tense**, and in two places instructs agents to do what the Constitution forbids (`AGENTS.md:401` → follow retired V1+FREEZE; `AGENTS.md:156` → author a migration number that already exists five times over). | `VERIFIED-SOURCE` (§B) |
| 4 | **The adversarial pass over-rated 26 of its own 32 flagship claims (81%) and refuted 2.** Every correction moved severity **down**. Two of ten dimensions (`data`, `flow-commerce`) received **no** adversarial pass, and **4 of the 11 S0-rated findings therefore stand unreviewed**. | `VERIFIED-SOURCE` (§E) |

**The single sentence that matters:** the foundation's *decisions* are sound and largely executed in source; the *decisive runtime change* (ART-08) is not, the *losers* have not been retired, and the *documents* that certify all of this describe a repository that is three months out of date.

---

## A. The winner-registry conformance table (`R-15` under test)

**Method.** Every domain named in `LETBUYY_CANONICAL_SYSTEMS.md` §2 (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:70-107`) was tested against source. States: `winner-live` · `winner-built-but-unwired` · `loser-frozen` · `loser-STILL-WIRED` · `unknown`. Every row is `VERIFIED-SOURCE` or `VERIFIED-CONFIG` unless marked.

| # | Domain | Named winner (DOC 03) | Named loser(s) | State | Evidence (`path:line`) |
|---|---|---|---|---|---|
| 1 | **Money ledger** | canonical 8-account append-only double-entry ledger (`:83`) | legacy un-ledgered capture/refund RPCs | **winner-live** | `database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql` rewrites `confirm_order_payment_with_ledger` + `complete_order_refund` to post in-transaction; `165_d5_canonical_money_paths.sql:463` `REVOKE UPDATE, DELETE` on ledger tables |
| 1b | ↳ compat ledgers | canonical ledger is the only money truth (`ART-10`, `:207-211`) | `wallet_/partner_payout_/gift_card_/store_credit_ledger_entries` (LEG-034…038) | **loser-STILL-WIRED** | `scripts/validators/canonical-ledger-only-validator.mjs:12-38` allowlists a 9-file `partner_payout` write boundary under `SKIP-B3`; 16 `partner_payout_ledger_entries` mutation sites, 4 `wallet_ledger_entries` |
| 2 | **Theme renderer** | **Liquid** / portable-theme (`:94`, `ART-17:254`) | React section-registry renderer → FROZEN, explicitly not deleted | **winner-built-but-unwired**; loser-live-and-frozen | `packages/theme-engine/src/theme-governance.ts:14` `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`; `services/api-gateway/wrangler.toml` `env.production.vars` `FEATURE_LIQUID = "false"` (`evidence/02-api-gateway-wrangler-production.txt`); React frozen by allowlist validator |
| 3 | **Auth issuer** | `apps/identity-platform`, sole asymmetric issuer, 3 realms (`:74`, `ART-05:174`) | gateway `routes/auth.ts` (LEG-024); `identity-foundation` shadow (LEG-025); 6 micro-packages (LEG-029) | **loser-STILL-WIRED** ×3 | `services/api-gateway/src/routes/auth.ts` = **1,499 lines**; `services/api-gateway/src/identity-foundation/` = **18 files**; `packages/{identity,session,token,permission,organization,audit}-core` all present (my own `ls`) |
| 3b | ↳ customer-session minting | one issuer, no shared symmetric secret (`R-14`, `LETBUYY_CONSTITUTION.md:411`) | — | **second issuer LIVE** | Two runtimes mint HS256 customer sessions with the same secret: `packages/auth-core/src/customer-session.ts:52,:86`; `apps/storefront-runtime/src/lib/session.ts:34,:56`. Adversarial verdict: **S1 / VERIFIED-SOURCE** (raised from `VERIFIED-CONFIG`); the "six runtimes" breadth is `INFERRED`, two are proven |
| 4 | **Tenant key** | `site_id` | `orders.store_id` + `sync_orders_tenant_keys()` (LEG-051) | **loser-STILL-WIRED** (DB trigger) | `database/supabase/migrations/130_orders_site_id_not_null.sql:15,:40` |
| 5 | **Storefront runtime** | ONE `apps/storefront-runtime` (`:97`, `ART-18:260`) | `packages/runtime-composition` (LEG-008) | **winner-live · loser DELETED** ✅ | `packages/runtime-composition` absent from disk (my own `ls packages/`); listed in `scripts/validators/governance-common.mjs` rejected roots |
| 6 | **Ops console** | `apps/platform-console` (`ART-24:302`) | `apps/platform-operations-portal` (LEG-023) | **loser-frozen, NOT deleted — and deploy-reachable** | Root exists (35 TS files); `config/runtime/production-topology.json` `status: frozen`; **but** `infrastructure/scripts/deploy/production-deploy.mjs:129` lists it in `appRoots` and `:138-140` runs `vercel deploy --prod` on it under `--execute` |
| 7 | **Design token source** | `packages/typescript/ui/src/tokens.ts` (DTCG) → generated Dart bridge (`:106`, `ART-20:276`) | 3 token sources; app-local `--lb-*` forks (LEG-083) | **winner-live for Dart · loser-STILL-WIRED for web CSS** | `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` is generated from `tokens.json`; **but** `scripts/validators/design-system-baseline.json` records `appLocalLbTokenRedefs: 339`, `appCssNakedRgbHsl: 821`, `rawPxSpacing: 1581` — all **baselined as passing** |
| 8 | **App shell** | `AppNavigation` (`:106`) | `AdminShell`/`Sidebar`/`HeaderBar` fork (LEG-082) | **winner-live · loser partially folded** ⚠️ | `Sidebar.tsx` deleted; `AdminShell.tsx` imports `AppNavigation`; `HeaderBar.tsx` remains. **Caveat:** `AdminShell.tsx`, `HeaderBar.tsx`, `packages/typescript/ui/src/navigation/app-navigation.tsx` are **modified in the user-owned dirty worktree** (`evidence/00-preflight.txt`) — this row describes committed state and may not reflect work in progress |
| 9 | **Cart** | server-authoritative cart (`:88`) | client React cart → thin view (LEG-079) | **winner-live · loser not fully demoted** | `apps/storefront-runtime/src/context/cart-context.tsx:92` still `stock: 999` — a fabricated inventory value on a buyer surface (`R-22`, "a stub MUST NEVER read as `success`") |
| 10 | **Checkout state machine** | hosted `checkout.letbuyy.com` origin + cart-bound signed handoff (`:87`, `ART-14:234`) | unsigned public order-create; Wasm checkout-extensions | **winner-BUILT-NOT-DEPLOYED** | Handoff is real: `cart-routes.ts:573` signs a `cart_digest`, `checkout.ts:221-272` recomputes + timing-safe compares. Origin is not: `wrangler.toml:286` declares `CHECKOUT_ORIGIN`, `infrastructure/dns/dns.tf:91-98` declares the CNAME, `SKIP-D6` records DNS/host-attach/`CHECKOUT_SIGNING_SECRET` open |
| 10b | ↳ hostname reservation | — | — | **defect** | `checkout` is absent from **both** `RESERVED_STOREFRONT_LABELS` (`packages/tenant-core/src/index.ts:27-44`, 16 labels) and `RESERVED_SUBDOMAINS` (`:46-57`) — verified by my own read: zero `checkout` hits in that file. Any merchant can claim the hostname the Constitution designates as the payment origin. Adversarial: **S2 now, S1 the moment the host is attached** |
| 11 | **Order creation** | `create_checkout_order` RPC (`:86`) | direct order insert | **winner-live** ✅ | `database/supabase/migrations/166_d6_checkout_handoff_inventory.sql:276` — the order RPC also writes the outbox row **in-transaction** |
| 12 | **Inventory mutation** | reserve→commit + **scheduled** sweeper (`:89`, `ART-15:240`) | direct-`available` decrement side doors (LEG-080) | **winner-live** ✅ | Sweeper wired: `services/queue-workers/src/index.ts:630-648` via `runInventoryReservationSweeper` (`src/inventory-reservations.ts:26` → `expire_inventory_reservations`); `services/queue-workers/wrangler.toml:17,123,237` `crons = ["17 */6 * * *"]` |
| 13 | **Discount engine** | typed 3-class `combines_with` engine (`:90`) | scalar single-code RPC (LEG-081) | **winner-live · loser demoted (Wave-3 fate)** | `packages/checkout-core/src/index.ts:969-1313`; `routes/coupons.ts:247-250` reduced to code-existence validation |
| 14 | **Theme schema source** | engine `BUILT_IN_SECTION_SCHEMAS` (`:95`) | storefront `RUNTIME_SECTION_SCHEMAS` (LEG-045) | **winner-live · loser DELETED** ✅ | `renderer-registry.tsx:23,45` consumes the engine constant; no `RUNTIME_SECTION_SCHEMAS` symbol remains |
| 15 | **Theme draft system** | `theme_instance_drafts` + `theme_draft_patches` (`:95`) | `theme_editor_drafts` (LEG-047) | **loser-STILL-WIRED** | `services/api-gateway/src/execution/theme-execution.adapter.ts:1008,:1020,:1037,:1052,:1085,:1098` all `.from('theme_editor_drafts')`; compat marker at `:539` |
| 16 | **Compose path** | engine `composeStorefrontTheme` (`:95`) | storefront `resolveStorefrontTemplate` (LEG-046) | **loser-STILL-WIRED — and it IS the live path** | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` (308 lines) is consumed by `store/[subdomain]/layout.tsx:11`, `page.tsx:3`, `products/page.tsx:3`, `customers/login/page.tsx:14`, `preview/page.tsx:10` and more. `composeStorefrontTheme` (`packages/theme-engine/src/execution-runtime.ts:288`) is referenced **only inside `packages/theme-engine`** |
| 17 | **Cache key strategy** | `api-gateway` `storefront-cache.ts` + KV namespaces | none named | **winner-live · no loser** ✅ | `services/api-gateway/src/lib/storefront-cache.ts`; `wrangler.toml` `kv_namespaces` |
| 18 | **Domain resolution** | `@letbuyy/tenant-core` `resolveStorefrontHost`; `letbuyy.com` canonical (`:104`) | `letbuyy.store` literals (LEG-077) | **winner-live · loser retired** ✅ | `packages/tenant-core/src/index.ts:119` consumed by `proxy.ts:321`, `store-context.ts:206`; residual `.store` hits are bundle identifiers allowlisted at `platform-domain-literal-validator.mjs:43,47` |
| 19 | **Event / outbox catalog** | transactional outbox, **same-transaction** write (`:105`, `ART-19:268`) | `services/event-bus` (LEG-013); CQRS/saga cluster | **winner-PARTIAL · loser empty** ✅/❌ | `services/event-bus` is manifest-only (`AGENTS.md` + `runtime.manifest.json`, verified). **But** `emitDomainEvent` is a **post-commit** standalone `.from('outbox_events').upsert()` (`services/api-gateway/src/execution/event-execution.adapter.ts:48,:60`) with **42 non-test occurrences** repo-wide (my own count). Only migration 166's RPC writes the outbox in-transaction |
| 20 | **Deployment workflow** | one gated production-deploy + **one** staging (`:295-297`, `ART-03:160`) | duplicate staging workflow (LEG-067) | **loser-STILL-WIRED** | Three files: `deploy-staging.yml:3-5` (push → `stepup/main`), `staging-deploy.yml:8` (dispatch-only), `staging-runtime-deployment.yml:10-13` (**push → `main` and `release/**`**). Two auto-trigger; a push to the production deploy branch also fires a staging runtime deployment |
| 21 | **Production topology manifest** | regenerated from the real deploy matrix; reserved marked `reserved` (`:293`, `ART-19:268`) | fabricated `environment:"production"` entries (LEG-065) | **winner-live · loser DELETED** ✅ (with a silence) | `config/runtime/production-topology.json`: 21 runtimes = **11 active / 6 reserved / 4 frozen**; every reserved entry carries `status: reserved` **and** `environment: reserved` (my own parse). **Silence:** `services/lcis-api` appears in neither `production-topology.json` nor `deployment-topology.json` (0 `lcis` hits in both) |

### A.1 R-15 verdict

| Outcome | Count | Domains |
|---|---|---|
| **Conformant** — winner live, loser deleted or provably inert | **8** | 1, 5, 11, 12, 14, 17, 18, 21 |
| **Winner live but loser STILL WIRED** | **11** | 1b, 3, 3b, 4, 6, 7, 9, 15, 16, 19, 20 |
| **Winner built but not serving** | **2** | 2 (Liquid flag-off), 10 (origin not deployed) |
| **Partially folded / worktree-ambiguous** | **1** | 8 |

> **R-15 is unmet in 12 of 22 checked domains** (11 still-wired losers + 1 second live issuer at 3b, counted once each). The Constitution's own framing — *"'Two of everything' is a constitutional defect to be eliminated, never a feature"* (`LETBUYY_CONSTITUTION.md:76`) — is not yet true of this repository. Evidence state: `VERIFIED-SOURCE`.

### A.2 The domain the registry does not cover at all

`services/lcis-api` is a **real, buildable Hono HTTP service** in `services/` that appears in **no** governance document, **no** runtime manifest, and **none** of `canonicalServiceRoots` / `reservedServiceRoots` / `frozenAppRoots`.

| Fact | Evidence |
|---|---|
| It is the 11th directory under `services/` | my own `ls services/` — 4 canonical + 6 reserved + `lcis-api` |
| It has no `runtime.manifest.json` | `ls services/lcis-api/runtime.manifest.json` → No such file |
| It is in neither root list | `scripts/validators/governance-common.mjs:97-111` (`canonicalServiceRoots` = 4, `reservedServiceRoots` = 6) |
| Nothing enumerates `services/` to catch it | `scripts/validators/runtime-validator.mjs:21,33-48` `readdir`s `apps/`; `:72` iterates only the canonical **list** for services |
| Volume | 19 `packages/lcis-*` roots + this service = 611 tracked files, 53,254 non-test TS LOC, introduced `0c806023` (2026-08-15 — one day before this SHA) |

Adversarial correction applied: **S2, not S1** — it is undeployed (no wrangler/vercel/Docker config, absent from every deploy workflow, no canonical runtime imports `@letbuyy/lcis-*`), code-owned (`.github/CODEOWNERS:6,27`), boundary-documented (`services/lcis-api/AGENTS.md`), and registered `HUMAN_DECISION_REQUIRED` in `config/governance/web-v1-scope-registry.json:450-460` with two un-baselined escalation probes that would fail the gate. The **classification decision is `HUMAN-REQUIRED`** (Class-A, `LETBUYY_CONSTITUTION.md:337`).

---

## B. The document-drift register

Where governance prose contradicts source. **Fix class:** *doc correction* = Class-C implementation; *ARB* = Class-A/B under `LETBUYY_CONSTITUTION.md` §11.1.

| ID | Document : line | Claim | Source says | Sev | Fix class |
|---|---|---|---|---|---|
| **D-01** | `AGENTS.md:156` (`MIG-R2`) | "numbered sequentially from the **current max (161)** — i.e. the next migration is `162`" and "MUST fix the existing **duplicate prefix (129)**" | Max prefix is **197**. Prefixes are `000` + `073…197`, **contiguous, 126 files, zero duplicates** — `129` has exactly one file. `000_baseline.sql:4-5` is a `pg_dump` "from database version 17.6", so `001-072` were **squashed into the baseline**. Both governance claims are stale. *(My own `ls \| sed \| sort -n` and `head` reproduce `evidence/01-migrations-and-rollback-pairing.txt` exactly.)* | **S2** — an agent obeying `MIG-R2` literally authors `162` and collides with 36 existing files | doc correction (state the rule without a hard-coded number; delete the dup-129 clause) |
| **D-02** | `AGENTS.md:401` (Appendix B) | "`LETBUYY_CONSTITUTION.md` (DOC 01) and `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) … **until they physically exist, follow V1+Freeze as the constitution**" | Both files exist at `GOVERNANCE_REWRITE_2026_06_10/`. `ART-01` (`LETBUYY_CONSTITUTION.md:148`) **forbids** "Citing `V1`, `FREEZE` … as a competing authority"; `AUTH-R2` (`AGENTS.md:40`) forbids citing archived docs as current authority. DOC 02 therefore instructs agents to do what DOC 01 forbids. | **S1** — a live instruction to follow retired law | **ARB** (DOC 02 is hand-authored law, `AGENTS.md:5`) |
| **D-03** | `LETBUYY_CONSTITUTION.md:160` (`ART-03`) | "`main` **was ~30 commits behind**" stated as the standing keystone precondition; §14.4 item 4: "Live deployment state … is **~0%** until the deploy meta-blocker clears" | `git rev-list --left-right --count main...stepup/main` → **`0 0`**; `main` = `stepup/main` = `origin/main` = `f52abca7` (`evidence/00-preflight.txt`). The branch-lag leg is **satisfied**. A guard exists: `scripts/validators/branch-lag-guard-validator.mjs` + `.github/workflows/branch-lag-monitor.yml`. | **S2** — resolved blockers read as open | **ARB amendment** (`P.3` item 6: where the Constitution and the evidence disagree on a *fact*, the evidence governs and the Constitution must be amended) |
| **D-04** | `LETBUYY_CANONICAL_SYSTEMS.md:476` (§7.1) | "`/api/auth/switch` fix and the 8 remediation waves are **working-tree-only and UNDEPLOYED** — `main` is ~30 commits behind" | The fix is **committed**: `apps/identity-platform/src/app/api/auth/switch/route.ts:21-27` documents the enforced order (rate limit → CSRF → valid session → proven account) and `:43-45,:54-61,:68-79` implement it; the file is tracked and clean. Branch lag is 0. *(Whether it is **deployed** remains `UNKNOWN` — see `04_LIVE_DEPLOYMENT_TRUTH.md` L-06.)* | **S2** | **ARB** (DOC 03 is ARB-owned, `LETBUYY_CONSTITUTION.md:368`) |
| **D-05** | `LETBUYY_CONSTITUTION.md:296` (`ART-23`) + `:316` (§10 item 4) | "the partition-shadow seam (**kept, mirror disabled**)"; "the partition helper seam exists, **disabled**" | Five `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` mirror triggers are **attached** by `database/supabase/migrations/131_hot_table_partition_shadow_mirror.sql:112-140` to `worker_request_logs`, `runtime_telemetry_metrics`, **`outbox_events`**, `platform_queue_jobs`, `webhook_deliveries`. No later migration drops them. The kill switch `set_hot_table_partition_shadow_mirror_enabled` (`131:58`) has **zero callers** outside a test assertion at `tests/performance/partition-retention.test.mjs:121` (my own repo-wide grep). `179_outbox_partition_shadow_published_at.sql` exists only because the mirror **broke every outbox write**. | **S1** — the Constitution asserts a state the source contradicts, on the money-adjacent outbox | doc correction is *wrong here*: **implementation** (drop the triggers) + **ARB** (see D-06) |
| **D-06** | `scripts/validators/migration-safety-validator.mjs:133-138` (gate lane, registered `scripts/validate-governance.mjs:112`) | The gate **requires** `.github/workflows/hot-table-partition-maintenance.yml` to contain `cron: "15 2 1 * *"`, `PRODUCTION_DB_CONNECTION_STRING` and `--months-ahead=3` | The workflow's schedule branch always evaluates `EXECUTE_MAINTENANCE: true` (`:35`) and resolves `SUPABASE_DB_URL` to `secrets.PRODUCTION_DB_CONNECTION_STRING` (`:36`). So a **gate validator mandates unattended monthly production DDL for a capability `ART-23` / §10 item 4 forbids.** This is `ART-02` / `R-18` ("no validator MUST certify a forbidden capability") violated by a validator that is itself in the gate. | **S1** | **ARB review** — the validator and the Constitution are in direct conflict |
| **D-07** | `AGENTS.md:157` (`MIG-R3`) | "The **three** known unpaired migrations (138/140/157)" | **12** forwards ≥ 138 have no paired DOWN: `138, 140, 157, 170, 175, 179, 182, 183, 184, 186, 187, 194`. **Nine were authored after the Constitution was ratified.** 126 forwards / 48 rollbacks (`evidence/01-migrations-and-rollback-pairing.txt`). | **S2** (the doc); **S1** (the underlying regression — see C-`R-23`) | doc correction + implementation |
| **D-08** | `LETBUYY_CONSTITUTION.md:456` (§14.4 item 1) · `AGENTS.md:399` | "**The six** anon RLS-to-PUBLIC table GRANTs" | The set is larger than six. `database/supabase/migrations/163_d2_live_data_leak_rls.sql` remediates **12** tables. **`auth_password_set_intents` was never remediated at all**: `078_password_set_intents.sql:41` enables RLS, `:52-56` creates a policy `USING (true) WITH CHECK (true)` **with no `TO` clause** (⇒ PUBLIC), and the table name appears in **no other migration** (my own `grep -rln` across `database/supabase/migrations/`). The `data` audit reports 18 further PUBLIC-effective true-predicate policies surviving to final replay state — **that finding received no adversarial pass** (§E). | **S1** — governance understates the scope of a live security surface | **ARB** (amend §14.4) + **implementation** (a 198-series migration) |
| **D-09** | `AGENTS.md:81` (`ARCH-R2`) | "Enforced by `runtime-manifest-validator` **retargeted to the V1 8-runtime list**" | No validator enumerates `services/`. `scripts/validators/runtime-validator.mjs:21,33-48` `readdir`s `apps/` only; `:72` iterates the canonical **list** for services, so an undeclared service root is structurally invisible. `services/lcis-api` is the existence proof. | **S1** — `ARCH-R2` is asserted-not-enforced | implementation (topology-membership validator) + **ARB** (classify `lcis-api`) |
| **D-10** | `LETBUYY_CANONICAL_SYSTEMS.md:5` + §0 | DOC 03 "names **one** canonical system per domain and declares **every** alternative a loser **with a fate**" | The **app root** `apps/theme-marketplace` (71 TS files) has **no** deployment fate in law. DOC 03 §2 row 36 (`:107`) and §3.10 (`:312-315`) name only the theme-marketplace **machinery** (LEG-049, CANONICAL) and freeze only `app-marketplace` + `developer-portal`. The app root's `frozen` classification exists **only in implementation**: `scripts/validators/governance-common.mjs:66-71` `frozenAppRoots` and `config/runtime/production-topology.json`. *(Correction to the source digest: the string `apps/theme-marketplace` is absent from `GOVERNANCE_REWRITE_2026_06_10/*.md`, but the app **is** covered by DOC 06 `LETBUYY_UI_UX_GOVERNANCE.md:63,182,339`. The drift is narrower than "no row anywhere" — it is that the **deployment fate** lives in a validator file, inverting the authority chain.)* | **S2** | **ARB** (adding a fate is a Class-A act, `LETBUYY_CONSTITUTION.md:368`) |
| **D-11** | `CLAUDE.md:76` | "Keep the **107-validator** gate green" | **114** `.mjs` files in `scripts/validators/` (+ `README.md` + `design-system-baseline.json` = 116 files total). `scripts/validate-governance.mjs` declares **110** in the gate lane and **1** in the report lane; 3 `.mjs` are undeclared (git-hook validators, per `scripts/validate-governance.mjs:194`). *(This contradicts the source digest's "116 `.mjs`" — see §F.)* | **S3** | doc correction |
| **D-12** | `AGENTS.md:7` | The superseded generated `AGENTS.md` "reported stale counts (19 migrations / 237 tables vs the real **91 / 419**, max migration **161**)" | DOC 02's own correction is now itself stale: 126 forward migration files, max prefix 197, and the tenant table registry carries 265 rows (`services/api-gateway/src/tenant/tenant-tables.registry.ts`). | **S3** — a lesson about stale counts, told with stale counts | doc correction |
| **D-13** | `LETBUYY_CANONICAL_SYSTEMS.md:4` · `LETBUYY_CONSTITUTION.md:7` · `AGENTS.md:9` | All three pin evidence to `stepup/main @ c4fc3cd6` and to repo path `/Users/saai_sidd/Git/Letbuyy_Store` | The audited repo is at `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` @ `f52abca7`. Every present-tense factual assertion in the corpus is pinned to a commit that is not this one. | **S3** (metadata) but it is the **root cause of D-01…D-04, D-07, D-08, D-12** | **ARB** — issue one dated amendment block per document recording what has closed and what has not |

### B.1 What has genuinely closed since `c4fc3cd6` (the other half of the drift)

Governance staleness cuts both ways. These were named as open in the corpus and are **closed in source at this SHA** — the documents should say so:

| Closed item | Evidence |
|---|---|
| Branch-lag meta-blocker (`ART-03` first leg) | `0 0` divergence (`evidence/00-preflight.txt`) |
| `commission_bps` default → 0 (`ART-12`, `R-9`) | `database/supabase/migrations/162*.sql:4,7,10-20` sets the default **and** backfills non-zero rows |
| CQRS / saga / projection / `runtime-composition` package cluster deleted | absent from `packages/` (my own `ls`) |
| `legacy/` tree removed | `git ls-files legacy/` → **0**; directory does not exist |
| Reserved services genuinely empty (`ART-19`, `R-16`) | all six contain exactly `AGENTS.md` + `runtime.manifest.json` (my own `ls`) |
| Topology manifest de-fabricated (`ART-19`) | 11 active / 6 reserved / 4 frozen; **no reserved entry marked `production`** |
| Fiction validators removed (`ART-02`) | zero matches for replay/projection/saga/CRDT/failover/multi-region/chaos in `scripts/validators/` |
| `letbuyy.store` literals retired (`DEPLOY-R3`) | residual hits are bundle identifiers, allowlisted at `platform-domain-literal-validator.mjs:43,47` |
| Anon `super_admin_allowlist` re-scoped (`ART-06` second leg, in SQL) | `163_d2_live_data_leak_rls.sql:185-198` re-scope + `:216` `REVOKE ALL … FROM PUBLIC, anon, authenticated` |
| Ledger append-only by trigger **and** `REVOKE` (`R-6`) | `139` reject-update/reject-delete triggers; `165:463-464` `REVOKE UPDATE, DELETE` |

---

## C. The open-obligation register

Status against every Article and Rule in scope. `SATISFIED` here means **satisfied in source at this SHA** — never that it is live (see `04_LIVE_DEPLOYMENT_TRUTH.md`).

| Obligation | Status | Evidence / gap |
|---|---|---|
| **ART-03** — branch-lag leg (`R-20`) | **SATISFIED** | `git rev-list --left-right --count main...stepup/main` → `0 0`; guard exists (`branch-lag-guard-validator.mjs`, `branch-lag-monitor.yml`) |
| **ART-03** — staging-collapse leg ("collapse the duplicate staging workflows to **one**") | **OPEN** | Three files remain; **two auto-trigger**: `deploy-staging.yml:3-5` on push→`stepup/main`, `staging-runtime-deployment.yml:10-13` on push→`main` and `release/**`. A push to the production deploy branch fires a staging runtime deployment |
| **ART-03** — "deploy the fix" leg | **UNKNOWN** | Fix committed; whether any production deploy has run is `04` L-06, answerable today from `gh run list` with no new credential |
| **ART-06** — `/api/auth/switch` takeover fix | **PARTIAL** | Source correct (`route.ts:21-27,:43-45,:54-61,:68-79`). Adversarial verdict: **S2 / VERIFIED-SOURCE** — *no behavioural test exists; every guard is asserted by source-text ordering only.* Deployment `UNKNOWN` |
| **ART-06** — anon-writable `super_admin_allowlist` | **PARTIAL** | SQL remediation present (`163:185-216`); **application to the live database is `UNKNOWN`** (§D item 1) |
| **ART-08** — RLS `ENABLE`+`FORCE` + per-tx GUC; gateway **off** blanket `service_role` (`R-1`, `R-2`) | **OPEN — the single largest open item. Adversarially CONFIRMED S0.** | `withTenantTx` (`services/api-gateway/src/lib/tenant-transaction.ts:15`, issuing `SET LOCAL ROLE app_tenant` at `:29`) is reachable only via `withResolvedTenantTx` (`services/api-gateway/src/lib/tenant-context.ts:67`), which has **zero non-test callers** — my own repo-wide grep returns exactly **two** hits: the definition and a regex assertion in `services/api-gateway/src/__tests__/tenant-load-bearing-d4.test.ts:42`. **114** non-test gateway files import `getSupabaseAdmin`, whose own doc-comment reads *"service role — bypasses RLS"* (`services/api-gateway/src/lib/supabase.ts:11-16`). Migration `164_d4_tenant_role_guc.sql:11` creates `app_tenant NOLOGIN NOBYPASSRLS` — and `:20-22` grants it **to `service_role`**, which carries `BYPASSRLS` and therefore overrides `FORCE`. Independently and decisively, `163_d2_live_data_leak_rls.sql:11-14,:27,:39,:65,:92,:159,:172,:186` creates `FOR ALL TO service_role USING (true) WITH CHECK (true)` on `orders`, `products`, `product_variants`, `product_options`, `sites`, `subscriptions`, `billing_history` and `super_admin_allowlist`, and no later migration drops them |
| **ART-08** — the gate that should catch it (`ART-02`, `R-18`) | **OPEN** | `scripts/validators/no-blanket-service-role-validator.mjs` (gate lane, `validate-governance.mjs:162`) does two `.includes()` string checks on two helper files (`:12-21`), then scans offenders **only** for `entry.path.startsWith("apps/")` (`:33`) — verified by my own read. `services/**` route call sites are never inspected. **The gate is green over an S0** |
| **ART-09** — no `USING(true)` to PUBLIC/anon/authenticated (`R-3`) | **OPEN** | 12 tables remediated by `163`. **`auth_password_set_intents` never was**: `078_password_set_intents.sql:52-56` creates `USING (true) WITH CHECK (true)` with **no `TO` clause**, and the table appears in no other migration (my own verification). Plus 18 further PUBLIC-effective true-predicate policies per the `data` audit — **not adversarially reviewed** |
| **ART-14** — hosted origin + cart-bound signed handoff (`R-11`) | **PARTIAL** | Handoff **done**: `cart-routes.ts:573` signs a `cart_digest`; `checkout.ts:221-272` recomputes and timing-safe compares. Origin **not deployed** (`SKIP-D6`) and the hostname is **claimable by any merchant** (`packages/tenant-core/src/index.ts:27-57`). The `flow-commerce` audit additionally rates the public order-create bypass **S0** — **not adversarially reviewed** |
| **ART-15** — one commerce path; **scheduled** sweeper | **PARTIAL→SATISFIED on the sweeper** | Sweeper wired (`queue-workers/src/index.ts:630-648`, `crons = ["17 */6 * * *"]`); typed discount engine live; GST/Shiprocket completeness is out of this document's scope (see `03`) |
| **ART-17** — Liquid canonical; React frozen; flip gated | **freeze SATISFIED · flip OPEN** | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (`theme-governance.ts:14`); `FEATURE_LIQUID = "false"` in production; React frozen by an allowlist validator. The `ART-17` entry gate (screenshot/DOM-diff parity harness) **does not exist as a behavioural harness** — the parity suites are `readFileSync` source-text assertions; `tests/theme-engine/liquid-hydration-islands-parity.test.mjs:13` says so outright |
| **ART-19** — reserved empty; **same-transaction** outbox (`R-16`) | **reserved SATISFIED · outbox OPEN** | Six reserved services = 2 files each ✅; topology honest ✅. But `emitDomainEvent` is a **post-commit** `.from('outbox_events').upsert()` (`event-execution.adapter.ts:48,:60`) with 42 non-test occurrences; adversarial correction **S0 → S1** |
| **ART-22** — `app-marketplace`/`developer-portal` **de-deployed** | **OPEN — adversarially CONFIRMED S1** | `infrastructure/scripts/deploy/production-deploy.mjs:121-130` hardcodes three frozen roots into `appRoots`: `apps/app-marketplace` (`:125`), `apps/theme-marketplace` (`:126`), `apps/platform-operations-portal` (`:129`); `:132-140` runs `pnpm dlx vercel deploy --cwd <root> --yes --prod` under `--execute`. Reached by `.github/workflows/production-rollout.yml:174` (target defaults to `all`) and `live-production-certification.yml:117` → `phase4-live-certify.mjs:135` (which passes `--skip-validation`). `infrastructure/deployment/release-promotion.yaml:19` declares this as **the** governed production deployment command. **No validator covers it** — `deploy-matrix-topology-validator.mjs:11-15` reads only three workflow YAMLs. *(Adversarial narrowing: `apps/developer-portal` is **not** in the list; and with no `VERCEL_PROJECT_ID` and no `vercel.json`, the effect is creation of **new unlinked `*.vercel.app` origins with no env vars**, not functioning marketplaces on `letbuyy.com`.)* |
| **ART-24** — ops-console fold-then-delete | **OPEN** | `apps/platform-operations-portal` survives (35 TS files, `frozen` in topology, excluded from build/lint/typecheck by `package.json:16`), `SKIP-GATE-OPS-SURVIVOR-ARB` open, **and** it is a deploy target per `production-deploy.mjs:129` |
| **ART-05 / R-14** — sole asymmetric issuer, no shared symmetric secret | **OPEN** | Losers alive: `routes/auth.ts` **1,499 lines**, `identity-foundation/` **18 files**, six `*-core` packages. **Second live issuer**: two runtimes mint HS256 customer sessions with the same secret (`packages/auth-core/src/customer-session.ts:52,:86`; `apps/storefront-runtime/src/lib/session.ts:34,:56`). `identity-sole-issuer-validator.mjs:11` allowlists `customer-session.ts` and its regexes cannot match raw WebCrypto HMAC — the green gate is not evidence of conformance |
| **ART-10 / R-5 / R-6** — canonical ledger sole money truth | **PARTIAL** | Capture/refund/COD now post in-transaction (`mig 168`); append-only enforced by trigger **and** `REVOKE` (`139`, `165:463`). But four compat ledgers retain live TS writers (`canonical-ledger-only-validator.mjs:12-38` allowlists a 9-file boundary under `SKIP-B3`), and the zero-drift reconciliation proof `ART-10` requires before any money deletion **has never been produced** (`CAPABILITY_BACKLOG.md` CAP-C01…C05; `scripts/money-certification/check-invariants.mjs` needs `STAGING_DB_URL` and is in no workflow) |
| **ART-12 / R-9** — `commission_bps = 0` | **SATISFIED in schema** | `mig 162:4,7` sets the default and `:10-20` backfills. Live application `UNKNOWN` |
| **ART-20 / R-22** — one token source; ratchet **BLOCKS** drift | **PARTIAL** | Dart bridge is genuinely generated and single-source. Web CSS is not: `design-system-baseline.json` baselines `appLocalLbTokenRedefs: 339`, `appCssNakedRgbHsl: 821`, `rawPxSpacing: 1581` as passing. `ART-20:278` forbids "A CI ratchet that baselines existing drift as passing"; DOC 03 §3.7 (`:268`) specifies a 10%/release burn-down that the baseline file records as `ratchetPerWavePercent: 10` but does not enforce as a decreasing cap |
| **R-23** — every migration ships a paired rollback | **OPEN and REGRESSING** | 12 unpaired ≥ 138; **9 authored after ratification** (`170, 175, 179, 182, 183, 184, 186, 187, 194`). `ART-02:152` lists migration↔rollback pairing in the ADD bucket; **no validator reads `database/supabase/rollback/` for coverage** — `rollback-integrity-validator.mjs` validates Worker deploy lineage, `sequential-migration-validator.mjs` checks prefixes only. DOC 04 Wave-5 step 41 makes this a **precondition** for every schema wave |
| **R-17 / §10 item 4** — no partitioning-now | **OPEN** | See D-05 / D-06 |
| **R-21** — no committed secrets | **SATISFIED as far as inspected** | No secret values found in the paths inspected. Note: `INTERNAL_API_SECRET` is referenced by 10+ runtimes and `isLegacyAcceptEnabled` **defaults true** (`services/api-gateway/src/lib/internal-auth.ts:41-47`) with `INTERNAL_AUTH_LEGACY_ACCEPT` absent from `wrangler.toml` — a **fail-open** internal perimeter against the platform's stated fail-closed posture (`SEC-R1`) |

---

## D. The unverified register

`LETBUYY_CONSTITUTION.md` §14.4 items 1-4 and `AGENTS.md` Appendix B (`:399-401`). Cross-reference `04_LIVE_DEPLOYMENT_TRUTH.md` §4.

| Item | Source | Resolvable from source now? | What settles it |
|---|---|---|---|
| **§14.4-1** — the "six" anon RLS-to-PUBLIC GRANTs are set by Supabase's managed bootstrap, not repo SQL | `LETBUYY_CONSTITUTION.md:456` | **Partly — and the item is understated.** Source now proves the *repo-side* scope is larger than six (D-08: `auth_password_set_intents` never remediated at `078:52-56`, plus 18 further true-predicate policies). The *live GRANT* state is still not source-resolvable. | One **read-only PostgreSQL role**: `\dp public.orders` + `SELECT * FROM pg_policies` + an anon-key probe against `orders`, `store_customers`, `sites`, `products`, `billing`, `subscriptions`, **and `auth_password_set_intents`**. → `04` L-10 |
| **§14.4-2** — the ARB signature for the ops-console survivor (`SKIP-GATE-OPS-SURVIVOR-ARB`) | `LETBUYY_CONSTITUTION.md:457` | **Not a live-access item at all** — it is a `HUMAN-REQUIRED` decision, resolvable today by the ARB with zero new credentials. It remains **open**, and `production-deploy.mjs:129` makes the un-deleted loser a live deploy target (ART-22 finding) | One ARB signature + completion of the refund / maker-checker payout / dispute-log / KYC-queue sliver migration |
| **§14.4-3** — full RLS/`FORCE` coverage per tenant table; live writers of the product-dead tables | `LETBUYY_CONSTITUTION.md:458` | **Partly, and the framing has changed.** Source now shows coverage is **moot on the live path**: the gateway connects as `service_role` (BYPASSRLS), so `FORCE` and the GUC policies are inert regardless of coverage (§C ART-08). The `pg_stat_user_tables` writer question is unchanged and still needs live access. | Same read-only PostgreSQL role: `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class`, `pg_policies`, `pg_stat_user_tables`. → `04` L-11/L-12/L-13. `DEL-R5` forbids any DROP without it |
| **§14.4-4** — "Live deployment state of every 'complete' wave is ~0% until the deploy meta-blocker clears" | `LETBUYY_CONSTITUTION.md:459` | **The stated *cause* is resolved; the *conclusion* stands for a different reason.** The meta-blocker (branch lag) is closed at `0 0`. But no live access was authorised for this study, so live state remains `UNKNOWN` — see `04_LIVE_DEPLOYMENT_TRUTH.md` §1. The Constitution's sentence should be amended to separate "the blocker is closed" from "we still have no live evidence". | `gh run list --workflow=production-deploy.yml` (**zero cost, repo access already exists**) → `04` L-06, ranked #1 in `04` §6 |
| **App-B-a** — `legacy/` git-tracked file count (37 reported vs empty) | `AGENTS.md:400` | **RESOLVED from source.** `git ls-files legacy/` → **0**; the directory does not exist. `docs/archive/firebase-legacy` holds the archived copy. | — closed |
| **App-B-b** — live writers of the ~37 product-dead tables | `AGENTS.md:400` | **No** | `pg_stat_user_tables` write counts (`SKIP-D11-PRODUCT-DEAD-TABLE-WRITER-PROBE`) → `04` L-13 |
| **App-B-c** — full RLS/`FORCE` coverage (~41-76/261 confirmed) | `AGENTS.md:400` | **No** (see §14.4-3). The "261 tables" figure is itself stale — the registry now carries 265 rows | `pg_class` + `pg_policies` join over the registry |
| **App-B-d** — `pnpm turbo build` green baseline | `AGENTS.md:400` | **No — and it was not attempted.** The read-only mandate forbids it; `CLAUDE.md:76` notes the gate does not cover app `next build` | Run the workspace build in a **scratch clone** |
| **App-B-e** — "`LETBUYY_CONSTITUTION.md` and `LETBUYY_CANONICAL_SYSTEMS.md` … until they physically exist, follow V1+Freeze" | `AGENTS.md:401` | **RESOLVED from source — both files exist.** This line is now an active instruction to follow retired law (D-02) | Delete the line (ARB) |
| **New, not in either list** — is `node scripts/validate-governance.mjs --lane=gate` actually green? | — | **No — not executed.** `01_EVIDENCE_METHOD_AND_INDEX.md` §2.2 records that no validator was run; validator pass-status is `REFERENCE-ONLY` throughout this packet | Run the gate lane in a scratch clone and capture the log |

> **The highest-leverage credential remains one read-only PostgreSQL role.** It closes §14.4 items 1 and 3, `App-B-b`, `App-B-c`, and `04` L-10…L-15 — three constitutional `UNVERIFIED` items carried since 2026-06-10.

---

## E. Severity roll-up

### E.1 Raw discovery counts (before adversarial correction)

**217 findings** across 10 read-only dimension audits.

| Severity | Count |
|---|---|
| S0 | 11 |
| S1 | 72 |
| S2 | 91 |
| S3 | 21 |
| INFO | 22 |

| Domain | Findings | Domain | Findings |
|---|---|---|---|
| governance | 28 | queue | 14 |
| topology | 21 | test | 13 |
| security | 19 | tenancy | 12 |
| money | 19 | cache | 12 |
| data | 18 | identity | 8 |
| deploy | 17 | theme | 7 |
| observability | 16 | cost | 7 |
| | | checkout | 6 |

### E.2 What the adversarial pass changed

32 verdicts were returned across **8 of 10** dimensions.

| Verdict | Count | Severity movement |
|---|---|---|
| **OVERSTATED** | 26 | 24 lowered by ≥1 grade; 2 held severity but had the **evidence state** corrected |
| **REFUTED** | 2 | both lowered (S1 → INFO; S1 → S3) |
| **CONFIRMED** | 4 | held; **3 of the 4 found evidence *stronger* than the original claim** |

**Every single correction moved in the same direction: down.** Not one claim was upgraded in severity.

#### E.2.1 The S0 population after correction — the number that matters

| Original S0 claim | Dimension | Verdict | Corrected |
|---|---|---|---|
| ART-08 RLS+GUC runtime-dead | governance-drift | **CONFIRMED** | **S0 / VERIFIED-SOURCE** |
| `app_tenant` GUC has zero runtime callers | data | *(no adversarial pass)* | same defect as above |
| `auth_password_set_intents` PUBLIC `USING(true)` policy | data | *(no adversarial pass)* | **UNREVIEWED** — mechanism independently verified by me at `078:41,52-56` |
| 18 further PUBLIC/anon true-predicate policies | data | *(no adversarial pass)* | **UNREVIEWED** |
| Checkout confirm ledgers an unverified client `provider_payment_id` | flow-commerce | *(no adversarial pass)* | **UNREVIEWED** |
| Public order-create bypasses the ART-14 signed handoff | flow-commerce | *(no adversarial pass)* | **UNREVIEWED** |
| Post-commit outbox dual-write | async | OVERSTATED | S0 → **S1** |
| Outbox relay capped at 4,800 events/day | async | OVERSTATED | S0 → **S2** |
| Batch retry re-sends transactional emails | async | OVERSTATED | S0 → **S2** |
| Incident paging hardcoded dry-run | observability | OVERSTATED | S0 → **S1** |
| Money-recon mismatches never alerted | observability | OVERSTATED | S0 → **S1** |

> **After correction: exactly ONE S0 is adversarially confirmed** (ART-08), **five were downgraded**, and **four stand unreviewed** because the `data` and `flow-commerce` dimensions received no adversarial pass at all. Those four are `VERIFIED-SOURCE` claims by a single auditor and should carry the base-rate prior below until re-read.

### E.3 What an 81% overstatement rate says about single-pass audits

The base rate is the finding. **26 of 32 flagship claims from a competent, path:line-cited, single-pass structural audit were over-rated by their own author** — 81%. The four recurring mechanisms, each observed verbatim in the verdicts:

| Failure mode | Concrete instance |
|---|---|
| **Cited a line without reading the 27 lines above it** | The "app-marketplace backend is live on the production monolith" claim cited the router mounts at `services/api-gateway/src/index.ts:756-757` but missed the fail-closed `appPlatformKillSwitch` registered at `:729-732`. A CI-wired behavioural test enumerates every route from the live routers and proves 404 under verbatim production vars. **REFUTED → INFO / VERIFIED-TEST** |
| **Treated configuration as reachability** | "One `wrangler deploy` silently replaces the production Worker" — true as a mechanism, but every CI step passes `--env` explicitly and all four package `deploy` scripts hard-fail without it. **S1 → S2** |
| **Treated a source-text test as behavioural proof (or its absence as proof of absence)** | "Gate is 2/110 behavioral" — true, and unremarkable: structural validators are *designed* to be lints. **S1 → S3** |
| **Omitted the precondition that makes the defect reachable** | The KV rate-limiter finding never cited `RATE_LIMIT_KV_FALLBACK = "on"` (`wrangler.toml:259`), without which the limiter fails **closed** — a different failure entirely. Severity held at S1 but evidence dropped **VERIFIED-SOURCE → INFERRED** |

**Operational consequence for this packet and for anyone reading it:** no single-pass finding should be actioned at its self-assigned severity. The measured prior is that ~4 in 5 will be over-rated, and the over-rating is almost always in *reachability* or *evidence strength*, not in the mechanical facts — which reproduced correctly in essentially every case. The mechanism is usually right; the alarm is usually not earned.

Equally: the adversarial pass is not a rubber stamp in the other direction. **Three of the four CONFIRMED verdicts found evidence stronger than the original claim** — the ART-22 frozen-app deploy path had *more* reachability than reported (two workflows, one bypassing governance validation, plus the governed promotion command itself), and the ART-08 verdict located a second, purely source-provable cause (migration `163`'s `USING(true) TO service_role` policies) that does not depend on any managed-platform property. **The four that survived are therefore the four to act on.**

---

## F. Where my own reading contradicted the source digest

Per the packet's evidence discipline, my reading governs and is cited.

| # | Digest claim | My reading | Effect |
|---|---|---|---|
| **F-1** | "116 `.mjs` files in `scripts/validators`" | **114** `.mjs`; the 116 is the total **file** count including `README.md` and `design-system-baseline.json`. Lane declarations: **110 gate + 1 report** (parsed from `scripts/validate-governance.mjs`), so 3 `.mjs` are undeclared (git-hook validators, `validate-governance.mjs:194`) | Corrects D-11; `CLAUDE.md:76`'s "107" is stale by 3 against the **declared gate**, not against disk |
| **F-2** | Storefront compose fork consumed by "**five** live route pages" | **At least six**, including two the digest missed: `store/[subdomain]/layout.tsx:11` and `store/[subdomain]/customers/login/page.tsx:14`, plus `page.tsx:3`, `products/page.tsx:3`, `preview/page.tsx:10` | **Strengthens** the LEG-046 finding — the fork is on the store **layout**, i.e. every page under `/store/[subdomain]` |
| **F-3** | `emitDomainEvent` at "**40** non-test call sites" | **42** non-test occurrences repo-wide, one of which is the definition at `event-execution.adapter.ts:48` ⇒ **41 call sites** | Marginal; strengthens |
| **F-4** | `.github/workflows/ci.yml` "still triggers on `develop`" listed as governance drift | **Not drift.** `ci.yml:3-6` documents it as a deliberate fail-safe: *"`develop` is retired … but is deliberately KEPT here as a fail-safe: if the branch is ever recreated it stays gated by default. Removing it would weaken an existing gate, which ART-02/R-18 forbid."* `origin/develop` is 342 behind / 0 ahead of `main` | **Removes** an item from the drift register |
| **F-5** | `apps/theme-marketplace` "has no row in DOC 03, DOC 04's 83-row register, or `AGENTS.md`" | Literally true for the **path string**, but the app **is** covered by DOC 03 §2 row 36 / §3.10 (the *machinery*, LEG-049) and by DOC 06 `LETBUYY_UI_UX_GOVERNANCE.md:63,182,339` | **Narrows** D-10: the gap is specifically the **app root's deployment fate**, which lives only in `governance-common.mjs:66-71` and `production-topology.json` — implementation, not law |

Everything else I spot-checked reproduced exactly: the ART-08 call-site absence, the `getSupabaseAdmin` count of 114, migration prefix contiguity and the `000_baseline.sql` PostgreSQL 17.6 squash, the 12 unpaired rollbacks, `auth_password_set_intents`, the `checkout` reserved-label omission, the three staging workflows, `production-deploy.mjs:121-130`, `migration-safety-validator.mjs:133-138`, `no-blanket-service-role-validator.mjs:33`, the reserved services' 2-file contents, and the 11/6/4 topology split.

---

## G. Standing caveats

1. **Nothing in this document is `VERIFIED-LIVE`.** Every "still wired", "not deployed", "open" statement describes **the repository at `f52abca7`**. Whether production matches is `UNKNOWN` — `04_LIVE_DEPLOYMENT_TRUTH.md` governs.
2. **A green validator gate is not evidence.** No validator was executed (`01` §2.2). Two gate validators are documented here as green over defects they name (`no-blanket-service-role-validator.mjs` over ART-08; `migration-safety-validator.mjs` mandating a constitutionally-forbidden cron).
3. **The worktree is dirty and user-owned.** 19 modified files under `apps/merchant-control-plane/**` and `packages/typescript/ui/**` (`evidence/00-preflight.txt`). Row A-8 (app shell) is the only conformance row those changes touch; it is flagged in place.
4. **Severity labels here are the adversarially-corrected ones** wherever a verdict exists, and are marked **UNREVIEWED** wherever one does not.
