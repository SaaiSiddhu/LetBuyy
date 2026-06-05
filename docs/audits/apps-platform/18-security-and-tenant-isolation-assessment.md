# Security Assessment & Multi-Tenant Isolation Assessment (Deliverables 15–16)

Threat-model lens: a marketplace platform executing third-party code-adjacent content (liquid, iframes, webhooks, API tokens) across thousands of tenants. Ratings: exposure today / after blueprints land.

---

## 1. Trust Boundaries

```
B1 shopper ↔ storefront (untrusted input, rendered theme+app content)
B2 merchant ↔ admin (session auth, RBAC)
B3 app developer ↔ platform (tokens, bundles, webhooks)   ← weakest today
B4 platform internal: gateway ↔ supabase (service-role)   ← over-privileged today
B5 platform ↔ payment providers (signed webhooks)         ← sound
```

## 2. Findings by Domain

### 2.1 AuthN/AuthZ — HIGH exposure → LOW after
- App tokens: hashes in JSONB, no expiry sweep/rotation/revocation/audit (C3); no scope enforcement (C5); fix = oauth_tokens/api_keys + strategy middleware + scope map (docs 16/17).
- Human auth: internal SSO HMAC + Supabase JWT sound; single static `AUTH_SECRET` with no rotation pipeline (medium) — add dual-secret rollover like oauth_clients design.
- Consent: no grant records → oauth_grants with consent_artifact (legal defensibility).
- Embedded sessions: formalize JWT claims + replay cache (jti) on token-exchange.

### 2.2 Data isolation — HIGH → LOW
- 50 permissive `USING (true)` RLS policy lines incl. app_installations/products service-role bypasses (C1) — rewrite set A (doc 16 §1).
- Service-role key ambient in gateway (C2) — tenant clients + RPC allowlist.
- Nullable tenant FKs (H3) — NOT NULL + FK.
- App data axis: introduce dual-axis rule (store_id+installation_id) and middleware tenant guard; cross-tenant attempts logged to `security_enforcement_events`.
- Verdict today: isolation rests on application discipline; one service-role-context bug = cross-tenant breach. Verified no current leak found, but the design doesn't prevent one.

### 2.3 Content execution (Liquid/iframes/assets) — MEDIUM → LOW
- Liquid sandbox: strong (forbidden tags, limits, strict filters, output sanitize). Residual: filter-library surface review; `shop` scope minimization; per-block budgets absent (added doc 12 §3.4).
- Iframe sandbox flaw C6 (`allow-scripts`+`allow-same-origin`) — cross-origin frames + CSP (doc 13 §2).
- No CSP headers today on storefront — add manifest-driven CSP with nonces.
- Future app bundles: ingestion validation + render smoke tests + sha-pinned assets + immutable CDN paths (doc 11 §3) keep the new surface closed.

### 2.4 Webhooks & events — MEDIUM → LOW
- Outbound signing exists; secrets plaintext at rest (C4) → hash + show-once.
- Inbound provider verification implemented (4 providers); PayPal handler misplaced (H7).
- Missing: subscription caps (H8), topic↔scope binding, replay protection guidance for receivers (timestamp in signature — present in Stripe-style scheme; standardize for app deliveries).

### 2.5 Marketplace supply chain — HIGH → MEDIUM
- Today: no review workflow, no compliance-webhook enforcement, version-less extensions mutable in place — a malicious developer could alter behavior post-listing.
- After: version pinning + review artifacts + edge kill switch + asset sha pinning. Residual (accepted): human review quality; mitigate with automated checks listed in doc 14 §1.

### 2.6 Secrets & config — MEDIUM
- No tracked secret files (verified `git ls-files`); historical `all.env` incident in memory docs → rotate anyway + add gitleaks to CI (doc 09 E3).
- Unused security env vars (`PAYMENT_CONFIG_ENCRYPTION_KEY` without code) — implement or remove; payment config encryption should be implemented (provider keys at rest).
- 97 console.log incl. auth paths — redaction logger (B2).

### 2.7 Availability/abuse — MEDIUM
- No per-store/app rate buckets (H8); no idempotency (H9); webhook fanout uncapped; app-proxy needs circuit breakers (designed doc 13 §6). Global limiter fallback chain (Upstash→KV→memory) is good.

## 3. Isolation Test Matrix (must pass before GA — feeds doc 22)

| Test | Assertion |
|---|---|
| RLS fuzz | for each app-platform table: authed user A cannot read/write store B rows via any /v1 route (automated: per-route 2-tenant probe) |
| App-token cross-store | token for installation(store A) → 403 on all store-B-parameterized routes + security event row |
| Scope matrix | token w/o scope S → 403 on every route mapped to S (generated from scope map = complete coverage) |
| Revocation latency | revoked token rejected ≤60s (cache TTL); revoked extension suppressed ≤60s at edge |
| Liquid escape attempts | corpus: tag smuggling, filter abuse, budget exhaustion, scope probing → all contained, page renders |
| Iframe escape | framed doc cannot script parent (cross-origin + CSP verified in browser test) |
| Webhook forgery | tampered signature/timestamp rejected; replayed delivery (same id) idempotent at receiver fixture |
| Uninstall purge | T+48h: tokens dead, webhooks gone, placements absent from manifest, purge event emitted |
| Service-role audit | static analysis: zero admin-client usage outside allowlist modules (lint E5) |

## 4. Residual-Risk Register (post-remediation, accepted/tracked)
1. Human review bypass via social engineering — mitigations: 2-reviewer rule for first publish, anomaly alerts on scope-heavy apps.
2. App backend compromise (out of platform control) — mitigations: scoped tokens limit blast radius, token rotation, merchant-visible token list.
3. Supabase RLS misconfig regression — mitigation: RLS fuzz suite in CI (above), policy lint validator added to `scripts/validators/`.
4. Liquid engine CVEs (liquidjs dep) — mitigation: dependency audit in CI, render budgets as containment.
5. Razorpay Route payout fraud — mitigation: KYC gate + payout review threshold in ops portal.
