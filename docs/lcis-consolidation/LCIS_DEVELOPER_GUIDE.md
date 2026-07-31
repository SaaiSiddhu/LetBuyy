# LCIS Developer Guide

## Package Conventions

| Convention | Detail |
|-----------|--------|
| Module format | TypeScript ESM (`"type": "module"` in `package.json`) |
| Imports | Extensionless: `import { ArtifactStore } from '../runtime/ArtifactStore'` |
| Test runner | `tsx --test test/*.test.ts` via `node:test` built-in |
| Build | `tsc -b` (composite build; output in `dist/`) |
| Typecheck only | `tsc --noEmit` |

---

## The Dependency Rule

The rule is structural and tested by `contract.test.ts`:

```
contracts/   imports: nothing (no project imports)
runtime/     imports: node:fs, node:path only
graph/       imports: contracts + runtime
services/    imports: contracts + runtime + graph
             services NEVER import each other
```

Concrete example of what is forbidden:

```ts
// FORBIDDEN in DecisionService.ts:
import { BlastRadiusService } from '../blast-radius/index';  // service→service

// FORBIDDEN in runtime/ArtifactStore.ts:
import { GraphService } from '../graph/GraphService';        // runtime→graph
```

---

## Forbidden Dependencies

The contract test asserts `Object.keys(pkg.dependencies ?? {}).sort()` equals
`['zod']`. The regex that identifies forbidden packages is:

```
/qdrant|openai|graphrag|crawl4ai|playwright|signoz|@opentelemetry|chromadb|pinecone|weaviate/i
```

Any of these added to `dependencies` in `packages/lcis-core/package.json` will
fail the contract test immediately.

---

## No Generation Names in File Paths

The regex `GENERATION = /^(v\d+|omega|infinity|genesis)$/i` is applied to every
path segment (split on `[\\/_.-]`) in every `.ts` source file under `src/`.

Forbidden examples:
- `src/v2/SomeService.ts` — `v2` matches
- `src/blast-radius/omega-blast.ts` — `omega` matches

Allowed examples:
- `src/blast-radius/BlastRadiusService.ts`
- `src/decision/artifacts.ts`

---

## Evidence-Cited Rule

Every `Answer`, `Explanation`, and `Verification` returned by a service must cite
the specific artifact field or source file that supplied its content. Use the
`evidence()` factory from `contracts/`:

```ts
import { evidence } from '../contracts/index';

evidence('artifact-field', 'domains[key=payments].money', 'true', 'graphify-out/domain-intel.json')
evidence('file', 'NARRATIVE.payments', JSON.stringify(narrative), 'tools/graph-server/explain-intel.mjs')
evidence('not-connected', 'graphify-out/connections-intel.json', 'NOT CONNECTED — generate with pnpm graph:omega', 'graphify-out/')
```

For live sources that are not yet wired, use `notConnected()`:

```ts
import { notConnected } from '../contracts/index';
notConnected('Supabase: SUPABASE_SERVICE_ROLE_KEY', 'graphify-out/connections-intel.json')
```

---

## Deterministic Rule

Same artifact input → same output. Forbidden patterns:

- `Math.random()`, `Date.now()` in any service method
- Calling external APIs or network sockets
- Referencing environment variables beyond what `findRepoRoot()` uses (`process.cwd()`)

The contract test ensures no forbidden runtime dependencies exist. Services are
pure functions over their artifact inputs.

---

## Advisory Rule

Services must never:
- Write to any production system
- Gate a PR (only `scripts/validate-governance.mjs` is a merge gate)
- Mutate `graphify-out/` artifacts

Results are advisory. A `REFUTED` status from `VerificationService` may surface
as a PR advisory comment but must never block a merge unilaterally.

---

## How to Add a New Service

Follow the `BlastRadiusService` pattern:

**Step 1.** Create `src/<capability>/types.ts` for this service's result types.

**Step 2.** Create `src/<capability>/<Service>Service.ts`. Constructor must take
`store: ArtifactStore` and/or `graph: GraphService` — no other imports from the
service layer.

```ts
export class CatalogService {
  constructor(
    private readonly graph: GraphService,
    private readonly store: ArtifactStore,
  ) {}

  someMethod(): SomeResult | null {
    const data = this.store.tryRead<RawCatalog>('catalog-intel');
    if (!data) return null;
    // ... deterministic logic ...
    return { /* result with evidence[] */ };
  }
}
```

**Step 3.** Create `src/<capability>/index.ts` re-exporting the service and types.

**Step 4.** Add `export * from './<capability>/index';` to `src/index.ts`.

**Step 5.** Add `'<capability>'` to the list in the contract test (`contract.test.ts`
test 3) so the barrel check covers the new module.

**Step 6.** Create `test/<capability>.test.ts`. Follow these patterns:
- Read real artifacts: `ArtifactStore.default()` + `GraphService`
- Conservative thresholds: `assert.ok(count >= 5, ...)` not `=== 5`
- Skip on absent optional artifacts: `{ skip: !store.has('catalog-intel.json') }`
- No mocks, no network, no randomness

---

## MemoryService Staleness

`buildContext()` returns `stale: true` when `builtAtMigration < latestMigrationN`.
The private `_simulateStale(n)` method is available for tests to force this
condition without requiring two memory-intel.json versions:

```ts
svc._simulateStale(0);
const pack = svc.buildContext('some query');
assert.equal(pack.stale, true);
```

This is a test helper only. Do not use it in service code.
