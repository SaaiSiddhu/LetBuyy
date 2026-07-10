# M→AE Program State

**Updated:** 2026-07-10 (post Phase M) · **Branch:** `stepup/main` · **Starting HEAD (program):** `29f87115`

## Scoreboard
| Phase | Title | Status | Commit |
|-------|-------|--------|--------|
| M | Repository truth + Shopify parity | COMPLETE | _(this commit)_ |
| N | Canonical Theme Document V2 | PENDING | — |
| O | Preset & Experience Engine 2.0 | PENDING | — |
| P | Drafts/revisions/publish/rollback | PENDING | — |
| Q | Merchant theme library | PENDING | — |
| R | Visual editor shell | PENDING | — |
| S | Live preview inspector | PENDING | — |
| T | Section groups + nested blocks | PENDING | — |
| U | Settings control renderer | PENDING | — |
| V | Template system | PENDING | — |
| W | Dynamic sources + custom data | PENDING | — |
| X | Files & media library | PENDING | — |
| Y | Theme app extensions | PENDING | — |
| Z | Markets + localization | PENDING | — |
| AA | Custom CSS + code workspace | PENDING | — |
| AB | Theme versioning + updates | PENDING | — |
| AC | AI-assisted customization | PENDING | — |
| AD | Certification + canary | PENDING | — |
| AE | Marketplace + partner readiness | PENDING | — |

## Verified baselines (do not re-derive)
- theme-engine **643/643**, storefront-runtime **687/687**, merchant **14 tasks**, gateway typecheck **32 tasks**.
- `validate-governance.mjs` **EXIT=1** — pre-existing tenant-registry drift only (foreign WIP); anti-fabrication PASS.
- All 11 B→L commits real + ancestors of HEAD. Phase L = HEAD (`29f87115`).
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (theme-governance.ts:14). Frozen apps confirmed frozen.

## Foreign WIP (PRESERVE — never stage)
- ~360 modified/untracked files from prior user work (apps/identity-platform, marketing-site, merchant-control-plane, services, database, tests/launch/lb*.mjs, next-env.d.ts).
- Untracked load-bearing theme-engine WIP: `experience-fonts.ts`, `industry-experience-map.ts`, `theme-bundle-core.ts` + their tests, `theme-presets.test.ts`.
- Untracked migrations `186_*`, `187_*`.
- `tenant-tables.registry.ts` drift.

## Active risks
See RISK_REGISTER.md: RISK-SEC-001 (theme_purchases wide-open RLS, HIGH, → AE), RISK-SEC-002 (editor AI stub), RISK-GOV-001 (tenant-registry, affects P/W), RISK-DATA-001 (migrations 186/187/188).

## Parity snapshot (Phase M matrix)
COMPLETE 37 · PARTIAL 15 · MISSING 13 · NOT_CONNECTED 4 · STUB 1 (70 capability rows). Editor is the largest gap cluster (shell/inspector/tree/nested-blocks/templates/media/markets/code editor all PARTIAL or MISSING).

## Next action
- **Next phase: N — Canonical Theme Document V2.** Per ADR-M-002 (ACCEPTED, reversible): extend `LiquidThemePackageBundleSchema` with a new document `schema_version` rather than a parallel truth; V1→V2 migration only for real current shapes; existing Urban Kicks + LetBuyy Core render parity; fail-closed unknown versions. ADR-M-003 (canonical source-of-truth: Liquid+JSON canonical, TS fixture generated) is PROPOSED — N adopts the compatibility layer, AA finalizes source-of-truth.
- **Next command:** launch the Phase N workflow (theme-engine lane; gate `pnpm typecheck test --filter=@letbuyy/theme-engine`, baseline 643).
