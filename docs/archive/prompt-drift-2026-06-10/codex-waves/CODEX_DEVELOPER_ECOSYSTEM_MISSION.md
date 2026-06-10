# CODEX DEVELOPER ECOSYSTEM MISSION — LetBuyy WS10

**Driver:** Codex agent. Reasoning: `xhigh` for the docs/SDK information architecture, `medium` for page build.
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** `apps/developer-portal/**` **ONLY** (a **new** Next.js app to create).
**Dependencies:** WS1 (`@letbuyy/ui` — consume) · WS7 (the real API/OAuth/webhook surface this documents). **Priority:** P3 (the moat — launch in Wave 5, after the platform stabilizes).
**Predecessor:** WS7 has a documented, real API surface; `app-engine`/`theme-engine`/`auth-core` contracts exist to reference.

---

## 0. PRIME DIRECTIVE
Shopify's real moat is not themes or apps — it's the **developer ecosystem**. Stand up **`developers.letbuyy.store`** (`apps/developer-portal`): the home for third‑party builders — API reference, OAuth + webhook docs, Theme SDK and App SDK quick‑starts, and a developer dashboard shell. *A marketplace without developers is an organized empty shelf.* Build the **portal + docs surface** (frontend) over LetBuyy's existing, real platform contracts; where an SDK/CLI artifact doesn't exist yet, document the intended contract and `[SKIP — NEEDS BACKEND/SDK]`.

**SUCCESS CRITERIA (proven with screenshots):**
1. A new `apps/developer-portal` (Next.js, `@letbuyy/ui`) renders and is on the design system.
2. **API Reference** generated/curated from the real gateway surface (entities, endpoints, auth, rate‑limit cost model).
3. **OAuth docs** (authorization‑code + token‑exchange, scopes, session tokens) and **Webhook docs** (HMAC `X-LetBuyy-Hmac-SHA256`, mandatory compliance topics, retry) — matching what WS7/app‑engine actually implement.
4. **Theme SDK** + **App SDK** quick‑starts (manifest format, local dev, install flow) — real where contracts exist, `[SKIP]` placeholders where SDK/CLI artifacts don't.
5. A **developer dashboard shell** (apps/themes listings, API keys, analytics) — UI over existing Partner API data; `[SKIP — NEEDS BACKEND]` for absent endpoints.
6. **128/128** governance, typecheck/tests green; `CODEX_WS10_LEDGER.md` complete.

## 1. OPERATING CONTRACT
1. Continuous; ledger → next task. 2. **Green Law** (128/128 at gates; never red; 3 strikes → BLOCKED). 3. **No‑Architecture Law:** build only `apps/developer-portal/**`; consume `@letbuyy/ui`/`api-client`/`shared-types`; never edit them or any backend; missing data/SDK → `[SKIP — NEEDS BACKEND/SDK]` + honest placeholder. 4. **Accuracy Law:** docs must match the **real** implementation (read `services/api-gateway/src/routes/**`, `packages/app-engine`, `auth-core`, `webhook-service` to document truth — read‑only). Never document a capability that doesn't exist without marking it "planned". 5. **Visual proof**, small reversible commits, accessibility baseline, network‑free build, no fabrication.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
All other `apps/**` · `packages/typescript/ui/**` (consume only) · `services/**`, `packages/*-core/**`, `database/**` (read‑only for documentation; never edit) · governance.

## 3. THE WORK — D0 → D4
- **D0 Scaffold.** Create `apps/developer-portal` (Next.js App Router, `@letbuyy/ui`, self‑hosted fonts, Lucide), routing for `/docs`, `/api`, `/sdk`, `/dashboard`; landing page. **Effort:** M. **Priority:** P3. _Data: none._
- **D1 API Reference.** Curate the gateway's real entities/endpoints (read `services/api-gateway/src/routes/**` + `schemas/**`) into structured reference pages (auth, pagination, the calculated query‑cost rate‑limit model, errors). **Effort:** L. **Priority:** P3. Shopify ref: Admin API reference + GraphiQL explorer. _Data: read‑only from gateway routes/schemas._
- **D2 OAuth & Webhooks docs.** Document the real OAuth (auth‑code + token‑exchange, scopes, JWT session tokens) and webhook model (HMAC header, mandatory compliance topics, retry). **Effort:** M. **Priority:** P3. Source: `app-engine`, `auth-core`, `webhook-service` (read‑only). Shopify ref: app auth + GDPR webhook docs.
- **D3 Theme SDK & App SDK quick‑starts.** Document the theme bundle format (`config/settings_schema.json`, `templates/*.json`, sections/blocks, `locales/*`) and the app manifest/extension model; "build your first theme/app" walkthroughs. Real where `theme-engine`/`app-engine` contracts exist; `[SKIP — NEEDS SDK/CLI]` for unbuilt tooling. **Effort:** L. **Priority:** P3. Shopify ref: Theme + App SDK/CLI docs.
- **D4 Developer dashboard shell.** UI over Partner API data (apps/themes listings, installs/charges/earnings, API keys). `[SKIP — NEEDS BACKEND]` for absent endpoints (placeholder cards). **Effort:** M. **Priority:** P3. Shopify ref: Partner Dashboard.
- **GATE (FINAL):** portal renders on `@letbuyy/ui`; API/OAuth/Webhook docs accurate; SDK quick‑starts present (real or honest placeholder); dashboard shell renders; 128/128; screenshots; `CODEX_DEVELOPER_ECOSYSTEM_STATUS.md` written.

## 4. PARALLELIZATION GUIDE
Fully isolated (new app) → runs in parallel with everything once WS1's components and WS7's real surface exist. One agent.

## 5. LEDGER — `CODEX_WS10_LEDGER.md`
```
# CODEX WS10 (DEVELOPER ECOSYSTEM) LEDGER — started <ts>
## PROGRESS / SKIPPED (NEEDS BACKEND/SDK) / VISUAL / VALIDATOR ledgers (append-only)
```

## 6. LAUNCH PROMPT
```
You are WS10 (Developer Ecosystem) in docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md.
Work ONLY in git worktree branch stream/WS10-devportal.
Read docs/Codex_waves/CODEX_DEVELOPER_ECOSYSTEM_MISSION.md.
OWN ONLY: apps/developer-portal/** (create it). Consume @letbuyy/ui; read services/** and packages/*-engine/**
read-only to document the TRUTH. NEVER edit backend/other apps/design system/governance. Build developers.letbuyy.store:
landing + API reference + OAuth/Webhook docs + Theme/App SDK quick-starts + developer dashboard shell. Document only
real capabilities (mark others "planned"); [SKIP — NEEDS BACKEND/SDK] for absent endpoints/tooling with placeholders.
Keep all 128 validators green per commit. Maintain CODEX_WS10_LEDGER.md. Begin with D0 now.
```

## 7. NORTH STAR
`developers.letbuyy.store` — where a third‑party builder can read the real API, understand OAuth and webhooks, scaffold a theme or app, and ship to the marketplace. Build the shelf *and* invite the builders.
