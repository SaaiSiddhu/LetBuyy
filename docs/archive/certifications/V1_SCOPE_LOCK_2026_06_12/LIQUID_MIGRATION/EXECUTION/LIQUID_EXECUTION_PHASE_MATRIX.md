# LIQUID_EXECUTION_PHASE_MATRIX.md

**Full Liquid V1 · L0→L18 · HEAD `0b8a56e7` · plan-only.** One-row-per-phase execution matrix. Gate types: **C0**=human commit, **ARB**=governance flip/accept, **HW**=hardening-wave data decision, **LB12**=registration blocker.

| Phase | Title | Critical-path | Parallel | Human/ARB gate | Risk | Effort | Backend status | Liquid deliverable |
|---|---|---|---|---|---|---|---|---|
| L0 | Foundation Freeze | ✔ | — | scope sign-off + ARB criteria | L | 2-3d | n/a | scope+gates frozen |
| L1 | Bundle Persistence | ✔ | — | C0 | M | 3-5d | exists | seeded Liquid bundle |
| L2 | Asset Pipeline | ✔ | — | C0 | M | 1wk | n/a | CSS served |
| L3 | Theme Compiler | branch | ✔ | C0 (ARB if scope-creep) | H | 2-3wk | n/a | portable→Liquid compiler |
| L4 | Liquid Chrome | ✔ | — | C0 | M | 1wk | nav exists | Liquid header/footer/nav |
| L5 | Product | ✔ | A | C0 | M | 3-5d | exists | product template |
| L6 | Collection | ✔ | A | C0 | M | 3-5d | exists | collection template |
| L7 | Search | — | A | C0 | M | 3-5d | **thin (client-only)** | search template |
| L8 | Cart | ✔ | C | C0 | M | 3-5d | exists | cart template + handoff |
| L9 | Registration | tail | B | C0 + **LB12** | M-H | 3-5d | **LB-12 pending** | login/register templates |
| L10 | Accounts | tail | B | C0 | M | 1wk | exists | account templates |
| L11 | Orders | tail | B | C0 | M | 3-5d | exists | order templates |
| L12 | Tracking | tail | B | C0 | M | 3-5d | exists | status template |
| L13 | Theme Authoring | branch | D | C0 | M-H | 1wk | n/a | editor emits Liquid |
| L14 | Parity Program | ✔ | — | **ARB accepts** | M | 1-2wk | n/a | 200 cells green |
| L15 | Canary | ✔ | — | C0 + operator | M | 3-5d+soak | n/a | per-store flip + soak |
| L16 | Production Rollout | ✔ | — | **ARB flip** | M-H | 1wk soak | n/a | Liquid default |
| L17 | React Decommission | ✔ | — | **HW decision** | M | 1-2wk | n/a | render layer deleted |
| L18 | Certification | ✔ | — | sign-off + ARB | L | 2-3d | n/a | Full Liquid certified |

**Parallel tracks** (after L4): **A** product/collection/search · **B** register/accounts/orders/tracking · **C** cart · **D** compiler/authoring.

## Critical-path-only sequence
`L0→L1→L2→L4→L5→L6→L8→L14→L15→L16→L17→L18` (~10-12wk to prod, ~12-14wk to React-removed).

## Gate summary
- **Engineering-schedulable:** L0-L15, L18 (with C0 commits).
- **Not engineering-schedulable (human):** L9 (LB-12), L14 (ARB accept), L16 (ARB flip), L17 (hardening-wave decision).
- **Deferrable without blocking Closed/Open Beta:** L3+L13 (ship one fixed Liquid theme instead of merchant Liquid editing).
