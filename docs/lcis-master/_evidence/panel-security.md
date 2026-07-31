# LCIS Security Panel Review

**Role:** Principal Security Architect — independent critique, review only, no implementation.
**Date:** 2026-06-20
**Branch:** `stepup/main`
**Scope:** `LCIS_FUTURE_MODEL.md`, `LCIS_INFORMATION_ARCHITECTURE.md`, `LCIS_DOMAIN_INTELLIGENCE.md`, `LCIS_DUPLICATION_REPORT.md`

---

## Preamble: Why LCIS Is a Security-Class Object

LCIS is not a passive documentation mirror. It is an **active, queryable map of the entire LetBuyy attack surface** — including RLS policy coverage, `getSupabaseAdmin` blast radius, frozen-product gateway exposure, issuer crossover risk, internal-perimeter gaps, and every tenant's payment/refund data topology. It also holds or can derive:

- The exact location of every secret binding (env var names, which services require them)
- The structural graph of which code paths bypass which auth checks
- The specific tables unprotected by RLS
- The complete list of service-role (`getSupabaseAdmin`) call sites
- Pre-computed runbooks for every security incident

This means **an attacker who can read LCIS output gets a hand-drawn map of how to attack LetBuyy** — without needing to read the source code. That elevates LCIS from a developer-experience tool to a security-sensitive system requiring its own hardening.

The documents under review mostly acknowledge this in passing. This panel critique assesses whether the acknowledgement is deep enough, whether the proposed mitigations are sufficient, and where the blind spots are.

---

## Section 1 — AGREE (what the documents get right)

### 1.1 The Honesty Contract is a Genuine Security Property

`LCIS_FUTURE_MODEL.md` §2 principle 2 ("Honesty over completeness") and the repeated `NOT CONNECTED + exact env var` labeling are not merely intellectual hygiene — they are a security property. A system that fabricates live operational data is more dangerous than one that honestly admits it is dark. A fabricated "all payment routes HEALTHY" answer can suppress legitimate incident response. The commitment to never mock a live metric is correct and must survive consolidation.

**Why this matters securely:** The `live-adapters.mjs` approach of checking credential *presence* rather than probing with real credentials at build-time is also correct — it prevents secret leakage through LCIS's own build artifacts (no credential ever touches `graphify-out/*.json`).

### 1.2 SafetyGuard Read-Only Enforcement is Correctly Scoped

The 28-banned-verb allowlist in `execution-engine/SafetyGuard.mjs` (documented in `LCIS_DUPLICATION_REPORT.md` §1.1 and `LCIS_FUTURE_MODEL.md` §1.2) correctly identifies LCIS as a "propose and verify" system, not a mutator. The hash-chain audit is a good idea for an agent-accessible execution surface — it creates tamper-evident evidence of every diagnostic run.

**Where this is partially right:** The ban covers `deploy/write/insert/update/delete/pay/refund/push/merge`. This is the correct instinct. The panel's challenge is in §2.2 below — the list is not comprehensive.

### 1.3 RBAC Table in LCIS_INFORMATION_ARCHITECTURE.md Has the Right Shape

The five-role model (Viewer / Operator / Support / Admin / Agent) in §5 of `LCIS_INFORMATION_ARCHITECTURE.md` is structurally correct in that it:

- Puts the security/attack-surface views behind Operator+ access
- Restricts tenant-scoped live lookups to the Support role only
- Explicitly forbids any role from viewing secret *values* (only presence)
- Keeps the Agent service principal as a separate scope

These are the right columns. The challenges below are about what the rows don't yet say.

### 1.4 The Tenant-Plane / Platform-Plane Distinction is Sound

`LCIS_INFORMATION_ARCHITECTURE.md` §6 correctly distinguishes:
1. Platform intelligence (shared, structural, tenant-agnostic — the bulk of LCIS)
2. Tenant-scoped operational lookups (live, access-gated per `site_id`)

