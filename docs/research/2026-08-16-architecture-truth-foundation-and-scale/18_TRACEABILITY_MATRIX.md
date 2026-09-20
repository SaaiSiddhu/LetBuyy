# 18 — Traceability Matrix

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `f52abca7ef6b2ddfc39f03b38206779cbe543e46` · branch `stepup/main` · 2026-08-16.

---

## 1. What this document is, and its own limits

This is the packet's register of record. Every material finding gets one stable ID, and each row closes the loop: **finding → evidence → which document analyses it → what measurement would falsify it → what measured value would trigger action → who decides → who owns it.**

Four rules govern the contents, and they are the reason this register is usable rather than merely long.

| Rule | Consequence |
|---|---|
| **Post-adversarial values only** | Where `evidence/11-discovery-digest.md` carries an adversarial verdict, the **corrected** severity and evidence state are recorded, never the original. 32 verdicts were returned: **26 OVERSTATED · 2 REFUTED · 4 CONFIRMED.** Four further corrections are carried by `14_FOUNDATION_ACTION_REGISTER.md` (§4.3). |
| **Refutations are recorded, not deleted** | Two digest findings were REFUTED, and one more was refuted by this document's own source reading. All three appear below at severity `INFO`. A register that hides its refutations cannot be trusted about anything else. |
| **One row per distinct defect** | The discovery pass emitted **217 findings across 10 dimensions**, with heavy cross-dimension duplication (the partition shadow-mirror appears in 5 dimensions; the tenant-GUC gap in 4). Duplicates are merged into one row carrying every source citation. The mapping is in §6. |
| **No `VERIFIED-LIVE`** | It appears zero times. No live provider or database access existed. Configuration is not deployment; a green validator is not behaviour. |

### 1.1 Limits of this register itself

- **`12_TRIGGER_BASED_EVOLUTION.md` and `13_TEST_AND_LOAD_VALIDATION.md` were authored concurrently with this file.** The *Falsifying test* and *Trigger* columns were derived independently here from `07_CAPACITY_MODEL.md` §4 and §6 and `10_VENDOR_LIMITS_AND_COSTS.md`, then reconciled against `12` and `13` once they landed (§4.4, §7 X-6). **Where `12` or `13` diverges from a cell here, they win** — they are the owning documents; this is the index. Two findings that `13` established by its own source reading have been appended to this register as `ARCH-RESEARCH-176` and `177`.
- **No falsifying test can be *run* from this packet.** Every entry in that column is prescriptive. The count of findings with **no falsifying test at all** is itself a finding — §5.5.
- **Two of the ten discovery dimensions were never adversarially challenged** — `data` (24 findings) and `flow-commerce` (25 findings), i.e. **49 of 217 findings, 22.6%**. Findings sourced only from those two dimensions carry a `†` and must be read as *unchallenged*, not *confirmed*. `14` later challenged four of them; the rest stand untested.

### 1.2 Column semantics

| Column | Meaning |
|---|---|
| **ID** | `ARCH-RESEARCH-NNN`, allocated sequentially and grouped by domain in the order: topology · data · identity · tenancy · money · checkout · cache · queue · deploy · observability · cost · governance · theme · security · test. Stable across revisions. |
| **Sev** | `S0` production-breaking / money or tenancy integrity · `S1` serious · `S2` material · `S3` minor · `INFO` no defect (conformance or refutation). **Post-correction.** |
| **State** | One of the ten states defined in `01_EVIDENCE_METHOD_AND_INDEX.md` §1. |
| **Analysed in** | The sibling document that carries the reasoning. `14` = actionable now; `15` = needs ARB; `17` = needs a human. |
| **Falsifying test** | The measurement that would show this finding to be wrong. `—` means none exists yet. |
| **Trigger** | The measured value at which the finding becomes actionable. `—` means unconditional (fix regardless of load) or not load-dependent. |
| **Authority** | `impl` implementation (no approval needed) · `ARB` ARB review · `AMEND` constitutional amendment · `LEGAL` legal review · `PROVIDER` provider/commercial action. |
| **Owner** | Proposed **role**, not a person. |

**Owner roles used:** `PLAT` platform/gateway engineering · `DATA` database engineering · `IDENT` identity & security engineering · `PAY` payments engineering · `STORE` storefront engineering · `ASYNC` async/queue reliability · `REL` release & DevEx engineering · `SRE` observability & operations · `GOV` governance/ARB secretary · `QA` test engineering · `DS` design systems · `FOUND` founder/ops.

---

## 2. The four findings that outrank everything else

Before the full register, the short list. These are the only rows where the evidence supports acting without further measurement.

| ID | Finding | Sev | State | Why it leads |
|---|---|---|---|---|
| `ARCH-RESEARCH-047` | Checkout confirm accepts an unverified client-supplied `provider_payment_id` and posts a ledger credit | **S0** | `VERIFIED-SOURCE` | The **only S0 defect that survived adversarial challenge** (`14` §P0-1). Free goods at unlimited scale with a falsified money trail. |
| `ARCH-RESEARCH-039` | `app_tenant`/tenant-GUC is DDL-real and runtime-dead; the entire gateway runs on blanket `service_role` | **S0** | `VERIFIED-SOURCE` | `CONFIRMED` verdict against `R-1`/`R-2` MUST-NOTs. The database backstop the Constitution calls load-bearing does not exist on the live path. |
| `ARCH-RESEARCH-068` | KV rate limiter: 1 write/s/key vendor ceiling → 429 → **isolate-global 503 on every `/v1` route** | **S1** | `VERIFIED-SOURCE` + `INFERRED` | Binds at ~2 concurrent requests per key — **below the platform's own governed envelope** (`07` C-1). |
| `ARCH-RESEARCH-107` | Incident paging has no delivery channel — alerts terminate in database rows | **S1** | `VERIFIED-SOURCE` | Nothing above can be safely changed while unobserved. `14` sequences this early for exactly that reason. |

---

## 3. The register

