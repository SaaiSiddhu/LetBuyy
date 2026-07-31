# LCIS Live Adapter Architecture

Phase 3 of the LCIS consolidation. Two new packages — `@letbuyy/lcis-adapters` and `@letbuyy/lcis-live` — add read-only live provider observation to the existing structural intelligence stack.

---

## Design Principle: LCIS Is Never the Source of Truth

LCIS does not replace provider dashboards. It observes them and correlates what they report against what the structural graph expects. All operational reasoning (blast radius, domain edges, cross-domain impact, explainability) is delegated to `@letbuyy/lcis-core`. Phase 3 adds no new intelligence engine — it adds live observation wired into the existing one.

---

## Package Overview

| Package | Location | Purpose |
|---------|----------|---------|
| `@letbuyy/lcis-adapters` | `packages/lcis-adapters/` | Shared platform + 4 read-only provider adapters |
| `@letbuyy/lcis-live` | `packages/lcis-live/` | Unified live platform (composes adapters + lcis-core) |

Both are ESM, private, and depend on `@letbuyy/lcis-core` at `workspace:*`. `lcis-adapters` is a peer dependency of `lcis-live`.

---

## The `LiveAdapter` Contract

```
interface LiveAdapter {
  metadata(): AdapterMetadata
  health(): Promise<HealthResult>
  collect(): Promise<AdapterSnapshot<unknown>>
  verify(): Promise<AdapterVerification>
}
```

Defined in `packages/lcis-adapters/src/shared/contracts.ts`.

- `health()` — probes the provider's root endpoint. Returns `AdapterStatus` (`CONNECTED | NOT_CONNECTED | ERROR | DEGRADED`) + `missingEnvVars[]` when credentials are absent.
- `collect()` — reads all available facts from the provider. Returns a typed `AdapterSnapshot<T>` with a TTL.
- `verify()` — runs structural checks (drift, security gaps, broken state). Returns `VerificationFinding[]`.

---

## `AdapterBase` — The Honesty Model

All four adapters extend `AdapterBase` (`src/shared/base.ts`), which implements the contract in full. Subclasses implement three protected methods:

| Method | Called by | Responsibility |
|--------|-----------|----------------|
| `probe()` | `health()` | Single GET to the provider's identity/verify endpoint |
| `gather()` | `collect()` | Reads all relevant provider resources; returns typed payload |
| `checks(payload)` | `verify()` | Structural checks against lcis-core artifacts |

**The honesty guarantee is in `AdapterBase`, not in each subclass.** Before any network call, `AdapterBase` calls `CredentialProvider.check(required[])`. If any required credential is absent, `health()` returns `NOT_CONNECTED` with the exact `missingEnvVars` list; `collect()` returns an empty snapshot; `verify()` returns no findings. No network egress occurs. No fabricated values are returned.

Confidence is capped at **0.95** in `AdapterBase` regardless of what `gather()` returns.

---

## Shared Platform Components

All components live in `packages/lcis-adapters/src/shared/`.

### `FetchHttpClient` (`http.ts`)

The only network egress mechanism in Phase 3. Implements `ReadOnlyHttpClient`:

```
interface ReadOnlyHttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>
}
```

Key properties:
- **GET only** — no `post`, `put`, `patch`, `delete` methods exist on the interface or the implementation.
- **Host allowlist** — each adapter instance is constructed with an explicit allowlist (e.g. `['api.github.com']`). Requests to any unlisted host throw before touching the network.
- **8-second timeout** via `AbortSignal.timeout`.
- `MockHttpClient` (tests only) — canned URL-matcher responses, no real network.

### `CredentialProvider` (`credentials.ts`)

Checks credential **presence only**. Two operations:

- `check(required[])` → `CredentialPresence` — which vars are present and which are missing. Never reads the value into any non-network path.
- `value(key)` → raw string — used only to place a credential into an outbound request Authorization header. Not logged, not included in `Evidence`, not returned in snapshots.

### `SnapshotStore` (`snapshot-store.ts`)

In-memory TTL cache of `AdapterSnapshot`. The one `Map.prototype.delete` call in the codebase lives here — it evicts an expired entry from the cache. This is not a source-of-truth mutation; it has no provider or database effect.