This is the right architectural cut. The critique is that the current implementation only *describes* the authorization boundary; it does not yet enforce it in code. Until the Supabase live adapter is wired, this distinction is theoretical. When it is wired, it will be the highest-risk moment in LCIS's security lifecycle.

### 1.5 Structural Gap Inventory in Domain Intelligence is Correctly Prioritized

The domain intelligence document (`LCIS_DOMAIN_INTELLIGENCE.md`) correctly identifies the highest structural security gaps with evidence:
- Sanitizer lock has no automated gate (§10, Themes)
- `internal-perimeter.ts` is not in the 107-validator suite (§13, Platform/Internal Ops)
- `getSupabaseAdmin` growth is silent — 115 files and climbing (§14, Infrastructure)
- Frozen-product gateway routes are live (`routes/app-store`, `routes/app-api`, `routes/operations/developers`) (§11, §12)

Correctly calling these out, with evidence, is the most useful security contribution in the documents.

---

## Section 2 — CHALLENGE / RISKY (where the documents underestimate the risk)

### 2.1 LCIS Itself is an Unguarded High-Value Attack Target

This is the sharpest risk in the entire LCIS design and it receives only passing acknowledgment.

**Current state:** Both runtimes (`:3333`, `:3334`) are local-dev-only with zero production access control — literally "anyone on localhost" (`LCIS_INFORMATION_ARCHITECTURE.md` §5: "not the current 'anyone on localhost' model"). The documents treat this as a temporary embarrassment to be fixed when `apps/lcis` ships.

**Why this is not temporary — it is the primary threat model:**

When `apps/lcis` joins the canonical runtime map (as `LCIS_FUTURE_MODEL.md` §4 Decision 4 proposes), it becomes a web-accessible service that returns:

```
/api/security-intelligence   → full attack-surface map (11 controls, known gaps)
/api/blast?q=getSupabaseAdmin → 115 file blast radius with call sites
/api/policy?table=orders     → complete RLS policy text for every tenant table
/api/runbook?domain=payments → step-by-step instructions for diagnosing payment failures
/api/audit                   → list of routes with missing auth/rate-limit/RLS
```

An authenticated attacker who is a **Viewer** (the default internal role) gets all of this. An unauthenticated attacker who finds a misconfigured CORS policy, a missing auth middleware, or an environment-variable injection gets it too.

**The documents do not treat `apps/lcis` as a high-value target.** They treat it as a developer-experience product. The security lens required is: every endpoint in the LCIS Query API is equivalent in sensitivity to a security audit report. Deploy it with the same rigor.

**Evidence this gap is unaddressed:** `LCIS_INFORMATION_ARCHITECTURE.md` §5 defines roles but says nothing about:
- Network ingress controls (is `apps/lcis` Vercel-only? IP-restricted? Private VPC?)
- Auth middleware stack (which identity provider? How is the Viewer role bootstrapped?)
- API rate limiting on the Query API (blast-radius queries are computationally cheap but information-dense)
- CORS policy on the HTTP API consumed by the MCP adapter
- Audit logging of every query (not just SafetyGuard-gated actions)

### 2.2 The SafetyGuard Verb Ban is Necessary But Not Sufficient

The 28-banned-verb approach prevents LCIS from directly executing mutations. It does not prevent:

1. **Read-based exfiltration.** If an attacker can supply a natural-language question to `/api/copilot?q=` or `/api/search-v2?q=`, they can extract the entire attack surface through permitted GET operations. The SafetyGuard only guards write verbs; it says nothing about what read operations an Agent role can issue in bulk.

2. **Prompt injection through user-supplied query parameters.** The `⌘K` Ask mode routes natural-language questions to the engine. If query parameters are not sanitized before they reach an LLM-backed routing step (the `/copilot` router), prompt injection could redirect the response to reveal more than the role permits.

