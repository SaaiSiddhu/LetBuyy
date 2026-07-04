# Domain Center (V5) — Research

> Mandated research artifact. Read before implementing. Captures LetBuyy's **real**
> custom-domain architecture, the Shopify workflow we are matching, the gap, and an
> honest CONNECTED / NOT CONNECTED inventory so the build contains **no fabricated states**.
>
> Date: 2026-06-16 · Scope: `settings/domains` only.

---

## 1. Executive summary

LetBuyy already has a **real, working** custom-domain backend. The gap is **not** the
plumbing — it's the **experience**: today it's one cramped page that calls the gateway
directly. V5 rebuilds it into a Shopify-class Domain Center on top of the existing real
endpoints, adds derived intelligence (provider detection, health score, troubleshooting)
from real signals, and extends LCIS — **without** faking anything.

**The single most important architectural truth:**
LetBuyy's storefront edge and TLS are on **Vercel**, and DNS checks use **DNS-over-HTTPS**
(Cloudflare + Google resolvers). It is **NOT** Cloudflare-for-SaaS. The Shopify screenshots
show *Cloudflare* only because that merchant's DNS is hosted on Cloudflare — i.e. Shopify's
"provider" = the **merchant's DNS host**, not Shopify's edge. We mirror that meaning:
"provider" in our UI = the merchant's detected DNS host; the **TLS issuer is Vercel**.

---

## 2. LetBuyy current domain architecture (CONNECTED — real)

### 2.1 Data model — `database/supabase/migrations/090_custom_domains_and_store_access.sql`
Columns added to **`sites`** (one custom domain per store):
- `custom_domain text` — unique index on `lower(custom_domain)` where not deleted.
- `custom_domain_status text` — CHECK `none | pending | review | verifying | active | error`.
- `custom_domain_verification_token text` — the TXT ownership challenge.
- `access_mode text` — CHECK `public | password | preview_only | offline`.
- `access_password_hash`, `access_message`, `published`.

Supporting tables:
- `site_preview_links` — signed preview/share tokens (jti, scope, expiry, revoked_at).
- `site_gate_attempts` — password-gate attempt log.
- `site_domain_reviews` — trust & safety review queue (risk_tier, status, reasons, provider_evidence, decision).
- `domain_orders` — registrar purchase ledger (provider `resellerclub|opensrs|sandbox`, status `created→registering→provisioning→active|failed`, registrar/dns/vercel payloads, idempotency_key).

> **No** `site_domains` table, **no** `is_primary`, **no** `redirect_domains`. The model is
> **1 LetBuyy subdomain (always live) + at most 1 custom domain**. (See §6 honest constraints.)

### 2.2 Gateway routes — `services/api-gateway/src/routes/`
Mounted: `/custom` (`custom-domains.ts`), `/domains` (`domains.ts`), `/internal/custom-domain-reconcile`.

- `POST /custom/domains` — connect. Validates domain (reserved/public-suffix/own-zone guards), abuse-screens (`screenCustomDomainClaim`), writes `custom_domain` + token + status (`pending`/`review`), returns **real** records `{ txt, cname, apex_alias }` + a **real** MX/NS DNS snapshot → `apex_mx_warning`.
- `POST /custom/domains/verify` — **real** verification: DoH `TXT _letbuyy-challenge.<domain>` (needs ≥2 matches) → DoH `CNAME <domain>` matches target → `attachVercelProjectDomain` (real Vercel) → `readVercelDomainStatus` → status.
- `GET /custom/domains/:domain/status` — **real health** via `readCustomDomainHealth` (DoH + Vercel), persists `custom_domain_status`.
- `DELETE /custom/domains/:domain` — release (clears domain/status/token).
- `POST /custom/domain-reviews/:reviewId/decision` — platform-console trust decision (token-gated).
- `GET /domains/search`, `POST /domains/purchase` — **real** registrar via `createDomainRegistrarProvider` (sandbox / resellerclub / opensrs); records to `domain_orders`; configures DNS + Vercel.
- `PUT /store-access`, `POST/DELETE /store-access/preview-links` — access modes + preview links.

### 2.3 Real check libraries — `services/api-gateway/src/lib/`
- `dns.ts` — `resolveDoh()` over **Cloudflare (`cloudflare-dns.com`) + Google (`dns.google`)** DoH; `resolveMxOrNsSnapshot()`. **Real.**
- `vercel-domains.ts` — `attachVercelProjectDomain`, `readVercelDomainStatus`, `getVercelDomainConfig` against `api.vercel.com` (`/v9 /v10 /v6`). Maps to `pending|verifying|active|error`. Throws `VercelDomainConfigError` (→ `provider_status: 'unavailable'`) when `VERCEL_API_TOKEN` / `VERCEL_STOREFRONT_PROJECT_ID` are absent. **Real, fails honest.**
- `custom-domain-health.ts` — `readCustomDomainHealth()` → the canonical `CustomDomainHealth`:
  `status, txt_verified, cname_verified, ssl_active, provider_status, configured_by, misconfigured, apex_mx_warning, renewal_status, renewal_date, checked_at, records[], vercel`.
  Each record: `{ type, host, value, status: verified|pending|mismatch|unknown, actual[], message }`.