Default TTLs: 60 s (Supabase, GitHub), 120 s (Cloudflare, Vercel).

### `RateLimitManager` (`rate-limit.ts`)

Token bucket: capacity = 30, refill = 5 tokens/second. `tryAcquire(key, cost)` returns a boolean. Injectable clock for test determinism.

### `AuditLogger` (`audit.ts`)

Structured trail of adapter operations. Operation types: `health | collect | verify | investigate`. Metadata passed to `record()` must never contain credential values — enforced by type (metadata is a plain object without typed credential fields).

### `AdapterHealthMonitor` (`health-monitor.ts`)

Per-adapter rolling stats: success/error counts, success rate, rolling average latency (last 50 samples). Used by `LivePlatform.observability()`.

### `EvidenceBuilder` (`evidence.ts`)

Thin wrapper over `lcis-core`'s `evidence()` and `notConnected()` helpers. Methods: `observed(ref, detail, source)`, `entity(kind, ref, source, detail?)`, `notConnected(ref, requiresEnvVar)`. All reasoning stays in lcis-core.

### `CorrelationEngine` (`correlation.ts`)

Takes an `LcisEngine` from lcis-core. `correlate(subject, facts[])`:

1. Calls `lcis-core` blast radius + cross-domain + explainDomain for the subject.
2. Intersects the live `LiveFact[]` with the structural surface via fuzzy substring match on domain/table/service names.
3. Returns `CorrelationResult` with `summary`, `structural`, `correlatedFacts`, `otherFacts`, `evidence`, and `confidence` (bounded 0.2–0.9).

No new reasoning logic. Structural data comes from lcis-core; live data comes from adapters.

---

## The Four Adapters

| Adapter | Source | Required env vars | Optional | Snapshot TTL |
|---------|--------|-------------------|----------|-------------|
| `SupabaseAdapter` | `src/supabase/` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_ACCESS_TOKEN` | 60 s |
| `GitHubAdapter` | `src/github/` | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` | — | 60 s |
| `CloudflareAdapter` | `src/cloudflare/` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | — | 120 s |
| `VercelAdapter` | `src/vercel/` | `VERCEL_TOKEN` | `VERCEL_TEAM_ID` | 120 s |

See `LCIS_ADAPTER_GUIDE.md` for per-adapter capability detail.

---

## `@letbuyy/lcis-live` — The Unified Platform

Four source files. `createLivePlatform(opts?)` in `src/factory.ts` wires the adapters:

- Each adapter gets a `FetchHttpClient` with its own host allowlist.
- Supabase's allowlist is `[supabaseHost(), 'api.supabase.com']` — `supabaseHost()` extracts the hostname from `SUPABASE_URL` at construction time.
- All adapters share a single `CredentialProvider`.

`LivePlatform` (`src/platform.ts`) methods:

| Method | Description |
|--------|-------------|
| `health()` | Parallel health checks across all adapters; records latency in `AdapterHealthMonitor` |
| `status()` | Parallel collect with TTL cache via `SnapshotStore` |
| `adapters()` | Returns metadata listing for all registered adapters |
| `verify(name?)` | Runs verify on one or all adapters |
| `investigate(subject)` | Collects facts from CONNECTED adapters → `CorrelationEngine` → `Investigation` |
| `observability()` | Returns `AdapterHealthMonitor` state for all adapters |

`computeOverall()` logic: all CONNECTED → `CONNECTED`; all NOT_CONNECTED → `NOT_CONNECTED`; mixed → `DEGRADED`; otherwise → `ERROR`.

`investigate()` builds an honest `notConnected[]` list of adapters that returned `NOT_CONNECTED` and excludes their facts from correlation.

---

## Dependency Diagram

```
@letbuyy/lcis-live
  └─ @letbuyy/lcis-adapters
       └─ @letbuyy/lcis-core  ←── graphify-out/ (artifact store)
            └─ graphify-out/
                 ├─ code-graph.json
                 ├─ db-intel.json
                 └─ domain-intel.json

Access packages (cli / mcp / api)
  └─ @letbuyy/lcis-live  (for live commands)
  └─ @letbuyy/lcis-core  (for structural commands)
```

Live surfaces call `createLivePlatform()` directly from `@letbuyy/lcis-live`. No adapter wiring is duplicated in the access packages.
