# LCAS Architecture — Live Connectivity & Adapter System (Phase 9)

**Package:** `packages/lcis-adapters` (`@letbuyy/lcis-adapters`)
**Date verified:** 2026-07-04. Every claim was read directly from source; no inference.

---

## 1. Purpose

LCAS is the read-only observation boundary between LCIS and its external sources of truth
(Supabase, GitHub, Cloudflare, Vercel, Razorpay, Stripe, and nine others). It normalises live
facts, cites their source, and reports honest connectivity status. It is never the source of
truth, never mutates anything, and never fabricates a value.

---

## 2. The `LiveAdapter` Contract

Defined in `src/shared/contracts.ts`. Every adapter implements exactly these four methods and
no others:

```typescript
export interface LiveAdapter {
  metadata(): AdapterMetadata;
  health(): Promise<HealthResult>;
  collect(): Promise<AdapterSnapshot>;
  verify(): Promise<AdapterVerification>;
}
```

`metadata()` is synchronous and returns a stable description. The other three are
asynchronous and read-only. There is no write or mutation path on the interface.

### Key types (all fields `readonly`)

| Type | Purpose |
|---|---|
| `AdapterMetadata` | `name` / `displayName` / `requiredEnv` / `capabilities` / `sourceOfTruth` |
| `AdapterStatus` | `'CONNECTED' \| 'NOT_CONNECTED' \| 'ERROR' \| 'DEGRADED'` |
| `HealthResult` | Status + `latencyMs` + `missingEnvVars` + `checkedAt` + `evidence` |
| `AdapterSnapshot<T>` | `status` + `confidence` (0..1) + `payload` + `ttlMs` + `evidence` |
| `AdapterVerification` | `status` + `findings: VerificationFinding[]` + `evidence` |
| `LiveFact` | Normalised observed fact: `adapter` / `kind` / `subject` / `detail` / `at` / `evidence` |
| `VerificationFinding` | `kind` / `severity` / `subject` / `detail` / `evidence` |
| `Severity` | `'critical' \| 'high' \| 'medium' \| 'low' \| 'info'` |

---

## 3. The Honesty Model — `AdapterBase`

`src/shared/base.ts` implements `LiveAdapter` with the honesty model baked in as a
non-overridable invariant. Subclasses implement only four abstract methods:

```typescript
abstract metadata(): AdapterMetadata;
protected abstract probe(): Promise<void>;
protected abstract gather(): Promise<GatherResult>;
protected abstract checks(payload: unknown): Promise<readonly VerificationFinding[]>;
```

The base class enforces:

- **Credentials absent → `NOT_CONNECTED`** — `health()` and `collect()` both check
  `CredentialProvider.check(requiredEnv)` first. If any required var is missing, they return
  `NOT_CONNECTED` with `missingEnvVars` listing the exact names and `confidence: 0`. Neither
  `probe()` nor `gather()` is ever called.
- **Confidence cap at 0.95** — `collect()` calls `Math.min(g.confidence, 0.95)` on the
  value returned by `gather()`. Structural/observed facts can never claim full certainty.
- **`NOT_CONNECTED` for missing creds is cached; `ERROR` is not** — `ReadThroughCache`
  stores `NOT_CONNECTED` and `CONNECTED` snapshots (credential presence rarely changes
  mid-process). It discards `ERROR` snapshots so the next read retries the provider.
- **Injectable clock** — the constructor accepts `deps.now?: () => string`. Every timestamp
  in `HealthResult`, `AdapterSnapshot`, and `AdapterVerification` uses `this.now()`, not
  `new Date()` or `Date.now()`. Adapters that use the injected clock in `checks()` produce
  deterministic duration calculations.

---

## 4. The GET-Only Network Boundary

`src/shared/http.ts` defines the only network egress in the entire package:

```typescript
export interface ReadOnlyHttpClient {
  get<T = unknown>(url: string, opts?: { headers?: Record<string, string> }): Promise<T>;
}
```

The concrete `FetchHttpClient` enforces two rules before issuing any request:

1. **Host allowlist** — every instance is constructed with `allowHosts: readonly string[]`.
   Any URL whose `host` is not in the list throws synchronously before `fetch` is called.
2. **GET only** — `fetch(url, { method: 'GET', ... })`. There is no `post()`, `put()`,
   `patch()`, or `delete()` method on the interface. Mutation is unrepresentable.

The timeout defaults to `8000 ms` via `AbortSignal.timeout(this.timeoutMs)`.

`MockHttpClient` (tests only) matches routes by predicate and returns canned bodies without
any network access.

`contract.test.ts` verifies statically that `fetch(` appears only in `shared/http.ts` across
the entire `src/` tree (see Section 9).

---

## 5. Shared Services

All services are in `src/shared/` and are injected (never constructed inside adapters
directly). They are purely in-memory; nothing is persisted off-process.

