# LIQUID_COMPLETION_MILESTONES.md

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · plan-only. Weeks = critical-path estimate, 2–3 engineers; gated by parity proof + human ARB/hardening acts.

| Milestone | Definition | Phases complete | ~Week | Proof gate |
|---|---|---|---|---|
| **Internal Alpha** | Eng can render a styled Liquid home on a seeded canary store | L0,L1,L2 | 2–3 | styled Liquid home; `X-Lb-Render-Engine: liquid` |
| **Internal Beta** | Browse fully Liquid (home/product/collection/search) + Liquid chrome | +L4,L5,L6,L7 | 4–5 | browse routes render Liquid with real data |
| **Merchant Alpha** | A merchant can author/preview a Liquid theme (if L3/L13 in scope) | +L3,L13 (parallel) | 5–6 | edit→publish→Liquid render (or "fixed theme" decision recorded) |
| **Closed Beta** | Pilot merchants' full buyer journey on Liquid (browse→cart→register→checkout→account→orders→tracking) | +L8,L9,L10,L11,L12 | 7–8 | every customer route Liquid-templated; checkout (React origin) works; LB-12 landed |
| **Open Beta** | Broader cohort; parity proven | +L14 (200 cells green) | 9–10 | executed parity report, no red cell; perf+security pass |
| **Production** | Liquid default for the cohort/platform | +L15,L16 | 10–12 | canary soak clean; **ARB platform-flip** |
| **(End-state) React Removed** | One canonical renderer; React render layer deleted | +L17,L18 | 12–14 | 5 deletion proofs + **hardening-wave data decision**; final certification |

## Notes

- **Internal Alpha→Beta** is the fastest, highest-confidence stretch (L1+L2 unlock, then templates over existing data).
- **Closed Beta** is gated by **LB-12** (registration) — sequence it first.
- **Open Beta** long pole is **L14 parity** (0/200 today).
- **Production** and **React-Removed** are gated by **human governance acts** (ARB flip, hardening-wave decision) — not engineering-schedulable; the weeks assume prompt sign-off with evidence ready.
- The **Merchant Alpha** milestone (L3/L13) can slip without blocking Closed/Open Beta **if** one fixed Liquid theme ships (no merchant Liquid editing) — this is the single biggest schedule lever.
