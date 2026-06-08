# Codex Theme Marketplace Foundation Status

## Summary

- Scope: `apps/theme-marketplace/**`, scoped ledger/status docs, plus one allowed update to the referenced lifecycle test `tests/federation/theme-store-install-lifecycle.test.mjs` for the new no-empty-`config_overrides` install contract.
- Result: theme marketplace UI now avoids fabricated metrics, dead footer/search/notification controls, fake downloads, fake settings saves, unsupported Stripe/global/refund/support promises, and unsupported catalog filters.
- Support email conflict: mission copy requested `support@letbuyy.com`; governance rejects retired `@letbuyy.com` active-source defaults, so shipped placeholders use `support@letbuyy.store`.

## Phase Counts

| Phase | DONE | SKIPPED cross-boundary | SKIPPED human-gated |
|---|---:|---:|---:|
| TM-P0 Truth & Safety | 24 | 8 | 6 |
| TM-P1 Catalog & Discovery | 12 | 10 | 1 |
| TM-P2 Trust Layer | 5 | 8 | 0 |
| TM-P3 Safe Lifecycle | 7 | 7 | 0 |
| TM-P4 Developer Experience | 4 | 8 | 2 |
| TM-P5 Polish & Responsiveness | 22 | 10 | 2 |

Counts include hybrid `DONE locally/SKIPPED live` entries where the safe in-boundary half shipped and the live remainder is assigned to a backend/content/legal contract.

## Final Gates

- `pnpm --filter @letbuyy/theme-marketplace typecheck`: PASS.
- `pnpm --filter @letbuyy/theme-marketplace lint`: PASS with 12 warnings; no errors.
- `pnpm --filter @letbuyy/theme-marketplace build`: PASS after approved Turbopack sandbox escalation.
- `pnpm --filter @letbuyy/theme-marketplace test`: PASS, 16/16 node-test subtests.
- Acceptance grep for `href="#"`, `[SKIP]`, `NEEDS BACKEND`, `50+`, `10K+`, `4.8`, `24/7`, `30-day money-back`, missing notification endpoint, and decorative save/preview strings: PASS.
- `pnpm run validate:governance`: FAIL on unrelated cross-runtime checks outside this mission boundary. Latest run stopped at `Merchant domains settings validator failed: domains settings page missing cname.vercel-dns.com` in the merchant control-plane mission area. A prior post-fix run reached the end and failed only on unrelated source-ledger residue:
  - `apps/app-marketplace/CODEX_FOUNDATION_LEDGER.md`
  - `apps/app-marketplace/CODEX_FOUNDATION_STATUS.md`
  - `CODEX_DOMAIN_FINALIZATION_MISSION.md`
  - `CODEX_FOUNDATION_STRENGTH_MISSION.md`

## What Changed

- Home, pricing, checkout, success, dashboard, install, catalog, detail, footer, navbar, upload, settings, and lifecycle copy now prefer honest states over fake availability.
- Catalog filters are real-or-hidden: search, category, pricing, industry, sort, and pagination remain; unsupported layout and numeric price controls are removed.
- Store preview is wired through `api.themes.previewSession`; card-level wishlist/save decoration is removed.
- Legal/support/docs/developer placeholders are routable and `noindex`; final content remains human-gated.
- Upload route has auth, JSON content-type, size, and basic in-memory abuse guards; malware scanning and durable rate limiting remain cross-boundary.
- New app tests cover honesty markers, footer route existence, navbar search, supported filters, pagination, preview wiring, and removed wishlist controls.

## Remaining Owners

- API gateway/backend: reviews, receipts, license delivery, signed downloads, refunds, release update/rollback, uninstall, tax invoices, notifications, search ranking, autocomplete, analytics, report-problem, and artifact scanning.
- Database/content: real theme catalog, categories/industries, demos, screenshots, release notes, QA evidence, and curated collections.
- Developer program/legal: agreement text, revenue share, payout terms, developer verification, support SLAs, privacy/terms/refund/license copy, and approved OG/favicon assets.
- Coordination pass: archive unrelated root/app-marketplace `CODEX_*` residue and regenerate generated intelligence if route/docs topology changes are accepted.
