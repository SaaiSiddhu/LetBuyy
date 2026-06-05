# CODEX EXTENSION PLATFORM MISSION — LetBuyy WS13 (Admin/Checkout UI Extensions + Functions)

**Driver:** Codex agent. Reasoning: `xhigh` for the Functions runtime + sandbox, `medium` for extension hosts.
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** a new `packages/extension-host/**` + `services/api-gateway` extension/function dispatch routes + `packages/app-engine/**` (extension contracts) + the extension **host** mount points in `apps/merchant-control-plane/src/components/extensions/**`, `apps/storefront-runtime/src/components/checkout-extensions/**`. **Backend + extension surfaces.**
**Dependencies:** WS7 (staging), WS11 (theme app blocks contract), WS12 (GraphQL for extensions to call). **Predecessor:** WS11 app‑block contract published.
**Source of truth:** `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` (Part 3.2). **Governance:** 128/128; never break existing app‑install/OAuth/billing; `[SKIP — NEEDS HUMAN]` and continue. Prove on **staging**.

---

## 0. PRIME DIRECTIVE
Build the **Shopify "extensions" magic** — the thing that lets installed apps **extend other surfaces**, not just call the API: **Admin UI extensions** (apps render inside the merchant admin), **Checkout UI extensions** (apps render inside checkout), **theme app blocks** (apps render into the storefront — the WS11 contract made real), and **Functions** (Wasm running custom discount/shipping/payment/validation logic at backend hook points). All declared by an **app manifest**, sandboxed, registered per‑tenant, observable, and revocable — on top of the existing OAuth/App‑Bridge seed.

**SUCCESS CRITERIA (proven on staging):**
1. **Extension registry + manifest:** an app declares its extensions (admin/checkout UI, theme app block, functions) + scopes in an `app manifest`; install registers them per‑store.
2. **Admin UI extension host:** an installed app renders a sandboxed UI extension inside `merchant-control-plane` (iframe/web‑component) with a session‑token‑verified bridge to the gateway.
3. **Checkout UI extension host:** an installed app renders a sandboxed UI extension inside the storefront checkout at defined targets.
4. **Theme app blocks (from WS11):** an installed app's block contribution renders into a theme section (wire the WS11 app‑block contract end‑to‑end).
5. **Functions (Wasm):** a **Wasm runtime** executes app‑provided functions at hook points — **discount**, **shipping**, **payment**, **cart/checkout validation** — with a strict input/output contract and a time budget (<5ms target); deterministic; sandboxed (no fs/network).
6. **Lifecycle:** extensions/functions are versioned, enable/disable per store, observable (logs/metrics), and revoked on uninstall.
7. No regression to install/OAuth/billing; 128/128; typecheck/build/tests green. `CODEX_WS13_LEDGER.md` + `CODEX_WS13_STATUS.md`.