3. **Indirect mutation through LCIS-grounded AI agents.** LCIS is explicitly designed as "the grounding layer for AI coding agents" (`LCIS_FUTURE_MODEL.md` §1.1). An AI agent grounded by LCIS still performs mutations — it just does so in the coding agent, not in LCIS. The SafetyGuard is scoped correctly *for LCIS itself*, but the documents do not address what controls exist on agents that consume LCIS context. A malicious or compromised LCIS agent context could ground a coding agent into performing a destructive action in the repo.

4. **Information aggregation attacks.** Individual LCIS answers are cited and bounded. But a caller who issues 50 sequential queries (all permitted by the SafetyGuard) can reconstruct a complete exploit map: table schemas → RLS gaps → unvalidated routes → `getSupabaseAdmin` call sites → secret names. Rate limiting per session/role is not mentioned in any document.

### 2.3 The Support Role in the Tenant Operational Plane is the Highest Cross-Tenant Leakage Vector

`LCIS_INFORMATION_ARCHITECTURE.md` §5 grants the Support role access to "tenant-scoped operational lookups (order/payment status for a specific `site_id`) gated by a `verifySiteOwnership`-equivalent authorization check."

This is the right instinct but the wording reveals a gap: **`verifySiteOwnership`-equivalent** is not the same as `verifySiteOwnership`. The gateway's `verifySiteOwnership` is a hard, validated function that enforces the RLS boundary at the service-role level. An "equivalent" in LCIS could be:

- A new implementation written specifically for LCIS that is not reviewed by the same ARB process
- A middleware that checks a `site_id` parameter in a query string (easily spoofed)
- A filter applied after data is fetched from the Supabase adapter, meaning the adapter may first return cross-tenant data that is then filtered client-side

In a multi-tenant, `site_id`-scoped database with 400+ tables, **filtering at the application layer instead of the DB layer is a cross-tenant leakage time-bomb**. When the Supabase live adapter is wired, every query it issues must:

1. Use the per-tenant Postgres Row Level Security policies (NOT the service role unless behind a verified context)
2. OR issue queries with an explicit `WHERE site_id = $verified_site_id` at the SQL level
3. AND audit every tenant lookup with the caller's identity, the `site_id` accessed, and a timestamp

None of these requirements are specified in the current documents. The "equivalent check" phrasing is the most dangerous phrase in `LCIS_INFORMATION_ARCHITECTURE.md`.

**Evidence this is a genuine risk:** The domain intelligence document (`LCIS_DOMAIN_INTELLIGENCE.md` §Part 3, Flow 3, point 3) explicitly says: "No LCIS endpoint can answer: 'Is there any live query path from tenant A's context that could return tenant B's data?'" If LCIS cannot answer this about itself, it cannot be trusted in the Support plane.

### 2.4 The `apps/lcis` Multi-Tenant Strategy Conflates Two Different Models

`LCIS_INFORMATION_ARCHITECTURE.md` §6 states "LCIS itself is one deployment serving the whole platform; tenancy is an authorization filter on the operational plane, not an architectural multiplication."

This is correct for the *platform intelligence plane*. It is potentially wrong for the *security intelligence plane*. Consider:

- The security attack-surface map (`/api/security-intelligence`) describes gap patterns that apply across all tenants. But the specific *evidence* for a gap (e.g., "the `gift_card_accounts` table does not enforce `site_id` in the RLS `USING` clause") is sensitive information that, in a future where merchants have partial LCIS access (Shopify Sidekick analogy, `LCIS_FUTURE_MODEL.md` §7), should NOT be visible to a merchant user who could exploit it.

- If `apps/lcis` is later extended with any merchant-facing surface (the "Inline intelligence" tier in `LCIS_FUTURE_MODEL.md` §4 Decision 4, or the "3-Year" merchant Sidekick vision), the single-deployment model will require extremely careful permission scoping to prevent a merchant-context user from reading platform-level security intelligence.

