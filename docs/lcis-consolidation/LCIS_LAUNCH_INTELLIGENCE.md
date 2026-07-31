# LCIS Launch Intelligence

`LaunchIntelligenceService` + `VerificationPlanner` — Deliverables 6 and 7 of the EIS.

**Files:**
- `packages/lcis-execution/src/launch/LaunchIntelligenceService.ts`
- `packages/lcis-execution/src/launch/VerificationPlanner.ts`

---

## 1. Responsibilities

### `LaunchIntelligenceService`

Evaluates launch readiness for a change. Reads two artifacts:
- `graphify-out/launch-command-center.json` (`RawLaunchCommandCenter`)
- `graphify-out/production-readiness-v2.json` (`RawProductionReadinessV2`)

Produces a `LaunchPlan` artifact containing readiness score, blockers, checklist, and a GO/CONDITIONAL_GO/NO_GO decision.

### `VerificationPlanner`

Builds a structured `VerificationPlan` from a `ChangeAnalysis`: pre-merge gates, post-deploy checks, and numbered verification checks (VC-01 through VC-09, conditionally).

---

## 2. Async Boundary

`evaluateLaunch()` is the only `async` method in the EIS package. It runs four sub-methods concurrently:

```typescript
const [readiness, decision, blockers, checklist] = await Promise.all([
  this.calculateLaunchReadiness(input),
  this.generateGoNoGoDecision(input),
  this.detectLaunchBlockers(input),
  this.generateLaunchChecklist(input),
]);
```

All four sub-methods are themselves `async`. The concurrency is internal — callers await `evaluateLaunch()`.

---

## 3. Readiness Score

`calculateLaunchReadiness(input): Promise<number>`

Returns a value in `[0, 1]` rounded to 2 decimal places.

Base: `prv2.summary.overall / 100` (default `0.5` when artifact is absent).

Penalty deductions:

| Condition | Penalty |
|-----------|---------|
| `risk.money === true` | −0.10 |
| `risk.tenant === true` | −0.05 |
| `risk.level === 'critical'` | −0.08 |
| `risk.level === 'high'` | −0.04 |

Penalties stack. The result is clamped to `[0, 1]`. A critical money change from a 90%-ready platform scores at most `0.90 − 0.10 − 0.08 = 0.72`.

---

## 4. Launch Blockers

`detectLaunchBlockers(input): Promise<LaunchBlocker[]>`

Each `LaunchBlocker` carries `state: 'KNOWN' | 'UNKNOWN'`.

Sources of blockers:

**From `launch-command-center.json`:** one blocker per entry in `lcc.blockers`. Severity parsed from the severity string (emoji-aware: `🔴`/critical/red → `'critical'`; `🟠`/high/orange → `'high'`; `🟡`/medium/yellow → `'medium'`; else `'low'`).

**When artifact is absent:** one `UNKNOWN` blocker with id `UNKNOWN-LCC` and severity `'high'`.

**Money path:** when `analysis.risk.money` and no `prv2` system shows payment/commerce at ≥ 90%:
- id: `RISK-MONEY-PATH`
- severity: `'critical'`
- State: `'KNOWN'` when `lcc` is available, `'UNKNOWN'` otherwise

**Tenant:** when `analysis.risk.tenant`:
- id: `RISK-TENANT-RLS`
- severity: `'high'`
- State always: `'KNOWN'`
- Title: "Tenant-facing change — RLS isolation and `verifySiteOwnership` must be verified before launch (affects ALL merchants on shared schema)"

---

## 5. Launch Checklist

`generateLaunchChecklist(input): Promise<LaunchChecklistItem[]>`

Returns 6–8 items depending on change risk.

| Area | Requirement | MET/UNMET/UNKNOWN condition |
|------|-------------|----------------------------|
| readiness | Structural readiness ≥ 80% | MET when `prv2.summary.overall >= 80`; UNKNOWN when artifact absent |
| readiness | No open launch blockers | MET when `lcc.summary.openBlockers === 0`; UNKNOWN when artifact absent |
| tests | Affected tests identified | MET when `affected.tests.length > 0`; UNKNOWN when 0 |
| migration | Migration declared and reversible | MET when `lcc.openMigrations.latestDeclared` present; UNKNOWN when absent |
| rollback | Rollback plan present | Always MET (structural — canonical rollback RPCs always exist) |
| security | Security dimension ≥ 80 | MET/UNMET from `prv2.dimensions`; UNKNOWN when absent |
| security | RLS isolation confirmed (only when tenant) | Always UNKNOWN (live check; cannot confirm structurally without `SUPABASE_SERVICE_ROLE_KEY`) |
| observability | Observability/Telemetry dimension ≥ 80 | MET/UNMET from `prv2.dimensions`; UNKNOWN when absent |

The rollback item is always MET because the canonical rollback RPCs exist structurally. The RLS item is always UNKNOWN — it requires a live Supabase probe.

---

## 6. GO/NO-GO Decision Rules

`generateGoNoGoDecision()` applies rules in this priority order (honesty-first):

