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

test('protected merchant mutations run through the shared idempotency middleware', () => {
    const indexSource = source('index.ts');
    const middlewareSource = source('middleware/idempotency.ts');

    assert.match(indexSource, /import \{ protectedMutationIdempotency \} from '\.\/middleware\/idempotency'/);
    assert.match(indexSource, /api\.use\('\/\*',\s*csrfProtection\);\s*api\.use\('\/\*',\s*protectedMutationIdempotency\);/);
    assert.match(indexSource, /'X-Idempotency-Key',\s*'Idempotency-Key'/);

    for (const prefix of [
        '/stores',
        '/products',
        '/orders',
        '/returns',
        '/shipping/labels',
        '/customers',
        '/notifications',
        '/media',
        '/metafields',
        '/reviews',
        '/pages',
    ]) {
        assert.match(middlewareSource, new RegExp(`'${prefix.replace('/', '\\/')}'`));
    }

    assert.match(middlewareSource, /IDEMPOTENCY_KEY_REQUIRED/);
    assert.match(middlewareSource, /IDEMPOTENCY_SITE_REQUIRED/);
    assert.match(middlewareSource, /new IdempotencyExecutionAdapter\(getSupabaseAdmin\(c\)\)/);
    assert.match(middlewareSource, /claim\.kind === 'replay'/);
    assert.match(middlewareSource, /X-Idempotent-Replay/);
    assert.match(middlewareSource, /await idempotency\.complete\(/);
    assert.match(middlewareSource, /await idempotency\.fail\(claim\.id\)/);
    assert.match(middlewareSource, /isPendingPayoutRelease\(c\.req\.path, method, replayBody\)/);
    assert.match(middlewareSource, /would strand the statement on an exact retry/);
});

test('pre-store onboarding draft uses its account-serialized RPC while completion stays site-idempotent', () => {
    const middlewareSource = source('middleware/idempotency.ts');
    const identityRoute = repoSource('apps/platform/identity/src/app/api/auth/create-store/route.ts');

    assert.match(middlewareSource, /method === 'PUT' && normalized === '\/onboarding\/web-draft'\) return false/);
    assert.match(middlewareSource, /RPC takes a per-user advisory lock and upserts one row/);
    assert.match(identityRoute, /'X-Idempotency-Key': `onboarding-complete:\$\{attemptId\}`/);
    assert.match(middlewareSource, /'\/onboarding'/);
});

test('typed API clients attach idempotency keys to unsafe mutation requests', () => {
    const tsClientSource = repoSource('packages/typescript/api-client/src/index.ts');
    const dartClientSource = repoSource('packages/dart/api_client/lib/src/api_client.dart');

    assert.match(tsClientSource, /function withAutomaticIdempotency/);
    assert.match(tsClientSource, /idempotencyKeyFromBody\(options\.body\) \?\? automaticIdempotencyKey\(method, path\)/);
    assert.match(tsClientSource, /headers\.set\('X-Idempotency-Key', options\.idempotencyKey\)/);

    assert.match(dartClientSource, /_withAutomaticIdempotency\(/);
    assert.match(dartClientSource, /_idempotencyKeyFromBody\(options\.body\)/);
    assert.match(dartClientSource, /_automaticIdempotencyKey\(method, path\)/);
    assert.match(dartClientSource, /options\.headers\['X-Idempotency-Key'\] = idempotencyKey/);
});
