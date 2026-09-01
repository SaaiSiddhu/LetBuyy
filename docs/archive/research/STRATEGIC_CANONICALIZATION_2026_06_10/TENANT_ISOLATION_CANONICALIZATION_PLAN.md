# TENANT ISOLATION — CANONICALIZATION PLAN

> **Document type:** Canonical tenant-isolation roadmap (Architecture Review Board, Security/Database track).
> **Status:** AUTHORITATIVE for the tenant-isolation domain of the Strategic Canonicalization program. Honors `_ANCHOR_DECISIONS_SPINE.md` **A2** (layered fail-closed isolation) and **A1** (identity is the sole asymmetric token issuer feeding the claims→GUC bridge). Subordinate to `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §2.6 / §6 / §7 (Principle 6: "Tenant isolation is layered and fail-closed") + the Final Architecture Freeze.
> **Date:** 2026-06-10
> **Scope:** Postgres RLS (`ENABLE`/`FORCE`), tenant GUC bridge, service-role usage, app-layer query-lint guard (`tenantScoped`/`createTenantGuardedSupabaseClient`), ownership checks (`verifySiteOwnership`/`verifyStoreOwnership`), middleware gates, worker/job tenancy, and the `store_id`↔`site_id` / `users`↔`users_custom` normalization (TD-7).
> **Authority of evidence:** every claim is anchored to `path:line` in the working tree of `/Users/saai_sidd/Git/Letbuyy_Store`, re-verified against source for this document. Forensic cross-references: `FORENSIC_MASTER_2026_06_10/FOUNDATION_AUDIT.md` (FND-001…027), `DATABASE_FORENSIC_AUDIT.md` (DB-004/009/011/014/016/017/030), `AUTH_FORENSIC_AUDIT.md` (AUTH-002/004), `TOP_250_PLATFORM_ISSUES.md`.
> **Constraint:** zero production merchants today ⇒ the Strategic Winner is "what should exist at 10,000 India merchants," not the oldest or most-complete control. No legacy isolation behavior is preserved for its own sake.

---

## 0. Methodology

1. **Read the spine and the constitution first.** A2 fixes the destination (RLS `ENABLE`+`FORCE` + per-transaction tenant GUC from validated JWT claims as the DB backstop + app-layer query-lint guard as defense-in-depth; gateway stops blanket `service_role` for tenant data; narrow audited escape hatch only; the PUBLIC `USING(true)` policies + anon-writable `super_admin_allowlist` are DEAD-now S0). V1 §7 fixes the table-level requirement ("every tenant table" gets `ENABLE`+`FORCE`+GUC policy; unset GUC ⇒ zero rows).
2. **Re-verify every load-bearing claim against code.** I read `tenant-scoped.ts` (the guard), `supabase-adapter/index.ts` (the stateless PostgREST data path — the reason a `SET LOCAL` GUC cannot persist today), `tenant-context.ts` (the dead re-export of the GUC statement), `tenant-core/src/index.ts:552-595` (the GUC statement factory with no live caller), migration `000_baseline.sql` (the 7 PUBLIC policies), migration `139` (`current_site_id()`/`set_current_site_id()`), migration `107` (the "service_role BYPASSES RLS" header), migration `151:18` (`post_settlement_ledger_transaction` setting the GUC from a parameter), `platform-queue-consumer.ts:316,456` (raw service client + payload tenancy), `tenant-isolation-validator.mjs` (scans only `services/api-gateway/src/`), and `tests/executable/money-ledger-postgres.test.mjs:257-264` / `security-rls-hardening-postgres.test.mjs` (the fail-closed proof under a non-bypass role).
3. **Classify each control** as CANONICAL / TRANSITIONAL / LEGACY / DEAD / FROZEN per the spine legend, then write a full 13-field decision block for each.
4. **Sequence onto Waves 0–8** under the spine's cross-cutting law: data-leak S0s + deploy meta-blocker first; then the architectural backbone (RLS+GUC off service_role); then breadth (FORCE on all tenant tables), workers, normalization, hardening.
5. **Counts caveat.** Raw `grep` over the migration corpus yields `ENABLE ROW LEVEL SECURITY` ≈ 429 statements / 392 distinct tables and `FORCE ROW LEVEL SECURITY` ≈ 47 statements / 41 distinct tables; the tenant registry declares **261 tenant tables** (192 `site_id`, 68 `store_id`, 1 null). Where this document says "≈41/261 FORCE," it means: of the 261 governed tenant tables, only the executable-era set (139–160) carries `FORCE`+GUC; the ~220 baseline tenant tables are `ENABLE`-only. Statement/table counts differ because of dynamic `DO`-loop enables and re-enable idempotency; the registry's 261 is the governing denominator.

---

## 1. Executive Verdict — the final tenant-enforcement architecture (5 sentences)

LetBuyy's canonical tenant isolation is a **three-layer fail-closed stack**: (L1) an **app-layer query-lint guard** that rejects any query to a registered tenant table lacking a tenant predicate, (L2) **ownership resolution** that proves the authenticated principal owns the `site_id` *value* before it is trusted, and (L3) **Postgres RLS `ENABLE`+`FORCE` + a per-transaction tenant GUC** (`app.site_id`, set via `SET LOCAL` from validated JWT claims) on **every** one of the 261 tenant tables, so that an unset or wrong GUC returns **zero rows** at the database. The single decisive architectural change is that **the gateway stops connecting as blanket `service_role` for tenant data**: tenant-scoped reads/writes run over a **pooled transactional connection under an RLS-subject role** (`app_tenant`) that sets the GUC per request, while `service_role` is demoted to a **narrow, audited, break-glass escape hatch** for explicitly cross-tenant admin jobs only. This makes RLS *load-bearing for the first time* — today it is decorative because `service_role` bypasses RLS (`migrations/107:17-19`) and the GUC is never executed on any live path (the data path is stateless PostgREST over HTTP, `supabase-adapter/index.ts:34-39`), so production runs **single-layer (app discipline only)**. The app-layer guard and ownership checks are **retained permanently as the outer layers** (they catch class-of-bug the DB cannot, e.g. a correct-predicate-wrong-value query) but they **stop being the SOLE control**. Before any of that, the **7 `USING(true)`-to-PUBLIC baseline policies and the anon-writable `super_admin_allowlist`** — which let any holder of the public anon key read every merchant's orders/customers/billing, take over stores, and self-grant platform super-admin — are **deleted in Wave 0, before merchant #1**, because they are a continuously-exploitable S0 data-and-privilege leak with no merchant in the way.

---

## 2. The Layer Model (role of each control at the target state)

The constitution names "layered and fail-closed." Here is the canonical layering, the role of each control, and which layer is **load-bearing** vs **defense-in-depth**.

```
 Request (merchant / staff / buyer / operator / worker)
   │
   │  A1 — identity-platform issues an asymmetric (RS256/EdDSA) token; per-audience claims
   │       incl. validated tenant/site claim (NOT the client-writable user_metadata path)
   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ L0  MIDDLEWARE PERIMETER  (TRANSITIONAL→CANONICAL)                                  │
│   storeContext() / requireStoreOwner() / internalPerimeter / requireRoleCategory   │
│   Resolves the *candidate* tenant + the actor; today applied ad-hoc per route.     │
│   TARGET: a default-deny tenant gate that fails closed if a route forgets to scope. │
└──────────────────────────────────────────────────────────────────────────────────┘
   │  emits a validated siteId  +  actor identity
   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ L1  APP-LAYER QUERY-LINT GUARD  (CANONICAL — permanent OUTER layer, defense-in-depth)│
│   createTenantGuardedSupabaseClient → guardQueryBuilder (tenant-scoped.ts:79-110)   │
│   Rejects any registered-table query with no tenant predicate at execution         │
│   (`then` → Promise.reject, tenant-scoped.ts:88-93). Catches "forgot to scope".     │
│   LIMIT: checks predicate PRESENCE, not VALUE correctness (FND-012) → needs L2.     │
└──────────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ L2  OWNERSHIP RESOLUTION  (CANONICAL — proves the VALUE, defense-in-depth)          │
│   verifySiteOwnership / verifyStoreOwnership / resolveOwned*Store (auth-user.ts:40) │
│   Proves the authenticated principal owns the siteId VALUE before it is trusted.    │
│   Closes the "correct-predicate, attacker-supplied value" gap L1 cannot.            │
└──────────────────────────────────────────────────────────────────────────────────┘
   │  trusted siteId
   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ L3  POSTGRES RLS + TENANT GUC  (CANONICAL — the LOAD-BEARING DB BACKSTOP)            │
│   Connection runs under role `app_tenant` (NOT service_role → subject to RLS).      │
│   SET LOCAL app.site_id = <validated claim>  inside the request transaction.        │
│   Policy on EVERY tenant table: USING (site_id = public.current_site_id())          │
│   Unset/wrong GUC ⇒ current_site_id() = NULL ⇒ zero rows (fail-closed).             │
│   ENABLE + FORCE so even the table owner is subject to policy.                       │
└──────────────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ESCAPE HATCH  service_role  (TRANSITIONAL→FROZEN-narrow)                            │
│   Only for explicitly cross-tenant admin/migration/recon jobs. Audited, allow-      │
│   listed, never the default gateway connection. Append-only audit on every use.     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Why three layers and not one.** Each layer fails differently, so the union is robust:

| Layer | What it is | Catches | Misses (why the next layer exists) | Load-bearing? | Classification |
|---|---|---|---|---|---|
| L0 Middleware | `storeContext`/`requireStoreOwner`/perimeter | wrong actor, missing auth | a route that simply doesn't call it (ad-hoc, not default-deny) | No (gate) | TRANSITIONAL → CANONICAL |
| L1 Query-lint guard | `createTenantGuardedSupabaseClient` Proxy | a query with **no** tenant predicate (forgot to scope) | a query with the **right column but attacker's value** (FND-012); non-registry tables (FND-013); worker/webhook clients (FND-014) | Defense-in-depth | **CANONICAL (permanent outer)** |
| L2 Ownership | `verifySiteOwnership` etc. | attacker-supplied `site_id` value not owned by caller | a forgotten ownership call on a future route | Defense-in-depth | **CANONICAL (permanent)** |
| L3 RLS + GUC | `FORCE` + `current_site_id()` policy + `SET LOCAL` | **everything above that slipped through** — unconditional DB-level deny of cross-tenant rows | nothing within tenant scope; relies on the GUC being set correctly (A1 claim integrity) | **YES — the backstop** | **CANONICAL (the winner)** |
| Escape hatch | `service_role` (RLS bypass) | n/a (it is the bypass) | must be *narrowed* to audited cross-tenant jobs | n/a | TRANSITIONAL → FROZEN-narrow |

**The governing inversion:** today L1+L2 are the *only* live layers and L3 is decorative (service_role bypass + GUC never set). The canonicalization **flips the load-bearing layer to L3** while keeping L1+L2 as permanent belt-and-suspenders. The constitution's words become true: *"App-layer predicate guard + RLS ENABLE+FORCE + tenant-GUC on every tenant table. Unset GUC ⇒ zero rows."* (V1 §2.6 Principle 6).

---

## 3. Per-Control Decision Table (summary; full 13-field blocks in §10)

| Control | Current role | Strategic role | Classification | Decisive change | Wave |
|---|---|---|---|---|---|
| 7 baseline `USING(true)`→PUBLIC policies (products, orders, sites, store_customers, billing_history, subscriptions) | Live anon read/write of all tenants' core commerce + PII | Deleted; replaced by `TO service_role` + owner + GUC policies | **DEAD** | Drop/replace immediately | **0** |
| `super_admin_allowlist` anon-writable policy | Anon `INSERT` → self-grant platform super-admin | Deleted; writes restricted to migration role + audited | **DEAD** | Drop immediately | **0** |
| `service_role` as the default gateway connection | Bypasses RLS for 96 gateway files (the only "trusted" path) | Demoted to narrow audited escape hatch only | **TRANSITIONAL→FROZEN-narrow** | Stop using for tenant data | **1** |
| `app_tenant` RLS-subject pooled connection + `SET LOCAL app.site_id` | Does not exist (data path is stateless PostgREST) | THE canonical tenant data path; GUC set from validated claim | **CANONICAL (new)** | Introduce the transactional pooled path | **1** |
| `current_site_id()` / `set_current_site_id()` GUC helpers (139) | Defined; only called inside SECURITY DEFINER fns + tests | Executed on every tenant request via L3 connection | **CANONICAL** | Wire to the live path | **1** |
| `tenantGucSetLocalStatement` (tenant-core) + `tenantSetLocalStatement` re-export | Dead code (no live caller) | The real statement run per transaction by the L3 connection | **CANONICAL** (was dead) | Execute it for real | **1** |
| `createTenantGuardedSupabaseClient` / `tenantScoped` query-lint guard | The de-facto SOLE isolation control | Permanent OUTER defense-in-depth (not sole) | **CANONICAL (permanent)** | Keep; stop being sole | **0→permanent** |
| `verifySiteOwnership` / `verifyStoreOwnership` ownership checks | Per-route value validation | Permanent value layer; lint-enforced adjacency to client-supplied ids | **CANONICAL (permanent)** | Keep; enforce in CI | **2** |
| `storeContext()` / `requireStoreOwner()` middleware | Applied ad-hoc per route | A default-deny tenant gate (fail closed on omission) | **TRANSITIONAL→CANONICAL** | Make default-deny | **3** |
| `FORCE` + GUC policy on baseline tenant tables (~220 of 261) | `ENABLE`-only; owner/definer paths bypass | `FORCE`+GUC on all 261 via template backfill | **CANONICAL (extend)** | Backfill migration | **2** |
| `post_settlement_ledger_transaction` GUC-from-param (151:18) | SECURITY DEFINER sets `app.site_id` from a raw arg → any caller posts cross-tenant | Derive site from authenticated principal; assert authorization in-RPC | **LEGACY→fix (DEAD pattern)** | Stop trusting the param | **1** (with money track) |
| queue-workers raw `service_role` + payload `site_id` | Un-guarded; tenant from job payload; outside CI scan | Guarded worker client; payload asserted vs row FK; per-job GUC; in CI | **TRANSITIONAL→CANONICAL** | Wrap + assert + GUC | **2** |
| webhook-service global order lookup by `payment_id` | Cross-tenant by necessity; safe only via HMAC + unique | Keep cross-tenant lookup, bind by `(gateway, provider_payment_id)` unique, verify HMAC before any write | **TRANSITIONAL (accepted, hardened)** | Document + assert ordering | **2** |
| `tenant-isolation-validator.mjs` (api-gateway-only scan) | Misses workers/webhook; inline-only regex | AST-based predicate check; scans all services; forbids `USING(true)` | **TRANSITIONAL→CANONICAL** | Extend + AST | **2** |
| `store_id`↔`site_id` dual key (TD-7) | Both NOT NULL, forced equal by trigger; guard accepts either | Normalize to `site_id`; `store_id` → generated/compat then dropped | **LEGACY→delete after migration** | Expand/contract to site_id | **4** |
| `users`↔`users_custom` duplication (TD-7) | Two user tables; FKs split | `users_custom` canonical; `users` → view | **LEGACY→delete after migration** | Designate + view | **4** |
| RLS escape-hatch audit + `REVOKE UPDATE,DELETE` on ledger/audit | No REVOKE anywhere (DB-009); CASCADE-to-sites on money (DB-014/030) | Defense-in-depth REVOKE; RESTRICT on money/audit FKs | **CANONICAL (new)** | REVOKE + RESTRICT migration | **2** |

---

## 4. The service_role → GUC Cutover (the architectural backbone — staged, with rollback)

This is **Wave 1** and the single most consequential migration in the program. It is what makes the claim "RLS is load-bearing" *true*; until it ships, every "tenant isolation" assurance is app-discipline only (FND-008, DB-004).

### 4.1 Why a cutover is needed at all (the current data path makes RLS unreachable)

- The gateway's data path is `createSupabaseServiceClient` → **stateless PostgREST over HTTPS** (`supabase-adapter/index.ts:34-39`, and the `selectSupabaseRows`/`patchSupabaseRows` fetch helpers `:74-150`). PostgREST opens a pooled connection per request as `service_role`; **there is no client-controlled transaction in which `SET LOCAL app.site_id` can persist** for subsequent statements.
- `service_role` **BYPASSES RLS** by definition; the repo states this in `migrations/107:17-19`. So even on tables with `FORCE`+GUC, the policy never evaluates on the gateway path.
- The GUC statement factory exists (`tenant-core/src/index.ts:590-595` `tenantGucSetLocalStatement`) and is re-exported (`tenant-context.ts:58-60` `tenantSetLocalStatement`) but **has no live caller** — it is dead code that creates a false sense of a working bridge (FND-016).
- The fail-closed design **is proven to work** for a non-bypass role: `tests/executable/money-ledger-postgres.test.mjs:257-264` sets `ROLE executable_app_user` and asserts `SELECT count(*) FROM ledger_entries` returns `0` with the GUC unset. The only thing missing is a *production* connection that behaves like `executable_app_user`.

**Conclusion:** we must introduce a **transactional, RLS-subject connection** for tenant data. Two options were on the table; A2 already picked the winner. Both are documented here with the justification.

### 4.2 The two options and the chosen winner

**Option A (REJECTED) — Keep `service_role`, make the app-guard the sole hardened layer.**
- Mechanics: never engage RLS; double down on L1+L2; make the query-lint guard value-aware and mandatory in CI; delete the dead GUC bridge to avoid false assurance.
- Pros: zero DB-connection re-architecture; no PostgREST→pooled-pg migration; no per-query latency overhead.
- Cons (decisive): isolation remains **a single application layer with no DB backstop** — exactly the property the constitution forbids ("layered and fail-closed"). Any future forgotten ownership check, any non-registry table, any worker path = an *unbounded* cross-tenant leak with nothing behind it. At 10,000 merchants, "the gateway role is trusted and well-behaved" is not an acceptable isolation guarantee. This is the status quo with better lipstick.

**Option B (CHOSEN, per A2) — Per-request RLS-subject connection + `SET LOCAL app.site_id` from validated claims; `service_role` becomes a narrow audited escape hatch.**
- Mechanics: introduce a pooled **transactional** Postgres connection (via the already-approved **Hyperdrive** binding, V1 §3 — "currently-unused binding, now used") using a dedicated **non-`BYPASSRLS` role `app_tenant`**. For every tenant-scoped request: `BEGIN; SELECT set_config('app.site_id', $validatedSiteId, true); … queries …; COMMIT;`. RLS policies (`USING (site_id = current_site_id())`) now actually run; unset/wrong GUC ⇒ zero rows. `service_role` is reserved for migrations and explicitly cross-tenant admin/recon jobs, audited and allow-listed.
- Pros (decisive): the DB becomes the backstop; the constitution's layered fail-closed isolation is *real*; a forgotten app-layer check no longer leaks (RLS denies); workers/webhook get the same backstop. The GUC bridge stops being dead code.
- Cons (managed): a real connection-architecture change (PostgREST → pooled `pg` over Hyperdrive for tenant data); a measurable but small per-request overhead (one `set_config` + transaction); a cutover risk that turning on `FORCE` under an `app_tenant` role can break any query that *silently relied on the bypass* (e.g. a read that never had a tenant predicate and worked only because service_role saw all rows).

