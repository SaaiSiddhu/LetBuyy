# SHOPIFY ALIGNMENT REPORT — LetBuyy Strategic Canonicalization

> **Document type:** Shopify-vs-LetBuyy parity / architectural-alignment report (Principal Shopify Architect view).
> **Date:** 2026-06-10
> **Author role:** Shopify Principal Architect, writing for LetBuyy's strategic canonicalization program.
> **Subject system (LetBuyy) truth source:** `FORENSIC_MASTER_2026_06_10/` (evidence-anchored `path:line` audit, working tree 2026-06-10).
> **Constitution under alignment:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` (India-only; 100 → 1,000 → 10,000-merchant envelope; modular monolith; rent money rails; Liquid-first storefront is a stated goal; 0% transaction fee permanent).
> **Decision rule of this program:** LetBuyy has **no production merchants and no legacy burden**. It should *move directly toward intended architecture*, not preserve current code. Where Shopify is constrained by legacy (it had to deprecate `checkout.liquid` painfully), LetBuyy can **leapfrog**. Alignment means copying Shopify's **load-bearing patterns** (Liquid themes, sections/blocks, server-authoritative checkout, passwordless identity, Polaris-grade admin), **not** copying Shopify's scale/extensibility machinery (22 services, Wasm Functions, 3rd-party marketplace) before merchant + developer demand exists.

---

## 0. Methodology & fact recency

This report compares LetBuyy's **actual** current state (not its self-image) against the **current** state of seven Shopify subsystems, and issues an alignment verdict for each.

- **LetBuyy-side claims** are cited to the forensic master audit by `path:line` (those are themselves code-anchored). Primary inputs: `000_MASTER_INDEX.md`, `THEME_FORENSIC_AUDIT.md`, `CHECKOUT_FORENSIC_AUDIT.md`, `AUTH_FORENSIC_AUDIT.md`, `ARCHITECTURE_COMPLIANCE_AUDIT.md`, plus `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` for intended architecture.
- **Shopify-side claims** were **web-verified in June 2026** for the facts most likely to be stale in training data. Each Shopify fact below is tagged **[WEB-VERIFIED 2026-06]** (confirmed against current sources this session) or **[GENERAL]** (stable architectural knowledge not re-verified, low staleness risk). Sources are listed in §13.

**The decision-critical web facts** (these change the verdicts) are: the `checkout.liquid` sunset dates (Thank-You/Order-Status **Aug 28 2025**, info/ship/pay **Aug 13 2024**); **Shopify Scripts fully discontinued June 30 2026**; **legacy customer accounts + Multipass deprecated Feb 2026**, new customer accounts are **passwordless (email/SMS OTP) + OAuth2/PKCE/OIDC, passkeys via external IdP**; Hydrogen **migrated off Remix onto React Router 7** (Mar 2025); Polaris + checkout/admin extensions **unified onto Web Components + Preact, served unversioned from CDN, 64KB extension cap (2025-10)**; Shopify Functions run **Wasm (Rust/JS)**; and the **0% "transaction fee" is a platform surcharge that is waived only when the merchant uses Shopify Payments** (card *processing* fees 2.15–2.9% + 30¢ always apply).

---

## 1. Executive verdict (where align / where diverge / where leapfrog)

LetBuyy has already made the single most important alignment decision correctly — **it copied Shopify's load-bearing patterns, not its topology**: a real sections/blocks/JSON-templates/section-groups theme model with a sandboxed data-only render contract (`THEME_FORENSIC_AUDIT.md` §1, §10 — ~62% OS-2.0 parity), a server-authoritative cart funneled through one `SECURITY DEFINER` order RPC that re-prices server-side and is oversell-safe under `FOR UPDATE` (`CHECKOUT_FORENSIC_AUDIT.md` §1, §5.1), a passwordless-OTP + OAuth2-S256-PKCE identity spine (`AUTH_FORENSIC_AUDIT.md` §7, §10), and a Polaris-shaped admin — which is exactly the set V1 §3 names as "build to production grade." **Where it should ALIGN harder** is in *finishing* those patterns to Shopify's correctness bar: turn on the Liquid renderer it already built (today the live path is React-per-section and the Liquid engine is flag-OFF dead code — `THEME-001`), stand up the hosted `checkout.letbuyy.com` origin the signed handoff points at but which does not exist (`CHK-015`), and make the server-authoritative checkout genuinely server-authoritative end-to-end (bind the signed cart, kill the public pre-payment order door — `CHK-001`, `CHK-012`). **Where it correctly DIVERGES** is India/envelope-driven and should be *defended, not apologized for*: WhatsApp/UPI/COD-first commerce, merchant-is-MoR-on-own-Razorpay with a PA custodying money (Shopify is the opposite — Shopify *is* the MoR/processor), a single modular monolith instead of Shopify's service fleet, and — crucially — **no `checkout.liquid` legacy to ever carry**, which is a pure leapfrog. **Where it is prematurely mimicking Shopify's end-state** (and V1 explicitly rejects) it should *stop now*: it ships a Wasm checkout-functions runtime, a 3rd-party app marketplace, CQRS/saga/multi-region governance, and a 3% GMV rake — all of which are Shopify's 1M-merchant destination grafted onto a 0-merchant India platform, and all of which the audits flag as live `R-11`/`R-5`/`R-13`/`R-14` violations. **Net:** the leapfrog thesis is sound and already 60% executed; the remaining work is *deletion and completion*, not *imitation* — finish the four load-bearing Shopify patterns, delete the four premature Shopify-end-state grafts, and the platform lands where V1 (and a sane Shopify architect) would put it.

---

## 2. Theme platform — Online Store 2.0

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Shopify's theme platform is **Online Store 2.0**: page structure is **JSON templates** (data, not Liquid markup) that render **sections** (reusable Liquid files with a `{% schema %}` of typed settings), which contain **blocks**. The 2024→2025 evolution added **theme blocks** — independent, reusable, schema-bearing components nestable **up to 8 levels deep**, usable across sections (the "@app"/"@theme" and private-`_`-prefixed block model). **Section groups** organize header/footer/aside regions. **"Sections everywhere"** means sections render on every template, not just the homepage. Limits: a JSON template renders **up to 25 sections**, each with **up to 50 blocks**. **Theme app extensions** let third-party apps inject **app blocks** into merchant themes via the editor (add/remove/reorder). **Settings** are `config/settings_schema.json` (definition) + `settings_data.json` (values). **Dynamic sources** bind section/block settings to **metafields/metaobjects** and resource data (products, collections, pages, blogs). The reference theme is **Dawn** (open-source, the first OS-2.0 theme). **Theme Check** (Liquid linter, also a VS Code extension and CI tool) is the lint/quality surface. Themes are packaged and sold through the **Shopify Theme Store**. ~78% of Shopify stores run OS 2.0.

### LetBuyy current (cited)
LetBuyy models a theme **almost exactly like OS 2.0** and the audit calls it "the most genuinely-built subsystem in the repository — a real Shopify-OS-2.0-shaped theme platform, not governance theater" (`THEME_FORENSIC_AUDIT.md` exec verdict). It has the sections + blocks + JSON-templates + section-groups quad (`SectionModel`/`BlockModel` `index.ts:79/92`; `templates: Record<string,...>` keyed index/product/collection/page/cart/blog `theme-execution.adapter.ts:184`; `sectionGroups role:'header'|'footer'` `index.ts:109`); a typed `SectionSchema`/`SchemaField` with 24 built-in section schemas, presets, and a `THEME_SETTINGS_SCHEMA` settings_schema-equivalent (`theme-registry.ts:12/31/436`); a full web editor (add/remove/reorder/visibility/undo-redo/draft-autosave/preview-token/publish/rollback — `editor/page.tsx`) and a near-parity Flutter editor (50-state undo, device frames, tap-to-edit — `section_editor_screen.dart`); a real persistence + versioning spine (`theme_instances`/`theme_instance_drafts`/`theme_draft_patches`/`theme_releases`); app blocks (`appBlockSlot` + `@app` block type); a portable Liquid bundle format (`theme.liquid`, `config/settings_schema.json`, `sections/*.liquid` with `{% schema %}`, `locales/*.json`); and even a schema-migration framework most platforms lack. **Parity ≈ 62% of OS-2.0 in code, ~50% live** (`THEME_FORENSIC_AUDIT.md` §10).

**The gaps that matter:** (1) the **Liquid renderer is feature-flagged OFF** (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` `theme-governance.ts:14`; resolver short-circuits `template-resolver.ts:197`) — the *live* read path is React-component-per-section (`renderer-registry.tsx:198`), so the Liquid engine, portable-bundle, and "third-party theme developer" story are **shipped-but-dead code** (`THEME-001`, S1). (2) **No dynamic sources / metafield binding** — only product fetch exists (`data-binding-engine.ts:46`; `THEME-007`). (3) **No drag-and-drop reorder on web** (button up/down only `page.tsx:1164`; `THEME-006`). (4) **No theme-check / lint surface as a product** — validation is server-side at save only (`THEME-016`). (5) **The theme store ships only one theme** (`urban-kicks` — `seeds/urban-kicks-theme.sql:21`; `THEME-008`). (6) Three section-schema sources and two renderers are duplicated (`THEME-002/003/005`).

### Verdict: **ALIGN (with a leapfrog inside it)**
The *architecture model* is Shopify-grade and is the right thing to have copied. This is the clearest "copy the load-bearing pattern" success in the whole platform.

### Reasoning
Themes are V1's named differentiator ("Themes (the differentiator — protect it)", V1 §3/§10), and Liquid-first is an *explicit V1 alignment goal*. LetBuyy correctly cloned the **data-only sandbox** principle (the Liquid drop layer scrubs `__proto__`/secrets/`on*`, caps depth/keys; the upload forbids `{% render %}`/`<script>` — `theme-renderer.ts:407/441`, `theme-bundle.ts:101`), which is the actual security-load-bearing part of Shopify's design and the reason Shopify can let untrusted merchants author themes. The problem is not the design — it's that the **best half of it is turned off**, leaving the live platform running a React fork that Shopify's pattern was specifically meant to replace.

### What LetBuyy should do
1. **Flip the Liquid renderer on behind a per-theme `renderer.engine` switch with a canary** (or formally delete it and stop maintaining two renderers — but given Liquid-first is a V1 goal, flip it on). This is the highest-leverage theme action; it converts ~12% of "in-code-but-dead" parity into live parity and unlocks the portable-theme / external-author story. (Closes `THEME-001`.)
2. **Build dynamic sources / metafield binding** — introduce a `dataBinding` resolver registry (collections/pages/blogs/metafields/metaobjects) feeding `SectionRenderData`. This is the single biggest *capability* gap vs OS 2.0 and the thing merchants will hit first (`THEME-007`).
3. **Adopt theme blocks (Shopify's 2024–2025 evolution), not just sections+blocks-v1.** LetBuyy has the schema machinery already; add reusable, nestable, schema-bearing blocks now while there is no legacy theme corpus to migrate — a leapfrog past Shopify's own painful sections-v1→theme-blocks transition.
4. **Author 5–10 first-party themes** (JSON-contract or Liquid bundles) so the "marketplace" is not real machinery over an empty shelf, or reframe it honestly as "starter + editor" until demand exists (`THEME-008`).
5. **Ship Theme Check-equivalent** as an editor "Issues" panel by surfacing the validator it already has (`collectThemeTemplateValidationIssues`) + the renderer audit (`THEME-016`).
6. Collapse the three schema sources to one generated source and the two renderers to one interface (`THEME-002/003/005`).

---

## 3. Storefront runtime — Liquid SSR vs Hydrogen/Oxygen

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Shopify runs **two storefront runtimes in parallel, for two audiences**:
- **Liquid SSR (the default, ~majority of stores):** server-rendered Liquid themes on Shopify's own infrastructure. This is what OS 2.0 themes target; the merchant never runs a server.
- **Hydrogen + Oxygen (headless / developers):** **Hydrogen** is Shopify's React headless framework — historically Remix, but **as of March 2025 it is built on open-source React Router 7** (Remix merged into React Router). **Oxygen** is Shopify's global edge hosting for Hydrogen storefronts (free with the Hydrogen sales channel). Both consume the **Storefront API** (GraphQL) and pin to calver API versions. `hydrogen-react` is published standalone for non-Hydrogen React frameworks.

The two are not redundant: Liquid is the **zero-ops, merchant-editable** runtime; Hydrogen/Oxygen is the **full-control, developer-owned** runtime. The Storefront API is the common data contract beneath both.

### LetBuyy current (cited)
LetBuyy's live storefront is **server-rendered React Server Components** (`StorefrontCompositionEngine` is an async server component invoked from every store route — `THEME_FORENSIC_AUDIT.md` §2a; `composition-engine.tsx:355`), reading themes via the React `renderer-registry`. It has a **Liquid SSR engine built but flagged off** (§2.2 above). It has **no headless Storefront-API + Hydrogen-style framework** offering, and V1 does not ask for one. Storefront reads are pooled via Hyperdrive (`ARCHITECTURE_COMPLIANCE_AUDIT.md` P7 — APPROVED), and caching is the audited strong point (`PERFORMANCE_AUDIT` per master index).

### Verdict: **DIVERGE-INTENTIONALLY (single runtime) + ALIGN (make that runtime Liquid SSR)**
LetBuyy should run **one** storefront runtime, and it should be **Liquid SSR** — not adopt Shopify's *dual* Liquid+Hydrogen split.

### Reasoning
Shopify runs two runtimes because it serves both no-code merchants *and* a large headless-developer ecosystem at 1M-merchant scale — a population LetBuyy does not have. V1's envelope (100→10k India merchants) and "correctness over elegance / no premature scale infra" principles make a **headless Hydrogen/Oxygen tier premature** (it is the same class of error as activating 22 services). But Shopify's *default* runtime — server-rendered Liquid themes the merchant can edit without running infra — is exactly right for LetBuyy's audience and is a **stated V1 goal**. So the alignment is: keep one runtime, and make it the Liquid one LetBuyy already built. The current React-per-section live path is the accidental fork; it should converge onto Liquid (or, if Liquid is deferred, the React path should at least be the single documented authority, not a shadow of a dead engine).

### What LetBuyy should do
- **Do not** build Hydrogen/Oxygen/headless-Storefront-API now. Write it down as a deferred seam (the way V1 defers read replicas) and revisit only when a revenue-bearing merchant needs a fully custom headless storefront.
- **Do** make Liquid SSR the canonical live runtime (see Theme §2 action 1). Resolve the "two renderers / two compose paths" duplication so there is exactly one storefront render authority (`THEME-002/003`).
- Keep the Hyperdrive-pooled, cache-heavy read path — that part is already Shopify-grade for the envelope.

---

## 4. Checkout — extensibility, server-authority, Shop Pay

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Shopify **removed scriptable checkout on purpose** and replaced it with **Checkout Extensibility**, because the old model (`checkout.liquid` + Scripts + ScriptTags) let merchants/apps inject arbitrary code into the **PCI-scoped, conversion-critical, security-sensitive** checkout — which made checkout un-upgradeable, slow, and unsafe. The replacement:
- **Checkout UI extensions:** custom UI at defined checkout points, built from Shopify's web-component design system, running in an **isolated sandbox with no access to payment data or the checkout DOM**. (Info/Shipping/Payment steps are **Plus-only**; Thank-You/Order-Status are all-plans.)
- **Shopify Functions:** server-side logic compiled to **WebAssembly (Rust/JS)** for discounts, shipping/payment-method filtering, and cart/checkout validation — running on Shopify's infra with bounded performance. Functions **replaced the Scripts editor**.
- **Migration & deadlines (the decision-critical facts):** `checkout.liquid` sunset for Info/Shipping/Payment **Aug 13 2024**, for Thank-You/Order-Status **Aug 28 2025**; from **Jan 2026 Shopify began forced auto-upgrades** (lost non-migrated customizations); **Shopify Scripts fully discontinued June 30 2026.** This migration was multi-year and painful precisely because of legacy.
- **Shop Pay:** Shopify's accelerated, network-wide one-click checkout/wallet (with Shop Pay Installments), available when the merchant uses Shopify Payments; adds **no extra transaction fee** beyond standard processing.

The whole arc is: *server-authoritative, sandboxed, declarative, upgrade-safe checkout* — extensibility is allowed **only** through reviewed, sandboxed surfaces, never raw code.

### LetBuyy current (cited)
**The money-core is materially stronger than the surrounding governance suggests** (`CHECKOUT_FORENSIC_AUDIT.md` §1). Cart **is server-authoritative**: every order-creation entry point funnels through one `SECURITY DEFINER` RPC (`create_checkout_order` → `create_order_with_inventory_reservations`) that computes price server-side from `products`/`product_variants`, checks stock under `FOR UPDATE`, and dedupes by idempotency key (§1, §5.1). Price forgery is blocked (no price field in any schema; RPC reads DB price — F-a/F-b, `baseline:3335/3387`). Orders **cannot** be created outside this RPC (§10). Confirm is idempotent at three layers (§6). Coupon over-use and last-unit oversell are closed by row locks (§8, R-1/R-2). The checkout-session is a real guarded forward-only state machine (`planCheckoutStateTransition` `checkout-core/src/index.ts:147`). Branding is **data-only with a guard** — "no SSTI; branding is rendered as React props / CSS variables, not compiled as a template" (§11).

**But the checkout diverges from V1 (and Shopify's safety bar) in five places:** (1) the **hosted `checkout.letbuyy.com` origin does not exist** — signed URLs point at a host with no app/route/DNS; today's working checkout uses a *public* `POST /:subdomain/orders` path that bypasses the signed handoff entirely (`CHK-015`, S2; confirmed `cart-routes.ts:302`, no `apps/checkout`). (2) The **signed `checkout_url` does not bind cart contents** — cart can be mutated post-signature within the 10-min window (`CHK-001`, S2). (3) The **public order-create decrements stock before payment**, enabling denial-of-inventory (`CHK-012`). (4) **Refunds via the returns path are not ledgered** (`CHK-020`, S1). (5) Most relevant to *this* comparison — **LetBuyy ships a Wasm-ish checkout-extension/app-functions runtime that executes inside the live order route** (`evaluateCheckoutAppFunctions` before `createOrder`, gated `FEATURE_EXTENSIONS` — §12; `checkout-payment-routes.ts:285`). The blast radius is tightly bounded (SHA-256-pinned module, **no host imports**, no loops/calls, ≤128KB / 1–5ms, can only set coupon/shipping/payment-restriction, **cannot set price/discount/tax/total** — §12), but it is the *shape* of Shopify checkout extensions, which V1 §4 R-11 **rejects** for this envelope.

### Verdict: **ALIGN on server-authority (finish it) + DIVERGE-INTENTIONALLY on extensibility (delete it) + LEAPFROG (no `checkout.liquid` to carry)**
Three distinct sub-verdicts because checkout is three different decisions.

### Reasoning
- **Server-authoritative checkout = ALIGN, and LetBuyy already did the hard part right.** The one-RPC, server-priced, oversell-safe, idempotent core is precisely Shopify's "checkout is server logic the merchant cannot subvert" doctrine. The remaining work is *completion*: the hosted origin and the cart-bound signature are the difference between "server-authoritative in principle" and "server-authoritative in production."
- **No `checkout.liquid` legacy = the cleanest LEAPFROG in the platform.** Shopify spent ~2.5 years (2023→2026) and forced auto-upgrades to kill scriptable checkout. LetBuyy has **zero merchants and zero `checkout.liquid` corpus** — it can be born with a sandboxed, declarative, server-authoritative checkout and *never* pay Shopify's migration tax. This should be stated as an explicit strategic asset, not left implicit.
- **Checkout extensibility (Wasm functions / UI extensions) = DIVERGE-INTENTIONALLY (i.e., remove now).** Shopify gates extensibility behind review + sandboxing because it has a 1M-merchant, thousands-of-app ecosystem that *demands* customization and that Shopify must protect checkout from. LetBuyy has neither the merchants nor the apps. Building the Wasm runtime now is **cargo-culting Shopify's end-state** — V1 R-11 rejects it explicitly, and the audit flags it live (`ARCHITECTURE_COMPLIANCE_AUDIT.md` R-11 VIOLATED). The *correct* leapfrog posture is: keep the **seam** (an interface where a future Functions-equivalent could plug in), delete the **running Wasm executor + UI extension host** from the live checkout, and re-open extensibility only at Shopify-like demand (~5k merchants + inbound developers, per V1 §5).

### What LetBuyy should do
1. **Build and deploy the hosted `checkout.letbuyy.com` origin** consuming the signed handoff (the contact→delivery→payment→confirm browser flow). This is V1 P0 and the audit's named "point of the exercise" (`CHK-015`).
2. **Bind the signed checkout URL to cart contents** (hash of sorted line items + coupons + subtotal in the HMAC payload; or lock the cart at URL issuance), and **gate the public order-create behind the signed handoff** (and reserve-with-TTL rather than hard-decrement for COD/pre-payment) (`CHK-001`, `CHK-012`).
3. **Ledger refunds and COD** (post reversing F-class entries) so checkout's money exhaust is reconcilable (`CHK-020`, plus the un-ledgered capture/COD flagged in `PAYMENTS_FORENSIC_AUDIT`).
4. **Remove the live Wasm checkout-functions runtime and the `CheckoutExtensionHost`** from the storefront/order path; downgrade to a documented seam. Keep `checkout-core` as a library. (Honors R-11; reduces the live-checkout attack surface to zero third-party code.)
5. **Adopt the leapfrog framing in the program narrative:** "LetBuyy's checkout is born server-authoritative and declarative — it has no `checkout.liquid` and no Scripts to deprecate, so it starts where Shopify arrived in 2026."
6. (Optional, later) A **Shop-Pay-equivalent** accelerated UPI/one-tap checkout is a *natural India leapfrog* (UPI intent + saved address), but it is P2+ and should wait for checkout to be solid.

---

## 5. Identity — Customer Account API, Shop ID, passwordless/passkeys

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Shopify **deprecated legacy (Liquid-based, password) customer accounts in February 2026** and moved to **new customer accounts**, which are **passwordless and API-driven by default**: buyers sign in with **email or SMS one-time passcode** (a 6-digit code each login), no passwords, no resets. The **Customer Account API** (GraphQL) is the headless identity contract; headless storefronts implement **OAuth 2.0 PKCE** and resolve endpoints via `/.well-known/openid-configuration` (**OIDC**). The `shopify-account` web component does passwordless email/SMS sign-in plus **automatic Shop Pay recognition** (Shop ID is the network-wide buyer identity). **Passkeys, enterprise SSO, and custom auth** are **not native** — they require integrating an external OAuth/OIDC IdP. **Multipass** (the legacy SSO-handoff token) is **deprecated and unsupported on new accounts.** Staff/Organization identity (Shopify admin/Plus org) is a separate domain; apps authenticate via **OAuth** (authorization-code + token exchange, App Bridge session tokens).

The arc: **passwordless-first, API-first, OIDC-compatible, with advanced auth delegated to external IdPs.**

### LetBuyy current (cited)
LetBuyy's identity spine is **closer to Shopify's new model than to its legacy model**, which is the right side of history. The token kernel is **HS256 throughout with algorithm-confusion designed out** (high-value tokens omit a JWT header entirely; the one real JWT pins `alg==='HS256'`; timing-safe compare — `AUTH_FORENSIC_AUDIT.md` §2.1, `index.ts:1213/797/1278`). **Buyer OTP is passwordless** (CSPRNG 6-digit, single-use, expiring — §7), matching Shopify's email-OTP model. Merchant passwords are **bcrypt cost 12** with rotating, reuse-detecting, server-side sessions (§1, `merchant-password.ts:3`, `merchant-session.ts`). **App-marketplace OAuth2 is a real authorization-code + PKCE-S256 flow** with redirect_uri allowlisting and code↔client↔redirect binding (§10, `shared.ts:284`) — i.e., the *consumer*-OAuth side is genuinely built. Turnstile is enforced and fail-closed.

**But:** (1) the **OIDC identity-provider is a 501/404 skeleton** serving placeholder JWKS coordinates (`oidc-disabled.ts:11`) — so LetBuyy *cannot* yet be an OIDC provider the way Shopify's Customer Account API is (§10, `AUTH-020`). (2) Two **live S0/S1 identity holes**: the `/api/auth/switch` **account-takeover is fixed only in the uncommitted working tree — every deployable branch is exploitable** (`AUTH-001`, S0, §4), and the `super_admin_allowlist` RLS policy is open to PUBLIC writes (`AUTH-003`/FND-005, §5). (3) **Shared `AUTH_SECRET`** is a universal fallback across seven trust domains, and since everything is HS256, the verification key is the forgery key (`AUTH-002`, S1, §2.3). (4) A **parallel legacy Supabase-auth surface** (`/auth/signin|signup|otp`) coexists with the hardened path — the "two parallel systems" pattern (`AUTH-010/011`, §8).

### Verdict: **ALIGN (passwordless + OAuth/PKCE) + LEAPFROG (no legacy password accounts to deprecate) + PARITY-GAP (OIDC provider)**
LetBuyy is correctly building the *new* Shopify identity model, but has a real gap on the OIDC-provider piece and two live security holes that block any alignment claim until fixed.

### Reasoning
- **Passwordless buyer OTP + OAuth2-S256-PKCE = ALIGN.** This is exactly where Shopify landed in Feb 2026, and V1 §3 mandates it. LetBuyy built the load-bearing pattern.
- **No legacy customer accounts / no Multipass = LEAPFROG.** Shopify is *mid-migration* off password accounts and Multipass right now, breaking integrations. LetBuyy has **no legacy password-account corpus and no Multipass** — it can be passwordless-native from day one and skip the migration entirely. State this as an asset.
- **OIDC provider = PARITY-GAP.** Shopify's Customer Account API *is* an OIDC-discoverable identity provider; LetBuyy's is a disabled skeleton advertising an ES256 JWKS it cannot sign with. For the envelope this is acceptable to defer (V1 notes "OIDC readiness"), but it is the one place LetBuyy *says* it matches Shopify and *doesn't* — so it must be labeled a gap, not a feature. Do **not** advertise the skeleton JWKS.
- **The two S0s are not alignment issues — they are go-live blockers** that make the otherwise-good identity layer score ~2.7/5 (§1). No "we match Shopify's identity model" statement is defensible while an unauthenticated account-takeover ships on every branch.

### What LetBuyy should do
1. **Commit and deploy the `/api/auth/switch` fix immediately** (it exists, unstaged, in the working tree) and **fix the `super_admin_allowlist` RLS `TO` clause** to `service_role`. These are the two live identity S0s; nothing else in identity matters until they ship (`AUTH-001`, `AUTH-003`).
2. **Make every per-domain secret mandatory (fail-closed when unset); remove all `|| AUTH_SECRET` fallbacks on money/identity paths;** migrate the high-value token kernel to **asymmetric ES256 with the already-scaffolded JWKS**, so verification keys stop being forgery keys (`AUTH-002`). This *also* unblocks becoming a real OIDC provider.
3. **Collapse the parallel legacy Supabase-auth surface** into the hardened custom path (one session regime, one revocation story) (`AUTH-010/011`).
4. **Defer the OIDC IdP honestly** — keep it 404/flag-off and stop serving placeholder JWKS; build it only when a headless/SSO merchant needs it (matching Shopify's "advanced auth via external IdP" stance, but as the provider).
5. Keep buyer OTP + consumer OAuth2-S256-PKCE exactly as built — that is the aligned core.

---

## 6. Apps platform — extensions, Functions, App Bridge, billing

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Shopify's app platform is the engine of its ecosystem and the most "end-state" of its subsystems. Apps embed in admin via **App Bridge** (JS SDK) rendering **Polaris web components in an iframe**; **App Bridge + Polaris now load unversioned from Shopify's CDN** (2025-10) and unify styling across admin + checkout + customer-account surfaces. **App extensions** (admin UI, checkout UI, theme app extensions, etc.) **moved to Preact + web components with a 64KB bundle cap (2025-10)**. **Shopify Functions** are **Wasm (Rust/JS)** server-side logic with bounded performance. There is a **Billing API** (apps charge merchants — recurring/usage/one-time — through Shopify). Crucially, Shopify **gates extensibility behind review + sandboxing**: extensions run isolated, with no checkout/payment-data access; Functions are resource-limited Wasm; the App Store reviews apps. This entire apparatus exists to let **thousands of third-party developers** safely customize **millions of stores** — it is a response to *scale + ecosystem demand*.

### LetBuyy current (cited)
LetBuyy has **prematurely built a large slice of this end-state.** It ships: a **Wasm app-functions runtime** executing in the live checkout (heavily sandboxed — §12 of checkout audit), a **3rd-party app marketplace** that is a canonical deployable runtime tier (`apps/app-marketplace` + ~20 marketplace migrations 092–112 + an `app-store` route family + a partner-payout ledger — `ARCHITECTURE_COMPLIANCE_AUDIT.md` R-11 VIOLATED), real **app OAuth2 + PKCE** install flows (the genuinely-good part — `AUTH` §10), a mobile **app-bridge runtime screen**, and checkout-extension hosting on the storefront (`CheckoutExtensionHost.tsx`). V1 §4 **R-11 rejects** "3rd-party App Marketplace + Checkout Extensions + Wasm runtime + Workflow engine" for this envelope, and §5 defers first-party catalog seeding to P2 and 3rd-party reopen to ~5k merchants. The audit's blunt finding: the marketplace is "an empty mall with no supply."

### Verdict: **DIVERGE-INTENTIONALLY (delete the running machinery; keep seams) — this is the #1 premature-mimicry**
LetBuyy should *not* match Shopify's app platform now. It should rip the live extensibility machinery back to seams.

### Reasoning
This is the textbook case the program's decision rule was written for: **alignment does not mean copy everything; it means copy load-bearing patterns and skip the scale/extensibility machinery until demand exists.** Shopify's app platform is load-bearing *for Shopify* because Shopify has the two-sided ecosystem (thousands of devs, millions of merchants) that justifies the sandbox/review/versioning burden. LetBuyy has **zero third-party developers and zero merchants** — every hour spent on the Wasm runtime, the marketplace tier, and checkout-extension hosting is an hour not spent on the hosted checkout / ledger / RLS work that V1 P0 actually requires. Worse, it *enlarges the attack surface* (third-party code paths in a live commerce monolith) and *contradicts the constitution* the platform claims to follow. The one genuinely-reusable piece — the **app OAuth2-S256-PKCE flow** — should be kept (it is clean and is also the consumer-OAuth pattern identity needs), but the *executor*, the *marketplace runtime*, and the *checkout-extension host* should go dormant.

### What LetBuyy should do
1. **Decommission the live Wasm app-functions runtime and `CheckoutExtensionHost`** from the order/storefront path (see Checkout §4 action 4). Preserve the *interface* as a documented seam in `packages/extension-host` (no investment).
2. **Take the app-marketplace tier out of active topology** — it is a V1 §6 topology violation. Either reduce it to a dormant scaffold or, if first-party-only app seeding is genuinely wanted at P2, reframe it as a curated first-party catalog, not a 3rd-party mall.
3. **Keep the app OAuth2 + PKCE flow** — it is the one aligned, reusable asset here.
4. **Re-open the app platform only at Shopify-like demand triggers** (~5k merchants + inbound developer demand, per V1 §5/R-11). Until then, "no app platform" is the *correct* divergence, not a missing feature.
5. **Do not build a Billing-API-for-apps** — there are no apps to bill. (Merchant subscription billing is separate and is correctly built — see §8.)

---

## 7. Merchant admin — the "OS" (IA, Polaris, admin GraphQL)

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Shopify admin is an **operator-first IA** (Orders, Products, Customers, Analytics, Marketing, Discounts as primary nav) built on the **Polaris design system** — which in 2025 **unified onto Web Components** (smaller, faster, framework-agnostic, served from CDN, shared across admin + checkout + customer-account surfaces; the old `polaris-react` is deprecated). The programmable admin surface is the **Admin GraphQL API** (versioned calver, e.g. `2025-07`/`2025-10`; token via `X-Shopify-Access-Token`). Apps render inside admin via App Bridge + Polaris web components.

### LetBuyy current (cited)
LetBuyy's admin is the `merchant-control-plane` web app + the Flutter merchant app, over the `api-gateway` monolith. The audits score the **mobile merchant app as the best-finished surface (3.1/5)** with a strong theme editor (`MOBILE_FORENSIC_AUDIT`, master index). V1 §10 mandates an **operator-first IA** ("reorder so Orders / Money / Customers are primary; today buried under Settings") and a **provider-mode honesty badge** on every money/fulfillment surface. The compliance audit finds the IA partially done (login unblocked; honesty badge **not** systemic — "no `ProviderModeBadge` component anywhere," only a text subtitle on one mobile tile — `ARCHITECTURE_COMPLIANCE_AUDIT.md` P4). The design-system memory notes a Polaris-grade token core but dormant governance and low shell adoption (per memory `letbuyy-design-system-audit`). The admin is **REST/GraphQL-hybrid** (the gateway mounts GraphQL admin+storefront routers — `index.ts:78-80`), not a single versioned admin GraphQL contract.

### Verdict: **ALIGN (operator-first IA + design-system) + PARITY-GAP (honesty badge, design-system governance)**
The right pattern is chosen; execution is partial.

### Reasoning
Operator-first IA and a Polaris-grade token system are **load-bearing UX patterns** worth copying — they are how a merchant runs their business, and V1 independently mandates them. LetBuyy has the token core (the hard part) but hasn't finished the *governance + adoption* (the part that makes a design system actually unify the surfaces — which is precisely what Shopify did in its 2025 Polaris-on-Web-Components unification). The **provider-mode honesty badge is a V1-specific requirement with no Shopify analog** (Shopify doesn't need it — its rails are all live), and it is *missing*, which is a parity-gap against LetBuyy's *own* constitution, not against Shopify. A **single versioned admin GraphQL contract** (à la Shopify's `2025-07`) is worth adopting as the canonical programmatic surface, but is lower priority than finishing the IA and badge.

### What LetBuyy should do
1. **Finish the operator-first IA** (Orders/Money/Customers primary) across web + mobile, per V1 §10. The mobile app is closest; bring the control plane to parity.
2. **Ship the provider-mode honesty badge as a systemic component** on every money/fulfillment surface (a stub must never read as `success` — V1 P4/R2). This is a P0 V1 item and a trust-defining control given LetBuyy's mock-by-default rails.
3. **Activate design-system governance and drive shell adoption** — Shopify's 2025 lesson is that a token core only pays off when it's enforced and unified across surfaces. (Aligns with the dormant-governance finding in the design-system memory.)
4. **Consolidate on one versioned admin GraphQL contract** as the canonical programmatic admin surface (Shopify-style calver), retiring ad-hoc REST where practical — a medium-term alignment, not a P0.

---

## 8. Billing & Payments — Shopify Payments, Billing API, the 0% model

### Shopify approach (current) [WEB-VERIFIED 2026-06]
Two distinct things often conflated:
- **Shopify Payments** is Shopify's **own integrated processor** (powered by Stripe under the hood). When a merchant uses it, Shopify **waives its platform "transaction fee" (the 0%–2% surcharge it otherwise levies on third-party gateways)** — *but the merchant still pays card-processing fees* (2.9% + 30¢ Basic → 2.15% + 30¢ Plus, in the US). **Shop Pay** rides on Shopify Payments at no extra fee. So the famous **"0% transaction fee" is the waiver of Shopify's *surcharge*, conditioned on using Shopify's *own* processor** — it is a **steering mechanism**, not free payments. Shopify here is **merchant-of-record-adjacent / the processor**: it custodies and pays out (payouts, payout fees, reserves).
- **Billing API** is how *apps* charge *merchants* (recurring/usage/one-time) through Shopify — unrelated to payment processing.
- 2025 nuance: from May 12 2025, store-credit/gift-card amounts can incur third-party transaction fees.

### LetBuyy current (cited)
LetBuyy's model is the **structural opposite of Shopify's, by deliberate V1 design — and this is its core strategic bet.** V1 Principle 2: "**Rent money movement; never custody it.** Merchant is MoR on their **own** Razorpay for money-in; a **licensed PA (Razorpay Route / Cashfree) custodies and disburses** money-out; LetBuyy only instructs splits and mirrors status." V1 Principle 9: "**0% transaction fee is permanent on every paid tier; kill the 2.5% GMV rake.**" The money-in side is **real and correct** (store-scoped credentials; storefront Razorpay order creation against the merchant account — `ARCHITECTURE_COMPLIANCE_AUDIT.md` §7 APPROVED). The double-entry ledger across the 8 named accounts is built with append-only/balance triggers (`139`), and the **payment-forgery fix + unique `provider_payment_id` index are live in tree** (§7 APPROVED-FIXED). Merchant subscription billing (plans/AutoPay-mock/dunning/plan-gating) is built and is the correct Shopify-analog of recurring billing (§3.3 APPROVED, `152`).

**But three money divergences contradict V1 (and the 0% promise):** (1) a **live default 3% GMV commission + 18% GST-on-fee deducted from every payout** (`payouts.ts:344,398-401`; auto-seeded `commission.ts:202`) — V1 ordered the rake *killed*, the marketing site promises "no transaction fees," and the audit rates this a **VIOLATION** (P9/R-14). (2) The **payout rail is hardcoded `razorpayx`** — an own-account disbursement product (self-custody *shape*), not the Route/Cashfree split V1 mandates (`payouts.ts:119-120`; R-6 PARTIALLY-VIOLATED). (3) **Capture/refund/COD flows don't all post to the canonical ledger** (`CHK-020`; `PAYMENTS_FORENSIC_AUDIT`), so the ledger that exists isn't yet the sole source of money truth.

### Verdict: **DIVERGE-INTENTIONALLY (rent-don't-custody is the right India bet) + PARITY-GAP-vs-own-constitution (0% promise is currently broken)**
LetBuyy should **defend** the architectural divergence from Shopify and **fix** the divergence from its own 0% constitution.

### Reasoning
- **Rent-don't-custody is a *correct* intentional divergence, not a deficiency.** Shopify can be the processor/MoR because it holds payment-institution status in its markets and has the scale to run Shopify Payments. In **India**, moving money requires a PA/PG licence; V1's "merchant-is-MoR-on-own-Razorpay + licensed PA disburses" is the **regulation-correct** posture and deletes the entire in-house disbursement-engine risk (V1 R-1 risk register S0). This is the single most important *intentional* divergence in the platform and should be stated proudly — it is *more* defensible than copying Shopify Payments would be.
- **The "0% transaction fee" framing is where LetBuyy must be most careful — and is currently failing.** Shopify's "0%" is a *conditional surcharge waiver* tied to using its own processor; it is a steering lever. LetBuyy's 0% is meant to be **unconditional and permanent** (the wedge: UPI MDR≈0 means a fee buys almost nothing and costs the brand — V1 R-14). The platform **breaks its own promise** by deducting a 3% rake while advertising zero fees. This is not a Shopify-parity question at all — it is a **constitution-compliance and trust** question, and it is the most consequential money finding. (If LetBuyy ever *wants* a Shopify-style "0% if you use our rail" model, that is a deliberate strategy change requiring ARB sign-off — but today the code contradicts the marketing, which is the worst of both worlds.)
- **Merchant subscription billing = ALIGN** (it is the legitimate Shopify-analog and is built correctly).

### What LetBuyy should do
1. **Set commission to 0 and honor the 0% promise** (or, if a steering model is genuinely wanted, make it an explicit ARB decision and align the marketing — but do not ship a hidden 3% rake under a "no fees" banner) (`ISSUE-015`, P9/R-14).
2. **Replace the `razorpayx` self-custody rail with the PA-split (Route/Cashfree) instruction-and-mirror** the V1 schema already anticipates (`151:139-141`), so LetBuyy never custodies (`ISSUE-014`, R-6).
3. **Ledger every capture/refund/COD** so the canonical double-entry ledger is the sole money truth (closes the gap that makes reconciliation drift).
4. **Defend the rent-don't-custody divergence explicitly** in the canonicalization narrative as a *deliberate, regulation-correct* departure from Shopify Payments — not an unfinished feature.
5. Keep merchant subscription billing as the aligned recurring-billing surface; do **not** build an apps-Billing-API (no apps).

---

## 9. Leapfrog opportunities (what LetBuyy can build that Shopify can't easily, because no legacy)

These are the places where LetBuyy's *absence of legacy and merchants* is a strategic asset Shopify cannot replicate. The program should name these explicitly.

| # | Leapfrog | Why Shopify can't easily do it | What LetBuyy should do |
|---|---|---|---|
| L-1 | **Born with sandboxed, server-authoritative, declarative checkout — never carry `checkout.liquid`** | Shopify spent 2023→2026 deprecating scriptable checkout, forcing auto-upgrades (Jan 2026), and discontinuing Scripts (Jun 30 2026) — a multi-year, integration-breaking migration. | Ship the hosted `checkout.letbuyy.com` server-authoritative origin as the *only* checkout from day one. Zero migration tax, ever. (Closes `CHK-015`; turns V1's biggest gap into a strategic asset.) |
| L-2 | **Passwordless-native + OIDC-ready identity — no legacy password accounts, no Multipass to deprecate** | Shopify is mid-migration off legacy password accounts and Multipass (deprecated Feb 2026), breaking storefront integrations. | Be passwordless (email/SMS OTP) + OAuth2-S256-PKCE native; skip the Multipass→Customer-Account-API migration Shopify is enduring. (LetBuyy already built the OTP + PKCE core — §5.) |
| L-3 | **Theme blocks (reusable, nestable) from the start — no sections-v1 corpus to migrate** | Shopify had to introduce theme blocks (2024–2025) *on top of* a massive installed base of sections-v1 themes, with private-block/`@app` compatibility gymnastics. | Adopt nestable reusable theme blocks now (the schema machinery exists — §2). No theme-corpus migration. |
| L-4 | **UPI/WhatsApp/COD-native commerce as the default checkout & lifecycle, not bolt-ons** | Shopify's checkout, identity, and notifications are card/email-native; India rails (UPI intent, WhatsApp lifecycle, COD-confirm/RTO) are second-class or app-dependent. | Make UPI one-tap, WhatsApp order-lifecycle + COD-confirm, and COD/RTO heuristics first-class (V1 §8/§11). A future "Shop-Pay-for-UPI" one-tap is a natural L-4 extension. |
| L-5 | **Ledger-first money truth + provider-mode honesty as a platform primitive** | Shopify's money model is the processor itself; it doesn't expose (or need) a merchant-facing "this rail is mock/sandbox/live" honesty layer, and its ledger is internal. | Make the append-only double-entry ledger the sole money truth (ledger every flow — §8) and ship the honesty badge everywhere (V1 P4). A platform that is *honest about what's live* is a differentiator at the SMB tier. |
| L-6 | **One modular monolith a 6–9-person team can actually run** | Shopify's value chain is a large service fleet appropriate to its scale; an SMB-India entrant copying that fleet would drown in ops. | Keep the single `api-gateway` monolith + 4 satellites (V1 §6). This is already done correctly — defend it against scope-creep back toward services (V1 R-1/R-11). |

---

## 10. Premature-Shopify-mimicry warnings (what LetBuyy is copying too early)

These are places where LetBuyy has grafted Shopify's **1M-merchant end-state** onto a 0-merchant India platform. All are V1 violations and all should be **stopped/deleted now**, not finished.

| # | Premature mimicry | Evidence | Why it's premature | Action |
|---|---|---|---|---|
| PM-1 | **Wasm checkout-functions runtime in the live order path** | `evaluateCheckoutAppFunctions` before `createOrder` (`CHECKOUT_FORENSIC_AUDIT.md` §12); R-11 VIOLATED (`ARCHITECTURE_COMPLIANCE_AUDIT.md`) | Shopify Functions exist to let *thousands of devs* customize *millions of stores* safely. LetBuyy has neither. Adds third-party code to a live commerce monolith for zero near-term value. V1 R-11 rejects it. | Decommission the executor; keep the interface as a dormant seam. (§4 action 4, §6 action 1) |
| PM-2 | **3rd-party app marketplace as active topology** | `apps/app-marketplace` deployable + ~20 migrations + `app-store` routes + partner-payout ledger (R-11 VIOLATED) | "An empty mall with no supply." Forces sandbox/review/versioning burden with zero developers. V1 §6 topology omits it; R-11 rejects it. | Take out of active topology; reframe as dormant scaffold or first-party-only curated catalog at P2. (§6 action 2) |
| PM-3 | **CQRS / event-sourcing / saga / schema-registry governance** | `runtime-topology-validator.mjs` requires `eventStoreProvider`+`replayIntegrity`; 12+ projection/replay/CQRS validators run (R-5 VIOLATED at governance layer) | Solves a scale/audit problem LetBuyy doesn't have; the transactional outbox + append-only ledger already deliver the guarantees. V1 R-4/R-5 reject it. | Stop enforcing the rejected architecture in CI; make validators enforce V1, not `AGENTS.md`. (Resolves the two-constitution conflict — `ARCHITECTURE_COMPLIANCE_AUDIT.md` §1.) |
| PM-4 | **Multi-region / failover / partition-recovery governance** | `survivability-`/`partition-recovery-`/`failover-certification-validator.mjs`; reserved manifests demand `multi-region-runtime-governance.md` (R-13 VIOLATED at governance) | Scale infra for a problem the 100→10k envelope does not contain. The runtime is correctly single-region; only the *governance* mandates the end-state. V1 R-13 rejects it. | Strip multi-region/failover certification from the gate; keep one-region runtime. |
| PM-5 | **AI operator surfaces in P0/P1** | `/ai` router mounted; mobile "AI store operator" FAB; `ai_screen.dart` (R-15 VIOLATED) | "No beta merchant blocks on this; build a seam, not a model." V1 R-15 defers AI to P2. | Demote AI to a seam (mode-mock is fine); remove the merchant-facing P0 surfaces. |
| PM-6 | **181-validator governance gate enforcing the *rejected* constitution** | 181 validators pass; zero reference V1; certify provider-failover/multi-region/9-chaos-experiments while 9 S0s ship (`000_MASTER_INDEX.md` Q2) | The platform "certifies itself production-ready while 9 S0 vulnerabilities sit live" — governance theater modeled on Shopify-scale rigor, for an unshipped product. | Repoint the gate at V1; gate on the 9 S0s and the V1 P0 backlog, not on Shopify-end-state certifications. |

---

## 11. Intentional divergences (India / envelope) — defend these

These are *correct* departures from Shopify, driven by India regulation, the merchant envelope, or the no-legacy advantage. They should be stated as deliberate strategy, not treated as parity gaps.

| # | Divergence | Shopify does | LetBuyy does (V1) | Why it's correct |
|---|---|---|---|---|
| ID-1 | **Rent money, don't custody** | Shopify *is* the processor (Shopify Payments / MoR-adjacent); custodies + pays out | Merchant = MoR on own Razorpay; licensed PA (Route/Cashfree) custodies & disburses; LetBuyy only instructs splits | India PA/PG licensing reality; deletes in-house disbursement risk (V1 P2/R-6, risk R1=S0). *More* defensible than copying Shopify Payments. |
| ID-2 | **0% transaction fee, unconditional & permanent** | "0%" = surcharge waiver *conditional* on using Shopify Payments (a steering lever); processing fees always apply | 0% on every paid tier, permanently; monetize adjacencies (WhatsApp/shipping/AI credits) | UPI MDR≈0 → a fee buys nothing and costs the brand; 0%-forever is the wedge (V1 P9/R-14). **Must actually be honored — currently isn't (§8).** |
| ID-3 | **One modular monolith, not a service fleet** | Large service value chain | `api-gateway` monolith + `queue-workers` + `mobile-bff` + `identity-platform` + `webhook-service` | 6–9-person team; ops reality; "service only when a measured hot-path forces it" (V1 P1/R-1). |
| ID-4 | **WhatsApp/UPI/COD-first commerce** | Card/email-native; India rails are app-dependent | WhatsApp order-lifecycle + COD-confirm + consent ledger; UPI + COD checkout first-class | India market reality; COD-confirm-over-WhatsApp is the RTO/fraud lever (V1 §11/R-7/R-10). |
| ID-5 | **No checkout extensibility / no app platform now** | Checkout UI extensions + Functions + App Store (reviewed, sandboxed) | Seams only; no live extensibility; no 3rd-party marketplace | No developers, no merchants → the sandbox/review burden buys nothing yet (V1 R-11). Re-open at ~5k merchants + dev demand. |
| ID-6 | **No headless Hydrogen/Oxygen tier** | Runs Liquid SSR *and* Hydrogen/Oxygen in parallel | One Liquid-SSR runtime | No headless-developer population in the envelope; dual runtimes are premature scale (V1 P7). |
| ID-7 | **No CQRS / event-sourcing / multi-region** | (Internal, at scale) | Transactional outbox + append-only ledger + one region | Outbox + ledger deliver the guarantees without the infra; envelope has no scale problem (V1 R-5/R-13). |

---

## 12. Shopify-parity scorecard

"Parity %" = how much of Shopify's *current* capability in each subsystem LetBuyy has, weighted toward **load-bearing patterns** (not end-state machinery). "Target parity (10k envelope)" = the parity LetBuyy *should* aim for given V1 — note several targets are intentionally **<100%** (matching Shopify fully would violate V1).

| Subsystem | LetBuyy parity now | Target parity (10k envelope) | Gap type | Notes |
|---|---|---|---|---|
| **Theme platform (OS 2.0)** | ~62% in code / ~50% live | **~85%** | Completion | Model is Shopify-grade; turn Liquid on, add dynamic sources + theme blocks + lint. Full 100% (theme-store ecosystem) not needed yet. |
| **Storefront runtime** | Liquid SSR built-but-off; React-per-section live; no headless | **~70%** (Liquid SSR live, single runtime) | Completion + intentional cap | Do **not** add Hydrogen/Oxygen — target excludes the headless tier by design. |
| **Checkout** | Server-authoritative core strong; hosted origin missing; extensibility over-built | **~80%** (server-authoritative + hosted origin; no extensibility) | Completion + deletion | Finish hosted origin + cart-bind; delete Wasm functions. Extensibility intentionally 0%. |
| **Identity** | Passwordless OTP + OAuth2-PKCE built; OIDC IdP skeleton; 2 live S0s | **~85%** (after S0 fixes + ES256) | Security blockers + 1 gap | OIDC-provider deferred-but-honest. Fix the takeover + allowlist first. |
| **Apps platform** | Wasm runtime + marketplace over-built; OAuth/PKCE good | **~15%** (seams + OAuth only) | Deletion | Target is *intentionally low* — V1 rejects the app platform now. Keep seams + OAuth. |
| **Merchant admin (OS)** | Operator-first IA partial; token core present; honesty badge missing | **~85%** | Completion | Finish IA + honesty badge + DS governance + one admin GraphQL contract. |
| **Billing / Payments** | Money-in + ledger + sub-billing real; 3% rake + razorpayx + un-ledgered flows violate V1 | **~90%** (constitution-compliant, not Shopify-cloned) | Constitution fixes | "Parity" here means *V1 compliance*, not Shopify-Payments cloning (which V1 rejects). Kill rake, PA-split, ledger everything. |

**Composite:** LetBuyy is at roughly **55–60% of the parity it should target** for the 10k envelope. The shortfall is concentrated in **four completion items** (Liquid-on, hosted checkout, dynamic sources, honesty badge), **two security blockers** (auth takeover, allowlist RLS), **three money fixes** (rake, rail, ledgering), and **four deletions** (Wasm functions, marketplace tier, CQRS/multi-region governance, AI P0 surfaces). None of the shortfall is "we need to build more Shopify-end-state" — it is *finish the load-bearing patterns and delete the premature ones*.

---

## 13. Alignment Findings

ID | Area | Shopify pattern (current) | LetBuyy gap / divergence (evidence) | Recommendation | Priority
---|---|---|---|---|---
**SHOP-001** | Identity | New customer accounts passwordless; advanced auth via external IdP; **no unauthenticated account access** | `/api/auth/switch` account-takeover **live on every deployable branch** (fix uncommitted) — `AUTH-001` S0, `AUTH_FORENSIC_AUDIT.md` §4 | Commit + deploy the existing working-tree fix immediately (require valid session + proven-account cookie) | **P0**
**SHOP-002** | Identity / RBAC | Staff/org identity is gated; no self-service privilege escalation | `super_admin_allowlist` RLS `USING(true) WITH CHECK(true)` no `TO` clause → PUBLIC writes — `AUTH-003`/FND-005 S0/S1, §5 | Add `TO service_role`; verify PostgREST table exposure with an anon probe | **P0**
**SHOP-003** | Checkout | Single server-validated hosted checkout origin (post-`checkout.liquid`) | `checkout.letbuyy.com` origin **does not exist**; signed URLs are dead links; live checkout uses public `POST /:subdomain/orders` — `CHK-015` S2 | Build + deploy the hosted server-authoritative checkout origin consuming the signed handoff (V1 P0) | **P0**
**SHOP-004** | Billing / Payments | Shopify's "0%" is a *conditional* waiver; LetBuyy promised *unconditional* 0% | Live **3% GMV rake + 18% GST-on-fee** deducted from payouts while marketing says "no fees" — P9/R-14 VIOLATION, `payouts.ts:344` | Set commission to 0 (honor the promise) **or** make a steering model an explicit ARB decision + fix marketing | **P0**
**SHOP-005** | Billing / Payments | Shopify custodies as processor; LetBuyy's V1 says **never custody** | Payout rail hardcoded `razorpayx` (own-account disbursement = self-custody shape), not Route/Cashfree split — R-6, `payouts.ts:119-120` | Replace with PA-split instruction-and-mirror (schema already exists `151:139-141`) | **P0**
**SHOP-006** | Apps platform | Functions = reviewed/sandboxed Wasm for a 1M-store ecosystem | LetBuyy runs a **Wasm checkout-functions executor in the live order path** with no ecosystem — R-11 VIOLATION, `CHECKOUT_FORENSIC_AUDIT.md` §12 | Decommission the executor + `CheckoutExtensionHost`; keep the interface as a dormant seam | **P0**
**SHOP-007** | Theme platform | OS 2.0 themes render through sandboxed **Liquid** | LetBuyy's Liquid renderer is **flag-OFF dead code**; live path is React-per-section; portable-theme story can't be exercised — `THEME-001` S1, `theme-governance.ts:14` | Flip Liquid on behind a per-theme engine switch + canary (Liquid-first is a V1 goal) | **P1**
**SHOP-008** | Identity | Token kernel asymmetric-capable; OIDC discoverable | High-value tokens all HS256 with shared `AUTH_SECRET` fallback across 7 domains (verify key = forge key) — `AUTH-002` S1, §2.3 | Make per-domain secrets mandatory; remove `||AUTH_SECRET`; migrate to ES256 + JWKS | **P1**
**SHOP-009** | Checkout | Server-authoritative handoff bound to cart; no client-mutable post-sign | Signed `checkout_url` **does not bind cart contents**; public order-create decrements stock pre-payment — `CHK-001`/`CHK-012` S2/S3 | Hash cart into the signature; gate public order-create behind the handoff; reserve-TTL for COD | **P1**
**SHOP-010** | Billing / Payments | Internal ledger is processor truth | Capture/refund/COD flows **don't all post to the canonical ledger** — `CHK-020` S1; un-ledgered capture per `PAYMENTS_FORENSIC_AUDIT` | Post reversing F-class entries for every money event; make the ledger the sole truth | **P1**
**SHOP-011** | Merchant admin | Polaris honesty is implicit (all rails live); LetBuyy needs explicit honesty | **No provider-mode honesty badge component** anywhere (V1 P4/R2 mandate) — `ARCHITECTURE_COMPLIANCE_AUDIT.md` P4 | Ship a systemic honesty badge on every money/fulfillment surface; a stub must never read `success` | **P1**
**SHOP-012** | Governance | Shopify's rigor matches its scale | 181 validators enforce the **rejected** `AGENTS.md` end-state (CQRS/multi-region/marketplace); **zero reference V1**; certify-ready while 9 S0s live — `000_MASTER_INDEX.md` Q2 | Repoint the gate at V1; gate on the 9 S0s + V1 P0 backlog, not Shopify-end-state certifications | **P1**
**SHOP-013** | Apps platform | App Store is a curated, reviewed ecosystem | 3rd-party **app marketplace is active topology** with no supply ("empty mall") — R-11 VIOLATION | Remove from active topology; reframe as dormant scaffold / first-party catalog (P2) | **P1**
**SHOP-014** | Theme platform | Dynamic sources bind sections to metafields/metaobjects | LetBuyy has **no dynamic-source / metafield binding** (only product fetch) — `THEME-007`, `data-binding-engine.ts:46` | Build a dataBinding resolver registry (collections/pages/blogs/metafields/metaobjects) | **P2**
**SHOP-015** | Theme platform | Theme blocks: reusable, nestable (≤8 deep), 2024–2025 evolution | LetBuyy has sections+blocks-v1 only; no reusable/nestable theme blocks | Adopt theme blocks now (no legacy theme corpus to migrate — a leapfrog) | **P2**
**SHOP-016** | Theme platform | Theme Check linter (CLI + editor + CI) | **No theme-check/lint surface** as a product; validation server-side at save only — `THEME-016` | Surface `collectThemeTemplateValidationIssues` + renderer audit as an editor "Issues" panel | **P2**
**SHOP-017** | Theme platform | Theme Store with many themes; Dawn reference theme | **Only `urban-kicks` seeded** — real machinery, empty shelf — `THEME-008` | Author 5–10 first-party themes, or reframe as "starter + editor" | **P2**
**SHOP-018** | Merchant admin | Admin GraphQL API, single versioned (calver) contract | LetBuyy is REST/GraphQL hybrid; no single versioned admin contract | Consolidate on one versioned admin GraphQL contract as the canonical programmatic surface | **P2**
**SHOP-019** | Storefront / Theme | Polaris unified on Web Components, enforced + CDN-served across surfaces (2025) | LetBuyy has a token core but **dormant DS governance + low shell adoption** (design-system memory) | Activate DS governance; drive shell adoption; unify tokens across web + mobile + storefront | **P2**
**SHOP-020** | Apps / AI | AI/extensibility gated behind demand + review | LetBuyy surfaces **AI operator in P0/P1** (R-15 VIOLATION); editor "AI hooks" are deterministic stubs labeled AI — `THEME-011` | Demote AI to a seam (mock mode ok); remove P0 merchant-facing AI surfaces; rename stub "AI" honestly | **P3**
**SHOP-021** | Storefront runtime | Liquid SSR **and** Hydrogen/Oxygen in parallel | LetBuyy has neither headless tier (correct) **and** a duplicated React/Liquid render path (incorrect) — `THEME-002/003` | Do not build headless; collapse to one render authority (Liquid SSR) | **P3**
**SHOP-022** | Checkout | Shop Pay = accelerated network wallet on Shopify Payments | LetBuyy has no accelerated one-tap; UPI intent is the natural India analog | (Later) build a UPI/WhatsApp one-tap "express checkout" once core checkout is solid — a leapfrog | **P3**

**Priority rollup:** **P0 ×6** (2 identity S0s, hosted checkout, 0%-rake, PA-split rail, kill live Wasm executor) · **P1 ×7** · **P2 ×5** · **P3 ×4**. Every P0 is either a live security/money blocker *or* a load-bearing pattern to finish/delete — none is "build more Shopify."

---

## 14. Sources (Shopify facts, web-verified June 2026)

**Checkout extensibility & `checkout.liquid` deprecation:**
- [Shopify Help — Upgrading Thank-You / Order-Status (Plus)](https://help.shopify.com/en/manual/checkout-settings/customize-checkout-configurations/upgrade-thank-you-order-status/plus-upgrade-guide)
- [Shopify Checkout Extensibility 2026: Deadline & Migration](https://revize.app/blog/shopify-checkout-extensibility-migration-guide)
- [Digital Position — Checkout Extensibility deadline Aug 28 2025](https://www.digitalposition.com/resources/blog/ppc/shopify-checkout-extensibility-deadline-august-28-2025-is-coming-heres-how-to-not-screw-it-up/)
- [Grey Shark Media — checkout.liquid deprecation timeline 2024–2025](https://greysharkmedia.com/shopify-checkout-liquid-deprecation-timeline-explained-2024-2025/)
- [shopify.dev — Checkout UI extensions (latest)](https://shopify.dev/docs/api/checkout-ui-extensions/latest)
- [shopify.dev — About checkout app extensions](https://shopify.dev/docs/api/checkout-extensions)

**Online Store 2.0 / themes / theme blocks:**
- [shopify.dev — Online Store 2.0](https://shopify.dev/docs/storefronts/themes/os20/index)
- [shopify.dev — JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates)
- [shopify.dev — Building with sections and blocks](https://shopify.dev/docs/storefronts/themes/best-practices/templates-sections-blocks)
- [shopify.dev — Configure theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration)
- [shopify.dev — Dynamic data sources](https://shopify.dev/docs/storefronts/themes/architecture/settings/dynamic-sources)
- [shopify.dev — Blocks / theme blocks schema](https://shopify.dev/docs/storefronts/themes/architecture/blocks)
- [Shopify Partners — Theme Blocks guide](https://www.shopify.com/partners/blog/theme-blocks)

**Storefront runtime — Hydrogen / Oxygen / Storefront API:**
- [hydrogen.shopify.dev — March 2025 release (React Router)](https://hydrogen.shopify.dev/update/march-2025)
- [shopify.dev — Hydrogen React (latest)](https://shopify.dev/docs/api/hydrogen-react/latest)
- [GitHub — Shopify/hydrogen](https://github.com/shopify/hydrogen)

**Identity — Customer Account API / passwordless / Multipass:**
- [No7 Software — Customer Accounts API passwordless in production (2026)](https://no7software.co.uk/blog/shopify-customer-accounts-api-passwordless)
- [Shopify Help — Upgrading to customer accounts from legacy](https://help.shopify.com/en/manual/customers/customer-accounts/upgrade)
- [Revize — Legacy customer accounts deprecated (2026)](https://revize.app/blog/shopify-legacy-customer-accounts-deprecated-upgrade-guide)
- [shopify.dev — Multipass](https://shopify.dev/docs/api/customer-authentication/multipass)
- [Shopify Partners — Customer Account API for headless](https://www.shopify.com/partners/blog/introducing-customer-account-api-for-headless-stores)

**Apps platform — App Bridge / Functions / Polaris / extensions:**
- [shopify.dev — About Shopify App Bridge](https://shopify.dev/docs/api/app-bridge)
- [Shopify Partners — Polaris unified and for the web (2025)](https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web)
- [Shopify Partners — Polaris goes stable (2025)](https://www.shopify.com/partners/blog/polaris-goes-stable-the-future-of-shopify-app-development-is-here)
- [Gadget — Shopify API 2025-10: Web components, Preact, checkout migrations](https://gadget.dev/blog/shopify-api-2025-10-web-components-preact)
- [Storetasker — The Shopify developer stack in 2025](https://resources.storetasker.com/blog/the-shopify-developer-stack-in-2025)

**Merchant admin — Polaris / Admin GraphQL:**
- [Shopify Polaris React](https://polaris-react.shopify.com/)
- [shopify.dev — Admin GraphQL API reference (2025-07)](https://shopify.dev/docs/api/admin-graphql/2025-07)

**Billing / Payments — Shopify Payments / fees / Shop Pay:**
- [Shopify Help — Shopify Payments fees](https://help.shopify.com/en/manual/payments/shopify-payments/onboarding/cost-of-shopify-payments)
- [Shopify Help — Fees and costs](https://help.shopify.com/en/manual/international/pricing/fees)
- [Shopify Help — Third-party transaction fees](https://help.shopify.com/en/manual/your-account/manage-billing/billing-charges/types-of-charges/third-party-charges/third-party-transaction-fees)
- [Platter — Shop Pay fees by plan](https://www.platter.com/blog/shop-pay-fees-shopify)

**Flagged — could not fully verify current state:**
- **Exact current US Shopify Payments processing rates by plan** were cited from secondary sources (2.9%/2.7%/2.5%/2.15% + 30¢) and are directionally correct but may have shifted with 2026 plan changes; the *structural* fact (surcharge waived on Shopify Payments, processing fees always apply) is robust. Treat specific bps as indicative.
- **Whether Shopify Functions currently supports languages beyond Rust/JS** (e.g., expanded Wasm language support in 2026) was not confirmed; Rust + JS is verified.
- **Precise theme-block GA vs. still-rolling-out status in mid-2026** — verified as "announced 2024, rolled out 2025," but exact GA breadth not pinned; does not affect the leapfrog recommendation.

---

*End of `SHOPIFY_ALIGNMENT_REPORT.md`.*
