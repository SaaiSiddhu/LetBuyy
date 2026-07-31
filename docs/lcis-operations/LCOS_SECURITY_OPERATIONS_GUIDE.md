# LCOS Security Operations Guide — "What is the security posture?"

**Phase:** 6 — LCOS (LetBuyy Central Operations System)
**Service:** `SecurityOperationsService` (`packages/lcis-operations/src/security/SecurityOperationsService.ts`)
**Honesty contract:** structural security posture CONNECTED (via lcis-governance reuse); live auth/abuse/credential signals NOT_CONNECTED (value=null, confidence=0) + exact env var.

---

## 1. What This Service Does

`SecurityOperationsService` observes the security posture for operations-time questions: "Are auth anomalies happening? Is there active abuse? Are credentials behaving normally? Are there security spikes?" It reads structural findings from `graphify-out/security-intelligence-v5.json` and **reuses lcis-governance's `SecurityDriftService`** for cross-tenant, dangerous-policy, and missing-RLS findings.

It NEVER blocks requests, revokes tokens, or mutates state.

---

## 2. How This Differs From Phase-5 Security Drift

| Dimension | Phase-5 `lcis-governance` (SecurityDriftService) | Phase-6 LCOS (SecurityOperationsService) |
|-----------|--------------------------------------------------|------------------------------------------|
| Question | "Has the static security posture drifted from policy?" | "What is happening to security right now?" |
| Scope | Static governance: RLS presence, policy USING-clauses, ownership drift, compliance rules R001–R008 | Operational signals: auth failure rate, abuse volume, credential event counts, spike detection |
| Finds | Policy-level structural drift (dangerous policies, missing RLS, cross-tenant candidates) | Live auth/abuse/credential anomalies — all NOT_CONNECTED; structural two-issuer model confirmation |
| Live values | None — governance is entirely static | All live values NOT_CONNECTED (requires Supabase/Turnstile credentials) |
| Authority | Drift and compliance drift (the 107-validator gate includes its output) | Operations observation layer — not in the gate |

**Reuse:** `detectSecuritySpikes()` calls `getGovernanceEngine({core})` → `gov.security` (`SecurityDriftService`) and converts its `Finding[]` to `OperationalFinding[]`. It does NOT re-traverse the policy graph itself.

---

## 3. The 4 Security Detectors

### 3.1 `detectAuthAnomalies()`

**Live finding (NOT_CONNECTED):** `auth-failure-rate`
- Source: Supabase auth logs
- Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Severity: high (potential attack in progress)

**Structural findings (CONNECTED):**

1. `two-issuer-auth-model` (info, confidence=0.9) — confirmed from `security-intelligence-v5.json:controls.jwt` and `base.identity.issuers`:
   - Customer sessions: HS256, `CUSTOMER_SESSION_SECRET`
   - Merchant sessions: ES256, `LETBUYY_IDENTITY_PUBLIC_JWKS`
   - Live key presence (whether the Cloudflare Workers secrets are actually set): NOT_CONNECTED

2. `security-controls-present` (info, confidence=0.9) — 11 controls all `present=true` in `security-intelligence-v5.json`:
   `jwt`, `oauth`, `pkce`, `rls`, `turnstile`, `webhookHmac`, `queueHmac`, `secrets`, `permissions`, `roles`, `stepUp`

### 3.2 `detectAbuseSignals()`

**Live finding (NOT_CONNECTED):** `abuse-bot-rate`
- Source: Cloudflare Turnstile Analytics API
- Env var: `TURNSTILE_SECRET_KEY`
- Severity: high

**Structural finding (CONNECTED):** `turnstile-integration-structural` (info, confidence=0.9) — Turnstile gate declared on registration and login routes in `security-intelligence-v5.json`. Rate-limit infra (Upstash Redis: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) also structurally declared in the authentication domain.

### 3.3 `detectCredentialEvents()`

**Live finding (NOT_CONNECTED):** `credential-events`
- Source: Supabase auth logs — token issuance counts, step-up challenge issuance, step-up pass rate
- Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Severity: medium

**Structural note (embedded in detail):** `step_up_challenges` and `sensitive_action_approvals` are in the 20-table tenant-without-detected-RLS list — structural risk that cannot be assessed without live Supabase access.

### 3.4 `detectSecuritySpikes()`

**Live finding (NOT_CONNECTED):** `live-security-spike`
- Sudden auth failure spikes, anomalous request volumes, attack pattern detection
- Env var: `SUPABASE_URL`
- Severity: high

**Structural findings (CONNECTED) — reused from lcis-governance SecurityDriftService:**

LCOS calls three methods on `gov.security`:

