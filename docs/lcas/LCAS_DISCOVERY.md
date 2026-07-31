# LCAS Discovery — Live Connectivity & Adapter System (Phase 9)

**Date:** 2026-07-04 · Every claim below was verified against the real repository this session.

## 1. Verdict: the Live Adapter SDK already exists — LCAS composes, never rebuilds

`packages/lcis-adapters` (Phase 3) already implements most of the Phase 9 mandate:

| Mandated component | Status | Where (verified) |
|---|---|---|
| Live Adapter SDK | ✅ EXISTS | `src/shared/contracts.ts` (`LiveAdapter`: metadata/health/collect/verify) + `src/shared/base.ts` (`AdapterBase` — honesty baked in: missing creds → NOT_CONNECTED + exact env vars) |
| Credential Manager | ✅ EXISTS | `src/shared/credentials.ts` (`CredentialProvider` — presence-only; values never enter LCIS output) |
| Health Monitor | ✅ EXISTS | `src/shared/health-monitor.ts` (`AdapterHealthMonitor` — status/success-rate/latency) |
| Rate Limiter | ✅ EXISTS | `src/shared/rate-limit.ts` (`RateLimitManager` — token bucket, injectable clock) |
| Snapshot Engine | ✅ EXISTS | `src/shared/snapshot-store.ts` (`SnapshotStore` — TTL-bounded, no permanent copy of the source of truth) |
| Observability (audit) | ◐ PARTIAL | `src/shared/audit.ts` (`AuditLogger` — op trail, never logs credentials); no per-op metrics |
| Read-only guarantee | ✅ EXISTS + ENFORCED | `src/shared/http.ts` — `ReadOnlyHttpClient` exposes **GET only** to a host allowlist; mutation is unrepresentable. `test/contract.test.ts` recursively scans **all** of `src/` (comments/strings stripped): raw `fetch(` allowed only in `shared/http.ts`; forbids child_process/spawn/exec/eval/new Function/write primitives. **New adapter files are automatically covered.** |
| Adapter Registry | ❌ MISSING | — |
| Signal Registry | ❌ MISSING | — |
| Webhook Registry | ❌ MISSING | — |
| Polling Framework | ❌ MISSING | — |
| Retry Policies | ❌ MISSING | — |
| Caching (read-through) | ◐ PARTIAL | SnapshotStore is the store; no read-through wrapper |

## 2. Existing adapters (must not be duplicated)

| Adapter | requiredEnv | Capabilities (verified from `metadata()`) |
|---|---|---|
| `supabase` | SUPABASE_URL + key | status, tables, policies, migrations, drift, health |
| `github` | GITHUB_TOKEN, GITHUB_REPOSITORY | health, pr, issue, release, deployment, workflows (summary-level: failed-workflow findings) |
| `cloudflare` | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | status, workers (scripts list), queues (list), routes, kv, r2 (bucket list) — **inventory level** |
| `vercel` | VERCEL_TOKEN (+optional VERCEL_TEAM_ID) | status, deployments, domains, projects, functions |

## 3. Consumer surface

`packages/lcis-live/src/factory.ts::defaultAdapters()` constructs the 4 adapters with `FetchHttpClient` host allowlists (api.github.com / api.cloudflare.com / api.vercel.com / supabase hosts) and `LivePlatform` consumes only the `LiveAdapter` contract with an `adapters?` injection point — **new adapters slot in additively without breaking lcis-live**.

## 4. Adapter pattern (from `VercelAdapter`, mirrored by all)

`metadata()` (name/displayName/requiredEnv/capabilities/sourceOfTruth) → `probe()` (one GET, zod-validated) → `gather()` (GETs, zod schemas in `./types.ts`, normalized `LiveFact[]`, evidence per read, confidence cap ≤0.95 with honest pagination caveats) → `checks(payload)` (deterministic `VerificationFinding[]`). Tests: `MockHttpClient` canned routes + `CredentialProvider` with fake env + fixed clock; NOT_CONNECTED path asserted first.

**Bug found during discovery (same class as the GitHubAdapter fix on 2026-07-04):** `VercelAdapter.checks()` line 228 reads the wall clock via `Date.now()` instead of the injected `this.now()` — a determinism time bomb. Fixed in Phase 9.

## 5. Phase 9 scope decision (anti-duplication)

**Foundation (additive `src/shared/` services):** `registry.ts` (AdapterRegistry — duplicate names throw), `signals.ts` (SignalRegistry — the honest NOT_CONNECTED→CONNECTED map: signal → providing adapter → requiredEnv → live connection state), `webhooks.ts` (WebhookRegistry — read-only *descriptors* of webhook surfaces; no server), `polling.ts` (caller-driven deterministic `tick()` scheduler — no setInterval), `retry.ts` (deterministic backoff policy + injectable sleep), `cache.ts` (read-through over SnapshotStore), `observability.ts` (per-op metrics over the audit trail).

**14 new adapters, scoped to NOT overlap the 4 existing (deep vs inventory):**

| # | Adapter | Transport (GET-only) | requiredEnv | Distinct scope |
|---|---|---|---|---|
| 1 | `github-actions` | api.github.com | GITHUB_TOKEN, GITHUB_REPOSITORY | workflows list, runs, jobs, artifacts (deep CI; existing github = repo events) |
| 2 | `postgres` | api.supabase.com (management API) | SUPABASE_MGMT_TOKEN, SUPABASE_PROJECT_REF | database health/config/version (deep DB engine; existing supabase = schema via PostgREST) |
| 3 | `redis` | Upstash REST | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | read-only command allowlist (DBSIZE/INFO-class) |
| 4 | `docker` | Docker Engine HTTP API | DOCKER_API_URL | containers/images/info/version |
| 5 | `kubernetes` | K8s apiserver | KUBE_API_URL, KUBE_TOKEN | version/namespaces/pods/deployments |
| 6 | `stripe` | api.stripe.com | STRIPE_SECRET_KEY | account/balance/webhook-endpoints (read) |
| 7 | `razorpay` | api.razorpay.com | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | payments/settlements/orders lists (read) |
| 8 | `analytics-engine` | api.cloudflare.com | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | AE dataset/binding inventory via script settings; **query values honestly NOT_CONNECTED (AE SQL API is POST-only — unrepresentable in the GET-only client; cited as such)** |
| 9 | `email` | api.resend.com | RESEND_API_KEY | domains + verification status |
| 10 | `storage` | api.cloudflare.com | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | per-R2-bucket detail (existing cloudflare = bucket list only) |
| 11 | `workers` | api.cloudflare.com | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | per-script settings/deployments/subdomain (deep; existing = scripts list) |
| 12 | `queues` | api.cloudflare.com | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | per-queue detail + consumers (deep; existing = queue list) |
| 13 | `cron` | api.cloudflare.com | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | per-script cron schedules |
| 14 | `realtime` | supabase host | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or anon | realtime health endpoint; channel metrics honestly NOT_CONNECTED |

Total after Phase 9: **18 adapters** in one registry. LCIS remains an observer — never the source of truth.

## 6. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-adapters` (turbo). Baseline: 172/172. Target: +300 or more new tests (foundation ~85, ~15–20 per adapter). The existing `contract.test.ts` read-only scan extends automatically to every new file.