- `custom-domain-config.ts` — `getCustomDomainCnameTarget(env)` (from `CUSTOM_DOMAIN_CNAME_TARGET`), `dnsAnswerMatchesTarget`.
- `custom-domain-abuse.ts` — claim screening.

### 2.4 Typed client — `packages/typescript/api-client`
- `customDomains.health(domain, { site_id })` → `CustomDomainHealth`.
- `domains.search({ query })` → `DomainAvailabilityQuote`; `domains.purchase(input)` → `DomainPurchaseResult`.
- Connect / verify / delete / store-access are **not** in the client today — the current page calls the gateway **directly from the browser** (`NEXT_PUBLIC_API_URL` + `credentials: 'include'`, relies on `CORS_CREDENTIAL_ORIGINS`).

### 2.5 Storefront routing — `apps/storefront-runtime/src/proxy.ts`
Next 16 middleware: normalizes host → `GET /v1/internal/store-access/resolve?host=` → resolves `{ site_id, custom_domain, custom_domain_status, access_mode, ... }`, enforces gate (password/preview/offline), validates preview & gate cookies. Custom-domain hosts resolve to the owning site here. **Real.**

---

## 3. Shopify workflow we are matching (from the 6 reference screenshots)

- **Domains overview**: `Connect existing ▾` + `Buy new domain`; promo banner (₹ credit); "Change to a new myshopify.com domain" (free subdomain change); table `Domain · Status` with `[Primary] — Connected`.
- **Connect existing** modal → domain input → per-domain **setup detail**: "Managed by <provider> · Added on <date>", Shopify↔provider graphic, **Configure DNS** (Connect automatically / Manual setup: remove + update records), checklist **DNS propagation → TLS certificate**, **Domain target & type** (Target: Online Store · Type: Redirects to …myshopify.com · Change), **Domain settings ▾ → Delete domain**.
- **Change subdomain** modal (N changes remaining).
- **Manual DNS**: log in to provider DNS → remove A `216.198.79.1` → update A `@ → 23.227.38.65`, CNAME `www → shops.myshopify.com` → "I updated DNS records".
- States: **Needs setup → DNS propagation → TLS → Connected**.

**Mapping to LetBuyy reality:**
| Shopify | LetBuyy equivalent | Backed? |
|---|---|---|
| Provider "Managed by Cloudflare" | Detect merchant DNS host from **NS records** (real NS via DoH) | Derive from real NS |
| "Connect automatically" (Cloudflare API) | N/A — we don't manage the merchant's DNS; show clear records to add | Manual records (real) |
| TLS certificate | **Vercel**-issued TLS (`ssl_active`, `renewal_status`) | Real (Vercel) |
| DNS propagation | DoH re-check of TXT/CNAME | Real (DoH) |
| Target / Type (Online Store / Redirect) | Single storefront target; root↔www canonical | Partial (see §6) |
| Primary / multiple domains | **Not in schema** (1 custom domain) | NOT backed (§6) |
| Buy new domain | `/domains/search` + `/domains/purchase` | Real (registrar) |
| Change myshopify subdomain | Subdomain is immutable post-create today | NOT backed (§6) |

---

## 4. Gap analysis — what to build

Everything below is built **on the existing real endpoints**; derived values come from
**real signals** (DoH/Vercel health), never invented.

**A. Experience / IA (UI rebuild).** Replace the single page with a Domain Center:
Overview → Connect wizard (enter → provider detect → DNS instructions → verify → activate)
→ Domain Details (DNS health panel, SSL health panel, actions, troubleshooting). Match
General/Business/Plan/Billing (`settings-home-card`, `--lb-*` tokens, aligned rows).

**B. Provider detection (derived, real).** `lib/domains/providers.ts` — map **real NS**
records (already returned in `health.records[ALIAS].actual` / connect `dns_snapshot.ns`) to
Cloudflare / GoDaddy / Namecheap / Hostinger / BigRock / Squarespace / Google / AWS / Other.
Pure presentation over real data.

**C. Health score (derived, real).** `lib/domains/health.ts` — score from real
`txt_verified + cname_verified + ssl_active + !misconfigured + provider_status`. Labeled, not invented.

**D. Troubleshooting (derived, real).** Map real `records[].status` + `misconfigured` +
`apex_mx_warning` + `provider_status:'unavailable'` → actionable issues
(what / why / fix / ETA). Examples: Missing TXT, CNAME mismatch, MX-at-apex conflict, TLS pending, provider unavailable.

