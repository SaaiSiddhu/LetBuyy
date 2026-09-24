#!/usr/bin/env bash
# merge-develop.sh — merge a VERIFIED phase branch into develop INSIDE the checkout that holds develop (the primary,
# OWNER_DECISION D-MERGE-LOCATION 2026-09-23), with every guard from
# references/merge.md. Stops before the commit (inspection window) unless --commit is given; resumes an open window.
# Never touches any other worktree. Never pushes.
# Usage: bash .claude/skills/letbuyy/scripts/merge-develop.sh <branch> [--commit] [--develop-worktree <path>]
set -uo pipefail
BRANCH="${1:-}"; [ -n "$BRANCH" ] || { sed -n '2,5p' "$0"; exit 2; }; shift
COMMIT=0; D="${LETBUYY_DEVELOP_WORKTREE:-/Users/saai_siddharth/Projects/Start_Up/LetBuyy}"
while [ $# -gt 0 ]; do case "$1" in --commit) COMMIT=1;; --develop-worktree) D="$2"; shift;; *) echo "unknown flag $1" >&2; exit 2;; esac; shift; done
TMP="$HOME/.letbuyy/tmp"; mkdir -p "$TMP"
fail() { echo "ABORT: $*" >&2; exit 1; }
# Retired paths a stale branch could bring back. The pre-2026-09-24 flat app roots are listed so a branch cut
# before APPID-P1 cannot resurrect them (D-APP-LAYOUT). apps/merchant/ and apps/internal/ are grouping
# containers since Amendment 3: their approved roots pass, anything else under them is caught by CONTAINER_OK.
RESURRECT='^(apps/storefront-runtime/|apps/merchant-control-plane/|apps/platform-console/|apps/mobile/|Ecommerce/|apps/admin/|apps/auth/|apps/checkout/|apps/storefront/|apps/analytics/|apps/commerce/web/consumer-storefront/|apps/customer_app/|apps/customer_web/|apps/merchant_app/|apps/merchant_web/|apps/admin_web/|apps/admin_app/|apps/identity-platform/|apps/marketing-site/|apps/app-marketplace/|apps/theme-marketplace/|apps/developer-portal/|apps/platform-operations-portal/|apps/phase_2/)|(^|/)legacy_archive_v2/|\.jks$|\.keystore$|(^|/)key\.properties$|(^|/)\.dev\.vars$|(^|/)\.env\.local
[ -d "$D/.git" ] || [ -f "$D/.git" ] || fail "the checkout that holds develop was not found at $D. Merges run in the primary checkout (OWNER_DECISION D-MERGE-LOCATION, references/decisions.md §2d); pass --develop-worktree <path> if it moved"
[ "$(git -C "$D" rev-parse --abbrev-ref HEAD)" = "develop" ] || fail "$D does not hold develop"
[ "$(git -C "$D" worktree list | grep -c '\[develop\]')" = "1" ] || fail "develop is checked out in more than one worktree"
git -C "$D" show-ref --verify --quiet "refs/heads/$BRANCH" || fail "branch $BRANCH does not exist"
RESUME=0
if MH="$(git -C "$D" rev-parse -q --verify MERGE_HEAD 2>/dev/null)"; then
  [ "$MH" = "$(git -C "$D" rev-parse "$BRANCH")" ] || fail "a merge of a DIFFERENT commit ($MH) is in progress in $D — finish or abort it first"
  RESUME=1; echo "resuming the open inspection window for $BRANCH"
else
  [ "$(git -C "$D" status --porcelain | wc -l | tr -d ' ')" = "0" ] || fail "develop worktree is dirty — attribute it first"
  [ "$(git -C "$D" ls-files --others --exclude-standard | wc -l | tr -d ' ')" = "0" ] || fail "develop worktree has untracked files"
fi
if git -C "$D" merge-base --is-ancestor "$BRANCH" develop; then echo "note: $BRANCH is already contained in develop"; exit 0; fi
PRE="$(git -C "$D" rev-parse HEAD)"; BASE="$(git -C "$D" merge-base develop "$BRANCH")"   # with a merge in progress HEAD is still the pre-merge tip
echo "develop=$PRE  base=$BASE  branch tip=$(git -C "$D" rev-parse --short "$BRANCH")"
echo "--- commits to merge:"; git -C "$D" log --oneline "$BASE".."$BRANCH" | head -40
echo "--- overlap (files changed on BOTH sides since base; suites must run on the RESULT if non-empty):"
comm -12 <(git -C "$D" diff --name-only "$BASE"..develop | sort) <(git -C "$D" diff --name-only "$BASE".."$BRANCH" | sort) | tee "$TMP/merge-overlap.txt"
grep -qE 'BRANCH_DISPOSITIONS|EXECUTION_LEDGER|SKIPPED_HUMAN_DECISIONS|CAPABILITY_BACKLOG' "$TMP/merge-overlap.txt" && echo "note: a ledger is on both sides — union rows, confirm no row was lost"
if [ $RESUME = 1 ]; then :; elif ! git -C "$D" merge --no-ff --no-commit "$BRANCH" >"$TMP/merge.log" 2>&1; then
  echo "--- merge has conflicts (resolve ONLY inside the phase's files, then re-run with --commit):"; git -C "$D" diff --name-only --diff-filter=U; exit 3
fi
echo "--- staged result (uncommitted):"; git -C "$D" diff --cached --name-status | head -60
[ "$(git -C "$D" diff --name-only --diff-filter=U | wc -l | tr -d ' ')" = "0" ] || fail "unresolved conflicts remain"
[ "$(git -C "$D" rev-parse refs/heads/develop)" = "$PRE" ] || fail "refs/heads/develop moved during the merge ($PRE → $(git -C "$D" rev-parse refs/heads/develop)); git -C $D merge --abort and retry"
if [ $COMMIT = 0 ]; then echo "inspection window open — verify, then: bash $0 $BRANCH --commit   (or: git -C $D merge --abort)"; exit 0; fi
git -C "$D" commit -q -m "Merge branch '$BRANCH' into develop" || fail "commit failed"
M="$(git -C "$D" rev-parse HEAD)"; echo "merge commit: $M"
echo "--- first-parent diff (must be within the phase's files + ledgers):"; git -C "$D" diff --name-status "$PRE" "$M" | head -80
RES="$( { git -C "$D" ls-tree -r "$M" --name-only | grep -E "$RESURRECT"; git -C "$D" ls-tree -r "$M" --name-only | grep -E '^apps/(merchant|internal)/' | grep -vE "$CONTAINER_OK"; } | grep -c . || true)"
if [ "$RES" = "0" ]; then echo "resurrection check: 0"; else echo "WARNING: resurrection check found $RES retired/secret paths in the result tree — investigate before anything else"; { git -C "$D" ls-tree -r "$M" --name-only | grep -E "$RESURRECT"; git -C "$D" ls-tree -r "$M" --name-only | grep -E '^apps/(merchant|internal)/' | grep -vE "$CONTAINER_OK"; } | head -20; fi
git -C "$D" reflog show develop -1
echo "author/committer: $(git -C "$D" log -1 --format='%an <%ae> | %cn <%ce>')"
echo "next: run affected suites on $M if overlap was non-empty · ledger bookkeeping commit (ACTIVE → MERGED_DEVELOP, Merged into = $M; EXECUTION_LEDGER row) · worktree disposition · optional push develop (owner)"

CONTAINER_OK='^(apps/merchant/web/|apps/merchant/mobile/|apps/internal/console/)'
[ -d "$D/.git" ] || [ -f "$D/.git" ] || fail "the checkout that holds develop was not found at $D. Merges run in the primary checkout (OWNER_DECISION D-MERGE-LOCATION, references/decisions.md §2d); pass --develop-worktree <path> if it moved"
[ "$(git -C "$D" rev-parse --abbrev-ref HEAD)" = "develop" ] || fail "$D does not hold develop"
[ "$(git -C "$D" worktree list | grep -c '\[develop\]')" = "1" ] || fail "develop is checked out in more than one worktree"
git -C "$D" show-ref --verify --quiet "refs/heads/$BRANCH" || fail "branch $BRANCH does not exist"
RESUME=0
if MH="$(git -C "$D" rev-parse -q --verify MERGE_HEAD 2>/dev/null)"; then
  [ "$MH" = "$(git -C "$D" rev-parse "$BRANCH")" ] || fail "a merge of a DIFFERENT commit ($MH) is in progress in $D — finish or abort it first"
  RESUME=1; echo "resuming the open inspection window for $BRANCH"
else
  [ "$(git -C "$D" status --porcelain | wc -l | tr -d ' ')" = "0" ] || fail "develop worktree is dirty — attribute it first"
  [ "$(git -C "$D" ls-files --others --exclude-standard | wc -l | tr -d ' ')" = "0" ] || fail "develop worktree has untracked files"
fi
if git -C "$D" merge-base --is-ancestor "$BRANCH" develop; then echo "note: $BRANCH is already contained in develop"; exit 0; fi
PRE="$(git -C "$D" rev-parse HEAD)"; BASE="$(git -C "$D" merge-base develop "$BRANCH")"   # with a merge in progress HEAD is still the pre-merge tip
echo "develop=$PRE  base=$BASE  branch tip=$(git -C "$D" rev-parse --short "$BRANCH")"
echo "--- commits to merge:"; git -C "$D" log --oneline "$BASE".."$BRANCH" | head -40
echo "--- overlap (files changed on BOTH sides since base; suites must run on the RESULT if non-empty):"
comm -12 <(git -C "$D" diff --name-only "$BASE"..develop | sort) <(git -C "$D" diff --name-only "$BASE".."$BRANCH" | sort) | tee "$TMP/merge-overlap.txt"
grep -qE 'BRANCH_DISPOSITIONS|EXECUTION_LEDGER|SKIPPED_HUMAN_DECISIONS|CAPABILITY_BACKLOG' "$TMP/merge-overlap.txt" && echo "note: a ledger is on both sides — union rows, confirm no row was lost"
if [ $RESUME = 1 ]; then :; elif ! git -C "$D" merge --no-ff --no-commit "$BRANCH" >"$TMP/merge.log" 2>&1; then
  echo "--- merge has conflicts (resolve ONLY inside the phase's files, then re-run with --commit):"; git -C "$D" diff --name-only --diff-filter=U; exit 3
fi
echo "--- staged result (uncommitted):"; git -C "$D" diff --cached --name-status | head -60
[ "$(git -C "$D" diff --name-only --diff-filter=U | wc -l | tr -d ' ')" = "0" ] || fail "unresolved conflicts remain"
[ "$(git -C "$D" rev-parse refs/heads/develop)" = "$PRE" ] || fail "refs/heads/develop moved during the merge ($PRE → $(git -C "$D" rev-parse refs/heads/develop)); git -C $D merge --abort and retry"
if [ $COMMIT = 0 ]; then echo "inspection window open — verify, then: bash $0 $BRANCH --commit   (or: git -C $D merge --abort)"; exit 0; fi
git -C "$D" commit -q -m "Merge branch '$BRANCH' into develop" || fail "commit failed"
M="$(git -C "$D" rev-parse HEAD)"; echo "merge commit: $M"
echo "--- first-parent diff (must be within the phase's files + ledgers):"; git -C "$D" diff --name-status "$PRE" "$M" | head -80
RES="$(git -C "$D" ls-tree -r "$M" --name-only | grep -cE "$RESURRECT" || true)"
if [ "$RES" = "0" ]; then echo "resurrection check: 0"; else echo "WARNING: resurrection check found $RES retired/secret paths in the result tree — investigate before anything else"; git -C "$D" ls-tree -r "$M" --name-only | grep -E "$RESURRECT" | head -20; fi
git -C "$D" reflog show develop -1
echo "author/committer: $(git -C "$D" log -1 --format='%an <%ae> | %cn <%ce>')"
echo "next: run affected suites on $M if overlap was non-empty · ledger bookkeeping commit (ACTIVE → MERGED_DEVELOP, Merged into = $M; EXECUTION_LEDGER row) · worktree disposition · optional push develop (owner)"
