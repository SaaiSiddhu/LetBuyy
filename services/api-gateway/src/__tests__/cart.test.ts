import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()
const cartRouteSource = readFileSync(join(repoRoot, 'services/api-gateway/src/routes/storefront/cart-routes.ts'), 'utf8')
const cartMigrationSource = readFileSync(join(repoRoot, 'database/supabase/migrations/156_executable_cart_channel_handoff.sql'), 'utf8')
const cartRollbackSource = readFileSync(join(repoRoot, 'database/supabase/rollback/156_executable_cart_channel_handoff.rollback.sql'), 'utf8')
const sharedTypesSource = readFileSync(join(repoRoot, 'packages/shared-types/src/index.ts'), 'utf8')

test('Task 002 cart migration adds channel, buyer identity, checkout handoff, abandonment marker, and tenant GUC RLS', () => {
    assert.match(cartMigrationSource, /ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web'/)
    assert.match(cartMigrationSource, /ADD COLUMN IF NOT EXISTS buyer_email text/)
    assert.match(cartMigrationSource, /ADD COLUMN IF NOT EXISTS checkout_handoff jsonb/)
    assert.match(cartMigrationSource, /ADD COLUMN IF NOT EXISTS abandonment_enqueued_at timestamptz/)
    assert.match(cartMigrationSource, /ALTER TABLE public\.carts FORCE ROW LEVEL SECURITY/)
    assert.match(cartMigrationSource, /store_id = public\.current_site_id\(\)/)
    assert.match(cartRollbackSource, /DROP COLUMN IF EXISTS channel/)
})

test('Task 002 storefront cart route exposes buyer identity, discount code, signed checkout URL, events, and abandonment enqueue', () => {
    assert.match(cartRouteSource, /buyer_email/)
    assert.match(cartRouteSource, /CommerceChannelSchema/)
    assert.match(cartRouteSource, /cart\.created/)
    assert.match(cartRouteSource, /cart\.email_captured/)
    assert.match(cartRouteSource, /cart\.abandoned/)
    assert.match(cartRouteSource, /platform_queue_jobs/)
    assert.match(cartRouteSource, /cart\.abandonment_check/)
    assert.match(cartRouteSource, /hmacSha256Hex/)
    assert.match(cartRouteSource, /cartToken\/buyer-identity/)
    assert.match(cartRouteSource, /cartToken\/discount-codes/)
    assert.match(cartRouteSource, /cartToken\/checkout-url/)
})

test('Task 002 shared cart contract carries channel and buyer email', () => {
    assert.match(sharedTypesSource, /channel: CommerceChannelSchema/)
    assert.match(sharedTypesSource, /buyer_email: EmailSchema\.optional\(\)\.nullable\(\)/)
})
