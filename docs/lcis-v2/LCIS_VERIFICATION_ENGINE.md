# LCIS V3 Verification Engine

**Phase 27 · `tools/central-intelligence/verification-engine/`**

The VerificationEngine is the evidence-checking layer of LCIS V3. It cross-checks every conclusion produced by the intelligence stack — recommendations, predictions, investigations, execution results, and architectural findings — against independent authoritative and structural sources before those conclusions reach operators or downstream systems.

Its core principle: verification is not rubber-stamping. A claim is `VERIFIED` only when two or more independent sources corroborate it. A claim backed by a single source is `PARTIAL`. A claim that no source can corroborate is `UNVERIFIED`. When an authoritative gate explicitly contradicts a claim, the result is `REFUTED` — regardless of how confident the originating engine was.

---

## 1. Purpose

LCIS V2 can produce recommendations, predictions, investigation reports, and architecture findings from structural topology, memory retrieval, and reasoning engines. Those outputs are valuable, but they need independent validation before being acted on. The VerificationEngine provides that validation by:

- Routing each conclusion to a type-specific verifier.
- Consulting multiple independent sources (V1 LCIS, architecture intelligence, memory, graph blast radius, the 107-validator gate, the RLS gate, the canonical ledger).
- Producing a structured `VerificationResult` that records what was checked, what was found, what is missing, and which sources are not yet connected.
- Persisting every result to an append-only JSONL ledger.

---

## 2. What It Verifies

Five conclusion types are handled by dedicated verifiers. All other types fall through to a generic verifier that queries V1 LCIS search.

| Type | What the verifier checks |
|---|---|
| `recommendation` | Schema validity via `RecommendationValidator`; evidence quality score via `EvidenceVerifier`; stated confidence plausibility against evidence quantity (>80% confidence with <2 evidence items flags overclaiming); `expectedImpact.scope` and `expectedImpact.benefit` presence; at least one connected evidence source for feasibility |
| `prediction` | `basis` field presence; structural blast radius for `target` via V1 `/api/blast` (returns `REFUTED`-eligible evidence when no blast data exists); memory cross-check for prediction text via `MemoryRetriever`; confidence justification (structural-only basis capped at 0.85 — exceeding this is flagged) |
| `investigation` | Timeline coherence (`timelines.incident` must exist and have events); root-cause candidate presence and evidence support; affected-set vs V1 blast radius overlap (< 50% coverage flagged); stated confidence presence |
| `execution` | `safe` / `readOnly` flag presence and value; audit entry presence (`auditId` / `auditEntry` / `ledgerEntry`); timestamp presence for traceability |
| `architecture` | V1 `/api/architecture` cross-check (keyword overlap against finding description/title); `ArchitectureIntelligenceEngine.getSnapshot()` cross-check; drift report check when `type === 'drift'`; blast radius for `subject` / `component` via V1 `/api/blast`; severity / impact / priority presence |

---

## 3. Evidence-Based Cross-Checking

### The never-rubber-stamp principle

The VerificationEngine does not affirm a conclusion by default. Every verifier builds an `evidence` array by actively querying independent sources and annotating each item with `corroborates: true` or `corroborates: false`. Status is derived from that array — not from the originating engine's stated confidence.

### Authoritative sources that can REFUTE

Five sources carry the authority to change a result to `REFUTED` when `corroborates: false`:

| Source key | What it represents |
|---|---|
| `v1-lcis` | V1 LCIS at `localhost:3333` — the 107-validator structural truth |
| `security-gate` | The security validator gate |
| `107-validators` | The deterministic 107-validator suite |
| `rls-gate` | The Row-Level Security policy gate |
| `canonical-ledger` | The canonical money ledger gate |

A single `corroborates: false` item from any of these five sources produces `REFUTED`, overriding any number of corroborating items from other sources.

### Sources that corroborate but cannot REFUTE

| Source key | Authority weight |
|---|---|
| `domain-graph` | 0.70 |
| `arch-intel` | 0.70 |
| `fix-engine` | 0.70 |
| `memory-engine` | 0.50 |
| `prediction-engine` | 0.50 |

