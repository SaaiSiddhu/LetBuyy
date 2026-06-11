import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../routes/shipping-labels.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/118_mobile_shipping_labels.sql', import.meta.url), 'utf8');

test('merchant shipping label route is mounted and mobile allowlisted', () => {
    assert.match(indexSource, /import shippingLabelsRouter from '\.\/routes\/shipping-labels'/);
    assert.match(indexSource, /api\.route\('\/shipping\/labels', shippingLabelsRouter\)/);
    assert.match(bffSource, /'\/v1\/shipping\/labels'/);
});

test('merchant shipping label route supports rates, buy, PDF, and void over owned orders', () => {
    assert.match(routeSource, /router\.post\('\/rates'/);
    assert.match(routeSource, /router\.post\('\/'/);
    assert.match(routeSource, /router\.get\('\/:id\/pdf'/);
    assert.match(routeSource, /router\.post\('\/:id\/void'/);
    assert.match(routeSource, /resolveTenantContextForOrder\(c,\s*orderId\)/);
    assert.match(routeSource, /createLogisticsProvider/);
    assert.match(routeSource, /isLogisticsLiveProviderUnavailableError/);
    assert.match(routeSource, /CARRIER_SETUP_REQUIRED/);
    assert.match(routeSource, /liveLogisticsProviderAvailable/);
    assert.match(routeSource, /R2_BUCKET\.put/);
    assert.match(routeSource, /pdf_base64/);
});

test('shipping label migration is tenant-scoped with RLS and approved updated_at trigger', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.shipping_labels/);
    assert.match(migrationSource, /site_id uuid NOT NULL REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /ALTER TABLE public\.shipping_labels ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /FOR ALL TO service_role/);
    assert.match(migrationSource, /FOR ALL TO authenticated/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
});
