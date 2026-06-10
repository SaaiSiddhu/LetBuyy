# Developer UI / UX Audit (Phase 4)

> Method: code-based audit of the actual JSX + the real `apps/developer-portal/src/app/globals.css` (437 lines) + the real `@letbuyy/ui` component classes. A live run was attempted but is not feasible in-sandbox (pnpm workspace not installed; `next` binary does not resolve), so visual conclusions are derived from source — including a **repo-wide grep proving ~30 referenced CSS classes have no definition anywhere**. Each page is scored 0–10 on layout, hierarchy, consistency, content styling, and accessibility.

## The single most important finding (read this first)

The developer portal renders through **two parallel, visually divergent systems**:

- **System A** — `PortalChrome.tsx` + `reference.ts`, used by `/`, `/docs`, `/api-reference`, `/sdk`, `/dashboard`. Its classes (`.developer-hero`, `.developer-card`, `.developer-grid`, `.developer-two-column`, …) **are** defined in `globals.css`. These pages look polished.
- **System B** — `_local-ui/developer-docs.tsx` + `developer-surface.ts`, used by `/api`, `/oauth`, `/webhooks`, `/sdks`. It wraps content in `@letbuyy/ui` `Card`/`Section`/`Page` (which are styled via Tailwind utilities), but the **dense content inside** uses author classes — `.docs-card`, `.endpoint-table`, `.route-matrix`, `.scope-matrix`, `.method-pill`, `.code-sample`, `.fact-list`, `.example-grid`, `.skip-list`, `.docs-grid`, `.docs-grid--two`, `.docs-page-hero`, `.contract-grid`, `.source-ref`, `.category-pill`, `.scope-cloud`, `.step-list`, `.anchor-section`, `.section-kicker`, `.subtle-copy`, `.developer-button`, `.loading-stack`, `.loading-card` — **none of which are defined in any CSS file in the repo** (verified: `grep -rn` across `apps/` + `packages/` returns zero rule definitions; the only CSS files are the portal's `globals.css` and `@letbuyy/ui`'s `storybook.css`, the latter not imported by the app).

**Consequence:** the four most valuable reference pages render as **styled cards containing unstyled HTML** — default browser tables (no borders/padding/zebra) that overflow horizontally because `.endpoint-table-wrap` has no `overflow-x`, intended two-column grids that collapse to one column (`.docs-grid--two` has no `display:grid`), code blocks with no panel styling, and "method pills" that are plain text. This is invisible in code review of any single page (the JSX looks fine) but is a **portal-wide rendering failure** for half the surface — including `error.tsx`, `loading.tsx`, and `not-found.tsx`, which also use undefined classes.

---

## Per-page scores

### `/` Home — System A — **7/10**
- **Good:** Strong hero (`clamp(36px,7vw,72px)` display type), honest "Truth source, not aspirational docs" framing, code panel with traffic-light chrome, 4-card highlight grid, live/skip status pills. Genuinely the best page.
- **Weak:** Hero CTAs link to `/api` and `/sdk` (System B + System A) — clicking "Read API reference" drops the user into the *unstyled* `/api` page, so the very first click degrades the experience. No search, no "get started" path, no code-language tabs/copy button.
- **Shopify better:** Shopify's landing routes to a runnable quickstart; LetBuyy's routes to reference tables.

### `/docs` OAuth+webhooks (combined) — System A — **6/10**
- **Good:** Clean 3-card OAuth grid + webhook verification snippet; consistent with home.
- **Weak:** Overlaps `/oauth` and `/webhooks` (System B) which cover the *same topics in more depth* — the user has two different-looking docs for one subject. The HMAC pseudocode duplicates the snippet on `/webhooks`.

### `/api-reference` API (System A) — **6/10**
- **Good:** Readable route-group cards, auth/error/rate-limit sections, source badges.
- **Weak:** Duplicates `/api` (System B). The two pages disagree (this one lists a GraphQL route group; `/api` omits GraphQL). It is **orphaned** from the System B nav, so users on `/oauth` etc. can't reach it via the header.

### `/api` API reference (System B) — **3/10**
- **Good (content):** The richest, most accurate API content in the portal — gateway rules, response contracts, route-group matrix, schema facades, endpoint tables for commerce/storefront/app/theme/webhooks, payment-safety matrix, quality-gate matrix.
- **Critical (visual):** Built almost entirely from undefined classes (`endpoint-table`, `route-matrix`, `schema-matrix`, `payment-safety-matrix`, `method-pill`, …). Renders as ~7 stacked **unstyled 6-column tables** that overflow on anything narrower than ~900px. The single best content is the worst-looking page.
- **Bug:** footer states "OpenAPI export is not present" — correct, but it sits inside an unstyled `.developer-footer` variant.

### `/oauth` (System B) — **3/10**
- **Content 9/10, presentation 2/10.** Excellent OAuth depth (token lifecycle matrix, scope matrix, bridge rules, request/response examples). All in undefined `.oauth-token-lifecycle-matrix`, `.scope-matrix`, `.scope-cloud`, `.code-sample`, `.step-list` → unstyled.

### `/webhooks` (System B) — **3/10**
- Same pattern: authoritative webhook contract (signing, topics, retry, examples) rendered through undefined `.webhook-*-matrix`, `.fact-list`, `.example-grid`.

