# LCAS Adapter Guide — Adding a New Adapter

**Package:** `packages/lcis-adapters` (`@letbuyy/lcis-adapters`)
**Date verified:** 2026-07-04. The 4-file pattern below is grounded in `GitHubActionsAdapter`.

---

## 1. Before You Start

Check `src/catalog.ts` and the `LCAS_ARCHITECTURE.md` adapter table. The 18 registered
adapters must not be duplicated. A new adapter should cover a source that is not already
observed, or a clearly distinct capability on an existing provider (e.g. `workers` covers
per-script settings; `cloudflare` covers the scripts inventory — these are different depths).

`AdapterRegistry.register()` throws on duplicate `name` strings, so a naming clash fails at
startup, not silently.

---

## 2. The 4-File Pattern

Every adapter in the package follows this layout:

```
src/<slug>/
  index.ts          — re-exports everything from this directory
  types.ts          — Zod schemas + inferred TypeScript types + the payload interface
  <ClassName>.ts    — extends AdapterBase; implements metadata/probe/gather/checks
```

The fourth file is the `src/catalog.ts` entry — not a new file, but a required edit.

---

## 3. `types.ts` — Zod Schemas and the Payload Shape

Define one Zod schema per API response and one payload interface. Schemas must use
`.passthrough()` on object schemas so that unexpected provider fields do not break the parse.

```typescript
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

export const ExampleItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
}).passthrough();

export type ExampleItem = z.infer<typeof ExampleItemSchema>;

export const ExampleResponseSchema = z.object({
  total_count: z.number(),
  items: z.array(ExampleItemSchema),
});

export interface ExamplePayload {
  readonly items: readonly ExampleItem[];
  readonly facts: readonly LiveFact[];
}
```

Rules:
- All types are `readonly` and all arrays are `readonly`.
- The `facts` field of every payload must be `readonly LiveFact[]`. The `CorrelationEngine`
  in `lcis-live` reads `payload.facts` by name to feed the intersection engine.
- Never put raw API responses directly into the payload type — always derive from `z.infer<>`.

---

## 4. The Adapter Class — `<ClassName>.ts`

Extend `AdapterBase` and implement the four abstract methods. No other method may issue a
network call; no method may write, execute, or spawn.

```typescript
import { AdapterBase, type AdapterDeps, type AdapterMetadata,
         EvidenceBuilder, type GatherResult, type LiveFact,
         type VerificationFinding } from '../shared/index';
import { ExampleResponseSchema, type ExamplePayload } from './types';

const SOURCE = 'Example API';

export class ExampleAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) { super(deps); }

  metadata(): AdapterMetadata {
    return {
      name: 'example',
      displayName: 'Example',
      requiredEnv: ['EXAMPLE_API_KEY'],
      capabilities: ['items'],
      sourceOfTruth: SOURCE,
    };
  }

  protected async probe(): Promise<void> { /* ... */ }
  protected async gather(): Promise<GatherResult> { /* ... */ }
  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> { /* ... */ }
}
```

### `metadata()` responsibilities

| Field | Rule |
|---|---|
| `name` | Stable, lowercase, hyphenated. Must be unique across all 18+ adapters. Used as the registry key. |
| `requiredEnv` | Every env var whose absence must produce `NOT_CONNECTED`. LCAS checks presence; the base class handles the gate. |
| `capabilities` | Human-readable strings; used in `AdapterMetadata` listings consumed by UI/API layers. |
| `sourceOfTruth` | The external system that owns the data. Appears in every `Evidence` item. |

### `probe()` responsibilities

- Issue exactly one lightweight GET to confirm the provider is reachable.
- Validate the response with a Zod schema's `.safeParse()`.
- Throw a descriptive `Error` if the shape is wrong (base class catches and returns `ERROR`).
- Never return a value — the base class calls it only to verify reachability.
- Use `this.http.get(url, { headers })` — not `fetch`. The host must be in the allowlist
  passed to `FetchHttpClient` when the adapter was constructed.

