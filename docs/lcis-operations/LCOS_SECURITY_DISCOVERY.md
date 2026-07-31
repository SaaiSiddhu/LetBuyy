# LCOS Security Discovery

> **LCOS = LetBuyy Cloud Operating System (read-only observation layer)**
>
> This document is OBSERVATION ONLY. LCOS never mutates state.
>
> **Data freshness:** `security-intelligence-v5.json` generated `2026-06-14T05:53:49Z`; `db-intel.json` generated `2026-06-15T10:40:05Z`. Re-run `pnpm graph:v5` to refresh.
>
> **Connectivity legend:**
> - **DETECTABLE** — derivable from `graphify-out/` JSON artifacts with no live system
> - **PARTIAL** — structure known from artifacts; some fields require a live query to confirm
> - **NOT_CONNECTED** — live value; exact source (env var / API / log stream) is stated

---

## 1. Trust Boundaries

Source: `graphify-out/security-intelligence-v5.json` → `trustBoundaries` array (5 entries).

| # | From | To | Control Mechanism | LCOS Status |
|---|------|----|-------------------|-------------|
| 1 | Public internet | `storefront-runtime` | Turnstile bot gate + customer HS256 session (`CUSTOMER_SESSION_SECRET`) | DETECTABLE — Turnstile integration point is structurally present in code; live pass/fail rates NOT_CONNECTED (`Cloudflare Turnstile Analytics API`) |
| 2 | Customer session | Money RPCs | Server-authoritative totals + `SECURITY DEFINER` RPC (no client-supplied amounts) | DETECTABLE — 34 money RPCs tracked in `db-intel.json`; 30 of 34 are `SECURITY DEFINER` (4 are not — see §2) |
| 3 | Merchant session | Refunds / payouts | ES256 (`LETBUYY_IDENTITY_PUBLIC_JWKS`) + step-up HMAC second factor (`STEP_UP_SIGNING_SECRET`) | PARTIAL — token algorithm is structurally known; actual ES256 key presence and step-up challenge live state NOT_CONNECTED (`LETBUYY_IDENTITY_PUBLIC_JWKS` env var / Supabase `step_up_challenges` table) |
| 4 | Gateway service-role | Tenant tables | `verifySiteOwnership` must precede service-role DB access | PARTIAL — `verifySiteOwnership` call sites are structurally traceable; runtime enforcement per-request NOT_CONNECTED (Cloudflare Worker logs / `wrangler tail letbuyy-api`) |
| 5 | Queue job | Tenant data | `signQueueTenantEnvelope` HMAC (`QUEUE_TENANT_ENVELOPE_SECRET`) | PARTIAL — signing call site is structurally present; live envelope validation rate NOT_CONNECTED (Cloudflare Queue Analytics / Worker logs) |

**Boundaries requiring live traffic analysis (NOT_CONNECTED):**
All 5 trust boundaries are structurally mapped. Enforcement confidence for boundaries 3–5 at runtime requires live signals from Cloudflare Worker logs or Supabase audit logs — neither is wired to a LCOS adapter today. The `SupabaseAdapter` (`packages/lcis-adapters/src/supabase/SupabaseAdapter.ts`) and `CloudflareAdapter` would supply live policy and log facts if `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ACCESS_TOKEN` (Management API) and Cloudflare credentials are present.

---

## 2. The 11 Security Controls

Source: `graphify-out/security-intelligence-v5.json` → `controls` object (11 keys, all `present: true`).

