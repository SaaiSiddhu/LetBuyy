# LIQUID_COMPLETION_DEPENDENCY_GRAPH.md

**Program:** Full Liquid V1 (L0–L18) · **HEAD:** `0b8a56e7` · plan-only.

## Graph (L0 → L18)

```
L0 Foundation Freeze Lock
 └─ L1 Bundle Persistence
     ├─ L2 Asset Pipeline (CSS)
     │   └─ L4 Liquid Chrome (header/footer/nav)
     │       ├─ L5 Product ─┬─ L6 Collection ─ L7 Search
     │       │              └─ L8 Cart
     │       └─ L9 Registration (← LB-12) ─ L10 Accounts ─ L11 Orders ─ L12 Tracking
     └─ L3 Theme Compiler ───────────────────────────── L13 Theme Authoring
                                                          
   [L4..L13 all customer-facing routes Liquid-templated]
     └─ L14 Parity Validation (ART-17 gate)
         └─ L15 Canary Program
             └─ L16 Production Rollout (ARB flip — human)
                 └─ L17 React Decommission (← hardening-wave data decision — human)
                     └─ L18 Completion Certification
```

## Critical path

`L0 → L1 → L2 → L4 → L5 → L6 → L8 → L14 → L15 → L16 → L17 → L18`

This is the minimum serial chain: nothing renders styled-Liquid before L1+L2; chrome (L4) gates page templates; product/collection/cart (L5/L6/L8) are the highest-traffic and the parity backbone; L14 is the constitutional gate; L15/L16/L17 are sequential rollout/deletion; L18 closes.

## Parallel paths

- **Branch A (compiler/authoring):** `L3 → L13` runs parallel to the template work; joins the critical path only if merchant Liquid editing must ship by Open Beta. Otherwise it floats (defer with one fixed theme).
- **Branch B (account/order tail):** `L9 → L10 → L11 → L12` parallel to `L5/L6/L7/L8` once L4 lands — independent templates over independent backends. Gates Closed Beta, not Internal.
- **Within L14:** per-section parity cells parallelize as each template lands.

## Blocking relationships

| Blocks | Blocked by | Why |
|---|---|---|
| everything | L1 | no bundle → no Liquid render |
| every styled page | L2 | no CSS → unstyled |
| L5–L12 page templates | L4 | chrome must be Liquid + nav bound |
| L9 | LB-12 | registration endpoint pending in the V1 program |
| L13 | L3 | authoring needs the compiler |
| L16 (flip) | L14 | ART-17 parity gate; **human ARB** |
| L17 (delete) | L14 + L16 soak + **hardening-wave data decision** | ART-17 forbids earlier deletion |
| L18 | L0–L17 | terminal cert |

## External / human gates (not engineering-schedulable)

- **LB-12** (registration) — pending V1 code blocker, blocks L9.
- **ARB flip** (L16) — human governance act.
- **Hardening-wave data decision** (L17) — human, Constitution ART-17.
- **Commit seam C0** — a human commits each phase (sandbox cannot).