| Service | File | Responsibility |
|---|---|---|
| `CredentialProvider` | `credentials.ts` | Presence-only check; `value()` exposed only for placing into outbound request headers; never logs or cites credential values |
| `AdapterRegistry` | `registry.ts` | Name-keyed map; duplicate names throw; fans out `healthAll()` / `collectAll()` / `verifyAll()` |
| `SignalRegistry` | `signals.ts` | Declares every signal with `reachable` flag + `unreachableReason`; `resolve()` from credential presence only |
| `WebhookRegistry` | `webhooks.ts` | Read-only descriptors of webhook surfaces; no server; `deliveries` is always `'NOT_CONNECTED'` |
| `SnapshotStore` | `snapshot-store.ts` | TTL-bounded in-memory cache; entries expire by `snapshot.ttlMs`; no permanent copy of source data |
| `ReadThroughCache` | `cache.ts` | Composes `SnapshotStore`; skips network on HIT; never caches `ERROR` status |
| `RateLimitManager` | `rate-limit.ts` | Token bucket (capacity=30, refill=5/s); per-adapter key; injectable clock |
| `RetryPolicy` / `runWithRetry` | `retry.ts` | Deterministic exponential backoff; injectable sleep; default 3 attempts, 250 ms base, 2× factor, 4 s cap |
| `PollingFramework` | `polling.ts` | Caller-driven deterministic `tick(nowMs)` scheduler; no `setInterval`; host owns the clock |
| `AdapterObservability` | `observability.ts` | Per-adapter, per-op counts / error counts / p50 + p95 latency (100-entry ring buffer); composes `AuditLogger`; never records credential values |
| `AdapterHealthMonitor` | `health-monitor.ts` | Tracks status / success rate / avg latency per adapter; consumed by `PollingFramework` and `LivePlatform` |
| `AuditLogger` | `audit.ts` | Structured op trail (`health \| collect \| verify \| investigate`); never logs secrets |
| `EvidenceBuilder` | `evidence.ts` | Wraps `lcis-core` `evidence()` / `notConnected()` into named helpers (`observed`, `entity`, `notConnected`) |
| `CorrelationEngine` | `correlation.ts` | Intersects live `LiveFact[]` with structural blast radius from `lcis-core`; no new intelligence computed here |

---

## 6. The 18-Adapter Set

Assembled by `createFullAdapterSet()` in `src/catalog.ts`. Registration order is stable and
duplicate names throw in `AdapterRegistry.register()`. Each adapter is constructed with a
`FetchHttpClient` scoped to its exact host allowlist.

| # | `name` | `requiredEnv` | `capabilities` | `sourceOfTruth` |
|---|---|---|---|---|
| 1 | `supabase` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `status`, `tables`, `policies`, `migrations`, `drift`, `health` | Supabase |
| 2 | `github` | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | `health`, `pr`, `issue`, `release`, `deployment`, `workflows` | GitHub |
| 3 | `cloudflare` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `status`, `workers`, `queues`, `routes`, `kv`, `r2` | Cloudflare |
| 4 | `vercel` | `VERCEL_TOKEN` | `status`, `deployments`, `domains`, `projects`, `functions` | Vercel |
| 5 | `github-actions` | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | `workflows`, `runs`, `jobs`, `artifacts` | GitHub Actions |
| 6 | `postgres` | `SUPABASE_MGMT_TOKEN`, `SUPABASE_PROJECT_REF` | `database-health` | Supabase Management API |
| 7 | `redis` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `dbsize` | Upstash REST |
| 8 | `docker` | `DOCKER_API_URL` | `containers` | Docker Engine HTTP API |
| 9 | `kubernetes` | `KUBE_API_URL`, `KUBE_TOKEN` | `pods` | Kubernetes API Server |
| 10 | `stripe` | `STRIPE_SECRET_KEY` | `account` | Stripe |
| 11 | `razorpay` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | `payments` | Razorpay |
| 12 | `analytics-engine` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `datasets` | Cloudflare Analytics Engine |
| 13 | `email` | `RESEND_API_KEY` | `domains` | Resend |
| 14 | `storage` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `bucket-detail` | Cloudflare R2 |
| 15 | `workers` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `script-settings` | Cloudflare Workers |
| 16 | `queues` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `consumers` | Cloudflare Queues |
| 17 | `cron` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `schedules` | Cloudflare Workers Cron |
| 18 | `realtime` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `health` | Supabase Realtime |

Host allowlists per adapter are derived at construction time from the env vars (e.g.
`SUPABASE_URL` is parsed for its host; the fallback is `project.supabase.co`). The `docker`
and `kubernetes` adapters use `DOCKER_API_URL` and `KUBE_API_URL` respectively.

---

## 7. The Signal Catalog

`SIGNAL_CATALOG` in `src/catalog.ts` is an array of `SignalDescriptor` objects — the honest
NOT_CONNECTED → CONNECTED map for every observable live value in the platform.