These sources contribute to confidence and corroboration count but cannot alone produce `REFUTED`.

---

## 4. The Four Statuses

Status is derived by `deriveStatus(evidence, confidence)` after confidence is calculated. The rules are evaluated in priority order.

| Status | Rule |
|---|---|
| `REFUTED` | Any evidence item has `corroborates: false` **and** its source is one of the five authoritative gates (`v1-lcis`, `security-gate`, `107-validators`, `rls-gate`, `canonical-ledger`) |
| `VERIFIED` | No refuting evidence **and** ≥ 2 independent corroborating sources **and** `confidence ≥ 0.60` |
| `PARTIAL` | No refuting evidence **and** (≥ 1 corroborating source **or** `confidence` between 0.30 and 0.60) |
| `UNVERIFIED` | No corroborating sources **or** `confidence < 0.30` |

`verified: boolean` in the result is `true` only when `status === 'VERIFIED'`.

---

## 5. Class Reference

### `VerificationEngine` — `VerificationEngine.mjs` (687 lines)

Singleton export (`export default new VerificationEngine()`). Entry point for all verification.

| Method | Description |
|---|---|
| `verify(conclusion)` | Routes by `conclusion.type` to the appropriate specialist verifier. Returns a `VerificationResult`. |
| `verifyRecommendation(rec)` | Validates recommendation schema, evidence quality, confidence, and `expectedImpact`. |
| `verifyPrediction(prediction)` | Checks basis, blast radius, memory precedents, confidence cap. |
| `verifyInvestigation(investigation)` | Checks timeline, root-cause candidates, affected-set vs blast. |
| `verifyExecutionResult(result)` | Checks `safe` flag, audit entry, timestamp. |
| `verifyArchitecturalFinding(finding)` | Cross-checks against V1 architecture, arch snapshot, drift, blast, severity. |
| `getVerification(id)` | Returns a cached or ledger-persisted result by ID. |
| `getVerificationReport()` | Returns ledger stats + the 20 most recent entries + `notConnected` notice. |

**Lazy imports.** Sibling engines (`RecommendationValidator`, `PredictionEngine`, `InvestigationEngine`, `ArchitectureIntelligenceEngine`, `GraphExplorer`, `MemoryRetriever`) are loaded via `import()` on first use and cached in a module-level `Map`. A failed import returns `null`; the verifier continues with reduced evidence and marks the missing source as `NOT CONNECTED`.

**V1 integration.** `fetchV1(endpoint, timeout = 4000)` is used for blast radius (`/api/blast?q=`), architecture (`/api/architecture`), and generic search (`/api/search?q=`). Returns `null` when V1 is not running; the caller marks the source as `NOT CONNECTED` with the exact reason.

---

### `EvidenceVerifier` — `EvidenceVerifier.mjs`

Singleton export. Cross-checks individual evidence items against known source registries and queries independent sources for corroboration or contradiction.

| Method | Description |
|---|---|
| `verifyEvidence(evidence)` | Annotates each item with `traceable`, `category`, and `note`. Categories: `authoritative`, `structural`, `operational`, `live-connected`, `live-disconnected`, `unknown`. |
| `scoreEvidence(evidence)` | Returns a 0–1 strength score: `(traceableCount × 0.4 + corroboratingCount × 0.6) / evidenceCount`, capped at 1.0. |
| `crossCheck(claim, sources)` | Queries V1 search, arch snapshot, graph explorer, and memory for agreement; returns `{ agreement, agreeing, disagreeing, notConnected }`. |
| `findCorroboration(claim)` | Searches V1, domain blast, and memory for facts supporting the claim. |
| `findContradiction(claim)` | Checks V1 audit violations and architecture drift report for facts contradicting the claim. |

Source authority weights used internally (from `ConfidenceCalculator`): authoritative gates = 1.00, structural = 0.70, operational = 0.50, live-connected = 0.90, live-disconnected = 0.20, unknown = 0.30.

