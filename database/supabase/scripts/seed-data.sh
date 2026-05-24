#!/usr/bin/env bash
# ============================================================
# seed-data.sh
# Seed Supabase database with initial/demo data
# ============================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────
SUPABASE_URL="${SUPABASE_URL:?Set SUPABASE_URL env var}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY env var}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_DIR="${SCRIPT_DIR}/../seeds"

echo "╔════════════════════════════════════════════╗"
echo "║  LetBuyy — Database Seeder                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "  Supabase URL: $SUPABASE_URL"
echo "  Seed Dir:     $SQL_DIR"
echo ""

# ─── Check prerequisites ─────────────────────────────────
if ! command -v psql &> /dev/null; then
    echo "⚠ psql not found. Install PostgreSQL client tools."
    echo "  brew install postgresql (macOS)"
    echo "  Alternatively, paste seed SQL into Supabase Dashboard → SQL Editor"
    exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "⚠ DATABASE_URL not set."
    echo "  Find it in Supabase Dashboard → Settings → Database → Connection string"
    echo "  Example: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
    exit 1
fi

# ─── Run seed files ──────────────────────────────────────
echo "🌱 Running seed files..."

for seed_file in "$SQL_DIR"/*.sql; do
    if [ -f "$seed_file" ]; then
        filename=$(basename "$seed_file")
        echo "  → $filename"
        psql "$DATABASE_URL" -f "$seed_file" 2>&1 | head -5
        echo ""
    fi
done

# ─── Verify seed ─────────────────────────────────────────
echo "✅ Verifying seed data..."

TABLES=("employee_permissions" "user_profiles" "sites")
for table in "${TABLES[@]}"; do
    COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/${table}?select=id" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Prefer: count=exact" \
        -I 2>/dev/null | grep -i content-range | awk -F'/' '{print $2}' || echo "?")
    echo "  → $table: $COUNT rows"
done

echo ""
echo "🎉 Seed complete!"