The document defers this problem ("later" and "3-Year"). That deferral is fine tactically but must be reflected in the data model now — specifically, every LCIS intelligence document and endpoint needs a `sensitivity` classification (`PUBLIC_PLATFORM`, `INTERNAL_ONLY`, `SECURITY_SENSITIVE`, `TENANT_SCOPED`) baked into the schema, not retrofitted when the Sidekick feature arrives.

### 2.5 The Frozen-Product Gateway Exposure is Treated as an LCIS Coverage Gap — It Should Be a Platform Blocker

`LCIS_DOMAIN_INTELLIGENCE.md` §11 and §12 correctly identify that `routes/app-store`, `routes/app-api`, and `routes/operations/developers` are live gateway endpoints for frozen products. The document classifies this as an LCIS gap: "LCIS has no alert that a frozen product has live gateway endpoints."

**This framing is backward.** LCIS having an alert is a good idea. But the alert should not be the primary mitigation. The primary mitigation is: **those routes must be either authenticated-and-refused (returning 403 for non-admin callers) or physically removed from the gateway registration.** An LCIS alert that says "hey, this unguarded route exists" is a detective control. A removed route is a preventive control. The documents need to be explicit that LCIS's role here is to *surface the finding for the platform team to act on immediately*, not to serve as the sole safeguard.

**Specifically:** If `routes/app-store` and `routes/app-api` are accessible without authentication and the app-marketplace is frozen, this is a live, unguarded attack surface right now — not a future gap. The domain intelligence document should say "SECURITY DEFECT: unguarded live route for frozen product; remediation required before LCIS goes to production." Instead it says "Gap in structural coverage."

### 2.6 The `getSupabaseAdmin` Growth Alarm is the Single Most Important Unimplemented Gate

`LCIS_DOMAIN_INTELLIGENCE.md` §14 states: "LCIS documents it [getSupabaseAdmin, 115-file blast radius] but has no alarm if the consumer count grows between commits."

This is correctly flagged as a gap. But the severity is understated.

`getSupabaseAdmin` is the service-role bypass of Supabase's RLS system. Every new consumer is a new code path where the application has root-level database access — with zero row-level security enforcement. In a multi-tenant system with 400+ tenant-scoped tables, a single erroneous `getSupabaseAdmin` call in a merchant-facing route is a complete tenant isolation failure.

115 files already consuming this symbol means 115 existing call sites where a developer must manually ensure `verifySiteOwnership` precedes the call. The fact that this count is "climbing" (`CLAUDE.md`) means the risk compounds with each commit. This warrants:

1. A hard validator gate (blocking CI if a new call site appears in a non-allowlisted file)
2. An existing call-site allowlist with every file explicitly annotated as to why it legitimately needs service-role access
3. An LCIS alert in the launch readiness surface

None of the three exist per the current documents. Flagging it as "medium" severity in the domain intelligence gap table (`LCIS_DOMAIN_INTELLIGENCE.md` Part 4) may understate it — this is a **high** severity uncontrolled growth pattern for a tenant isolation bypass.

---

## Section 3 — MISSING (what the documents do not address)

### 3.1 LCIS Has No Threat Model of Its Own

The documents extensively catalog the LetBuyy platform threat model (cross-tenant leakage, step-up gate coverage, issuer crossover, webhook HMAC). They do not apply this discipline to LCIS itself. Missing:

- **Who are the adversaries for LCIS?** Compromised developer account → reads all security gaps. Malicious insider → exports attack surface. LLM agent compromise → LCIS context feeds a malicious agent grounded plan. Unauthenticated web attacker → finds misconfigured `apps/lcis` deployment.

- **What are the LCIS-specific attack chains?** Example: attacker registers a `Viewer` account → calls `/api/audit` to get the list of routes with missing auth → calls `/api/blast?q=internal-perimeter.ts` to find what's protected → crafts exploit targeting an unprotected internal route. This entire chain uses only Viewer-permitted, read-only LCIS operations and is not guarded by the SafetyGuard (which governs writes).

