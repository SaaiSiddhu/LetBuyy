# LetBuyy Domain Split — Execution Runbook

**Purpose:** the single "what to actually do" index that turns
`docs/governance/domain-topology-governance.md` (the canonical design) into concrete,
sequenced actions. Splits work into **code (Claude can do)** vs **account actions (only you
can do)**, and flags the one sequencing hazard that breaks login if you skip it.
**Last updated:** 2026-06-06

---

## 0. The locked decisions (stop re-litigating these)

1. **Two domains:** `letbuyy.com` = platform control plane; `letbuyy.store` = storefronts only. ✔
2. **No cross-domain cookie transfer.** Two session realms: platform SSO cookie on
   `.letbuyy.com`; storefront customer cookie is **host-only**. They never share a cookie.
   (Your `auth/cookies.ts` is env-driven; `storefront-runtime/lib/session.ts` is already host-only.) ✔
3. **Custom-domain CNAME target = `cname.vercel-dns.com`** (Phase 1, Vercel-direct).
   Vercel Pro scales to ~100k custom domains/project, so this is sufficient to 100k merchants.
4. **Cloudflare-for-SaaS edge gateway (`connect.letbuyy.store` + Edge Assertion) = Phase 2,
   deferred.** Only adopt it if you later need to hide Vercel from merchants or run per-host
   edge WAF. Not required for scale. (This was the old `LETBUYY_CUSTOM_DOMAIN_V2.md`, since removed.)
5. **Store gating = shared password + signed preview links** (Shopify-style), enforced in
   storefront middleware. See `LETBUYY_STOREFRONT_ACCESS_V1.md`.

---

## 1. Done in this repo this session (safe, additive)

- **Tier 1 — docs reconciled.** `LETBUYY_STOREFRONT_ACCESS_V1.md` reframed for Phase-1
  (middleware, not Worker); Phase-2 gateway explicitly deferred. This runbook created.
- **Tier 2 — DNS parallel stand-up.** Added `infrastructure/dns/letbuyy_com.tf` (control-plane
  zone) per governance §5.1. **`dns.tf` left untouched on purpose** — migration §13 says stand
  `.com` up *in parallel* first, then 301 the old hosts, then delete. No destructive edit yet.
- **Tier 3 — cookie realm documented.** `auth/cookies.ts` comment now encodes the realm split
  and the cutover rule. **No value flipped** (see the hazard in §2).

Nothing above changes runtime behavior or live DNS. It is all inert until you do §3.

---

## 2. ⚠ The one sequencing hazard

**The platform cookie domain must match the apex the apps are actually served from.**
If you set `COOKIE_DOMAIN=.letbuyy.com` while `admin`/`accounts` are still served on
`*.letbuyy.store`, the SSO cookie is scoped to a domain the browser isn't on → **every
merchant login silently breaks.** Therefore `COOKIE_DOMAIN` flips to `.letbuyy.com` **only in
the same release that moves the platform apps onto `letbuyy.com`** (§3 steps 4–6). Until then
it stays `.letbuyy.store`. This is why Tier 3 is an env flip at cutover, not a code edit now.

---

## 3. Account actions — only you can do these (Cloudflare / Vercel / CI)

Follow governance §13 (zero-downtime). Order matters.

1. **Cloudflare:** add `letbuyy.com` as a zone; move registrar nameservers to Cloudflare.
   Create a zone-scoped API token (`Zone:DNS:Edit`, + WAF edit if porting the scanner ruleset).
2. **Terraform:** supply `cloudflare_zone_id_com`; `terraform plan` → `apply`
   `infrastructure/dns/letbuyy_com.tf`. (Records exist; `api`/`webhooks` stay inert until step 7.)
3. **Vercel:** attach each production host to its project (`config/vercel/projects.json`):
   `accounts/admin/apps/themes/developer/console/team.letbuyy.com` + `letbuyy.com`,`www`.
   Confirm certs issue. Apps now reachable on BOTH `.store` and `.com` (dual-run).
