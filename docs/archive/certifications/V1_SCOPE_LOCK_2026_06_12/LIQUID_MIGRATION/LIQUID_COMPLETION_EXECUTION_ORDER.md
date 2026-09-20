# LIQUID_COMPLETION_EXECUTION_ORDER.md

**Program:** Full Liquid V1 · **HEAD:** `140a73db` · plan-only. The exact sequence (with what parallelizes).

## Strict serial backbone (must be in this order)

1. **L0** Foundation Freeze Lock — ratify scope + gates.
2. **L1** Bundle Persistence — seed urban-kicks Liquid bundle (commit via human, C0).
3. **L2** Asset Pipeline — `:root` injection + extracted `lb-*` stylesheet + `/assets/*` serving.
4. **L4** Liquid Chrome — switch layout to Liquid header/footer + nav binding (kills CAP-C08).

## Parallel wave (after L4 — split across engineers)

Coordinate only on `theme-bundle.ts` section additions.

- **Track A (browse):** **L5** Product → **L6** Collection → **L7** Search.
- **Track B (tail, over existing APIs):** **L9** Registration (after LB-12) → **L10** Accounts → **L11** Orders → **L12** Tracking.
- **Track C (browse/commerce):** **L8** Cart (after L5).
- **Track D (authoring, parallel/deferrable):** **L3** Theme Compiler → **L13** Theme Authoring.

## Convergence + gates (serial again)

5. **L14** Parity Validation — execute the 200-cell harness to green (incremental per template as each lands). **ART-17 gate.**
6. **L15** Canary Program — build the canary writer + flip a cohort + soak.
7. **L16** Production Rollout — **human ARB** moves the flip off `deferred`; expand + soak.
8. **L17** React Decommission — after the **hardening-wave data decision**, stage-delete per `REACT_DELETION_EXECUTION_PLAN.md` (chrome → sections → registry/branch → bespoke pages → contexts → runtime-composition); each batch with its lockstep validator edit.
9. **L18** Completion Certification — final gate/E2E/perf/security/money/identity/tenancy attestations + sign-off.

## Per-phase loop (every phase)

`read phase doc → implement in a worktree → run phase tests + governance gate → produce evidence → human commits (C0) → update parity matrix`. No phase advances on red; L16/L17 additionally require the human governance act.

## Earliest-safe shortcuts

- Defer **L3/L13** (Track D) with one fixed Liquid theme → Open Beta ~1.5 wk sooner.
- Choose **L7** client-filter port (not a new search backend) → smallest path.
- **L8 cart** can ship before **L9-L12** (independent) to reach a shoppable Liquid browse fastest.
