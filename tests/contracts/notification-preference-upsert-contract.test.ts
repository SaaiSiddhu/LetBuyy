// Cross-artifact contract between migration 210 and the gateway route that calls it (phase DB-1).
//
// PUT /notifications/preferences writes through `upsert_notification_preference` rather than a plain
// PostgREST upsert, because `notification_preferences` dedupes through an EXPRESSION unique index
// (`COALESCE(store_id, sentinel)`) and PostgREST only ever emits a bare `ON CONFLICT (a, b, c)`
// column list, which no expression index can match. Every preference toggle 500ed until the RPC
// landed.
//
// PostgREST invokes the function by NAMED parameters, so the SQL parameter names and the JS object
// keys are a real wire contract: rename `p_store_id` on one side only and every call fails at runtime
// with "function public.upsert_notification_preference(...) does not exist". Nothing else in the
// repository pins that agreement — `services/api-gateway/src/__tests__/notifications.test.ts` only
// asserts the route source still mentions `.from('notification_preferences')`, which was true
// throughout the outage.
//
// The behavioural half of this guard (real Postgres, real foreign keys, real upsert semantics) is
// tests/executable/notification-preferences-upsert-postgres.test.mjs. This half runs in the default
// gate with no database, so drift is caught on every run rather than only under --real-db.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const MIGRATION = 'database/supabase/migrations/210_notification_preferences_upsert_rpc.sql';
const ROLLBACK = 'database/supabase/rollback/210_notification_preferences_upsert_rpc.rollback.sql';
const ROUTE = 'services/api-gateway/src/routes/notifications.ts';
const RPC_NAME = 'upsert_notification_preference';

function read(relativePath: string): string {
    const absolute = join(repoRoot, relativePath);
    assert.equal(existsSync(absolute), true, `${relativePath} must exist`);
    return readFileSync(absolute, 'utf8');
}

// Migration 210 explains itself in a long `--` header that quotes the very SQL shapes asserted
// below, including a literal `ON CONFLICT (user_id, COALESCE(store_id, ...), ...)`. Matching against
// the raw file therefore lets a comment satisfy an assertion about executable SQL — an assertion
// that cannot fail is the same defect class this whole guard exists to catch. Strip comments first
// and assert only against statements Postgres will actually run.
function executableSql(source: string): string {
    return source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');
}

// Ordered parameter names from the migration's CREATE FUNCTION signature.
function sqlParameterNames(migration: string): string[] {
    const signature = migration.match(
        new RegExp(`CREATE OR REPLACE FUNCTION public\\.${RPC_NAME}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`),
    );
    assert.ok(signature, `${MIGRATION} must declare CREATE OR REPLACE FUNCTION public.${RPC_NAME}(...) RETURNS ...`);
    return [...signature[1].matchAll(/(p_[a-z_]+)\s+[a-z]/g)].map((match) => match[1]);
}

// Argument keys from the route's db.rpc('<name>', { ... }) call.
function routeRpcArgumentNames(route: string): string[] {
    const call = route.match(new RegExp(`db\\.rpc\\(\\s*'${RPC_NAME}'\\s*,\\s*\\{([\\s\\S]*?)\\}\\s*\\)`));
    assert.ok(call, `${ROUTE} must call db.rpc('${RPC_NAME}', { ... })`);
    return [...call[1].matchAll(/(p_[a-z_]+)\s*:/g)].map((match) => match[1]);
}

test('the gateway calls migration 210 with exactly the parameter names the function declares', () => {
    const sqlNames = sqlParameterNames(executableSql(read(MIGRATION)));
    const routeNames = routeRpcArgumentNames(read(ROUTE));

    assert.deepEqual(sqlNames, ['p_user_id', 'p_store_id', 'p_channel', 'p_category', 'p_enabled']);
    // Set equality, not order: PostgREST passes a JSON object, so key ORDER is irrelevant but any
    // missing, extra or renamed key breaks the call at runtime.
    assert.deepEqual([...routeNames].sort(), [...sqlNames].sort());
});

test('migration 210 targets the expression index rather than a bare column list', () => {
    const migration = executableSql(read(MIGRATION));

    // The COALESCE must appear inside the ON CONFLICT target. A bare `ON CONFLICT (user_id,
    // store_id, channel, category)` here would reintroduce the exact defect the RPC exists to fix.
    const onConflict = migration.match(/ON CONFLICT\s*\(([\s\S]*?)\)\s*DO UPDATE/);
    assert.ok(onConflict, `${MIGRATION} must carry an executable ON CONFLICT ... DO UPDATE clause`);
    assert.match(
        onConflict[1],
        /COALESCE\(store_id, '00000000-0000-0000-0000-000000000000'::uuid\)/,
        'the conflict target must repeat the expression index verbatim, not list bare columns',
    );
});

test('the preference write path does not fall back to a PostgREST upsert on notification_preferences', () => {
    const route = read(ROUTE);

    // `.upsert(...)` elsewhere in this file is fine — device_tokens genuinely has a plain UNIQUE
    // (user_id, token) constraint. What must never come back is an onConflict naming store_id, which
    // can only be aimed at notification_preferences' expression index.
    assert.doesNotMatch(
        route,
        /onConflict:\s*'[^']*store_id[^']*'/,
        "a bare-column onConflict naming store_id cannot match notification_preferences' expression unique index — call the upsert_notification_preference RPC instead",
    );
});

test('migration 210 ships a rollback that drops exactly the function it created', () => {
    const rollback = executableSql(read(ROLLBACK));

    assert.match(rollback, new RegExp(`DROP FUNCTION IF EXISTS public\\.${RPC_NAME}`));
    // The rollback must name the full argument-type list, otherwise it silently fails to drop an
    // overload and leaves the function behind.
    assert.match(rollback, /\(uuid, uuid, text, text, boolean\)/);
});
