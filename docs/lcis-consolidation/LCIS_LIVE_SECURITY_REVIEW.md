# LCIS Live Adapter — Security Review

Phase 3 packages: `@letbuyy/lcis-adapters`, `@letbuyy/lcis-live`, and the live extensions added to `@letbuyy/lcis-cli`, `@letbuyy/lcis-mcp`, and `services/lcis-api`.

---

## Posture: Read-Only by Construction

The live adapter platform is read-only. This is not a convention — it is structurally enforced at the network boundary, the type system, and the contract test suite.

---

## The GET-Only Network Boundary

### Interface

`ReadOnlyHttpClient` (defined in `packages/lcis-adapters/src/shared/http.ts`) has exactly one method:

```ts
interface ReadOnlyHttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>
}
```

There is no `post`, `put`, `patch`, `delete`, or `request` method on the interface. `FetchHttpClient` implements only `get`. No adapter can call a mutating HTTP method because no mutating method is representable in the type.

### Host Allowlist

`FetchHttpClient` is constructed with an explicit allowlist of provider hostnames. Any call to an unlisted host throws before a network connection is opened. The allowlists per adapter:

| Adapter | Allowed hosts |
|---------|--------------|
| Supabase | `[supabaseHost(), 'api.supabase.com']` — `supabaseHost()` extracts the hostname from `SUPABASE_URL` |
| GitHub | `['api.github.com']` |
| Cloudflare | `['api.cloudflare.com']` |
| Vercel | `['api.vercel.com']` |

An attacker who controls a `SUPABASE_URL` value could point `supabaseHost()` at an arbitrary host. Mitigation: `SUPABASE_URL` is an operator-controlled environment variable, not user input, and must match the format `https://<project-ref>.supabase.co`.

---

## Credential Handling

Credentials are treated as **presence-only tokens** everywhere except the network egress point.

`CredentialProvider.check(required[])` returns only a boolean presence result — the value is never read in this path. `CredentialProvider.value(key)` returns the raw string but is called **only** to construct an Authorization or apikey header in `gather()`. The value:

- Is never logged by `AuditLogger` (the `meta` parameter type does not include credential fields; this is enforced by the type, not by a runtime check).
- Is never included in `HealthResult`, `AdapterSnapshot`, `LiveFact`, `VerificationFinding`, or `Evidence`.
- Is never returned via the CLI, MCP, or API.
- Is never written to disk.

---

## The `Map.prototype.delete` Clarification

A source scan of `packages/lcis-adapters/` finds one `.delete(` call. This is `Map.prototype.delete` in `packages/lcis-adapters/src/shared/snapshot-store.ts`, used to evict an expired TTL entry from the in-memory `SnapshotStore`. It has no provider or database effect. It is not `fetch DELETE`, `fs.unlink`, or any source-of-truth mutation.

---

## Source Scan Results

Scan of `packages/lcis-adapters/` and `packages/lcis-live/`:

| Dangerous pattern | Occurrences | Notes |
|-------------------|-------------|-------|
| `fetch` with `method: 'POST'` / `'PUT'` / `'PATCH'` / `'DELETE'` | 0 | `FetchHttpClient.get()` calls `fetch` with no explicit method (defaults to GET) |
| `child_process`, `exec`, `spawn`, `execSync` | 0 | — |
| `eval`, `new Function(` | 0 | — |
| `fs.write*`, `fs.append*`, `createWriteStream` | 0 | — |
| `process.env.*` in log/return paths | 0 | `CredentialProvider.value()` only; called only in `gather()` headers |
| `INSERT`, `UPDATE`, `DELETE` SQL in string literals | 0 | — |
| `.delete(` | 1 | `Map.prototype.delete` in `SnapshotStore` — in-memory TTL eviction |

The live extensions to `@letbuyy/lcis-cli`, `@letbuyy/lcis-mcp`, and `services/lcis-api` add live command handlers. These call `createLivePlatform()` and return results. No new write paths are introduced.

---

## Contract Test Enforcement

`packages/lcis-adapters/test/contract.test.ts` is a build-failing test that asserts the read-only posture programmatically. It verifies:

1. `ReadOnlyHttpClient` interface has no `post`, `put`, `patch`, or `delete` method signatures.
2. `FetchHttpClient` source contains no `POST`, `PUT`, `PATCH`, or `DELETE` in its `fetch` call.
3. `CredentialProvider.value()` return value does not appear in any `HealthResult` field.
4. No adapter source imports `child_process`, `fs`, or `node:fs`.

This test runs in CI as part of the standard `pnpm test` pass. A new adapter that adds a POST call will fail this test.

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Adapter mutates provider state | Impossible: `ReadOnlyHttpClient` has no mutating method |
| Credential value leaked in logs | `AuditLogger.record()` meta type does not accept credential values; no log path touches `CredentialProvider.value()` |
| Credential value returned in API response | `HealthResult`, `AdapterSnapshot`, `LiveFact` types have no credential fields; `CredentialProvider.value()` is called only in `gather()` request headers |
| SSRF via provider URL | `FetchHttpClient` host allowlist blocks non-allowlisted hosts before network open |
| Uncontrolled data growth in SnapshotStore | TTL eviction via `Map.delete`; bounded by adapter count (4) |
| Rate abuse of provider APIs | `RateLimitManager` token bucket (capacity 30, refill 5/s) |
| Stale credentials accepted | `CredentialProvider.check()` checks presence only; API authentication is delegated to the provider (401 from `probe()` surfaces as `ERROR` status) |

---

## No Mutation Is Representable

The read-only guarantee is a type-system guarantee, not just a convention. The `LiveAdapter` interface (`contracts.ts`) has no method that could trigger a write. `AdapterBase` implements the contract in full. Subclasses implement `probe()`, `gather()`, and `checks()` — none of which receive the `ReadOnlyHttpClient` directly; they receive it as an injected dependency typed as `ReadOnlyHttpClient`. There is no escape hatch to the underlying `fetch`.
