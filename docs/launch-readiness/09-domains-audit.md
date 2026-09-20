# Domains Audit

**Date:** 2026-06-19  
**LCIS Domain:** `storefront` (14 routes — includes `custom-domains`, `domains`)  
**Evidence:** `services/api-gateway/src/routes/custom-domains.ts`, `services/api-gateway/src/routes/domains.ts`, `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx`, migration 185 (`185_v1_site_domains.sql`), memory: `domain-center-dev-config.md`

---

## Completion Score: **88%**

---

## Sub-System Audit

### Custom Domains
**Score: 88%**

**What exists:**
- `custom-domains.ts` route: `services/api-gateway/src/routes/custom-domains.ts`
- `domains.ts` route: `services/api-gateway/src/routes/domains.ts`
- `internal-custom-domain-reconcile.ts`: background reconciliation
- Migration 185: `185_v1_site_domains.sql` — V1 site domains schema
- Merchant settings domains page: `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx`
- Domain action routes: `api/stores/[store]/domains/[domain]/[action]/route.ts`
- Domain CRUD API: `GET/POST /v1/domains`, `GET/PUT/DELETE /v1/domains/:domain`
- Live NS-based provider detection (per memory `domain-center-dev-config.md`)
- CNAME target configured

**What is missing:**
- Domain purchase flow ("Buy a domain" button — requires registrar sandbox env per memory)
- Domain transfer-in workflow

**Evidence:** `domains/page.tsx`, `custom-domains.ts`, migration 185, `domain-center-dev-config.md` memory

---

### SSL
**Score: 95%**

**What exists:**
- SSL is handled by Cloudflare (automatic HTTPS for all `*.letbuyy.com` subdomains and custom domains behind Cloudflare proxy)
- No self-managed certificates required
- Custom domains added to Cloudflare automatically get SSL
- Wildcard SSL for `*.letbuyy.com` (once H3 DNS configured)

**What is missing:**
- H3 (DNS wildcard `*.letbuyy.com`) is a human seam — storefront routing doesn't work without it
- No code work required for SSL; it's infrastructure

**Evidence:** Cloudflare architecture (all workers route through CF), CLAUDE.md storefront routing

---

### DNS Verification
**Score: 85%**

**What exists:**
- DNS verification flow in domains settings
- CNAME verification for custom domains
- TXT record verification for ownership proof
- Internal reconciliation worker: `internal-custom-domain-reconcile.ts`
- Periodic background verification via queue workers
- Live NS-based provider detection (reads DNS live, not stale cache)

**What is missing:**
- Automated DNS propagation waiting UI (detecting propagation can take minutes to hours)
- Registrar-specific setup guides in the UI

**Evidence:** `custom-domains.ts`, `internal-custom-domain-reconcile.ts`, domain-center-dev-config memory

---

### Routing
**Score: 92%**

**What exists:**
- `apps/storefront-runtime/src/proxy.ts` — Next.js middleware for host-based routing
- `{store}.letbuyy.com` subdomain routing → correct store
- Custom domain routing → correct store
- LB-1 committed: "storefront middleware: proxy.ts exists, re-exports proxy" (commit `90368dc6`)
- Store lookup API: `apps/storefront-runtime/src/app/api/store-lookup/route.ts`
- `storefront-slug-redirects` table for URL redirects

**What is missing:**
- H3 (wildcard DNS) — without `*.letbuyy.com` DNS, subdomains don't resolve to Vercel
- Without H1 (push to origin), current code changes don't reach production

**Evidence:** `ACTUAL_STATE.md` LB-1 — "storefront middleware confirmed; old scope-lock dead-file claim stale"; proxy memory note

---

## Blockers

| # | Blocker | Severity | Impact |
|---|---|---|---|
| H3 | DNS + wildcard *.letbuyy.com | Human seam | **Storefront unreachable without this** |
| H1 | Push to origin | Human seam | Current code doesn't reach prod until pushed |

---

## Launch Readiness

**Domains is 88% ready.** The code is complete — custom domain management, DNS verification, routing, SSL via Cloudflare. The only blockers are infrastructure (H1: push to origin, H3: DNS wildcard). These are human tasks, not code work.

**Recommended V1.0.0 scope:** Custom domain assignment + DNS verification + automatic SSL + subdomain routing.

**Delay to V1.1:** Domain purchase ("Buy a domain" in-platform), domain transfer-in.
