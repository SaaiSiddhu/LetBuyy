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
import { readFileSync, readdirSync } from 'node:fs';
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

test('the only direct runtime writer is buyer intake; operator writes live in the reviewed transaction', () => {
    const writers = trackedFilesMentioning(".from('support_tickets')", ['services', 'apps', 'packages']).filter((file) => {
        const code = stripComments(readFileSync(join(repoRoot, file), 'utf8'));
        // Each chain starts at .from('support_tickets') and ends at the statement's semicolon.
        const chains = code.match(/\.from\('support_tickets'\)[^;]*;/g) ?? [];
        return chains.some((chain) => /\.(insert|update|upsert|delete)\(/.test(chain));
    });
    assert.deepEqual(writers, [
        'services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts',
    ], 'a new writer of support tickets is a new way to write a privacy request: review it, and extend the database-backed proof, before adding it here');
});

// The same tripwire for SQL. A function in a migration that writes support tickets is a writer the TypeScript scan above cannot see.
// The one there is (P2-OPERATOR-QUEUE-CORRECTNESS, 2026-10-02) is reply_to_support_ticket, migration 264: an operator's reply in one
// transaction. Its update may move a ticket's status and response times and nothing else -- never the metadata a privacy request's
// type and any outcome would live in, never the topic. operator-queue-correctness.postgres.test.ts is its database-backed proof.
const stripSqlComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

test('only reviewed support migrations write tickets; reply and operator metadata changes cannot claim fulfillment', () => {
    const migrationsDir = join(repoRoot, 'database/supabase/migrations');
    const sqlOf = (name) => stripSqlComments(readFileSync(join(migrationsDir, name), 'utf8'));
    const writers = readdirSync(migrationsDir)
        .filter((name) => name.endsWith('.sql'))
        .filter((name) => /\b(?:update|insert\s+into|delete\s+from)\s+(?:public\.)?support_tickets\b/i.test(sqlOf(name)))
        .sort();
    assert.deepEqual(writers, ['264_support_ticket_reply_atomic.sql', '265_operator_support_mutation_integrity.sql'], 'a new SQL writer of support tickets is a new way to write a privacy request: review it, and extend the database-backed proof, before adding it here');

    const updates = sqlOf('264_support_ticket_reply_atomic.sql').match(/\bupdate\s+public\.support_tickets\s+set\b[\s\S]*?\bwhere\b/gi) ?? [];
    assert.equal(updates.length, 1, 'one update of support_tickets');
    const assignments = updates[0].replace(/^[\s\S]*?\bset\b/i, '').replace(/\bwhere\b$/i, '');
    const columns = [...assignments.matchAll(/([a-z_]+)\s*=/gi)].map((match) => match[1]);
    assert.deepEqual(columns, ['status', 'first_response_at', 'last_agent_message_at', 'updated_by']);
    const mutation = sqlOf('265_operator_support_mutation_integrity.sql');
    const mutationUpdates = mutation.match(/\bupdate\s+public\.support_tickets\s+set\b[\s\S]*?\bwhere\b/gi) ?? [];
    assert.equal(mutationUpdates.length, 5);
    const allowed = new Set(['linked_ts_case_id','updated_by','assignee_id','status','escalated_to','linked_incident_id','metadata','resolved_at']);
    for (const update of mutationUpdates) {
        const assignments = update.replace(/^[\s\S]*?\bset\b/i,'').replace(/\bwhere\b$/i,'');
        for (const [, column] of assignments.matchAll(/([a-z_]+)\s*=/gi)) assert.ok(allowed.has(column), `unreviewed operator write: ${column}`);
        if (/metadata\s*=/i.test(assignments)) {
            assert.match(assignments, /metadata=metadata\|\|jsonb_build_object\('escalation',coalesce\(p_payload->'metadata','\{\}'::jsonb\)\)/);
        }
    }
    assert.match(mutation, /p_operation='create' AND p_payload->>'topic'='privacy'/);
    assert.match(mutation, /Privacy requests use buyer intake/);

});

test('the scans really look: the key is found where it is known to be, and a reviewed writer is found as a writer', () => {
    // Guards the tripwire against going blind (an empty result would otherwise read as "nothing writes it").
    assert.ok(trackedFilesMentioning('privacy_request_type', ['services']).includes('services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts'));
    assert.ok(trackedFilesMentioning(".from('support_tickets')", ['services']).includes('services/api-gateway/src/routes/operations/support.ts'));
    assert.match(stripComments(readFileSync(join(repoRoot, 'services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts'), 'utf8')), /\.from\('support_tickets'\)[^;]*\.(insert|update)\(/);
    assert.match(stripComments(readFileSync(join(repoRoot, 'services/api-gateway/src/execution/support-execution.adapter.ts'), 'utf8')), /rpc\('execute_operator_support_mutation'/);
});
