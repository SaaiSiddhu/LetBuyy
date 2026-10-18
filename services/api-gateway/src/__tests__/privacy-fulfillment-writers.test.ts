// The privacy route only READS a fulfillment outcome; it can never record one.
//
// buyer-privacy-routes.ts reports a resolved or closed privacy request as 'fulfilled' only when the ticket's metadata.fulfillment_outcome
// holds a recognised value, and as 'closed_no_fulfillment' otherwise. Only the approved canonical access-export release transaction
// may write that outcome; erasure remains gated. This file pins the
// route's half of that: the key appears in it exactly twice, as a type member and as a read, and the file writes nothing at all (it reads
// through the dependencies it is handed). The repository-wide half (no other file mentions the key, and the only writers of support
// tickets are the two reviewed ones) is tests/governance/privacy-fulfillment-writers.test.mjs; the database-backed proof that no
// supported staff route can produce an outcome is owned-db/privacy-support-visibility.postgres.test.ts.
//
// Comments are stripped before scanning, so prose that discusses the key cannot pass as a use of it, and a use inside a comment cannot hide.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// tsx transpiles this file to CJS, where import.meta.dirname is undefined; the repo's other contract tests resolve the same way.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const code = stripComments(readFileSync(join(SRC, 'routes/storefront/buyer-privacy-routes.ts'), 'utf8'));

test('inside the privacy route the outcome key is only ever declared as a type and READ', () => {
    const lines = code.split('\n').filter((line) => line.includes('fulfillment_outcome')).map((line) => line.trim());
    assert.deepEqual(lines, [
        'metadata: { privacy_request_type?: string; fulfillment_outcome?: string } | null;',
        'const outcome = metadata?.fulfillment_outcome;',
    ]);
});

test('the privacy route writes nothing itself, and only a recognised outcome word can make a closed request read as fulfilled', () => {
    assert.doesNotMatch(code, /\.(insert|update|upsert|delete|rpc)\(/, 'the route reads and reports; every write belongs to the dependencies it is handed');
    assert.match(code, /const KNOWN_FULFILLMENT_OUTCOMES = new Set\(\['fulfilled'\]\);/);
    assert.match(code, /return outcome && KNOWN_FULFILLMENT_OUTCOMES\.has\(outcome\) \? 'fulfilled' : 'closed_no_fulfillment';/, 'closed without a recognised outcome is closed_no_fulfillment, never fulfilled');
    assert.match(code, /return 'unknown';/, 'an unrecognised status is unknown, never anything that reads as success');
});
