# LetBuyy Domain Phase — Locked Decisions (ADR)

**Status:** LOCKED — 2026-06-07
**Supersedes:** the open CNAME-target decision in `docs/governance/domain-topology-governance.md` §7
and `LETBUYY_DOMAIN_SPLIT_EXECUTION.md` §0.3 (was `cname.vercel-dns.com`; now **D2** below).
**Applies to:** the domain-split foundation already built (DS-1…DS-11) and its finalization mission.

---

## Locked decisions

### D1 — Shopper accounts: per-store, stay swappable
- **Decision:** Each storefront has its own customer accounts; the customer session is a
  **host-only** cookie on that store's own domain. Build a thin abstraction seam in
  `@letbuyy/auth-core` for shopper token issue/verify, and **reserve `id.letbuyy.store`** (not
  `accounts.letbuyy.store`, to avoid collision with the merchant IdP `accounts.letbuyy.com`) so a
  central OIDC identity can be added later with no rewrite.
- **Why:** simplest correct model, maximum tenant isolation, DPDP-friendly (each merchant controls
  its own customers), matches the host-only cookie realm already built.
- **Consequence:** no cross-store single login / accelerated checkout yet — that's a future, additive
  mission behind the seam. Shopper identity stays entirely in the `.store` realm; a shopper can never
  obtain a platform (`.com`) session.

### D2 — Custom-domain CNAME target: your own `connect.letbuyy.store`
- **Decision:** merchants point `www.<their-domain>` at **`connect.letbuyy.store`** (a LetBuyy-owned
  host), which for now resolves to Vercel. This is the **portability hedge**, not the prior
  `cname.vercel-dns.com`.
- **Why:** if you ever move the storefront edge (e.g. adopt the Phase-2 Cloudflare-for-SaaS gateway
  or leave Vercel), you re-point one record you control instead of asking every merchant to change
  DNS. `connect.letbuyy.store` is already the Phase-2 target, so this is forward-compatible.
- **⚠ Risk to validate BEFORE rollout:** Vercel's domain config check may report **"Invalid
  Configuration"** on a chained CNAME (`www.brandx.com → connect.letbuyy.store → cname.vercel-dns.com`)
  even when traffic resolves to Vercel. **Test with one real domain end-to-end** (attach → cert
  issues → serves) before onboarding merchants. If Vercel rejects the chain: either (a) fall back to
  `cname.vercel-dns.com` for Phase 1, or (b) treat it as the trigger to stand up the real Phase-2
  Worker behind `connect.letbuyy.store`.
- **Apex note:** `connect.letbuyy.store` is a CNAME, so a merchant **apex** (`brandx.com`) needs
  ALIAS/CNAME-flattening at their DNS provider or an A-record path. Keep `www` canonical; warn on apex.

### D3 — Vercel domain attach: automate now (Vercel Domains API)
- **Decision:** the gateway attaches each verified custom domain to the storefront Vercel project
  **programmatically** via the Vercel Domains API (`POST /v10/projects/{projectId}/domains`), then the
  reconciler polls Vercel for cert/config status and flips `custom_domain_status → active`. Fully
  hands-off onboarding from day one.
- **Why:** self-serve custom domains without a human in the loop.
- **Human prerequisite:** create a **Vercel team access token + storefront project ID**, store as a
  gateway secret (name only in env templates — never the value).
- **Consequence:** Vercel's cert/config status becomes the source of truth for "is it live" — wire
  that into the status-drift reconciler (hardening #7). Couples to D2's chained-CNAME validation above.

### D4 — Buy-a-domain (registrar resale): build next, after close-out
- **Decision:** ship/cut over the domain phase first, then build buy-a-domain as the next feature.
- **Why:** biggest India conversion lever (most SMBs have no domain; LetBuyy-controlled DNS = zero
  verification/propagation/SSL friction), but it shouldn't block closing the current phase.
- **Human prerequisite (when built):** registrar account — **ResellerClub (Mumbai)** or **OpenSRS**.

---

## Pre-locked defaults (recorded, not re-decided)

- **Store password:** Argon2id verify in `api-gateway` (already built); edge checks the signed
  host-only gate cookie thereafter.
- **Preview links:** merchant preview 30 min; share-link 7 days; revocable via `jti`.
- **Abuse screening (to build, hardening #6):** block obvious brand/homoglyph lookalikes + route
  medium-risk to a manual-review queue before issuance.
- **Cookie realms:** storefront cookies host-only; platform `COOKIE_DOMAIN` env-driven, default
  stays `.letbuyy.store` until the account cutover release.

---

## Human prerequisites summary (gates these decisions going live)

1. **D3:** Vercel team token + storefront project ID → gateway secret.
2. **D2:** create the `connect.letbuyy.store` record (→ Vercel) in the `letbuyy.store` zone; validate
   the chained-CNAME issuance with one test domain.
3. **D4 (later):** ResellerClub or OpenSRS reseller account.
4. (Unchanged) the 6 cutover items already in `CODEX_DOMAIN_SPLIT_STATUS.md`.

---

## What this changes in the finalization mission

The DS finalization mission (hardening #4–#8) must be written to these locks:
- custom-domain target = **`connect.letbuyy.store`** (update DS-6 verify flow + merchant instructions;
  the gateway already references `cname.vercel-dns.com` — change to the new target + document the chain).
- **Vercel Domains API** automation in the verify endpoint + status reconciler (D3).
- reserve **`id.letbuyy.store`** + the `auth-core` shopper-auth seam (D1).
- **buy-a-domain** sequenced after the close-out + cutover (D4).
