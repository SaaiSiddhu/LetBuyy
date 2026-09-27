#!/usr/bin/env bash
# LetBuyy backend launcher — attribute occupied ports before touching them, then
# run all services/* workers. Ports are the canonical ones from scripts/dev/ports.mjs.
set -uo pipefail

# repo root (this file lives in scripts/dev/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# http: api-gateway 9010, mobile-bff 9011, webhook-service 9012, queue-workers 9013
# inspector: 9110-9113
PORTS=(9010 9011 9012 9013 9110 9111 9112 9113)

# --- Node version contract -------------------------------------------------
# wrangler (services/api-gateway/node_modules/wrangler) declares engines.node
# ">=22.0.0" — a HARD requirement, unlike the Next apps' .nvmrc preference
# (dev-up.sh). Check the ambient `node` explicitly rather than letting wrangler
# fail deep inside its own CLI with a less actionable error.
if ! command -v node >/dev/null 2>&1; then
  echo "✖ No \`node\` on PATH. wrangler needs Node >=22.0.0 (services/api-gateway/node_modules/wrangler/package.json)." >&2
  exit 1
fi
NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "✖ Ambient \`node\` is $(node -v) ($(command -v node)); wrangler needs >=22.0.0." >&2
  echo "  Install it: brew install node@22, then put it first on PATH for this shell." >&2
  exit 1
fi
echo "▶ Workers will run on Node $(node -v) ($(command -v node))"

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

echo "▶ Starting services: api-gateway(9010) mobile-bff(9011) webhook-service(9012) queue-workers(9013)"
exec pnpm exec turbo run dev --concurrency=25 --filter=./services/*
