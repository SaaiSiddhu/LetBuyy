#!/usr/bin/env bash
# LetBuyy dev launcher — kill ports, then run merchant + identity + storybook.
# Ports are the canonical ones from scripts/dev/ports.mjs.
set -uo pipefail

# repo root (this file lives in scripts/dev/)
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PORTS=(9001 9002 9009)   # merchant-control-plane, identity-platform, @letbuyy/ui storybook

echo "▶ Killing ports: ${PORTS[*]}"
for p in "${PORTS[@]}"; do
  pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  • :$p busy → killing $pids"
    kill -9 $pids 2>/dev/null || true
  else
    echo "  • :$p free"
  fi
done

echo "▶ Generating local env files (only creates missing ones)"
node scripts/dev/setup-local-env.mjs

echo "▶ Starting: merchant (9001) + identity (9002) + storybook (9009)"
exec pnpm exec turbo run dev --concurrency=25 \
  --filter=@letbuyy/merchant-control-plane \
  --filter=@letbuyy/identity-platform \
  --filter=@letbuyy/ui
