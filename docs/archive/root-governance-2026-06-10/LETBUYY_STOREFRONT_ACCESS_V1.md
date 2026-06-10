# LetBuyy Storefront Access & Preview — V1

> **Phase-1 reconciliation (canonical):** Enforcement lives in **storefront-runtime
> middleware on Vercel**, not a Cloudflare Worker. Custom domains use
> the LetBuyy-owned `connect.letbuyy.store` target per
> `docs/governance/domain-topology-governance.md`; that target chains to Vercel while Phase 2
> storefront ingress remains deferred.
> The "Router Worker" / "Edge Assertion" framing in this doc is the **Phase-2 edge-gateway
> variant (deferred — only adopt to hide Vercel or add per-host edge WAF)**. The access
> model itself — shared store password, signed/expiring preview tokens, and **host-only**
> customer cookies — is identical in both phases. Where this doc says "Worker," read
> "storefront middleware" for Phase 1. Defers to the governance doc on all topology.

**Status:** Design / Production-grade target
**Companion to:** `LETBUYY_CUSTOM_DOMAIN_V2.md` (this plugs into the same Router Worker)
**Owners:** `apps/merchant-control-plane` (admin UI), `services/api-gateway`, storefront Router Worker
**Last reviewed:** 2026-06-06

---

## 0. The reframe (read this first)

The original worry was "cross-domain cookie transfer between `.store` and `.com`." **That transfer should never happen — not in our design, not in Shopify's, not in any modern commerce platform.** Storefront and admin are *separate trust domains with separate sessions* that talk to each other over **scoped API tokens**, never shared cookies.

Your instinct — "use a password/token set in admin instead of cookies" — is right. It just resolves into **three distinct problems**, each with its own well-established mechanism. Conflating them is what made it feel hard.

| # | Problem | Your words | Mechanism | Where set | Where enforced |
|---|---------|-----------|-----------|-----------|----------------|
| **A** | Gate a not-yet-public store ("coming soon") | "visit before publishing… a store password" | One **shared store password** → first-party gate cookie on the storefront's *own* host | `admin.letbuyy.com` | Cloudflare Router Worker (edge) |
| **B** | Preview a draft/unpublished store or theme, optionally shared | "storefront edit before publishing" | **Signed, expiring preview token** (per-user or per-link) | `admin.letbuyy.com` | Cloudflare Router Worker (edge) |
| **C** | Storefront app ↔ backend, and shopper login | (the "cookie transfer" you wanted to avoid) | **API tokens** (storefront token) + **OAuth/PKCE** customer session, all first-party to the storefront | issued by `api.letbuyy.com` | storefront + API, via headers/tokens |

**None of the three needs a cross-domain cookie.** A and B fit cleanly into the V2 Router Worker as an "edge access gate." C is just standard headless auth.