## 1. OPERATING CONTRACT
1. Continuous; ledger → next. 2. **Green Law** (128/128 at gates; never red; 3 strikes → revert/BLOCKED). 3. **Security‑first:** UI extensions run **sandboxed** (iframe/web‑component, session‑token verified, scoped); Functions run in a **sandboxed Wasm** runtime (no fs/network, deterministic, time‑bounded). Sanitize everything an app provides. 4. **Additive:** build on the existing OAuth/App‑Bridge/app‑install — never break them. 5. **Staging proof:** an example app exercises an admin extension + a checkout extension + an app block + a discount Function, all on staging. 6. SKIP‑and‑continue; no fabrication; small reversible commits.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
Existing OAuth/app‑install/billing logic (extend, don't rewrite) · `packages/*-core/**` business logic · `database/**` except forward‑only extension/function registry tables · other domains' UI · governance · `shared-types` except additive.

## 3. THE WORK — X0 → X6
- **X0 Baseline + manifest.** `CODEX_WS13_LEDGER.md`; define the **app manifest** contract (declarative extension points + scopes + functions), extending `app-engine`. **Effort:** M. **Priority:** P0.
- **X1 Extension registry.** Per‑store registration of an app's extensions/functions on install; enable/disable; revoke on uninstall. **Files:** `packages/app-engine`, gateway `app-store` routes, a forward‑only registry migration. **Effort:** M. **Priority:** P0.
- **X2 Admin UI extension host.** `packages/extension-host` + a mount in `merchant-control-plane` that renders a sandboxed app UI extension (iframe/web‑component) with the session‑token bridge to the gateway/GraphQL. **Effort:** L. **Priority:** P0.
- **X3 Checkout UI extension host.** A sandboxed extension host at defined checkout targets in `storefront-runtime` checkout (extend cart/checkout without touching core checkout logic). **Effort:** L. **Priority:** P1.
- **X4 Theme app blocks (WS11 wire‑up).** Make installed‑app block contributions render into theme sections via the WS11 app‑block contract, end‑to‑end. **Effort:** M. **Priority:** P0.
- **X5 Functions runtime (Wasm).** A sandboxed **Wasm** runtime (on the gateway/worker) executing app functions at hook points — discount/shipping/payment/validation — with a typed input/output contract, determinism, and a time budget; wire into checkout‑core's discount/shipping/payment decision points via the existing seams. **Effort:** L. **Priority:** P0.
- **X6 Lifecycle + observability + dev handoff.** Versioning, enable/disable, logs/metrics per extension/function; publish the extension SDK/manifest contract for **WS10** (developer portal docs) and the app review (`platform-operations-portal`). **Effort:** M. **Priority:** P1.
- **GATE (FINAL):** an example app ships an admin extension + checkout extension + app block + a discount Function, all sandboxed and registered, proven on staging; uninstall revokes them; no regression; 128/128; status written.

## 4. SHOPIFY REFERENCE
Shopify extensions: App Bridge (embedded admin), Admin UI extensions, Checkout UI extensions, theme app extensions/app blocks, and Functions (Wasm at the edge, <5ms, discount/shipping/payment/cart‑validation, GraphQL input → declarative JSON output). Declared in the app manifest; sandboxed; per‑shop. Match the **model** over LetBuyy's existing app platform.

## 5. LEDGER — `CODEX_WS13_LEDGER.md`
```
# WS13 EXTENSION PLATFORM LEDGER — started <ts>
## PROGRESS / SKIPPED — NEEDS HUMAN / STAGING-PROOF (admin+checkout ext, app block, discount Function) / VALIDATOR (128/128)
## CONTRACT PUBLISHED: <manifest + extension/function contract for WS10 + ops review>
```

## 6. LAUNCH PROMPT
```
Read docs/Codex_waves/CODEX_EXTENSION_PLATFORM_MISSION.md and LETBUYY_SHOPIFY_PARITY_BLOCKERS.md (Part 3.2) in full,
then execute X0→X6 continuously and autonomously, 24h+.

OWN: packages/extension-host/** (create), packages/app-engine extension contracts, services/api-gateway extension/
function dispatch, and the extension host mounts in merchant-control-plane + storefront checkout. Build on the existing
OAuth/App-Bridge/app-install — NEVER break them; do NOT rewrite *-core or core checkout logic (wire via seams); no
governance edits.

Goal: the Shopify extension model — app manifest declaring extensions/scopes/functions; per-store registry (revoke on
uninstall); Admin UI extension host + Checkout UI extension host (sandboxed iframe/web-components, session-token bridge);
theme app blocks wired to the WS11 contract; and a sandboxed Wasm Functions runtime at discount/shipping/payment/
validation hook points (typed I/O, deterministic, time-bounded, no fs/network). Prove on STAGING with an example app
shipping an admin ext + checkout ext + app block + a discount Function.

Hard rules: security-first sandboxing for all UI extensions and Functions; additive (never break install/OAuth/billing);
keep all 128 validators green per commit; migrations forward-only; small reversible commits; 3 strikes → BLOCKED; no
fabrication. Publish the manifest/extension/function contract for WS10. Maintain CODEX_WS13_LEDGER.md. Begin with X0 now.
```

## 7. NORTH STAR
Installed apps extend the admin, the checkout, the storefront, and the backend logic — sandboxed, declared, per‑store — turning LetBuyy from "apps that call an API" into a real Shopify‑grade extension ecosystem.
