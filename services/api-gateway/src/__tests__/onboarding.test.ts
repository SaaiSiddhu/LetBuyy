import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(testDir, '..');
const repositoryRoot = join(testDir, '../../../..');

function source(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8');
}

function repositorySource(path: string): string {
    return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('mobile onboarding progress persists merchant wizard answers to onboarding_attempts', () => {
    const routeSource = source('routes/onboarding.ts');

    assert.match(routeSource, /MobileOnboardingProgressSchema/);
    assert.match(routeSource, /router\.post\('\/mobile-progress',\s*validate\('json',\s*MobileOnboardingProgressSchema\)/);
    assert.match(routeSource, /business_type:\s*body\.business_type/);
    assert.match(routeSource, /channels:\s*body\.channels/);
    assert.match(routeSource, /product_type:\s*body\.product_type/);
    assert.match(routeSource, /category:\s*body\.category/);
    assert.match(routeSource, /\.from\('onboarding_attempts'\)\s*[\s\S]*\.eq\('user_id',\s*customUser\.id\)/);
    assert.match(routeSource, /current_step:\s*5/);
    assert.match(routeSource, /completed_steps:\s*\[1,\s*2,\s*3,\s*4\]/);
});

test('Identity web onboarding uses account-bound canonical draft routes and atomic persistence RPCs', () => {
    const routeSource = source('routes/onboarding.ts');
    assert.match(routeSource, /router\.get\('\/web-draft'/);
    assert.match(routeSource, /router\.put\('\/web-draft',\s*validate\('json',\s*StorefrontWebOnboardingDraftSchema\)/);
    assert.match(routeSource, /\.eq\('user_id',\s*customUser\.id\)/);
    assert.match(routeSource, /\.contains\('survey_data',\s*\{\s*web_draft:\s*\{\s*\}\s*\}\)/);
    assert.match(routeSource, /rpc\('save_storefront_web_onboarding_draft'/);
    assert.match(routeSource, /p_channels:\s*body\.channels/);
    assert.match(routeSource, /rpc\('complete_storefront_web_onboarding_draft'/);

    const migration = repositorySource('database/supabase/migrations/283_storefront_web_onboarding_draft.sql');
    const rollback = repositorySource('database/supabase/rollback/283_storefront_web_onboarding_draft.rollback.sql');
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /SET search_path = pg_catalog, public, pg_temp/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.save_storefront_web_onboarding_draft[^;]+FROM PUBLIC, anon, authenticated/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.complete_storefront_web_onboarding_draft/);
    assert.match(rollback, /DROP FUNCTION IF EXISTS public\.save_storefront_web_onboarding_draft/);

    const channelsMigration = repositorySource('database/supabase/migrations/284_storefront_web_onboarding_channels.sql');
    const channelsRollback = repositorySource('database/supabase/rollback/284_storefront_web_onboarding_channels.rollback.sql');
    assert.match(channelsMigration, /p_channels text\[\]/);
    assert.match(channelsMigration, /Invalid sales channel selection/);
    assert.match(channelsMigration, /'channels', to_jsonb\(v_channels\)/);
    assert.match(channelsMigration, /REVOKE ALL ON FUNCTION public\.save_storefront_web_onboarding_draft\(uuid, integer, text, text, text, text\[\]\)/);
    assert.match(channelsRollback, /DROP FUNCTION IF EXISTS public\.save_storefront_web_onboarding_draft\(uuid, integer, text, text, text, text\[\]\)/);
    assert.match(channelsRollback, /p_industry text/);
    assert.doesNotMatch(channelsRollback, /p_channels text\[\]/);

    const completionMigration = repositorySource('database/supabase/migrations/285_storefront_web_onboarding_completion_status.sql');
    const completionRollback = repositorySource('database/supabase/rollback/285_storefront_web_onboarding_completion_status.rollback.sql');
    assert.match(completionMigration, /UPDATE public\.onboarding_attempts[\s\S]*status = 'completed'/);
    assert.doesNotMatch(completionMigration.replace(/^--.*$/gm, ''), /user_profiles|onboarding_completed/);
    assert.match(completionRollback, /CREATE OR REPLACE FUNCTION public\.complete_storefront_web_onboarding_draft/);
    assert.match(completionRollback, /SET onboarding_completed = true/);
});

test('both storefront creation paths require a persisted verified merchant email', () => {
    const userResolver = source('lib/auth-user.ts');
    const stores = source('routes/stores.ts');
    const onboarding = source('routes/onboarding.ts');

    assert.match(userResolver, /\.select\('id, email, full_name, email_verified'\)/);
    assert.match(stores, /customUser\.email_verified !== true[\s\S]*EMAIL_VERIFICATION_REQUIRED/);
    assert.match(onboarding, /customUser\.email_verified !== true[\s\S]*EMAIL_VERIFICATION_REQUIRED/);
});

test('onboarding progress migration adds executable columns and statuses', () => {
    const migration = repositorySource('database/supabase/migrations/114_mobile_onboarding_attempt_progress.sql');

    assert.match(migration, /ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1 NOT NULL/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS completed_steps integer\[\] DEFAULT '\{\}'::integer\[\] NOT NULL/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS survey_data jsonb DEFAULT '\{\}'::jsonb NOT NULL/);
    assert.match(migration, /'in_progress'::text/);
    assert.match(migration, /'completed'::text/);
    assert.match(migration, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
});
