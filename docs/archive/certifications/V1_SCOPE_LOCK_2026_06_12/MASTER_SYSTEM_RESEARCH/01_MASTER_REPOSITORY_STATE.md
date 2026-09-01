# 01 — MASTER REPOSITORY STATE

**Date:** 2026-06-13 · **HEAD:** `cd5905be` · read-only, code-verified this session. Numbers are filesystem counts, not estimates.

## Census (filesystem truth)

| Thing | Count | Note |
|---|---|---|
| Apps (dirs) | ~12 | 5 live + mobile + 6 frozen/reserved |
| Live V1 apps | 5 | `storefront-runtime, merchant-control-plane, identity-platform, marketing-site, platform-console` |
| Services (dirs) | 10 | 4 live (`api-gateway, queue-workers, mobile-bff, webhook-service`) + 6 reserved manifest-only |
| Packages | ~27 | TS + Dart |
| Migrations | ~101 | sequential, tracked; baseline (000) alone = **237 tables, 393 indexes, 234 RLS-enabled** |
| Validators (gate) | ~107 wired (~111 files) | `scripts/validators/*.mjs` |
| Workflows | 12 | `.github/workflows/` |
| platform-console pages | 21 | internal ops |
| Docs (markdown) | ~1,300 | much historical |

## Health

- **Governance gate:** green at ~107 validators (last full green read this session). Money/identity/tenancy validators are in the green set.
- **Foundation invariants verified intact:** canonical double-entry ledger (DB constraint-trigger), 0% commission (mig 162), asymmetric sole-issuer identity + customer HS256 separation, RLS+GUC tenancy (234 tables RLS-enabled), hosted checkout origin via signed handoff.

## The two defining facts

1. **Never pushed / never deployed.** Local HEAD `cd5905be` is **211 commits ahead of `origin/main`** (still `41b6ea49`, "show turnstile on auth forms"). Production deploys on push to `main` — so the entire converged platform has **never reached the deploy branch**; zero production deploys have fired.
2. **React-V1 blockers are closing but not closed.** As of this HEAD: LB-9 (appearance bridge), LB-10 (cancelled/refunded emails), LB-12 (shopper register route) now have implementations on disk (verify completeness); **LB-8 (announcement bar renderer) and LB-11 (hide dead gift-card surface) remain open.**

## Two-track reality

- **React V1 (the launchable product):** ~85% code-complete, gate-green, money/identity/tenancy sound. Blocked on 2 remaining features + the push + 9 human provisioning seams.
- **Liquid (the constitutional renderer, ART-17):** dormant. Bundle persistence started (mig 171/172), but render default OFF, parity unexecuted. **Not a V1 launch path.**

## Mount caveat (operational truth)

The file-tools mount and the bash mount have at times shown different HEADs/subtrees this session. **bash (`/sessions/.../Letbuyy_Store`, HEAD `cd5905be`) is ground truth**; verify there. This document and 02–13 are grounded in the bash mount.

See `13_FINAL_EXECUTIVE_SUMMARY.md` for the scored readiness and the path to launch.