4. **Auth dual-origin:** temporarily allow the accounts `return_to` allowlist + redirect to
   include both apexes; verify SSO works on `.com` before flipping defaults.
5. **Env flip (the cutover):** set platform env to `.com`:
   `COOKIE_DOMAIN=.letbuyy.com`, `NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.com`,
   `NEXT_PUBLIC_API_URL=https://api.letbuyy.com`, etc. Storefront: leave `COOKIE_DOMAIN` UNSET.
   Files: `config/env/production.env.template` + `.example` (+ staging equivalents).
6. **301 the old control-plane hosts** `admin/accounts/console/team.letbuyy.store` →
   `.letbuyy.com` (Cloudflare Bulk Redirect). Keep ≥ one release.
7. **Move Worker routes** `api`/`webhooks` to `*.letbuyy.com`: edit
   `services/api-gateway/wrangler.toml`, `services/webhook-service/wrangler.toml`, and
   `config/runtime/cloudflare-topology.json` (this JSON is validator-checked — change it
   deliberately and re-run the gate). Then the `com_api`/`com_webhooks` records go live.
8. **Apex:** 301 `letbuyy.store` → `letbuyy.com`. Storefront wildcard `*.letbuyy.store` untouched.
9. **Decommission** old `.store` control-plane records + Worker routes after traffic drains.

Storefronts (`*.letbuyy.store`, custom domains) never move → zero shopper-facing migration.

---

## 4. Tier 4 — custom domain + password/preview feature (next branch)

This is a real feature build spanning 5 surfaces; it deserves its own branch + test pass, not a
drive-by. Existing scaffolding to build on: `apps/storefront-runtime/src/app/preview/*`,
`src/components/coming-soon/*`, `apps/merchant-control-plane/.../settings/domains/page.tsx`,
`apps/mobile/merchant-app/lib/services/custom_domains.dart`,
`services/api-gateway/src/middleware/store-context.ts`.

File-level plan:

| Surface | Change |
|---|---|
| **DB** (`database/supabase/migrations/`) | New migration: add to `sites` → `custom_domain`, `domain_status`, `verification_token`, `access_mode`, `access_password_hash`, `access_message`, `published`; new `site_preview_links` table. |
| **api-gateway** | Endpoints: `POST /custom/domains` (issue TXT token), `POST /custom/domains/verify` (check TXT → map host→site_id → trigger SSL), `DELETE` (release mapping + dangling-CNAME guard). Argon2 verify for store password. Extend `store-context.ts` host→site resolver to read `custom_domain` + `access_mode`. |
| **storefront-runtime** | Add `middleware.ts`: canonical host resolve (`STORE_ROOT=letbuyy.store`, reserved-label guard), **access gate** (public / password / preview_only) using existing `coming-soon` + `preview` UI, host-only gate cookie. |
| **merchant-control-plane** | `settings/domains/page.tsx`: show TXT+CNAME with copy + live status (Ownership→DNS→SSL→Live); Store-access panel (password/preview links). |
| **mobile** | `custom_domains.dart` / `domain_settings_screen.dart`: same states from the same API. |

Reuse `NEXT_PUBLIC_STORE_ROOT_DOMAIN` (governance §9) as the single source for the host parser.

---

## 5. Validation gate (run on every change above)

```bash
node scripts/validate-governance.mjs
node scripts/generate-repository-intelligence.mjs   # regenerate domains/ subdomains/ routing/ READMEs
pnpm test --filter @letbuyy/identity-platform        # auth/cookie realm
```

AGENTS requires `validate-governance` after any topology/import/env/DNS change. The
`cloudflare-topology-validator` checks `config/runtime/cloudflare-topology.json`, so step 3.7
(Worker route move) must update that JSON in the same change.

---

## 6. Recommended next step

Say the word and I'll build **Tier 4 on a dedicated branch/worktree** (so it can't destabilize
`develop`), starting with the DB migration + the api-gateway endpoints + the storefront
`middleware.ts` access gate, then run the validation gate. The account actions in §3 stay yours.
