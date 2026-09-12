#!/usr/bin/env bash
# gate-diff.sh — compare two gate runs by SET, not by count.
#
# Usage: bash .claude/skills/letbuyy/scripts/gate-diff.sh <baseOUT> <headOUT>
#
# WHY THIS EXISTS. "A gate COUNT is not a gate SET" is this programme's oldest evidence rule, and it
# was enforced by hand-rolled greps in every phase. Two of those hands were wrong: a validator-log
# heuristic once reported a validator as failing when its own log said it passed, and a `^✖ `
# extraction once missed the INDENTED ✖ that node:test emits for a nested subtest. gate.sh now writes
# both sets itself — the validator half straight from each validator's exit code — and this script
# only diffs them.
#
# It also refuses on an EMPTY head set, because that is the shape of the trap F-GATEGUARD-1 closed:
# when the test lanes cannot start, they emit no ✖ at all, and a naive diff then reports every known
# failure as fixed. An empty set is almost never an improvement; it is almost always a run that did
# not happen.
set -uo pipefail
BASE="${1:-}"; HEAD="${2:-}"
if [ -z "$BASE" ] || [ -z "$HEAD" ]; then
  echo "usage: gate-diff.sh <baseOUT> <headOUT>" >&2; exit 2
fi
rc=0
for set in failing-tests failing-validators; do
  b="$BASE/$set.txt"; h="$HEAD/$set.txt"
  if [ ! -f "$b" ] || [ ! -f "$h" ]; then
    echo "gate-diff: $set.txt missing (base:$([ -f "$b" ] && echo ok || echo MISSING) head:$([ -f "$h" ] && echo ok || echo MISSING)) — was the run made by a gate.sh older than F-GATEDIFF-1?" >&2
    rc=2; continue
  fi
  bn=$(wc -l < "$b" | tr -d ' '); hn=$(wc -l < "$h" | tr -d ' ')
  if [ "$bn" -gt 0 ] && [ "$hn" -eq 0 ]; then
    echo "gate-diff: REFUSING $set — base has $bn names and head has 0. A lane that cannot start emits no failures;" >&2
    echo "           that reads as every failure fixed. Check the head run actually ran before believing this." >&2
    rc=2; continue
  fi
  if diff -q "$b" "$h" >/dev/null; then
    echo "$set: IDENTICAL ($hn names)"
  else
    echo "$set: DELTA"
    comm -13 "$b" "$h" | sed 's/^/  NEW at head:  /'
    comm -23 "$b" "$h" | sed 's/^/  GONE at head: /'
    rc=1
  fi
done
exit $rc
