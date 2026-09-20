# LIQUID_COMPLETION_MASTER_PROGRAM.md

**The supreme roadmap — Full Liquid V1.** HEAD `140a73db` · plan-only, no code. Companion to the 19 phase docs (`PHASES/PHASE_L0..L18`) + 6 master docs in this directory.

## Vision

Every customer-facing storefront route — home, collections, products, search, cart, login, registration, account, addresses, wishlist, orders, order detail, tracking, CMS, policies, 404 — renders through **Liquid**. React becomes migration reference, then is removed, leaving **one canonical renderer** (Constitution R-15). The hosted **checkout** stays the engine-agnostic React origin (§234). Money, identity, tenancy, and governance guarantees are preserved untouched, because the migration is confined to the render layer.

## Architecture (target)

- **One storefront-runtime** (Next.js/Vercel, ART-18) hosting the **LiquidJS** renderer (`theme-renderer.ts`) via `StorefrontCompositionEngine`, fed a per-store `liquidBundle` from `sites.template_config`.
- **Engine-agnostic backbone retained:** `template-resolver`, `data-binding-engine`, all `lib/*-service.ts`, all 22 `app/api/*` proxies, and the gateway backends (`cart-routes.ts`, `/api/customer/*`, `/api/orders/*`).
- **Interactivity** via web-component islands (`liquid-hydration-islands.tsx`) sharing cart state with the server cart.
- **Hosted checkout** on `checkout.letbuyy.com` consuming a signed cart handoff — unchanged under any renderer.
- **Theme authoring** via the editor + a portable→Liquid compiler (L3); preview = the real storefront.

## Phase summary (L0–L18)

| Phase | Title | Output | Critical? |
|---|---|---|---|
| L0 | Foundation Freeze Lock | scope + gates | ✔ |
| L1 | Bundle Persistence | seeded Liquid bundle | ✔ |
| L2 | Asset Pipeline | CSS shipped | ✔ |
| L3 | Theme Compiler | portable→Liquid | branch |
| L4 | Liquid Chrome | header/footer/nav | ✔ |
| L5 | Product Experience | product template | ✔ |
| L6 | Collection Experience | collection template | ✔ |
| L7 | Search Experience | search template | — |
| L8 | Cart Migration | cart template | ✔ |
| L9 | Customer Registration | login/register (LB-12) | tail |
| L10 | Customer Accounts | account templates | tail |
| L11 | Orders | order templates | tail |
| L12 | Tracking | status template | tail |
| L13 | Theme Authoring | editor emits Liquid | branch |
| L14 | Parity Validation | 200 cells green (ART-17 gate) | ✔ |
| L15 | Canary Program | per-store flip + soak | ✔ |
| L16 | Production Rollout | ARB platform-flip | ✔ (human) |
| L17 | React Decommission | render layer deleted | ✔ (human gate) |
| L18 | Completion Certification | Full-Liquid certified | ✔ |

## Dependency graph

See `LIQUID_COMPLETION_DEPENDENCY_GRAPH.md`. Critical path: `L0→L1→L2→L4→L5→L6→L8→L14→L15→L16→L17→L18`. Parallel: L3/L13 (authoring) and L9-L12 (tail) after L4.

## Risk matrix

See `LIQUID_COMPLETION_RISK_REGISTER.md`. Top schedule risks: parity (R1), compiler (R2), ARB flip (R3). Top guarantee risks (all Low-likelihood by isolation, High-severity): checkout-handoff (R8), issuer model (R9), tenancy bleed (R10), money/identity/tenancy regression (R15) — each gets a mandatory L14 validation dimension.

## Milestones

See `LIQUID_COMPLETION_MILESTONES.md`. Internal Alpha ~wk2-3, Internal Beta ~wk4-5, Closed Beta ~wk7-8, Open Beta ~wk9-10, Production ~wk10-12, React-Removed ~wk12-14.

## Success criteria

1. Every customer-facing route renders Liquid (L4-L13).
2. The 200-cell parity matrix is green incl. perf + security dimensions (L14).
3. Liquid is default in production with clean soak (L16).
4. React render layer removed; one canonical renderer (L17, R-15).
5. Money/identity/tenancy/governance attestations green throughout and at L18.

## Launch criteria (per tier)

- **Closed Beta:** all customer routes Liquid-templated + checkout works + LB-12 landed.
- **Open Beta:** parity green (L14).
- **Production:** canary soak clean + ARB flip (L16).

## React removal criteria (Constitution ART-17 — non-negotiable)

React is removed **only** when, per surface: (1) parity green, (2) production soak clean, (3) the **hardening-wave data decision** recorded, (4) gate green at the lockstep validator counts, (5) the archive copy exists. Until all five hold, React is **KEEP-TEMP** (frozen, the rollback). Checkout's React origin is **never** removed (§234).

## What this program does NOT do

No backend rebuild (cart/account/orders/checkout exist). No new service/app (foundation freeze). No Liquid checkout (constitutional React origin). No money/identity/tenancy edit. No deletion before proof.