- **What is the blast radius of an LCIS compromise?** If an attacker compromises the LCIS engine (code injection, supply-chain attack on the `node:http` process, or SSRF through a future external adapter call), they can derive the full attack surface faster than any manual audit. This is not mentioned anywhere.

### 3.2 The Live Adapter Security Model Is Underdeveloped

Decision 3 in `LCIS_FUTURE_MODEL.md` ("Earn live data") recommends wiring the Supabase read-only adapter as the first live adapter. But "read-only adapter" is underspecified:

- **Which Supabase role is used?** `anon` role (public RLS) vs. custom `lcis_reader` role vs. service role (`supabase_admin`)? Each has radically different security properties. The anon role is the safest but cannot read most tenant data. The service role bypasses RLS entirely — which means the LCIS adapter would have a tenant isolation bypass by design.

- **How are the adapter credentials managed?** As deploy-time environment variables (correct), but where is this specified? Which app/service owns the secret rotation? What is the principle of least privilege for the Supabase role granted to LCIS?

- **What is the network path?** Supabase is a cloud service. LCIS at `apps/lcis` would call it from Vercel. The network call must be outbound HTTPS to `*.supabase.co` — acceptable — but this must not introduce any new ingress paths into the Supabase project.

- **Read-only does not mean non-sensitive.** A read-only Supabase adapter that can query `orders`, `payment_transactions`, `customer_credentials`, and `gift_card_accounts` across all tenants is an extreme data exposure if the query is not scoped per `site_id` via proper RLS enforcement. The phrase "read-only Supabase adapter" appearing in `LCIS_FUTURE_MODEL.md` without specifying the authorization model for the queries it issues is a security debt scheduled to be created.

### 3.3 LCIS Has No Rate Limiting Design

Both the Query API (`:3333`) and the future `apps/lcis` lack any specification for rate limiting. Given that:
- The Query API is the intended grounding layer for AI agents (which issue many queries per session)
- The ⌘K palette enables rapid-fire queries
- The MCP adapter (`graphify-mcp`) can be programmatically queried

...the absence of rate limiting means a single compromised agent token could exhaust the LCIS service, systematically exfiltrate the complete security intelligence, or cause a denial of service for legitimate users. Rate limiting per role, per session, and per endpoint class (structural queries vs. live adapter queries) needs to be specified before `apps/lcis` is deployed.

### 3.4 No Specification for LCIS's Own Secret and Dependency Supply-Chain Security

`LCIS_FUTURE_MODEL.md` states the target is "zero npm deps" for the structural engine. This is a good security property for the core. However:
- The five capabilities migrated from `:3334` (architecture intelligence, SafetyGuard, verification engine, context compression, browser validation) may introduce dependencies
- The browser validation module (`browser-validator.mjs`) requires Playwright, which is a significant attack-surface addition (browser engine, IPC, file system access)
- The MCP adapter is an additional trust boundary that needs specification

There is no document that specifies: what is the LCIS dependency allowlist? Who reviews new dependency additions? How are LCIS's own dependencies audited against the same security-scan GitHub Actions workflow used for the platform (`.github/workflows/security-review.yml`)?

### 3.5 The Audit Log Scope is Undefined

`LCIS_INFORMATION_ARCHITECTURE.md` §5 grants Admin access to "audit log" and mentions the SafetyGuard hash-chain audit for execution operations. But:

- Are all Query API calls audited, or only SafetyGuard-gated operations?
- Are tenant-scoped Support lookups individually logged with caller identity and `site_id`?
- Is the audit log itself tamper-resistant (append-only, externally retained)?
- Who can read the audit log? (Admin only — but if an Admin is the compromised account, they can sanitize the log)
- What is the retention period?

