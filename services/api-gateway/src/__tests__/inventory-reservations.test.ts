import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()
const routeSource = readFileSync(join(repoRoot, 'services/api-gateway/src/routes/inventory.ts'), 'utf8')
const commerceCoreSource = readFileSync(join(repoRoot, 'packages/commerce-core/src/index.ts'), 'utf8')
const migrationSource = readFileSync(join(repoRoot, 'database/supabase/migrations/141_executable_inventory_reservations.sql'), 'utf8')
const rollbackSource = readFileSync(join(repoRoot, 'database/supabase/rollback/141_executable_inventory_reservations.rollback.sql'), 'utf8')

test('Task 006 inventory migration adds optimistic reservation RPCs, versioning, tenant RLS, and rollback', () => {
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public\.sites/)
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1/)
    assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.reserve_inventory/)
    assert.match(migrationSource, /FOR UPDATE/)
    assert.match(migrationSource, /INSUFFICIENT_INVENTORY/)
    assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.commit_inventory_reservation/)
    assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.release_inventory_reservation/)
    assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.expire_inventory_reservations/)
    assert.match(migrationSource, /'inventory_levels', 'inventory_locations', 'inventory_reservations'/)
    assert.match(migrationSource, /FORCE ROW LEVEL SECURITY/)
    assert.match(migrationSource, /store_id = public\.current_site_id\(\)/)
    assert.match(rollbackSource, /DROP FUNCTION IF EXISTS public\.reserve_inventory/)
})

test('Task 006 inventory route exposes reserve, commit, release APIs and emits catalog events', () => {
    assert.match(routeSource, /router\.post\('\/reserve'/)
    assert.match(routeSource, /router\.post\('\/commit'/)
    assert.match(routeSource, /router\.post\('\/release'/)
    assert.match(routeSource, /inventory\.reserved/)
    assert.match(routeSource, /inventory\.committed/)
    assert.match(routeSource, /inventory\.released/)
    assert.match(routeSource, /verifySiteOwnership/)
})

test('Task 006 commerce-core exports reservation schemas', () => {
    assert.match(commerceCoreSource, /ReserveInventorySchema/)
    assert.match(commerceCoreSource, /InventoryReservationActionSchema/)
    assert.match(commerceCoreSource, /ReserveInventoryInput/)
    assert.match(commerceCoreSource, /InventoryReservationActionInput/)
})
