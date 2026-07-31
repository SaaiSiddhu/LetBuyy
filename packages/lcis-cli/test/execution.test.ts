/**
 * EAOS `lcis execution` command-group tests (Phase-8, ≥20 tests).
 * Drives run(['execution', <sub>, ...], io) for all seven subcommands. READ-ONLY.
 * Every envelope embeds evidence/confidence/sources/timestamp; liveConnected is
 * honestly false (no execution tracker wired); gibberish exits 0 with no stack trace.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/index';
import type { IO } from '../src/index';
import type { LcisEnvelope } from '@letbuyy/lcis-core';

interface Capture {
  out: string[];
  err: string[];
}

function captureIO(): [IO, Capture] {
  const cap: Capture = { out: [], err: [] };
  const io: IO = {
    stdout: (s) => cap.out.push(s),
    stderr: (s) => cap.err.push(s),
  };
  return [io, cap];
}

const joined = (cap: Capture): string => cap.out.join('\n');
const errJoined = (cap: Capture): string => cap.err.join('\n');

async function runJson(args: string[]): Promise<{ code: number; env: LcisEnvelope<Record<string, unknown>>; cap: Capture }> {
  const [io, cap] = captureIO();
  const code = await run([...args, '--json'], io);
  const env = JSON.parse(joined(cap)) as LcisEnvelope<Record<string, unknown>>;
  return { code, env, cap };
}

before(async () => {
  const [io] = captureIO();
  await run(['health'], io);
});

const SUBCOMMANDS = ['report', 'graph', 'status', 'timeline', 'blockers', 'rollout', 'health'] as const;

describe('lcis execution — all seven subcommands', () => {
  for (const sub of SUBCOMMANDS) {
    it(`execution ${sub} exits 0 and produces non-empty output`, async () => {
      const [io, cap] = captureIO();
      const code = await run(['execution', sub, 'Add', 'GST', 'invoice', 'download'], io);
      assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
      assert.ok(joined(cap).length > 0, 'expected non-empty output');
      assert.ok(!errJoined(cap).includes('at Object.'), 'stack trace leaked');
    });

    it(`execution ${sub} --json envelope has source=execution/${sub} + provenance`, async () => {
      const { code, env } = await runJson(['execution', sub, 'checkout', 'payment']);
      assert.equal(code, 0);
      assert.equal(env.source, `execution/${sub}`);
      assert.ok(typeof env.confidence === 'number', 'envelope must have confidence');
      assert.ok(Array.isArray(env.evidence), 'envelope must have evidence array');
      assert.ok(typeof env.timestamp === 'string', 'envelope must have timestamp');
    });
  }
});

describe('lcis execution report (flagship package)', () => {
  it('composes all seven sections + overall health', async () => {
    const { env } = await runJson(['execution', 'report', 'checkout', 'payment']);
    const data = env.data as Record<string, unknown>;
    for (const key of ['execution', 'agent', 'artifact', 'validation', 'status', 'rollout', 'timeline', 'health']) {
      assert.ok(data[key], `section ${key} missing from execution report`);
    }
  });

  it('is honest: liveConnected false and summary names NOT_CONNECTED', async () => {
    const { env } = await runJson(['execution', 'report', 'checkout', 'payment']);
    const data = env.data as { liveConnected: boolean; summary: string };
    assert.equal(data.liveConnected, false);
    assert.match(data.summary, /NOT_CONNECTED/);
  });
});

describe('lcis execution graph', () => {
  it('has graph nodes with derived structural status', async () => {
    const { env } = await runJson(['execution', 'graph', 'checkout', 'payment']);
    const data = env.data as { graph: { nodes: Array<{ status: string }> } };
    assert.ok(data.graph.nodes.length > 0);
    for (const n of data.graph.nodes) {
      assert.ok(['PLANNED', 'READY', 'BLOCKED'].includes(n.status), `unexpected derived status ${n.status}`);
    }
  });
});

describe('lcis execution status', () => {
  it('ETA is honestly NOT_CONNECTED with null value', async () => {
    const { env } = await runJson(['execution', 'status', 'checkout', 'payment']);
    const data = env.data as { eta: { connection: string; value: string | null } };
    assert.equal(data.eta.connection, 'NOT_CONNECTED');
    assert.equal(data.eta.value, null);
  });
});

describe('lcis execution rollout', () => {
  it('money feature rollout is not a blind GO', async () => {
    const { env } = await runJson(['execution', 'rollout', 'add', 'payment', 'refund', 'ledger']);
    const data = env.data as { launchVerdict: string };
    assert.ok(
      data.launchVerdict === 'NO_GO' || data.launchVerdict === 'CONDITIONAL_GO',
      `expected scrutiny for money feature, got: ${data.launchVerdict}`,
    );
  });
});

describe('lcis execution health', () => {
  it('returns four areas + merged overall with a valid band', async () => {
    const { env } = await runJson(['execution', 'health', 'checkout', 'payment']);
    const data = env.data as { areas: Array<{ area: string }>; overall: { area: string; band: string } };
    assert.equal(data.areas.length, 4);
    assert.equal(data.overall.area, 'overall');
    assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(data.overall.band));
  });
});

describe('lcis execution — honesty + robustness', () => {
  it('gibberish request exits 0 — honest empty, no stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['execution', 'report', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0, `expected exit 0 for unresolved request, got ${code}`);
    assert.ok(!errJoined(cap).includes('at Object.'), `stack trace leaked: ${errJoined(cap)}`);
    assert.ok(!errJoined(cap).includes('node:internal'), `internal trace leaked: ${errJoined(cap)}`);
  });

  it('--evidence appends evidence section without error', async () => {
    const [io, cap] = captureIO();
    const code = await run(['execution', 'health', 'checkout', '--evidence'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('seed options (--domain) are accepted', async () => {
    const { code, env } = await runJson(['execution', 'graph', 'checkout', '--domain', 'payments']);
    assert.equal(code, 0);
    const data = env.data as { request: { domains: string[] } };
    assert.deepEqual(data.request.domains, ['payments']);
  });

  it('Phase-7 lcis engineering still works — not clobbered by the execution group', async () => {
    const { code, env } = await runJson(['engineering', 'checkout', 'payment']);
    assert.equal(code, 0);
    assert.equal(env.source, 'engineering/package');
  });
});