Without these answers, the audit log as described provides a sense of accountability without the substance. The SafetyGuard hash-chain for execution is well-designed but covers only the execution plane. The read plane (which is where the most sensitive information lives in LCIS) is unaudited.

### 3.6 No Security Review Gate for LCIS Itself

`LCIS_FUTURE_MODEL.md` §2 principle 10 ("Adversarial truth") says "No capability is 'done' because the team that built it certified it. External/independent verification is required." This principle is applied to LCIS's platform intelligence. It is not applied to LCIS's own security posture.

The platform has `.github/workflows/security-review.yml` (PR) and `full-security-audit.yml` (weekly). LCIS (when it becomes `apps/lcis`) should be included in both workflows — explicitly, not implicitly. Currently, `tools/graph-server` and `tools/central-intelligence` are not in `pnpm-workspace.yaml`, meaning they may be outside the scope of the existing security scans.

### 3.7 The OAuth2/PKCE Frozen Feature Has an Active Token Inventory Risk

`LCIS_DOMAIN_INTELLIGENCE.md` §12 asks: "Are any existing OAuth tokens or API keys in the database for a system that's 'frozen'?" It classifies this as a gap ("OAuth token/credential inventory for frozen product: not queryable"). This is not just an LCIS coverage gap — it is a live credential hygiene issue. If OAuth tokens were issued before the developer portal was frozen, those tokens are valid bearer credentials against a frozen but gateway-exposed OAuth endpoint. The documents should escalate this from "gap" to "immediate audit required."

---

## Section 4 — Top 5 Recommendations

These are ranked by risk-reduction impact, not implementation effort.

---

### Recommendation 1: Reclassify LCIS as a Security-Sensitive Application Before Deploying `apps/lcis`

**What:** Before `apps/lcis` is added to the canonical runtime map, it must undergo the same pre-deploy security review as the identity platform and gateway — not the same review as a merchant dashboard.

**Why:** LCIS exposes the complete LetBuyy security intelligence. An `apps/lcis` deployment without a hardening checklist is a new, high-value, publicly-accessible attack target. The existing "developer tool on localhost" security posture is not transitional — it must be replaced with a production security model before a single route goes live.

