import assert from 'node:assert/strict';
import test from 'node:test';
import { createNetwork, FIXTURE_LABEL, OWNER_PID_LABEL, RUN_ID_LABEL, ROLE_LABEL } from '../../scripts/governance/executable-pg-fixture.mjs';

const name = 'letbuyy-exec-pool-control', runId = '123456abcdef';
const configured = { LETBUYY_EXECUTABLE_NETWORK_POOL: '10.233.0.0/16' };
const absent = { status: 1, stderr: `Error response from daemon: network ${name} not found` };
const subnetOf = args => args[args.indexOf('--subnet') + 1];
const identified = subnet => ({ Id: 'a'.repeat(64), Driver: 'bridge', Name: name,
    Labels: { [FIXTURE_LABEL]: '1', [RUN_ID_LABEL]: runId, [OWNER_PID_LABEL]: String(process.pid), [ROLE_LABEL]: 'network' },
    IPAM: { Config: [{ Subnet: subnet }] } });

test('default network allocation retains Docker defaults and ownership labels', () => {
    const calls = [];
    assert.equal(createNetwork({ name, runId, env: {}, run: args => { calls.push(args); return { status: 0 }; } }), name);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].includes('--subnet'), false);
    assert.ok(calls[0].includes(`${RUN_ID_LABEL}=${runId}`));
    assert.ok(calls[0].includes(`${OWNER_PID_LABEL}=${process.pid}`));
});

test('configured allocations use bounded private subnets and preserve the exact network identity', () => {
    const calls = [];
    assert.equal(createNetwork({ name, runId, env: configured, run: args => { calls.push(args); return { status: 0 }; } }), name);
    assert.equal(calls.length, 1);
    const subnet = subnetOf(calls[0]), match = /^10\.233\.(\d+)\.(\d+)\/28$/.exec(subnet);
    assert.ok(match);
    assert.ok(Number(match[1]) <= 255 && Number(match[2]) <= 240 && Number(match[2]) % 16 === 0);
    assert.equal(calls[0].at(-1), name);
    assert.ok(calls[0].includes(`${FIXTURE_LABEL}=1`));
    assert.ok(calls[0].includes(`${ROLE_LABEL}=network`));
});

test('invalid or public network pools fail before invoking Docker', () => {
    for (const value of ['0.0.0.0/0', '127.0.0.0/16', '10.256.0.0/16', '10.233.0.1/16', '10.233.0.0/15', '10.233.0.0/16 --driver host', 42]) {
        let calls = 0;
        assert.throws(() => createNetwork({ name, runId, env: { LETBUYY_EXECUTABLE_NETWORK_POOL: value }, run: () => { calls++; } }), /private 10.N.0.0\/16/);
        assert.equal(calls, 0);
    }
});

test('only a confirmed overlap with no created network selects another subnet', () => {
    const creates = [];
    const result = createNetwork({ name, runId, env: configured, run: args => {
        if (args[1] === 'inspect') return absent;
        creates.push(args);
        return creates.length === 1 ? { status: 1, stderr: 'Pool overlaps with other one on this address space' } : { status: 0 };
    } });
    assert.equal(result, name);
    assert.equal(creates.length, 2);
    assert.notEqual(subnetOf(creates[0]), subnetOf(creates[1]));
    assert.ok(creates.every(args => args.at(-1) === name && args.includes('--subnet')));
});

test('a lost create acknowledgement is recovered only by exact owned allocation readback, without replay', () => {
    let creates = 0, subnet;
    assert.equal(createNetwork({ name, runId, env: configured, run: args => {
        if (args[1] === 'inspect') return { status: 0, stdout: JSON.stringify([identified(subnet)]) };
        creates++; subnet = subnetOf(args);
        return { status: null, error: new Error('acknowledgement lost') };
    } }), name);
    assert.equal(creates, 1);
});

test('an ambiguous missing allocation or unavailable readback is never replayed', () => {
    for (const observed of [absent, { status: 1, stderr: 'Docker unavailable' }]) {
        let creates = 0;
        assert.throws(() => createNetwork({ name, runId, env: configured, run: args => {
            if (args[1] === 'inspect') return observed;
            creates++; return { status: null, error: new Error('acknowledgement lost') };
        } }), /docker network failed/);
        assert.equal(creates, 1);
    }
});

test('foreign, changed or malformed allocation readback is preserved rather than adopted or removed', () => {
    for (const kind of ['owner', 'run', 'role', 'subnet', 'malformed']) {
        let subnet, creates = 0; const calls = [];
        assert.throws(() => createNetwork({ name, runId, env: configured, run: args => {
            calls.push(args);
            if (args[1] !== 'inspect') { creates++; subnet = subnetOf(args); return { status: 1, stderr: 'network name exists' }; }
            const info = identified(subnet);
            if (kind === 'owner') info.Labels[OWNER_PID_LABEL] = '1';
            if (kind === 'run') info.Labels[RUN_ID_LABEL] = 'abcdef123456';
            if (kind === 'role') info.Labels[ROLE_LABEL] = 'cluster';
            if (kind === 'subnet') info.IPAM.Config[0].Subnet = '10.234.0.0/28';
            return { status: 0, stdout: kind === 'malformed' ? '{' : JSON.stringify([info]) };
        } }), /acknowledgement could not be reconciled/);
        assert.equal(creates, 1);
        assert.ok(calls.every(args => ['create', 'inspect'].includes(args[1])), 'no existing network is removed');
    }
});

test('exhausted configured pools refuse after bounded distinct attempts without default-pool fallback', () => {
    const creates = [];
    assert.throws(() => createNetwork({ name, runId, env: configured, run: args => {
        if (args[1] === 'inspect') return absent;
        creates.push(args); return { status: 1, stderr: 'Pool overlaps with other one on this address space' };
    } }), /bounded allocation attempts/);
    assert.equal(creates.length, 32);
    assert.equal(new Set(creates.map(subnetOf)).size, 32);
    assert.ok(creates.every(args => args.includes('--subnet')));
});
