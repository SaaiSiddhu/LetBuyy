# Phase J — Production Rollout Readiness Package

> **PLANNING ONLY — no flag flipped, no deploy; platform-wide Liquid activation is ARB-authority
> (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` at
> `packages/theme-engine/src/theme-governance.ts:14`, unchanged).
> `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` (same file, lines 16–21).
> Every document in this directory is read-only evidence for the ARB. No automation in this
> repository activates Liquid for any store or environment.**

**Date:** 2026-07-10  
**Branch:** stepup/main  
**Phase:** J — Production Rollout Readiness  
**Inputs:** Phases B–I committed evidence on `stepup/main`; `certification/RISK_CLOSURE_REPORT.md`; `phase-i/QA_CERTIFICATION.md`

---

## Document Index

| Document | Purpose |
|---|---|
| [ARB_APPROVAL_PACKAGE.md](./ARB_APPROVAL_PACKAGE.md) | Primary GO/NO-GO decision package for the ARB. Contains the 7-blocker reconciliation table, 16-category QA readiness scorecard, 5.x GO/NO-GO criteria (render parity, security/SSTI/XSS, performance budget, per-entity canary soak), 6-gate phased ramp criteria (Gate 0 pre-activation through Gate 3 platform flip), and a complete open-risk register. This is the document the ARB would consume to make the platform-wide activation decision. |
| [ROLLOUT_READINESS_PACKAGE.md](./ROLLOUT_READINESS_PACKAGE.md) | Engineering-layer rollout readiness: all four activation levers (global default, per-entity explicit engine, 11 canary aliases, dev-only override), telemetry point map (CONNECTED/NOT-CONNECTED), the 7-blocker reconciliation with exact code evidence, open items carried from Phases H/I, and the QA posture summary. The source-of-truth for "what can be activated today, how, and what is not yet wired." |
| [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md) | On-call rollback procedures for both Stage 1 (per-store canary activation) and Stage 2 (post-ARB platform flip). Covers 5-layer automatic degradation architecture, detection signal map (CONNECTED/NOT-CONNECTED), 3 per-store manual levers (A: release_manifest DB update, B: canary alias falsy, C: revert to prior React release), 2 platform levers (D: constant revert + redeploy, E: mass DB update), cache window detail (60 s gateway TTL + 300 s SWR + 60 s ISR), and the escalation chain. |
| [OBSERVABILITY_AND_ALERTING.md](./OBSERVABILITY_AND_ALERTING.md) | Observability design: detailed catalog of all 10 signals (4 CONNECTED structured log/DB events, 6 NOT-CONNECTED derived metrics), proposed alert threshold table (9 alerts with WARNING/CRITICAL levels), 4-row dashboard layout specification, and the exact wiring steps required to transition from emission-points-in-code to live production observability (Logpush, Analytics Engine, synthetic scraping, Supabase cron queries). |
| [RELEASE_NOTES.md](./RELEASE_NOTES.md) | Phase-by-phase narrative (Phases B–I) for merchant, developer, and operator audiences. Covers what each phase delivered, the ARB-gate blocker reconciliation table, what remains behind the ARB flag, activation and rollback reference for operators, telemetry reference for operators, and the full QA coverage posture. |
| [ROLLOUT_PLAN.md](./ROLLOUT_PLAN.md) | Explicit 7-stage canary ramp from internal testing through platform-wide flip. Covers the no-%-rollout architecture constraint, cohort selection and activation mechanics (per-store `release_manifest.renderer_engine`, ISR propagation delay), a stage-by-stage table with PROPOSED soak durations, entry criteria, success metrics (CONNECTED/NOT-CONNECTED), and abort triggers. Stage 6 (ARB global flip) is explicitly NOT performed here. |

---

## Readiness Verdict (Honest — 2026-07-10)

The platform is **structurally ready for a cautious per-store canary rollout but not for the platform-wide flip.** The 5-layer crash-recovery architecture (per-block, per-section, per-region, layout-level, and composition-engine outer catch) ensures that every Liquid failure degrades transparently to a full React page with no blank-page or hard-500 outcome. Five of seven original ARB-gate blockers are CLOSED with committed code evidence; the two remaining items (B-5: schema migration registry empty, B-7: settings dual-shape) are MITIGATED — they do not affect live rendering correctness but carry operational notes for the ARB. The unit test gate is green at 221/221 theme-engine, 78/78 storefront-runtime, and 15/15 merchant-control-plane. **I-F1 (DOMPurify clobbering on the customer-register form) is CLOSED** — the field was renamed to `name="fullName"` in `packages/theme-engine/src/theme-bundle.ts:2433` (commit dbcf173a); the register route reads `form.get('fullName') ?? form.get('name')`; A11Y-5 asserts the fix survives DOMPurify (221/221 PASS). Two conditions must still be acknowledged before any activation: (1) live observability is NOT-CONNECTED — Cloudflare Logpush and Analytics Engine are not wired, so fallback rate, render latency under production traffic, and memory behavior under real concurrency are completely unknown; and (2) no percentage-of-stores gradual rollout mechanism exists — per-store activation via `theme_releases.release_manifest.renderer_engine` is the only available staged path. The platform-wide flip (changing `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` to `true`) requires an ARB-recorded decision followed by a human-authored commit and a supervised storefront-runtime redeploy; this package prepares the evidence for that decision but does not make it.

---

*Phase J | 2026-07-10 | Branch: stepup/main | Planning and evidence only. No flag changed. No deploy made. ARB authority required for platform-wide activation.*
