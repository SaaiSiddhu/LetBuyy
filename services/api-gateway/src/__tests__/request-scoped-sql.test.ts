import assert from 'node:assert/strict';
import test from 'node:test';
import { getPooledSql, closePooledSqlClients, withPooledSqlScope } from '@letbuyy/infrastructure/pooled-sql-adapter';

// Lazy clients prove identity/lifetime boundaries here; owned wire suites prove execution.
const env = { DATABASE_URL: 'postgres://synthetic:synthetic@127.0.0.1:1/synthetic' };

test('different invocation scopes never reuse a previous request client', async () => {
    const first = await withPooledSqlScope(async () => {
        const own = getPooledSql(env)!;
        assert.equal(getPooledSql(env), own, 'one invocation reuses its own bounded pool');
        return own;
    });
    const second = await withPooledSqlScope(async () => getPooledSql(env)!);
    assert.notEqual(first, second);
});

test('process SQL callers retain bounded pool reuse and explicit feature-off', async () => {
    try {
        assert.equal(getPooledSql(env), getPooledSql(env));
        assert.equal(getPooledSql({ ...env, STOREFRONT_POOLED_SQL: 'off' }), null);
    } finally { await closePooledSqlClients(); }
});

test('Worker invocation scope closes independently on callback failure', async () => {
    let failedClient: ReturnType<typeof getPooledSql>;
    await assert.rejects(withPooledSqlScope(async () => {
        failedClient = getPooledSql(env);
        throw new Error('synthetic request failure');
    }), /synthetic request failure/);
    const nextClient = await withPooledSqlScope(async () => getPooledSql(env));
    assert.notEqual(nextClient, failedClient!);
});
