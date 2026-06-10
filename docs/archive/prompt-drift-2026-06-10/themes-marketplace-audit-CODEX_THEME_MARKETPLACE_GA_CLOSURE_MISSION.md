<!-- CODEX MISSION PROMPT — point Codex at this file. GA "MAKE-IT-REAL" + VISUAL/SMOKE PROOF closure.
     Prereq state (verified): the UI/UX completion pass is DONE (real screens, routes, interactions, 9 render tests).
     This pass converts the remaining LOCALLY-ACHIEVABLE dev-defaults into REAL, proves the app by actually loading it,
     and reduces deferrals to a short, named, irreducible human/secret/contract list. Ledger/status under
     docs/themes-marketplace-audit/ only (scripts/validators/source-ledger-residue-validator.mjs). No CODEX*.md elsewhere. -->

# CODEX MISSION — Theme Marketplace GA CLOSURE (make-it-real, prove-by-running, single go)

You are Codex operating **locally** on the LetBuyy monorepo. Three prior passes landed the structure (step-up), the commerce/data layer (V2), and the UI/UX screens + render tests (UI completion). **The app now renders and is unit-proven. What still makes it feel "incomplete" is that several capabilities run on placeholders/mocks/sample data that CAN be made real locally — and they were left as dev-defaults.** This pass makes those **real**, proves the whole app by **actually running it and screenshotting it**, and then states precisely the small set of things that genuinely cannot be finished without a human, a secret, a contract, or recruiting real people.

### The bar
> **"Real" beats "dev-default" wherever real is achievable locally with no external secret.** If a number can be measured locally, measure it and store it. If an image can be generated locally, generate it. If data can be seeded richer, seed it. Only a literal production **secret / contract / legal sign-off / real third-party human** may remain open — and those go on a final, named CUTOVER list, nothing else.

Allowed terminal statuses: `REAL` (produced locally + proven by running/measuring) or `CUTOVER: <one named secret/contract/legal/human>` (irreducible — see §3). The words `mock`, `placeholder`, `pending`, `not yet measured`, `dev-default` may **not** survive in shipped UI for anything in §2.

---

## 0. Required reading & ground truth
Authority order unchanged: root `AGENTS.md` → owning-runtime `AGENTS.md` → `docs/governance/*` → this mission. AGENTS.md wins; log conflicts.
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` (Phase 14 target; #16/#17 perf-a11y; #43 previews; #20/#44/#60/#83 catalog).
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_UIUX_COMPLETION_LEDGER.md` + `…_STATUS.md` and the V2 ledger — **do not redo what they prove REAL**; this pass only upgrades the items in §2 and adds §4 proof.
- Boundary/ownership rules from `CODEX_THEME_MARKETPLACE_FOUNDATION_STEPUP_V2_MISSION.md` §1 apply **verbatim**: full theme vertical only; additive shared packages; no root/`scripts/`/`AGENTS.md` edits; the single allowed out-of-vertical edit remains the logged SSO-parity unblock if needed; clean generated artifacts before the final governance run.

**Do NOT regress** the verified-DONE work: the UI screens/routes/interactions, the render suite (`tests/ui-render.test.tsx`), commerce truth, reviews rendering, governance-green, local-DB verification. Re-run them; leave them.

---

## 1. SCOPE — this pass touches only the "still-not-real" set
You are NOT re-auditing 100 issues. You are converting the specific dev-default/placeholder/sample items in §2 to REAL, plus adding §4 proof. Anything already REAL stays.

---

## 2. MAKE-IT-REAL WORKSTREAMS (each ends REAL + proven, or a named CUTOVER)

