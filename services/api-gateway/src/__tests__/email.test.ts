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

test('Task 011 email route renders and sends through the monolith with sandbox ESP failover', () => {
    const routeSource = source('routes/email.ts');
    const indexSource = source('index.ts');
    const coreSource = repoSource('packages/notification-core/src/index.ts');
    const eventSource = repoSource('packages/event-core/src/index.ts');
    const migrationSource = repoSource('database/supabase/migrations/149_executable_email_delivery.sql');
    const rollbackSource = repoSource('database/supabase/rollback/149_executable_email_delivery.rollback.sql');

    assert.match(indexSource, /import emailRouter from '\.\/routes\/email'/);
    assert.match(indexSource, /api\.route\('\/email',\s*emailRouter\)/);
    assert.match(routeSource, /router\.post\('\/render',\s*validate\('json',\s*EmailRenderSchema\)/);
    assert.match(routeSource, /router\.post\('\/send',\s*validate\('json',\s*EmailSendSchema\)/);
    assert.match(routeSource, /renderEmailTemplate/);
    assert.match(routeSource, /planEmailProviderFailover/);
    assert.match(routeSource, /\.from\('email_suppressions'\)/);
    assert.match(routeSource, /\.from\('sender_domains'\)/);
    assert.match(routeSource, /\.from\('email_logs'\)/);
    assert.match(routeSource, /email\.delivered/);
    assert.match(routeSource, /email\.bounced/);
    assert.match(routeSource, /\[HUMAN-REQUIRED\] HR-ESP-LIVE/);
    assert.match(routeSource, /liveEmailProviderDispatchAvailable/);
    assert.match(routeSource, /EMAIL_PROVIDER_SETUP_REQUIRED/);
    assert.doesNotMatch(routeSource, /notification-service/);

    assert.match(coreSource, /export const EmailRenderSchema/);
    assert.match(coreSource, /export const EmailSendSchema/);
    assert.match(coreSource, /export function renderEmailTemplate/);
    assert.match(coreSource, /export function planEmailProviderFailover/);
    assert.match(coreSource, /sandbox_resend/);
    assert.doesNotMatch(coreSource, /mock_resend|mock_ses|mock_sendgrid/);
    assert.match(routeSource, /email_sandbox_/);
    assert.doesNotMatch(routeSource, /mock_failed_providers|provider_message_id:\s*delivery\.provider \? `mock_/);
    assert.match(eventSource, /'email\.delivered'/);
    assert.match(eventSource, /'email\.bounced'/);
    assert.match(eventSource, /'email\.complained'/);

    assert.match(migrationSource, /ALTER TABLE public\.email_logs[\s\S]*ADD COLUMN IF NOT EXISTS site_id/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.email_suppressions/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.sender_domains/);
    assert.match(migrationSource, /ALTER TABLE public\.email_logs FORCE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /public\.current_site_id\(\)/);
    assert.doesNotMatch(migrationSource, /PARTITION BY/i);
    assert.match(rollbackSource, /DROP TABLE IF EXISTS public\.sender_domains/);
    assert.match(rollbackSource, /DROP COLUMN IF EXISTS site_id/);
});