| Control Name | Type | LCOS Status | Source / Evidence |
|---|---|---|---|
| `jwt` | Token issuance | DETECTABLE | Two-issuer model structurally confirmed. Env vars `CUSTOMER_SESSION_SECRET` (HS256) and `LETBUYY_IDENTITY_PUBLIC_JWKS` (ES256) are named in `security-intelligence-v5.json`. Key presence NOT_CONNECTED — see §6 |
| `oauth` | Merchant identity | DETECTABLE | Identity-platform JWKS wiring structurally present; developer-portal OAuth/PKCE frozen (ARB required to activate) |
| `pkce` | Developer OAuth | PARTIAL | Declared present in `controls.pkce`; inactive — `"developer-portal OAuth/PKCE (frozen — ARB to activate)"`. Live activation state NOT_CONNECTED |
| `rls` | Row-level security | DETECTABLE | 651 policies tracked in `security-intelligence-v5.json` (658 in fresher `db-intel.json`); 39/47 FORCE tables; `no-public-using-true-validator` is one of 5 deterministic validators |
| `turnstile` | Bot gate | PARTIAL | Integration point structurally identified on registration/login routes. Live Turnstile pass/fail rates NOT_CONNECTED (`TURNSTILE_SECRET_KEY` / Cloudflare Turnstile Analytics API) |
| `webhookHmac` | Webhook integrity | DETECTABLE | Razorpay HMAC-SHA256 verified server-side (`timingSafeEqualHex`); webhook signature tables structurally present (`webhook_deliveries`, `payment_webhook_events`). Live verification counts NOT_CONNECTED (Worker logs) |
| `queueHmac` | Queue integrity | DETECTABLE | `signQueueTenantEnvelope` structurally identified in code graph; secret named as `QUEUE_TENANT_ENVELOPE_SECRET`. Live envelope success rate NOT_CONNECTED (Cloudflare Queue Analytics) |
| `secrets` | Secret management | PARTIAL | 19 production secrets declared (`wrangler secret put`). Secret names known from artifact; live presence/rotation dates NOT_CONNECTED (Cloudflare Secrets API / Vercel env vars) |
| `permissions` | RBAC | DETECTABLE | `employee_permissions` / `employee_roles` tables structurally present; RBAC routes structurally identified (`operations/rbac`). Live enforcement per request NOT_CONNECTED |
| `roles` | Role tables | DETECTABLE | `operations/rbac` + role tables structurally present and tracked in `domain-intel.json` |
| `stepUp` | Step-up auth | PARTIAL | HMAC step-up gating refunds/payouts structurally declared; `step_up_challenges` and `sensitive_action_approvals` tables in `db-intel.json` (both in the 20-table tenant-without-RLS list — see §5). Live challenge issuance rate NOT_CONNECTED (Supabase `step_up_challenges` table) |

**Deterministic validators governing controls (from `security-intelligence-v5.json`):**
1. `canonical-ledger-only` — forbids `.from(money_table).insert/update` in TS
2. `rls-force-coverage` — all tenant tables must have RLS
3. `no-public-using-true` — forbids `USING (true)` on non-service-role policies
4. `no-blanket-service-role` — service-role access must be gated
5. `identity-sole-issuer` — identity-platform is the sole merchant token issuer

---

## 3. Two-Issuer Auth Model

Source: `security-intelligence-v5.json` → `base.identity.issuers` and `base.jwt`.

### Issuers

| Issuer | Algorithm | Token Function | Env Var | LCOS Status |
|--------|-----------|----------------|---------|-------------|
| Customer | HS256 | `issueCustomerSession` | `CUSTOMER_SESSION_SECRET` | PARTIAL — call site structurally identified; secret presence NOT_CONNECTED (Cloudflare Workers secret store) |
| Merchant | ES256 | identity-platform JWKS | `LETBUYY_IDENTITY_PUBLIC_JWKS` | PARTIAL — JWKS URL structurally named; live JWKS endpoint reachability NOT_CONNECTED (identity-platform `/well-known/jwks.json` endpoint) |

### JWT Secrets Used Across Auth Domain

From `security-intelligence-v5.json → base.jwt.secrets`:
- `AUTH_SECRET`
- `CUSTOMER_SESSION_SECRET`
- `STEP_UP_SIGNING_SECRET`
- `LETBUYY_IDENTITY_PUBLIC_JWKS`

These appear alongside Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), CSRF secret, and Turnstile secret in the authentication domain routes.

### Step-Up HMAC (Refunds / Payouts)

- Control: second-factor HMAC gate on refund and payout RPCs
- Secret: `STEP_UP_SIGNING_SECRET`
- Affected tables: `step_up_challenges`, `sensitive_action_approvals` (both are tenant-scoped tables; both appear in the 20-table tenant-without-detected-RLS list from `db-intel.json` — see §5)
- LCOS status: PARTIAL structurally; live challenge issuance and pass rate NOT_CONNECTED (Supabase `step_up_challenges` table — requires `SUPABASE_ACCESS_TOKEN`)

### What Is Structurally Verifiable vs Live