### `/sdks` (System B) — **3/10**
- Same pattern. Also the **honest "SDK gaps" ledger** (`ToolingGapMatrix` + `SkipLedger`) is undefined-class → the most important "what's missing" table is unstyled. Cites a **non-existent** source file (`CODEX_WS10_LEDGER.md`).

### `/sdk` SDK quick-start (System A) — **6/10**
- Styled, readable, but duplicates `/sdks` with *less* detail. Two "SDK" pages, two looks, two depths.

### `/dashboard` (System A) — **4/10**
- **Good:** Clean shell IA.
- **Critical (trust):** It is a **fake dashboard** — panels are prose descriptions with `[SKIP - NEEDS BACKEND]` text, while a **real, data-backed** Partner Console already exists at `apps/app-marketplace/.../developers/dashboard`. Shipping a placeholder for something that exists elsewhere actively misleads developers.

### `error.tsx` / `loading.tsx` / `not-found.tsx` — System B — **2/10**
- All three use undefined classes (`.developer-button`, `.loading-stack`, `.loading-card`). Error/empty/loading states — the moments a developer most needs reassurance — render unstyled.

---

## Marketplace developer pages (the functional console)

### `/developers` landing — **6/10**
- Decent marketing page (benefits grid, "how it works", CTA). **But:** lists "Documentation" as a benefit and never links to the docs portal; heavy inline styles; animation `slideUp` with per-item delay can feel slow.

### `/developers/register` wizard — **6/10**
- 3-step wizard with progress indicator is good UX. **Friction:** Step-1 "Continue" uses `formData.company_name && formData.contact_email ? setStep(2) : null` — if fields are empty it **silently does nothing** (no inline error, no focus), a classic dead-end. Collects `tax_id`/agreements that the API call **does not send** (only company/website/email/description/country are POSTed) — fields imply more than they do.

### `/developers/dashboard` Partner Console — **7/10**
- The strongest *functional* surface: real installs, earnings, payout ledger, GST, collaborator code, dev stores, app listing + review status, review-actions. **Weak:** ~100% inline styles (no design-system tables), `.catch` redirects **every** error (incl. transient 500s) to `/developers/register`, which can loop a registered developer out of their own dashboard. Copy button next to collaborator code is an icon with no click handler. **Confirmed bug:** the per-app **Edit** button links to `/developers/apps/:id/edit`, a route that does not exist (only `…/apps/new`) → **404 on every app row**.

### `/developers/apps/new` submission — **5/10**
- Comprehensive form. **Critical:** icon + screenshot uploaders are decorative `<div>`s (no `<input type="file">`, no handler) — a developer literally cannot upload media; only text is submitted.

---

## Cross-cutting UI/UX problems

1. **Two design languages in one portal** (System A polished, System B unstyled) destroy perceived quality and consistency.
2. **~30 undefined CSS classes** → the dense reference pages, plus all error/loading/404 states, are unstyled. (Severity: Critical.)
3. **No interactivity anywhere in the docs portal** — no copy-to-clipboard, no language tabs, no search, no collapsible nav, no "try it." Everything is static server-rendered text.
4. **No persistent left-nav / sidebar.** Both headers are flat top bars; long reference pages (the `/api` page has ~9 sections) have no in-page TOC or anchors except one stray `id="contracts"`.
5. **Inline-style sprawl** in the marketplace console (hundreds of `style={{}}`) → no theming, no responsive control, hard to maintain, inconsistent spacing.
6. **Accessibility:** generally decent (icons `aria-hidden`, nav `aria-label`, semantic `<table>`/`<th>`), but: undefined-class tables have no `<caption>`/scope semantics styling, the amber "skip" pill (`#b45309`) on light surface and small `caption` font sizes risk contrast/legibility, and there are **no visible focus styles** on System B links/buttons (System A defines focus-visible; System B relies on undefined `.developer-button`).
7. **Touch targets:** System A actions are `min-height:44px` (good); System B `.developer-button` and method pills are undefined → default sizing, likely under 44px on mobile.

## What Shopify does better (summary)
- One coherent design system (Polaris) across docs, dashboard, and extension UIs — LetBuyy has three different looks (System A, System B-unstyled, marketplace-inline).
- Interactive docs (GraphiQL, copy, runnable examples) — LetBuyy has none.
- Real dashboard only, never a placebo placeholder.
- Persistent, searchable navigation with a real sidebar and TOC.

## Highest-leverage fixes (UI)
1. **Define the ~30 missing CSS classes** (or port System B pages to System A's `.developer-*` classes). One stylesheet fixes 4 pages + 3 state screens. *(Biggest visual ROI in the repo.)*
2. **Delete one of each duplicate** (`/api` vs `/api-reference`, `/sdk` vs `/sdks`) and merge `/docs` into `/oauth`+`/webhooks` (or vice-versa). One page system, one header.
3. **Replace the fake `/dashboard`** with a link to (or embed of) the real Partner Console.
4. **Make the app-submission uploaders real** (`<input type="file">` + upload handler) or remove them.
5. Add copy buttons, a left sidebar + per-page TOC, and a docs search box.
