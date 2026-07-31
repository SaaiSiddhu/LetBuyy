# LSAS Architecture — Security Analytics System (Phase 14)

**Package:** `packages/lcis-security` (`@letbuyy/lcis-security`)
**Entry point:** `src/index.ts`
**Facade:** `SecurityAnalyticsEngine` — `createSecurityAnalyticsEngine` / `getSecurityAnalyticsEngine` / `resetSecurityAnalyticsEngine`
**Flagship output:** `generateSecurityReport(): SecurityReport`

LSAS is a read-only, deterministic security intelligence layer. It composes findings from
governance drift, the dependency twin, operations signals, change tracking, and adapter secret
posture into one unified `SecurityReport`. No new intelligence is invented here; every finding
traces to a concrete upstream source. No mutation, no AI, advisory-only recommendations.

---

## 1. Composition overview

```
SecurityAnalyticsEngine
  ├─ ThreatIntelligenceService   ← lcis-governance SecurityDriftService
  ├─ AttackGraphService          ← lcis-twin shortestPath + db-intel.json
  ├─ IdentitySecretService       ← lcis-adapters SIGNAL_CATALOG + CredentialProvider
  ├─ AbuseComplianceService      ← lcis-operations SecurityOperationsService
  │                                 lcis-governance ComplianceService
  ├─ SecurityTimelineService     ← lcis-tracking TrackingEngine
  └─ RiskScoringService          ← pure: SEC01–SEC08 weighted aggregate
```

The facade assembles all six service outputs, calls `RiskScoringService.score()`, builds the
summary string, and stamps everything via the `security()` envelope. The result is a single
`SecurityReport` that satisfies the frozen `SecurityArtifact` contract (evidence, confidence,
sources, timestamp, liveConnected).

---

## 2. Frozen type vocabulary (`src/shared/types.ts`)

The type vocabulary is frozen: no service may create types, only consume them.

| Type | Description |
|---|---|
| `SecurityFinding` | Base: id, rule, category, severity, subject, title, detail, connection, evidence |
| `Threat extends SecurityFinding` | Adds `vector` — attacker-centric framing of the finding |
| `Vulnerability extends SecurityFinding` | Adds `weakness` — concrete table/rpc/route needing remediation |
| `AttackPath` | id, entry, target, path (twin node ids), hops, severity, connection, evidence |
| `AttackGraph` | paths, entryPoints, sensitiveTargets, summary |
| `SecretPosture` | key, requiredEnv, present (presence only — value never read), usedBy, connection, evidence |
| `TokenPosture` | issuer (4 values), algorithm, requiredEnv, present, detail, connection, evidence |
| `IdentitySurface` | surface, detail, connection (always NOT_CONNECTED), liveSource, evidence |
| `AbuseSignal` | kind, subject, detail, connection (always NOT_CONNECTED), liveSource, evidence |
| `ComplianceItem` | rule, title, status (COMPLIANT/VIOLATED/UNKNOWN), detail, evidence |
| `SecurityTimelineEntry` | id, at (nullable — never fabricated), kind, subject, detail, connection, evidence |
| `SecurityRiskScore` | score (0–100), band, criticalCount, highCount, connectedSignals, notConnectedSignals, drivers |
| `SecurityHealth` | band (healthy/degraded/failing/unknown), score (0–100 or null), connectedSignals, notConnectedSignals |
| `SecurityRecommendation` | id, rule, `advisory: true` (literal, enforced by test), action, rationale, severity, evidence |
| `SecurityReport extends SecurityArtifact` | All of the above + summary + provenance fields |

The `advisory: true` literal in `SecurityRecommendation` is verified at the source level by
`test/security.test.ts` — the test reads and strips the source of `RiskScoringService.ts` and
asserts the literal is present outside comments.

---

## 3. Security rules SEC01–SEC08 (`src/shared/rules.ts`)

Rules are declarative metadata only. No rule carries an execution path. The weights are the
calibration constants of the deterministic risk scorer.

