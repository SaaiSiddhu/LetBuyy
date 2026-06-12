# DOCUMENT 6 — LIQUID ACTIVATION PROGRAM

**Scope:** Phase E. Activate the ratified theme winner (Liquid) in production via parity proof + canary + ARB default flip. Design authority: `FINAL_TRUTH_AUDIT_2026_06_11/LIQUID_CONVERGENCE_IMPLEMENTATION_PLAN.md` + `LIQUID_CAPABILITY_MATRIX.md`; live seam: `SKIP-CAP-LIQUID-CHROME` (CAP-C08); publish pipeline: CAP-C12 (repo-side wired at `1f5ef72b`).

> **STANDING RULE (frozen): React deletion is FORBIDDEN until parity is proven, the ARB default flip is approved, AND post-launch stability is demonstrated (G + 30 days). The 20 frozen React sections remain validator-pinned (`no-new-React-sections`) for the entire program.**

## 1. THE TWO RUNTIMES (current reality)

| | React storefront path | Liquid runtime |
|---|---|---|
| Status | Live default; 20 sections frozen (no growth permitted) | Implemented; **default OFF enforced by validator** (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) |
| Role | First-party fast-path, the safe pole | Ratified ecosystem winner (merchant-editable themes) |
| Publish | — | Editor publish → canonical `template_config` runtime state (CAP-C12) |
| Risk | None new (frozen) | Unproven in production until this phase |

## 2. PARITY MATRIX (Phase E.0 deliverable — completion of `LIQUID_CAPABILITY_MATRIX.md`)

Produce the full matrix as evidence; dimensions × the 20 frozen sections:

| Dimension | Parity bar |
|---|---|
| Rendering (each of the 20 sections) | Pixel-tolerant snapshot match on the corpus (desktop+mobile viewports) |
| Data bindings | Same product/collection/cart/customer data surfaces resolve identically |
| Editor round-trip | Edit→preview→publish→render identical to committed config (CAP-C12) |
| Preview | Draft preview = published render for same config |
| Checkout handoff | Liquid storefront → checkout session identical params/signing (post-`e2e2d47e` path, no extension host) |
| SEO/meta/structured data | Equivalent head output |
| Performance | Liquid p95 render ≤ React p95 × 1.25 budget |
| Accessibility | No regression on the existing a11y checks |
| Empty/error states | Section-level fallbacks present |
| Mobile theme-editor output | Renders identically (the editor is the mobile app's strong point) |

Corpus: every frozen section × representative merchant fixtures (the snapshot corpus SKIP-CAP-LIQUID-CHROME demands). **Any red cell blocks canary.**

## 3. ACTIVATION PLAN

E.0 complete parity matrix (staging) → E.1 fix gaps repo-side (gate green per commit; sections stay frozen) → E.2 internal dogfood store on Liquid in production (flag scoped per-store, not global default) → E.3 canary (§4) → E.4 ARB reviews evidence pack (matrix + canary metrics) and signs the default flip (the recorded approval `SKIP-CAP-LIQUID-CHROME` requires) → E.5 flip default ON for new stores; existing stores migrate opt-in during pilot → E.6 single-reality certification row (SKIP-EG1 adjacency).

**The flag flip is a governed change:** the validator currently *enforces* default OFF — the flip commit must update that validator's expected pole in the same commit as the ARB approval reference. That is the designed mechanism, not an exception.

## 4. CANARY ROLLOUT PLAN

| Stage | Traffic | Duration | Abort if |
|---|---|---|---|
| C1 | 1 internal store | 3 days | any render error class new vs React |
| C2 | 5% of storefront sessions on Liquid-opted stores | 4 days | error rate > React baseline + 0.1pp, or p95 > budget |
| C3 | 50% of opted stores | 4 days | same + conversion-proxy drop > 2% vs React cohort |
| C4 | 100% opted + default-ON for new stores (post-ARB) | 7-day soak | same |

Metrics per stage (Document 4 monitoring): render error rate, p95/p99 latency, checkout-handoff success rate, session conversion proxy, snapshot-drift sampler (render N random live pages against corpus nightly).

## 5. ROLLBACK PLAN

Render-path switch only — **zero data migration involved**; `template_config` is runtime-neutral.
- Any canary stage: flip flag back per-store/percentage (validator's OFF pole is the safe state); React path is untouched and current by freeze.
- Post-default-flip: revert flip commit (flag + validator pole together), redeploy; new-store default returns to React.
- Editor/publish defect: publishes pause (merchants keep last-published render); fix forward repo-side.
- Evidence rule: every rollback is a ledger row with the triggering metric attached.

## 6. REACT DECOMMISSION (explicitly OUT of this phase)

Lives in the plan's Phase 7 checklist and runs only after: G certified + 30 days Liquid-default stability + zero React-path traffic telemetry + ARB deletion approval — then proof-before-delete per the freeze. Until then the React path is the rollback parachute and must stay deployable. **Do not pack the parachute away while still in the air.**