**Winner: Option B.** It is the only choice consistent with A2 and V1 Principle 6, and the only one that survives to 10,000 merchants. Option A is the do-nothing-architecturally path and is rejected.

### 4.3 Staged rollout (shadow/audit → enforce → narrow), with the exact gates

The cutover risk is real and specific: **enabling `FORCE` and switching tenant reads to the `app_tenant` role can return zero rows for any query that depended on the service_role bypass** (a missing-predicate read that "worked" only because service_role saw everything). The mitigation is a staged rollout where each stage is independently reversible.

| Stage | What ships | Behavior | Gate to advance | Rollback |
|---|---|---|---|---|
| **S-1 — Foundation** | Create role `app_tenant` (`NOLOGIN`→assumed via pooled creds, **no `BYPASSRLS`**); grant minimal table privileges; stand up the Hyperdrive-pooled transactional connection helper `withTenantTx(siteId, fn)` that wraps `BEGIN; set_config('app.site_id', siteId, true); … ; COMMIT`. **No route uses it yet.** | No production change | Connection helper passes the existing `executable_app_user` fail-closed test pattern against an ephemeral PG; `app_tenant` provably sees 0 rows with GUC unset on a FORCE table | Drop role + helper; nothing referenced it |
| **S0 — Shadow / audit mode** | Route a **read-only shadow** of N% of tenant reads through `withTenantTx`+`app_tenant` *in parallel* with the live service_role read; compare row-sets; **log every divergence** (queries that return fewer rows under RLS = candidates that relied on bypass) to an append-only `rls_shadow_divergences` audit. Live responses still come from service_role. | Observational only; zero user-visible change | Divergence rate on the shadowed surface → **0 unexpected** (every divergence explained: either a genuine cross-tenant admin read that must move to the escape hatch, or a missing predicate that must be fixed) | Turn off the shadow flag |
| **S1 — Enforce reads** | Flip tenant **reads** to `withTenantTx`+`app_tenant` as the source of truth (service_role reads removed from the tenant surface). `FORCE` already true on executable tables; baseline tables still ENABLE-only until Wave 2 but the role is non-bypass so ENABLE policies now apply to it. | Reads fail-closed at the DB | 48h at 100% reads with no isolation regression (cross-tenant red-team suite green); p95 read latency within +X ms budget | Flag-flip reads back to service_role (instant); divergence audit identifies any newly-broken read |
| **S2 — Enforce writes** | Flip tenant **writes** to `withTenantTx`+`app_tenant`; `WITH CHECK (site_id = current_site_id())` now governs inserts/updates. | Writes fail-closed at the DB | 48h writes at 100% with money/checkout E2E green; idempotency + ledger tests green under the new role | Flag-flip writes back; replay write audit |
| **S3 — Narrow the hatch** | Inventory every remaining `service_role` use; convert legitimate cross-tenant jobs to the **audited escape-hatch helper** `withServiceRole(reason, fn)` (append-only audit row per call); assert in CI that no tenant route imports the raw service client. | service_role is escape-hatch-only | `tenant-isolation-validator` (extended) passes: no raw service client on tenant routes; escape-hatch calls all audited | Re-permit specific call sites via the helper |

**Connection topology note.** The L3 transactional path uses **Hyperdrive pooling in front of Postgres** (V1 §3 explicitly approves activating the currently-unused Hyperdrive binding). PostgREST/`service_role` HTTP remains only for the escape hatch and for non-tenant catalog reads. This is consistent with the "one transactional DB" envelope — no new datastore, just a pooled `pg` path that can hold a transaction.

**Cutover risk register (specific to this migration):**

| Risk | Likelihood | Blast radius | Mitigation |
|---|---|---|---|
| A read with no tenant predicate silently returned all-tenants rows via bypass; under RLS it returns 0 → feature appears "empty" | Medium | Per-feature breakage, **not** a leak | S0 shadow divergence audit catches it before S1; fix = add predicate or move to escape hatch |
| A legitimate cross-tenant admin/ops read breaks under `app_tenant` | Medium | Ops feature breakage | Classified during S0; moved to `withServiceRole` audited hatch |
| Per-request `set_config` + transaction adds latency | High (small) | Platform-wide minor | Hyperdrive pooling; measure p95 budget; `set_config` is cheap |
| GUC set from an **untrusted** claim (A1 not yet asymmetric) ⇒ attacker controls `site_id` | Medium until A1 lands | **Total isolation bypass** | **HARD DEPENDENCY on A1**: the GUC value must be the *validated* tenant claim (server-resolved / asymmetric-verified), never `user_metadata` (AUTH-004). Until A1 ships, derive the GUC from the **ownership-verified** siteId (L2 output), not from a raw token claim. |
| Connection-pool exhaustion under transactional load | Low | Platform-wide | Hyperdrive pool sizing; short transactions; statement timeout |

---

## 5. The S0 fix — 7 PUBLIC `USING(true)` policies + `super_admin_allowlist` (Wave 0, before merchant #1)

This is the **most urgent** item in the entire canonicalization program and is independent of the architectural cutover. It is continuously exploitable **today** by anyone holding the public `SUPABASE_ANON_KEY` (shipped to every storefront/admin browser).

### 5.1 Exactly what is wrong (verified)

Seven baseline policies are written `USING (true) WITH CHECK (true)` with **no `TO service_role` clause**, which defaults to `TO PUBLIC` — i.e. they grant the `anon`/`authenticated` PostgREST roles unconditional access:

| Policy | Table | Line | Effect |
|---|---|---|---|
| `service_all_store_customers` | `store_customers` | `000_baseline.sql:26571` | anon read **all** customer PII |
| `service_role_billing_history` | `billing_history` | `000_baseline.sql:26627` | anon read/write **all** billing |
| `service_role_manage_allowlist` | `super_admin_allowlist` | `000_baseline.sql:26669` | anon **INSERT** → self-grant platform super-admin |
| `service_role_orders` | `orders` | `000_baseline.sql:26690` | anon read/write **all** orders + customer PII + payment ids (overrides 147 FORCE via permissive-OR) |
| `service_role_products` | `products` | `000_baseline.sql:26718` | anon read/write **all** catalog |
| `service_role_sites` | `sites` | `000_baseline.sql:26725` | anon read all stores + **write ownership columns** → store takeover |
| `service_role_subscriptions` | `subscriptions` | `000_baseline.sql:26739` | anon read/write **all** subscriptions / plan gates |

(Plus the S1 cohort `theme_purchases` `000:24148,24190`, `collections`/`gift_cards`/`pages`/`onboarding_attempts` cohort, and `wishlists` `000:23831` read — fixed in the same sweep but lower severity.)