```typescript
export interface SignalDescriptor {
  readonly key: string;            // e.g. 'ci.workflow-runs'
  readonly description: string;
  readonly adapter: string;        // the AdapterMetadata.name that provides it
  readonly capability: string;
  readonly requiredEnv: readonly string[];
  readonly reachable: boolean;
  readonly unreachableReason?: string;
}
```

`SignalRegistry.resolve(key, creds)` returns a `SignalResolution` with connection state
derived solely from credential presence. It never issues a network call.

### Signals declared `reachable: false`

These signals are structurally unreachable through the GET-only boundary regardless of
credential presence. `unreachableReason` names the exact technical cause.

| Signal key | `unreachableReason` |
|---|---|
| `db.query-stats` | `pg_stat` requires SQL access; not exposed over the GET-only Management API |
| `edge.queue-backlog` | Queue metrics served by Cloudflare GraphQL Analytics API (POST-only) |
| `edge.cron-runs` | Cron run history requires Workers logs/analytics (POST-only GraphQL) |
| `edge.ae-values` | Analytics Engine SQL API is POST-only (`POST /analytics_engine/sql`) |
| `storage.usage` | R2 usage metrics require the GraphQL Analytics API (POST-only) |
| `cache.hit-ratio` | `INFO` not in the read-only command allowlist (unbounded response) |
| `email.deliveries` | Delivery events require the Resend events webhook feed, not a GET endpoint |
| `realtime.channels` | No GET metrics endpoint on Supabase Realtime |

These are declared honestly and appear in `SignalRegistry.resolveAll()` with
`connection: 'NOT_CONNECTED'` — they are never omitted or silently dropped.

---

## 8. Webhook Descriptors

`WEBHOOK_CATALOG` in `src/catalog.ts` is an array of `WebhookDescriptor` objects. This is
descriptive intelligence only: no server is started, no request handler is invoked, and no
delivery events are received by LCAS.

```typescript
export interface WebhookDescriptor {
  readonly key: string;
  readonly provider: string;
  readonly direction: 'inbound' | 'outbound';
  readonly handlerPath: string | null;   // repo-relative, or null if not yet known
  readonly signatureScheme: string;
  readonly requiredEnv: readonly string[];
  readonly events: readonly string[];
}
```

`WebhookRegistry.resolve(key, creds)` checks credential presence for the signing/verification
vars. `deliveries` in `WebhookResolution` is always the literal `'NOT_CONNECTED'` — delivery
history is a live value that requires a delivery-log signal wired through an adapter.

| Key | Provider | Direction | `signatureScheme` | `requiredEnv` |
|---|---|---|---|---|
| `razorpay.payments` | Razorpay | inbound | HMAC-SHA256 | `RAZORPAY_WEBHOOK_SECRET` |
| `github.repository` | GitHub | inbound | HMAC-SHA256 | `GITHUB_WEBHOOK_SECRET` |
| `stripe.events` | Stripe | inbound | HMAC-SHA256 (Stripe-Signature) | `STRIPE_WEBHOOK_SECRET` |
| `resend.events` | Resend | inbound | svix (HMAC-SHA256) | `RESEND_WEBHOOK_SECRET` |
| `letbuyy.queue-envelope` | LetBuyy | outbound | HMAC (`signQueueTenantEnvelope`) | `QUEUE_TENANT_ENVELOPE_SECRET` |

---

## 9. How `lcis-live` Consumes Adapters

`packages/lcis-live/src/factory.ts` constructs a `LivePlatform` from a `readonly LiveAdapter[]`.
Today's `defaultAdapters()` uses only the original four (Supabase, GitHub, Cloudflare, Vercel).
The Phase 9 adapters slot in additively by extending that list or by calling
`createDefaultRegistry()` from `catalog.ts` — no breaking change to `LivePlatform`.

`LivePlatform` uses adapters through the `LiveAdapter` contract only:

- `health()` fan-out feeds `AdapterHealthMonitor`.
- `status()` fan-out through a `SnapshotStore` (TTL-bounded).
- `investigate(subject)` collects `LiveFact[]` from `CONNECTED` snapshot payloads, feeds them
  to `CorrelationEngine`, which delegates all blast-radius reasoning to `lcis-core`.

---

## 10. The Honesty Law

Every component in LCAS enforces the same invariant:

> LCIS is an observer. It normalises and cites facts from sources of truth. It never
> fabricates a value. When a source is unreachable — because credentials are absent,
> a provider endpoint is POST-only, or the API is paginated — the response is
> `NOT_CONNECTED` with the exact reason. The absence of a value is never hidden.

Operationally this means:

- `AdapterStatus = 'NOT_CONNECTED'` with `missingEnvVars` listing exact names when creds are absent.
- `confidence: 0` for any `NOT_CONNECTED` snapshot; `≤ 0.95` for any `CONNECTED` snapshot.
- `reachable: false` with `unreachableReason` for structurally unreachable signals.
- `deliveries: 'NOT_CONNECTED'` in every `WebhookResolution`.
- No credential value ever appears in `Evidence`, `AdapterSnapshot`, logs, or audit output.
