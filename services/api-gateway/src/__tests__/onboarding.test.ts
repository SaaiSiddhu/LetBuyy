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

test('onboarding progress migration adds executable columns and statuses', () => {
    const migration = repositorySource('database/supabase/migrations/114_mobile_onboarding_attempt_progress.sql');

    assert.match(migration, /ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1 NOT NULL/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS completed_steps integer\[\] DEFAULT '\{\}'::integer\[\] NOT NULL/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS survey_data jsonb DEFAULT '\{\}'::jsonb NOT NULL/);
    assert.match(migration, /'in_progress'::text/);
    assert.match(migration, /'completed'::text/);
    assert.match(migration, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
});
