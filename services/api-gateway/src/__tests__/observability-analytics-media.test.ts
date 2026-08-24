import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('Task 016 analytics reads are in-monolith and backed by in-DB rollups', () => {
    const analyticsRoute = source('routes/analytics.ts');
    const indexSource = source('index.ts');
    const migration = repositorySource('database/supabase/migrations/154_executable_analytics_media_ai_seam.sql');
    const rollback = repositorySource('database/supabase/rollback/154_executable_analytics_media_ai_seam.rollback.sql');

    assert.match(indexSource, /api\.route\('\/analytics', analyticsRouter\)/);
    assert.match(indexSource, /LETBUYY_WAREHOUSE_MODE\?: 'sandbox' \| 'live'/);
    assert.match(analyticsRoute, /router\.get\('\/:site\/summary'/);
    assert.match(analyticsRoute, /commerce_analytics_daily_mv/);
    assert.match(analyticsRoute, /warehouseReadiness/);
    assert.match(analyticsRoute, /HR-WAREHOUSE-LIVE/);
    assert.match(analyticsRoute, /mode:\s*'sandbox'/);
    assert.doesNotMatch(analyticsRoute, /LETBUYY_WAREHOUSE_MODE \|\| 'mock'|mode:\s*'mock'/);
    assert.doesNotMatch(analyticsRoute, /analytics-pipeline/);

    assert.match(migration, /CREATE MATERIALIZED VIEW public\.commerce_analytics_daily_mv/);
    assert.match(migration, /public\.refresh_commerce_analytics_daily_mv/);
    assert.match(migration, /ALTER TABLE public\.analytics_rollups_daily FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /analytics_rollups_daily_tenant_site_guc/);
    assert.doesNotMatch(migration, /PARTITION BY/i);
    assert.match(rollback, /DROP MATERIALIZED VIEW IF EXISTS public\.commerce_analytics_daily_mv/);
});

test('Task 016 media module plans R2 upload intents and publishes media.processed through the outbox', () => {
    const mediaRoute = source('routes/media.ts');
    const storageAdapter = repositorySource('packages/infrastructure/storage-adapter/index.ts');
    const eventCore = repositorySource('packages/event-core/src/index.ts');
    const queueProjectionPlans = repositorySource('packages/event-core/src/queue-projection-plans.ts');
    const migration = repositorySource('database/supabase/migrations/154_executable_analytics_media_ai_seam.sql');

    assert.match(mediaRoute, /router\.post\('\/signed-upload'/);
    assert.match(mediaRoute, /planSignedR2UploadIntent/);
    assert.match(mediaRoute, /\.from\('media_assets'\)/);
    assert.match(mediaRoute, /media\.processed/);
    assert.match(mediaRoute, /EventExecutionAdapter/);
    assert.doesNotMatch(mediaRoute, /media-service/);

    // Phase D2: the signing machinery is deleted, not merely unused -- nothing
    // ever verified it (routes/upload.ts, the only live upload path, never
    // read the token), so it read as an authorization boundary and enforced
    // nothing (ANTI-R9). Proves the deletion, not just that the route exists.
    assert.doesNotMatch(mediaRoute, /signUploadIntent/);
    assert.doesNotMatch(mediaRoute, /mediaUploadSigningSecret/);
    assert.doesNotMatch(mediaRoute, /hmacSha256Hex/);
    assert.doesNotMatch(mediaRoute, /upload_token_hash/);
    assert.doesNotMatch(mediaRoute, /MEDIA_UPLOAD_SIGNING_SECRET/);

    assert.match(storageAdapter, /export function planSignedR2UploadIntent/);
    assert.match(storageAdapter, /export function mediaAssetTypeForContent/);
    assert.match(eventCore, /'media\.processed'/);
    assert.match(eventCore, /activeGatewayContract\('media\.processed', 'media'/);
    assert.match(queueProjectionPlans, /media\.processed/);
    assert.match(queueProjectionPlans, /media\.size_bytes/);
    assert.match(migration, /ALTER TABLE public\.media_assets[\s\S]*ADD COLUMN IF NOT EXISTS site_id/);
    assert.match(migration, /ALTER TABLE public\.media_assets FORCE ROW LEVEL SECURITY/);
});

test('Task 016 AI seam is explicit and does not wire a model call', () => {
    const aiRoute = source('routes/ai.ts');
    const aiAdapter = repositorySource('packages/infrastructure/ai-generation-adapter/index.ts');
    const migration = repositorySource('database/supabase/migrations/154_executable_analytics_media_ai_seam.sql');
    const humanRequired = repositorySource('EXECUTABLE_HUMAN_REQUIRED.md');
    const liveSkips = repositorySource('tests/executable/human-required-live-paths.test.mjs');

    assert.match(aiRoute, /router\.get\('\/seam'/);
    assert.match(aiRoute, /createAiCapabilitySeam/);
    assert.match(aiRoute, /HR-AI-MODEL-LIVE/);
    assert.match(aiAdapter, /export function createAiCapabilitySeam/);
    assert.match(aiAdapter, /modelCallsEnabled:\s*false/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_capability_seams/);
    assert.match(migration, /ai_capability_seams_no_model_calls_check/);
    assert.match(humanRequired, /HR-WAREHOUSE-LIVE/);
    assert.match(humanRequired, /HR-AI-MODEL-LIVE/);
    assert.match(liveSkips, /\[HUMAN-REQUIRED] HR-WAREHOUSE-LIVE/);
    assert.match(liveSkips, /\[HUMAN-REQUIRED] HR-AI-MODEL-LIVE/);
});