### 3.1 Topology

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-001` | `services/lcis-api` is an undeclared ninth service root — buildable Hono service, 52 routes, **no auth middleware**, in no topology file | S2 | `VERIFIED-SOURCE` | `services/lcis-api/package.json:2`; `src/middleware.ts:1-177`; `scripts/validators/governance-common.mjs:97-111` | `03`, `05`, `14` §P3-3 | Enumerate `services/*` for a `package.json` without a `runtime.manifest.json`; assert the set is empty | — (unconditional) | ARB | GOV |
| `ARCH-RESEARCH-002` | 623-line WebAssembly app-functions executor sits inside the deployed gateway tree with zero importers (ARCH-R8/R9 forbid it live) | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/extensions/app-functions-runtime.ts:81-95`; `AGENTS.md:94` | `03`, `05` | Assert no file under `services/api-gateway/src` references `WebAssembly` | — | ARB | GOV |
| `ARCH-RESEARCH-003` | `deployment-topology.json` declares `generatedFrom: "runtime-manifests"` but omits the 4 frozen apps, which all carry manifests | S2 | `VERIFIED-CONFIG` | `config/runtime/deployment-topology.json` (17 nodes vs 21) | `03`, `05` | Regenerate from manifests and diff | — | impl | GOV |
| `ARCH-RESEARCH-004` | Production D1 (`RUNTIME_DB`) and Durable Object (`RUNTIME_COORDINATOR`) are bound in both environments and reachable from **no request path** | S2 | `VERIFIED-CONFIG` | `services/api-gateway/src/index.ts:206,208`; `routes/internal-console.ts:808,810` (Boolean presence checks only); `evidence/04-…txt` | `03`, `04`, `10` | `wrangler d1 execute --command "select count(*)"`; DO storage inspection | — | ARB | PLAT |
| `ARCH-RESEARCH-005` | **REFUTED** — "D1 + Durable Objects are a second data authority (R-15/ART-04)". First-hand reading: D1 stores nothing; the DO holds two strings and has zero callers. **The one-PostgreSQL invariant holds on this axis.** | INFO | `VERIFIED-SOURCE` | `evidence/04-d1-durable-object-second-authority.txt`; `services/api-gateway/src/durable/runtime-coordinator.ts` (46 lines) | `03`, `05` | Any write to D1 or DO storage from a request path would reopen it | Any future caller of `RUNTIME_COORDINATOR` | — | PLAT |
| `ARCH-RESEARCH-006` | `services/mobile-bff` — a canonical ARCH-R1 runtime — is absent from the rollout deploy script and from three governance validators | S2 | `VERIFIED-SOURCE` | `infrastructure/scripts/deploy/production-deploy.mjs`; `scripts/validators/deploy-matrix-topology-validator.mjs:18-31` | `03`, `05` | Assert every `canonicalServiceRoots` entry appears in every deploy-target list | — | impl | REL |
| `ARCH-RESEARCH-007` | Production app URL topology contradicts the Vercel project registry and the production smoke test | S2 | `VERIFIED-CONFIG` | `config/vercel/projects.json:1-78`; `config/runtime/production-topology.json` | `03`, `04` | Resolve each declared hostname; compare to the registry | — | impl | REL |
| `ARCH-RESEARCH-008` | Host→site resolution is uncached and is a synchronous **fail-closed** dependency on every storefront request | S1 | `VERIFIED-SOURCE` | `apps/storefront-runtime/src/proxy.ts:118` (`cache: 'no-store'`) | `03`, `07`, `09` | Kill the resolve path in staging; observe whether every storefront route 5xx's | Resolve p99 > 150 ms, or resolve error rate > 0.1% | ARB | STORE |
| `ARCH-RESEARCH-009` | No timeout on any external provider call except the storefront edge proxy | S1 | `VERIFIED-SOURCE` | repo-wide absence of `AbortSignal.timeout` on provider fetches (`03` §observability) | `03`, `09` | Inject a 60 s provider stall in staging; measure Worker invocation duration | Any provider p99 > 2 s | impl | PLAT |
| `ARCH-RESEARCH-010` | `provider-resilience-adapter` — the repository's entire timeout/retry/circuit-breaker/fallback implementation — has **zero call sites** | S1 | `VERIFIED-SOURCE` | `packages/infrastructure/provider-resilience-adapter/` (no importer) | `03`, `09`, `14` | `rg` for importers; assert ≥1 on each provider path | — | impl | PLAT |
| `ARCH-RESEARCH-011` | No saturation-driven load shedding, backpressure, degraded mode, or read-only mode exists anywhere | S1 | `VERIFIED-SOURCE` | absence across `services/*/src` (`03` §observability) | `03`, `07`, `09` | Drive staging past pool exhaustion; observe whether the failure is graceful or total | DB pool wait > 50 ms sustained | ARB | PLAT |
| `ARCH-RESEARCH-012` | ART-24 ops-console fold-then-delete is open; `platform-operations-portal` survives as a frozen app with no ARB signature | S2 | `VERIFIED-SOURCE` | `apps/platform-operations-portal/runtime.manifest.json`; `LETBUYY_CONSTITUTION.md` ART-24 | `05`, `15` | — (governance state, not measurable) | — | ARB | GOV |
| `ARCH-RESEARCH-013` | `apps/mobile/operator-app` names the frozen `platform-operations-portal` as its current active capability owner | S3 | `VERIFIED-CONFIG` | `apps/mobile/operator-app/runtime.manifest.json` | `05` | Assert no reserved root names a frozen root as owner | — | impl | GOV |
| `ARCH-RESEARCH-014` | **(= C-11)** Band C (10M simultaneously online) is reachable only with read replicas **and** partitioning — both currently forbidden. Ranks 1–8 plausibly reach Band A (~100× the governed envelope) with **no** amendment | — | `INFERRED` | `07` §4, §5; `LETBUYY_CONSTITUTION.md` §6 Never-Build 3 & 4 | `07`, `11`, `15`, `16` | Load-test to Band A after ranks 1–8; measure the first hard ceiling | Sustained > 60% of single-primary write capacity | AMEND | FOUND |
| `ARCH-RESEARCH-015` | **REFUTED** — "the frozen app-marketplace backend is live on the production Worker". A fail-closed kill switch registered *before* the mounts returns 404 `APP_PLATFORM_DISABLED`; a CI-wired behavioural test enumerates ≥60 live routes and proves it under verbatim production vars | INFO | `VERIFIED-TEST` | `services/api-gateway/src/index.ts:729-732`; `middleware/appPlatformKillSwitch.ts:24-27`; `src/__tests__/app-platform-killswitch.test.ts:216-249` | `03`, `05` | Set `FEATURE_APP_PLATFORM` positive out-of-band and re-probe (the one unfalsifiable residue — no live access) | Any wrangler var block declaring `FEATURE_APP_PLATFORM` | — | PLAT |

### 3.2 Data

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-016` | Partition shadow-mirror triggers are **enabled on five live hot tables**, physically doubling every write on `outbox_events`, `worker_request_logs`, `runtime_telemetry_metrics`, `platform_queue_jobs` — DOC 04 ordered the mirror disabled | S1 | `VERIFIED-SOURCE` | `131_hot_table_partition_shadow_mirror.sql:110-141`; `079_partition_worker_request_logs.sql:489-503` | `05`, `07`, `15` §4 | `pg_stat_user_tables` insert counts on live vs shadow tables | Shadow write amplification > 1.0× confirmed live | AMEND | DATA |
| `ARCH-RESEARCH-017` | A monthly cron executes **unattended partition DDL against production** with no dry-run on the scheduled path | S1 | `VERIFIED-CONFIG` | `.github/workflows/hot-table-partition-maintenance.yml`; `scripts/migration/run-hot-table-partition-maintenance.mjs:31-34` | `05`, `15` §4.2 | Inspect workflow run history for executed DDL | — | ARB | DATA |
| `ARCH-RESEARCH-018` | **78 of 126** migrations have no paired rollback; **12 at or above 138**, of which **9 are new since governance recorded the known set as 138/140/157**. No rollback-pairing validator exists (R-23 / MIG-R3 has *regressed*) | S1 | `VERIFIED-SOURCE` | `evidence/01-migrations-and-rollback-pairing.txt` (first-hand); `AGENTS.md` MIG-R3 | `05`, `14` §P3-1 | Add the validator; assert `∀ forward ≥138 ∃ rollback` | — | impl | DATA |
| `ARCH-RESEARCH-019` | † Inventory reserve and commit are collapsed into one transaction — stock is hard-decremented **before payment**, and the TTL reservation lifecycle is never exercised by checkout | S1 | `VERIFIED-SOURCE` | `170_v1_shipping_rates_gst.sql:31-597` (`create_checkout_order`); `141_executable_inventory_reservations.sql` | `03`, `05` | Abandon N carts at payment; measure recovered stock after the TTL window | Abandoned-cart rate > 30% at any volume | ARB | PAY |
| `ARCH-RESEARCH-020` | † Four analytics rollup tables created after migration 164 have `ENABLE` but not `FORCE ROW LEVEL SECURITY` | S3 | `VERIFIED-SOURCE` | migrations > 164 (`03` §data) | `03`, `05` | `SELECT relforcerowsecurity FROM pg_class` on the four tables | — | impl | DATA |
| `ARCH-RESEARCH-021` | `sessions.token` stores the raw bearer credential in cleartext, including the full ES256 JWT | S2 | `VERIFIED-SOURCE` | `000_baseline.sql` `sessions`; `services/api-gateway/src/routes/auth.ts:1143` | `03`, `08` | Read one row; confirm the stored value verifies as a live bearer | — | impl | IDENT |
| `ARCH-RESEARCH-022` | **CONFIRMED** — the live observability tables have **no retention and are never pruned**; retention exists only for the shadow partitioned copies, and detached partitions are never dropped | S1 | `VERIFIED-SOURCE` | `000_baseline.sql:13224, :11603, :9939`; `079_…:265,:293-303` | `07`, `09`, `14` §P1-3 | `pg_total_relation_size` on the three tables over 30 days | Any of the three > 20% of disk, or disk > 80% | ARB | DATA |
| `ARCH-RESEARCH-023` | No golden signal for PostgreSQL saturation is emitted anywhere in source | S1 | `VERIFIED-SOURCE` | absence across `services/*/src` (`03` §observability) | `09`, `14` §P2-1 | Add the emitter; compare to `pg_stat_activity` | — | impl | SRE |
| `ARCH-RESEARCH-024` | Disaster recovery is **declared policy only**: no RTO, no RPO, no PITR, sole backup is a 7-day CI artifact, and the restore drill has never been executed — the DOC 05 P11 beta gate cannot close | S1 | `VERIFIED-CONFIG` + `HUMAN-REQUIRED` | `scripts/governance/foundation-restore-drill.mjs:44-45` (wired to no workflow); `.github/workflows/production-deploy.yml` (backup, no restore) | `09`, `17` | Execute one timed restore into an isolated project; record actual RTO/RPO | — (unconditional) | PROVIDER | FOUND |
| `ARCH-RESEARCH-025` | Wave-5 dual-schema losers all survive: `orders.store_id` sync trigger, `users_custom`, `payment_transactions`, `sessions_v2` | S2 | `VERIFIED-SOURCE` | `05` §drift; `000_baseline.sql` | `05` | Zero-importer + zero-row proof per loser | — | impl | DATA |
| `ARCH-RESEARCH-026` | **(= C-3)** The vertical-scaling ladder is **not** a connection ladder: direct connections move 60 → 500 across $10 → $3,730/month and plateau at 500. Buying a bigger database buys cores, RAM and IOPS — not concurrency | — | `INFERRED` over vendor docs | `07` §3.4; `10` | `07`, `11` | Step compute tiers in staging; measure `max_connections` at each | Direct connections > 400 in use | AMEND (at the plateau) | DATA |
| `ARCH-RESEARCH-027` | **(= C-4)** Latency degradation converts **directly** into connection exhaustion: 2,000 req/s × 400 ms hold = 800 slots = exactly the Large-tier ceiling | — | `INFERRED` | `07` §3.4 (Little's Law over vendor pool sizes) | `07`, `09` | Fixed RPS while stepping mean transaction duration; observe pool wait | Mean hold time > 100 ms, or pool wait > 10 ms | impl | DATA |
| `ARCH-RESEARCH-028` | **(= C-5, design-critical)** Transaction-mode pooling **never** supports session advisory locks, `PREPARE`, `LISTEN` or temp tables, and Hyperdrive independently forbids advisory locks. `set_config(..., TRUE)` in an explicit transaction is safe; `FALSE` or a bare `SET` would **leak the tenant identity to the next pooled client** | — | `INFERRED` over primary vendor docs | `07` §3.4; PgBouncer + PostgreSQL + Hyperdrive docs, accessed 2026-08-16 | `07`, `08`, `14` §P0-4 | Set a session GUC on a pooled connection; read it back from a *different* client | — (blocks `ARCH-RESEARCH-039`) | impl | DATA |
| `ARCH-RESEARCH-029` | **(= C-6)** Hyperdrive maintains ~100 origin connections (the stack's single most favourable number) but its query cache **does not invalidate on write** — any read that must reflect a write needs a second `--caching-disabled` binding | — | `INFERRED` over vendor docs | `07` §3.4; `services/api-gateway/wrangler.toml:193-194, 322-323` | `07`, `11` | Write then immediately read through the cached binding; measure staleness | Any money/inventory read routed through a cached binding | impl | PLAT |
| `ARCH-RESEARCH-030` | The current data path is PostgREST/`supabase-js`, which **cannot issue `SET LOCAL ROLE`** — very likely the real reason `app_tenant` has no callers. Cloudflare's own Supabase guidance advises against this driver | S2 | `INFERRED` over `VERIFIED-SOURCE` | `packages/infrastructure/supabase-adapter/index.ts:34`; `services/api-gateway/src/lib/supabase.ts:13-15` | `07` §3.4, `11`, `14` §P0-4 | Attempt `SET LOCAL ROLE` through PostgREST; observe the failure | — (blocks `ARCH-RESEARCH-039`) | ARB | DATA |

### 3.3 Identity

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-031` | **Two runtimes mint customer sessions with the same shared HS256 secret** — the verification key is the forgery key (R-14 / ART-05 / IDN-R1 / SEC-R7). `export.ts:174` reuses the same secret for a third purpose | S1 | `VERIFIED-SOURCE` | `packages/auth-core/src/customer-session.ts:52,:86`; `routes/storefront/customer-registration.ts:141`; `customer-engagement-routes.ts:610,:770`; `routes/export.ts:174` | `03`, `05`, `08` | Mint a session in runtime A; verify it in runtime B; confirm a forged token from a leaked secret is accepted | — (unconditional) | ARB | IDENT |
| `ARCH-RESEARCH-032` | Merchant session **rotation and reuse-detection are unreachable** — both call sites pass `rotate:false` (introduced by the same commit that shipped the RPC), so a 30-day bearer never rotates. One of the two call sites is *correctly* `false`; the real defect is one site | S2 | `VERIFIED-SOURCE` | `175_fix_session_rpc_search_path.sql:37-56,:95-117`; `services/api-gateway/src/routes/auth.ts:387`; `middleware/auth.ts:136` | `03`, `08` | Flip `routes/auth.ts:387` to `rotate:true`; assert `session_token_rotation_events` populates and all four consumers propagate the new token | — | impl | IDENT |
| `ARCH-RESEARCH-033` | PostgreSQL mints session bearer tokens with `gen_random_bytes` on rotation — a **second credential minter** waiting to be switched on (R-14 sole-issuer) | S2 | `VERIFIED-SOURCE` | `175_fix_session_rpc_search_path.sql:95-117` | `03`, `05`, `08` | — | Enabling `ARCH-RESEARCH-032` activates it | ARB | IDENT |
| `ARCH-RESEARCH-034` | Six-digit OTP is brute-forceable: per-IP throttle only, no per-token or per-email attempt counter, and the token is validated by plain equality | S2 | `VERIFIED-SOURCE` | `03` §identity (`apps/identity-platform` OTP path) | `03`, `08` | 10⁶ guesses from rotating IPs against one email; measure success | — | impl | IDENT |
| `ARCH-RESEARCH-035` | Magic-link login is a **GET with no CSRF and no bot check**; console magic links are stateless and replayable for their full 15-minute TTL | S2 | `VERIFIED-SOURCE` | `03` §identity | `03`, `08` | Replay one link twice; confirm both succeed | — | impl | IDENT |
| `ARCH-RESEARCH-036` | Turnstile **fails closed with no timeout** — a Cloudflare `siteverify` degradation takes signup and login fully down | S2 | `VERIFIED-SOURCE` | `03` §observability; `08` | `09`, `08` | Black-hole `siteverify` in staging; measure signup availability | Turnstile p99 > 1 s | impl | IDENT |
| `ARCH-RESEARCH-037` | `/switch` destroys the caller's session **before** validating that the target user exists and is verified, stranding the caller on failure | S3 | `VERIFIED-SOURCE` | `apps/identity-platform/src/app/api/auth/switch/route.ts:84-110` | `03` | Switch to a non-existent user; assert the original session survives | — | impl | IDENT |
| `ARCH-RESEARCH-038` | Identity collapse is incomplete: gateway auth routes, the identity-foundation shadow stack and six micro-packages all survive alongside the canonical issuer (R-15 one-system-per-domain) | S1 | `VERIFIED-SOURCE` | `05` §drift; `services/api-gateway/src/routes/auth.ts` | `05`, `15` | Zero-importer proof per shadow package | — | impl | IDENT |

### 3.4 Tenancy

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-039` | **CONFIRMED — the packet's structural S0.** `app_tenant` + per-transaction GUC is DDL-real and runtime-dead. `withTenantTx` (`SET LOCAL ROLE app_tenant`) is reachable only via `withResolvedTenantTx`, which has **zero non-test callers**; 114 non-test gateway files use `getSupabaseAdmin` (`service_role`, BYPASSRLS) across ~1,300 `.from(` sites. Tenant isolation rests entirely on a JS `Proxy` heuristic. Two named gaps: tables absent from `tenant-tables.registry.ts` get **no guard**, and **77 `.rpc(` call sites are never intercepted** | **S0** | `VERIFIED-SOURCE` | `services/api-gateway/src/lib/tenant-transaction.ts:15,:29`; `lib/tenant-context.ts:67`; `lib/supabase.ts:13-15`; `tenant/tenant-scoped.ts:95,:115,:119`; `164_d4_tenant_role_guc.sql:11`; `163_d2_live_data_leak_rls.sql:11-14` | `03`, `05`, `14` §P0-4, `15` | Route one table through `withResolvedTenantTx`; assert the RT-2…RT-8 red-team cases return **zero rows** with an unset GUC | — (unconditional) | ARB | DATA |
| `ARCH-RESEARCH-040` | `checkout` is absent from **every** enforced reserved-name list, so any merchant can permanently claim the hostname the Constitution designates as the hosted-checkout origin. No DB backstop (`sites` carries only a UNIQUE index). Escalates to S1 the moment the host is attached | S2 | `VERIFIED-SOURCE` | `packages/tenant-core/src/index.ts:27-44,:46-57,:155-163`; `services/api-gateway/src/routes/stores.ts:647`; `infrastructure/dns/dns.tf:91-98`; `wrangler.toml:286` | `03`, `05`, `14` §P3-4 | `POST /stores` with `subdomain:"checkout"`; assert rejection | DNS attach of `checkout.letbuyy.com` to any deploy target | impl | PLAT |
| `ARCH-RESEARCH-041` | The SQL `validate_subdomain` reserved list diverges from `tenant-core` by 8 labels; **three divergent reserved-word lists** exist and no single-source validator ties them together | S2 | `VERIFIED-SOURCE` | `000_baseline.sql:8074-8084`; `packages/tenant-core/src/index.ts:27-57` | `03`, `05` | Assert set equality across the three lists **and** every `dns.tf` label | — | impl | PLAT |
| `ARCH-RESEARCH-042` | Migration 164 grants `app_tenant` DML on **all future tables** via `ALTER DEFAULT PRIVILEGES` without installing FORCE RLS or a policy for them | S2 | `VERIFIED-SOURCE` | `164_d4_tenant_role_guc.sql` (default-privileges block) | `03`, `05` | Create a new tenant table post-164; check FORCE + policy presence | — | impl | DATA |
| `ARCH-RESEARCH-043` | R2 object keys are **user-scoped, not site-scoped** (shipping labels keyed only by label id), and MIME validation trusts the client-declared content type | S2 | `VERIFIED-SOURCE` | `03` §storefront; `03` §data (R2 key construction) | `03`, `08` | Request another tenant's label id; assert 403 | — | ARB | PLAT |
| `ARCH-RESEARCH-044` | **No tenant fairness in any claim path** — all four claim functions order strictly by arrival time with no `site_id` term and no per-site cap. `tenant_execution_quotas` (with `noisy_neighbor_protection`) exists in schema with **zero TypeScript readers** | S2 | `VERIFIED-SOURCE` | `000_baseline.sql:754, :822, :966`; `141_executable_inventory_reservations.sql:323`; `000_baseline.sql:12506` | `03`, `07` §3.6, `14` §P2-3 | One tenant floods the queue; measure another tenant's confirmation latency | Any single site > 30% of claims in a 5-minute window | ARB | ASYNC |
| `ARCH-RESEARCH-045` | Outbox and platform-queue idempotency uniqueness is **global** rather than site-scoped | S3 | `VERIFIED-SOURCE` | `000_baseline.sql` (outbox/queue unique indexes) | `03` | Two sites emit the same idempotency key; assert both persist | — | ARB | ASYNC |
| `ARCH-RESEARCH-046` | TEST-R4: the tenant test file `AGENTS.md` names **does not exist**; the real red-team runs against a hand-built **13-table synthetic schema** that materially diverges from the production schema | S2 | `VERIFIED-TEST` | `tests/executable/tenant-redteam-postgres.test.mjs:25-38`; `AGENTS.md` TEST-R4 | `03` §tests | Replay the real migration set into the harness and re-run RT-2…RT-9 | — | ARB | QA |

### 3.5 Money

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-047` | **CONFIRMED S0 — the only S0 defect that survived challenge.** `POST /v1/checkout/:cartId/confirm` accepts any non-empty 1–200 char `provider_payment_id` with **no signature verification, no replay assertion, no provider-side amount or status check**, captures payment and posts a canonical ledger credit. The ledger and `payment_webhook_events` both record the fraud as legitimate | **S0** | `VERIFIED-SOURCE` | `services/api-gateway/src/routes/checkout.ts:596,:638`; `packages/checkout-core/src/index.ts:113-118` | `08`, `14` §P0-1, `16` | Run the full attack chain against staging; assert 4xx, no order, no ledger entry, no webhook-event row | — (unconditional) | impl | PAY |
| `ARCH-RESEARCH-048` | † Storefront Razorpay verification grants value on **signature alone** — no provider-side capture confirmation and no amount comparison | S1 | `VERIFIED-SOURCE` | `routes/storefront/checkout-payment-routes.ts` (verify path) | `03`, `08`, `14` | Sign a valid-signature payload for an uncaptured/short payment; assert rejection | — | impl | PAY |
| `ARCH-RESEARCH-049` | † `create_checkout_order` posts **zero canonical ledger entries** and can mark an order fully paid and captured with no ledger record | S1 | `VERIFIED-SOURCE` | `170_v1_shipping_rates_gst.sql:31-597` | `03`, `08` | Create a COD order; assert a ledger row exists | — | impl | PAY |
| `ARCH-RESEARCH-050` | † Operational money columns on `orders`, `payment_transactions`, `order_items` and gift cards are **`numeric` rupees, not `bigint` paise** (R-8 MUST) | S1 | `VERIFIED-SOURCE` | `000_baseline.sql` (`orders`, `payment_transactions`, `order_items` column types) | `03`, `05`, `15` | Sum a large ledger in both representations; compare to the paise total | — | ARB | PAY |
| `ARCH-RESEARCH-051` | † Roughly **30 `*_minor` money columns are 32-bit `integer`**, overflowing at ₹2.14 crore | S1 | `VERIFIED-SOURCE` | `000_baseline.sql` (`*_minor integer` columns) | `03`, `05` | Insert 2,147,483,648 paise; observe the failure | Any single order or gift card > ₹2 crore | impl | PAY |
| `ARCH-RESEARCH-052` | † The idempotency claim, the money RPC and the outbox emit are **three separate transactions** with no atomicity | S2 | `VERIFIED-SOURCE` | `routes/storefront/checkout-payment-routes.ts:411,:441-443`; `execution/order-execution.adapter.ts:158` | `03`, `09` | Kill the isolate between the RPC and the emit; inspect the resulting state | — | impl | PAY |
| `ARCH-RESEARCH-053` | † The refund path is correctly gated and ledgered, but the **gift-card restore is best-effort outside the refund transaction** | S2 | `VERIFIED-SOURCE` | `168_…` (`complete_order_refund`); gift-card restore call site | `03`, `08` | Fail the restore after a successful refund; check the balance projection | — | impl | PAY |
| `ARCH-RESEARCH-054` | Four compat ledgers retain live TypeScript writers (ART-10 / R-15 one-ledger) | S2 | `VERIFIED-SOURCE` | `05` §drift | `05`, `15` | Zero-writer proof per compat ledger | — | ARB | PAY |
| `ARCH-RESEARCH-055` | † Four gateway TypeScript call sites can author **arbitrary canonical ledger line-sets**, and `writer_module` is never explicitly set | S3 | `VERIFIED-SOURCE` | `03` §commerce (ledger call sites) | `03`, `08` | Assert every ledger write carries a `writer_module` from an allowlist | — | impl | PAY |
| `ARCH-RESEARCH-056` | † The self-custody `razorpayx` rail survives as residual CHECK-constraint enum values on frozen app-platform tables (R-7) | S3 | `VERIFIED-SOURCE` | `000_baseline.sql` (app-platform CHECK constraints) | `05` | — | — | impl | PAY |
| `ARCH-RESEARCH-057` | The money reconciliation harness exists but is **invoked by no workflow** | S1 | `VERIFIED-CONFIG` | `services/queue-workers/src/money-ledger-reconciliation.ts`; absent from `.github/workflows/` | `09`, `14` §P2-2 | Wire it; run against a seeded mismatch; assert detection | — | impl | PAY |
| `ARCH-RESEARCH-058` | Money-ledger reconciliation **mismatches are never alerted** — the count is logged at `info` and the logger never inspects it. Mitigated: the break is durably persisted and surfaced on an SoD-gated operator console, and the affected wallet read fails closed with 409. Scope gap: the job compares only `wallet_ledger_entries` vs `merchant_payable` — double-capture and gift-card drift are not detected at any latency | S1 | `VERIFIED-SOURCE` | `money-ledger-reconciliation.ts:102`; `services/queue-workers/src/index.ts:426-439,:648-662`; `160_…:198-256` | `09`, `14` §P2-2 | Seed a variance; measure time-to-human-notification | Any `money_ledger_site_reconciliations.status='mismatch'` row | ARB | PAY |
| `ARCH-RESEARCH-059` | Live money certification is entirely human-gated: capture, refund, payout, settlement and reconciliation are repository-correct but **unproven** | S1 | `HUMAN-REQUIRED` | `EXECUTABLE_HUMAN_REQUIRED.md`; `tests/executable/human-required-live-paths.test.mjs:9` (`test.skip`) | `04`, `17` | Execute one live ₹1 capture + refund in a controlled window | — | PROVIDER | FOUND |
| `ARCH-RESEARCH-060` | The secret matrix classifies Razorpay credentials as `workers.requiredSecrets` while governance law A4 **bans** provisioning them in the production deploy — an adjudicated deferral recorded as a requirement. Corrected from S1: they *are* rotatable via `rotate-secrets.mjs`, recorded in the HR runbook, and the 503 is the intended launch-phase behaviour | S3 | `VERIFIED-SOURCE` | `config/env/staging-production-secret-matrix.json:135-141,:148,:249-256`; `scripts/validators/deployment-safety-validator.mjs:139-155` | `04`, `05` | Assert every human-deferred secret sits in a `deferred` bucket, not `required` | — | ARB | GOV |
| `ARCH-RESEARCH-061` | **REFUTED headline, surviving remainder.** "The only behavioural money proof tests an RPC with zero production callers" is false — `post_ledger_transaction` is the transitive kernel of every production money write, and ≥2 behavioural suites prove it. **What survives:** no executable test loads migrations **165, 168 or 170**, so the *deployed bodies* of `confirm_order_payment_with_ledger`, `complete_order_refund` and `create_checkout_order` are behaviourally untested | S3 | `VERIFIED-SOURCE` | `139_…:223`; `165_d5_canonical_money_paths.sql:253`; `168_…:133,:314`; `tests/executable/settlement-postgres.test.mjs:256,:264-277` | `03` §tests, `14` | Load 165/168/170 into the harness and assert the money invariants against the deployed bodies | — | impl | QA |

### 3.6 Checkout

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-062` | The live public order-create route **bypasses the ART-14 signed cart handoff entirely**, is unauthenticated (`authMiddleware` is registered 27 lines later and Hono composes in order) and un-bot-gated; the client supplies `items`, and COD orders commit inventory with zero payment. Corrected from S0: a per-source-IP limit of 20 orders / 5 min applies and products need an `inventory_levels` row | S1 | `VERIFIED-SOURCE` | `routes/storefront/checkout-payment-routes.ts:251`; `public-routes.ts:763`; `services/api-gateway/src/index.ts:752` vs `:779` | `03`, `08`, `14` §P0-2 | Post an order whose `items` differ from the bound cart; assert rejection. Also: expired token, cross-site token | — (unconditional) | ARB | PAY |
| `ARCH-RESEARCH-063` | † `create_checkout_order` rejects `'cashfree'` although four routes and the payment adapters accept it | S1 | `VERIFIED-SOURCE` | `170_v1_shipping_rates_gst.sql:31-597`; four accepting routes (`03` §commerce) | `03` | Drive a `cashfree` checkout end-to-end; observe the RPC rejection | — | impl | PAY |
| `ARCH-RESEARCH-064` | † The ART-14 cart binding omits an explicit subtotal term, and the signed URL is a **reusable bearer capability** for its 10-minute life | S3 | `VERIFIED-SOURCE` | `routes/storefront/cart-routes.ts:540-544,:567` | `03`, `08` | Reuse one signed handoff twice; assert single-use | — | impl | PAY |
| `ARCH-RESEARCH-065` | The client React cart still asserts `stock: 999` — LEG-079 demotion to a thin view is incomplete | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime` cart context (`05` §drift) | `05` | Assert the client renders server stock | — | impl | STORE |
| `ARCH-RESEARCH-066` | GraphQL and checkout-extension surfaces remain mounted with flags **enabled outside production** | S2 | `VERIFIED-SOURCE` | `services/api-gateway/wrangler.toml:39-41` (top-level `FEATURE_GRAPHQL`/`EXTENSIONS`/`LIQUID = "true"`) | `05`, `08` | Probe the surfaces on staging; assert 404 | — | ARB | PLAT |
| `ARCH-RESEARCH-067` | † The hosted checkout origin `checkout.letbuyy.com` has **no serving implementation** — no root `/checkout` route, no Vercel project binds the host; handoff minting fails closed with 503 when the signing secret is absent | S1 | `VERIFIED-SOURCE` | `apps/storefront-runtime/src/app` (no root `checkout` route); `config/vercel/projects.json`; `cart-routes.ts:540-544` | `03`, `04`, `05` | Resolve the host; assert it serves the platform checkout | — | ARB | PLAT |

### 3.7 Cache

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-068` | **(= C-1) The first bottleneck.** The KV rate limiter is a **non-atomic read-modify-write** on an eventually-consistent store (1 KV read + 1 KV **write** per limited request), so limits are per-colo, not global, and under-enforce precisely during a burst. Cloudflare documents **1 write/second/key → HTTP 429**; the code converts that into an **isolate-global 60 s–10 min backoff returning 503 `RATE_LIMIT_UNAVAILABLE` on every non-exempt `/v1` route** | S1 | `VERIFIED-SOURCE` + `INFERRED` | `services/api-gateway/src/middleware/rateLimit.ts:321-325, :618-623, :42, :627, :577-583, :1078-1088`; `wrangler.toml:259`; `evidence/03-rate-limiter-backend.txt`; `10` (vendor limit) | `07` §3.2, `14` §P1-1 | Fire 10 concurrent requests sharing one rate-limit key against staging; observe 429s then the 503 window | Any KV 429, or > 1 write/s on any limiter key | PROVIDER | PLAT |
| `ARCH-RESEARCH-069` | **(= C-2a)** A fresh `X-Request-ID: crypto.randomUUID()` on every server-side gateway fetch enters both the Next 16.1.6 Data Cache key and the request-memoisation key, making every key unique. 19 `storefrontReadInit` call sites; no `React.cache`/`unstable_cache` compensates. The gateway already synthesises a request ID when absent, so removal costs no traceability | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime/src/lib/api/client.ts:45`; `services/api-gateway/src/middleware/security.ts:292` | `07` §3.3, `14` §P1-2 | Request one product page twice; count gateway invocations | Data Cache hit ratio < 50% | impl | STORE |
| `ARCH-RESEARCH-070` | **(= C-2b)** No `/store/*` route can populate the Full Route Cache: an unconditional cookie read in the tenant layout forces the whole subtree dynamic, and PPR/`cacheComponents` is off. Every `export const revalidate` beneath it is **inert for HTML**. (Corrected: a `public, max-age=300` CDN directive *is* configured — whether Vercel honours it is unverifiable without live access) | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:76`; `lib/theme-preview-server.ts:12`; `next.config.ts` (no `experimental` block) | `07` §3.3, `14` §P1-2 | Inspect `x-vercel-cache` on repeated identical requests | HTML cache hit ratio < 50% | impl | STORE |
| `ARCH-RESEARCH-071` | **(= C-2c)** `cachedJson` has **no request coalescing and no serve-stale path** — every concurrent miss on a cold key runs the full origin producer. `stale-while-revalidate=300` is emitted as a header string only and drives no background refresh. Corrected from S1: TTL is 60 s, the pool caps at 5 connections, and KV version propagation is staggered, so the amplifier is bounded | S3 | `VERIFIED-SOURCE` | `services/api-gateway/src/lib/storefront-cache.ts:107-130, :12-13, :77, :89` | `07` §3.3, `14` §P1-2 | N concurrent requests on one cold key; count producer executions | Origin producer executions > 2× cache misses | impl | PLAT |
| `ARCH-RESEARCH-072` | Next cache tags are declared but **`revalidateTag` is never called anywhere in the repository** | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime/src/lib/api/client.ts:24-31`; repo-wide absence of `revalidateTag` | `03`, `07` | Mutate a product; assert the tagged entry is purged | — | impl | STORE |
| `ARCH-RESEARCH-073` | Only theme publish bumps the storefront cache version — catalog, navigation, page and domain mutations invalidate **nothing** | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/lib/storefront-cache.ts:89` (sole bump call site) | `03`, `07` | Edit a product; measure staleness at the edge | Any stale-catalog support ticket | impl | PLAT |
| `ARCH-RESEARCH-074` | Non-200 storefront responses are never cached, so 404 and scrape traffic reaches PostgreSQL unthrottled | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/lib/storefront-cache.ts:107-130` | `03`, `07`, `09` | Flood 404s; measure origin DB queries | 404 rate > 10% of storefront traffic | impl | PLAT |
| `ARCH-RESEARCH-075` | Storefront cache-version KV keys are written with **no TTL**, and a read failure silently degrades to version `'0'` — collapsing every tenant onto one shared key namespace | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/lib/storefront-cache.ts:77, :89` | `03`, `07` | Fail the KV read; observe the version and the resulting key collisions | — | impl | PLAT |
| `ARCH-RESEARCH-076` | The KV write-per-request ceiling is a **documented** saturation limit in production with **no metric and no alarm** | S1 | `VERIFIED-CONFIG` | `services/api-gateway/wrangler.toml:257-259` (the team's own comment); no emitter | `07`, `09`, `14` §P1-1 | Emit KV write rate; compare to the account allowance / 86400 | KV writes > 50% of the daily allowance | PROVIDER | SRE |
| `ARCH-RESEARCH-077` | Cache hit ratio has **no emission point** — it exists only as a response header, and the storefront render log hard-codes `cache_hit: null` | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime` render log; `services/api-gateway/src/lib/storefront-cache.ts` | `07`, `09` | Instrument, then read Analytics Engine | — (blocks measuring 069–071) | impl | SRE |

### 3.8 Queue and async

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-078` | The events backbone is a **post-commit TypeScript dual write at 38 non-test call sites across 28 files** (ARCH-R8 / ARCH-004 / PAY-007 / R-16). The `writeWithOutbox` "same-transaction helper" is **not** one — it executes the write and then a separate insert. `checkout.completed` is emitted by **both** SQL and TypeScript with **different idempotency keys**, producing duplicate rows for one business event. Corrected from S0: ledger-bearing events *are* written in-transaction by SQL, and the dominant failure mode is a loud 500, not silence | S1 | `VERIFIED-SOURCE` | `services/api-gateway/src/execution/event-execution.adapter.ts:60-77,:79-85`; `packages/event-core/src/index.ts:1120-1166`; `170_…:550,:568`; `routes/checkout.ts:739` | `03`, `05`, `15` | Kill the isolate between commit and emit; assert no event is lost | — | ARB | ASYNC |
| `ARCH-RESEARCH-079` | **(= C-8)** The automatic outbox relay caps at **50 × 96 = 4,800 events/day** against ~6,000–8,000 at the envelope top. The RPC already permits 100 rows/claim, so **the current setting uses half the available headroom**. Corrected from S0: an operator dispatch route exists, order-confirmation email does *not* traverse the outbox, and fanout is source-enumerated, not measured | S2 | `VERIFIED-CONFIG` | `services/api-gateway/wrangler.toml:236`; `src/index.ts:945-947`; `000_baseline.sql:756`; `execution/outbox-execution.adapter.ts:74` | `07` §3.6, `14` §P1-4 | Synthesise 1,000 orders/day; measure unrelayed `outbox_events` depth over 72 h | Unrelayed depth rising for 3 consecutive ticks | impl | ASYNC |
| `ARCH-RESEARCH-080` | Webhook delivery dispatch capacity is likewise **4,800/day** — below one subscription per merchant at target order volume. One deliberately slow target stalls the entire 50-delivery tick (sequential `await`) | S2 | `VERIFIED-CONFIG` | `services/webhook-service/src/index.ts:648-658`; cron config | `07` §3.6 | Register a 30 s-latency endpoint; measure tick completion | Webhook backlog age > 15 min | impl | ASYNC |
| `ARCH-RESEARCH-081` | The signed queue tenant envelope expires after **15 minutes**, so once a backlog forms, messages are **permanently dropped** | S1 | `VERIFIED-SOURCE` | `packages/…/signQueueTenantEnvelope`; consumer verification path (`03` §async) | `03`, `09` | Delay a message past 15 min; assert it still processes | Queue age p99 > 10 min | impl | ASYNC |
| `ARCH-RESEARCH-082` | Dead-letter redrive for Cloudflare queues is a **no-op** — nothing consumes `distributed_queue_messages`, and the sole writer inserts rows already in terminal status | S1 | `VERIFIED-SOURCE` | `services/queue-workers/src/index.ts:226-232,:575`; `000_baseline.sql:642` (`claim_distributed_queue_messages`, zero TS callers) | `03`, `09` | Dead-letter a message; attempt redrive; assert delivery | Any DLQ row | impl | ASYNC |
| `ARCH-RESEARCH-083` | Email dispatch is **not idempotent per message**: no already-sent lookup, no Resend idempotency header, dispatch runs before the ack, and the outer catch retries the **whole batch**. Corrected from S0: the amplification is small-batch, and the path is currently gated off by an unprovisioned key | S2 | `VERIFIED-SOURCE` | `services/queue-workers/src/index.ts:482-526,:503,:598,:606,:620-621`; `packages/infrastructure/resend-adapter/index.ts:52-75` | `03`, `09`, `14` §P2-6 | Fail message N of a batch; count duplicate sends | Any duplicate-email report | impl | ASYNC |
| `ARCH-RESEARCH-084` | **Production order-confirmation emails appear to be silently dropped, not duplicated** — the producer binding is present but `RESEND_API_KEY` is **never provisioned to `queue-workers`** by any workflow, while the job is marked processed. The adversarial pass flagged this as *the higher-priority defect on that path* | S2 | `VERIFIED-CONFIG` | `.github/workflows/production-deploy.yml:358-362` vs `:329,:331`; `services/queue-workers/wrangler.toml` (zero `RESEND` hits); `lib/order-confirmation-email.ts:127-130` | `03`, `04`, `09` | Place one order in staging; assert an email is actually delivered | — (unconditional) | impl | ASYNC |
| `ARCH-RESEARCH-085` | Post-commit event idempotency keys embed a **per-request UUID**, so retries create duplicate outbox events | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/execution/event-execution.adapter.ts:60-77` | `03`, `09` | Retry one request; count outbox rows | — | impl | ASYNC |
| `ARCH-RESEARCH-086` | The stale inventory-reservation sweeper is wired as ART-15 requires but is capped at **1,000 expirations/day** | S2 | `VERIFIED-SOURCE` | `141_executable_inventory_reservations.sql:323`; cron config | `03`, `07` | Create 2,000 stale reservations; measure recovery | Expired-reservation backlog > 500 | ARB | ASYNC |
| `ARCH-RESEARCH-087` | The queue circuit breaker is **per-isolate in-memory state** and cannot hold across the Worker fleet | S3 | `VERIFIED-SOURCE` | `services/queue-workers/src` (in-memory breaker) | `03`, `09` | Trip the breaker; observe other isolates continuing | — | impl | ASYNC |
| `ARCH-RESEARCH-088` | Every authenticated merchant request performs a **PostgreSQL row lock plus an unconditional row `UPDATE`** — a write per read | S2 | `VERIFIED-SOURCE` | `175_fix_session_rpc_search_path.sql:119-124`; `services/api-gateway/src/middleware/auth.ts:136` | `07` §3.4 | `pg_stat_statements` share of the session-update statement | Session UPDATE > 10% of total statements | impl | IDENT |
| `ARCH-RESEARCH-089` | `mobile-bff /v1/mobile/dashboard` fans out to **6 uncached gateway calls**, each repeating its own authorization query, over unbounded orders scans | S2 | `VERIFIED-SOURCE` | `services/mobile-bff/src/index.ts` (dashboard composite) | `03`, `07` | Measure DB statements per dashboard load | Dashboard p95 > 1 s | impl | PLAT |
| `ARCH-RESEARCH-090` | The push dispatcher runs **dry-run in production and counts every dry run as sent** (R-22 truthful-honesty-badge MUST, PAY-R10) | S1 | `VERIFIED-CONFIG` | `services/queue-workers` push dispatcher; production vars (`03` §async) | `03`, `05`, `09` | Assert a dry-run never increments a `sent` counter | — | impl | ASYNC |
| `ARCH-RESEARCH-091` | The runtime dead-letter queue is misclassified by a **substring check** — DLQ messages are recorded as completed and re-dispatched | S2 | `VERIFIED-SOURCE` | `services/queue-workers/src/index.ts` (DLQ classification) | `03`, `09` | Send a DLQ message; assert it is not re-dispatched | — | impl | ASYNC |
| `ARCH-RESEARCH-092` | **No behavioural test exercises the queue consumer, the outbox relay, or the webhook dispatcher** | S2 | `VERIFIED-SOURCE` | `services/queue-workers/test/` (no queue-handler test) | `03` §tests, `13` | Write one; it either passes or exposes a defect | — | impl | QA |

### 3.9 Deploy and release

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-093` | **CONFIRMED** — the production rollout script hardcodes **three frozen app roots** and runs `vercel deploy --prod` on them under `--execute`, violating ART-22 with **zero validator coverage**. Reachable from **two** workflows, one of which passes `--skip-validation`, bypassing the governance gate entirely. It is the *documented* promotion command with `target=all` as the default | S1 | `VERIFIED-SOURCE` | `infrastructure/scripts/deploy/production-deploy.mjs:121-130,:138-140`; `.github/workflows/production-rollout.yml:174`; `infrastructure/scripts/operations/phase4-live-certify.mjs:135`; `infrastructure/deployment/release-promotion.yaml:19` | `04`, `05`, `14` | Assert no frozen root appears in `appRoots` in any deploy script | — (unconditional) | impl | REL |
| `ARCH-RESEARCH-094` | All four Worker configs set a top-level `name` identical to their `[env.production].name`, and the api-gateway top-level block is **staging-flavoured with forbidden flags on and no routes, KV, D1, Hyperdrive, DO, service or analytics bindings** — one `wrangler deploy` without `--env` replaces the production Worker | S2 | `VERIFIED-CONFIG` | `services/api-gateway/wrangler.toml:1` vs `:219`, `:32-41`, `:73-96`; same pattern in the other three | `04`, `05` | Deploy to a scratch Worker without `--env`; diff the resulting bindings | — | impl | REL |
| `ARCH-RESEARCH-095` | **Release-integrity gap.** `production-deploy.yml` hard-blocks release-preflight on two Upstash secrets that the dated runbook says do not exist, and transitively gates every production Worker deploy. Corrected from "contradiction": the workflow states a *requirement*, the runbook a *state* — both hold if the gated pipeline never completes, which the runbook's own root cause (a plain `wrangler deploy`) implies | S2 | `VERIFIED-CONFIG` | `.github/workflows/production-deploy.yml:76-77,:111-112,:131,:287-289,:327-328`; `services/api-gateway/wrangler.toml:250-259`; `docs/runbooks/production-api-rate-limit-backend.md:24-28,:74-82` | `04`, `14`, `17` | Operator states whether `PRODUCTION_UPSTASH_*` exist and whether any run reached `deploy-workers-production` | — | PROVIDER | FOUND |
| `ARCH-RESEARCH-096` | ART-03's staging collapse is incomplete: **three staging workflow files remain, two auto-trigger**, and one named "Staging Runtime Deployment" fires on pushes to the **production** branch | S2 | `VERIFIED-CONFIG` | `.github/workflows/staging-deploy.yml`, `deploy-staging.yml`, `staging-runtime-deployment.yml` | `04`, `05` | Assert exactly one staging workflow exists | — | impl | REL |
| `ARCH-RESEARCH-097` | The automatic staging lane deploys code **without migrating the staging database** | S2 | `VERIFIED-CONFIG` | `.github/workflows/staging-deploy.yml` (no migrate step) | `04`, `05` | Deploy a schema-dependent change to staging; observe the failure | — | impl | REL |
| `ARCH-RESEARCH-098` | The two production deploy paths use **different wrangler var semantics** (`--keep-vars` vs replace) | S2 | `VERIFIED-SOURCE` | `.github/workflows/production-deploy.yml` vs `infrastructure/scripts/deploy/production-deploy.mjs` | `04`, `05` | Deploy via each path; diff the resulting var set | — | impl | REL |
| `ARCH-RESEARCH-099` | The identity "production runtime" gate excludes staging and preview, so **non-production deploys sign PII cookies with a public literal** and mint no asymmetric token | S2 | `VERIFIED-SOURCE` | `apps/identity-platform/src/lib/auth/cookies.ts:13`; environment gate (`03` §identity) | `03`, `08` | Decode a staging `lb_accounts` cookie with the public literal | — | impl | IDENT |
| `ARCH-RESEARCH-100` | `/v1/health` is a **hardcoded literal**, yet it is what deployment health gates check and the only SLO measures | S1 | `VERIFIED-SOURCE` | `services/api-gateway/src/index.ts` (health handler) | `04`, `09` | Break PostgreSQL; assert `/v1/health` reports unhealthy | — | impl | SRE |
| `ARCH-RESEARCH-101` | WhatsApp is unreachable in production because `queue-workers` never sets `WHATSAPP_PROVIDER_MODE` | S2 | `VERIFIED-CONFIG` | `services/queue-workers/wrangler.toml` (var absent) | `04`, `09` | Send one WhatsApp message from staging | — | PROVIDER | ASYNC |
| `ARCH-RESEARCH-102` | No backup/restore drill is ever executed; production-deploy **backs up but never restores** | S2 | `VERIFIED-CONFIG` | `.github/workflows/production-deploy.yml` (backup step, no restore) | `09`, `17` | Restore one backup into an isolated project and time it | — | PROVIDER | FOUND |
| `ARCH-RESEARCH-103` | E2E and smoke suites are absent from the **PR** gate. **Corrected by `13` §A.4.3:** the active staging lane **does** have a `smoke-test-staging` job — but every step is gated on credentials being present (prints `SKIP:` and passes without them), two of its four checks accept `302`, and the API check asserts 200 from `/v1/health`, which returns a **hardcoded literal**. The correct statement is "a liveness ping against a constant, and no functional test". Spec count: **9** `.spec.ts` files, not 2 or 10 | S2 | `VERIFIED-CONFIG` + `VERIFIED-SOURCE` | `.github/workflows/deploy-staging.yml:174-215, :180-184, :200, :211`; `services/api-gateway/src/index.ts:311-318` | `13` §A.4.3 | Run the staging lane with credentials absent; observe the job pass | — | impl | QA |
| `ARCH-RESEARCH-104` | Frozen-app and reserved-service deploy identifiers persist in environment templates and the Cloudflare resource registry | S3 | `VERIFIED-CONFIG` | `config/env/templates/`; `infrastructure/cloudflare/resource-names.json` | `05` | Assert no frozen/reserved identifier appears in either | — | impl | GOV |
| `ARCH-RESEARCH-105` | **(= C-9)** The Vercel governor is **1,000 concurrent executions per 10 s per region → 503 `FUNCTION_THROTTLED`, rejected not queued**; the 30,000 ceiling is irrelevant. Because ~100% of storefront traffic reaches a function (`069`–`071`), there is **no CDN buffer** between a spike and this governor | — | `INFERRED` over vendor limit | `07` §3.7; `10` (Vercel limits, accessed 2026-08-16) | `07`, `09`, `11` | Ramp 0 → 5,000 concurrent in 30 s against staging; count `FUNCTION_THROTTLED` | Any `FUNCTION_THROTTLED` in production | impl | STORE |
| `ARCH-RESEARCH-106` | DEPLOY-R1's branch-lag guard is **verified enforcing**, but `BRANCH_STRATEGY.md` still asserts the resolved lag as a live gap | S3 | `VERIFIED-SOURCE` | `scripts/validators/branch-lag-guard-validator.mjs:57-90`; `BRANCH_STRATEGY.md` | `05` | — | — | impl | GOV |

### 3.10 Observability

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-107` | **Incident paging has no delivery channel.** Every 5xx plans an alert with job type `incident.page.dry_run`; the consumer sets `mode:'dry_run'` as a **literal** regardless of the configured adapter, then writes a database row. No PagerDuty/Opsgenie/Slack/Alertmanager receiver exists anywhere. Corrected from S0: this is a *recorded, gate-enforced, human-owned seam*, not a silent defect, and the platform cannot yet take live money | S1 | `VERIFIED-SOURCE` | `services/api-gateway/src/lib/runtime-alerting.ts:7,:108-110,:189`; `middleware/observability.ts:305`; `services/queue-workers/src/routes/…/incident-command.ts:96,:107-125`; `133_internal_os_incident_command.sql:16` | `09`, `14` §P2-1 | Trigger a 5xx in staging; measure time-to-human-notification | Any production 5xx | ARB | SRE |
| `ARCH-RESEARCH-108` | **(= C-7)** The observability middleware is mounted globally and **unconditionally inserts one `runtime_telemetry_metrics` row per request**, plus one `worker_request_logs` row for all but 2%-sampled anonymous storefront GET/HEAD — and the shadow-mirror trigger doubles both. **DB write load scales with total requests, not commerce volume.** Corrected from S1: the writes are `waitUntil`-dispatched (no in-band latency), the pool mechanism cited was wrong (PostgREST, not the `max:5` pool), and "dominant" is not established | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/index.ts:655`; `middleware/observability.ts:265-302,:338-381,:199-204`; `wrangler.toml:61`; `131_…:112-122` | `07` §3.5, `14` §P1-3 | `pg_stat_statements` for the two insert statements vs total request count | Telemetry inserts > 25% of all statements | ARB | SRE |
| `ARCH-RESEARCH-109` | Two observability artifacts are **dead config** (an OTel collector exporting to a Kubernetes topology that does not exist; Prometheus rules alerting on four metric names with **zero emitters**), and runtime manifests plus a deploy gate assert a telemetry stack no code implements. Corrected from S1: a **real** pipeline does exist — Analytics Engine bindings in all four Workers, and the Grafana dashboards query exactly the metric names the code emits | S2 | `VERIFIED-SOURCE` | `infrastructure/observability/otel-collector.yaml:29,:33`; `prometheus-rules.yaml:5,:14,:23`; `middleware/observability.ts:166`; `grafana-runtime-dashboard.json:19,:31` | `09`, `14` | Delete the dead artifacts; assert nothing breaks | — | ARB | SRE |
| `ARCH-RESEARCH-110` | Exactly **one** SLO exists — `deployment-gate-success`, target 100% over 30 d — and its SLI is populated from health-gate probes against `/v1/health`, i.e. **from an endpoint that returns a hardcoded literal** (`ARCH-RESEARCH-100`). Nothing else consumes the catalogue. There is **no** availability, latency, checkout-success, payment-success or refund SLO, and no error budget is computed anywhere | S1 | `VERIFIED-CONFIG` | `infrastructure/monitoring/slo-catalog.yaml:1-9`; `services/api-gateway/src/index.ts:311-318`; only consumer is `docs/governance/sre-governance.md:7` | `09`, `12` §3, `13` §A.4.4 | Define and measure one user-facing SLO against a real dependency probe | — **(blocks every trigger in `12`)** | ARB | SRE |
| `ARCH-RESEARCH-111` | Two of the four Workers declare the `RUNTIME_TELEMETRY` binding but **never write a data point** | S2 | `VERIFIED-SOURCE` | `services/webhook-service/wrangler.toml:61-63`; `services/mobile-bff/wrangler.toml:79-81`; no `writeDataPoint` call | `09` | Query the dataset per Worker | — | impl | SRE |
| `ARCH-RESEARCH-112` | Analytics Engine data points are **write-only** — nothing in the repository reads the `RUNTIME_TELEMETRY` dataset | S2 | `VERIFIED-SOURCE` | `middleware/observability.ts:254-263`; no reader | `09` | Wire one read path; confirm the data is queryable | — | impl | SRE |
| `ARCH-RESEARCH-113` | Cloudflare Workers Logs head sampling of `0.1` discards roughly **90% of structured error logs** | S2 | `VERIFIED-CONFIG` | `services/api-gateway/wrangler.toml` (observability sampling) | `09` | Emit 1,000 known errors; count what arrives | Error volume high enough that 10% is not representative | impl | SRE |
| `ARCH-RESEARCH-114` | Runbooks reference a metric that **does not exist**, and there is no restore, connection-exhaustion, or provider-outage runbook | S2 | `VERIFIED-SOURCE` | `docs/runbooks/`; `prometheus-rules.yaml` metric names | `09`, `17` | Run one drill from each missing runbook | — | impl | SRE |
| `ARCH-RESEARCH-115` | **No audit record is written for any merchant authentication event** — login, switch, logout, session create — in either identity-platform or the gateway | S2 | `VERIFIED-SOURCE` | `apps/identity-platform/src/app/api/auth/*`; `services/api-gateway/src/routes/auth.ts` | `08`, `09` | Log in; query `audit_logs` for the event | — | impl | IDENT |
| `ARCH-RESEARCH-116` | Two different definitions of "production runtime" make staging **structurally unable to prove production rate-limit behaviour** | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/middleware/rateLimit.ts` (`isProduction` branches) vs staging vars | `04`, `13` | Compare limiter behaviour under staging and production var sets | — (blocks falsifying `068`) | impl | PLAT |
| `ARCH-RESEARCH-117` | Product-view analytics are **silently skipped on every cache hit** | S3 | `VERIFIED-SOURCE` | `services/api-gateway/src/routes/storefront/public-routes.ts` (analytics after cache return) | `09` | Compare view counts with the cache on and off | — | impl | STORE |
| `ARCH-RESEARCH-118` | Mobile crash reporting has a real Sentry transport but every shipped build carries the **placeholder DSN**, so it is disabled | S3 | `VERIFIED-SOURCE` | `apps/mobile/merchant-app/lib/services/crash_reporting_service.dart:171-231`; `config/env/templates/mobile.dart-defines.example:13` | `09`, `17` | Ship a build with a real DSN; force a crash | — | PROVIDER | SRE |
| `ARCH-RESEARCH-119` | No distributed tracing exists despite the observability contract declaring traces and spans as supported signals | S3 | `VERIFIED-SOURCE` | `config/runtime/observability-platform.json`; zero `@opentelemetry` deps in `apps/*` or `services/*` | `09` | Add one span; confirm it arrives | — | impl | SRE |
| `ARCH-RESEARCH-120` | Live production certification **cannot reach execute mode from repository state** and has produced no recorded evidence | S2 | `VERIFIED-CONFIG` | `config/runtime/live-production-certification.json:5,:17`; `infrastructure/scripts/observability/verify-observability-rollout.mjs:63-65` | `04`, `17` | Supply credentials; run it; record the artefact | — | PROVIDER | FOUND |

### 3.11 Cost and efficiency

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-121` | `bcryptjs` cost 12 runs **inside the api-gateway Worker on the login path** with no declared CPU limit; Workers terminate on CPU exhaustion with a client-visible Error 1102 (no throttling, no queueing) | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/routes/auth.ts` (bcrypt call); `07` §3.1 (vendor behaviour) | `07`, `10` | Measure Worker CPU ms on the login path at concurrency | Login p99 CPU > 200 ms | impl | IDENT |
| `ARCH-RESEARCH-122` | † Every order creation runs an **unindexed `COUNT`** over the store's orders for the monthly quota check | S2 | `VERIFIED-SOURCE` | `170_…` / order-create path (`03` §commerce) | `03`, `07` | `EXPLAIN ANALYZE` the count at 100k orders | Any store > 50k orders | impl | PAY |
| `ARCH-RESEARCH-123` | † Public storefront order create performs **~15 DB round-trips** and holds per-SKU product and inventory row locks across a 30–40 statement transaction | S2 | `VERIFIED-SOURCE` | `routes/storefront/checkout-payment-routes.ts:251`+ | `03`, `07` §3.4 | Measure statements and lock-hold time per order | Lock hold > 100 ms | impl | PAY |
| `ARCH-RESEARCH-124` | The bootstrap payload serialises the theme release **twice** and is fetched **three times per page render** | S2 | `VERIFIED-SOURCE` | `routes/storefront/public-routes.ts:582-603`; storefront bootstrap call sites | `03`, `07` | Count bootstrap fetches per render | — | impl | STORE |
| `ARCH-RESEARCH-125` | The store layout fetches up to **100 full product rows on every page render** purely to seed header search | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` | `03`, `07` | Measure bytes and DB time per render | — | impl | STORE |
| `ARCH-RESEARCH-126` | A KV read is issued **per cacheable gateway call (~15 per page render)** even on cache hits, on top of the limiter's write-per-request | S3 | `VERIFIED-CONFIG` | `services/api-gateway/src/lib/storefront-cache.ts:77`; `middleware/rateLimit.ts:321-325` | `07` §3.2, `10` | Count KV operations per page render | KV reads > 80% of the included 10 M/month | PROVIDER | PLAT |
| `ARCH-RESEARCH-127` | **(= C-10, business-timeline risk)** Vercel caps custom-domain onboarding at **100 additions/hour and 50 verifications/hour per team** — onboarding 10,000 merchant apex domains takes **> 8 days end-to-end assuming zero retries**. The `*.letbuyy.com` wildcard consumes one slot, so subdomain tenancy is free and instant | — | `VERIFIED-CONFIG` (vendor) + `HUMAN-REQUIRED` | `10` (Vercel domain limits, accessed 2026-08-16); `07` §3.7 | `07`, `10`, `17` | Add 150 domains in one hour; observe the rate limit | Custom-domain queue > 100 pending | PROVIDER | FOUND |

### 3.12 Governance and the gate

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-128` | **The governance gate is green while the invariant it exists to enforce is unimplemented** — the ART-02 failure mode reproduced exactly. The `no-blanket-service-role` validator is a `.includes()` string check, so the gate passes while the runtime path is `service_role` | S1 | `VERIFIED-SOURCE` | `scripts/validators/no-blanket-service-role-validator.mjs:9-21`; cross-reference `ARCH-RESEARCH-039` | `05`, `14` §P3-6, `15` | Make one validator behavioural; observe whether the gate still passes | — | impl | GOV |
| `ARCH-RESEARCH-129` | **No validator enforces runtime-root membership for `services/`.** `runtime-validator.mjs` readdirs `apps/` and rejects unexpected roots, but for services it only iterates the canonical list — an undeclared service root is **structurally undetectable**. (The topology dimension rated this S2; the governance dimension rated the same mechanism S1. Unreconciled — no adversarial verdict on either) | S2 / S1 (split) | `VERIFIED-SOURCE` | `scripts/validators/runtime-validator.mjs:21,:33-48,:72`; `AGENTS.md:81` | `05`, `14` §P3-3 | Add a scratch `services/x/package.json`; assert the gate fails | — | impl | GOV |
| `ARCH-RESEARCH-130` | `migration-safety-validator` **mandates** the scheduled production partition-maintenance workflow — a gate validator enforcing a constitutionally rejected capability (ANTI-R3) | S1 | `VERIFIED-SOURCE` | `scripts/validators/migration-safety-validator.mjs`; `LETBUYY_CONSTITUTION.md` ART-23 | `05`, `15` §4.2 | Remove the workflow; observe the gate fail | — | ARB | GOV |
| `ARCH-RESEARCH-131` | `durable-object-validator` **requires the unused DO class, its migration tag and its export to keep existing** — a concrete, citable instance of the gate enforcing something that is not a constitutional invariant | S2 | `VERIFIED-SOURCE` | `scripts/validators/durable-object-validator.mjs:17-18`; `evidence/04-…txt` (first-hand) | `05`, `14` §P3-6 | Delete the DO; observe the gate fail on dead code | — | impl | GOV |
| `ARCH-RESEARCH-132` | Two gate validators' **entire offender-scan loop is dead code during a real gate run** — both open with `if (!entry.extra) continue;`, and `extra` is true only for fixtures injected by an env var set nowhere but their own unit tests. This pattern is anomalous: 13 other `entry.extra` uses across `scripts/` do the opposite | S2 | `VERIFIED-SOURCE` | `scripts/validators/rls-force-coverage-validator.mjs:36`; `one-system-per-domain-validator.mjs:28`; `phase-b-common.mjs:19-43,:52-59` | `05`, `14` §P3-6 | Plant a real offender file; assert the validator fails | — | impl | GOV |
| `ARCH-RESEARCH-133` | `no-public-using-true-validator` is **blind to policies with no `TO` clause** — the exact defect class migration 163 was written to fix, and the class that produced `ARCH-RESEARCH-153`/`154` | S1 | `VERIFIED-SOURCE` | `scripts/validators/no-public-using-true-validator.mjs:19`; `163_d2_live_data_leak_rls.sql:1-4` | `05`, `14` §P0-5 | Add a `USING(true)` policy with no `TO`; assert the gate fails | — | impl | GOV |
| `ARCH-RESEARCH-134` | `no-blanket-service-role-validator` **exempts `services/` and `packages/`** and proves the `app_tenant` helper only by string match | S2 | `VERIFIED-SOURCE` | `scripts/validators/no-blanket-service-role-validator.mjs:9-21,:29-33` | `05` | Add a blanket `service_role` client under `services/`; assert failure | — | impl | GOV |
| `ARCH-RESEARCH-135` | Security-critical validators certify behaviour by **grepping for identifier names** — including a check satisfied by adding an English assertion string to a file | S1 | `VERIFIED-SOURCE` | `scripts/validators/rls-force-coverage-validator.mjs:25-31` | `05`, `13`, `14` §P3-7 | Add the literal string to an empty file; observe the validator pass | — | impl | GOV |
| `ARCH-RESEARCH-136` | Root `AGENTS.md` MIG-R2 is **stale and wrong on all three of its claims** (max migration 161→ actually 197; a duplicate prefix 129 that does not exist; a validator that does not exist). First-hand: 126 files, `000` + `073…197` contiguous, **zero duplicates**, `000_baseline.sql` a PostgreSQL 17.6 `pg_dump` squash of 001–072 | S1 | `VERIFIED-SOURCE` | `evidence/01-migrations-and-rollback-pairing.txt`; `AGENTS.md` MIG-R2 | `05`, `14` §P3-2 | Re-derive the prefix list; compare to MIG-R2 | — | impl | GOV |
| `ARCH-RESEARCH-137` | The entire `tools/` tree (**46,164 lines**, two HTTP servers, a docker-compose declaring Qdrant + ClickHouse exposing ports) is outside **every** governance perimeter — not in `pnpm-workspace.yaml`, not in `turbo.json`, not in `activeRootPrefixes`, so the supply-chain, undeclared-import, provider-isolation and secret-topology validators and the frozen lockfile do not cover it | S2 | `VERIFIED-SOURCE` | `pnpm-workspace.yaml:1-42`; `scripts/validators/governance-common.mjs:163-170`; `tools/central-intelligence/docker-compose.yml:13-40` | `05`, `15` | Add a malicious dependency under `tools/`; assert the gate catches it | — | ARB | GOV |
| `ARCH-RESEARCH-138` | LCIS/intelligence packages are **59% of the `packages/` TypeScript footprint** (19 packages, 542 files, 119,107 lines vs 21 commerce packages, 228 files, 81,100 lines) and sit on the commerce CI critical path — a full-repo `turbo typecheck` runs in the merge-safety gate, though **no app or service imports any of them** | S2 | `VERIFIED-SOURCE` | `pnpm-workspace.yaml:21-39`; `package.json:16,:123,:124`; `.github/workflows/ci.yml:156` | `05`, `11` | Measure gate wall-clock with and without the LCIS filter | Merge-gate wall-clock > 20 min | ARB | GOV |
| `ARCH-RESEARCH-139` | `apps/theme-marketplace` has **no row** in DOC 03, DOC 04's 83-row register, or `AGENTS.md` — an app root with no constitutional fate | S2 | `VERIFIED-SOURCE` | `apps/theme-marketplace/`; DOC 03 / DOC 04 registers | `05`, `15` | — | — | ARB | GOV |
| `ARCH-RESEARCH-140` | Constitution DOC 01/03/04/05/07 still assert the **30-commit deploy lag and un-deployed S0 fixes in the present tense**, while `AGENTS.md` Appendix B says DOC 01/DOC 03 do not exist. First-hand: `main…stepup/main` is **0 0** — the lag is resolved | S2 | `VERIFIED-SOURCE` | `evidence/00-preflight.txt` (`git rev-list --left-right --count` = `0 0`); DOC 01/03/04/05/07; `AGENTS.md` App. B | `05`, `15` | Re-run the count | — | ARB | GOV |
| `ARCH-RESEARCH-141` | Two of the 110 "validators" are **one-line aliases**; one is designated critical | S2 | `VERIFIED-SOURCE` | `scripts/validate-governance.mjs:71-186`; the two alias files | `05` | Count distinct assertions per validator | — | impl | GOV |
| `ARCH-RESEARCH-142` | ANTI-R3 survivor: the gate **mandates a "replay determinism" proof for a constitutionally forbidden capability**, and that proof is a pure function compared to itself | S2 | `VERIFIED-SOURCE` | `scripts/validators/test-coverage-governance-validator.mjs:9-35`; `tests/replay/replay-determinism.test.mjs:4-58,:67` | `05`, `15` | Delete the capability; observe the gate fail | — | ARB | GOV |
| `ARCH-RESEARCH-143` | Branch-alignment enforcement **degrades to a no-op outside the production branch** | S2 | `VERIFIED-SOURCE` | `scripts/validators/branch-lag-guard-validator.mjs:57-90` | `05` | Run the gate from a feature branch with a known lag | — | impl | GOV |
| `ARCH-RESEARCH-144` | `packages/dart/api_client` is load-bearing for the canonical mobile app but is **absent from `workspacePackageRoots`** | S3 | `VERIFIED-SOURCE` | `scripts/validators/governance-common.mjs` (`workspacePackageRoots`); `apps/mobile/merchant-app` imports | `05` | Break the Dart package; observe whether any validator notices | — | impl | GOV |
| `ARCH-RESEARCH-145` | `CLAUDE.md` states a **107-validator gate**; the gate lane declares **110** | S3 | `VERIFIED-SOURCE` | `scripts/validate-governance.mjs:70-182`; `CLAUDE.md:76,:92` | `05` | `array.length` vs the documented number | — | impl | GOV |

### 3.13 Theme

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-146` | **Liquid is the effective production renderer** for urban-kicks-derived stores, contradicting ART-17's "default OFF / canary" position | S2 | `VERIFIED-SOURCE` | `apps/storefront-runtime` render selection by theme lineage (`03` §storefront) | `05`, `15` | Render a lineage store; log which renderer executed | — | ARB | STORE |
| `ARCH-RESEARCH-147` | Liquid render runs **jsdom + DOMPurify per section per request** on the Vercel Node function, with a 5 s wall-clock render limit and **no render cache** | S2 | `VERIFIED-SOURCE` | `packages/theme-engine` sanitizer path; `03` §storefront | `07`, `09` | Measure render CPU/wall time per section at 128 MB | Render p95 > 1 s | impl | STORE |
| `ARCH-RESEARCH-148` | The storefront compose fork is still the live compose path (LEG-046 / R-15 one-renderer) | S2 | `VERIFIED-SOURCE` | `05` §drift | `05`, `15` | Zero-importer proof on the fork | — | impl | STORE |
| `ARCH-RESEARCH-149` | Dual theme draft systems persist (LEG-047) | S2 | `VERIFIED-SOURCE` | `05` §drift | `05` | Zero-writer proof on the loser | — | impl | STORE |
| `ARCH-RESEARCH-150` | **339 app-local `--lb-*` token redefinitions are baselined as passing** — ART-20's one-token-source is not achieved for web CSS | S2 | `VERIFIED-SOURCE` | design-system ratchet baseline; `05` §drift | `05` | Ratchet the baseline to 0; count failures | — | impl | DS |
| `ARCH-RESEARCH-151` | The only benchmark measures a **single-process in-memory render at concurrency 1**, and its assertion was recently loosened (commit `bf599a3e`) | S2 | `VERIFIED-TEST` | `tests/performance/` benchmark; `git log` `bf599a3e` | `13` | Re-run at realistic concurrency on the real runtime | — | impl | QA |
| `ARCH-RESEARCH-152` | `FEATURE_LIQUID` is configured in all three environments but **read by no runtime code** | S3 | `VERIFIED-SOURCE` | `services/api-gateway/wrangler.toml:41,:133,:248`; no consumer | `04`, `05` | Flip the flag; observe no behaviour change | — | impl | STORE |

### 3.14 Security

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-153` | `auth_password_set_intents` carries a **`PERMISSIVE, FOR ALL, TO PUBLIC, USING(true) WITH CHECK(true)`** policy (no `FOR`, no `TO`) on a table with RLS enabled and **no `REVOKE` anywhere**; migration 163's REVOKE list covers 11 other tables. Verified first-hand: `078` is the **only** migration mentioning the table, so nothing later drops it. **Severity turns on one unknown** — whether `anon` holds `INSERT`; `000_baseline.sql` is a `--no-privileges` dump, so the repository cannot say | S1 | `VERIFIED-SOURCE` (policy) + `UNKNOWN` (grant) | `078_password_set_intents.sql:41,:52-55` (read directly); `163_d2_live_data_leak_rls.sql:202-215` | `08`, `14` §P0-3, `17` | `\dp public.auth_password_set_intents` — **one line of SQL decides S1 vs S0** | — (unconditional) | impl | IDENT |
| `ARCH-RESEARCH-154` | **13 unintended PUBLIC-effective true-predicate policies** survive replay (of 19 carrying no `TO` clause out of 110 `USING(true)` policies among 680; **6 of the 19 are deliberate** SELECT-only global catalogs and must not be "fixed"). Worst: `pages` (cross-tenant defacement / stored XSS), `collections`/`collection_products`, `gift_cards` (money), `onboarding_attempts` (PII), `audit_logs` (INSERT-only → audit forgery), `ai_usage` (a sibling policy also exposes SELECT). Preconditions: the non-expiring `anon` JWT plus network reach to PostgREST | S1 | `VERIFIED-SOURCE` | `000_baseline.sql:26708, :26652, :26645, :26666, :26694, :26743, :24380, :24127`; `100_app_discovery_foundation.sql:133,:145,:152,:155`; `14` §P0-5 per-table table | `08`, `14` §P0-5 | Query each table with an `anon` key; assert zero rows and rejected writes | — (unconditional) | ARB | DATA |
| `ARCH-RESEARCH-155` | `next.config` declares `Cache-Control: public, max-age=300, stale-while-revalidate=3600` for **all** storefront paths with **no `Vary: Cookie`**, while responses vary on the theme-preview cookie and the Liquid path server-renders authenticated customer data. Next does **not** override a config-set header. If any shared cache honours it, a merchant's draft theme — or another buyer's rendered data — can be served publicly | S1 | `VERIFIED-CONFIG` | `apps/storefront-runtime/next.config.ts:124-126`; `store/[subdomain]/layout.tsx:76`; `node_modules/next/dist/server/send-payload.js:58-62` | `08`, `07` §3.3 | Set a preview cookie, request, then request anonymously from a different client; compare bodies | Any shared-cache HIT on an authenticated storefront response | ARB | STORE |
| `ARCH-RESEARCH-156` | Internal service-to-service authentication **fails OPEN by default** on a secret shared across ten-plus runtimes | S1 | `VERIFIED-SOURCE` | internal-auth middleware default branch (`05` §drift) | `05`, `08` | Call an internal route with no header; assert 401 | — | impl | IDENT |
| `ARCH-RESEARCH-157` | One symmetric `AUTH_SECRET` is deployed to **six distinct trust domains** (the gateway Worker + all five Next apps, including marketing-site) and is the HS256 key for the `lb_accounts` cookie, whose membership check is **guard 2 of 2** on `/switch` — guard 1 being merely "hold any valid session". Corrected from S1: four of the five named forgery consequences are refuted (the webhook fallback is unreachable dead code; production sets `CHECKOUT_SIGNING_SECRET`), but **in staging the checkout-handoff HMAC key and the cookie key are literally the same value** | S2 | `VERIFIED-CONFIG` | `.github/workflows/production-deploy.yml:315,:443`; `apps/identity-platform/src/lib/auth/cookies.ts:13,:176-180`; `switch/route.ts:56-63,:69-81`; `staging-deploy.yml:77-100` | `05`, `08` | Forge `lb_accounts` with a known secret; attempt `/switch` to another account | — | impl | IDENT |
| `ARCH-RESEARCH-158` | Non-production checkout-handoff signing falls back to a **hardcoded secret literal**, and the production fallback chain reaches `AUTH_SECRET` | S2 | `VERIFIED-SOURCE` | `services/api-gateway/src/routes/checkout.ts:88`; `routes/storefront/cart-routes.ts:307`; `routes/media.ts:60`; `routes/export.ts:174` | `05`, `08` | Mint a handoff on staging with the literal; assert rejection | — | impl | PAY |
| `ARCH-RESEARCH-159` | † The step-up token is **never consumed** — the same HMAC token authorizes unlimited refunds inside its 10-minute window | S2 | `VERIFIED-SOURCE` | step-up verification path (`03` §commerce) | `08` | Issue one step-up token; execute two refunds | — | impl | PAY |
| `ARCH-RESEARCH-160` | Outbound webhook target validation is `url.protocol === 'https:' && url.hostname.length > 0` **and nothing else** — no DNS resolution, no allowlist, no private-range check (SEC-R11) — applied identically at registration, fanout eligibility and dispatch. Corrected from S1: the response body is never readable by the merchant (no route selects it) and a Cloudflare Worker has no IMDS and does not route to RFC1918 | S2 | `VERIFIED-SOURCE` | `packages/notification-core/src/index.ts:505-512`; `routes/notifications.ts:470,:512`; `execution/outbox-execution.adapter.ts:177`; `services/webhook-service/src/app-lifecycle-dispatch.ts:34-41,:75` | `08`, `14` §P2-5 | Register a private-range target; assert registration is rejected | — | ARB | ASYNC |
| `ARCH-RESEARCH-161` | Inbound provider webhooks have **no timestamp/replay window**; `replay_window_seconds` is declared but never read | S2 | `VERIFIED-SOURCE` | webhook ingestion path; config field with no reader | `08` | Replay a valid signed webhook after 24 h; assert rejection | — | ARB | PAY |
| `ARCH-RESEARCH-162` | The JTI replay cache is a **per-isolate in-memory `Map`**, not a durable store, and the merchant JWT's own `jti` is never recorded | S2 | `VERIFIED-SOURCE` | JTI cache implementation (`03` §identity) | `08` | Replay a token against a different isolate | — | impl | IDENT |
| `ARCH-RESEARCH-163` | `lb_accounts` is a **signed — not encrypted — JWT carrying merchant PII** that doubles as an authorization credential | S2 | `VERIFIED-SOURCE` | `apps/identity-platform/src/lib/auth/cookies.ts:176-180` | `08` | Base64-decode the cookie; enumerate the PII fields | — | impl | IDENT |
| `ARCH-RESEARCH-164` | CSRF is a **JS-readable double-submit cookie**, and a legacy cookie name is still accepted | S3 | `VERIFIED-SOURCE` | CSRF middleware (`03` §identity) | `08` | Read the cookie from JS; forge the header | — | impl | IDENT |
| `ARCH-RESEARCH-165` | A **hard-coded developer identity** is granted a full auth context whenever `SUPABASE_URL` contains `'localhost'` | S3 | `VERIFIED-SOURCE` | dev-identity branch (`03` §identity) | `08` | Set the URL to a hostile host containing `localhost`; observe the grant | — | impl | IDENT |

### 3.15 Test and assurance

| ID | Finding | Sev | State | Evidence (`path:line`) | Analysed in | Falsifying test (→`13`) | Trigger (→`12`) | Auth | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `ARCH-RESEARCH-166` | The 110-validator gate lane is a **static-analysis suite**: 0 of 110 make an HTTP request, boot a Worker or Next app, or connect to PostgreSQL; exactly 2 spawn a subprocess and 1 recomputes checksums. Corrected from S1 → **S3**: behavioural verification exists in the *same* CI pipeline, outside the gate lane | S3 | `VERIFIED-SOURCE` | `scripts/validate-governance.mjs:71-186`; `mobile-token-validator.mjs:3-8`; `branch-lag-guard-validator.mjs:57-90`; `manifest-lineage-validator.mjs:24-28,:52` | `03` §tests, `14` §P3-7 | Add one behavioural validator; measure what it catches that the 110 do not | — | ARB | QA |
| `ARCH-RESEARCH-167` | The 21 mandated "enterprise test proof files" are **existence-checked only and import zero production modules**; three are self-referential tautologies (a pure function compared to itself). Corrected from S1: only 8 are pure validator wrappers, 2 execute shipped scripts, 6 bind to shipped source text, and a sibling contract lane does import real modules | S2 | `VERIFIED-SOURCE` | `scripts/validators/test-coverage-governance-validator.mjs:9-35,:38-40`; `tests/replay/replay-determinism.test.mjs:4-58`; `tests/queues/queue-recovery.test.mjs:4-35`; `tests/feature-flags/feature-flag-governance.test.mjs:5-18` | `03` §tests, `13` | Import the shipped `eventRetryDelaySeconds` and assert against **it**, not a local copy | — | impl | QA |
| `ARCH-RESEARCH-168` | TEST-R10's **"replay 000→197" clause is unimplemented** — no CI job or local script replays migration history; the ephemeral Postgres harness applies **zero** migrations and hand-builds fixtures. One suite applies 139, 119, 142, 151, 160 **out of numeric order**, which is definitionally not a replay. Understated by the original: the fixture schemas **materially diverge** from the real schema | S2 | `VERIFIED-SOURCE` | `scripts/governance/foundation-ephemeral-postgres.mjs:55-73`; `tests/executable/money-ledger-postgres.test.mjs:78-122,:94-100` vs `000_baseline.sql:11961-11981`; `tests/executable/foundation-wave1-money-postgres.test.mjs:12-18` | `03` §tests, `14` §P3-7 | Replay `000…197` into a clean database in CI | — | impl | DATA |
| `ARCH-RESEARCH-169` | Approximately **38% of the 582 test files are source-greps** that never load the code under test; the test corpus is predominantly source-text assertion | S1 | `VERIFIED-SOURCE` | `03` §tests (counted over `tests/**`) | `03`, `13` | Recount after converting the money and tenancy suites | — | ARB | QA |
| `ARCH-RESEARCH-170` | **No load or performance testing exists.** `tests/performance/` is 10 source-grep files — including one that greps the cache implementation for the string `cache.match(request)` | S1 | `VERIFIED-SOURCE` | `tests/performance/storefront-cache.test.mjs:12-16,:18-35`; `tests/performance/partition-retention.test.mjs:118-122` | `07`, `13` | Execute the `13` programme against an isolated staging estate | — (blocks every `INFERRED` number in `07`) | ARB | QA |
| `ARCH-RESEARCH-171` | The ART-06 `/switch` fix is present and correctly ordered but has **no behavioural test** — coverage is `readFileSync` + `indexOf` over source text, and the file's own doc-comment concedes the route-contract test is unwritten. **Both** nominal governance controls for that path (`identity-security-gate.mjs`, `frozen-path-override-gate.mjs`) are **dead code** — zero references, no `.husky/`. Corrected from S1: a coarse revert *does* fail the existing test in CI; only a logic-preserving-text subversion escapes | S2 | `VERIFIED-SOURCE` | `apps/identity-platform/src/app/api/auth/switch/route.ts:35-110`; `src/__tests__/auth-switch-guard.test.ts:20-22,:24-67`; `scripts/governance/identity-security-gate.mjs:10`; `scripts/validators/frozen-path-override-gate.mjs:16` | `03` §tests, `08` | Write the 401/403/200 route-contract test | — | impl | QA |
| `ARCH-RESEARCH-172` | `ci-simulation-validator` certifies that CI runs tests by **substring-matching workflow YAML** | S2 | `VERIFIED-SOURCE` | `scripts/validators/ci-simulation-validator.mjs` | `03` §tests | Rename a job; observe the validator still pass | — | impl | QA |
| `ARCH-RESEARCH-173` | `validate:observability` is a **file-existence check**, so the green gate proves only that YAML and JSON files are on disk | S2 | `VERIFIED-SOURCE` | `scripts/validators/` observability validator; `infrastructure/observability/` | `09` | Empty the files' contents; observe the gate still pass | — | impl | SRE |
| `ARCH-RESEARCH-174` | Governance test files import across root boundaries by **deep relative path**, bypassing package public exports (ARCH-R15) | S3 | `VERIFIED-SOURCE` | three test files using `../../..` reaches (`03` §topology) | `05` | Assert no test imports across roots by relative path | — | impl | QA |
| `ARCH-RESEARCH-175` | **REFUTED by this document's own reading.** The digest claims "the RT-1…RT-9 tenant red-team suite — the only behavioural RLS proof — is not executed by any CI workflow". It **is**: `package.json:120` `test:behavioral` runs `node --test tests/*/*.test.mjs`, which matches `tests/executable/tenant-redteam-postgres.test.mjs`, and **two unconditional CI jobs** invoke it (`ci.yml:121` in *Unit tests*, `ci.yml:164` in *Merge safety gate*). The real, narrower gap is the synthetic fixture schema — recorded at `ARCH-RESEARCH-046` | INFO | `VERIFIED-CONFIG` | `package.json:120`; `.github/workflows/ci.yml:100-127, :129-170`; `tests/executable/tenant-redteam-postgres.test.mjs:25-38` (all read directly) | this document; `03` §tests | Remove the suite; assert CI fails | — | — | QA |
| `ARCH-RESEARCH-176` | The theme tenant-isolation suite — a **genuine `docker exec … psql` behavioural RLS test** with paired positive controls, and the only suite covering migration 196's theme RLS hardening — is **collected by CI and then silently skips**, because it defaults to the local Supabase CLI container name while CI starts the ephemeral one. A behavioural proof that never runs is indistinguishable from one that does not exist | S2 | `VERIFIED-SOURCE` | `tests/security/theme-tenant-isolation.test.mjs:31, :204-210, :54-58, :213-217, :225` vs `scripts/governance/foundation-ephemeral-postgres.mjs:5` | `13` §A.4.1 | Align the container variable; run `test:behavioral`; assert the suite executes rather than skips | — | impl | QA |
| `ARCH-RESEARCH-177` | The production-gating E2E suite **skips instead of failing** when the environment is unreachable. Only `release-gates.spec.ts` honours `LETBUYY_E2E_REQUIRE_REAL_STACK`; the two journey specs and the homepage smoke call bare `test.skip` — so a **broken merchant signup form is a skip, not a failure**, and the only end-to-end checkout journey skips when staging 5xx's. A gate that passes when the system under test is down is not a gate | S2 | `VERIFIED-SOURCE` | `tests/e2e/customer-journey.spec.ts:6-9, :53, :73`; `merchant-journey.spec.ts:9-12, :57-59, :64, :72, :95, :100`; `smoke/homepage.spec.ts:8-11`; `.github/workflows/production-deploy.yml:204` | `13` §A.4.2 | Make every spec honour the require-real-stack flag; run the gate against a downed staging; assert failure | — | impl | QA |

---

## 4. Cross-references

### 4.1 Capacity findings `C-1…C-11` → register IDs

Every capacity finding from `07_CAPACITY_MODEL.md` is present. Four are the same defect the discovery pass found independently and are merged into that row rather than duplicated.

| `07` | Subject | Register ID | Merged with a discovery finding? |
|---|---|---|---|
| C-1 | KV rate limiter, 1 write/s/key → isolate-wide 503 | `ARCH-RESEARCH-068` | Yes — digest `cache`/`deploy` + `evidence/03` |
| C-2 | Storefront cache hit ratio ≈ 0 (three causes) | `ARCH-RESEARCH-069`, `070`, `071` | Yes — split into its three independently falsifiable causes |
| C-3 | Vertical ladder is not a connection ladder | `ARCH-RESEARCH-026` | No — new, from vendor primary sources |
| C-4 | Latency → connection exhaustion (Little's Law) | `ARCH-RESEARCH-027` | No |
| C-5 | Transaction-mode pooling forbids advisory locks; `SET LOCAL` must use `TRUE` | `ARCH-RESEARCH-028` | No |
| C-6 | Hyperdrive cache does not invalidate on write | `ARCH-RESEARCH-029` | No |
| C-7 | Telemetry writes 1–2 Postgres rows per request | `ARCH-RESEARCH-108` | Yes — digest `observability` |
| C-8 | Outbox relay 4,800 events/day | `ARCH-RESEARCH-079` | Yes — digest `async` |
| C-9 | Vercel burst governor 1,000/10 s/region | `ARCH-RESEARCH-105` | No |
| C-10 | Vercel domain provisioning 100/hour | `ARCH-RESEARCH-127` | No |
| C-11 | Band C needs read replicas **and** partitioning | `ARCH-RESEARCH-014` | No |

### 4.2 First-hand evidence files → register IDs

| Evidence file | Register IDs |
|---|---|
| `evidence/01-migrations-and-rollback-pairing.txt` | `ARCH-RESEARCH-018` (78/126 unpaired, 9 new regressions), `136` (MIG-R2 refuted on all three claims) |
| `evidence/03-rate-limiter-backend.txt` | `ARCH-RESEARCH-068` (non-atomic RMW, per-PoP limits, write-per-request), `076`, `126` |
| `evidence/04-d1-durable-object-second-authority.txt` | `ARCH-RESEARCH-005` (**refutation**: not a second data authority), `004` (declared-but-unused), `131` (validator enforces the dead infrastructure) |
| `evidence/00-preflight.txt` | `ARCH-RESEARCH-140` (branch lag is `0 0` — resolved, contradicting five governance documents) |

### 4.3 `14_FOUNDATION_ACTION_REGISTER.md` action IDs → register IDs

| Action | Register IDs |
|---|---|
| P0-1 close the checkout-confirm free-goods path | `047` |
| P0-2 bind public order-create to the server cart | `062` |
| P0-3 re-scope `auth_password_set_intents` | `153` |
| P0-4 wire `app_tenant` / tenant-GUC | `039`, `028`, `030` |
| P0-5 re-scope the 13 unintended PUBLIC policies | `154`, `133` |
| P1-1 replace the KV rate-limit backend | `068`, `076`, `126` |
| P1-2 restore storefront caching | `069`, `070`, `071`, `072`, `073`, `077` |
| P1-3 move telemetry off PostgreSQL | `108`, `022`, `016` |
| P1-4 raise outbox relay throughput | `079` |
| P2-1 give incident paging a delivery channel | `107`, `023`, `110` |
| P2-2 alert on ledger reconciliation mismatches | `058`, `057` |
| P2-3 per-tenant fairness caps | `044` |
| P2-4 hot-SKU admission control | `123`, `028` |
| P2-5 SSRF guard on webhook targets | `160` |
| P2-6 idempotent email dispatch | `083`, `084` |
| P3-1 rollbacks for the 12 unpaired migrations ≥ 138 | `018` |
| P3-2 correct `AGENTS.md` MIG-R2 | `136` |
| P3-3 classify `services/lcis-api` | `001`, `129`, `138` |
| P3-4 reserve the `checkout` subdomain | `040`, `041`, `067` |
| P3-5 resolve the partition-maintenance ambiguity | `016`, `017`, `130` |
| P3-6 retire validators protecting dead infrastructure | `131`, `132`, `134`, `141`, `142` |
| P3-7 build the behavioural coverage the gate lacks | `166`, `167`, `168`, `169`, `170`, `092` |

### 4.4 `12_TRIGGER_BASED_EVOLUTION.md` levers → register IDs

`12` owns the thresholds. This table maps its lever numbering onto the register so a fired trigger resolves to evidence.

| Lever (`12`) | Tier | Register IDs |
|---|---|---|
| 0 — instrument before you escalate | prerequisite | `077`, `107`, `110`, `112`, `023`, `076`, `079` (backlog age), `100` |
| 1 — replace the KV rate-limit backend | Class-C | `068`, `076`, `126`, `116` |
| 2 — restore storefront HTML + fetch caching | Class-C | `069`, `070`, `072`, `073`, `074`, `105` |
| 3 — telemetry off PostgreSQL to Analytics Engine | Class-C | `108`, `022`, `016`, `112` |
| 4 — raise outbox relay throughput | Class-C | `079`, `080` |
| 5 — request coalescing / serve-stale | Class-C | `071`, `075` |
| 6 — hot-SKU admission control / sharded counters | Class-C | `123`, `019`, `028` |
| 7 — per-tenant fairness caps | Class-C | `044`, `045`, `086` |
| 8 — query and index optimisation | Class-C | `122`, `124`, `125`, `088`, `089` |
| 9 — pooling and transaction-duration discipline | Class-C | `027`, `030`, `123` |
| 10 — larger Supabase compute tier | Class-C | `026`, `027` |
| 11 — dedicated rate-limit backend (Upstash) | Class-C | `068`, `095` |
| 12 — queue split by workload class | Class-C | `044`, `081`, `082` |
| 13 — read replica | **AMEND** | `014`, `026` |
| 14 — table partitioning | **AMEND** | `014`, `016`, `017`, `130` |
| 15/16/17 — search · media · module extraction | ARB | — (no defect rows; growth levers) |
| 18/19/20 — second region · sharding · provider migration | **AMEND** | `014` |

> **`12` §3 and this register agree on the blocking fact**: every `CURRENT VALUE` in the lever ladder is `UNKNOWN` because no metric pipeline exists. `ARCH-RESEARCH-110` and `077` are the two rows that gate the entire ladder.

### 4.5 Constitutional invariants (`02` §4) → register IDs

| Invariant | Register IDs |
|---|---|
| `R-1` / `R-2` RLS FORCE + tenant GUC; no blanket `service_role` | `039`, `020`, `042`, `133`, `134`, `153`, `154` |
| `R-8` `bigint` paise on every path | `050`, `051` |
| `R-11` server-authoritative orders | `047`, `062`, `064`, `065` |
| `R-14` sole asymmetric issuer, no shared symmetric secret | `031`, `033`, `038`, `157` |
| `R-15` exactly one canonical system per domain | `038`, `054`, `148`, `149`, `012` |
| `R-16` same-transaction outbox, no event bus | `078`, `085` |
| `R-22` truthful provider-mode honesty badge | `090`, `101`, `118` |
| `R-23` paired rollback per migration | `018`, `136` |
| `ART-08` the decisive tenancy change | `039` |
| `ART-14` cart-bound signed handoff | `062`, `064`, `067` |
| `ART-17` Liquid default OFF / canary | `146`, `151` |
| `ART-22` frozen apps not deployed | `093`, `015` |
| `ART-23` partition mirror disabled | `016`, `017`, `130` |
| `ART-24` ops-console fold-then-delete | `012` |
| `ANTI-R3` gate must not enforce rejected capabilities | `130`, `131`, `142` |

---

## 5. Coverage statistics

**Register size: 177 rows** (`ARCH-RESEARCH-001` … `ARCH-RESEARCH-177`), consolidated from **217 discovery findings + 11 capacity findings (`07` C-1…C-11) + 4 first-hand evidence files + 2 findings established by `13` §A.4**. The reduction from 217 is duplicate-merging and the exclusion of 22 non-defect conformance findings, not omission — §6 maps both.

### 5.1 By severity (post-adversarial-correction)

| Severity | Count | Share |
|---|---|---|
| **S0** | **2** | 1.1% |
| **S1** | 44 | 24.9% |
| **S2** (incl. 1 row recorded as an unreconciled `S2 / S1` split) | 97 | 54.8% |
| **S3** | 24 | 13.6% |
| **INFO** (refutations) | 3 | 1.7% |
| **no defect severity** (capacity-model / vendor-limit findings) | 7 | 4.0% |
| **Total** | **177** | 100% |

Against the discovery pass's own distribution (`217` findings: **11 S0 · 72 S1 · 91 S2 · 21 S3 · 22 INFO**):

| | Discovery | This register | Movement |
|---|---|---|---|
| S0 | 11 | **2** | −82% |
| S1 | 72 | 44 | −39% (also absorbs merged duplicates) |

> The two surviving `S0` rows are `ARCH-RESEARCH-047` (checkout confirm accepts an unverified `provider_payment_id`) and `ARCH-RESEARCH-039` (tenant-GUC runtime-dead). **Eleven findings entered rated S0; two survive at S0.** That ratio is the single best argument for keeping an adversarial stage in any future audit — and the strongest reason to treat the 131 rows that were never challenged (§5.6) with the same suspicion.

### 5.2 By domain

| Domain | IDs | Count | S0 | S1 | S2 | S3 | INFO | no sev |
|---|---|---|---|---|---|---|---|---|
| topology | 001–015 | 15 | 0 | 4 | 7 | 1 | 2 | 1 |
| data | 016–030 | 15 | 0 | 7 | 3 | 1 | 0 | 4 |
| identity | 031–038 | 8 | 0 | 2 | 5 | 1 | 0 | 0 |
| tenancy | 039–046 | 8 | **1** | 0 | 6 | 1 | 0 | 0 |
| money | 047–061 | 15 | **1** | 7 | 3 | 4 | 0 | 0 |
| checkout | 062–067 | 6 | 0 | 3 | 2 | 1 | 0 | 0 |
| cache | 068–077 | 10 | 0 | 2 | 7 | 1 | 0 | 0 |
| queue/async | 078–092 | 15 | 0 | 4 | 10 | 1 | 0 | 0 |
| deploy | 093–106 | 14 | 0 | 2 | 9 | 2 | 0 | 1 |
| observability | 107–120 | 14 | 0 | 2 | 9 | 3 | 0 | 0 |
| cost | 121–127 | 7 | 0 | 0 | 5 | 1 | 0 | 1 |
| governance | 128–145 | 18 | 0 | 5 | 11 | 2 | 0 | 0 |
| theme | 146–152 | 7 | 0 | 0 | 6 | 1 | 0 | 0 |
| security | 153–165 | 13 | 0 | 4 | 7 | 2 | 0 | 0 |
| test | 166–177 | 12 | 0 | 2 | 7 | 2 | 1 | 0 |
| **Total** | | **177** | **2** | **44** | **97** | **24** | **3** | **7** |

> **Governance is the largest single domain (18 rows), and 12 of those 18 are defects in the gate itself** (`128`–`135`, `141`–`143`, `145`) — validators that are dead code during a real run, that enforce constitutionally rejected capabilities, that certify behaviour by grepping for identifier names, or that leave an entire root class structurally invisible. Add `133`, `135`, `166`, `167`, `172`, `173` and the pattern is unmistakable: **the most-cited root cause in this register is not a runtime bug. It is that the mechanism built to prevent runtime bugs does not execute anything.**

### 5.3 By evidence state

Compound rows (e.g. `068` = `VERIFIED-SOURCE` for the code defect + `INFERRED` for the capacity consequence; `153` = `VERIFIED-SOURCE` for the policy + `UNKNOWN` for the grant) are counted under their **weaker** component.

| State | Count | Share | Note |
|---|---|---|---|
| `VERIFIED-SOURCE` | 136 | 76.8% | The code says this. **Not that it runs, is reachable, or is deployed.** |
| `VERIFIED-CONFIG` | 26 | 14.7% | Config declares it. **Not that it is applied to a live resource.** |
| `INFERRED` | 8 | 4.5% | Deterministic arithmetic over primary-source vendor limits and counted implementation costs |
| `VERIFIED-TEST` | 3 | 1.7% | `015`, `046`, `151` — a behavioural test was read and its assertions genuinely exercise the behaviour |
| `HUMAN-REQUIRED` | 3 | 1.7% | `024`, `059`, `127` |
| `UNKNOWN` | 1 | 0.6% | `153` — the `anon` grant that decides whether it is S1 or S0 |
| **`VERIFIED-LIVE`** | **0** | **0%** | **No live provider or database access existed. Nothing here establishes what production is running.** |
| `GOVERNED` / `REFERENCE-ONLY` / `HISTORICAL` | 0 | 0% | Carried in `02` and `05`, not in this register |

> **Three rows out of 177 reach `VERIFIED-TEST`** — and `13` §A.4.1 shows that even one of the repository's genuine behavioural suites silently skips in CI (`ARCH-RESEARCH-176`). 162 of 177 (**91.5%**) are source or configuration reading: steps 1–8 of the `01` §1.2 verification ladder, never steps 9–13. That is an accurate description of what a read-only audit can produce, and it is exactly why `ARCH-RESEARCH-170` (no load or performance testing exists anywhere) is the finding that gates the credibility of every other number in this packet.

### 5.4 By deciding authority

| Authority | Count | Share | What it means |
|---|---|---|---|
| **implementation** | 116 | 65.5% | **No approval required.** A team can fix these today inside canonical systems. |
| **ARB-review** | 44 | 24.9% | Needs a recorded architecture decision |
| **provider-action** | 11 | 6.2% | `024`, `059`, `068`, `076`, `095`, `101`, `102`, `118`, `120`, `126`, `127` — needs a provider credential, a drill, or a commercial conversation |
| **constitutional-amendment** | 3 | 1.7% | `014` (read replicas + partitioning at Band C), `016` (the live partition mirror, ART-23), `026` (the 500-connection plateau, *at the plateau only*) |
| **legal-review** | 0 | 0% | Carried in `08_SECURITY_PRIVACY_COMPLIANCE.md`, not here |
| — (refutations) | 3 | 1.7% | `005`, `015`, `175` |

> **Two thirds of the register is implementation work that needs nobody's permission.** `047` — the one live-money S0 — is in that two thirds. `039` needs ARB only because `CLAUDE.md` requires ARB sign-off for RLS changes on tenant tables, not because the Constitution forbids the fix; the Constitution *demands* it (`R-1`, `R-2`, `ART-08`).
>
> **No row in this register requires a constitutional amendment before the platform can serve its own governed envelope.** All three amendment-class items sit beyond Band A — two orders of magnitude past current need (`ARCH-RESEARCH-014`).

### 5.5 Findings with NO falsifying test — *a finding about this packet*

| Category | Count | Share |
|---|---|---|
| Rows carrying a concrete falsifying measurement | **172** | 97.2% |
| **Rows with no falsifying test at all** | **5** | 2.8% |

The five, and why:

| ID | Finding | Why no test exists |
|---|---|---|
| `012` | ART-24 ops-console fold-then-delete is open | **Governance state.** A required ARB signature is absent. Nothing to measure — a decision to record. |
| `033` | Postgres mints session bearer tokens on rotation | **Latent capability.** Dangerous only once `ARCH-RESEARCH-032` is enabled. Its "test" would be a lint asserting zero callers, not a measurement. |
| `056` | Residual `razorpayx` CHECK-constraint enum values | Same class — a dead enum value on a frozen table. |
| `106` | `BRANCH_STRATEGY.md` asserts a lag that is resolved | **Document correctness.** `evidence/00-preflight.txt` already settles the fact (`0 0`); only the prose is wrong. |
| `139` | `apps/theme-marketplace` has no constitutional fate | **Absence of a governance record.** No measurement can produce a decision that was never made. |

**The sharper limit is not the falsifying test — it is the trigger.**

| | Count | Share |
|---|---|---|
| Rows with a **measured trigger** (a metric and a threshold at which the finding becomes actionable) | 45 | 25.4% |
| Rows with **no trigger** — unconditional, or not load-dependent | 132 | 74.6% |
| …of which explicitly marked **`— (unconditional)`** (fix regardless of load) | 10 | 5.6% |

> **Only a quarter of this register is trigger-driven.** That is the correct shape for a foundation audit — a correctness defect does not become wrong at 10,000 merchants; it is wrong at one — but it means `12_TRIGGER_BASED_EVOLUTION.md` governs a **minority** of these findings, and **no trigger in it can be evaluated today.** `12` §3 reaches the same conclusion independently: every `CURRENT VALUE` in its lever ladder is `UNKNOWN`. The two rows that gate the entire ladder are `ARCH-RESEARCH-110` (the sole SLO measures a hardcoded constant) and `ARCH-RESEARCH-077` (cache hit ratio has no emission point). **`12` is a wish list until the emitters are wired and `13` runs.**

### 5.6 Adversarial coverage of the register

| | Count | Share |
|---|---|---|
| Rows carrying a digest adversarial verdict or a later `14` correction | 35 | 19.8% |
| Rows resting on first-hand command output or a direct source read performed **for this packet** (`018`, `136`, `004`, `005`, `131`, `140`, `175`) | 7 | 4.0% |
| Rows established by `13`'s own source reading, against the digest (`103`, `110`, `176`, `177`) | 4 | 2.3% |
| **Rows never independently contested** | **131** | **74.0%** |
| …of which sourced **only** from the two dimensions no adversary reviewed (`data`, `flow-commerce`) — marked `†` | 16 | 9.0% |

> **Three quarters of this register has been asserted once and never contested.** The adversarial pass corrected **26 of the 32** claims it examined — an **81% correction rate**, and it moved 9 of 11 S0 claims down. Applying that rate naively to the 131 unchallenged rows implies roughly **100 of them are mis-stated in severity, scope, or mechanism.**
>
> That is not a reason to discard them. It is the reason every row above carries a falsifying test instead of an instruction, and the reason §8 rule 2 exists. **The single highest-value follow-up to this packet is not more discovery — it is adversarial verification of the 131.**

---

## 6. Duplicate consolidation map

Where one defect surfaced in multiple dimensions, the row carries every citation. The mapping, so nothing appears lost:

| Register ID | Merged from (digest dimensions) |
|---|---|
| `001` | topology S1 + governance-drift S1 (LCIS root half) |
| `002` | topology S2 + governance-drift S2 (Wasm half) |
| `004` | topology S2 (cost) + data S2 ×2 (D1, DO) + deploy S2 (Worker bindings) |
| `016` | data S1 + deploy S1 + flow-commerce S2 + async S2 + observability S2 + governance-drift S1 |
| `017` | async S2 + governance-drift S1 + deploy S1 (maintenance half) |
| `018` | data/governance S1 + governance-drift S1 |
| `039` | data S0 + flow-identity S1 (CONFIRMED) + flow-commerce S1 + governance-drift S0 (CONFIRMED) |
| `040` | topology/tenancy S1 + flow-commerce S1 (reserved-name half) |
| `043` | data S2 (R2 tenant prefix) + flow-storefront S2 (user-scoped keys + MIME) |
| `050` | data S1 + flow-commerce S1 |
| `068` | data S1 + deploy S1 + observability S1 + `evidence/03` + `07` C-1 |
| `077` | flow-storefront S2 + observability S2 |
| `078` | async S0 + governance-drift S1 |
| `090` | deploy S2 + async S1 |
| `094` | data S2 + deploy S1 |
| `096` | deploy S2 ×2 + governance-drift S2 |
| `024` | observability S2 (DR) + governance-drift S1 (PITR/restore drill) |
| `129` | topology S2 + governance-drift S1 (**severities unreconciled — recorded as a split**) |
| `132` | data/governance S1 + tests S1 |
| `136` | data/governance S1 + governance-drift S2 |
| `138` | topology S2 + governance-drift S1 (LCIS package-weight half) |
| `157` | flow-identity S1 + governance-drift S2 |
| `169` | tests S1 + governance-drift S1 |

**Conformance findings not given rows.** The digest also returned **22 `[INFO]` conformance findings** — the six reserved services and two reserved mobile roots are genuinely manifest-only; all seven ARCH-R7 rejected packages are absent with zero importers; import boundaries ARCH-R11/R12/R13/R14 are clean in production source at both import and dependency level; frozen app **roots** are genuinely de-deployed across every deploy surface. These are recorded in `03_CURRENT_ARCHITECTURE_AS_BUILT.md` and are not defects, so they carry no register ID. **They are the reason `16_FINAL_RECOMMENDATION.md` can say the foundation's *shape* is sound while its *settings* are not.**

---

## 7. Known conflicts inside this packet

A register that silently resolves its own contradictions is lying by omission. These are unresolved at the time of writing.

| # | Conflict | Positions | What this document did |
|---|---|---|---|
| **X-1** | Severity of the tenant-GUC gap (`ARCH-RESEARCH-039`) | The digest's governance-drift adversarial verdict returns **`CONFIRMED S0`** ("S0 is earned … a direct violation of a constitutional MUST-NOT on the entire live data path"). `14_FOUNDATION_ACTION_REGISTER.md` §P0-4 records **S1**, "adversarially corrected from S0 … a missing control, not a self-contained exploit". | **Recorded as S0**, because the mandated primary source (`evidence/11-discovery-digest.md`) carries an explicit `CONFIRMED` verdict at S0 with reasoning I re-verified. `14`'s S1 rests on a defensible different question (exploitability vs violation). **The ARB should settle this before either number is quoted.** |
| **X-2** | Whether the tenant red-team suite runs in CI | The digest's `tests` dimension asserts it is "not executed by any CI workflow" (S1). The digest's own `Gate is 2/110` adversarial verdict says the executable Postgres suites **do** run. | **My own reading wins and refutes the finding** — `package.json:120` + `ci.yml:121` + `ci.yml:164`. Recorded as `ARCH-RESEARCH-175` at `INFO`. The surviving real gap (synthetic fixture schema) is `ARCH-RESEARCH-046`. |
| **X-3** | Whether `FEATURE_LIQUID` matters | `deploy` S3 says the flag is "read by no runtime code" (`152`); `flow-storefront` S2 says Liquid **is** the effective production renderer (`146`). | **Both recorded — they are consistent.** Renderer selection is by theme lineage, not by the flag. The flag is dead; the renderer is live. This is worse than either finding alone, because the documented control does not control anything. |
| **X-4** | Severity of the runtime-root membership gap | `topology` rates it S2; `governance-drift` rates the same mechanism S1. No adversarial verdict on either. | **Recorded as a split (`S2 / S1`)** at `ARCH-RESEARCH-129` rather than silently picking one. |
| **X-5** | Rate-limit backend in production | `wrangler.toml:250-259` + the 2026-08-01 runbook say KV fallback, no Upstash. `production-deploy.yml:76-77,:111-112,:327-328` makes two Upstash secrets release-blocking and pushes them. | **Not a contradiction — a release-integrity gap** (`ARCH-RESEARCH-095`). Both hold if the gated pipeline never completes, which the runbook's own root cause (a plain `wrangler deploy`) implies. **Only an operator with GitHub + Cloudflare access can close it** (`04` §4.4 L-31). |
| **X-6** | Whether any SLO exists, and whether the staging lane has a smoke step | The discovery digest says the active staging lane has "no test or smoke step at all"; the research brief said "no SLOs exist anywhere". `13` §A.4.3 and §A.4.4 refute **both** by direct source reading: `deploy-staging.yml:174-215` **is** a smoke job, and `infrastructure/monitoring/slo-catalog.yaml:1-9` **is** one SLO. | **`13` wins on both.** `ARCH-RESEARCH-103` and `110` were rewritten to the corrected facts. The corrections make the findings **worse, not better** — the smoke job probes a hardcoded literal and passes without credentials, and the sole SLO's SLI is computed from that same literal. A control that exists and measures a constant is more misleading than one that is absent. |
| **X-7** | E2E spec-file count | Digest: "10 spec files". Adversarial pass: "only 2 spec files". `13` §A.4.2: **9** `.spec.ts` files plus one non-spec helper. | **`13` wins.** Recorded at `ARCH-RESEARCH-103`. Both earlier numbers were wrong, which is a small but useful reminder that even the adversary miscounted. |

---

## 8. How to use this register

1. **Do not action a row from this table alone.** Read the sibling document in the *Analysed in* column first. This table is an index, not an argument.
2. **Run the falsifying test before the fix**, wherever one exists — 172 of 177 rows have one. A fix applied to a mis-stated finding is worse than no fix, and the adversarial pass corrected **81%** of what it examined.
3. **Check the authority column before writing code.** 116 rows need nobody's permission; 44 need a recorded ARB decision; 3 need an amendment; 11 need a provider, a drill, or a person.
4. **Treat the 16 `†` rows as unchallenged.** They come from `data` and `flow-commerce` — the two dimensions no adversary reviewed — and four of the packet's most consequential money findings (`048`, `049`, `050`, `159`) are among them.
5. **Nothing here describes production.** `VERIFIED-LIVE` appears zero times in this packet. Every row above describes a repository at commit `f52abca7` — what is *deployed* remains the open question `04_LIVE_DEPLOYMENT_TRUTH.md` exists to record.
