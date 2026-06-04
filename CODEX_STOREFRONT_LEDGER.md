# CODEX STOREFRONT LEDGER

## CURRENT STATUS
- Stage: STAGE 4 - WS4 Storefront.
- Branch: `stream/master-execution`.
- Active gate: SF1 Component Grammar.
- Active task: SF1.1 Audit storefront pages for consistency; identify bespoke patterns.
- Scope lock: source edits are limited to `apps/storefront-runtime/src/**`; root execution ledgers are bookkeeping exceptions. No services, packages, database, governance source, or other app roots may be changed in WS4.

## MISSION CONTEXT READ
- Read `docs/Codex_waves/CODEX_STOREFRONT_MISSION.md`.
- Read root `AGENTS.md` and `apps/storefront-runtime/AGENTS.md`.
- Confirmed mission priority: start with SF2 because the Merchant UX theme editor depends on the storefront preview route.

## SF2 - THEME PREVIEW ROUTE

### SF2.1 Build `/preview` Route
- Status: DONE.
- Source changes:
  - Added `apps/storefront-runtime/src/app/preview/page.tsx` as a dynamic, cache-free storefront preview route.
  - Added `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` to bridge preview readiness, legacy merchant-editor section selection messages, modern section selection/scroll messages, and viewport messages.
  - Updated `apps/storefront-runtime/src/app/globals.css` with preview-canvas sizing, preview-only fixed-header containment, and preview viewport overrides for desktop/tablet/mobile responsive header/grid behavior.
- Behavior covered:
  - SF2.1 `/preview` route renders the existing storefront composition engine with editor section frames enabled.
  - SF2.2 route accepts draft theme settings through `settings_data`, `draft_settings`, and `settings_data_b64` query payloads; draft colors/fonts/radius/booleans are normalized before CSS generation. Existing theme preview token/cookie resolution remains supported via `theme_preview_token`.
  - SF2.3 section highlighting works through modern `letbuyy:theme-editor:section-selected` and legacy `LETBUYY_THEME_EDITOR_SELECTION` messages.
  - SF2.4 section scrolling works through `letbuyy:theme-editor:section-scroll` and the legacy selection message.
  - SF2.5 viewport override supports `desktop`, `tablet`, and `mobile` through query params and `letbuyy:theme-editor:viewport` / `LETBUYY_THEME_EDITOR_VIEWPORT` postMessage events.
- Scoped proof:
  - `pnpm install --frozen-lockfile --force` -> PASS after generated cleanup had removed local workspace dependency links; lockfile unchanged.
  - `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS.
  - `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 23 pre-existing warnings and no errors.
  - `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; route output includes dynamic `/preview`.
  - Source assertion for no `as any` and no inline React `style={{...}}` in `apps/storefront-runtime/src/app/preview/page.tsx`, `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`, and the touched CSS -> PASS. A broader preview-folder assertion found pre-existing inline styles in `apps/storefront-runtime/src/app/preview/coming-soon/page.tsx`, which was not changed in this task.
- Browser/screenshot proof:
  - Production server `pnpm --filter @letbuyy/storefront-runtime exec next start --port 3003` -> PASS after sandbox port binding was escalated.
  - Escalated `node .tmp/ws4-sf2-preview-proof.mjs` -> PASS against `http://localhost:3003/preview?subdomain=urban-kicks-demo&viewport=...&settings_data_b64=<redacted>`.
  - Proof asserted 8 editor sections, selected section id `header`, draft CSS variables `--primary: #DC2626`, `--background: #FFFBEB`, `--radius: 8px`, no horizontal overflow, and viewport canvas widths: desktop 1440, tablet 768, mobile 390.
  - Proof also sent `letbuyy:theme-editor:viewport` from desktop to mobile and asserted `documentElement.dataset.letbuyyPreviewViewport === "mobile"` plus canvas width 390.
  - Screenshot paths: `.tmp/screenshots/ws4-sf2/sf2-preview-desktop.png`, `.tmp/screenshots/ws4-sf2/sf2-preview-tablet.png`, `.tmp/screenshots/ws4-sf2/sf2-preview-mobile.png`, `.tmp/screenshots/ws4-sf2/sf2-preview-viewport-message-mobile.png`.
  - Visual review completed for tablet and viewport-message mobile screenshots after fixing header/canvas and responsive grid behavior; no overlap, clipping, or incoherent horizontal overflow found.
- [SKIP - NEEDS BACKEND] API/session draft settings lookup beyond query payload/token support. Required backend evidence: a versioned preview-session API or session lookup contract that returns draft `settings_data` for an authenticated merchant/store preview without passing the draft payload in the query string.

### GATE SF2 Theme Preview Route
- Status: PASS WITH BACKEND-DATA SKIP.
- Gate proof: `/preview` route works, draft settings work, section highlight/scroll postMessage sync works, viewport override works, desktop/tablet/mobile screenshots are captured, scoped typecheck/lint/build are green, and full governance passed 128/128.

## VALIDATOR LEDGER
- 2026-06-04T03:08:00Z [WS3 predecessor gate] Post-commit `pnpm run validate:governance` after `82ea1656` -> PASS (128/128 validators). WS4 started from a green governance baseline.
- 2026-06-04T03:33:58Z [SF2 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
