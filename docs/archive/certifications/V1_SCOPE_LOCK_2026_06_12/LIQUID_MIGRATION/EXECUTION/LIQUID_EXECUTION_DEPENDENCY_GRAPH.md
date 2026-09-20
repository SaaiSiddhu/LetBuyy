# LIQUID_EXECUTION_DEPENDENCY_GRAPH.md

**Full Liquid V1 · L0→L18 · HEAD `140a73db` · plan-only.**

```
L0 Foundation Freeze
│
├─ L1 Bundle Persistence ─────────────────────────────────┐
│   │                                                      │
│   ├─ L2 Asset Pipeline (CSS)                              │
│   │   │                                                  │
│   │   └─ L4 Liquid Chrome (header/footer/nav, CAP-C08)   │
│   │       │                                              │
│   │       ├─[Track A]─ L5 Product ─ L6 Collection ─ L7 Search
│   │       ├─[Track C]─ L8 Cart ──(signed handoff → checkout.letbuyy.com, NOT rewritten)
│   │       └─[Track B]─ L9 Registration(←LB-12) ─ L10 Accounts ─ L11 Orders ─ L12 Tracking
│   │
│   └─[Track D]─ L3 Theme Compiler ──────────── L13 Theme Authoring
│
└─ (all customer routes Liquid-templated: L4..L13)
        │
        └─ L14 Parity Program  ════ ARB-accept gate (ART-17 parity/security/perf)
             │
             └─ L15 Canary  (per-store flip + soak)
                  │
                  └─ L16 Production Rollout  ════ ARB platform-flip (human)
                       │
                       └─ L17 React Decommission  ════ Hardening-wave data decision (human, ART-17)
                            │
                            └─ L18 Completion Certification
```

## Critical path
`L0 → L1 → L2 → L4 → L5 → L6 → L8 → L14 → L15 → L16 → L17 → L18`

## Parallel paths (after L4)
- **A:** L5 → L6 → L7
- **B:** L9 → L10 → L11 → L12 (gated by LB-12 at L9)
- **C:** L8 (after L5)
- **D:** L3 → L13 (deferrable branch)

## Blocking relationships
| Blocks | Blocked by |
|---|---|
| all Liquid render | L1 (no bundle) |
| all styled pages | L2 (no CSS) |
| L5-L12 templates | L4 (chrome+nav) |
| L9 | LB-12 (pending registration blocker) |
| L13 | L3 (compiler) |
| L16 flip | L14 parity + **ARB** |
| L17 delete | L14+L15+L16 + **hardening-wave decision** |
| L18 | L0-L17 |

## Hard external gates (not engineering-schedulable)
LB-12 (blocks L9) · ARB parity-accept (L14) · ARB platform-flip (L16) · hardening-wave data decision (L17) · commit seam C0 (every phase).

## Out-of-graph (frozen boundary)
Checkout origin (`checkout.letbuyy.com`) is **not a node** — it is consumed via the signed handoff at L8 and never rewritten (`CHECKOUT_BOUNDARY_DECISION.md`). The Theme Compiler is bounded to translation only (`THEME_COMPILER_CONTRACT.md`).
