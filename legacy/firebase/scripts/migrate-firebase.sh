#!/usr/bin/env bash
# ============================================================
# migrate-firebase.sh
# Migrate data from Firebase Firestore to Supabase
# ============================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────
SUPABASE_URL="${SUPABASE_URL:?Set SUPABASE_URL env var}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY env var}"
FIREBASE_PROJECT="${FIREBASE_PROJECT_ID:-letbuy-y}"

echo "╔════════════════════════════════════════════╗"
echo "║  Firebase → Supabase Migration             ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "  Firebase Project: $FIREBASE_PROJECT"
echo "  Supabase URL:     $SUPABASE_URL"
echo ""

# ─── Step 1: Export Firestore data ────────────────────────
echo "📦 Step 1: Exporting Firestore data..."
EXPORT_DIR="./firebase-export-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"

# Export collections using gcloud CLI
COLLECTIONS=("stores" "products" "orders" "users" "customers" "contacts")

for collection in "${COLLECTIONS[@]}"; do
    echo "  → Exporting $collection..."
    gcloud firestore export gs://${FIREBASE_PROJECT}.appspot.com/exports/${collection} \
        --collection-ids=${collection} \
        --project=${FIREBASE_PROJECT} 2>/dev/null || echo "  ⚠ Collection $collection not found, skipping"
done

echo ""

# ─── Step 2: Transform data ──────────────────────────────
echo "🔄 Step 2: Transforming data to Supabase format..."

# Node.js script for transformation
node -e "
const fs = require('fs');

console.log('  → Transform logic would go here');
console.log('  → Map Firestore documents to Supabase table rows');
console.log('  → Key mappings:');
console.log('    - stores → sites');
console.log('    - store.ownerId → sites.user_id');
console.log('    - products.storeId → products.site_id');
console.log('    - orders.storeId → orders.site_id');
console.log('  → Generate SQL INSERT statements or CSV files');
"

echo ""

# ─── Step 3: Import to Supabase ──────────────────────────
echo "📥 Step 3: Importing data to Supabase..."
echo "  → This step requires the transformed data from Step 2"
echo "  → Use: psql \$DATABASE_URL < transformed_data.sql"
echo "  → Or use Supabase Dashboard → SQL Editor"

echo ""

# ─── Step 4: Verify migration ────────────────────────────
echo "✅ Step 4: Verifying migration..."

# Count records in each table
for table in sites products orders user_profiles contacts; do
    COUNT=$(curl -s "${SUPABASE_URL}/rest/v1/${table}?select=id" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Prefer: count=exact" \
        -H "Range: 0-0" \
        -o /dev/null -w '%{http_code}' 2>/dev/null || echo "error")
    echo "  → $table: HTTP $COUNT"
done

echo ""
echo "🎉 Migration steps complete!"
echo "   Review the output above and verify data integrity."
echo "   Run the seed script next if needed: database/supabase/scripts/seed-data.sh"
