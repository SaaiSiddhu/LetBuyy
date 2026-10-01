// Nothing in this repository can record that a privacy request was FULFILLED.
//
// services/api-gateway/src/routes/storefront/buyer-privacy-routes.ts reports a resolved or closed privacy request as 'fulfilled' only when
// the ticket's metadata.fulfillment_outcome holds a recognised value, and as 'closed_no_fulfillment' otherwise. That is honest only while
// nothing but a real export or erasure executor can write that key. Today there is no executor (export release and erasure are open
// decisions: D05), so the key must have no writer anywhere. The database-backed proof is
// services/api-gateway/src/__tests__/owned-db/privacy-support-visibility.postgres.test.ts: every route a staff member can use, sent hostile
// payloads, never produces it. This is the repository-wide source tripwire behind that proof: the moment any other file mentions the key, or a
// new file starts writing support tickets, a person has to decide whether it writes an outcome and write the contract that keeps it honest,
// instead of the buyer-facing status quietly starting to read as success. (The route's own half, that it only reads the key, is
// services/api-gateway/src/__tests__/privacy-fulfillment-writers.test.ts.)
//
// Scans strip comments first, so prose that discusses the key cannot pass as a use of it and a use inside a comment cannot hide.

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTE = 'services/api-gateway/src/routes/storefront/buyer-privacy-routes.ts';

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Tracked files under `roots` containing `needle`, tests and documents excluded. Plain directory pathspecs only: no pathspec magic. */
function trackedFilesMentioning(needle, roots) {
    const result = spawnSync('git', ['-C', repoRoot, 'grep', '-l', '-F', needle, '--', ...roots], { encoding: 'utf8' });
    // git grep exits 1 when nothing matches: that is an answer. Anything else is a failure to look, which must not read as "no match".
    assert.ok(result.status === 0 || result.status === 1, `git grep could not run: ${result.stderr}`);
    return result.stdout
        .split('\n')
        .filter(Boolean)
        .filter((file) => !/(^|\/)(__tests__|tests?|node_modules)\//.test(file) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) && !/\.md$/.test(file))
        .sort();
}

test('the privacy route is the only file in the repository that mentions fulfillment_outcome', () => {
    assert.deepEqual(trackedFilesMentioning('fulfillment_outcome', ['services', 'apps', 'packages', 'database', 'scripts']), [ROUTE]);
});

test('the only runtime files that write support tickets are the two that are reviewed', () => {
    const writers = trackedFilesMentioning(".from('support_tickets')", ['services', 'apps', 'packages']).filter((file) => {
        const code = stripComments(readFileSync(join(repoRoot, file), 'utf8'));
        // Each chain starts at .from('support_tickets') and ends at the statement's semicolon.
        const chains = code.match(/\.from\('support_tickets'\)[^;]*;/g) ?? [];
        return chains.some((chain) => /\.(insert|update|upsert|delete)\(/.test(chain));
    });
    assert.deepEqual(writers, [
        'services/api-gateway/src/routes/operations/support.ts',
        'services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts',
    ], 'a new writer of support tickets is a new way to write a privacy request: review it, and extend the database-backed proof, before adding it here');
});

test('the scans really look: the key is found where it is known to be, and a reviewed writer is found as a writer', () => {
    // Guards the tripwire against going blind (an empty result would otherwise read as "nothing writes it").
    assert.ok(trackedFilesMentioning('privacy_request_type', ['services']).includes('services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts'));
    assert.ok(trackedFilesMentioning(".from('support_tickets')", ['services']).includes('services/api-gateway/src/routes/operations/support.ts'));
    assert.match(stripComments(readFileSync(join(repoRoot, 'services/api-gateway/src/routes/operations/support.ts'), 'utf8')), /\.from\('support_tickets'\)[^;]*\.(insert|update)\(/);
});