---

### `ConfidenceCalculator` — `ConfidenceCalculator.mjs`

Singleton export. Pure deterministic scoring; no side effects.

| Method | Description |
|---|---|
| `calculate(verification)` | Computes weighted corroboration ratio, applies NOT-CONNECTED gap penalty (−0.08 per gap), and caps at 0.95 (structural-only) or 1.00 (live-connected). Applies extra −0.40 penalty for `REFUTED`. |
| `weightSource(source)` | Resolves a source string to its authority weight (with substring-match fallbacks). |
| `combineConfidences(scores)` | Weighted mean of multiple `{ score, weight }` pairs. |
| `explainConfidence(verification)` | Returns a human-readable multi-line breakdown of how confidence was computed. |

---

### `VerificationLedger` — `VerificationLedger.mjs`

Singleton export. Append-only JSONL persistence to `graphify-out/verification/ledger.jsonl`.

| Method | Description |
|---|---|
| `record(verification)` | Appends a new entry with `ledgerEntryId` and `recordedAt` added. Never modifies existing lines. |
| `getVerification(subjectId)` | Returns the most recent entry for a given `subjectId`, or `null`. |
| `getLedger(filter?)` | Returns entries filtered by `status`, `type`, `since` (ISO date), and `limit` (default 500). Most recent first. |
| `getUnverifiedClaims()` | Returns all entries with `status === 'UNVERIFIED'` or `PARTIAL` with no evidence. |
| `getStats()` | Returns `{ total, verified, partial, unverified, refuted, ledgerPath }`. |

---

## 6. VerificationResult Schema

Every call to `verify()` returns a `VerificationResult`.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Generated ID (`vr-{timestamp}-{hex}`) |
| `subjectId` | `string` | `conclusion.id` if present, otherwise same as `id` |
| `subject` | `object` | The original conclusion object |
| `type` | `string` | The conclusion type as dispatched |
| `verified` | `boolean` | `true` only when `status === 'VERIFIED'` |
| `status` | `'VERIFIED' \| 'PARTIAL' \| 'UNVERIFIED' \| 'REFUTED'` | Derived by `deriveStatus()` |
| `confidence` | `number` | 0–1, rounded to 3 decimal places |
| `evidence` | `Array<{ source: string, corroborates: boolean, fact: string }>` | Every source consulted and its finding |
| `sources` | `string[]` | Deduplicated list of all source keys in `evidence` |
| `gaps` | `string[]` | What evidence could not be collected or was structurally missing |
| `notConnected` | `string[]` | Sources that would improve confidence if connected, in the form `"source (NOT CONNECTED — exact reason)"` |
| `verifiedAt` | `string` | ISO-8601 timestamp of the verification |

---

## 7. Confidence Formula

### When `ConfidenceCalculator` is available (primary path)

```
raw = Σ (authority_weight(source_i) × corroborates_i) / Σ authority_weight(source_i)

penalised = raw − (notConnectedCount × 0.08)

cap = 0.95   when no live-connected source contributed
    = 1.00   when at least one live-connected source contributed

refutedPenalty = 0.40 if status === 'REFUTED', else 0

confidence = clamp(penalised − refutedPenalty, 0, cap)
```

Authority weights: `v1-lcis` / `107-validators` / `security-gate` / `rls-gate` / `canonical-ledger` = **1.00**; `arch-intel` / `domain-graph` / `fix-engine` (and other structural) = **0.70**; `memory-engine` / `v2-ops` / `decision-v2` (and other operational) = **0.50**; `live-connected` = **0.90**; `live-disconnected` = **0.20**; unknown = **0.30**.

### When `ConfidenceCalculator` is unavailable (fallback path)

```
raw = corroborating_count / total_evidence_count

confidence = clamp(0, 0.95, raw − notConnected.length × 0.08)
```

This simpler fallback treats all sources equally but preserves the NOT-CONNECTED gap penalty and the 0.95 structural cap.

### Structural-only cap

