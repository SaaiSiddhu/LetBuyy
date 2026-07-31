# LCIS Security Drift Guide

Service: `SecurityDriftService` (`src/security/SecurityDriftService.ts`)
Entry point: `generateSecurityDriftReport()` → `SecurityDriftReport`

---

## Boundary and honest limitation

**Static analysis only.** All 8 checks reason from boolean fields in `graphify-out/db-intel.json` and `domain-intel.json`. No live probes, no SQL execution, no fetch.

**No USING-clause SQL.** The `db-intel.json` artifact records `public`, `usesSiteId`, and `serviceRole` booleans for each policy. The actual `USING (...)` SQL text is NOT present in the artifact. Every finding that touches policy logic includes an explicit note: `[LIMITATION: USING-clause SQL text is NOT inspected — only the public boolean field from db-intel is available]`.

**Complementary to lcis-live.** When Supabase credentials are wired, `lcis-live/SupabaseAdapter` performs live RLS checks. GDIS security drift is the structural (always-on, no-credentials) complement. They are different data sources, not duplicates.

**Gate is authoritative.** The 107-validator gate (including `rls-force-coverage-validator.mjs` and `no-public-using-true-validator.mjs`) is deterministic and authoritative. GDIS security findings are advisory intelligence.

---

## 8 static checks

### 1. `findMissingRLS()` — tenant tables with RLS disabled

**Reads:** `db-intel.tables[].tenant`, `.rls`, `.money`, `.hasSiteId`
**Rule:** `tenant === true AND rls === false`
**Severity:** `critical` if money, `high` if tenant-only (SeverityScorer).
**Finding kind:** `missing-rls`
**Rule tag:** `R002`
**Real data:** 20 tenant tables have `rls=false` per the artifact. These map to the same 20 flagged by the RLS validator.

---

### 2. `findDangerousPolicies()` — policies with public=true

**Reads:** `db-intel.policies[].public`, `.table`, `.usesSiteId`, `.serviceRole`; cross-referenced with `tables[].money`, `.tenant`
**Rule:** `public === true` — allows any role to satisfy the policy.
**Severity:** `critical` if money table; `high` if tenant table; at minimum `high` (public exposure).
**Finding kind:** `dangerous-policy`
**Real data:** 34 policies have `public=true`. A public policy on a plans/catalogue table for anonymous reads may be intentional — humans must verify.
**LIMITATION stated in finding:** USING-clause SQL is not inspected.

---

### 3. `findPublicMutations()` — money functions not SECURITY DEFINER

**Reads:** `db-intel.functions[].money`, `.securityDefiner`, `.hasIdempotency`, `.forUpdate`
**Rule:** `money === true AND securityDefiner === false`
**Severity:** `critical` (money always critical)
**Finding kind:** `public-mutation`
**Rule tag:** `R001`
**Real data:** 4 money functions are not SECURITY DEFINER (out of 34); 136 total securityDefiner functions exist. These 4 are the R001 enforcement targets.

---

### 4. `findCrossTenantRisks()` — tenant isolation structural signals

Two sub-checks, both produce `cross-tenant-risk` findings:

**(a) Tenant table missing site_id column**
**Reads:** `db-intel.tables[].tenant`, `.hasSiteId`, `.hasStoreId`, `.rls`, `.money`
**Rule:** `tenant === true AND hasSiteId === false`
**Severity:** Inherits money/tenant.
**LIMITATION:** `hasSiteId=false` means the column is absent; it does not confirm whether RLS policies use an alternative discriminator.

**(b) Policy on tenant table that does not use site_id**
**Reads:** `db-intel.policies[].usesSiteId`, `.table`; cross-referenced with tenant table set
**Rule:** Policy on a tenant table where `usesSiteId === false`
**Severity:** Escalates if `public === true` on same policy.
**LIMITATION:** Cannot read the USING clause; `usesSiteId=false` inferred from the boolean field only.

---

### 5. `findMissingValidation()` — money functions missing idempotency or FOR UPDATE

**Reads:** `db-intel.functions[].money`, `.hasIdempotency`, `.forUpdate`, `.securityDefiner`
**Rule:** `money === true AND (hasIdempotency === false OR forUpdate === false)`
**Severity:** `high`
**Finding kind:** `missing-validation`
**Rule tag:** `R001`
**Sub-kinds in detail:** `missing-idempotency`, `missing-for-update`, `missing-idempotency-and-lock`

---

### 6. `findMissingAuth()` — PARTIAL route-level auth signal

**Reads:** `db-intel.policies[].public`, `.table`; cross-referenced with tenant/money table sets
**Rule (heuristic):** Counts policies with `public=true` on tenant or money tables as a DB-level proxy for potentially under-authenticated access paths.
**Severity:** `info`
**Confidence:** 0.4 for the heuristic finding; 0.3 for the systemic limitation note.
**Finding kind:** `missing-auth`

**Always emits a systemic limitation finding** (id: `MISSING-AUTH-middleware-limitation`) at `info`/0.3 confidence explaining that route-level auth (middleware wiring for `verifySession`, `verifySiteOwnership`, `verifyCustomerSession`) cannot be verified from static artifacts. The security gate (107 validators) is authoritative.

---

### 7. `findMissingSecurityTests()` — critical domains with no security test in code graph

**Reads:** `domain-intel.domains[].money`, `.tenant`; `graph.json` node search
**Rule:** For each money or tenant domain, search graph for nodes matching `{domainKey}_security_test`, `{domainKey}_auth_test`, `{domainKey}_rls_test`, and any `security_test` node mentioning the domain key. Absence of any hit is a gap.
**Severity:** Inherits domain money/tenant sensitivity.
**Finding kind:** `missing-security-test`
**Note:** Graph search is substring matching over 52k node ids/labels. Absence means no matching node was found, not that tests don't exist at all.

---

### 8. `findSensitiveDomainViolations()` — money domain rollup

**Reads:** Results from checks 1–5 (findMissingRLS, findDangerousPolicies, findPublicMutations, findCrossTenantRisks, findMissingValidation)
**Rule:** For each money domain, collect findings from the above where the finding subject is in `domain.tables[]` or `domain.rpcs[]`. If any related findings exist, emit a domain-level rollup.
**Severity:** `critical` if any component finding is critical; `high` if any is high; `medium` otherwise.
**Finding kind:** `sensitive-domain-violation`

This is a synthesis finding — it surfaces which money domains have accumulated security risk across their owned tables and RPCs.

---

## SecurityDriftReport structure

```ts
interface SecurityDriftReport extends GovernanceArtifact {
  findings: readonly Finding[];
  byKind: Record<string, number>;  // per-kind counts
  summary: string;
}
```

Summary example: `Security drift: N finding(s) — X critical, Y high. missing-rls=20, dangerous-policy=34, ... [Structural-only; live probes NOT CONNECTED]`

Sources default to `[db-intel, domain-intel]` when no artifacts are loaded.

---

## Summary of honest boundaries

| Check | What is structural (CONNECTED) | What is NOT CONNECTED |
|-------|-------------------------------|----------------------|
| RLS enabled | `tables[].rls` boolean | Live probe to DB |
| Policy USING clause | — | Policy SQL text not in artifact |
| Route-level auth | DB policy booleans (heuristic) | Middleware resolution (runtime) |
| Healthcheck liveness | Worker declared in infra-intel | Live probe result |
| Live security alerts | — | Runtime telemetry |
