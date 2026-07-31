# LIQUID_V1_LAUNCH_READINESS.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · maps Full-Liquid program phases (L0–L17) to readiness gates. Effort is verifier-sized; weeks assume 2–3 engineers with the parallelization in the master program.

## Readiness gates (what each tier requires)

| Tier | Definition | Phases complete | Gating proof |
|---|---|---|---|
| **Internal Ready** | LetBuyy staff can browse a Liquid store end-of-browse on a seeded test store | L0,L1,L2,L4,L5,L6 | a canary test store renders **styled** Liquid home/product/collection with real data; `X-Lb-Render-Engine: liquid` |
| **Closed Beta Ready** | A handful of pilot merchants' **full buyer journey** runs on Liquid (browse→cart→register→checkout→account→orders) | + L7,L8,L9,L10,L11,L12 (+L3/L13 if merchants must edit Liquid themes) | every customer-facing route has a Liquid template; checkout (React hosted origin) works; auth/money preserved |
| **Open Beta Ready** | Broader cohort; merchant Liquid customization usable | + L13,L14 (full 200-cell parity green) | parity harness green (no red cell); real render/island tests pass; perf/security harness pass |
| **Production Ready** | Liquid is the default renderer for the cohort/platform | + L15 (canary soak clean) + L16 (ARB platform-flip) | clean production soak; ARB moves `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` off `deferred` |
| **React-Deleted (end-state)** | One canonical renderer (R-15); React removed | + L17 | the 5 proof artifacts in `REACT_DELETION_EXECUTION_PLAN.md` + the **hardening-wave data decision** (ART-17) |

## Timeline (critical-path weeks; see master program for the graph)

| Milestone | ~Week | Notes |
|---|---|---|
| Internal Ready | **3–4** | L1+L2 are the unlock; L5/L6 templates over existing data |
| Closed Beta Ready | **7–8** | tail templates (L7-L12) parallelize over existing EA backends; gated by LB-12 for registration |
| Open Beta Ready | **9–10** | L14 full parity is the long pole; L13 compiler (L3) if merchant Liquid editing in scope |
| Production Ready | **10–12** | L16 ARB flip + soak; React still present (frozen) |
| React-Deleted | **12–14** | L17, gated by the hardening-wave data decision — *constitutionally cannot be earlier* |

## Hard dependencies that move the dates

- **ARB flip (L16)** is a **human** governance act (ART-17 gate) — not schedulable by engineering; pre-align in L0.
- **LB-12 registration** (already pending in the V1 program) blocks L9; sequence it in.
- **Commit seam (C0)** — the sandbox can't commit; a human commits each phase.
- **L3 portable→Liquid compiler** is the longest single build (~2-3 wk); it's only on the critical path if merchant **Liquid theme editing** is required at Open Beta. If Open Beta ships one fixed default Liquid theme (no merchant Liquid authoring), L3/L13 move off the critical path and Open Beta lands ~1.5 wk sooner.
- **Parity 0/200 today** — L14 is unavoidable and gates both Open Beta and (with the data decision) React deletion.

## What is NOT a readiness blocker

Checkout/payments (engine-agnostic React hosted origin — stays, constitutional), money/identity/tenancy (untouched by the render migration), and the 9 human launch seams (H1-H9) which gate *go-live* independently of the engine. The render migration neither helps nor hurts those — they're orthogonal.

## Readiness verdict

Full Liquid reaches **Internal** in ~1 month, **Closed Beta** in ~2 months, **Production** in ~3 months, and **React-deleted end-state** in ~3–3.5 months — all on the existing engine-agnostic backends, gated by parity proof and the constitutional ARB/hardening-wave acts. No backend rebuild; the work is seed + CSS + templates + compiler + parity + governed flips + governed deletion.
