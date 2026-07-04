# Domain Center — Ownership & Contract

> Governance for LetBuyy's custom-domain system (Domain Center V5). Defines the single
> source of truth, the health model, provider detection, verification history, and the
> primary/redirect rules. Pairs with [DOMAIN_CENTER_RESEARCH.md](./DOMAIN_CENTER_RESEARCH.md).

## Source of truth

| Concern | Source of truth |
|---|---|
| Connected domains (multi) | `public.site_domains` (migration 185) |
| Primary domain (legacy mirror) | `public.sites.custom_domain` — kept in sync with the `primary` row |
| Verification history | `public.site_domain_verifications` (append-only) |
| Live DNS state | DNS-over-HTTPS (Cloudflare + Google resolvers) via `lib/dns.ts` |
| Live TLS/SSL state | **Vercel** project-domain + config via `lib/vercel-domains.ts` |
| Health snapshot | `lib/custom-domain-health.ts` → `CustomDomainHealth` |
| Provider (merchant DNS host) | detected from real **NS** records via `lib/domain-provider.ts` |
| Health score | `apps/.../lib/domains/domain-model.ts` → `calculateDomainHealthScore()` (the ONLY calculator) |

The UI never computes status, SSL, or score independently — it consumes `domain-model.ts`.

## Ownership (who writes what)

- **Gateway only** writes `site_domains` / `site_domain_verifications` (service-role behind `verifySiteOwnership`, plus the two SECURITY DEFINER RPCs). RLS is enabled + forced; no permissive policy.
- **App / browser** calls the gateway `/custom/domains*` routes directly (credentialed CORS) — it never touches the DB. Types come from `@letbuyy/api-client` (no duplicated DTOs).
- **Storefront edge** (`proxy.ts`) only *reads* resolution via `/internal/store-access/resolve`.

## Health model (real signals only)

`CustomDomainHealth` is derived from DoH + Vercel and exposes: `txt_verified`, `cname_verified`,
`ssl_active`, `provider_status` (`configured | unavailable`), `misconfigured`, `apex_mx_warning`,
`renewal_status`, `renewal_date`, `records[]`, `checked_at`.

Health score weighting (0–100): ownership 25 · DNS 25 · host-attach 20 · SSL 25 · propagation 5.
Bands: ≥90 Healthy · ≥50 Needs attention · <50 Not working yet.

When Vercel creds are absent, `provider_status='unavailable'` and SSL is shown as **NOT CONNECTED**
("certificate automation not connected") — never faked as active.

## Provider detection

Detected from the domain's **NS records** (real, via DoH) → Cloudflare / GoDaddy / Namecheap /
Hostinger / BigRock / Squarespace / Google Cloud DNS / AWS Route 53 / Vercel / … / Other / Unknown.
This is the *merchant's* DNS host (Shopify-style "Managed by …"), **not** LetBuyy's edge (Vercel).

## Verification history

Every connect / verify / health / set_primary / set_redirect / delete appends one row to
`site_domain_verifications` via `record_domain_verification` (append-only; never edited or deleted).
The detail Activity timeline reads `/custom/domains/:domain/history`. Until migration 185 is applied,
the endpoint reports `connected: false` and the UI shows **NOT CONNECTED** (no fabricated history).

## Primary-domain rules

- **Exactly one** `primary` per site (enforced by a partial unique index).
- Only an **active** (verified + routed) domain can become primary (`set_primary_site_domain`).
- Promoting a domain atomically demotes the old primary to a `redirect` pointing at the new primary, and mirrors the primary onto `sites.custom_domain`.

## Redirect-domain rules

- Any non-primary connected domain is a `redirect`; it 301s to the primary (or its `redirect_to`).
- Redirect resolution is additive at the edge: the storefront resolver matches `site_domains`
  active rows only when the legacy `sites.custom_domain` match misses, so primary/subdomain
  traffic is unaffected. The 301 is issued in `apps/storefront-runtime/src/proxy.ts`.
- Many redirects are allowed; **never** more than one primary.

## LCIS contract

`tools/graph-server/domain-intelligence.mjs` (`pnpm graph:domains`) emits
`graphify-out/domain-intelligence.json`:
- **Structure** (tables, RPCs, routes, DNS, TLS, provider detection, health, routing) — verified
  from the repo and labeled **CONNECTED** (or a gap if a symbol is missing).
- **Live metrics** (connected/pending/primary/redirect counts, provider distribution, verification
  & SSL failures, health distribution, storefront routing) — each **NOT CONNECTED** with its exact
  Supabase query. No metric is ever inferred or fabricated.

## Apply / deploy notes

- Migration `185_v1_site_domains.sql` must be applied (`supabase db push`) for multi-domain +
  history. Pre-migration, the gateway falls back to the single `sites.custom_domain` and the UI
  degrades gracefully (no errors).
- Edge redirect-301 also needs a storefront redeploy after 185.
- Vercel SSL needs `VERCEL_API_TOKEN` + `VERCEL_STOREFRONT_PROJECT_ID`; otherwise SSL is honestly NOT CONNECTED.