The three confirmed attack walkthroughs (FOUNDATION_AUDIT §Attack #1-3): anon read of all orders/customers; anon `INSERT` into `super_admin_allowlist` → full platform-operator powers; anon `PATCH sites.user_id` → store takeover that then passes `verifySiteOwnership`.

**GRANT caveat (UNVERIFIED but high-confidence).** The leak is exploitable iff `anon`/`authenticated` hold table-level GRANTs. No `GRANT … TO anon` and **no `REVOKE`** exists anywhere in the migrations (the corpus has **zero** `REVOKE` statements). Supabase grants schema-wide to `anon` by default, and `migrations/107:5-8` is direct first-party evidence that anon *did* have such grants ("readable with the public anon key") on sibling tables the 107 sweep fixed. The live grant state must be probed (`\dp public.orders` or an anon-key probe) as the **very first action**, but the fix ships regardless.

### 5.2 The fix (Wave 0)

One idempotent migration (`162_baseline_public_policy_lockdown.sql` + paired rollback), modeled exactly on the `107` sweep that already fixed the credential tables:

1. **Drop** each of the 7 PUBLIC policies (and the S1 cohort).
2. **Recreate** as `TO service_role` for the service path, **plus** the correct owner/public-active policies:
   - `products`/`collections`/`pages`: `TO service_role` + a `public read WHERE is_active/published` policy for the storefront + an owner write policy (`store_id IN (owned sites)`).
   - `orders`/`store_customers`/`billing_history`/`subscriptions`: `TO service_role` + owner-only (`site_id IN owned`) — no public read.
   - `sites`: `TO service_role` + owner read + **explicitly forbid mutation of `user_id`/`custom_user_id` by non-service roles** (column-guarded).
   - `super_admin_allowlist`: `TO service_role` only for writes; add a `BEFORE INSERT` audit trigger; **anon writes denied**.
3. **Add a CI policy-lint** (extend `tenant-isolation-validator.mjs`) that **fails the build on any `CREATE POLICY … USING (true)` without an explicit `TO <role>` and a predicate** — so this class can never reappear.

This is **independent of the service_role→GUC cutover** and must not wait for it. It closes the live anon surface immediately; the cutover then removes the *service_role-bypass* surface later. Because the gateway connects as service_role today, re-scoping these policies to `TO service_role` **cannot break gateway code paths** (the same property `107:14-16` relies on) — it only removes the anon attack surface.

---

## 6. All-tenant-tables FORCE + GUC rollout (Wave 2)

**Current:** of the 261 registered tenant tables, only the executable-era set (139–160; ≈41 tables) carries `FORCE`+GUC; the ~220 baseline tenant tables are `ENABLE`-only (FND-009). `ENABLE`-only means the table owner / any `BYPASSRLS` role is **not** subject to policy — and the gateway is exactly such a role today.

**Target:** every one of the 261 tenant tables has `ENABLE`+`FORCE` and a GUC policy `USING (site_id = public.current_site_id())` (+ `WITH CHECK` for writes), applied via the existing template helper (`tenant-core` exposes `TENANT_RLS_SITE_ID_PREDICATE = 'site_id = public.current_site_id()'` at `index.ts:553`).

**Rollout (staged, mirrors §4.3):**
1. **Generate** the backfill migration from the **registry** (the single source of truth, `tenant-tables.registry.ts`, GENERATED) so coverage == the governed set, not a hand list. For the 68 `store_id`-keyed tables, the policy keys on `store_id` until TD-7 normalization (Wave 4) collapses them to `site_id`.
2. **Apply `ENABLE`/`FORCE` first** (additive, safe) ahead of switching the connection role; under `service_role` it is a no-op (bypass), so it cannot break the live path before the cutover.
3. **Add GUC policies**; verify with the role-switch test pattern (`SET ROLE app_tenant; … expect 0 rows with GUC unset`) extended to cover the new tables.
4. **Sequence after S1/S2 of the cutover** for the *load-bearing* effect, but the DDL itself can land earlier because it is inert under service_role.
5. **Handle the 1 null-tenant-column registry entry** and the FND-021/022 inventory/media tables (no FORCE, no GUC today) explicitly in the same migration.

**Edge cases:** the 64 nullable `store_id`/`site_id` baseline columns (DB-016) must be backfilled and `SET NOT NULL` *before* a GUC policy can be trusted (a NULL tenant key is invisible to the policy and to tenant-scoped reads). This is a prerequisite sub-task of the FORCE rollout.

---

## 7. Worker / job tenancy fix (Wave 2)

**Current (FND-010):** `platform-queue-consumer.ts:316` builds a **raw** `createSupabaseServiceClient(env)` (un-guarded, RLS-bypassing). Tenant scope is read from the job payload: `:456` `const siteId = job.site_id || envelope.site_id`. Several inserts (`notification_logs`, `partner_payout_ledger_entries`, `search_documents`) key off the payload `site_id` with **no `.eq` filter, no GUC, no CI coverage** (the validator scans only `services/api-gateway/src/`, `tenant-isolation-validator.mjs` filter `:3`). Outbox-sourced jobs are server-authoritative (enqueued by the gateway with a validated `site_id`), so the payload is **not normally attacker-controlled** — but there is **zero defense-in-depth**. No client-reachable enqueue path that forges `platform_queue_jobs.site_id` was confirmed (so FND-010 is **latent**, not proven live — see UNVERIFIED), but a bug or a future code path that lets a client influence an enqueued `site_id` yields a cross-tenant write.

**Target — defense-in-depth on the worker, three changes:**
1. **Wrap the worker client** in `createTenantGuardedSupabaseClient` so registered-table writes without a tenant predicate fail closed (same L1 guarantee as the gateway).
2. **Run worker DB work inside the L3 transactional path** `withTenantTx(siteId, …)` so the GUC is set per job and RLS backstops the write — the worker becomes an RLS subject exactly like a request.
3. **Assert payload `site_id` against the row's FK / aggregate ownership** before writing (e.g. the order/payout being acted on actually belongs to `site_id`), turning "trust the payload" into "verify the payload."
4. **Bring workers + webhook-service into the CI scan** (extend `tenant-isolation-validator.mjs` scope beyond api-gateway, FND-014) with an AST-based predicate check (the current inline-only regex `:31` misses the variable form `const db = …; db.from(...)`).

**webhook-service (FND-011) — accepted-but-hardened (TRANSITIONAL).** Inbound PSP webhooks resolve the order **globally** by `payment_id` (`webhook-service/src/index.ts:319`) because the provider does not know the tenant — this cross-tenant lookup is **necessary and correct**. Safety must rest on (a) HMAC signature verification *before any write*, and (b) the global unique `payment_transactions (gateway, provider_payment_id)` (`107:135`, also `142:148`) so one provider payment id confirms at most one order. The fix is to **assert that ordering in code and test** (HMAC verify precedes the DB read/write; the unique is relied upon), and to bind the write by the unique tuple, not by a forgeable scalar. This stays an escape-hatch-class path (service-headers fetch), documented and audited.

---

## 8. store_id ↔ site_id normalization (TD-7, Wave 4)

**Current (FND-017, DB-017/018):** the high-value tables carry **both** `store_id` and `site_id` (e.g. `orders` `baseline:10112,10139`; the registry lists `scopeColumns:[site_id, store_id]` with `tenantColumn:site_id` for orders/products/payment_transactions/order_items/media_assets/outbox_events/app_installations/contacts/projects/coupons). Both are `NOT NULL` and **forced equal** by the `sync_orders_tenant_keys` trigger (`130:14-31`) which **raises if `site_id <> store_id`**. The app keeps them equal by writing the resolved `siteId` into both (`orders.ts:645` `.eq('site_id', tenant.siteId)` vs `:883` `.eq('store_id', tenant.siteId)`). **Isolation risk:** the L1 guard accepts **either** column as "scoped" (`tenant-scoped.ts:60-61` via `scopedColumnsForTable`), so any legacy row where `store_id ≠ site_id` (e.g. a row that escaped the trigger) could evade a single-column filter (FND-017). Separately, `users` vs `users_custom` (`baseline:13095,13116`) splits identity across two tables with FKs pointing at `users_custom`.

**Target:** **`site_id` is the sole tenant key; `sites` is the sole tenant table; `users_custom` is the canonical user table.**

**Migration (expand/contract, Wave 4 — after isolation backbone is real so we are normalizing under RLS protection, not before):**
1. **Audit** for any row where `store_id ≠ site_id` (should be none given the trigger, but verify on live before trusting). Add the missing `orders.store_id → sites(id)` FK (DB-015) and backfill integrity first.
2. **Make `site_id` authoritative**: repoint all reads/writes to `site_id`; change the L1 guard so that for these tables only `site_id` counts as a tenant predicate (remove `store_id` from `scopeColumns`), closing FND-017.
3. **Demote `store_id`** to a generated/compat column (`GENERATED ALWAYS AS (site_id)` or a view) so external readers don't break, then **drop** it in a later contract migration; retire the `sync_orders_tenant_keys` trigger.
4. **`users`/`users_custom`**: designate `users_custom` canonical; expose `users` as a view over it; repoint FKs.
5. Regenerate the tenant registry; the GUC policies (Wave 2) now key cleanly on `site_id` for the formerly-dual tables.

**Sequencing rationale:** normalization is **Wave 4**, deliberately *after* the isolation backbone (Waves 1-2). Reason: collapsing the tenant key is a large, risky data migration; doing it while RLS+GUC is load-bearing means a mistake fails *closed* (zero rows) rather than open (cross-tenant). Doing it first would be normalizing under the current no-backstop regime.

---

## 9. Test & Validation Plan (the cross-tenant red-team suite)

A foundation already exists: `tests/executable/security-rls-hardening-postgres.test.mjs` replays migrations against an **ephemeral Postgres container**, does `SET ROLE`, and asserts policy behavior; `money-ledger-postgres.test.mjs:257-264` proves the fail-closed property under `executable_app_user`. The canonicalization **extends this into a permanent, comprehensive cross-tenant red-team suite** that runs in CI and gates every isolation-touching merge.

### 9.1 Per-migration test matrix (applied to each decision in §10)

| Test type | What it asserts | Example for this domain |
|---|---|---|
| **Unit** | Pure logic | `tenantGucSetLocalStatement` returns `set_config($1,$2,true)` with the validated siteId; guard `markScopeFromCall` recognizes/denies columns |
| **Integration** | Against ephemeral PG | `withTenantTx(siteA)` then read `orders` returns only A's rows; read with GUC unset returns 0 |
| **Contract** | Cross-module invariants | every registry tenant table has a FORCE+GUC policy (registry == policy coverage); `getSupabaseAdminFromEnv` wraps with the guard (`tenant-isolation-validator.mjs:48-52`) |
| **E2E** | Full request path | merchant A's authenticated session cannot read/write B's order/product/customer/payout through the gateway, the BFF, or the worker |
| **Security (cross-tenant red-team)** | Real denial, not trivial | §9.2 — the permanent suite |
| **Performance** | RLS/GUC overhead | p95 of a tenant read under `app_tenant`+`set_config`+tx vs the old service_role path within budget; pool not exhausted |
| **Regression** | No previously-fixed leak returns | the 7 PUBLIC policies stay gone; `/api/auth/switch`, platform-console god-mode, JWT-role escalation stay closed (`tenant-isolation-validator.mjs:57-68`) |
| **Rollback validation** | Each stage reverses cleanly | flag-flip reads/writes back to service_role restores prior behavior; the Wave-0 policy migration's rollback restores the (now-fixed) policies without reintroducing PUBLIC |
| **Deletion validation** | Removed thing is truly gone | after S3, no tenant route imports the raw service client (CI assertion); after TD-7 contract, `store_id` column is absent and nothing references it |

### 9.2 The permanent cross-tenant red-team suite (asserts REAL denial)

A standing CI job (`tests/security/cross-tenant-redteam-postgres.test.mjs`) seeds **two tenants A and B** in an ephemeral PG with the full migration chain, then asserts **denial** for every attack class. "Real denial" means the suite first proves the *positive* (A can see A's row) so a trivially-empty DB cannot make it pass, then proves the *negative* (the attack returns 0 rows / 403 / raises).

| # | Attack class | Probe | Required result | Anchors |
|---|---|---|---|---|
| RT-1 | **Anon PostgREST probe** | with the anon key, `GET /rest/v1/orders`, `/store_customers`, `/sites`, `/subscriptions`, `/billing_history`; `POST /super_admin_allowlist`; `PATCH /sites?id=eq.<B>` | **0 rows / denied** on every table; allowlist insert denied; sites ownership patch denied | FND-001..006; §5 |
| RT-2 | **Forged `site_id`/`store_id` (right column, wrong value)** | as merchant A, query through the gateway/`withTenantTx` with `site_id = <B>` | RLS returns **0 rows** even though the predicate is present (this is the layer L1 alone cannot catch — proves L3 is load-bearing) | FND-012; §4 |
| RT-3 | **Missing-predicate query on a registered table** | a query to a registry tenant table with **no** tenant predicate | L1 guard **rejects** (`Promise.reject`, `tenant-scoped.ts:88-93`) **and** L3 returns 0 if it somehow reaches the DB | FND-013; §2 |
| RT-4 | **Worker payload forgery** | enqueue (or simulate) a `platform_queue_jobs` row with `site_id = <B>` while the acted-on order/payout belongs to A | worker **asserts payload vs row FK → refuses**; and the GUC-scoped write fails closed | FND-010; §7 |
| RT-5 | **service_role escape-hatch abuse** | call a tenant route and confirm it does **not** use the raw service client; call `withServiceRole` and confirm an audit row is written | CI assertion: no raw service client on tenant routes; every hatch call audited | FND-015; §4.3 S3 |
| RT-6 | **GUC-from-param cross-store post** | call `post_settlement_ledger_transaction(p_site_id=<B>)` as a principal owning only A | **denied** once the RPC derives site from the authenticated principal (not the raw param) | DB-011; 151:18 |
| RT-7 | **Unset GUC = zero rows (the fail-closed invariant)** | under `app_tenant` with no `set_config`, select from each FORCE table | **0 rows** every time | `money-ledger-postgres.test.mjs:257-264` |
| RT-8 | **Non-registry / misclassified table** | access a `public` table not in the registry | default-deny (post FND-013 fix) — unknown tables guarded, not passed through | FND-013/024 |
| RT-9 | **Ownership-column confusion** | `.eq('user_id', x)` on a site-bounded table | not accepted as a *tenant* predicate (post FND-023 fix); requires the `site_id` tenant column | FND-023 |

**Permanence requirement:** RT-1, RT-2, RT-7 are the three that must *never* be removed or weakened — they are the load-bearing assertions that the layered stack denies. The suite must fail the build (not warn) and must prove the positive-control first so an empty schema cannot green it.

### 9.3 Live-probe gate (UNVERIFIED resolution)

Because the `anon` grant state is set by Supabase outside the repo and is **UNVERIFIED** from code, Wave 0 includes a **one-shot live probe** (anon-key `GET /rest/v1/orders?limit=1` and `\dp public.orders`) executed against the live project to confirm/deny exploitability and to set the final S0 severity. The fix ships regardless; the probe only calibrates urgency messaging and confirms closure post-fix.

---

## 10. Per-Decision Detail Blocks (all 13 fields)

> Fields per block: **Current State · Strategic State · Reasoning · Migration Plan · Validation Plan · Deletion Plan · Rollback Plan · Risk Level · Complexity (XS/S/M/L) · Timeline (Wave) · Owner · Dependencies · Success Criteria.** Classification stated in the header.

### TEN-001 — Delete the 7 PUBLIC `USING(true)` policies + lock down `super_admin_allowlist` — **DEAD**
- **Current State:** 7 baseline policies are `USING(true) WITH CHECK(true)` to PUBLIC (`000_baseline.sql:26571,26627,26669,26690,26718,26725,26739`); anon can read all orders/customers/billing/subscriptions/products/sites and `INSERT` into `super_admin_allowlist` (consumed by `rbac.ts:215-233`) → self-grant platform super-admin; anon `PATCH sites.user_id` → store takeover.
- **Strategic State:** policies deleted; recreated as `TO service_role` + correct owner/public-active policies; `super_admin_allowlist` writes restricted to service/migration role with a `BEFORE INSERT` audit trigger; CI lint forbids `USING(true)` without `TO`+predicate.
- **Reasoning:** continuously-exploitable S0 data + privilege leak with the public anon key; zero merchants in the way; the constitution's isolation is meaningless while this is open. Re-scoping to `TO service_role` cannot break gateway paths (it connects as service_role) — same safety property `107:14-16` relies on.
- **Migration Plan:** `162_baseline_public_policy_lockdown.sql` (idempotent) + rollback, modeled on `107`; drop+recreate the 7 (and the S1 cohort `theme_purchases`/`collections`/`gift_cards`/`pages`/`wishlists`); add the policy-lint to `tenant-isolation-validator.mjs`.
- **Validation Plan:** RT-1 (anon probe → all denied) as a positive+negative test; regression test asserting the policies never return to PUBLIC; live anon probe (§9.3) before and after.
- **Deletion Plan:** the PUBLIC policies are the thing being deleted; deletion validated by RT-1 returning 0 rows/denied and by `\dp` showing `{service_role}` not `{public}`.
- **Rollback Plan:** the paired rollback restores the *fixed* (service_role-scoped) policies, **never** the PUBLIC ones; if a storefront read breaks, add the specific `public read WHERE published/active` policy rather than reverting to `USING(true)`.
- **Risk Level:** S0 (fixing it is low-risk; leaving it is the highest risk on the platform).
- **Complexity:** S.
- **Timeline:** **Wave 0** (immediate, before merchant #1).
- **Owner:** Platform/Security squad (DB-owning engineer signs the migration).
- **Dependencies:** none (independent of the cutover). Live anon-grant probe informs messaging only.
- **Success Criteria:** RT-1 green; CI policy-lint blocks any new `USING(true)`-to-PUBLIC; live probe confirms anon can no longer read `orders`/insert allowlist/patch `sites`.

### TEN-002 — service_role → RLS-subject `app_tenant` connection + `SET LOCAL` GUC — **CANONICAL (new) / service_role TRANSITIONAL→FROZEN-narrow**
- **Current State:** gateway data path is stateless PostgREST as `service_role` (`supabase-adapter/index.ts:34-39`), which BYPASSES RLS (`migrations/107:17-19`); the GUC is never set on any live path (FND-008/016).
- **Strategic State:** tenant data flows over a Hyperdrive-pooled **transactional** connection under non-`BYPASSRLS` role `app_tenant`; each request does `BEGIN; set_config('app.site_id', validatedSiteId, true); …; COMMIT`; `service_role` becomes the audited escape hatch only.
- **Reasoning:** the only design (per A2 / V1 Principle 6) where RLS is actually load-bearing and isolation is layered+fail-closed; Option A (service_role-forever) leaves an unbacked single layer that cannot survive 10k merchants.
- **Migration Plan:** create `app_tenant` role + grants; build `withTenantTx(siteId, fn)` on Hyperdrive `pg`; staged rollout S-1→S0(shadow)→S1(reads)→S2(writes)→S3(narrow hatch) per §4.3.
- **Validation Plan:** RT-2/RT-7 (forged value → 0 rows; unset GUC → 0 rows) under `app_tenant`; S0 shadow-divergence audit → 0 unexpected; performance test on p95 read/write; E2E money/checkout green under the new role.
- **Deletion Plan:** delete the dead GUC bridge's "never called" status by *using* it; at S3 remove service_role from the tenant surface (the deleted thing is the *blanket* service_role usage), asserted in CI.
- **Rollback Plan:** every stage is a flag-flip back to service_role (reads/writes independently); the shadow audit identifies any read that would break before it is enforced.
- **Risk Level:** S1 (high value, real cutover risk — managed by staging).
- **Complexity:** L.
- **Timeline:** **Wave 1** (the architectural backbone; gates all "RLS is load-bearing" claims).
- **Owner:** Platform/Security + DB-owning engineer.
- **Dependencies:** **A1** (validated asymmetric claim to source the GUC; until then source from the ownership-verified siteId, not a raw token claim — AUTH-004); Hyperdrive binding activation (V1 §3); the FORCE rollout (TEN-004) for full effect.
- **Success Criteria:** 100% tenant reads+writes via `withTenantTx`; cross-tenant red-team green; service_role only reachable via the audited hatch; p95 within budget.

### TEN-003 — App-layer query-lint guard (`createTenantGuardedSupabaseClient`/`tenantScoped`) — **CANONICAL (permanent outer layer)**
- **Current State:** the de-facto **sole** isolation control; a Proxy that rejects registered-table queries lacking a tenant predicate (`tenant-scoped.ts:88-93`); CI asserts `getSupabaseAdminFromEnv` wraps it (`tenant-isolation-validator.mjs:48-52`). Limits: presence-not-value (FND-012), non-registry tables pass (`:119`, FND-013), owner columns count as scope (FND-023), not wired into workers/webhook (FND-014).
- **Strategic State:** retained permanently as L1 defense-in-depth (not sole); value-correctness deferred to L2 (ownership) + L3 (RLS); non-registry tables default-deny; tenant predicate separated from owner predicate; guard extended to workers.
- **Reasoning:** it catches a real, distinct failure (a developer forgetting to scope) that neither ownership nor RLS phrasing catches at the same point; cheap and fail-closed; keeping it as the outer layer is correct, *being it alone* is not.
- **Migration Plan:** make non-registry tables default-deny (FND-013/024); split `scopeColumns` into tenant vs owner so `.eq('user_id',x)` is not a tenant predicate on a site-bounded table (FND-023); wrap the worker client (TEN-006).
- **Validation Plan:** RT-3 (missing predicate → reject), RT-8 (non-registry → deny), RT-9 (owner-column not a tenant predicate); contract test registry==guard coverage.
- **Deletion Plan:** not deleted — permanent. (If ever removed, RT-3 must still pass via L3.)
- **Rollback Plan:** changes are additive tightenings; revert the specific tightening if a legitimate query is blocked, behind L2+L3 still holding.
- **Risk Level:** S2.
- **Complexity:** S (tightenings) — the guard exists.
- **Timeline:** **Wave 0** keep + **Wave 2** tightenings.
- **Owner:** Platform/Security.
- **Dependencies:** registry generator (FND-024); TEN-006 for worker wrapping.
- **Success Criteria:** guard active on gateway + workers; non-registry default-deny; RT-3/8/9 green; remains green as a *layer* even after L3 lands.

### TEN-004 — FORCE + GUC policy on all 261 tenant tables — **CANONICAL (extend)**
- **Current State:** only ~41 executable-era tables have FORCE+GUC; ~220 baseline tenant tables are ENABLE-only (FND-009); 64 nullable tenant columns (DB-016); inventory/media lack FORCE+GUC (FND-021/022).
- **Strategic State:** every registry tenant table has ENABLE+FORCE + `USING (site_id = current_site_id())` (+`WITH CHECK`), generated from the registry; nullable tenant columns backfilled + `SET NOT NULL`.
- **Reasoning:** "every tenant table" is the constitution's literal requirement; ENABLE-only is bypassable by the table owner/service_role, so FORCE is what makes L3 unconditional.
- **Migration Plan:** registry-driven backfill migration applying the template; ENABLE/FORCE first (inert under service_role), then GUC policies; `store_id`-keyed tables keyed on `store_id` until TD-7; nullable-column backfill as a prerequisite sub-task.
- **Validation Plan:** contract test (registry == policy coverage); RT-7 extended to the newly-covered tables; ephemeral-PG role-switch assertion.
- **Deletion Plan:** n/a (additive); the *gap* (ENABLE-only) is what's eliminated.
- **Rollback Plan:** paired rollback issues `NO FORCE` + drops the added policies per table (note the asymmetry seen in 155.rollback — must also handle ENABLE state).
- **Risk Level:** S1 (a wrong policy could fail-close a table → empty feature; caught in shadow).
- **Complexity:** M.
- **Timeline:** **Wave 2** (DDL can land earlier since inert under service_role; load-bearing after TEN-002 S1/S2).
- **Owner:** DB-owning engineer.
- **Dependencies:** registry; TEN-002 (for live effect); nullable-column backfill.
- **Success Criteria:** 261/261 tenant tables FORCE+GUC; no nullable tenant key on an active table; RT-7 green across all.

### TEN-005 — `post_settlement_ledger_transaction` GUC-from-param + sibling DEFINER footguns — **LEGACY→fix (DEAD pattern)**
- **Current State:** `post_settlement_ledger_transaction` is `SECURITY DEFINER` and does `set_config('app.site_id', p_site_id, true)` from a raw parameter (`151:18`) then posts — **any caller can post ledger entries for any site_id** (DB-011); `backfill_wallet_ledger_to_canonical` (`160:279-355`) is a standing cross-tenant mass-write; `mirror_hot_table_partition_shadow` does dynamic DML into a table named in a data row (`131:49-52`, DB-013).
- **Strategic State:** the RPC derives the site from the **authenticated principal** (or asserts the caller is authorized for `p_site_id`) rather than trusting the param; `backfill_*` dropped post-backfill or gated behind a break-glass schema; mirror function allow-lists shadow table names.
- **Reasoning:** a DEFINER function that sets the tenant context from its own argument *is* the GUC bypass in function form — it defeats L3 from the inside; this is the same anti-pattern the spine flags DEAD on the money side.
- **Migration Plan:** add an authorization assertion inside the RPC (caller owns/operates `p_site_id`); coordinate with the Money canonicalization track (A3) since these are money RPCs; drop `backfill_*` after the one-time backfill; allow-list `retention_policies.shadow_table`.
- **Validation Plan:** RT-6 (cross-store post denied); unit test that the RPC rejects a `p_site_id` the principal does not own.
- **Deletion Plan:** `backfill_wallet_ledger_to_canonical` deleted after use; the GUC-from-param *behavior* removed.
- **Rollback Plan:** revert the authorization assertion if a legitimate settlement job breaks (it should be routed through an authorized principal); keep the param-trust off.
- **Risk Level:** S1.
- **Complexity:** M.
- **Timeline:** **Wave 1** (with the money track; it is part of making L3 real).
- **Owner:** Finance/Payments squad + DB-owning engineer.
- **Dependencies:** TEN-002 (principal→GUC discipline); A3 money canonicalization.
- **Success Criteria:** RT-6 green; no DEFINER money RPC sets `app.site_id` from an untrusted param; backfill function gone.

### TEN-006 — queue-workers tenancy (raw service client + payload site_id) — **TRANSITIONAL→CANONICAL**
- **Current State:** `platform-queue-consumer.ts:316` raw service client; tenant from payload (`:456`); several inserts unfiltered; outside the CI scan (`tenant-isolation-validator.mjs:3`). Outbox jobs are server-authoritative so payload is not normally attacker-controlled; **no client-reachable forge path confirmed (FND-010 latent)**.
- **Strategic State:** worker client wrapped in the L1 guard; DB work inside `withTenantTx(siteId,…)` (GUC + RLS backstop); payload `site_id` asserted against the acted-on row's ownership; workers in the CI scan with AST predicate checking.
- **Reasoning:** workers are a privileged internal write path with zero defense-in-depth today; one bug = cross-tenant write with no backstop; the same three layers must cover them.
- **Migration Plan:** wrap the client; route through `withTenantTx`; add the payload-vs-FK assertion at `:456`/`:599`/`:723`; extend the validator scope + AST.
- **Validation Plan:** RT-4 (payload forgery refused); integration test that a job for site B acting on A's order is denied; CI proves workers scanned.
- **Deletion Plan:** the *raw* un-guarded client usage removed; replaced by the guarded/transactional helper.
- **Rollback Plan:** feature-flag the guarded path; fall back to the raw client only with the payload-assertion still on, while investigating.
- **Risk Level:** S1.
- **Complexity:** M.
- **Timeline:** **Wave 2**.
- **Owner:** Checkout/Platform squad (worker owners) + DB-owning engineer.
- **Dependencies:** TEN-002 (`withTenantTx`); TEN-003 (guard); validator extension (TEN-009).
- **Success Criteria:** RT-4 green; workers in CI scan; no unfiltered registered-table write in the consumer.

### TEN-007 — webhook-service global order lookup — **TRANSITIONAL (accepted, hardened)**
- **Current State:** inbound PSP webhook resolves order globally by `payment_id` (`webhook-service/src/index.ts:319`), no `store_id`; safe only via HMAC + global unique `payment_transactions(gateway, provider_payment_id)` (`107:135`).
- **Strategic State:** keep the necessary cross-tenant lookup, but (a) HMAC verify **before any DB read/write**, (b) bind by the unique `(gateway, provider_payment_id)` tuple (not a forgeable scalar), (c) document + test the ordering; treat as an audited escape-hatch-class path.
- **Reasoning:** the provider cannot know the tenant, so the lookup must be global — correctness requires it; safety is the unique + signature, and that must be asserted, not assumed.
- **Migration Plan:** assert HMAC-before-DB in code; ensure the read/confirm keys on the unique tuple; add to CI scan as an annotated exception.
- **Validation Plan:** test that an unsigned/forged webhook is rejected before any DB contact; test that a colliding/forged `payment_id` cannot confirm a second order (unique enforces one).
- **Deletion Plan:** n/a (necessary path); the *unverified-before-write* behavior is eliminated.
- **Rollback Plan:** revert ordering change if a legitimate webhook path breaks, keeping signature verification mandatory.
- **Risk Level:** S2.
- **Complexity:** S.
- **Timeline:** **Wave 2**.
- **Owner:** Payments squad.
- **Dependencies:** the global unique (already present, `107:135`); validator extension.
- **Success Criteria:** forged/unsigned webhook denied pre-DB; one provider payment id confirms at most one order; path annotated + audited.

### TEN-008 — Ownership checks (`verifySiteOwnership`/`verifyStoreOwnership`) — **CANONICAL (permanent value layer)**
- **Current State:** every sampled merchant route verifies ownership before trusting a client `store_id` (e.g. `products.ts:459`, `orders.ts:557,970`, `auth-user.ts:40-67` checks `user_id`/`custom_user_id` vs `auth.uid()`); discipline-dependent (no default-deny).
- **Strategic State:** retained permanently as L2; a CI lint requires an ownership check **adjacent to any client-sourced `store_id`/`site_id`** before it reaches a query (closes FND-012 at the source); ownership remains the value-truth feeding the GUC until A1's validated claim does.
- **Reasoning:** L1 proves a predicate exists; only L2 proves the *value* is the caller's; this is the layer that stops "right column, attacker's value," which is the most likely real-world tenant bug.
- **Migration Plan:** add the adjacency lint; keep the checks; once A1 lands, the validated claim can co-source the GUC but ownership stays as defense-in-depth.
- **Validation Plan:** RT-2 (forged value denied — by ownership at L2 *and* RLS at L3); lint test that a route using a client id without an ownership check fails CI.
- **Deletion Plan:** not deleted — permanent.
- **Rollback Plan:** the lint is additive; relax a specific rule if a false positive blocks a legitimate server-resolved id.
- **Risk Level:** S2.
- **Complexity:** S.
- **Timeline:** **Wave 2** (lint) — checks already present.
- **Owner:** Platform/Security.
- **Dependencies:** A1 (eventually co-sources the GUC); TEN-002.
- **Success Criteria:** no client-sourced tenant id reaches a query without an ownership check (CI-enforced); RT-2 green.

### TEN-009 — `tenant-isolation-validator` + policy-lint — **TRANSITIONAL→CANONICAL**
- **Current State:** scans only `services/api-gateway/src/` (`:3`); inline-only regex (`:31`) misses the variable form; asserts guard-wrap + no god-mode/JWT-role bypass (`:48-68`).
- **Strategic State:** AST-based tenant-predicate detection; scans gateway + queue-workers + webhook-service; **forbids `CREATE POLICY … USING(true)` without `TO`+predicate**; asserts every tenant route uses the L3 helper (not the raw service client); asserts the escape hatch is audited.
- **Reasoning:** the guard's runtime fail-closed is good but the static gate must cover the same surface the runtime does, or workers/webhook drift unchecked (FND-014); a policy-lint is what permanently prevents the §5 class from reappearing.
- **Migration Plan:** extend scan globs; replace inline regex with an AST pass; add the SQL policy-lint over `database/supabase/migrations/`.
- **Validation Plan:** CI self-test: a deliberately unscoped worker query / a `USING(true)` policy fails the validator; a compliant one passes.
- **Deletion Plan:** the api-gateway-only scope is the thing removed.
- **Rollback Plan:** keep the old regex as a fallback assertion if the AST pass has false positives, while fixing.
- **Risk Level:** S2.
- **Complexity:** S.
- **Timeline:** **Wave 2**.
- **Owner:** Platform/Security.
- **Dependencies:** none hard.
- **Success Criteria:** validator covers all 3 services + SQL policies; AST-based; blocks `USING(true)` and raw-service-client-on-tenant-route.

### TEN-010 — Default-deny tenant middleware gate — **TRANSITIONAL→CANONICAL**
- **Current State:** `storeContext()`/`requireStoreOwner()` exist (`store-context.ts:74-95`, `rbac.ts:492-533`) but are applied ad-hoc per route; no global default-deny; ops routers use `.use('*', requireSuperAdmin)` but there is no equivalent fail-closed gate for merchant tenancy (FND-026).
- **Strategic State:** a router-level default-deny gate so a future route that forgets to resolve/own a tenant fails closed rather than open; merchant routes enforce `site_role_permissions` scopes (not just owner-coarse).
- **Reasoning:** discipline-dependent gating is the failure mode that L3 backstops, but L0 should still fail closed so the error surfaces as a 403, not a silent reliance on RLS.
- **Migration Plan:** add a default-deny tenant gate at the merchant router mount; enforce stored permission scopes on merchant routes (V1 §10 "enforce stored permission scopes").
- **Validation Plan:** test that a route mounted without a tenant resolver returns 403; staff-vs-owner scope test.
- **Deletion Plan:** the ad-hoc-only pattern removed.
- **Rollback Plan:** scope the gate per-router and roll back per-router if a legitimate public route is caught.
- **Risk Level:** S3.
- **Complexity:** M.
- **Timeline:** **Wave 3**.
- **Owner:** Platform/Security + Identity.
- **Dependencies:** A1 (claims), TEN-008.
- **Success Criteria:** no merchant route can omit tenancy and fail open; merchant scopes enforced.

### TEN-011 — store_id ↔ site_id + users/users_custom normalization (TD-7) — **LEGACY→delete after migration**
- **Current State:** dual `store_id`/`site_id` on high-value tables, forced equal by `sync_orders_tenant_keys` (`130:14-31`); guard accepts either column (`tenant-scoped.ts:60-61`); `orders` has no FK to `sites` (DB-015); `users`/`users_custom` split (`baseline:13095,13116`).
- **Strategic State:** `site_id` is the sole tenant key; `sites` the sole tenant table; `users_custom` canonical with `users` as a view; `store_id` demoted then dropped; sync trigger retired.
- **Reasoning:** the dual key is a permanent isolation ambiguity (a `store_id≠site_id` row can evade a single-column filter); normalization removes the ambiguity and simplifies every layer's predicate.
- **Migration Plan:** expand/contract — audit for `store_id≠site_id`; add `orders.store_id→sites` FK + backfill; make `site_id` authoritative; remove `store_id` from registry `scopeColumns`; demote `store_id` to generated/compat; later contract migration drops it; `users_custom` canonical + `users` view.
- **Validation Plan:** test no row has `store_id≠site_id`; RT-2 still green after the guard keys only on `site_id`; deletion validation that `store_id` is gone and unreferenced.
- **Deletion Plan:** `store_id` column dropped in the contract migration; sync trigger dropped; `users` becomes a view.
- **Rollback Plan:** keep `store_id` as a generated column for one release before the hard drop; the contract migration ships with a rollback that re-adds the column (data reconstructable from `site_id`).
- **Risk Level:** S2.
- **Complexity:** L.
- **Timeline:** **Wave 4** (deliberately *after* the isolation backbone so mistakes fail closed).
- **Owner:** DB-owning engineer.
- **Dependencies:** TEN-002 + TEN-004 (normalize under RLS protection).
- **Success Criteria:** single `site_id` tenant key everywhere; `store_id` dropped; `users` a view; guard + policies key on `site_id` only.

### TEN-012 — Ledger/audit immutability defense-in-depth (REVOKE + RESTRICT) — **CANONICAL (new)**
- **Current State:** ledger append-only is **trigger-only**; the corpus has **zero** `REVOKE` statements (DB-009) — a `BYPASSRLS`/owner role can `DISABLE TRIGGER` then mutate; `ledger_entries.site_id → sites ON DELETE CASCADE` (`139:128`) and broad CASCADE-to-sites on money/audit (DB-014/030) means a site delete semantically targets immutable history (saved only opaquely by the reject trigger).
- **Strategic State:** `REVOKE UPDATE, DELETE ON ledger_entries, ledger_transactions FROM PUBLIC, service_role`; money/audit FKs changed to `ON DELETE RESTRICT`; ledger tables owned by a no-login role; compat `*_ledger_entries` get the reject trigger (DB-010).
- **Reasoning:** isolation includes *integrity* of the tenant's money/audit history; relying on a trigger that the trusted role can disable is not defense-in-depth; this directly supports the A3 ledger-as-source-of-truth winner.
- **Migration Plan:** REVOKE migration; FK alter to RESTRICT; attach reject trigger to the 4 compat ledgers; reassign ownership.
- **Validation Plan:** test that UPDATE/DELETE on ledger raises even with triggers disabled (REVOKE blocks); test that deleting a site with ledger rows is RESTRICTed.
- **Deletion Plan:** n/a (additive hardening).
- **Rollback Plan:** re-grant + revert FK to prior on rollback (paired).
- **Risk Level:** S1.
- **Complexity:** S.
- **Timeline:** **Wave 2** (with the money track).
- **Owner:** Finance/Payments + DB-owning engineer.
- **Dependencies:** A3 money canonicalization.
- **Success Criteria:** ledger mutation impossible via privilege (not just trigger); site delete cannot cascade money/audit history.

---

## 11. Risk Register (program-level)

| ID | Risk | Sev | Likelihood | Mitigation | Owner |
|---|---|---|---|---|---|
| TR-1 | The 7 PUBLIC policies are exploited before Wave 0 ships (live anon leak) | **S0** | High if grants present (UNVERIFIED) | Wave-0 emergency migration + live probe **first**; do not gate on the cutover | Platform/Security |
| TR-2 | service_role→GUC cutover breaks reads that relied on bypass | S1 | Medium | S0 shadow/audit divergence detection before enforce; per-stage flag-flip rollback | Platform/Security |
| TR-3 | GUC sourced from a client-writable claim (A1 not yet asymmetric) → total bypass | S1 | Medium until A1 | Source GUC from ownership-verified siteId until A1; never `user_metadata` (AUTH-004) | Identity + Platform |
| TR-4 | FORCE on a table fails it closed → "empty feature" | S1 | Medium | Catch in shadow; positive-control tests; staged | DB-owning eng |
| TR-5 | Worker payload forge becomes client-reachable in a future change | S1 | Low (latent today) | Payload-vs-FK assertion + guard + GUC on workers (TEN-006); CI scan | Worker owners |
| TR-6 | TD-7 normalization corrupts the tenant key | S2 | Low-Med | Do it under RLS (Wave 4); expand/contract; audit `store_id≠site_id` first | DB-owning eng |
| TR-7 | A DEFINER money RPC re-introduces GUC-from-param | S1 | Low | Policy review + RT-6 in CI | Finance/Payments |
| TR-8 | Connection-pool exhaustion under transactional load | S2 | Low | Hyperdrive pool sizing; short tx; statement timeout; load test | Platform |
| TR-9 | Deploy meta-blocker (`main` behind fix branch, spine A0/TOPO-002) means even Wave-0 doesn't ship | S0 | Known | Fix pipeline/branch lag as the Wave-0 prerequisite (cross-program) | Platform |
| TR-10 | Policy-lint / validator false positives stall delivery | S3 | Medium | Annotated-exception mechanism; AST over regex | Platform/Security |

---

## 12. Wave Sequencing (this domain's slice of Waves 0–8)

- **Wave 0 (immediate, pre-merchant):** TEN-001 (delete 7 PUBLIC policies + `super_admin_allowlist` lockdown) · live anon probe · keep TEN-003 guard active · policy-lint added · *(cross-program prerequisite: fix the deploy meta-blocker so Wave 0 can actually ship — spine A0/TOPO-002).*
- **Wave 1 (architectural backbone):** TEN-002 (service_role→`app_tenant`+GUC, staged S-1→S3) · TEN-005 (kill GUC-from-param in money RPCs) · activate Hyperdrive. **Gates every "RLS is load-bearing" claim.** Depends on A1 for the validated claim (interim: ownership-sourced GUC).
- **Wave 2 (breadth + workers + integrity):** TEN-004 (FORCE+GUC on all 261) · TEN-006 (worker tenancy) · TEN-007 (webhook hardening) · TEN-008 (ownership adjacency lint) · TEN-009 (validator extension + AST) · TEN-012 (ledger REVOKE+RESTRICT) · nullable-tenant-column backfill.
- **Wave 3 (default-deny):** TEN-010 (default-deny tenant middleware + merchant scope enforcement).
- **Wave 4 (normalization):** TEN-011 (TD-7 store_id→site_id + users/users_custom), under RLS protection.
- **Waves 5–8:** regression hardening, performance tuning of the GUC path, escape-hatch audit review cadence, and the permanent cross-tenant red-team suite kept green as the platform grows (no new isolation architecture — V1 §"No new architecture documents").

---

## 13. UNVERIFIED / caveats

- **Live `anon`/`authenticated` GRANT state** for `products`/`orders`/`sites`/`super_admin_allowlist`/etc. is set by Supabase's managed bootstrap **outside this repo** and could not be run-verified from code. Strongly evidenced as present (`migrations/107:5-8` header + Supabase schema-wide defaults + **zero** `REVOKE` in the corpus), making the S0 leak live with high confidence — but the Wave-0 live probe (`\dp public.orders` / anon-key read) is required to assign *final* S0 confirmation and to confirm closure.
- **FND-010 worker forge is latent, not proven live:** no client-reachable path was confirmed that lets an attacker set `platform_queue_jobs.site_id`; outbox jobs are server-authoritative. The TEN-006 fix is defense-in-depth against a future regression, not closure of a proven live exploit.
- **Migration replay is non-deterministic** (DB-001/CI-8: `customers` FK target absent, dup-129, drifted baseline) and **CI never replays migrations against a fresh DB nor executes the verification SQL** (DB-021) — so the FORCE-rollout and policy migrations should be validated against an **ephemeral PG replay** added to CI as part of this work, not assumed to apply cleanly. The exact set of FORCE/ENABLE tables in the *live* DB may differ from the migration-derived counts until that replay exists.
- **Statement vs table counts** (ENABLE ≈429 stmts/392 tables; FORCE ≈47 stmts/41 tables) differ from the registry's 261 tenant tables due to dynamic `DO`-loop enables and idempotent re-enables; the **registry (261)** is the governing denominator for "every tenant table," but the precise per-table FORCE state should be confirmed on the live DB.
- **A1 dependency is hard for L3 correctness:** the GUC must be set from a *validated* tenant value. Today the role claim path leaks a client-writable `user_metadata` fallback (`auth.ts:182`, AUTH-004) and tokens are symmetric HS256 with a shared `AUTH_SECRET` across 7 trust domains (AUTH-002). Until A1 makes identity the sole asymmetric issuer, the GUC must be sourced from the **ownership-verified** siteId (L2), never from a raw token claim — this is stated as an explicit interim control in TEN-002/TEN-008.

---

## 14. Tenant Isolation Canonicalization Findings/Actions

| ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line) |
|---|---|---|---|---|---|---|
| TEN-001 | 7 baseline `USING(true)`→PUBLIC policies + `super_admin_allowlist` | Delete; recreate `TO service_role`+owner; lock allowlist writes; policy-lint | **DEAD** | 0 | S0 | `000_baseline.sql:26571,26627,26669,26690,26718,26725,26739`; consumed `rbac.ts:215-233` |
| TEN-002 | service_role default connection → `app_tenant` RLS-subject + `SET LOCAL` GUC | Stop blanket service_role for tenant data; staged cutover; hatch-only service_role | **CANONICAL (new)** / service_role **TRANSITIONAL→FROZEN-narrow** | 1 | S1 | `supabase-adapter/index.ts:34-39`; `migrations/107:17-19`; `tenant-core/src/index.ts:590-595`; `tenant-context.ts:58-60` |
| TEN-003 | App-layer query-lint guard (`createTenantGuardedSupabaseClient`/`tenantScoped`) | Keep as permanent OUTER layer; default-deny non-registry; split tenant vs owner predicate | **CANONICAL (permanent)** | 0 (keep) / 2 (tighten) | S2 | `tenant-scoped.ts:79-124,60-61,119`; `tenant-isolation-validator.mjs:48-52` |
| TEN-004 | FORCE+GUC on all 261 tenant tables | Registry-driven backfill; ENABLE/FORCE first, GUC policies; backfill nullable keys | **CANONICAL (extend)** | 2 | S1 | FND-009; `tenant-core/src/index.ts:553`; nullable cols `baseline:1217,1233` |
| TEN-005 | DEFINER money RPCs setting `app.site_id` from a param | Derive site from authenticated principal; drop backfill fn; allow-list mirror table | **LEGACY→fix (DEAD pattern)** | 1 | S1 | `migrations/151:18`; `160:279-355`; `131:49-52` (DB-011/012/013) |
| TEN-006 | queue-workers raw service client + payload `site_id` | Wrap in guard; `withTenantTx` GUC; assert payload vs row FK; add to CI scan | **TRANSITIONAL→CANONICAL** | 2 | S1 | `platform-queue-consumer.ts:316,456`; `tenant-isolation-validator.mjs:3` |
| TEN-007 | webhook-service global order lookup by `payment_id` | Keep cross-tenant lookup; HMAC-before-DB; bind by `(gateway, provider_payment_id)` unique | **TRANSITIONAL (accepted, hardened)** | 2 | S2 | `webhook-service/src/index.ts:319`; unique `107:135`,`142:148` |
| TEN-008 | Ownership checks (`verifySiteOwnership`/`verifyStoreOwnership`) | Keep as permanent VALUE layer; CI lint requiring ownership adjacency to client ids | **CANONICAL (permanent)** | 2 | S2 | `auth-user.ts:40-67`; `products.ts:459`; `orders.ts:557,970`; FND-012 |
| TEN-009 | `tenant-isolation-validator` + policy-lint | AST predicate check; scan all 3 services; forbid `USING(true)`; assert no raw service client on tenant routes | **TRANSITIONAL→CANONICAL** | 2 | S2 | `tenant-isolation-validator.mjs:3,31,48-68` |
| TEN-010 | Default-deny tenant middleware gate | Router-level fail-closed tenancy; enforce `site_role_permissions` on merchant routes | **TRANSITIONAL→CANONICAL** | 3 | S3 | `store-context.ts:74-95`; `rbac.ts:492-533`; FND-026 |
| TEN-011 | `store_id`↔`site_id` + `users`↔`users_custom` (TD-7) | Normalize to `site_id`/`users_custom`; expand/contract; drop `store_id`; retire sync trigger | **LEGACY→delete after migration** | 4 | S2 | `baseline:10112,10139,13095,13116`; `130:14-31`; `tenant-scoped.ts:60-61` |
| TEN-012 | Ledger/audit immutability defense-in-depth | `REVOKE UPDATE,DELETE`; FKs `ON DELETE RESTRICT`; reject trigger on compat ledgers | **CANONICAL (new)** | 2 | S1 | `139:128,358-376`; zero REVOKE (DB-009); CASCADE `139:128,151:150,140:23` |
| TEN-013 | Permanent cross-tenant red-team suite (RT-1…RT-9) | Standing CI security suite asserting real denial (positive-control + negative) | **CANONICAL (new)** | 0→permanent | n/a (control) | `tests/executable/security-rls-hardening-postgres.test.mjs`; `money-ledger-postgres.test.mjs:257-264` |

**Classification counts:** DEAD ×1 (+the GUC-from-param *pattern* inside TEN-005) · CANONICAL ×7 (TEN-002 new, TEN-003 permanent, TEN-004 extend, TEN-008 permanent, TEN-012 new, TEN-013 new; service_role within TEN-002 is TRANSITIONAL→FROZEN-narrow) · TRANSITIONAL→CANONICAL ×4 (TEN-006, TEN-009, TEN-010; TEN-007 stays TRANSITIONAL-accepted) · LEGACY→fix/delete ×2 (TEN-005, TEN-011) · FROZEN-narrow ×1 (service_role escape hatch, inside TEN-002).

**Wave-0 immediate (before merchant #1):** TEN-001 (delete the 7 PUBLIC policies + lock `super_admin_allowlist`) · the live anon-grant probe · keep the app-guard active · add the `USING(true)` policy-lint · stand up the cross-tenant red-team suite (TEN-013) · cross-program prerequisite: fix the deploy meta-blocker (spine A0) so Wave 0 can actually ship.

*End of `TENANT_ISOLATION_CANONICALIZATION_PLAN.md`.*