A prediction with `basis === 'structural'` and `connected === false` that asserts `confidence > 0.85` is flagged in `gaps` as "Structural-only basis but confidence > 85% — exceeds structural cap". The cap is enforced in the verifier logic, not just flagged.

---

## 8. The Ledger

**Path:** `graphify-out/verification/ledger.jsonl`

**Contract:** The ledger is append-only. `VerificationLedger.record()` uses `appendFileSync` — it never opens the file in write or truncate mode. Re-verifying the same subject produces a new line with a new `ledgerEntryId` and `recordedAt` timestamp. The history of all prior verifications for a subject is preserved and queryable via `getLedger({ type, status, since })`.

**`ledgerEntryId` format:** `ve-{Date.now()}-{6 random chars}` (e.g., `ve-1718880000000-a3f7c2`).

**Stats available via `getStats()`:**

| Field | Description |
|---|---|
| `total` | Total line count in the ledger |
| `verified` | Count with `status: 'VERIFIED'` |
| `partial` | Count with `status: 'PARTIAL'` |
| `unverified` | Count with `status: 'UNVERIFIED'` |
| `refuted` | Count with `status: 'REFUTED'` |
| `ledgerPath` | Absolute path to the ledger file |

The ledger is gitignored (under `graphify-out/`) and survives across LCIS restarts as long as the `graphify-out/verification/` directory is preserved.

---

## 9. API Endpoints

The VerificationEngine is exposed via the LCIS V2 intelligence API server at `tools/central-intelligence/intelligence-api/server.mjs` (lines 1029–1040).

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/intelligence/verify` | `{ conclusion: object }` | Routes `conclusion` by `conclusion.type` to the appropriate verifier. Returns a `VerificationResult`. Returns `400` if `conclusion` is missing from the body. |
| `GET` | `/intelligence/verify/report` | — | Returns `{ generatedAt, stats, recent: last 20 entries, notConnected }` from the ledger. |

Both endpoints return `503` if the VerificationEngine fails to load.

---

## 10. Honesty Contract

The VerificationEngine inherits and enforces the LCIS honesty law without exception.

**Structural topology is CONNECTED.** Evidence from the code graph, domain graph, and architecture snapshots (all derived from `graphify-out/` artifacts) is available and marked as such.

**Live telemetry is NOT CONNECTED until an adapter is wired.** When V1 LCIS is not running on `localhost:3333`, every `fetchV1()` call returns `null`. The verifier records the source as `NOT CONNECTED — localhost:3333 not responding` in `notConnected`, and the gap penalty (−0.08) is applied to confidence. The engine never fabricates a V1 response.

**REFUTED is returned when warranted.** When an authoritative gate produces `corroborates: false`, the engine returns `REFUTED` even if the originating engine stated 95% confidence. There is no override path and no override mechanism in the code.

**`notConnected` is always populated with the exact source and reason.** For example: `"v1-lcis blast API (NOT CONNECTED — localhost:3333 not responding)"`, `"memory-engine (NOT CONNECTED — sibling unavailable)"`. Operators can read the exact connection requirement and act on it.

---

## 11. Proven in Production

### REFUTED case confirmed

`VerificationEngine.verifyPrediction()` returned `status: 'REFUTED'` for a prediction with these properties:

- `target` field present, but V1 `/api/blast` returned no blast radius data — the V1 evidence item was recorded as `corroborates: false` from source `v1-lcis`.
- `MemoryRetriever` unavailable — no memory precedents found; source marked NOT CONNECTED.
- `basis === 'structural'`, `connected === false`, `confidence > 0.85` — flagged in `gaps` as exceeding the structural cap.

Because the V1 blast-radius evidence item had `corroborates: false` and source `v1-lcis` (an authoritative refuting gate), `deriveStatus()` returned `REFUTED` immediately, overriding any positive evidence that might have existed elsewhere. The result was persisted to the ledger and returned to the caller as `verified: false, status: 'REFUTED'`.

This demonstrates that the engine cannot be coerced into confirming a structurally uncorroborated claim by setting a high stated confidence.