| Question | Structurally DETECTABLE | Requires Live (NOT_CONNECTED) |
|----------|------------------------|-------------------------------|
| Which algorithm per issuer | YES — HS256 / ES256 named in artifact | — |
| Secret names | YES — named in `security-intelligence-v5.json` | — |
| Secret presence / rotation dates | NO | Cloudflare Secrets API / Vercel env var list |
| JWKS endpoint reachability | NO | `LETBUYY_IDENTITY_PUBLIC_JWKS` URL probe |
| Token issuance volume | NO | Worker logs (`wrangler tail`) / Supabase auth logs |
| Cross-issuer token usage (customer token used on merchant route) | NO | Auth middleware logs per-request |
| Step-up challenge pass rate | NO | Supabase `step_up_challenges` table |

---

## 4. Abuse Protection

### Turnstile Integration Points

Source: `security-intelligence-v5.json` → `controls.turnstile.detail` and `base.jwt.domains[0]` (authentication domain).

- Gate is declared on **registration and login routes** (`storefront/customer-registration` and auth domain)
- Secret key named: `TURNSTILE_SECRET_KEY` (present in authentication domain secrets list in artifact)
- Worker carrying the gate: `letbuyy-api` (authentication routes)
- LCOS status: DETECTABLE structurally (code graph confirms integration point); live pass/fail rates NOT_CONNECTED

**NOT_CONNECTED — Turnstile live metrics:**
- Pass rate: NOT_CONNECTED → Cloudflare Turnstile Analytics API (requires Cloudflare API token with Turnstile read permission)
- Challenge issuance count: NOT_CONNECTED → same source
- Failed verification volume: NOT_CONNECTED → Cloudflare Worker logs / `wrangler tail letbuyy-api`

### Rate-Limit Coverage

