#!/usr/bin/env bash
# LCIS V2 — Setup script
# Usage: bash setup.sh
# Idempotent: safe to re-run at any time.
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${ROOT}/../.." && pwd)"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo "[lcis-setup] INFO  $*"; }
warn()  { echo "[lcis-setup] WARN  $*" >&2; }
error() { echo "[lcis-setup] ERROR $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Prerequisite checks
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

# Node >= 20
if ! command -v node &>/dev/null; then
  error "node is not installed. Install Node.js >= 20 from https://nodejs.org"
fi
NODE_MAJOR="$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  error "Node.js >= 20 required (found ${NODE_MAJOR}). Please upgrade."
fi
info "  node v$(node --version) — OK"

# Python 3
if ! command -v python3 &>/dev/null; then
  error "python3 is not installed. Install Python 3.10+ from https://python.org"
fi
info "  python3 $(python3 --version 2>&1 | awk '{print $2}') — OK"

# Docker (optional — warn only)
DOCKER_AVAILABLE=false
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  DOCKER_AVAILABLE=true
  info "  docker $(docker --version | awk '{print $3}' | tr -d ',') — OK"
else
  warn "docker not available or daemon not running — skipping infrastructure containers."
  warn "To run Qdrant and SigNoz locally, start Docker and re-run setup.sh."
fi

# pip3 (optional — warn only)
PIP_AVAILABLE=false
if command -v pip3 &>/dev/null; then
  PIP_AVAILABLE=true
  info "  pip3 $(pip3 --version | awk '{print $2}') — OK"
else
  warn "pip3 not found — Python dependencies will not be installed."
  warn "Install pip: https://pip.pypa.io/en/stable/installation/"
fi

# ---------------------------------------------------------------------------
# 2. Required environment variable checks
# ---------------------------------------------------------------------------
info "Checking environment variables..."

if [ -f "${ROOT}/.env" ]; then
  # shellcheck disable=SC1091
  set -o allexport && source "${ROOT}/.env" && set +o allexport
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  error "OPENAI_API_KEY is not set. Copy .env.example to .env and add your key."
fi
info "  OPENAI_API_KEY — set"

# Optional vars — report but do not fail
for VAR in QDRANT_URL QDRANT_API_KEY OTEL_EXPORTER_OTLP_ENDPOINT; do
  if [ -n "${!VAR:-}" ]; then
    info "  ${VAR} — set (${!VAR})"
  else
    warn "  ${VAR} — not set (will use default)"
  fi
done

# ---------------------------------------------------------------------------
# 3. npm install
# ---------------------------------------------------------------------------
info "Installing Node.js dependencies..."
cd "${ROOT}"
npm install --prefer-offline 2>&1 | tail -5
info "  npm install — done"

# ---------------------------------------------------------------------------
# 4. Python dependencies
# ---------------------------------------------------------------------------
if [ "${PIP_AVAILABLE}" = true ]; then
  info "Installing Python dependencies..."
  pip3 install -r "${ROOT}/graph-engine/graphrag/requirements.txt" \
    --quiet --disable-pip-version-check 2>&1 | tail -3 || \
    warn "graph-engine/graphrag/requirements.txt install failed — GraphRAG features unavailable."
  pip3 install -r "${ROOT}/knowledge-engine/crawlers/requirements.txt" \
    --quiet --disable-pip-version-check 2>&1 | tail -3 || \
    warn "knowledge-engine/crawlers/requirements.txt install failed — web crawl features unavailable."
  info "  Python dependencies — done"
else
  warn "Skipping Python dependencies (pip3 not available)."
fi

# ---------------------------------------------------------------------------
# 5. Docker infrastructure
# ---------------------------------------------------------------------------
if [ "${DOCKER_AVAILABLE}" = true ]; then
  info "Starting infrastructure containers (Qdrant, SigNoz stack)..."
  cd "${ROOT}"
  docker compose up -d qdrant signoz-otel-collector signoz-clickhouse 2>&1 | tail -10

  # Wait for Qdrant to become healthy (max 60s)
  info "Waiting for Qdrant to be ready..."
  QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
  WAITED=0
  until curl -sf "${QDRANT_URL}/healthz" &>/dev/null; do
    if [ "${WAITED}" -ge 60 ]; then
      warn "Qdrant did not become healthy within 60s — check 'docker compose logs qdrant'."
      break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
  done
  if curl -sf "${QDRANT_URL}/healthz" &>/dev/null; then
    info "  Qdrant — healthy at ${QDRANT_URL}"
  fi
else
  warn "Skipping Docker containers — start manually: docker compose up -d"
fi

# ---------------------------------------------------------------------------
# 6. Output directories
# ---------------------------------------------------------------------------
info "Creating output directories..."
GRAPHIFY_OUT="${REPO_ROOT}/graphify-out"
mkdir -p \
  "${GRAPHIFY_OUT}/knowledge-crawls" \
  "${GRAPHIFY_OUT}/browser-evidence" \
  "${GRAPHIFY_OUT}/graph-intelligence" \
  "${GRAPHIFY_OUT}/context-intelligence"
info "  graphify-out/ subdirectories — OK"

# ---------------------------------------------------------------------------
# 7. Memory initialisation
# ---------------------------------------------------------------------------
info "Initialising memory engine (indexAll)..."
cd "${ROOT}"
if node -e "import('./memory-engine/MemoryIndexer.mjs').then(m => m.indexAll()).then(() => process.exit(0)).catch(e => { console.warn('[lcis-setup] memory:init warning:', e.message); process.exit(0); })" 2>&1; then
  info "  Memory engine — initialised"
else
  warn "Memory engine initialisation returned non-zero — see above. Continuing."
fi

# ---------------------------------------------------------------------------
# 8. Done
# ---------------------------------------------------------------------------
cat <<EOF

╔══════════════════════════════════════════════════════════════╗
║  LCIS V2 — Setup complete                                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Start the intelligence API:                                 ║
║    cd tools/central-intelligence && npm start                ║
║                                                              ║
║  Quick health check:                                         ║
║    curl http://localhost:3334/intelligence/health | jq       ║
║                                                              ║
║  Ask a question (example):                                   ║
║    curl 'http://localhost:3334/intelligence/ask?q=what+breaks+if+payments+fail' | jq
║                                                              ║
║  SigNoz Observability UI:  http://localhost:3301             ║
║  Qdrant Dashboard:         http://localhost:6333/dashboard   ║
║  LCIS V1 (unchanged):      http://localhost:3333             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