### G0 — Real performance & accessibility numbers (#16, #17, #30) — currently "not yet measured"
- Wire a **local** measurement job: run `@lhci/cli` (Lighthouse) and an **axe** pass against the **running** app (dev server or built `start`) for representative theme detail/preview/catalog pages. Persist the **measured** scores (performance, accessibility, plus key metrics) per theme into the seed/DB (`performance_report`/`accessibility_report` with `lighthouse_performance`, `lighthouse_accessibility`, `measured_at`). The detail page already renders these — once data is real, the "not yet measured" fallback disappears for measured themes.
- **REAL proof:** the lhci/axe run output captured in the ledger + a test asserting the detail page renders numeric measured scores from seeded data (not the fallback) for at least the sample themes. CI ingestion on every deploy is the only `CUTOVER`.

### G1 — Real theme preview imagery (#43, #45, #61) — currently SVG placeholders
- Generate **real preview screenshots** of each seeded theme by rendering it through the storefront/preview route headless (e.g. Playwright/`@playwright/test` or `puppeteer` screenshot of `/preview/<token>` or the storefront render) at catalog (16:9) + a tall detail variant; write them to `public/previews/<slug>.*` and point `thumbnail_url`/`preview_url`/`screenshots` at them; keep `next/image`. Replace the reused/placeholder SVGs.
- **REAL proof:** generated image files exist with correct non-zero dimensions + a test asserting cards/detail reference per-theme images (not the shared placeholder). Brand-approved *marketing* creative remains a `CUTOVER` (human), but functional real screenshots ship now.

### G2 — Richer, genuinely-distinct, multi-author catalog (#20, #44, #60, #83, #91, #92, #58)
- Expand the seed so each of the 5 categories has **multiple visually-distinct** themes (distinct section sets, layouts, real color presets, varied font pairings, specific non-generic descriptions), authored across **≥2 first-party authors**, all with honest-zero metrics and real `created_at`. This makes discovery/ranking/compare/similar-themes meaningful and the store stop looking like a 10-sample stub. (Recruiting **real third-party** developers/themes stays a `CUTOVER` — human.)
- **REAL proof:** local DB query in the ledger showing the richer counts + a distinctness assertion (no two themes share identical section/preset signatures); catalog/compare render tests.

### G3 — Accessibility/contrast finalize (#30, a11y)
- Fix remaining low-contrast chrome (e.g. `text-white/40|50` captions in `app/page.tsx`) to WCAG-AA; verify ≥44px touch targets and focus-visible across home/catalog/detail.
- **REAL proof:** the axe pass from G0 reports **0 serious/critical** contrast violations on home/catalog/detail; record it.

---

## 3. THE IRREDUCIBLE CUTOVER SET (do NOT pretend to finish these in code — name them, keep the working dev default, move on)
These genuinely require a human, a secret, a contract, or real people. Each must already work locally via its dev default; this pass only confirms the dev default works and writes ONE final cutover line each. **No additional code can make these "real" locally — do not try.**
1. **Live payments** — real Razorpay prod keys (mock/test provider works in dev).
2. **Download fulfillment at scale** — prod object storage/CDN bucket (local filesystem adapter works in dev).
3. **Malware scanner** — vendor scanner key (local heuristic scanner runs in dev).
4. **Email** — prod SMTP/provider key (local outbox works in dev).
5. **GST** — real registered GSTIN + binding invoice wording (dev GSTIN + generated invoice work in dev).
6. **Developer payouts** — ratified revenue-share % + payout-provider contract (computes at 15% default in dev).
7. **Binding legal/brand copy** — final Terms/Privacy/Refund/License/About wording (navigable drafts render in dev).
8. **`.com` platform domain** — governance allow-list edit + DNS/cookie cutover (env flag works in dev).
9. **Real third-party supply** — recruiting independent developers + their themes, and brand-approved marketing creative (functional first-party samples + real generated screenshots ship in dev).
10. **Live DB apply / deploy** — applying migrations to prod + deploying (local Postgres apply is proven).

---

