import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { startRestProxy } from '../../scripts/governance/owned-rest-proxy.mjs';

async function fixture(t, handler) {
    const connections = new Set();
    const upstream = createServer(handler);
    upstream.keepAliveTimeout = 60_000;
    upstream.on('connection', socket => connections.add(socket));
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    const proxy = await startRestProxy({ upstreamPort: upstream.address().port });
    t.after(async () => {
        await proxy.close();
        upstream.closeAllConnections();
        await new Promise(resolve => upstream.close(resolve));
    });
    return { proxy, connections };
}

test('owned REST mutations use fresh upstream connections and preserve each body once', async t => {
    const bodies = [];
    const { proxy, connections } = await fixture(t, async (req, res) => {
        assert.equal(req.url, '/rpc/fixture_effect');
        assert.equal(req.method, 'POST');
        assert.equal(req.headers.authorization, 'Bearer synthetic-fixture-only');
        let body = '';
        for await (const chunk of req) body += chunk;
        bodies.push(JSON.parse(body));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepted: bodies.length }));
    });
    for (const value of [1, 2]) {
        const response = await fetch(`${proxy.url}/rest/v1/rpc/fixture_effect`, {
            method: 'POST',
            headers: { authorization: 'Bearer synthetic-fixture-only', 'content-type': 'application/json' },
            body: JSON.stringify({ value }),
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { accepted: value });
    }
    assert.deepEqual(bodies, [{ value: 1 }, { value: 2 }]);
    assert.equal(connections.size, 2, 'a new mutation cannot reuse a potentially stale upstream socket');
    assert.deepEqual(proxy.stats, { forwarded: 2, refused: 0, upstreamErrors: 0 });
});

test('a committed mutation with a lost upstream reply is never retried by the fixture proxy', async t => {
    let effects = 0;
    const { proxy } = await fixture(t, async (req, res) => {
        for await (const _chunk of req) { /* Consume the real request before committing. */ }
        effects += 1;
        if (effects === 1) req.socket.destroy();
        else { res.writeHead(200); res.end('accepted'); }
    });
    const lost = await fetch(`${proxy.url}/rest/v1/rpc/fixture_effect`, { method: 'POST', body: 'first' });
    assert.equal(lost.status, 502);
    await lost.text();
    assert.equal(effects, 1, 'an uncertain acknowledgement must not replay a mutation');
    const next = await fetch(`${proxy.url}/rest/v1/rpc/fixture_effect`, { method: 'POST', body: 'second' });
    assert.equal(next.status, 200);
    assert.equal(await next.text(), 'accepted');
    assert.equal(effects, 2);
    assert.deepEqual(proxy.stats, { forwarded: 1, refused: 0, upstreamErrors: 1 });
});
