#!/usr/bin/env bash
# LetBuyy dev launcher — attribute occupied ports before touching them, then run
# merchant + identity + storybook. Ports are the canonical ones from scripts/dev/ports.mjs.
set -uo pipefail

# repo root (this file lives in scripts/dev/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PORTS=(9001 9002 9009)   # merchant-web, identity-platform, @letbuyy/ui storybook

# --- Node version contract -------------------------------------------------
# .nvmrc pins the Next/Storybook process group. No nvm/volta/asdf is assumed to
# be installed, so this looks for a matching Homebrew keg explicitly instead of
# silently running Next.js under whichever `node` happens to be ambient on PATH
# (wrangler-based services want a different major — see dev-backend.sh).
PINNED_NODE_MAJOR="$(tr -d '[:space:]' < "$REPO_ROOT/.nvmrc")"
PINNED_NODE_BIN=""
for c in "/opt/homebrew/opt/node@${PINNED_NODE_MAJOR}/bin" "/usr/local/opt/node@${PINNED_NODE_MAJOR}/bin"; do
  if [ -x "$c/node" ]; then PINNED_NODE_BIN="$c"; break; fi
done
if [ -z "$PINNED_NODE_BIN" ]; then
  echo "✖ .nvmrc pins Node ${PINNED_NODE_MAJOR}, but no matching Homebrew keg was found at:" >&2
  echo "    /opt/homebrew/opt/node@${PINNED_NODE_MAJOR}/bin/node" >&2
  echo "    /usr/local/opt/node@${PINNED_NODE_MAJOR}/bin/node" >&2
  echo "  Install it: brew install node@${PINNED_NODE_MAJOR}" >&2
  echo "  (Not falling back to the ambient \$(command -v node) — that would silently run Next.js on the wrong major.)" >&2
  exit 1
fi
echo "▶ Next/Storybook will run on Node $("$PINNED_NODE_BIN/node" -v) ($PINNED_NODE_BIN)"
export PATH="$PINNED_NODE_BIN:$PATH"

# --- Occupied-port handling: attribute before touching, never blind-kill ---
for p in "${PORTS[@]}"; do
  pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "  • :$p free"
    continue
  fi
  for pid in $pids; do
    cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | tail -1)"
    case "$cwd" in
      "$REPO_ROOT"/*)
        echo "  • :$p busy → PID $pid ($cmd) cwd=$cwd — same checkout, restarting it"
        kill -9 "$pid" 2>/dev/null || true
        ;;
      *)
        echo "✖ :$p is occupied by PID $pid, which this script cannot attribute to this checkout:" >&2
        echo "    command: ${cmd:-<unavailable>}" >&2
        echo "    cwd:     ${cwd:-<unknown — process exited between the check and now, or permission denied>}" >&2
        echo "  Refusing to kill a process it did not start and cannot prove ownership of." >&2
        echo "  Stop it yourself if it is stale, or investigate what owns :$p first." >&2
        exit 1
        ;;
    esac
  done
done

echo "▶ Generating local env files (only creates missing ones)"
node scripts/dev/setup-local-env.mjs

echo "▶ Starting: merchant (9001) + identity (9002) + storybook (9009)"
exec pnpm exec turbo run dev --concurrency=25 \
  --filter=@letbuyy/merchant-web \
  --filter=@letbuyy/identity-platform \
  --filter=@letbuyy/ui