## 4. PROVE-BY-RUNNING (the proof that's been missing)
Unit render tests are not enough — boot the app and verify it loads.
- **Smoke test:** start the gateway + a local Postgres (per V2 §9c) + `pnpm --filter @letbuyy/theme-marketplace dev` (or `build` then `start`); hit **every** route — `/`, `/themes`, `/themes/<slug>`, `/themes/compare`, `/themes/category/<cat>`, `/collections/<slug>`, `/authors/<handle>`, `/preview/<token>`, `/pricing`, `/checkout`, `/dashboard/*`, `/developer`, `/developer/listings/new`, `/legal/*`, `/docs`, `/support`, `/about`, `/contact` — and assert **HTTP 200** + a key expected element in each (script with `curl`/fetch + assertion, or Playwright).
- **Visual proof:** capture screenshots of `/`, `/themes`, `/themes/<slug>`, `/preview/<token>`, `/developer/listings/new`, `/checkout` at **320, 768, 1280, 1536 px** widths; save under a gitignored/local proof dir and list them in the ledger (note any that must be regenerated). This directly proves responsiveness (#40/#41/#69) and the design system (#42) visually, not just by class assertions.
- **REAL proof:** the smoke-run log (route → status → element found) + the screenshot inventory in the ledger.

---

## 5. VERIFICATION GATES (run after each workstream + final; record escalation)
```bash
pnpm --filter @letbuyy/theme-marketplace typecheck
pnpm --filter @letbuyy/theme-marketplace lint            # 0 errors; warnings only if pre-existing
pnpm --filter @letbuyy/theme-marketplace test            # includes ui-render.test.tsx + new G0/G1/G2 data tests
node --test apps/theme-marketplace/tests/foundation-honesty.test.mjs   # extend: ban surviving "mock/placeholder/not yet measured" in §2 surfaces
pnpm --filter @letbuyy/theme-marketplace build
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test
node --test tests/federation/theme-*.test.mjs tests/auth/sso-redirects.test.mjs
# local DB apply + harnesses (V2 §9c); lhci/axe run (G0); screenshot run (G4)
node scripts/validate-governance.mjs                     # green for the theme vertical; clean generated artifacts first
```
**Acceptance:** all gates green; G0 produces real measured numbers rendered on detail; G1 ships per-theme images; G2 shows the richer multi-author catalog in a DB query; G3 axe = 0 serious/critical; G4 smoke log = all routes 200 + screenshots captured; shared-package changes additive; governance clean after artifact cleanup.

---

## 6. LEDGER, STATUS & DEFINITION OF DONE (under docs/themes-marketplace-audit/)
Create `CODEX_THEME_MARKETPLACE_GA_CLOSURE_LEDGER.md` + `…_STATUS.md`:
- **MADE REAL** — one line per G0–G3 item: what was placeholder/mock → what is now real → the proof (measurement output / image files / DB query / axe report).
- **RUN PROOF** — the §4 smoke log + screenshot inventory.
- **FINAL CUTOVER REGISTER** — exactly the §3 list (and nothing else): each line `- CUTOVER #<n> <item> — DEV-DEFAULT WORKS: <how> — NEEDS: <the human/secret/contract>`. This is the entire remaining go-live to-do.
- **STATUS** — a one-screen "the app is functionally complete and proven by running; here are the N operational cutovers a human/operator must do (keys, contracts, legal, DNS, recruit developers)."

**DONE when:** nothing in §2 still shows mock/placeholder/"not measured"; perf/a11y render **real measured** numbers; previews are **per-theme real** images; the catalog is a **richer multi-author** set; axe is clean; the **smoke run loads every route (200 + element)** and screenshots exist at 4 widths; all gates green + governance clean; and the only open items are the **§3 irreducible CUTOVER list**, each with a working dev default. Confine `git status` to the theme vertical + the `…_GA_CLOSURE_*` docs.

**Begin by standing up local Postgres + the gateway, run the smoke/screenshot pass to capture the current real state, then execute G0→G3 to make those surfaces real, re-run the smoke/visual proof, and write the ledger with the final — and genuinely short — CUTOVER list. Do not mark anything REAL that you did not measure, render, or load. Do not try to code around the §3 items; name them and stop.**