Source: `security-intelligence-v5.json` → `controls.jwt.detail` and `base.jwt.domains[0]` (mentions `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).

- Rate-limit infra: Upstash Redis (env vars `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` present in authentication domain secrets)
- Routes with rate-limit coverage: structurally associated with the authentication domain (`auth` routes); specific per-route rate-limit config is not individually named in the artifact — the artifact identifies the infra but not per-route limits

**NOT_CONNECTED — rate-limit live metrics:**
- Current hit counts per route: NOT_CONNECTED → Upstash Redis (REST API at `UPSTASH_REDIS_REST_URL`)
- Rate-limit breach events: NOT_CONNECTED → Upstash Redis key scan or Worker logs
- Remaining quota per window: NOT_CONNECTED → Upstash Redis

The `SupabaseAdapter` does not cover Upstash. A dedicated UpstashAdapter would be needed in `packages/lcis-adapters/` to surface live rate-limit metrics.

---

## 5. RLS & Multi-Tenancy Risk Surfaces

### Policy Counts from `db-intel.json` (generated 2026-06-15)

| Field | Count | Notes |
|-------|-------|-------|
| Total policies | 658 | Fresher than `security-intelligence-v5.json` (651); use 658 as authoritative |
| `public=true` | 34 | Allow any role; samples: `anyone_read_plans` (plans), `anyone_read_roles` (employee_roles), `public_view_endorsements` (skill_endorsements) |
| `serviceRole=true` | 279 | Elevated privilege; gated by `no-blanket-service-role` validator |
| `usesSiteId=false` | 509 | Does not reference the tenant discriminator in the USING clause |
| FORCE RLS tables | 47 | (`forceRlsTables` in `db-intel.json`) |
| Total tenant tables | 256 | |
| Tenant tables without detected RLS | 20 | Listed below |
| Policies on tenant tables | 417 | |
| — with `usesSiteId=true` | 132 | Confirmed tenant-scoped |
| — with `usesSiteId=false` | 285 | Policy exists but tenant discriminator NOT detected in USING clause |
| — with `serviceRole=true` | 166 | Service-role scoped on tenant tables |
| — with `public=true` | 15 | Public policies on tenant tables — highest risk surface |

**LIMITATION (from `SecurityDriftService.ts` source comments):** The `public` / `usesSiteId` / `serviceRole` boolean fields in `db-intel.json` are heuristic. The USING-clause SQL text is NOT present in the artifact. A `public=true` policy on `plans` for anonymous product-catalogue reads may be intentional. Human review is required for each of the 34 public policies. The `no-public-using-true-validator` (deterministic gate) is the authoritative control — the artifact booleans are advisory candidates.

### 20 Tenant Tables Without Detected RLS

From `db-intel.json → summary.tenantTablesWithoutRls`:

```
compensation_actions    outbox_consumptions      ledger_accounts
ledger_transactions     ledger_entries           settlements
reserves                payouts                  payout_items
recon_breaks            billing_mandates         merchant_billing_invoices
billing_dunning_events  billing_usage_events     consents
store_credit            store_credit_ledger_entries  customer_dsr_exports
step_up_challenges      sensitive_action_approvals
```

These 20 tables also appear as `crossTenantCandidates` in `security-intelligence-v5.json`. Several (`ledger_accounts`, `ledger_transactions`, `ledger_entries`, `settlements`, `payouts`, `payout_items`) are money tables. Two (`step_up_challenges`, `sensitive_action_approvals`) underpin the step-up auth control.

**IMPORTANT:** The `rls-force-coverage-validator` is declared as authoritative. Whether RLS is truly absent at the DB layer (vs. detected but not indexed by graphify) can only be confirmed via a live Supabase Management API call (`SUPABASE_ACCESS_TOKEN` required) using the `SupabaseAdapter.checks()` path — specifically the `missing-rls` check at line 329 of `packages/lcis-adapters/src/supabase/SupabaseAdapter.ts`.

### 4 Money Functions NOT SECURITY DEFINER

From `db-intel.json` (cross-checked with `SecurityDriftService.findPublicMutations()`):

| Function | Risk |
|----------|------|
| `sync_order_items_store_id` | Runs with caller privileges — not the function owner |
| `enforce_ledger_transaction_balance` | Ledger integrity function without SECURITY DEFINER |
| `ledger_balance_breaks` | Ledger audit function without SECURITY DEFINER |
| `sync_order_items_site_id` | Runs with caller privileges |

These 4 functions violate Rule R001 (canonical-ledger-only model). 30 of 34 money functions are correctly `SECURITY DEFINER`.

### Cross-Tenant Candidate Count

`security-intelligence-v5.json → crossTenantCandidates`: **20 tables** (list matches the tenant-without-RLS list above exactly).

`security-intelligence-v5.json → privilegeEscalationSurface`:
- `serviceRolePolicies`: 275 (vs. 279 in fresher `db-intel.json`)
- `securityDefinerFns`: 128 (vs. 136 in fresher `db-intel.json`)
- Note: "SECURITY DEFINER + service-role are the privilege-elevation points; they must be gated by verifySiteOwnership / step-up"

### SecurityDriftService Interface (from `packages/lcis-governance/src/security/SecurityDriftService.ts`)

The service provides 8 structural checks (all static, no live probes):

| Method | What It Detects |
|--------|-----------------|
| `findMissingRLS()` | Tenant tables with `rls=false` (R002 violation) |
| `findDangerousPolicies()` | Policies with `public=true` — all 34 surfaced |
| `findPublicMutations()` | Money functions without `SECURITY DEFINER` — 4 found |
| `findCrossTenantRisks()` | (a) Tenant tables without `hasSiteId`; (b) policies on tenant tables with `usesSiteId=false` |
| `findMissingValidation()` | Money functions missing `hasIdempotency` or `forUpdate` lock |
| `findMissingAuth()` | Heuristic: public policies on sensitive tables (confidence 0.4); middleware auth not in artifacts (confidence 0.3) |
| `findMissingSecurityTests()` | Domains without security/auth/RLS test nodes in the 52k-node graph |
| `findSensitiveDomainViolations()` | Money domains aggregating critical/high findings from the above |
| `generateSecurityDriftReport()` | Full report envelope with findings, byKind counts, governance evidence |

All findings are grounded in `graphify-out/db-intel.json` and `graphify-out/domain-intel.json` boolean fields. No SQL text is inspected. All live signals are NOT_CONNECTED per the service's honesty contract.

---

## 6. Connectivity Table

| Control / Signal | Status | Source / Env Var |
|-----------------|--------|-----------------|
| JWT secret — customer (`CUSTOMER_SESSION_SECRET`) | NOT_CONNECTED | Cloudflare Workers secret store (`wrangler secret list`) |
| JWT secret — merchant (`LETBUYY_IDENTITY_PUBLIC_JWKS`) | NOT_CONNECTED | Cloudflare Workers secret store / identity-platform deployment |
| JWKS endpoint reachability | NOT_CONNECTED | identity-platform `/well-known/jwks.json` live probe |
| Step-up signing secret (`STEP_UP_SIGNING_SECRET`) | NOT_CONNECTED | Cloudflare Workers secret store |
| Turnstile secret key (`TURNSTILE_SECRET_KEY`) | NOT_CONNECTED | Cloudflare Workers secret store |
| Turnstile pass/fail rate | NOT_CONNECTED | Cloudflare Turnstile Analytics API |
| Rate-limit infra presence (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | NOT_CONNECTED | Upstash Redis REST API |
| Rate-limit live hit counts | NOT_CONNECTED | Upstash Redis key scan (`UPSTASH_REDIS_REST_URL`) |
| RLS enforcement on 20 tenant tables | NOT_CONNECTED | Supabase Management API (`SUPABASE_ACCESS_TOKEN` → `GET /v1/projects/{ref}/database/policies`) — `SupabaseAdapter.checks()` path |
| 34 public policies — USING-clause SQL text | NOT_CONNECTED | Supabase Management API (`SUPABASE_ACCESS_TOKEN` → `GET /v1/projects/{ref}/database/policies`) — `livePolicies[].definition` field |
| Live policy drift (live vs. graph) | NOT_CONNECTED | `SupabaseAdapter` requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_ACCESS_TOKEN` |
| Cross-tenant candidates — live isolation test | NOT_CONNECTED | Supabase Management API (policy USING-clause inspection) |
| Live auth events (token issuance, step-up challenges) | NOT_CONNECTED | Supabase auth logs or `step_up_challenges` table (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) |
| Abuse event counts (failed logins, Turnstile failures) | NOT_CONNECTED | Cloudflare Worker logs (`wrangler tail letbuyy-api`) |
| Webhook HMAC verification rate | NOT_CONNECTED | Cloudflare Worker logs (`wrangler tail letbuyy-webhook`) |
| Queue envelope HMAC success rate | NOT_CONNECTED | Cloudflare Queue Analytics or `wrangler tail letbuyy-queue-workers` |
| Structural security posture (8 drift checks) | DETECTABLE | `SecurityDriftService.generateSecurityDriftReport()` → sources: `graphify-out/db-intel.json`, `graphify-out/domain-intel.json` |
| Trust boundary map (5 boundaries) | DETECTABLE | `graphify-out/security-intelligence-v5.json → trustBoundaries` |
| 11 controls — presence declared | DETECTABLE | `graphify-out/security-intelligence-v5.json → controls` (all 11 `present: true`) |
| 4 non-SECURITY-DEFINER money functions | DETECTABLE | `graphify-out/db-intel.json → functions` (confirmed: `sync_order_items_store_id`, `enforce_ledger_transaction_balance`, `ledger_balance_breaks`, `sync_order_items_site_id`) |
| 34 public policies — structural presence | DETECTABLE | `graphify-out/db-intel.json → summary.publicPolicies` |
| 20 cross-tenant candidate tables | DETECTABLE | `graphify-out/db-intel.json → summary.tenantTablesWithoutRls` and `security-intelligence-v5.json → crossTenantCandidates` |

### To Connect Live Security Signals

Minimum credential set needed to unlock NOT_CONNECTED controls:
1. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → PostgREST table list + `SupabaseAdapter` health probe
2. `SUPABASE_ACCESS_TOKEN` → Supabase Management API (live policies, migrations, functions) — unlocks `SupabaseAdapter.checks()` for missing-RLS, dangerous-policy, schema-drift, broken-migration, orphan-RPC findings
3. Cloudflare API token → `CloudflareAdapter` (Worker logs, Queue analytics, Turnstile stats)
4. `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → rate-limit coverage (requires new UpstashAdapter — not yet in `packages/lcis-adapters/`)

---

*Generated 2026-06-21. LCOS READ-ONLY — no state was mutated in producing this document. Re-run `pnpm graph:v5` to refresh underlying artifacts before next revision.*