```
1. A KNOWN critical or high blocker      → NO_GO
2. An UNMET checklist item               → NO_GO
3. UNKNOWN blockers OR unknown items     → CONDITIONAL_GO
4. Required artifacts absent             → CONDITIONAL_GO
5. open blockers > 0                     → NO_GO  (re-check against lcc)
6. readiness ≥ 80% AND open = 0 AND risk ≠ critical → GO
7. Otherwise                             → CONDITIONAL_GO
```

The `unknowns` list in `GoNoGoDecision` surfaces every checklist UNKNOWN item and every absent artifact. Nothing is silently passed:

> "An item that cannot be determined → UNKNOWN (surfaced, never silently passed)"

The decision is returned as a `GoNoGoDecision` artifact with its own `PlanArtifact` provenance:

```typescript
interface GoNoGoDecision extends PlanArtifact {
  decision: 'GO' | 'CONDITIONAL_GO' | 'NO_GO';
  rationale: string;
  blockers: LaunchBlocker[];
  unknowns: string[];
}
```

---

## 7. `VerificationPlanner` — Checks and Gates

`buildVerificationPlan(input): VerificationPlan`

Synchronous. Produces:

```typescript
interface VerificationPlan extends PlanArtifact {
  request: ChangeRequest;
  checks: VerificationCheck[];      // numbered VC-01 through VC-09
  preMergeGates: string[];
  postDeployChecks: string[];
}
```

### Pre-merge gates (always present)

1. `pnpm typecheck (tsc --noEmit) — zero errors required`
2. `node scripts/validate-governance.mjs — 107-validator gate GREEN`
3. `blast re-check on changed symbols: graph:intel blast "<changed-symbol>"`
4. Run N affected test files (or "no test files in blast radius — add coverage")

**Money additions:**
- canonical-ledger-only-validator: zero violations
- blast re-check on money RPCs: `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`
- Razorpay HMAC-SHA256 signature verification path confirmed present (`timingSafeEqualHex`)
- `idempotency_key` required on all money RPC calls

**Tenant additions:**
- RLS check: all tenant tables have `USING (site_id = auth.uid()::uuid)` or equivalent
- `verifySiteOwnership` enforced on all routes touching tenant tables

### Post-deploy checks (always present)

1. production-readiness verify → status VERIFIED or PARTIAL
2. smoke test: affected routes return 200
3. queue workers healthy: `wrangler tail` — no error spikes
4. architecture verify: `engine.verification.verifyArchitecture()` → no REFUTED

**Money additions:**
- ledger round-trip: `create_checkout_order → confirm_order_payment_with_ledger → complete_order_refund` (test environment only)
- gift-card balance: verify `restore_gift_card_on_refund` on refund path

**Tenant additions:**
- RLS isolation smoke: cross-tenant row access must return 0 rows
- domains verify: `engine.verification.verifyDomains()`

**Worker additions (when `affected.workers.length > 0`):**
- deploy in dependency order; verify queue consumer bindings

### Numbered Verification Checks

| ID | Description | Method | Condition |
|----|-------------|--------|-----------|
| VC-01 | TypeScript typecheck — zero compile errors | `pnpm --filter <affected-app> typecheck` | Always |
| VC-02 | 107-validator governance gate GREEN | `node scripts/validate-governance.mjs` | Always |
| VC-03 | Run N affected test files | `pnpm exec tsx --test <files>` | Always |
| VC-04 | Blast-radius re-check | `pnpm graph:intel blast "<request.text>"` | Always |
| VC-05 | Production readiness ≥ 80% | `engine.verification.verifyProductionReadiness()` | Always |
| VC-06 | canonical-ledger-only-validator | governance validate + grep | Only when `risk.money` |
| VC-07 | RLS tenant isolation | `engine.verification.verifyArchitecture()` + audit | Only when `risk.tenant` |
| VC-08 | Services/workers verify | `engine.verification.verifyServices()` | Only when services/workers affected |
| VC-09 | API route smoke check | `curl`/`httpie` against affected routes | Only when `affected.apis.length > 0` |

---

## 8. `LaunchPlan` Type

```typescript
interface LaunchPlan extends PlanArtifact {
  request: ChangeRequest;
  readiness: number;              // 0..1 structural score
  decision: GoNoGoDecision;
  blockers: LaunchBlocker[];
  checklist: LaunchChecklistItem[];
}
```

Note: `LaunchPlan.blockers` and `LaunchPlan.decision.blockers` contain the same blocker list. Both are present for convenience — `decision` is a nested artifact with its own provenance, while `blockers` at the top level gives direct access without unwrapping.

---

## 9. Honesty Constraints

**Live data:** both artifacts (`launch-command-center.json`, `production-readiness-v2.json`) are pre-computed structural artifacts from `pnpm graph:omega`. They are not live telemetry. When absent:
- `UNKNOWN-LCC` blocker is emitted
- Checklist items become `UNKNOWN`
- Decision defaults to `CONDITIONAL_GO`

**RLS live check:** always `UNKNOWN` because confirming RLS policies are active requires a live Supabase probe (`SUPABASE_SERVICE_ROLE_KEY`), which is not available at LCIS query time.

**`notConnected()`:** the service uses the `notConnected()` evidence builder from `@letbuyy/lcis-core` for all "artifact unavailable" evidence entries. This preserves the standard NOT_CONNECTED honesty contract across all LCIS layers.
