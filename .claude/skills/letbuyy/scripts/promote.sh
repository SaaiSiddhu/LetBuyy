#!/usr/bin/env bash
# promote.sh — fast-forward-only promotion: staging ← develop, main ← staging. Never pushes without an explicit confirmation
# variable set by the session AFTER the owner's word in the same message — and the harness denies agent pushes anyway, so
# the script prints the exact command for the owner. See references/promote.md.
# Usage: bash .claude/skills/letbuyy/scripts/promote.sh <staging|main> [--push]
#   --push requires LETBUYY_PROMOTE_CONFIRM=<target> in the environment (set it only after the owner's word).
set -uo pipefail
T="${1:-}"; PUSH=0; [ "${2:-}" = "--push" ] && PUSH=1
case "$T" in staging) SRC=develop;; main) SRC=staging;; *) sed -n '2,6p' "$0"; exit 2;; esac
R="$(git rev-parse --show-toplevel)"; fail() { echo "ABORT: $*" >&2; exit 1; }
for b in "$SRC" "$T"; do git -C "$R" show-ref --verify --quiet "refs/heads/$b" || fail "branch $b missing"; done
HOLDER="$(git -C "$R" worktree list | grep -w "\[$T\]" | awk '{print $1}' || true)"
git -C "$R" merge-base --is-ancestor "$T" "$SRC" || fail "$T has commits that are not in $SRC — promotion must be a fast-forward; classify the divergence (MERGE_RUNBOOK.md §Divergence) before anything else"
FROM="$(git -C "$R" rev-parse "$T")"; TO="$(git -C "$R" rev-parse "$SRC")"
if [ "$FROM" = "$TO" ]; then echo "$T already at $SRC ($(git -C "$R" rev-parse --short "$TO"))"; else
  echo "--- $T will move $(git -C "$R" rev-parse --short "$FROM") → $(git -C "$R" rev-parse --short "$TO"):"; git -C "$R" log --oneline "$FROM".."$TO" | head -60
  if [ -n "$HOLDER" ]; then echo "worktree $HOLDER holds $T — fast-forwarding inside it"; git -C "$HOLDER" merge --ff-only "$SRC" || fail "ff-only merge failed inside $HOLDER"
  else git -C "$R" fetch . "$SRC:$T" || fail "ff update refused"; fi
  echo "$T now at $(git -C "$R" rev-parse --short "$T")   reflog: $(git -C "$R" reflog show "$T" -1)"
fi
if [ $PUSH = 1 ]; then
  [ "${LETBUYY_PROMOTE_CONFIRM:-}" = "$T" ] || fail "LETBUYY_PROMOTE_CONFIRM=$T is not set — the owner's word for THIS promotion is required in the same message"
  echo "attempting: git push origin refs/heads/$T:refs/heads/$T"
  if git -C "$R" push origin "refs/heads/$T:refs/heads/$T"; then echo "pushed. Record the Promotions row (date · source SHA · target · pushed · owner's word · CI run id)."
  else echo "push refused here (the harness denies agent pushes, or the remote is unreadable from this machine). OWNER COMMAND:"; echo "    git -C $R push origin refs/heads/$T:refs/heads/$T"; fi
else echo "push NOT done. After the owner's word: LETBUYY_PROMOTE_CONFIRM=$T bash $0 $T --push   — or the owner runs: git push origin refs/heads/$T:refs/heads/$T"; fi