```typescript
protected async probe(): Promise<void> {
  const key = this.creds.value('EXAMPLE_API_KEY');
  const raw = await this.http.get('https://api.example.com/v1/ping', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const parsed = ExampleResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Example /ping: unexpected shape`);
}
```

### `gather()` responsibilities

- Issue one GET per needed endpoint. Page 1 only when the API is paginated; state the
  limitation explicitly in evidence.
- Validate every response with `.safeParse()`. Throw on failure with the Zod issue message.
- Build `Evidence[]` using `EvidenceBuilder.observed(ref, detail, SOURCE)` for every observed
  fact. Include pagination caveats: `"page 1 only — full list NOT CONNECTED (paginated API)"`.
- Build `LiveFact[]` from the gathered data. Facts must have:
  - `adapter`: the adapter `name` (lowercase, matches `metadata().name`).
  - `kind`: namespaced to the adapter, e.g. `'ci-workflow'`, `'deploy-project'`, `'queue-consumer'`.
  - `subject`: normalised to a table name, domain key, file path, service name, or symbol
    so the `CorrelationEngine` can match it against a blast radius.
  - `at`: an ISO timestamp string from the provider, or `null`.
  - `evidence`: at least one `EvidenceBuilder.observed(...)` item per fact.
- Return `{ payload, evidence, confidence }` where:
  - `payload` matches the payload interface from `types.ts`.
  - `confidence` is a number between 0 and 1. Cap at 0.85 when paginated (page-1 only);
    cap at 0.9 when all data is fetched. The base class applies `Math.min(confidence, 0.95)`.

```typescript
protected async gather(): Promise<GatherResult> {
  const key = this.creds.value('EXAMPLE_API_KEY');
  const headers = { Authorization: `Bearer ${key}` };
  const ev: Evidence[] = [];

  const raw = await this.http.get('https://api.example.com/v1/items?per_page=20', { headers });
  const parsed = ExampleResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Example /items: ${parsed.error.issues[0]?.message}`);

  ev.push(EvidenceBuilder.observed('example.items',
    `${parsed.data.items.length} item(s) — page 1 only; full list NOT CONNECTED (paginated)`,
    SOURCE));

  const facts: LiveFact[] = parsed.data.items.map((item) => ({
    adapter: 'example',
    kind: 'example-item',
    subject: item.name,
    detail: `Item "${item.name}" (id=${item.id}, status=${item.status})`,
    at: null,
    evidence: [EvidenceBuilder.observed(`example.item.${item.id}`, `status=${item.status}`, SOURCE)],
  }));

  const payload: ExamplePayload = { items: parsed.data.items, facts };
  return { payload, evidence: ev, confidence: 0.85 };
}
```

### `checks()` responsibilities

- Receive the typed `payload` cast from `unknown` — the base class passes `snap.payload`.
- Return deterministic `VerificationFinding[]` based only on the payload contents.
- Always use `this.now()` (the injected clock) for duration calculations and timestamps.
  Never use `new Date()`, `Date.now()`, or `performance.now()` directly.
- Include a summary `'info'`-severity finding at the end for inventory audit trails.

```typescript
protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
  const p = payload as ExamplePayload;
  const findings: VerificationFinding[] = [];
  const now = new Date(this.now()).getTime();

  for (const item of p.items.filter((i) => i.status === 'failed')) {
    findings.push({
      kind: 'example-item-failed',
      severity: 'high',
      subject: item.name,
      detail: `Item "${item.name}" (id=${item.id}) has status=failed.`,
      evidence: [EvidenceBuilder.observed(`example.item.${item.id}`, `status=failed`, SOURCE)],
    });
  }

  // Inventory summary — always last
  findings.push({
    kind: 'example-inventory',
    severity: 'info',
    subject: 'example',
    detail: `Example inventory at ${new Date(now).toISOString()}: ${p.items.length} item(s).`,
    evidence: [EvidenceBuilder.observed('example.inventory', `count=${p.items.length}`, SOURCE)],
  });

  return findings;
}
```

### `snapshotTtlMs()` (optional override)

Return how long the snapshot is considered fresh. Default from `AdapterBase` is `60_000` ms
(1 minute). Override for slower-changing data (e.g. 5 minutes for domain verification status)
or faster-changing data (e.g. 30 seconds for CI run status).

---

## 5. `index.ts` — Re-exports

```typescript
export * from './ExampleAdapter';
export * from './types';
```

---

## 6. Wiring into `src/catalog.ts`

Four edits are required:

**a. Import the adapter:**
```typescript
import { ExampleAdapter } from './example/index';
```

**b. Add to `createFullAdapterSet()`** with its host allowlist:
```typescript
new ExampleAdapter(deps(['api.example.com'])),
```

**c. Add signals to `SIGNAL_CATALOG`** — one entry per observable value. Mark
`reachable: false` with `unreachableReason` for any value that is structurally
unreachable (POST-only endpoint, no GET equivalent):
```typescript
{ key: 'example.items', description: 'Example items list', adapter: 'example',
  capability: 'items', requiredEnv: ['EXAMPLE_API_KEY'], reachable: true },
{ key: 'example.metrics', description: 'Example aggregate metrics', adapter: 'example',
  capability: 'items', requiredEnv: [], reachable: false,
  unreachableReason: 'Metrics endpoint is POST-only' },
```

**d. Add webhook descriptors to `WEBHOOK_CATALOG`** if the provider sends or receives
webhooks, with the `handlerPath` pointing to the repo-relative handler or `null` if not
yet known.

---

## 7. Test Requirements

Every adapter needs tests that cover these cases. Use `MockHttpClient` for network; use
`CredentialProvider` with a fake env map for credentials; inject a fixed ISO string for `now`.

### NOT_CONNECTED path (required first)

```typescript
const adapter = new ExampleAdapter({
  http: new MockHttpClient([]),
  creds: new CredentialProvider({}),  // no vars set
  now: () => '2026-01-01T00:00:00.000Z',
});
const health = await adapter.health();
assert.equal(health.status, 'NOT_CONNECTED');
assert.deepEqual(health.missingEnvVars, ['EXAMPLE_API_KEY']);
```

### CONNECTED path (mock HTTP)

```typescript
const adapter = new ExampleAdapter({
  http: new MockHttpClient([{
    match: (url) => url.includes('/v1/items'),
    body: { total_count: 1, items: [{ id: 1, name: 'test', status: 'ok' }] },
  }]),
  creds: new CredentialProvider({ EXAMPLE_API_KEY: 'test-key' }),
  now: () => FIXED_CLOCK,
});
const snap = await adapter.collect();
assert.equal(snap.status, 'CONNECTED');
assert(snap.confidence <= 0.95);
```

### ERROR path (mock returns non-OK status)

Use `MockHttpClient` with `status: 500` to verify the adapter returns `ERROR` and
`confidence: 0` without throwing.

### `checks()` determinism

Pass a fixed payload (not a collected snapshot) to verify that the `now` injected clock
is used and that the same payload always produces the same findings.

### `contract.test.ts` — automatic coverage

`test/contract.test.ts` recursively walks all of `src/` and scans stripped executable
code. New adapter files are covered automatically. No test modification is needed to add
a new adapter file to the read-only scan.

The contract test forbids these patterns in executable code (comments and string literals
are stripped first):

| Forbidden pattern | Reason |
|---|---|
| `fetch(` outside `shared/http.ts` | Raw network calls bypass the GET-only host-allowlisted boundary |
| `child_process` | Arbitrary command execution |
| `\bspawn\s*\(` | Arbitrary command execution |
| `\bexecSync\b` | Synchronous arbitrary command execution |
| `\bexec\s*\(` | Asynchronous arbitrary command execution |
| `\beval\s*\(` | Arbitrary code evaluation |
| `new Function` | Arbitrary code evaluation |
| `writeFileSync` | Filesystem write |
| `appendFileSync` | Filesystem write |
| `\bwriteFile\s*\(` | Filesystem write |
| `rmSync` | Filesystem delete |
| `unlinkSync` | Filesystem delete |
| `\bmkdirSync` | Filesystem creation |

---

## 8. Checklist Before Opening a PR

- [ ] `src/<slug>/types.ts` — Zod schemas + `readonly` payload interface with `facts: readonly LiveFact[]`.
- [ ] `src/<slug>/<ClassName>.ts` — extends `AdapterBase`; uses `this.http.get` only; uses `this.now()` in `checks()`; confidence ≤ 0.85 when paginated.
- [ ] `src/<slug>/index.ts` — re-exports adapter class and types.
- [ ] `src/catalog.ts` — import, `createFullAdapterSet()` entry with correct host list, `SIGNAL_CATALOG` entries (honest `reachable: false` where needed), `WEBHOOK_CATALOG` entries if applicable.
- [ ] `src/index.ts` — `export * from './<slug>/index'`.
- [ ] Tests cover: NOT_CONNECTED, CONNECTED, ERROR, `checks()` determinism with fixed clock.
- [ ] `contract.test.ts` passes (`pnpm typecheck test --filter=@letbuyy/lcis-adapters`).
- [ ] No `Date.now()` or `new Date()` in `checks()` — use `this.now()`.
- [ ] No raw `fetch(`, no mutation primitives, no `child_process`.
- [ ] `snapshotTtlMs()` overridden if the default 60 s is not appropriate.
