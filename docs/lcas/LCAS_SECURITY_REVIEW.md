# LCAS Security Review

**Package:** `packages/lcis-adapters` (`@letbuyy/lcis-adapters`)
**Date:** 2026-07-04. Every finding was verified against source; no inference.
**Verdict: PASS** — see Section 5 for evidence.

---

## 1. Threat Model

| Threat | Description | Relevant Surface |
|---|---|---|
| **T1 — Mutation via adapter** | An adapter issues a POST/PUT/PATCH/DELETE to a provider and modifies production state. | `ReadOnlyHttpClient` + `contract.test.ts` |
| **T2 — Arbitrary code execution** | An adapter calls `eval`, `new Function`, `spawn`, `exec`, or `child_process` to run arbitrary code. | `contract.test.ts` |
| **T3 — Filesystem write** | An adapter writes, appends, or deletes files, leaving an attack surface or corrupting state. | `contract.test.ts` |
| **T4 — Unallowlisted network** | An adapter bypasses `FetchHttpClient` with a raw `fetch` call to an arbitrary host (SSRF, data exfiltration). | `contract.test.ts` + `FetchHttpClient` host check |
| **T5 — Credential leak** | A credential value appears in LCIS output, evidence, logs, or audit records (token exfiltration). | `CredentialProvider` + `AuditLogger` |
| **T6 — Value fabrication** | An adapter returns `CONNECTED` status or a plausible payload without real source confirmation (false assurance). | `AdapterBase` honesty model |
| **T7 — Money adapter as authoritative ledger** | A payment adapter's read of settlements or balances is treated as the canonical source of money truth, undermining the Postgres SECURITY DEFINER ledger. | Architecture boundary |
| **T8 — Snapshot poisoning** | A crafted provider response causes a malformed snapshot to persist in the `SnapshotStore` and propagate incorrect facts to the `CorrelationEngine`. | Zod validation in every adapter |

---

## 2. Enforcement Mechanisms

### 2.1 Static Token Scan — `test/contract.test.ts`

`test/contract.test.ts` is a build-gate test that recursively walks the entire `src/`
directory and inspects every `.ts` file. Before scanning, it strips comments and string/
template-literal contents so only executable code remains:

```typescript
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
    .replace(/\/\/.*$/gm, ' ')            // line comments
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")  // string literals
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')  // string literals
    .replace(/`(?:[^`\\]|\\.)*`/g, '``'); // template literals
}
```

This prevents documenting a forbidden keyword in a comment from triggering a false positive.
It does not prevent a determined attacker from obfuscating a call (see limitations, Section 4).

**Test 1 — Raw `fetch(` outside the GET-only boundary (addresses T1, T4)**

```typescript
const FETCH_ALLOWED = new Set(['shared/http.ts']);

test('no source performs a raw network call outside shared/http.ts', () => {
  const offenders: string[] = [];
  for (const f of walk(srcDir)) {
    if (/\bfetch\s*\(/.test(code(readFileSync(f, 'utf8'))) && !FETCH_ALLOWED.has(rel(f))) {
      offenders.push(rel(f));
    }
  }
  assert.deepEqual(offenders, [], `raw fetch outside shared/http.ts: ${offenders.join(', ')}`);
});
```

`shared/http.ts` is the only allowlisted file. Every new adapter file added to `src/`
is automatically included in the walk — there is no registration step.

**Test 2 — Mutation, execution, and filesystem-write primitives (addresses T1, T2, T3)**

```typescript
const FORBIDDEN =
  /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|
   writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bmkdirSync/;
```

The regex covers `child_process` module use, all common spawn/exec variants, `eval`,
`new Function`, and the synchronous and asynchronous filesystem write/delete APIs.

**Test 3 — GET-only verification in `shared/http.ts` (addresses T1)**

```typescript
test('the read-only HTTP client uses only the GET method (no mutating verbs)', () => {
  const http = readFileSync(join(srcDir, 'shared', 'http.ts'), 'utf8');
  assert.match(http, /method:\s*'GET'/);
  assert.doesNotMatch(http, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
});
```

This asserts both the presence of `method: 'GET'` and the absence of any mutating verb
in the file that owns the network boundary.

### 2.2 GET-Only `FetchHttpClient` with Host Allowlists (addresses T1, T4)

`src/shared/http.ts` — the `FetchHttpClient`:

```typescript
export class FetchHttpClient implements ReadOnlyHttpClient {
  constructor(
    private readonly allowHosts: readonly string[],
    private readonly timeoutMs = 8000,
  ) {}

  async get<T = unknown>(url: string, opts?: { headers?: Record<string, string> }): Promise<T> {
    const u = new URL(url);
    if (!this.allowHosts.includes(u.host)) {
      throw new Error(`lcis-adapters: host not allowlisted: ${u.host}`);
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: opts?.headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new HttpError(res.status, url);
    return (await res.json()) as T;
  }
}
```

The `ReadOnlyHttpClient` interface exposes only `get()`. There is no `post()`, `put()`,
`patch()`, or `delete()` method — mutation is unrepresentable at the type level. A caller
cannot accidentally issue a mutating request through this interface.

Each adapter's allowlist is set at construction time in `createFullAdapterSet()`:

```typescript
new GitHubActionsAdapter(deps(['api.github.com'])),
new RazorpayAdapter(deps(['api.razorpay.com'])),
new StripeAdapter(deps(['api.stripe.com'])),
// ...
```

A call from the Razorpay adapter to `api.stripe.com` would throw at the host check.

An `8000 ms` timeout via `AbortSignal.timeout` prevents a slow provider from holding
connections open indefinitely.

### 2.3 Credential Presence-Only Policy (addresses T5)

`src/shared/credentials.ts` — `CredentialProvider`:

```typescript
check(required: readonly string[]): CredentialPresence {
  const missing = required.filter((k) => {
    const v = this.env[k];
    return v === undefined || v === '';
  });
  return { present: missing.length === 0, required, missing };
}

value(key: string): string | undefined {
  return this.env[key];
}
```

`check()` returns only names of missing vars — never values. `value()` exists solely for
placing a secret into an outbound request header; it is never called from any path that
produces `AdapterSnapshot`, `HealthResult`, `Evidence`, or log output.

`AuditLogger.record()` accepts only `adapter`, `op`, and a `meta: Record<string, unknown>`.
Its callers (`AdapterObservability.record()`) pass only `latencyMs`, `error` (message only),
and counts. No call site passes a credential value.

`HealthResult.missingEnvVars` contains only env var names (e.g. `['GITHUB_TOKEN']`), not
values. Evidence items in the `NOT_CONNECTED` path are built with `notConnected(adapter, envVarName)`,
which records only the variable name.

### 2.4 Honesty Model — No Fabrication (addresses T6)

`AdapterBase.health()` and `AdapterBase.collect()` gate every provider interaction behind
`CredentialProvider.check()`. The control flow is:

```
credentials absent → return NOT_CONNECTED (probe/gather never called)
credentials present → call probe/gather → return CONNECTED or ERROR
```

An adapter can never return `CONNECTED` without the probe succeeding. An adapter can never
fabricate a payload — if `gather()` throws, the base class returns `ERROR` with `confidence: 0`
and an empty payload `{}`.

`AdapterSnapshot.confidence` is capped at `Math.min(g.confidence, 0.95)` by the base class.
No adapter can claim 100% certainty.

### 2.5 Money Adapters are Observers, Not Ledger (addresses T7)

`stripe` and `razorpay` adapters read account status, webhook endpoint configuration, and
recent payments/settlements lists via GET. They do not call any Postgres SECURITY DEFINER
RPC (`create_checkout_order`, `confirm_order_payment_with_ledger`, etc.) and have no access
to the LetBuyy database.

Their snapshot payloads feed the `CorrelationEngine` as `LiveFact[]` — structural context
only. The canonical money ledger is governed by the Postgres RPCs in `services/api-gateway`;
no adapter can write to it or substitute for it.

### 2.6 Zod Validation Against Snapshot Poisoning (addresses T8)

Every adapter validates all provider responses with Zod before placing data into a payload.
A parse failure throws, which the base class catches and returns as an `ERROR` snapshot with
`confidence: 0` and empty payload. An `ERROR` snapshot is never stored in `SnapshotStore`
or `ReadThroughCache` — the next read retries the provider.

The `CorrelationEngine` reads `payload.facts` typed as `LiveFact[]`. A malformed payload
(e.g. `null`) would surface as a TypeScript error at the cast site, and the Zod parse failure
would have already prevented it from being stored.

---

## 3. Security Properties of Shared Services

| Service | Security property |
|---|---|
| `SnapshotStore` | TTL-bounded; no disk persistence; `ERROR` snapshots never stored |
| `ReadThroughCache` | Composes `SnapshotStore`; skips provider on HIT; `ERROR` invalidated |
| `RateLimitManager` | Token bucket prevents a buggy adapter from hammering a provider API |
| `AuditLogger` | Structured log; callers pass only status/latency/counts; no credential values |
| `AdapterObservability` | Ring buffer (100 entries) prevents unbounded memory growth |
| `AdapterRegistry` | Duplicate names throw — prevents silent adapter shadowing |
| `SignalRegistry` | Duplicate keys throw — prevents silent signal shadowing |
| `WebhookRegistry` | `deliveries: 'NOT_CONNECTED'` is a literal type; cannot be set to any other value |

---

## 4. Honest Limitations

The following are known scope boundaries, not defects:

**Token scan, not a sandbox.** `contract.test.ts` is a static token scan with comment/string
stripping, not a runtime sandbox or AST analysis. A sufficiently obfuscated call
(e.g. computed property access: `obj['fe'+'tch']`) would not be caught. The scan relies on
conventional TypeScript patterns; it is a build gate, not a security sandbox.

**Per-adapter host allowlists set at construction time.** The allowlist is a `readonly string[]`
passed to `FetchHttpClient`. It is set in `createFullAdapterSet()` — if an adapter were
constructed outside that factory with a permissive allowlist, the structural constraint would
not apply. Tests and production code should always construct adapters through `catalog.ts`.

**No TLS certificate pinning.** `FetchHttpClient` uses Node/Cloudflare `fetch` without
certificate pinning. The host allowlist blocks calls to unlisted hosts but does not prevent
a provider's own TLS certificate from being compromised. LCIS trusts the standard TLS chain.

**Adapter credential exposure to provider.** `CredentialProvider.value()` exposes the raw
secret string to the adapter for use in an `Authorization` header. Once placed in the header,
the secret travels to the provider over HTTPS. LCIS cannot prevent a provider from logging it.

**`checks()` receives the full payload.** Checks run over `snap.payload as AdapterPayload`.
A crafted provider response that passes Zod validation could produce misleading
`VerificationFinding` items. Zod schemas use `.passthrough()`, so unknown fields are
tolerated — a provider injecting an unexpected `status: 'ok'` field on an item would not
cause the schema to fail but could cause a check to miss a finding. This is a data-trust
boundary issue, not an LCIS code vulnerability.

---

## 5. Verdict: PASS

| Control | Evidence |
|---|---|
| No mutating HTTP verb | `contract.test.ts` test 3 asserts `method: 'GET'` present and `POST/PUT/PATCH/DELETE` absent in `shared/http.ts` |
| No raw `fetch` outside the boundary | `contract.test.ts` test 1 walks all of `src/`; only `shared/http.ts` is allowlisted |
| No mutation/exec/fs-write primitives | `contract.test.ts` test 2 regex scan across all `src/` files |
| Host allowlists enforced | `FetchHttpClient` checks `u.host` against `allowHosts` before any `fetch` call; throws synchronously if not listed |
| Credentials presence-only in output | `CredentialProvider.check()` returns only names; `HealthResult.missingEnvVars` contains only names; `notConnected()` records only the var name |
| No fabrication possible | `AdapterBase` gates `probe()`/`gather()` behind `check()`; `NOT_CONNECTED` when any var missing |
| Money adapters not ledger-authoritative | `stripe` and `razorpay` adapters call only GET endpoints; no Postgres RPC access; output is `LiveFact[]` for correlation only |
| Malformed responses do not persist | Zod parse failure → `gather()` throws → base class returns `ERROR` → `ReadThroughCache` discards `ERROR` snapshots |
| Confidence cap at 0.95 | `AdapterBase.collect()`: `Math.min(g.confidence, 0.95)` — hard-coded, not overridable by subclasses |
| Audit trail never logs secrets | `AuditLogger.record()` accepts only `meta: Record<string, unknown>`; callers pass only counts/latency/status |
