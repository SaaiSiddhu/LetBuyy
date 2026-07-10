# M→AE Program State

**Updated:** 2026-07-10 (post Phase O) · **Branch:** `stepup/main` · **Starting HEAD (program):** `29f87115`

## Scoreboard
| Phase | Title | Status | Commit |
|-------|-------|--------|--------|
| M | Repository truth + Shopify parity | COMPLETE | _(baseline commit)_ |
| N | Canonical Theme Document V2 | COMPLETE | _(see PHASE_N_REPORT.md)_ |
| O | Preset & Experience Engine 2.0 | COMPLETE | _(see PHASE_O_REPORT.md)_ |
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
- theme-engine **643/643** entering M; **689/689** after Phase N (+46 tests, 20 suites); **1034/1034** after Phase O (+345 tests). storefront-runtime **687/687**, merchant **14 tasks**, gateway typecheck **32 tasks**.
- `validate-governance.mjs` **EXIT=1** — pre-existing tenant-registry drift only (foreign WIP); anti-fabrication PASS.
- All 11 B→L commits real + ancestors of HEAD. Phase L = HEAD (`29f87115`).
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (theme-governance.ts:14). Frozen apps confirmed frozen.

## Foreign WIP (PRESERVE — never stage)
- ~360 modified/untracked files from prior user work (apps/identity-platform, marketing-site, merchant-control-plane, services, database, tests/launch/lb*.mjs, next-env.d.ts).
- Untracked load-bearing theme-engine WIP: `experience-fonts.ts`, `industry-experience-map.ts`, `theme-bundle-core.ts` + their tests, `theme-presets.test.ts`.
- Untracked migrations `186_*`, `187_*`.
- `tenant-tables.registry.ts` drift.

## Active risks
See RISK_REGISTER.md: RISK-SEC-001 (theme_purchases wide-open RLS, HIGH, → AE), RISK-SEC-002 (editor AI stub), RISK-GOV-001 (tenant-registry, affects P/W), RISK-DATA-001 (migrations 186/187/188), RISK-DUAL-N01 (section_definitions dual-truth, → R), RISK-ARCH-N01 (version gate must be bumped for future schema additions, ongoing), RISK-PERF-N01 (large document size, → R), RISK-O01 (Nova/Summit distinctness collapses if cta-section removed from bundle, LOW), RISK-O02 (collectionFilter/faqAccordion permanently incompatible until bundle expanded, LOW).

## Parity snapshot (Phase M matrix)
COMPLETE 37 · PARTIAL 15 · MISSING 13 · NOT_CONNECTED 4 · STUB 1 (70 capability rows). Editor is the largest gap cluster (shell/inspector/tree/nested-blocks/templates/media/markets/code editor all PARTIAL or MISSING).

## Phase N deliverables
- `packages/theme-engine/src/theme-document.ts` (647 lines): `ThemeDocumentSchema`, `parseThemeDocument`, `toThemeDocumentV2`, `fromThemeDocumentV2`, version gate, error classes, bounds constants, pollution guards.
- `packages/theme-engine/src/theme-document-migrations.ts` (135 lines): `migrateToThemeDocumentV2` — SHAPE-1/2/3 detection.
- `packages/theme-engine/test/theme-document.test.ts` (756 lines, 37 tests).
- `packages/theme-engine/test/theme-document-migrations.test.ts` (169 lines, 9 tests).
- `packages/theme-engine/src/index.ts`: 2 export lines added.
- Round-trip proven in 4 directions; structural deepEqual for all 3 fixtures; render parity for Urban Kicks + LetBuyy Core; 6 code review findings resolved.

## Phase O deliverables
- `packages/theme-engine/src/section-type-map.ts` (109 lines): 25-entry camelCase→kebab bridge, `resolveLiquidSectionType()`, governance integrity check.
- `packages/theme-engine/src/experience-compositions.ts` (373 lines): 10 experiences × 3 templates; all structurally distinct index compositions; stable ids; static settings; no blocks field.
- `packages/theme-engine/src/experience-apply.ts` (719 lines): `ExperienceApplyMode` / `ExperienceApplyDiff` / `computeExperienceApplyDiff` (pure) / `applyExperienceToDocument` (fail-closed); content classification engine; RISK-DUAL-N01 + ART-17 enforcement.
- `packages/theme-engine/test/experience-apply.test.ts` (764 lines, 15 describe blocks).
- `packages/theme-engine/test/experience-compositions.test.ts` (329 lines, 6 describe blocks).
- `packages/theme-engine/src/index.ts`: 3 export lines added.
- 1034/1034 tests pass (+345). 5 code review findings resolved (2 HIGH, 3 LOW). All 10 index compositions structurally distinct (composition-level and post-apply). Nova and Summit proven distinct via `cta-section`. Content never silently lost: block loss surfaced in diff; `requiresDuplicateBeforeApply` fires independent of `preserveContent`.

## Next action
- **Next phase: P — Drafts, Revisions, Publish, and Rollback.** Implement `theme_editor_drafts` persistence, `apply_preset` gateway route using `applyExperienceToDocument`, draft/published version management, and rollback. Must maintain `fromThemeDocumentV2` round-trip invariant on every draft save.
- **Gate:** `pnpm typecheck test --filter=@letbuyy/theme-engine`, baseline **1034**.
