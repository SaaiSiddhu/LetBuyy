#!/usr/bin/env bash
# LetBuyy backend launcher — kill ports, then run all services/* workers.
# Ports are the canonical ones from scripts/dev/ports.mjs.
set -uo pipefail

# repo root (this file lives in scripts/dev/)
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# http: api-gateway 9010, mobile-bff 9011, webhook-service 9012, queue-workers 9013
# inspector: 9110-9113
PORTS=(9010 9011 9012 9013 9110 9111 9112 9113)

echo "▶ Killing backend ports: ${PORTS[*]}"
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

echo "▶ Starting services: api-gateway(9010) mobile-bff(9011) webhook-service(9012) queue-workers(9013)"
exec pnpm exec turbo run dev --concurrency=25 --filter=./services/*
