#!/usr/bin/env bash
# gate.sh — the deterministic gate battery for /letbuyy. Prints a table (name | exit | seconds | first failure line)
# and writes every log under $LETBUYY_GATE_OUT (default ~/.letbuyy/gate/<branch>-<sha>-<ts>/).
#
# Usage: bash .claude/skills/letbuyy/scripts/gate.sh [--quick|--baseline|--security|--ui|--mobile|--full] [--flutter-build] [--real-db] [--gate-real] [--build]
#   (default)      typecheck · lint · governance --plan (inventory drift, SAFE) · the FULL validator sweep (every gate-lane validator run
#                  individually, SAFE — no artefact cleanup) · contract tests · gateway unit tests (all 94 suites) · tests/governance + tests/ci
#   --quick        typecheck + lint only
#   --baseline     same as default, labelled BASELINE (run on the untouched branch before building)
#   --security     default + tests/security + tests/auth + the d2 RLS red-team + wave-4 session security
#   --ui           default + @letbuyy/ui validate:ui + design-system ratchet + token parity checks + lint:css
#   --mobile       default + flutter analyze + flutter test for merchant_app (canary 172), customer_app
#                  (admin_app was retired to a RESERVED root in FB-1, 2026-09-05 — it has no source to analyze)
#   --full         security + ui + mobile + every tests/*/*.test.mjs + every runtime's own test script
#   --flutter-build  adds flutter build apk --debug + aapt dump badging per app (run AFTER any --gate-real: the real lane deletes build/)
#   --real-db      adds pnpm run test:governance (starts the ephemeral Postgres helper) — only when LETBUYY_EXECUTABLE_PG_CONTAINER
#                  names an isolated throwaway container; otherwise SKIP with the reason
#   --gate-real    the REAL lane `node scripts/validate-governance.mjs --lane=gate`: DELETES node_modules/.next/.turbo/dist/.dart_tool/
#                  build/coverage/.cache/.wrangler/.vercel/.symlinks under apps|packages|services; reinstall afterwards
#   --build        adds `pnpm run build` (turbo build of the non-frozen apps; slow)
#
# Rules encoded here (see references/hazards.md):
#  - runs from a git worktree root; refuses the primary checkout unless LETBUYY_ALLOW_PRIMARY=1
#  - refuses to run at all without node_modules unless LETBUYY_ALLOW_NO_INSTALL=1 (F-GATEGUARD-1):
#    the test lanes would die before running, yielding zero failure names and a set-diff that reads
#    as every ambient failure fixed
#  - never runs a generator, never resets a database, never touches another worktree, never pushes
#  - exit code = number of failed checks (0 = all green); ambient reds still count — attribute them in the report
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "gate.sh: not inside a git worktree" >&2; exit 2; }
PRIMARY="/Users/saai_siddharth/Projects/Start_Up/LetBuyy"
if [ "$ROOT" = "$PRIMARY" ] && [ "${LETBUYY_ALLOW_PRIMARY:-0}" != "1" ]; then
  echo "gate.sh: refusing to run in the primary checkout ($PRIMARY) — use a phase worktree (LETBUYY_ALLOW_PRIMARY=1 overrides)" >&2; exit 2
fi
cd "$ROOT"
MODE=default; FLUTTER_BUILD=0; REAL_DB=0; GATE_REAL=0; BUILD=0
for a in "$@"; do case "$a" in
  --quick) MODE=quick;; --baseline) MODE=baseline;; --security) MODE=security;; --ui) MODE=ui;; --mobile) MODE=mobile;; --full) MODE=full;;
  --flutter-build) FLUTTER_BUILD=1;; --real-db) REAL_DB=1;; --gate-real) GATE_REAL=1;; --build) BUILD=1;;
  -h|--help) sed -n '2,24p' "$0"; exit 0;;
  *) echo "gate.sh: unknown flag $a" >&2; exit 2;; esac; done
BRANCH="$(git rev-parse --abbrev-ref HEAD)"; SHA="$(git rev-parse --short HEAD)"; TS="$(date +%Y%m%d-%H%M%S)"
OUT="${LETBUYY_GATE_OUT:-$HOME/.letbuyy/gate/$(echo "$BRANCH" | tr '/' '_')-$SHA-$TS}"; mkdir -p "$OUT"
# F-GATEGUARD-1: this was a WARNING that then ran anyway, and the warning's own wording — "lies in
# both directions" — was correct. Measured on one commit (3b0852f8) with and without the install:
# without it the run reports failed=6, reddening typecheck, tests:governance and two validators
# (cycle-budget, route-ownership) that are otherwise green. That is the harmless direction. The
# harmful one is that both test lanes die with ELIFECYCLE BEFORE running, so the run yields ZERO
# failing test names — and the failure-SET diff this programme performs every phase then compares an
# empty head set against the real baseline and reports every ambient failure as fixed. A gate that
# cannot run must not produce a table that looks like one.
if [ ! -d node_modules ] && [ "${LETBUYY_ALLOW_NO_INSTALL:-0}" != "1" ]; then
  echo "gate.sh: refusing to run without node_modules — the lanes would fail for the wrong reason and the" >&2
  echo "         failure-set diff would read as every ambient failure fixed. Run: pnpm install --frozen-lockfile" >&2
  echo "         (LETBUYY_ALLOW_NO_INSTALL=1 overrides, for deliberately measuring this state)" >&2
  exit 2
