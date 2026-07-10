# M→AE Program — Resume Procedure

Minimal executable continuation if the session is interrupted. Read PROGRAM_STATE.md first for the current phase.

## 1. Confirm safe state
```bash
cd /Users/saai_sidd/Git/Letbuyy_Store
git branch --show-current      # must be stepup/main
git rev-parse HEAD             # last program commit
git status --short | wc -l     # dirty count (foreign WIP preserved)
```
Never run `git add .`/`-A`, `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`, or force-push. Never stage foreign WIP — stage only the current phase's declared files by exact path.

## 2. Re-establish baselines (only if unsure)
```bash
pnpm typecheck test --filter=@letbuyy/theme-engine        # expect 643 pass (rises per phase)
pnpm typecheck test --filter=@letbuyy/storefront-runtime  # expect 687 pass
pnpm typecheck test --filter=@letbuyy/merchant-control-plane
pnpm typecheck --filter=@letbuyy/api-gateway
node scripts/validate-governance.mjs   # EXIT=1 pre-existing tenant-registry only
```

## 3. Resume the current phase
- Read `PROGRAM_STATE.md` → "Next action". Run that phase's loop: discover → plan → multi-agent workflow → implement → scoped tests → adversarial review → harden → full gates → docs → exact-path stage → commit → update PROGRAM_STATE → next phase.
- Workflow scripts persist under `.../workflows/scripts/`. To resume a partially-run workflow use `Workflow({scriptPath, resumeFromRunId})` (cached agents replay).
- On transient infra failure (401/classifier/rate-limit/MCP down): retry the failed agent once; if still failing, run that lane inline; never rerun successful agents; never discard evidence; record the incident in the phase report; continue.

## 4. Commit convention
One commit per phase, allowlisted form: `git add -- <exact paths>` then `git commit -q -m ' <subject>' -m '<body>' -m 'Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>'` (note the leading space in the subject — required by the settings allowlist). Commit messages per the program's §30 plan.

## 5. Invariants that must hold at every commit
site_id isolation · forced RLS, no public USING(true) · gateway-only writes behind verifySiteOwnership · ES256 merchant ≠ HS256 customer · React default + THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false · sanitizer locked · ART-17 (no new React-per-section) · frozen apps untouched · money ledger untouched · no production deploy/migration/flag-flip.
