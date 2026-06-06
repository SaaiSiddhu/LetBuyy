# Content Audit & Gap Analysis (Phase 6)

> Reviews every title, subtitle, card, help text, empty state, and error message in the developer app for accuracy, clarity, developer usefulness, and professionalism. Format per issue: **Current text → Problem → Replacement recommendation.** All current text is quoted from source.

## Overall character of the content

LetBuyy's developer content is the **opposite of generic AI fluff** — it is unusually honest and source-backed (every claim cites a `file.ts:line`). That is a real asset. The problems are: (1) it is written for the *platform's own engineers*, not for external developers; (2) internal status jargon leaks into developer-facing copy; (3) one source citation is **factually wrong** (file doesn't exist); (4) two pages give **contradictory** technical descriptions; (5) there is **no onboarding/narrative content** at all — it's 100% reference.

---

## A. Accuracy / misleading content (highest priority)

### A-1 — Broken source citation
**Current:** `sdkToolingGaps` (and tooling-gap rows) cite source `apps/developer-portal/CODEX_WS10_LEDGER.md` (3 occurrences in `developer-surface.ts`, e.g. lines ~2054, ~2066, ~2072).
**Problem:** **The file does not exist** (verified). A docs surface whose whole selling point is "every claim is source-backed" cites a missing source — directly undermining its credibility thesis.
**Replacement:** Point to a real artifact (e.g., the section in `AGENTS.md`, or a tracked `docs/governance/*`), or remove the citation. Add a CI check that every `source:` path resolves.

### A-2 — Two API pages contradict each other on GraphQL
**Current:** `/api-reference` (`reference.ts`) lists a route group **"GraphQL APIs … status: Partial"** with `/v1/admin/graphql`, `/v1/storefront/graphql`. `/api` (`developer-surface.ts` `gatewayRouteGroups`) **omits GraphQL entirely** (auth, contacts, storefront, themes, app-store, internal console, stores, products…).
**Problem:** Same platform, two "authoritative" reference pages, opposite claims about whether GraphQL exists. A developer cannot tell if GraphQL is supported.
**Replacement:** One reference page. State GraphQL clearly once: "Admin & Storefront GraphQL are available under `/v1/*/graphql` with query-cost limiting (Beta)." Include example query + the GraphiQL link once it ships.

### A-3 — Fake dashboard presented as the dashboard
**Current (`/dashboard`):** *"A partner workspace without fabricated data … Each panel is tied to an existing endpoint or marked as a backend skip,"* with panels like *"API keys — [SKIP - NEEDS BACKEND] Key inventory, reveal, rotation, and revocation."*
**Problem:** Reads as *the* developer dashboard, but it is a non-functional shell — while a **real** Partner Console with live data exists in `app-marketplace`. Honest about being empty, dishonest by omission about the real one existing elsewhere.
**Replacement:** Replace the page with: "Your developer dashboard lives in the Partner Console → [Open console]. Below is what each section does." Then link, don't simulate.

### A-4 — Registration collects fields it never sends
**Current (`/developers/register`):** Form collects `tax_id` (GSTIN), `agreed_tos`, `agreed_privacy`; help text *"Required for payouts in India."*
**Problem:** The submit handler POSTs only `company_name, website_url, support_email, description, country` — `tax_id` and the agreement booleans are **discarded**. Telling a developer a field is "required for payouts" when it's dropped is misleading.
**Replacement:** Either persist `tax_id`/agreements via the API, or remove the fields and move tax collection to where payouts are actually configured; change help text to reflect reality.

### A-5 — Non-functional uploaders imply capability
**Current (`/developers/apps/new`):** "Upload icon" and "Drag & drop screenshots here … 3-5 screenshots, 1280×800px recommended."
**Problem:** No file input / handler exists; media is never uploaded. The copy promises an action the UI cannot perform.
**Replacement:** Implement real upload, or replace with "App media upload is coming soon — submit text now, add media after approval," and remove the drop zone affordance.

---

## B. Clarity / developer usefulness

### B-1 — Internal jargon in developer copy
**Current:** "D0 app" (skip ledger), "SKIP — NEEDS BACKEND/SDK", "WS11 portable Liquid app blocks", "manifest schema `2026-06-05.ws13`", source refs like `app-store.ts:1225` shown as the *primary* citation.
**Problem:** "D0", "WS11", "ws13" are internal milestone codes meaningless to external developers; `file.ts:line` is engineer-facing, not developer-facing.
**Replacement:** Replace status tokens with `Available` / `Beta` / `Planned`. Keep source links but secondary and as friendly labels ("App Store routes"), not raw paths. Drop "WS"/"D0" codes from public copy.

### B-2 — Reference without a path
**Current:** Home: *"The active path is marketplace app registration, scoped install OAuth, lifecycle webhooks, theme package upload, and dashboard visibility."*
**Problem:** Describes the path in prose but provides **no numbered, runnable quickstart**. There is no "Build your first app" page anywhere.
**Replacement:** Add a `Get started` guide: register → create app (manifest) → install via OAuth (with cURL) → receive a webhook → call `/v1/app/products`. Each step copy-pasteable.

### B-3 — "Quick-starts" that aren't
**Current (`/sdk`):** title *"Quick-starts for the contracts that exist now."*
**Problem:** Content is contract descriptions, not quick-starts (no end-to-end runnable sequence).
**Replacement:** Rename to "SDK & contract reference," and put the actual quick-start under `Get started`.

### B-4 — Rate-limit facts without remedy
**Current (`/api-reference`):** lists query-cost numbers (capacity 200, leak 20/s, costs per verb).
**Problem:** Accurate but gives no guidance on handling `429`/`QUERY_COST_RATE_LIMITED` (backoff, the `X-RateLimit-*` headers to read).
**Replacement:** Add "Handling rate limits" with the response headers, a backoff snippet, and which operations are expensive.

## C. Empty states & errors

### C-1 — Error boundary copy
**Current (`error.tsx`):** *"Developer portal failed to render. Retry the static docs surface. No backend mutation was attempted."*
**Problem:** "static docs surface" / "backend mutation" is internal framing; also renders unstyled (undefined `.developer-button`).
**Replacement:** "Something went wrong loading this page. [Retry] — if it persists, check the status page or contact developer support." Style it.

### C-2 — 404 copy
**Current (`not-found.tsx`):** *"Return to the source-backed D0 portal shell."*
**Problem:** "D0 portal shell" is meaningless to developers.
**Replacement:** "We couldn't find that page. [Back to developer home] · [Search the docs]."

### C-3 — Dashboard empty state (marketplace)
**Current:** "No apps yet — Submit your first app and start reaching LetBuyy merchants." → good. Keep.
**Note:** This is the right tone; bring the rest of the portal up to *this* standard.

## D. Missing content (gaps, not fixes)

| Missing | Why it matters |
|---|---|
| Quickstart / "first app in 10 minutes" | No runnable on-ramp exists |
| Authentication conceptual guide (OAuth flow diagram, when to use auth-code vs token-exchange vs embed) | Reference lists endpoints but not the mental model |
| Error code catalog (VALIDATION, FORBIDDEN, QUERY_COST_RATE_LIMITED, AMOUNT_MISMATCH, INVALID_GRANT, CONFLICT) with handling | Codes scattered across pages, never consolidated |
| Webhook receiver tutorial (verify HMAC end-to-end in Node/PHP) | Only pseudocode exists |
| Changelog / API versioning policy | `X-LetBuyy-API-Version` exists; no changelog page |
| Pricing/revenue page (the 15% share, GST, payouts) | Stated only inside a wizard step |
| Support / status / SLA / contact | No support entry point anywhere |
| Glossary (store=site, installation, manifest, app block, function) | Terms used without definition |
| Extension guides (Admin UI, Checkout function, theme app block) | Capabilities listed, no how-to |

## E. Tone & professionalism scorecard

| Attribute | Rating | Note |
|---|---|---|
| Accuracy | 7/10 | High, but A-1/A-2/A-4/A-5 are real defects |
| Honesty | 9/10 | "SKIP" ledger is refreshingly candid — keep the spirit, fix the labels |
| Clarity for external devs | 4/10 | Engineer-voiced; jargon-heavy |
| Completeness | 3/10 | Reference-only; no onboarding/guides/support |
| Consistency | 4/10 | Two pages contradict; two voices |
| **Overall** | **5/10** | Strong bones, wrong audience, a few accuracy cracks |

**Guiding principle for the rewrite:** keep the source-backed honesty (LetBuyy's superpower), but rewrite *for the developer trying to ship*, not for the engineer who built it — and make every cited source actually exist.