fi
echo "gate.sh mode=$MODE flutter-build=$FLUTTER_BUILD real-db=$REAL_DB gate-real=$GATE_REAL build=$BUILD  root=$ROOT  branch=$BRANCH  sha=$SHA  dirty=$(git status --porcelain | wc -l | tr -d ' ')  untracked=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')"
echo "logs → $OUT"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILS=0; ROWS=()
run() { # run <name> <command…>
  local name="$1"; shift; local log="$OUT/$(echo "$name" | tr ' /:' '___').log"; local start=$SECONDS
  ( "$@" ) >"$log" 2>&1; local rc=$?; local secs=$((SECONDS-start))
  local first=""
  if [ $rc -ne 0 ]; then
    local matches n unrun
    matches="$(grep -E '^✖ |^not ok |failed:|error TS[0-9]+|RATCHET regression|ELIFECYCLE|^- ' "$log" | grep -vE '✔|✓|^ok |failing tests:' || true)"
    n="$(printf '%s' "$matches" | grep -c . || true)"
    first="$(printf '%s\n' "$matches" | head -1 | cut -c1-110)"
    # GW-1: one line was all this ever showed, so a second, worse failure in the same lane was
    # invisible. A count is not a set — say how many more there are.
    [ "${n:-0}" -gt 1 ] && first="$first  (+$((n-1)) more)"
    # GW-1: and a turbo task that fails CANCELS its dependents, so a lane can report a single
    # failure while whole packages are never checked at all. That is how a missing export left
    # @letbuyy/api-gateway — the canonical backend — unbuildable on develop while this table read
    # "1 failure, already attributed". Name every package that owns the task and produced nothing.
    unrun="$(node "$SKILL_DIR/turbo-unrun.mjs" "$log" "$PWD" 2>/dev/null || true)"
    [ -n "$unrun" ] && first="$first  [NO OUTPUT: $unrun]"
    FAILS=$((FAILS+1))
  fi
  ROWS+=("$(printf '%-40s | %4s | %5ss | %s' "$name" "$rc" "$secs" "$first")")
  printf '  %-40s exit=%s (%ss)\n' "$name" "$rc" "$secs"
}
skip() { ROWS+=("$(printf '%-40s | %4s | %5ss | %s' "$1" SKIP 0 "$2")"); echo "  $1 SKIPPED ($2)"; }
sweep() { # every gate-lane validator, individually (safe: no artefact cleanup). Row = pass/total; first failing names listed.
  local start=$SECONDS; local names; names="$(node -e '
    const s=require("fs").readFileSync("scripts/validate-governance.mjs","utf8");
    const m=s.match(/const validators = \[([\s\S]*?)\];/); if(!m){process.exit(3)}
    console.log([...m[1].matchAll(/"([^"]+\.mjs)"/g)].map(x=>x[1]).join("\n"))')"
  local total=0 pass=0 failed=""; mkdir -p "$OUT/validators"
  for v in $names; do total=$((total+1))
    if node "scripts/validators/$v" >"$OUT/validators/${v%.mjs}.log" 2>&1; then pass=$((pass+1)); else failed="$failed ${v%-validator.mjs}"; fi
  done
  local secs=$((SECONDS-start)); local rc=$((total-pass)); [ $rc -eq 0 ] || FAILS=$((FAILS+1))
  # F-GATEDIFF-1: $failed is ground truth — it comes from each validator's EXIT CODE above, not from
  # grepping its log. The table prints it through `cut -c1-110`, which is fine for a human summary and
  # useless as evidence once the list grows. Persist it whole, one name per line, so a phase compares
  # SETS instead of re-deriving them with a log heuristic that has over-matched here before.
  echo "$failed" | tr ' ' '\n' | sed '/^$/d' | sort > "$OUT/failing-validators.txt"
  ROWS+=("$(printf '%-40s | %4s | %5ss | %s' "validators:sweep ($pass/$total pass)" "$rc" "$secs" "$(echo $failed | cut -c1-110)")")
  printf '  %-40s exit=%s (%ss) failed:%s\n' "validators:sweep" "$rc" "$secs" "$failed"
  echo "$failed" | tr ' ' '\n' | grep -q '^stale-artifact$' && echo "  note: stale-artifact-validator fails by method when run individually (no orchestrator cleanup) — confirm its offender list is 100% generated dirs"
  return 0
}
# ---- core
run typecheck            pnpm run typecheck
run lint                 pnpm run lint
if [ "$MODE" != quick ]; then
  run governance:plan      node scripts/validate-governance.mjs --lane=gate --plan
  sweep
  run test:contracts       pnpm run test:contracts
  run test:unit:gateway    pnpm run test:unit:gateway
  run tests:governance     bash -c 'node --test --test-concurrency=1 tests/governance/*.test.mjs'
  run tests:ci             bash -c 'node --test tests/ci/*.test.mjs'
fi
if [ "$MODE" = security ] || [ "$MODE" = full ]; then
  run tests:security+auth  bash -c 'node --test tests/security/*.test.mjs tests/auth/*.test.mjs'
  run tests:wave4-session  pnpm exec tsx --test tests/governance/foundation-wave4-session-security.test.ts
fi
if [ "$MODE" = ui ] || [ "$MODE" = full ]; then
  run ui:validate          pnpm --filter @letbuyy/ui run validate:ui
  run ui:design-system     node scripts/validators/validate-design-system.mjs
  run ui:design-tokens     node scripts/generators/generate-design-tokens.mjs --check
  run ui:mobile-tokens     node scripts/generators/generate-mobile-tokens.mjs --check
  if [ -x node_modules/.bin/stylelint ]; then run ui:lint-css pnpm run lint:css; else skip ui:lint-css "stylelint binary missing"; fi
fi
if [ "$MODE" = mobile ] || [ "$MODE" = full ]; then
  if command -v flutter >/dev/null 2>&1; then
    for app in merchant_app customer_app; do
      run "flutter:$app:analyze" bash -c "cd apps/$app && flutter analyze"
      run "flutter:$app:test"    bash -c "cd apps/$app && flutter test"
    done
  else skip flutter "flutter not on PATH"; fi
fi
if [ "$MODE" = full ]; then
  run tests:all            bash -c 'node --test --test-concurrency=1 tests/*/*.test.mjs'
  for f in @letbuyy/queue-workers @letbuyy/webhook-service @letbuyy/mobile-bff @letbuyy/identity-platform @letbuyy/customer-web @letbuyy/merchant-web @letbuyy/admin-web @letbuyy/marketing-site @letbuyy/theme-engine; do
    run "test:$f" pnpm --filter "$f" run test
  done
fi
if [ $BUILD = 1 ]; then run build pnpm run build; fi
if [ $REAL_DB = 1 ]; then
  if [ -n "${LETBUYY_EXECUTABLE_PG_CONTAINER:-}" ]; then run test:governance:real-db pnpm run test:governance
  else skip test:governance:real-db "LETBUYY_EXECUTABLE_PG_CONTAINER unset — name an isolated throwaway container first"; fi
fi
if [ $GATE_REAL = 1 ]; then
  echo "WARNING: the real lane deletes generated directories under apps|packages|services; reinstall with pnpm install --frozen-lockfile afterwards"
  run governance:REAL-LANE node scripts/validate-governance.mjs --lane=gate
  [ -d packages/typescript/ui/node_modules ] || echo "  per-package node_modules are gone — run: pnpm install --frozen-lockfile"
fi
if [ $FLUTTER_BUILD = 1 ]; then
  if command -v flutter >/dev/null 2>&1; then
    AAPT="$(command -v aapt || ls "${ANDROID_HOME:-$HOME/Library/Android/sdk}"/build-tools/*/aapt 2>/dev/null | tail -1)"
    for app in merchant_app customer_app; do
      run "flutter:$app:build-apk" bash -c "cd apps/$app && flutter build apk --debug"
      if [ -n "$AAPT" ]; then run "flutter:$app:badging" bash -c "$AAPT dump badging apps/$app/build/app/outputs/flutter-apk/app-debug.apk | grep -E '^package:'"; else skip "flutter:$app:badging" "aapt not found"; fi
    done
    echo "  note: flutter build writes to tracked files — run git status and attribute every change"
  else skip flutter-build "flutter not on PATH"; fi
fi
# F-GATEDIFF-1: the failing TEST-name set, collected across every lane log rather than the two lanes
# a reader happens to think of. Leading whitespace is stripped on purpose: node:test indents a nested
# subtest's ✖, and an earlier phase in this programme extracted only `^✖ ` and silently missed those.
# The `✖ failing tests:` header is node's own section marker, not a test name, so it is excluded.
find "$OUT" -maxdepth 1 -name '*.log' -exec grep -hE '^[[:space:]]*✖ ' {} + 2>/dev/null \
  | sed 's/^[[:space:]]*//; s/ ([0-9.]*ms)$//' \
  | grep -v '^✖ failing tests:' | sort -u > "$OUT/failing-tests.txt"
[ -f "$OUT/failing-validators.txt" ] || : > "$OUT/failing-validators.txt"
echo "failure sets → $OUT/failing-tests.txt ($(wc -l < "$OUT/failing-tests.txt" | tr -d ' ') names), $OUT/failing-validators.txt ($(wc -l < "$OUT/failing-validators.txt" | tr -d ' ') names)"
{
  echo "GATE TABLE  mode=$MODE  branch=$BRANCH  sha=$SHA  at=$TS  failed=$FAILS"
  printf '%-40s | %4s | %6s | %s\n' name exit secs "first failure line"; printf '%s\n' "${ROWS[@]}"
} | tee "$OUT/summary.txt"
echo "summary → $OUT/summary.txt"
exit $FAILS
