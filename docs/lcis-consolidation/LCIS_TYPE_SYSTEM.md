# LCIS Type System (`packages/lcis-core/src/contracts`)

**Phase 4 deliverable.** The canonical, shared type vocabulary every service compiles against. Source of truth: `packages/lcis-core/src/contracts/*.ts` (this doc describes the code; the code is authoritative).

> Design rules: **readonly** everywhere (results are immutable views of repository truth); **evidence-cited** (every assessment carries `Evidence[]`); **no generation naming**; deterministic (no live/probabilistic fields without an explicit absence label). Validation via `zod` where a runtime boundary benefits; plain `interface`s for internal result shapes (zero runtime cost on hot paths).

## Module map

| File | Types |
|---|---|
| `evidence.ts` | `Evidence`, `EvidenceKind`, `evidence()`, `notConnected()` |
| `graph.ts` | `GraphNode`, `GraphEdge`, `EdgeRelation` |
| `architecture.ts` | `ArchitectureNode`, `ArchitectureEdge`, `Domain`, `Service`, `Dependency`, `Explanation`, `Criticality`, `RuntimeKind` |
| `assessment.ts` | `Severity`, `Finding`, `Risk`, `Recommendation`, `RankedRisk`, `RankedFix`, `Decision`, `Incident`, `InrImpactTier` |
| `verification.ts` | `Verification`, `VerificationStatus`, `Gap` |
| `memory.ts` | `MemoryDocument`, `MemoryHit`, `Citation`, `ContextPack` |
| `capability.ts` | `Capability`, `Maturity`, `Disposition` |

## The keystone: `Evidence`

Every answer the engine produces carries provenance, or an explicit absence label — there is no other way to emit a value.

```ts
type EvidenceKind =
  | 'graph-node' | 'graph-edge' | 'file' | 'artifact-field'
  | 'rpc' | 'table' | 'policy' | 'route' | 'worker'
  | 'doc' | 'decision' | 'migration' | 'validator' | 'not-connected';

interface Evidence { kind: EvidenceKind; ref: string; detail?: string; source?: string }
evidence(kind, ref, detail?, source?): Evidence       // builder
notConnected(ref, requiresEnvVar): Evidence           // honest absence — never fabricate a live value
```

`notConnected()` is how the honesty contract is encoded in the type system: a missing live value becomes a first-class `Evidence` of kind `'not-connected'` citing the exact env var — never a fabricated number.

## The 12 canonical entities (mission Phase 4)

| Type | Purpose | Key fields |
|---|---|---|
| `Capability` | a consolidated LCIS capability + its disposition | `id, name, module, sourceFiles[], maturity, disposition` |
| `Domain` | a business domain | `key, label, money, tenant, tables[], rpcs[], criticality` |
| `Service` | a runtime/service | `name, runtime, domains[]` |
| `Dependency` | a directed dependency edge | `from, to, kind, evidence[]` |
| `Risk` | an explainable, scored risk | `score, formula, factors, severity, evidence[]` |
| `Finding` | a discrete observation | `id, title, severity, evidence[]` |
| `Decision` | a recorded architectural decision | `statement, rationale, date?, evidence[]` |
| `Incident` | an incident record | `domain, summary, severity, evidence[]` |
| `Verification` | a verdict that refuses to rubber-stamp | `status, confidence, evidence[], gaps[]` |
| `Recommendation` | a ranked fix/recommendation | `rationale, inrImpact?, evidence[]` |
| `ArchitectureNode` | a node in the architecture graph | `kind, name, layer?, criticality?, evidence[]` |
| `ArchitectureEdge` | a typed architecture edge | `from, to, relation, evidence[]` |

## Explainability is in the types

`Risk` and `RankedFix` carry `formula: string` + `factors: Record<string, number>` — the type system *requires* a transparent score. There is no field for an opaque number; a black-box score cannot be represented.

## Honesty is in the types

`Verification.status` ∈ `VERIFIED | PARTIAL | UNVERIFIED | REFUTED`, with `confidence` capped (structural-only ≤ 0.95). `ContextPack.stale: boolean` + `builtAtMigration?: number` force memory results to declare freshness. `Evidence` of kind `'not-connected'` represents a live value that is required but absent. The types make fabrication unrepresentable.

## No generation naming

No type, field, or identifier references `V1/V2/.../OMEGA/INFINITY`. The `Capability.module` field names the *function* (`graph | blast-radius | memory | decision | architecture | verification | ...`). See `LCIS_GENERATION_REMOVAL_PLAN.md`.