This is exactly how Shopify is built: a shared **password page** set in admin ([Shopify password page](https://help.shopify.com/en/manual/online-store/themes/password-page)); **tokenized theme preview links** for pre-publish review ([Shopify theme sharing](https://shopify.dev/docs/api/shopify-cli/theme/theme-share)); and token-based **Storefront API** + **Customer Account API (OAuth 2.0 + PKCE)** for app↔backend and shopper login ([Storefront API auth](https://shopify.dev/docs/api/usage/authentication), [Customer Account API](https://shopify.dev/docs/api/customer/latest)).

---

## 1. What Shopify actually does (research basis)

**A — Password page.** Admin → Online Store → Preferences → Store access → *Restrict access to visitors with a password*. A **single shared password** for the whole store; used for dev/pre-launch and VIP/wholesale gating. While active, search engines see only the password page; everything else is hidden ([source](https://help.shopify.com/en/manual/online-store/themes/password-page)).

**B — Preview links (two kinds).** Shopify generates two distinct preview link types ([source](https://shopify.dev/docs/api/shopify-cli/theme/theme-share)):

- **Visitor preview** — no login, anyone with the URL, **expires in 2 days**, served on an isolated `https://<token>-<shop_id>.shopifypreview.com` host. Checkout disabled.
- **Merchant preview** — requires admin auth, **can access checkout**, **expires in 30 days**, served on the primary domain with a token parameter.

Plus a `preview_theme_id` parameter to deep-link any path to a specific unpublished theme.

**C — App↔backend & shopper login.** Headless storefronts use **Storefront API access tokens**: a *public* token (`X-Shopify-Storefront-Access-Token`, client-side, scoped) and a *private* token (server-side only) ([source](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/getting-started)). Shopper login uses the **Customer Account API over OAuth 2.0 + PKCE**, a session entirely separate from admin auth, on a dedicated customer-accounts domain via OIDC ([source](https://www.shopify.com/partners/blog/introducing-customer-account-api-for-headless-stores)). Admin cookies are never shared with the storefront.

Takeaway: the secrets/passwords are **set in admin**, but **enforced at the edge / via tokens** — precisely your idea, generalized.

---

## 2. Problem C resolved: why there is no "cookie transfer"

```
SHOPPER BROWSER (www.myshop.in  /  myshop.letbuyy.store)
   │  1. page loads from storefront (Vercel via Router Worker)
   │  2. client calls Storefront API with PUBLIC storefront token (scoped, per-store)
   │  3. server-side calls use PRIVATE token (Vercel server runtime only, never shipped)
   │  4. shopper login → OAuth2 + PKCE → CUSTOMER token, stored first-party
   ▼      cookie/token on the STOREFRONT host only — never on admin
api.letbuyy.com  (CORS-allowlisted to storefront origins; validates tokens)
```

Rules:
- The storefront authenticates to `api.letbuyy.com` with a **per-store scoped storefront token**, not a cookie. CORS allows the storefront origins.
- The **shopper session** lives as a first-party `__Host-` cookie/token on the storefront host (`www.myshop.in`). It never touches `admin.letbuyy.com`.
- The **merchant session** lives on `admin.letbuyy.com`. It never touches the storefront.
- The two domains are deliberately different registrable domains (`.store` vs `.com`) so cookies *cannot* cross — and that is the security property we want, not a problem to solve.

**Conclusion:** delete "cookie transfer" from the design entirely. It was never required.

---

## 3. The Edge Access Gate (Problems A + B)

A and B are enforced in the **same Router Worker** as the V2 custom-domain system, as one extra step *before* the Edge Assertion is minted and the request is proxied to Vercel. Access state travels with the routing record in the strongly-consistent Durable Object + KV cache, so the edge always knows a store's current access mode.

### 3.1 Worker pipeline (V2 + access gate)

```
1. Canonicalize Host → resolve routing record (KV → DO read-through)
   reject unknown / suspended                         [V2]
2. ── EDGE ACCESS GATE ──  read record.access_mode
   ┌ public        → continue
   ├ password      → require valid GATE token (first-party cookie on this host)
   │                 else → serve PASSWORD PAGE (edge-rendered, HTTP 401, noindex)
   ├ preview_only  → require valid PREVIEW token (?lb_preview=… or preview cookie)
   │                 else → serve "not available yet" holding page (404/403, noindex)
   └ offline       → holding page
3. Mint Edge Assertion — now includes access ctx:
      { tid, host, m, p, iat, exp, jti,
        ctx: { published: <bool>, preview: <bool>, theme_id?: <id> } }   [extends V2]
4. Proxy to Vercel. Middleware verifies assertion, renders published OR draft per ctx.
```

The render decision (live vs draft theme, checkout enabled vs test-only) is therefore **cryptographically asserted by the edge**, consistent with the V2 principle that downstream never trusts a mutable header.

### 3.2 Problem A — shared store password

- **Set in admin:** toggle *Restrict access* + password + optional message. Stored as an **Argon2id hash** (never plaintext) on the store record, pushed to DO/KV as `access_mode=password` (+ a verifier handle, not the hash).
- **First entry:** visitor without a gate cookie gets the edge-rendered password page. They submit → Worker route forwards the attempt to `api.letbuyy.com` for constant-time Argon2 verification (rare path) → on success the Worker mints a **signed gate token** and sets it as a first-party cookie `__Host-lb_gate` on *that storefront host only*.
- **Subsequent requests:** Worker validates the gate cookie signature/expiry **at the edge** — no backend call. This keeps the hot path edge-only after first auth.
- **SEO:** while gated, serve `X-Robots-Tag: noindex` and only the password page (matches Shopify).
- **Brute-force defense:** a single shared password is inherently weak. Per-IP + per-host rate limiting, lockout/backoff on repeated failures, strong default password, and an attempt audit log. For real pre-launch privacy, steer merchants to preview links (B) instead.

### 3.3 Problem B — preview tokens (the better pre-publish tool)

Two flavors mirroring Shopify, both **signed by a dedicated `PREVIEW_SIGNING_KEY`** (separate from the gate key and the Edge Assertion key):

| Flavor | Auth | Expiry | Checkout | Use |
|--------|------|--------|----------|-----|
| **Merchant preview** | requires `admin.letbuyy.com` login | short (e.g. 30 min, refreshed) | test-mode allowed | merchant/staff reviewing their own draft |
| **Share-link preview** | none (anyone with link) | bounded + **revocable** (e.g. 7 days) | disabled | sending to a client/designer for review |

Token payload: `{ sid: store_id, scope: "draft"|"theme", theme_id?, exp, jti, host }`. Delivered as `?lb_preview=<token>` (deep-linkable to any path, like `preview_theme_id`) and/or exchanged once for a short-lived first-party preview cookie. **Revocation** via a `jti` blocklist in the DO (so a shared link can be killed instantly). Preview works on `myshop.letbuyy.store` **even before the custom domain's DNS resolves** — preview must never depend on custom-domain go-live.

---

## 4. Data model additions

```sql
-- on the store/domain record (source of truth in Supabase, mirrored to DO/KV)
stores(
  ...,
  access_mode        text default 'public',   -- public | password | preview_only | offline
  access_password_hash text,                   -- Argon2id; null unless password mode
  access_message     text,
  published          boolean default false,
  live_theme_id      uuid,
  draft_theme_id     uuid
)

preview_links(                                  -- share-link previews (B)
  id, store_id, jti, scope, theme_id,
  created_by, expires_at, revoked_at, last_used_at, hit_count
)

gate_attempts(store_id, ip, host, ts, ok)       -- rate-limit + audit (A)
```

Access state changes (`access_mode`, `published`, theme ids) write **Supabase → RouterMap DO → KV** in the same strongly-consistent path as V2 routing changes, so flipping a store to public or publishing a theme is reflected at the edge on the next request — no 60s window.

---

## 5. Access lifecycle

```
draft store ──set password / generate preview link (admin)──►  gated
   │                                                              │
   │  merchant previews via short-lived merchant token            │ share link to reviewer
   ▼                                                              ▼
review/iterate ──────────────── PUBLISH (admin) ───────────────► public
                                     │
              access_mode=public, published=true, noindex removed,
              canonical set, 301 from shop.letbuyy.store, checkout enabled
   later: merchant may re-gate (event/wholesale) → password mode again
```

Publishing is an admin action that atomically sets `published=true` + `access_mode=public` and propagates to the edge via the DO. Preview links can be left to expire or be revoked at publish.

---

## 6. Merchant experience (`admin.letbuyy.com`)

```
Online Store → Preferences → Store access
┌───────────────────────────────────────────────────────────┐
│  Store visibility                                           │
│   ○ Public — anyone can visit                               │
│   ● Password — visitors must enter a password               │
│       Password   [ ************ ]   [ Generate ]            │
│       Message    [ We're launching soon!            ]       │
│   ○ Preview only — hidden; shareable preview links work     │
│                                                             │
│  Preview links                                              │
│   • Merchant preview  → [ Open preview ]   (you, 30 min)    │
│   • Share preview     → [ Create link ]  exp 7 days  ⟳ ⨯    │
│     https://myshop.letbuyy.store/?lb_preview=…   [copy]      │
│                                                             │
│  ℹ Previews work even before your custom domain is live.    │
└───────────────────────────────────────────────────────────┘
```

The merchant sets everything here; the shopper never sees the word "token." A shared link reviewer just opens a URL and sees the draft.

---

## 7. Security

- **Distinct signing keys**, each rotated independently: gate token, preview token, Edge Assertion (V2), customer session. Compromise of one never grants another.
- **Gate cookie** `__Host-lb_gate`: `Secure`, `HttpOnly`, `SameSite=Lax`, host-scoped, signed, short TTL. First-party only.
- **Shared password is low-trust by design** — rate-limit, lockout, audit, strong default, `noindex`. Recommend preview links for anything sensitive.
- **Preview links** are bearer URLs → bound to host, expiring, **revocable** (DO `jti` blocklist), access-logged. Share-link previews force **test-mode checkout** so no real orders land on an unpublished store.
- **Customer auth** (C): OAuth 2.0 + PKCE, short-lived access + refresh, first-party to storefront.
- **No registrar creds, no cross-domain cookies, no admin session on the storefront** — all preserved from V2.

---

## 8. Edge cases

- **Password page hosting:** the Worker renders it directly (no Vercel round-trip), so gating works even if the origin is unreachable, and unauthenticated traffic never reaches Vercel (preserves V2 origin protection).
- **Preview before DNS:** always available on `myshop.letbuyy.store`; don't couple to custom-domain status.
- **Checkout in preview:** merchant preview = test orders allowed; share-link preview = checkout disabled. Never allow real orders on an unpublished store.
- **SEO transitions:** `noindex` while gated/preview; on publish remove it, set canonical to the custom domain, 301 the subdomain.
- **Multiple drafts/themes:** preview token carries `theme_id`; deep-link any path.
- **Revoked/expired preview:** serve the same "not available yet" holding page, not an error that leaks store existence.
- **Search engines + password:** only the password page is indexable, matching Shopify behavior.

---

## 9. Open decisions

1. **Password verification location** — recommend control-plane Argon2 verify on first entry, edge-only thereafter (chosen above). Confirm acceptable.
2. **Share-link default expiry** — 7 days (Shopify visitor = 2 days, merchant = 30). Pick LetBuyy defaults.
3. **Per-user store passwords vs single shared password** — Shopify uses one shared password (A). Multi-user/username-password access is heavier; recommend preview links (B) for "specific people" rather than per-user passwords. Decide if a true multi-user gate is needed for wholesale.
4. **Customer Accounts domain** — locked for this phase as per-store, host-only shopper sessions behind the `@letbuyy/auth-core` shopper identity seam. The future reserved central shopper identity host is `id.letbuyy.store`; do not use the merchant/platform accounts host for shopper identity.

---

### Sources
- Shopify password page: https://help.shopify.com/en/manual/online-store/themes/password-page
- Shopify theme preview sharing (visitor vs merchant, expiries): https://shopify.dev/docs/api/shopify-cli/theme/theme-share
- Shopify Storefront API authentication (public/private tokens): https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/getting-started
- Shopify API authentication overview: https://shopify.dev/docs/api/usage/authentication
- Shopify Customer Account API (OAuth 2.0 + PKCE): https://www.shopify.com/partners/blog/introducing-customer-account-api-for-headless-stores
- Customer Account API reference: https://shopify.dev/docs/api/customer/latest
