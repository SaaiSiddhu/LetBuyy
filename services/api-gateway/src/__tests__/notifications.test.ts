import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repoRoot = join(srcRoot, '..', '..', '..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repoSource(path: string): string {
    return readFileSync(join(repoRoot, path), 'utf8');
}

test('merchant mobile device-token registration is user-scoped and idempotent', () => {
    const routeSource = source('routes/notifications.ts');

    assert.match(routeSource, /router\.post\('\/device-tokens',\s*validate\('json',\s*DeviceTokenRegistrationSchema\)/);
    assert.match(routeSource, /DeviceTokenRegistrationSchema[\s\S]*token:\s*z\.string\(\)\.trim\(\)\.min\(8\)\.max\(4096\)/);
    assert.match(routeSource, /platform:\s*DeviceTokenPlatformSchema/);
    assert.match(routeSource, /\.from\('device_tokens'\)\s*[\s\S]*\.upsert\(/);
    assert.match(routeSource, /user_id:\s*auth\.user\.id/);
    assert.match(routeSource, /onConflict:\s*'user_id,token'/);
    assert.doesNotMatch(routeSource, /user_id:\s*body\.user_id/);
});

test('merchant mobile device-token removal is scoped to the authenticated user', () => {
    const routeSource = source('routes/notifications.ts');
    const deleteBlock = routeSource.slice(
        routeSource.indexOf("router.delete('/device-tokens'"),
        routeSource.indexOf("// POST /notifications/email-log"),
    );

    assert.match(routeSource, /router\.delete\('\/device-tokens',\s*validate\('json',\s*DeviceTokenDeleteSchema\)/);
    assert.match(deleteBlock, /\.from\('device_tokens'\)\s*[\s\S]*\.delete\(\)\s*[\s\S]*\.eq\('user_id',\s*auth\.user\.id\)\s*[\s\S]*\.eq\('token',\s*body\.token\)/);
    assert.doesNotMatch(deleteBlock, /\.single\(\)/);
});

test('Task 010 notification router sends through the monolith with suppression and outbox events', () => {
    const routeSource = source('routes/notifications.ts');
    const coreSource = repoSource('packages/notification-core/src/index.ts');
    const migrationSource = repoSource('database/supabase/migrations/148_executable_notifications_router.sql');
    const rollbackSource = repoSource('database/supabase/rollback/148_executable_notifications_router.rollback.sql');

    assert.match(routeSource, /router\.post\('\/send',\s*validate\('json',\s*NotificationSendSchema\)/);
    assert.match(routeSource, /planNotificationRoute/);
    assert.match(routeSource, /\.from\('notification_suppressions'\)/);
    assert.match(routeSource, /\.from\('notification_preferences'\)/);
    assert.match(routeSource, /\.from\('notification_logs'\)/);
    assert.match(routeSource, /notification\.sent/);
    assert.match(routeSource, /notification\.failed/);
    assert.match(coreSource, /'whatsapp', 'sms', 'email', 'push', 'in_app'/);
    assert.match(coreSource, /export function planNotificationRoute/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.notification_logs/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.notification_suppressions/);
    assert.match(migrationSource, /ALTER TABLE public\.notification_logs FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /public\.current_site_id\(\)/);
    assert.doesNotMatch(migrationSource, /PARTITION BY/i);
    assert.match(rollbackSource, /DROP TABLE IF EXISTS public\.notification_logs/);
});

test('merchant notification delivery logs expose push failures by owned site', () => {
    const routeSource = source('routes/notifications.ts');
    const deliveryLogBlock = routeSource.slice(
        routeSource.indexOf("router.get('/delivery-logs'"),
        routeSource.indexOf("// GET /notifications/webhooks"),
    );

    assert.match(deliveryLogBlock, /router\.get\('\/delivery-logs',\s*validate\('query',\s*DeliveryLogQuerySchema\)/);
    assert.match(deliveryLogBlock, /const siteId = filters\.site_id \|\| auth\.user\.storeId/);
    assert.match(deliveryLogBlock, /verifyOptionalStoreOwnership\(db,\s*auth\.user,\s*siteId\)/);
    assert.match(deliveryLogBlock, /\.from\('notification_logs'\)/);
    assert.match(deliveryLogBlock, /\.eq\('site_id',\s*siteId\)/);
    assert.match(deliveryLogBlock, /\.eq\('channel',\s*channel\)/);
    assert.match(deliveryLogBlock, /\.eq\('status',\s*status\)/);
    assert.match(deliveryLogBlock, /paginated\(data \|\| \[\],\s*count \|\| 0,\s*page,\s*limit\)/);
});

test('Task 010 webhook subscription CRUD is merchant scoped and webhook-service signs timestamp and nonce', () => {
    const routeSource = source('routes/notifications.ts');
    const webhookDispatchSource = repoSource('services/webhook-service/src/app-lifecycle-dispatch.ts');
    const migrationSource = repoSource('database/supabase/migrations/148_executable_notifications_router.sql');

    assert.match(routeSource, /router\.get\('\/webhooks'/);
    assert.match(routeSource, /router\.post\('\/webhooks',\s*validate\('json',\s*WebhookCreateSchema\)/);
    assert.match(routeSource, /router\.patch\('\/webhooks\/:id',\s*validate\('json',\s*WebhookUpdateSchema\)/);
    assert.match(routeSource, /router\.delete\('\/webhooks\/:id'/);
    assert.match(routeSource, /verifyOptionalStoreOwnership/);
    assert.match(routeSource, /isValidWebhookTarget/);
    assert.match(routeSource, /createWebhookSigningSecret/);
    assert.match(webhookDispatchSource, /X-LetBuyy-Timestamp/);
    assert.match(webhookDispatchSource, /X-LetBuyy-Nonce/);
    assert.match(webhookDispatchSource, /X-LetBuyy-Hmac-SHA256/);
    assert.match(migrationSource, /replay_window_seconds/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS nonce text/);
    assert.match(migrationSource, /webhook_deliveries_site_status_nonce_idx/);
});