**Minimum requirements before launch:**
1. Network ingress: `apps/lcis` must be deployed with access restricted to authenticated users on an internal network or behind SSO, not open to the public internet. The structural/platform intelligence plane may be served to all authenticated internal users; the security-intelligence views must be Operator+ only, enforced at the middleware layer.
2. Auth middleware: a concrete identity provider choice (the identity platform's merchant ES256 tokens are wrong here — LCIS serves the LetBuyy team, not merchants; it needs its own employee identity principal).
3. TLS and CORS: explicit CORS allowlist (not `*`); no exception for the MCP adapter path.
4. All Query API endpoints must emit an audit log entry (caller, role, endpoint, query parameter sha256, timestamp) — not just SafetyGuard-gated operations.
5. The security/attack-surface endpoints (`/api/security-intelligence`, `/api/audit`, `/api/policy`, `/api/blast`) must be classified `SECURITY_SENSITIVE` and require Operator role minimum, regardless of whether other structural endpoints are accessible to Viewer.

---

### Recommendation 2: Require a Hard CI Validator for `getSupabaseAdmin` Call-Site Growth

**What:** Add a deterministic validator (parallel to `canonical-ledger-only-validator.mjs`) that:
1. Counts the current `getSupabaseAdmin` call sites in the repository
2. Diffs against a committed allowlist (`scripts/getSupabaseAdmin-allowlist.json`)
3. Fails CI with a blocking error if any new call site appears that is not on the allowlist
4. Requires an explicit ARB review comment and allowlist update to add a new legitimate call site

**Why:** 115 file consumers is already high; "climbing" is unacceptable for a service-role bypass of RLS in a multi-tenant system. Every new consumer added without review is a potential tenant isolation failure. The pattern of documenting a risk in LCIS while leaving no automated gate to prevent it from worsening is the defining gap between LCIS's analytical capability and its actual security posture. This recommendation makes LCIS's own analysis *actionable* rather than advisory.

**Evidence base:** `CLAUDE.md` ("getSupabaseAdmin (115 files)" as change-control hotspot), `LCIS_DOMAIN_INTELLIGENCE.md` §14 (gap: "no alarm if the consumer count grows").

---

### Recommendation 3: Specify the Live Adapter Authorization Model Before Writing Any Code

**What:** Before the Supabase read-only adapter is implemented (Decision 3 in `LCIS_FUTURE_MODEL.md`), produce a 1-page authorization model document that specifies:
1. The exact Supabase role (not service role; recommend a custom `lcis_readonly` role granted SELECT on specific tables only, with RLS enabled)
2. The required `WHERE site_id = $caller_site_id` constraint enforcement — at the query layer, not the application layer — for every tenant-scoped query
3. How the Support role's `site_id` claim is validated (who issues it, what prevents spoofing, how it maps to the actual `sites.id` record)
4. An explicit list of tables the adapter can query, reviewed and approved by ARB
5. Audit log requirements for every adapter query (site_id, table, row count returned, caller role, timestamp)

**Why:** The Support role cross-tenant leakage risk (§2.3 above) is the highest-probability security incident in LCIS's near-term roadmap. Every day the adapter is designed without a tenant authorization spec is a day closer to shipping a read-any-tenant data endpoint. The gateway's `verifySiteOwnership` pattern exists precisely because this mistake is easy to make. "Equivalent" is not sufficient; the specific implementation must be specified and reviewed.

---

### Recommendation 4: Add a Frozen-Product Route Audit as a Hard Validator Gate

**What:** Add a deterministic validator that:
1. Reads the frozen product list from `CLAUDE.md` / the Constitution
2. Reads the gateway `routes/*.ts` registration in `services/api-gateway/src/index.ts`
3. Flags any route registered for a frozen product that is not behind an explicit `403 FORBIDDEN` handler for non-admin callers
4. Fails CI as a hard error (not a warning)

**Why:** `routes/app-store`, `routes/app-api`, and `routes/operations/developers` are live gateway endpoints for frozen products. This is an unguarded attack surface available to any caller right now. LCIS's domain intelligence correctly identifies this as a high-severity gap. Converting that analytical finding into a blocking CI gate closes the gap automatically and permanently, rather than relying on a human to remember to check the LCIS audit surface. This is the pattern where LCIS's value is highest: not just pointing at the problem, but being the mechanism that prevents it from recurring.

---

### Recommendation 5: Add a Liquid Sanitizer Configuration Drift Validator

**What:** Add a deterministic validator that:
1. Reads the locked sanitizer configuration from `packages/theme-engine` (the `FORBID` lists, `outputEscape:'escape'` setting)
2. Computes a SHA-256 hash of the sanitizer config at the time of the "lock" (to be recorded in `scripts/sanitizer-lock.json`)
3. Fails CI if the hash changes without an explicit governance override (`LETBUYY_CONSTITUTION.md` citation and ARB approval comment)

**Why:** The theme sanitizer is the XSS firewall for every merchant storefront. A change to the `FORBID` list or the output escaping setting is not a localized code change — it is an XSS invariant change that affects every store on the platform. Currently, there is no automated gate ("no LCIS validator or gate confirms the sanitizer config has not drifted" — `LCIS_DOMAIN_INTELLIGENCE.md` §10). This is the only security invariant with both platform-wide blast radius and zero automated enforcement. It belongs in the 107-validator gate, not in a documentation note. The `internal-perimeter.ts` gap (§3 of the domain intelligence) is the second-priority addition to the validator suite.

---

## Section 5 — Additional Observations (Non-Blocking but Worth Recording)

### 5.1 The Self-Certification Corpus is a Security Confidence Risk

`LCIS_FUTURE_MODEL.md` §2 principle 10 correctly identifies that 100% of the LCIS corpus is self-issued certification. From a security standpoint, self-certification of a security analysis tool is a specific type of conflict of interest — the tool certifies its own coverage of a threat it is also supposed to detect. The recommendation to replace self-certification with an adversarial review gate should be applied to the security domains first: the security-intelligence endpoint (`/api/security-intelligence`), the audit engine (`/api/audit`), and the tenant isolation model should all require external review before being presented as authoritative.

### 5.2 The `:3335` Operator Dashboard Has an Unaudited `dashboard.html`

`LCIS_DUPLICATION_REPORT.md` §3 notes "unaudited `dashboard.html` content" for the `:3335` operator dashboard. This is flagged for archival, which is correct. But before archival, the dashboard should be audited for any hardcoded credentials, API keys, or internal infrastructure details that should not be in a file that may be committed to the repository. Archival should mean deletion (or movement to `docs/archive/`), not just deprecation in a manifest.

### 5.3 The MCP Adapter is an Additional Trust Boundary Requiring Documentation

`graphify-mcp` is installed as an operator-registered MCP server. Claude Code (the AI coding agent) has access to LCIS intelligence through this adapter. The MCP protocol introduces a new trust boundary: the MCP server runs with the same OS-level permissions as the developer, and MCP tool calls are executed in-process. If the `graphify-mcp` server has any writable state (cache files, log files, configuration) that could be manipulated by a malicious context, it is an indirect write path not covered by the SafetyGuard. This should be audited before `graphify-mcp` is granted broader access than the current operator-local scope.

### 5.4 Preview Cookie Exposure in Storefront

`LCIS_DOMAIN_INTELLIGENCE.md` §1 identifies "Are theme previews active for stores in production (preview cookie exposure)?" as a security question with no current LCIS surface. This is a legitimate access-control bypass: if a storefront is in `password` or `offline` mode, but preview cookie issuance is not blocked, any visitor who obtains a preview cookie can bypass the access restriction. This should be in the security attack graph, not just the domain intelligence gap table.

---

## Summary Matrix

| Risk | Severity | Current State | Recommendation # |
|------|----------|---------------|-----------------|
| LCIS itself becomes a high-value attack target when deployed as `apps/lcis` | **Critical** | Unaddressed | 1 |
| Support-plane cross-tenant leakage via live adapter | **Critical** | Unspecified authorization model | 3 |
| `getSupabaseAdmin` consumer count grows without gate | **High** | Documented, unblocked | 2 |
| Frozen-product live gateway routes (app-store, app-api, developer) | **High** | Analytical finding only | 4 |
| Liquid sanitizer configuration drift | **High** | No automated gate | 5 |
| `internal-perimeter.ts` not in 107-validator suite | **High** | Known gap, unvalidated | (Part of Rec 4 pattern) |
| SafetyGuard does not prevent read-based exfiltration | **Medium** | Design gap | §2.2 |
| No rate limiting on Query API | **Medium** | Unspecified | §3.3 |
| Audit log covers execution only, not read plane | **Medium** | Unspecified | §3.5 |
| OAuth tokens from frozen developer portal not inventoried | **Medium** | Classified as gap | §3.7 |
| Live adapter Supabase role unspecified | **High** | Deferred to implementation | 3 |
| No threat model for LCIS itself | **Medium** | Missing document | §3.1 |
| LCIS excluded from existing security scan workflows | **Medium** | Not in pnpm-workspace.yaml | §3.6 |
| Prompt injection risk in NL query routing | **Low-Medium** | Unaddressed | §2.2 |
| Preview cookie bypass in access-controlled storefronts | **Low** | Not in security surface | §5.4 |

---

*Panel review produced 2026-06-20. Review-only; no code modified. Independent critique of LCIS design documents; findings are advisory pending ARB review. The 107-validator gate remains the authoritative deterministic enforcement layer.*