| Rule | Title | Severity | Weight |
|---|---|---|---|
| SEC01 | Missing RLS on tenant table | critical | 12 |
| SEC02 | Dangerous / public policy | critical | 10 |
| SEC03 | Public mutation path | high | 8 |
| SEC04 | Cross-tenant risk | critical | 11 |
| SEC05 | Missing auth on route | high | 7 |
| SEC06 | Missing input validation | medium | 4 |
| SEC07 | Missing security test | medium | 3 |
| SEC08 | Attack path to sensitive data | high | 9 |

`SecurityRuleRegistry.list()` returns the full set; `.get(id)` returns a single rule or
`undefined`. No rule is mutable after module load.

---

## 4. Service compositions

### 4.1 ThreatIntelligenceService — governance SecurityDriftService

Source: `src/threat/ThreatIntelligenceService.ts`

Delegates 100% to `createGovernanceEngine({core, now}).security.generateSecurityDriftReport()`.
The returned `Finding[]` are mapped in two framings:

- **`threats()`** — attacker-centric. Each finding becomes a `Threat` with a `vector` string
  derived from a fixed `CATEGORY_TO_VECTOR` map. Vectors include strings such as
  "Unauthenticated cross-tenant row access via missing RLS gate" and
  "Money mutation callable without SECURITY DEFINER ownership".

- **`vulnerabilities()`** — defender-centric. Same findings, `weakness` = `finding.subject`
  (the concrete table/rpc/route). This is intentional dual-framing, not duplication.

Both methods sort findings by `id` for determinism and return `[]` on any error (never throw).
The kind → SEC rule mapping is:

```
missing-rls           → SEC01   cross-tenant-risk    → SEC04
dangerous-policy      → SEC02   missing-auth         → SEC05
public-mutation       → SEC03   missing-validation   → SEC06
missing-security-test → SEC07   sensitive-domain-violation → SEC08
```

All structural findings are `connection: 'CONNECTED'` — they come from the governance static
code graph, not from live telemetry.

### 4.2 AttackGraphService — twin shortestPath

Source: `src/attack/AttackGraphService.ts`

Delegates to `createTwinEngine({core, now}).buildTwin()` and `shortestPath(entry, target)`.
The twin's BFS shortest-path is used; this service never re-implements path-finding.

**Entry points** (public attack surfaces):
- All twin nodes with `layer === 'api'` (public HTTP surfaces; the twin builder emits routes
  as `api:<path>` nodes).
- All `policy:` nodes whose backing `db-intel.json` policy has `public === true`.

**Sensitive targets** (money and tenant tables):
- Table nodes in the fixed canonical money set:
  `orders`, `payment_transactions`, `refunds`, `payouts`,
  `gift_card_accounts`, `gift_card_ledger_entries`.
- Table nodes with any policy where `usesSiteId === true` (tenant-isolated tables).

For each sorted `(entry, target)` pair, `shortestPath` is called. Paths with `found && hops > 0`
become `AttackPath` objects with id `ATK-<n>`. Severity: `hops <= 2` → `'high'`, otherwise
`'medium'`. Total paths are capped at 50; the summary notes the cap when hit. Paths are sorted
high-before-medium then by id. All paths carry `connection: 'CONNECTED'`.

`db-intel.json` is parsed with Zod loose schemas (all fields optional, `passthrough()`). An
absent or malformed file returns an honest empty topology, never throws.

### 4.3 IdentitySecretService — SIGNAL_CATALOG + CredentialProvider

Source: `src/identity/IdentitySecretService.ts`

**`secrets()`** — iterates `SIGNAL_CATALOG` from `@letbuyy/lcis-adapters`, skips entries with
no `requiredEnv`, deduplicates by `sorted(requiredEnv).join(',')`, sorts by that key for
determinism, then calls `CredentialProvider.check(requiredEnv)` for presence. The secret value
is never read — only presence is recorded. `connection` is `'CONNECTED'` when present,
`'NOT_CONNECTED'` otherwise.

**`tokens()`** — the four constitutional token issuers are a fixed list defined in
`ISSUER_DEFS` (source of truth: `CLAUDE.md` + `TokenPosture.issuer` union):