**E. LCIS — `tools/graph-server/domain-intelligence.mjs`** (new; sits beside the existing
business-domain `domain-intel.mjs`). Static topology (routes/tables/libs/providers — CONNECTED)
+ live metrics (connected/pending/verification-fail/ssl-fail counts, provider distribution)
labeled **NOT CONNECTED** unless wired to a live source. Add `graph:domains` script.

**F. Optional thin app proxies.** Connect/verify/delete currently hit the gateway directly
(works, CORS-configured). Keep as-is to avoid adding governed app-route files (the route-count
lockstep is already in prior-session debt). Health read can also stay direct or via the typed client.

---

## 5. CONNECTED vs NOT CONNECTED (live-data law)

**CONNECTED (real now):**
- Connect / release a custom domain; TXT+CNAME records generated.
- DNS verification (DoH TXT + CNAME) and live re-check.
- SSL/TLS status, `configured_by`, `misconfigured`, renewal (Vercel) — when Vercel creds present.
- MX-at-apex warning, NS snapshot (→ provider detection).
- Domain search + purchase (registrar; sandbox or live), `domain_orders` ledger.
- Access modes + preview links. Storefront host routing.
- Trust & safety review queue.

**NOT CONNECTED (must be labeled, never faked):**
- **Live aggregate metrics** for the LCIS module (counts/distribution) until wired to DB/telemetry.
- **Vercel SSL** when `VERCEL_API_TOKEN`/`VERCEL_STOREFRONT_PROJECT_ID` unset → `provider_status:'unavailable'` (show "TLS automation not connected", don't fake "active").
- **Multiple domains / Primary toggle / Redirect-rule manager** — no schema (§6).
- **Persisted verification-attempt history** — only `site_domain_reviews` (trust) + `checked_at` exist; full attempt log not stored (§6).
- **Change myshopify subdomain** — subdomain immutable post-create.

---

## 6. Honest constraints (require a migration — out of core scope)

These Shopify features are **not** backed by LetBuyy's schema. We will present them
truthfully (clearly labeled / roadmap), **not** fake them. Each needs a governed migration:

1. **Multi-domain + Primary + Redirect domains** → needs a `site_domains` table
   (`site_id, domain, role primary|redirect, status, …`) + RPCs + routing changes. Today: 1 custom domain.
2. **Verification history** → needs a `site_domain_verifications` audit table written on each verify/health check.
3. **Redirect rules (root↔www, legacy)** → depends on (1) + storefront redirect handling.

**Recommendation:** ship the Domain Center core on the real single-domain model now
(connect → detect → instruct → verify → DNS/SSL health → troubleshoot → delete → buy),
which covers the majority of the spec end-to-end with zero fakes; treat (1)–(3) as a
follow-up phase gated on the migration.

---

## 7. Implementation plan (files)

```
apps/merchant-control-plane/src/lib/domains/
  providers.ts        # NS → provider detection (real NS), provider copy/icon
  health.ts           # health-score + status/step derivation from real CustomDomainHealth
  troubleshooting.ts  # real health → actionable issues (what/why/fix/eta)
  client.ts           # browser→gateway calls (connect/verify/delete/health/search/purchase)

apps/merchant-control-plane/src/components/domains/
  DomainOverview.tsx        # primary + custom domain cards, health, statuses
  ConnectDomainWizard.tsx   # enter → detect → DNS instructions → verify → activate (Modal/stepper)
  DomainDetail.tsx          # detail view (DNS panel, SSL panel, actions, troubleshooting)
  DnsHealthPanel.tsx, SslHealthPanel.tsx, DnsRecordRow.tsx, TroubleshootingPanel.tsx
  BuyDomainPanel.tsx, DomainStatusBadge.tsx

apps/merchant-control-plane/src/app/[store]/settings/domains/
  page.tsx            # Overview (rebuilt); detail can be a sub-route or in-page view

tools/graph-server/domain-intelligence.mjs   # LCIS custom-domain ops intelligence (+ graph:domains)
docs/v1/DOMAIN_CENTER_RESEARCH.md            # this file
```

CSS: `domains-*` semantic classes in `apps/merchant-control-plane/src/app/globals.css`
(token-only, mirror billing/users patterns). Mobile ≥360px: wizard collapses, DNS tables → cards.

---

## 8. Success-criteria coverage

| Success criterion | How (real) | Status |
|---|---|---|
| Connect domain | `POST /custom/domains` | CONNECTED |
| Verify ownership | `POST /custom/domains/verify` (DoH TXT) | CONNECTED |
| See / understand / resolve DNS issues | health `records[]` + troubleshooting derivation | CONNECTED |
| Provision SSL | Vercel attach + status | CONNECTED (creds) / NOT CONNECTED (no creds, labeled) |
| Set primary domain | — | NOT CONNECTED (needs `site_domains`) |
| Manage redirects | — | NOT CONNECTED (needs schema) |
| Monitor domain health | `GET …/status` health + score | CONNECTED |
| Buy domain | `/domains/search` + `/domains/purchase` | CONNECTED |

---

*Implement second. Validate third.*