| Method | Output kind | What it checks |
|--------|-------------|---------------|
| `findDangerousPolicies()` | `dangerous-policy` | Policies with `public=true` or `USING (true)` — 34 found |
| `findMissingRLS()` | `missing-rls` | Tenant tables without detectable RLS — 20 candidates |
| `findCrossTenantRisks()` | `cross-tenant-risk` | Tables accessible across tenant boundaries |

Each governance `Finding` is converted to an `OperationalFinding` by prefixing the id with `LCOS-` and preserving severity, subject, title, detail, confidence, and evidence. Status is set to `CONNECTED` (structural). The governance service is the source of truth; LCOS does not re-traverse the policy graph.

---

## 4. Structural Facts in `SecurityOpsReport`

| Fact | Status | Value | Source |
|------|--------|-------|--------|
| `controls-present` | CONNECTED | 11 | `security-intelligence-v5.json:controls` |
| `cross-tenant-candidates` | CONNECTED | 20 | `security-intelligence-v5.json:crossTenantCandidates` |
| `public-policies` | NOT_CONNECTED | null | USING-clause SQL requires Supabase credentials |
| `auth-failure-rate` | NOT_CONNECTED | null | Supabase auth logs |
| `abuse-signals` | NOT_CONNECTED | null | Turnstile Analytics API |

---

## 5. All NOT_CONNECTED Live Signals

| Signal | Source | Required env var(s) |
|--------|--------|---------------------|
| Auth failure rate | Supabase auth logs | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Abuse / bot rate | Cloudflare Turnstile Analytics | `TURNSTILE_SECRET_KEY` |
| Credential events (token issuance, step-up) | Supabase auth logs | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Live security spikes | Supabase / Cloudflare | `SUPABASE_URL` |
| Public-policy USING-clause content | Supabase (pg_policies.qual) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Live key presence (Cloudflare Workers secrets) | Cloudflare Workers Secrets API | `CF_ANALYTICS_API_TOKEN` |

`liveConnected` is always `false` in this service until Supabase and Turnstile credentials are set.

---

## 6. `SecurityOpsReport` Key Shape

```typescript
{
  area: 'security',
  liveConnected: false,
  summary: 'Security posture: N finding(s) — C critical, H high. ...',
  facts: [
    { kind: 'controls-present', value: 11, status: 'CONNECTED' },
    { kind: 'cross-tenant-candidates', value: 20, status: 'CONNECTED' },
    { kind: 'public-policies', value: null, status: 'NOT_CONNECTED' },
    { kind: 'auth-failure-rate', value: null, status: 'NOT_CONNECTED' },
    { kind: 'abuse-signals', value: null, status: 'NOT_CONNECTED' },
  ],
  findings: [
    // Structural (CONNECTED):
    { id: 'two-issuer-auth-model', kind: 'two-issuer-auth-model', status: 'CONNECTED', confidence: 0.9 },
    { id: 'security-controls-present', status: 'CONNECTED', confidence: 0.9 },
    { id: 'turnstile-integration-structural', status: 'CONNECTED', confidence: 0.9 },
    // From governance (CONNECTED, prefixed LCOS-):
    { id: 'LCOS-POLICY-DANGEROUS-...', kind: 'dangerous-policy', status: 'CONNECTED', severity: 'high' },
    { id: 'LCOS-RLS-MISSING-...', kind: 'missing-rls', status: 'CONNECTED', severity: 'critical' },
    { id: 'LCOS-CROSS-TENANT-...', kind: 'cross-tenant-risk', status: 'CONNECTED', severity: 'high' },
    // Live (NOT_CONNECTED):
    { id: 'auth-failure-rate', status: 'NOT_CONNECTED', confidence: 0 },
    { id: 'abuse-bot-rate', status: 'NOT_CONNECTED', confidence: 0 },
    { id: 'credential-events', status: 'NOT_CONNECTED', confidence: 0 },
    { id: 'live-security-spike', status: 'NOT_CONNECTED', confidence: 0 },
  ]
}
```

---

## 7. How to Connect Live Security Signals

```bash
# Auth anomalies + credential events
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<key>

# Abuse/bot signals
TURNSTILE_SECRET_KEY=<key>
```

Once set, auth/credential/spike signals flip from NOT_CONNECTED to CONNECTED. The governance-derived structural findings (dangerous-policy, missing-rls, cross-tenant) remain CONNECTED regardless — they are artifact-based.

---

## 8. Cross-References

- Source: `packages/lcis-operations/src/security/SecurityOperationsService.ts`
- Governance SecurityDriftService: `packages/lcis-governance/src/security/SecurityDriftService.ts`
- Security discovery: `docs/lcis-operations/LCOS_SECURITY_DISCOVERY.md`
- Phase-5 governance: `packages/lcis-governance/` (the 107-validator gate)
- Artifact: `graphify-out/security-intelligence-v5.json` (gitignored; regenerate with `pnpm graph:security`)