| Issuer | Algorithm | Required env var |
|---|---|---|
| `customer-session` | HS256 | `CUSTOMER_SESSION_SECRET` |
| `merchant-identity` | ES256 | `LETBUYY_IDENTITY_PUBLIC_JWKS` |
| `step-up` | HMAC | `STEP_UP_SECRET` |
| `queue-envelope` | HMAC | `QUEUE_TENANT_ENVELOPE_SECRET` |

These issuers are derived from the LCIS constitution and are never added to dynamically.
`connection` tracks `CredentialProvider.check()` against the required env var.

**`identitySurfaces()`** — a fixed structural list of five auth surfaces
(`customer-login`, `merchant-oauth`, `step-up`, `turnstile-gate`, `rate-limit`). All surfaces
carry `connection: 'NOT_CONNECTED'` — live auth failure rates require
`lcis-operations SecurityOperationsService` to be credentialed. The exact `liveSource` string
names the ops service and the env vars required:
`lcis-operations SecurityOperationsService (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.

### 4.4 AbuseComplianceService — SecurityOperationsService + ComplianceService

Source: `src/abuse/AbuseComplianceService.ts`

**`abuseSignals()`** — calls four `SecurityOperationsService` methods:
`detectAbuseSignals()`, `detectAuthAnomalies()`, `detectCredentialEvents()`, `detectSecuritySpikes()`.
Each `OperationalFinding` maps to an `AbuseSignal`. The `NOT_CONNECTED` status is preserved
verbatim — abuse rates require live telemetry and are always `NOT_CONNECTED`. The `liveSource`
field is extracted from the finding's not-connected evidence entries (the `source` field, which
names the env var). `opsStatusToConnection()` maps `NOT_CONNECTED` → `'NOT_CONNECTED'` and
everything else → `'CONNECTED'`.

**`compliance()`** — calls `createGovernanceEngine({core, now}).compliance.generateComplianceReport()`.
Each `RuleEvaluation` maps to a `ComplianceItem`. Governance status `'PARTIAL'` maps to
`'UNKNOWN'` (honest: partial determinability). The detail field includes checked/passed/violated
counts and the first violation title when present. Returns `[]` on any error.

### 4.5 SecurityTimelineService — LCTS TrackingEngine

Source: `src/timeline/SecurityTimelineService.ts`

Delegates to `createTrackingEngine({core, now}).generateTimeline()`. Filters records to those
where `kind` is `'migration'` or `'decision'` AND the detail (case-insensitive) contains at
least one of the security terms:

```
rls  policy  auth  security  refund  payment  payout  gift  ledger  tenant  site_id
```

Maps `ChangeRecord` → `SecurityTimelineEntry`: `at` is preserved as-is including `null` —
never fabricated. Connection is inherited from each record. Returns `[]` on any error.

### 4.6 RiskScoringService — deterministic weighted aggregate

Source: `src/risk/RiskScoringService.ts`

Pure computation — no clock, no I/O, no network, no AI. Constructor takes no arguments.

**Score computation:**
1. For each `Threat`, add the SEC rule's weight to that rule's contribution bucket.
2. For each `AttackPath`, add `SEC08.weight` (9) to the SEC08 bucket.
3. Sum all contributions; cap at 100.

**Band thresholds:**
`score >= 70` → `critical` · `>= 50` → `high` · `>= 30` → `elevated` · `>= 15` → `moderate` · else → `low`

**Health:** `score = 100 - riskScore`. Band: `>= 80` → `healthy` · `>= 50` → `degraded` · else → `failing`.
When there are no connected signals and no threats: `score = null`, band = `'unknown'`.

**Connected/not-connected signal counts:**
- Threats, vulnerabilities, attack paths: counted per their `connection` field.
- `AbuseSignal` entries are always `notConnectedSignals += abuseSignals.length`
  (live telemetry required; always NOT_CONNECTED per spec).
- Compliance items have no connection field and are counted as `connectedSignals`.

**Drivers:** top 5 rule ids sorted by contributed weight (descending).

**Recommendations:** one advisory per distinct threat rule (`SEC01-rec`, `SEC02-rec`, …), plus
one `SEC08-rec` for attack paths when no `SEC08` threat-based rec was already emitted. Sorted
by severity rank (critical first) then id. All carry `advisory: true`.

---

## 5. Provenance envelope (`src/shared/envelope.ts`)

`security<T>(body, opts)` stamps mandatory provenance onto any LSAS output object:

- `evidence` — verbatim from opts
- `confidence` — `confidenceFrom(evidence)`: `0` when all evidence is `not-connected`,
  otherwise `min(0.9, 0.5 + 0.1 * connectedCount)`
- `sources` — deduped `evidence[].source` strings
- `timestamp` — from the injectable `now()` function
- `liveConnected` — defaults to `false`

`defaultNow` (`() => new Date().toISOString()`) is the single sanctioned clock boundary of
the package. The wall-clock ban in `test/security.test.ts` enforces that no other source file
calls `defaultNow()` directly (import is allowed; invocation is forbidden outside `envelope.ts`).

---

## 6. Honesty law

This is a hard architectural invariant, not just a convention:

**Structural findings are CONNECTED.** Governance drift findings (RLS/policy/auth/validation gaps),
attack paths (twin topology), secret presence (CredentialProvider check), and compliance
evaluations are sourced from static analysis of the code graph and db-intel and carry
`connection: 'CONNECTED'`.

**Live security signals are NOT_CONNECTED + exact source.** Every `IdentitySurface`,
`AbuseSignal`, and `NOT_CONNECTED` `SecretPosture` / `TokenPosture` names its exact live
source in `liveSource` or `notConnected` evidence entries. Examples:
- `lcis-operations SecurityOperationsService (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
- `lcis-operations SecurityOperationsService (TURNSTILE_SECRET_KEY)`
- `lcis-operations SecurityOperationsService (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)`

**Risk is computed only over CONNECTED structural signals.** Abuse signals (always NOT_CONNECTED)
contribute to `notConnectedSignals` but never to the risk weight sum. The score is therefore
never inflated by fabricated live values.

**Advisory-only.** `SecurityRecommendation.advisory` is always `true`. The literal is verified
at the source level by `test/security.test.ts`.

**`liveConnected: false`** in every `SecurityReport` envelope. LSAS explicitly marks the
flagship report as not having live data connected. The summary string ends with:
"Live security signals (auth/abuse/credential rates) NOT_CONNECTED — structural analysis only."

---

## 7. Determinism guarantees

- All service outputs are sorted before returning: threats/vulnerabilities by finding id,
  attack paths by severity then id, recommendations by severity rank then id,
  secret postures by the sorted-env-key.
- The clock is always injected (`opts.now ?? defaultNow`) — no argless `Date.now()` or
  `new Date()` outside `envelope.ts` (enforced by `test/security.test.ts`).
- Governance fallback: when `db-intel.json` is absent or malformed, Zod loose parse returns
  an empty topology. No throws; honest empty.
- All delegate calls are wrapped in `try/catch` returning `[]` on error — services never
  throw to the facade.

---

## 8. Module graph

```
@letbuyy/lcis-security
  └─ @letbuyy/lcis-core         (LcisEngine, evidence(), notConnected(), Evidence type)
  └─ @letbuyy/lcis-adapters     (SIGNAL_CATALOG, CredentialProvider)
  └─ @letbuyy/lcis-governance   (createGovernanceEngine → SecurityDriftService, ComplianceService)
  └─ @letbuyy/lcis-operations   (createOperationsEngine → SecurityOperationsService)
  └─ @letbuyy/lcis-tracking     (createTrackingEngine → TrackingEngine.generateTimeline)
  └─ @letbuyy/lcis-twin         (createTwinEngine → buildTwin, shortestPath)
  └─ zod                        (loose parse of db-intel.json in AttackGraphService)
```

No circular dependencies; LSAS is a leaf package in the LCIS composition graph.
The dependency allowlist is enforced verbatim by `test/security.test.ts`:
the test reads `package.json` and calls `assert.deepEqual(deps, [...])` against the exact
seven-element sorted array above.
