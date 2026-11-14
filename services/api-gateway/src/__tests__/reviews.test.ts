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

test('merchant review replies validate input and verify review ownership before mutation', () => {
    const routeSource = source('routes/reviews.ts');

    assert.match(routeSource, /router\.post\('\/:id\/reply',\s*validate\('json',\s*ProductReviewReplySchema\)/);
    assert.match(routeSource, /const \{ data: existing, error: existingError \} = await loadReviewOwner\(db,\s*reviewId\)/);
    assert.match(routeSource, /verifySiteOwnership\(db,\s*ownedReview\.store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/);
    assert.match(routeSource, /merchant_reply:\s*body\.message/);
    assert.match(routeSource, /merchant_reply_by:\s*customUser\.id/);
    assert.match(routeSource, /merchant_reply_at:\s*repliedAt/);
    assert.match(routeSource, /REVIEW_REPLY_SCHEMA_MISSING/);
});

test('merchant review reply migration is additive and uses the approved updated_at trigger', () => {
    const migrationSource = repositorySource('database/supabase/migrations/115_product_review_merchant_replies.sql');

    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS merchant_reply text/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS merchant_reply_by uuid/);
    assert.match(migrationSource, /ADD COLUMN IF NOT EXISTS merchant_reply_at timestamp with time zone/);
    assert.match(migrationSource, /FOREIGN KEY \(merchant_reply_by\) REFERENCES public\.users_custom\(id\) ON DELETE SET NULL NOT VALID/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
});
