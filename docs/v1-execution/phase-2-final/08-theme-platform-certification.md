# Theme Platform Certification — Decision

**Date:** 2026-06-19 · **Branch:** `stepup/main`

## Decision: ❌ NOT CERTIFIED for production (yet) — engineering layer CERTIFIED; production sign-off blocked by non-code gates.

This is an honest verdict, not a code-defect finding. The theme platform is **engineering-complete, contract-tested, governance-clean, and regression-free**. It **cannot be stamped "production-certified" from this execution environment** because production certification *requires* live visual verification and designer sign-off — neither of which is possible here — plus one product decision and one staging-gated activation. Stamping CERTIFIED without those would be fabrication.

## What IS certified (engineering / contract level — full evidence)
- **Merchant flow exists end to end** (code + contract-tested): Create Store → Select Industry → Recommended Experience → auto-configured (server-authoritative) → Editor Experiences tab → Apply → Preview → Customize → Publish.
- **Engine:** preset engine + 10 experiences + industry map + font registry + Core alias — `theme-engine` 82/82 tests, typecheck clean.
- **Runtime contracts:** store creation, theme assignment, draft, preview, publish, rollback, versioning, React + Liquid rendering — each mapped to a passing test (`03-runtime-certification.md`).
- **Governance:** all theme validators pass; frozen `theme-registry.ts` untouched; anti-fabrication clean; **zero new design-system drift**.
- **Regression:** 163/163 launch · 82/82 theme-engine · no theme regressions (1 pre-existing source-test failure, fails at HEAD).

## Exact blockers to FULL production certification
| # | Blocker | Type | Owner |
|---|---|---|---|
| **B1** | **Live visual verification** — render all 10 experiences × desktop/tablet/mobile × editor/preview/published on staging | Stack / human | Eng + QA on staging |
| **B2** | **Per-experience typography decision + activation** — storefront aliases all fonts to LetBuyy brand fonts by design; activating distinct Google Fonts is a product decision (registry + wiring are ready) | Product + visual | Product + Eng |
| **B3** | **Designer sign-off** on the 5 `designed` experiences (Aura, Ride, Dawn, Bloom, Nova) | Human (designer) | Design |
| **B4** | **LetBuyy Core canonical activation** — compile/fallback flip + additive `letbuyy-core` DB alias row, verified on staging (sequence with the WIP migration cleanup) | Staging | Eng |
| **B5** | **Pre-existing WIP gate failures** (tenant-isolation registry regen · design-system CSS drift · untracked migrations 186/187) — platform-level, inherited; block an all-green gate | Inherited WIP | Eng |

None of B1–B5 is a theme-platform **code defect**. B1/B3 are verification/human gates; B2 is a product decision; B4 is staging-gated; B5 is inherited platform WIP.

## Readiness
- **Theme readiness:** ~90% → **~91%** (certification clarifies state; typography fidelity + live visual cert keep it below 95–97%).
- **Platform readiness:** **~92%**.

## Path to CERTIFIED (all on staging, no new design work)
1. Resolve B5 (registry regen + commit migrations + design-system baseline) → green gate.
2. Make the B2 typography decision; if "distinct", apply the ready font wiring (`01-font-runtime.md`).
3. Execute B4 (Core activation) on staging.
4. Run B1 live visual verification + B3 designer sign-off across the 10 experiences.
5. Re-certify → CERTIFIED + **freeze** the theme platform.

## Recommendation
Do **not** freeze yet. The engineering is ready and de-risked; certification is gated on staging visual verification + a typography product decision + designer sign-off + inherited-WIP cleanup. These are well-defined, non-code (or staging-only) steps. Once B1–B4 pass on staging (and B5 is cleaned up), the platform can be honestly certified for the October 1 launch and frozen.
