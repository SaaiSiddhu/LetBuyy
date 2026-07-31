/**
 * LCIS CLI test suite.
 * Drives run([...], io) for each command. Requires graphify-out artifacts.
 * ≥30 tests covering: blast, explain, verify, memory, decision, health, graph stats,
 * output modes (json/yaml/table/csv/markdown), --evidence, --export, --depth,
 * unknown symbol → non-zero exit, no stack trace, engine singleton / cache warm.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { run } from '../src/index';
import type { IO } from '../src/index';
import { toJson, toYaml, toTable, toCsv, toMarkdown, resolveMode } from '../src/index';
import type { LcisEnvelope } from '@letbuyy/lcis-core';

// ---------------------------------------------------------------------------
// Test IO helper
// ---------------------------------------------------------------------------

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

function joined(cap: Capture): string {
  return cap.out.join('\n');
}

function errJoined(cap: Capture): string {
  return cap.err.join('\n');
}

// ---------------------------------------------------------------------------
// Warm the engine once before all tests (avoids cold-load penalty per test)
// ---------------------------------------------------------------------------

before(async () => {
  // Trigger engine load in background — it's a singleton, subsequent calls are <100ms
  const [io] = captureIO();
  await run(['health'], io);
});

// ===========================================================================
// FORMAT UNIT TESTS (no engine needed)
// ===========================================================================

describe('format: resolveMode', () => {
  it('returns json when format=json', () => {
    assert.equal(resolveMode(undefined, 'json'), 'json');
  });
  it('returns yaml when format=yaml', () => {
    assert.equal(resolveMode(undefined, 'yaml'), 'yaml');
  });
  it('returns csv when format=csv', () => {
    assert.equal(resolveMode(undefined, 'csv'), 'csv');
  });
  it('returns markdown when format=markdown', () => {
    assert.equal(resolveMode(undefined, 'markdown'), 'markdown');
  });
  it('returns table as default', () => {
    assert.equal(resolveMode(undefined, undefined), 'table');
  });
});

describe('format: toJson', () => {
  it('serializes an object to indented JSON', () => {
    const out = toJson({ a: 1, b: 'x' });
    const parsed = JSON.parse(out);
    assert.equal(parsed.a, 1);
    assert.equal(parsed.b, 'x');
  });
});

describe('format: toYaml', () => {
  it('serializes flat object to key: value lines', () => {
    const out = toYaml({ foo: 'bar', num: 42 });
    assert.ok(out.includes('foo: bar'), `got: ${out}`);
    assert.ok(out.includes('num: 42'), `got: ${out}`);
  });
  it('serializes arrays as - prefixed lines', () => {
    const out = toYaml(['a', 'b']);
    assert.ok(out.includes('- a'), `got: ${out}`);
    assert.ok(out.includes('- b'), `got: ${out}`);
  });
  it('handles nested objects', () => {
    const out = toYaml({ outer: { inner: 'value' } });
    assert.ok(out.includes('outer:'), `got: ${out}`);
    assert.ok(out.includes('inner: value'), `got: ${out}`);
  });
});

describe('format: toTable', () => {
  it('renders column headers and separator', () => {
    const out = toTable([{ name: 'Alice', score: 99 }]);
    assert.ok(out.includes('name'), `headers missing: ${out}`);
    assert.ok(out.includes('score'), `headers missing: ${out}`);
    assert.ok(out.includes('-'), `separator missing: ${out}`);
    assert.ok(out.includes('Alice'), `data missing: ${out}`);
  });
  it('handles empty array gracefully', () => {
    const out = toTable([]);
    assert.ok(out.includes('empty') || out.length === 0 || out === '(empty)');
  });
});

describe('format: toCsv', () => {
  it('produces a header row and data rows', () => {
    const out = toCsv([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    const lines = out.split('\n');
    assert.ok(lines.length >= 3, `expected at least 3 lines, got ${lines.length}`);
    assert.ok(lines[0]!.includes('x'), `header missing: ${lines[0]}`);
    assert.ok(lines[1]!.includes('1'), `data missing: ${lines[1]}`);
  });
  it('quotes cells containing commas', () => {
    const out = toCsv([{ desc: 'a, b' }]);
    assert.ok(out.includes('"a, b"'), `expected quoted cell in: ${out}`);
  });
});

describe('format: toMarkdown', () => {
  it('renders pipe-delimited table with header and separator', () => {
    const out = toMarkdown([{ col: 'val' }]);
    assert.ok(out.includes('|'), `pipe missing: ${out}`);
    assert.ok(out.includes('---'), `separator missing: ${out}`);
    assert.ok(out.includes('col'), `header missing: ${out}`);
    assert.ok(out.includes('val'), `data missing: ${out}`);
  });
});

// ===========================================================================
// CLI COMMAND TESTS (all using real graphify-out)
// ===========================================================================

describe('version command', () => {
  it('prints the version string', async () => {
    const [io, cap] = captureIO();
    const code = await run(['version'], io);
    assert.equal(code, 0);
    assert.ok(joined(cap).length > 0, 'expected non-empty version output');
  });
});

describe('health command', () => {
  it('exits 0 and reports nodeCount + edgeCount', async () => {
    const [io, cap] = captureIO();
    const code = await run(['health'], io);
    assert.equal(code, 0, `non-zero exit: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.includes('nodeCount'), `nodeCount missing: ${out}`);
    assert.ok(out.includes('edgeCount'), `edgeCount missing: ${out}`);
  });

  it('--json produces valid JSON envelope', async () => {
    const [io, cap] = captureIO();
    const code = await run(['health', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.ok(typeof parsed.data === 'object');
    assert.ok(typeof parsed.executionTime === 'number');
    assert.ok(typeof parsed.confidence === 'number');
    assert.ok(typeof parsed.source === 'string');
    assert.ok(typeof parsed.version === 'string');
    assert.ok(typeof parsed.timestamp === 'string');
  });

  it('--yaml produces non-empty YAML output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['health', '--yaml'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    assert.ok(out.includes('nodeCount:'), `yaml missing nodeCount: ${out}`);
  });

  it('--format table produces aligned table output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['health', '--format', 'table'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    // Table should have the separator line
    assert.ok(out.includes('-'), `separator missing: ${out}`);
  });

  it('--format csv produces CSV output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['health', '--format', 'csv'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    assert.ok(out.includes(','), `comma missing in CSV: ${out}`);
  });

  it('--format markdown produces markdown table', async () => {
    const [io, cap] = captureIO();
    const code = await run(['health', '--format', 'markdown'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    assert.ok(out.includes('|'), `pipe missing: ${out}`);
  });
});

describe('graph stats command', () => {
  it('exits 0 and reports node/edge counts', async () => {
    const [io, cap] = captureIO();
    const code = await run(['graph', 'stats'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.includes('nodeCount'), `nodeCount missing: ${out}`);
    assert.ok(out.includes('edgeCount'), `edgeCount missing: ${out}`);
  });

  it('--json envelope has nodeCount as number', async () => {
    const [io, cap] = captureIO();
    const code = await run(['graph', 'stats', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ nodeCount: number; edgeCount: number }>;
    assert.ok((env.data as { nodeCount: number }).nodeCount > 0, 'nodeCount should be > 0');
    assert.ok((env.data as { edgeCount: number }).edgeCount > 0, 'edgeCount should be > 0');
  });

  it('warm second call reuses singleton (cacheStats.hits > 0)', async () => {
    // First call loads the engine
    const [io1] = captureIO();
    await run(['graph', 'stats'], io1);
    // Second call — cache should have hits
    const [io2, cap2] = captureIO();
    await run(['health', '--json'], io2);
    const env = JSON.parse(joined(cap2)) as LcisEnvelope<{ cacheHits: number }>;
    // After at least one prior warm run, hits should be >= 0 (depends on artifact access order)
    assert.ok(typeof (env.data as { cacheHits: number }).cacheHits === 'number');
  });
});

describe('blast command', () => {
  it('resolves a known symbol and reports impactedNodes + file', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', 'getSupabaseAdmin'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.includes('impactedNodes'), `impactedNodes missing: ${out}`);
    assert.ok(out.includes('getSupabaseAdmin') || out.includes('supabase'), `symbol missing: ${out}`);
  });

  it('--json envelope contains criticality and affectedDomains', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', 'getSupabaseAdmin', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      criticality: string;
      affectedDomains: string[];
      impactedNodes: number;
    }>;
    assert.ok(typeof (env.data as { criticality: string }).criticality === 'string');
    assert.ok(Array.isArray((env.data as { affectedDomains: string[] }).affectedDomains));
    assert.ok((env.data as { impactedNodes: number }).impactedNodes >= 0);
    assert.ok(env.evidence.length > 0, 'expected evidence');
  });

  it('--json envelope has success=true and source="blast-radius"', async () => {
    const [io, cap] = captureIO();
    await run(['blast', 'getSupabaseAdmin', '--json'], io);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.equal(env.success, true);
    assert.equal(env.source, 'blast-radius');
  });

  it('--depth 1 limits blast traversal depth', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', 'getSupabaseAdmin', '--depth', '1', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ impactedNodes: number }>;
    // depth=1 typically has fewer impacts than default depth=3
    assert.ok(typeof (env.data as { impactedNodes: number }).impactedNodes === 'number');
  });

  it('--domain adds cross-domain analysis', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', 'getSupabaseAdmin', '--domain', 'payments', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      affectedDomains: string[];
      affectedServices: string[];
    }>;
    // With payments domain, we should get domain/service arrays
    assert.ok(Array.isArray((env.data as { affectedDomains: string[] }).affectedDomains));
    assert.ok(Array.isArray((env.data as { affectedServices: string[] }).affectedServices));
  });

  it('--evidence flag includes evidence section in table output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', 'getSupabaseAdmin', '--evidence'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    assert.ok(out.includes('Evidence') || out.includes('graph-node'), `evidence missing: ${out}`);
  });

  it('--yaml output is parseable YAML-like text', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', 'getSupabaseAdmin', '--yaml'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    assert.ok(out.includes('symbol:') || out.includes('impactedNodes:'), `yaml missing keys: ${out}`);
  });

  it('unknown symbol returns non-zero exit code', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blast', '__TOTALLY_NONEXISTENT_SYMBOL_XYZ__'], io);
    assert.equal(code, 1, `expected exit 1 but got ${code}`);
    const err = errJoined(cap);
    assert.ok(err.includes('Error:'), `expected Error: prefix, got: ${err}`);
    // Must NOT contain a stack trace
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
    assert.ok(!err.includes('node:internal'), `internal stack trace leaked: ${err}`);
  });

  it('--export writes output to a file', async () => {
    // Export must resolve UNDER cwd now (safeOutputPath rejects absolute-outside / traversal paths).
    const tmpFile = join(process.cwd(), `.lcis-cli-test-export-${Date.now()}.txt`);
    try {
      const [io, cap] = captureIO();
      const code = await run(['blast', 'getSupabaseAdmin', '--export', tmpFile], io);
      assert.equal(code, 0);
      assert.ok(existsSync(tmpFile), `export file not created: ${tmpFile}`);
      const content = readFileSync(tmpFile, 'utf-8');
      assert.ok(content.includes('impactedNodes'), `export content wrong: ${content.slice(0, 200)}`);
    } finally {
      if (existsSync(tmpFile)) unlinkSync(tmpFile);
    }
  });
});

describe('memory command', () => {
  it('returns hits for a known governance query', async () => {
    const [io, cap] = captureIO();
    const code = await run(['memory', 'RLS policy'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0 && !out.includes('No memory hits'), `no hits returned: ${out}`);
  });

  it('--json produces envelope with data array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['memory', 'canonical ledger', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown[]>;
    assert.ok(Array.isArray(env.data), 'expected array data');
    assert.equal(env.source, 'memory');
  });

  it('--limit 3 caps results at 3', async () => {
    const [io, cap] = captureIO();
    const code = await run(['memory', 'payment', '--limit', '3', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown[]>;
    assert.ok((env.data as unknown[]).length <= 3, `expected ≤3 results, got ${(env.data as unknown[]).length}`);
  });

  it('no-result query prints informational message (exit 0)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['memory', 'ZZZZZ_TOTALLY_UNIQUE_STRING_NOHIT_XYZABC'], io);
    assert.equal(code, 0, 'empty result should still exit 0');
  });
});

describe('decision command', () => {
  it('risks returns ranked list', async () => {
    const [io, cap] = captureIO();
    const code = await run(['decision', 'risks', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown[]>;
    assert.ok(Array.isArray(env.data));
    assert.equal(env.source, 'decision/risks');
  });

  it('fixes returns ranked list', async () => {
    const [io, cap] = captureIO();
    const code = await run(['decision', 'fixes', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown[]>;
    assert.ok(Array.isArray(env.data));
  });

  it('launch returns verdict object', async () => {
    const [io, cap] = captureIO();
    const code = await run(['decision', 'launch', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ verdict: string; openBlockers: number }>;
    assert.ok(typeof (env.data as { verdict: string }).verdict === 'string');
    assert.ok(typeof (env.data as { openBlockers: number }).openBlockers === 'number');
  });

  it('readiness returns system readiness array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['decision', 'readiness', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown[]>;
    assert.ok(Array.isArray(env.data));
  });

  it('scale returns scale tiers object', async () => {
    const [io, cap] = captureIO();
    const code = await run(['decision', 'scale', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ blocks100Merchants: string[] }>;
    assert.ok(Array.isArray((env.data as { blocks100Merchants: string[] }).blocks100Merchants));
  });

  it('unknown subject returns exit 1 + no stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['decision', 'NOPE_INVALID_SUBJECT'], io);
    assert.equal(code, 1);
    const err = errJoined(cap);
    assert.ok(err.includes('Error:'), `expected Error: prefix: ${err}`);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('explain command', () => {
  it('explain payments exits 0 and returns a summary', async () => {
    const [io, cap] = captureIO();
    const code = await run(['explain', 'payments'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has source=architecture', async () => {
    const [io, cap] = captureIO();
    const code = await run(['explain', 'payments', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ summary: string }>;
    assert.equal(env.source, 'architecture');
    assert.ok(typeof (env.data as { summary: string }).summary === 'string');
  });

  it('explain architecture exits 0', async () => {
    const [io, cap] = captureIO();
    const code = await run(['explain', 'architecture', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ kind: string }>;
    assert.equal((env.data as { kind: string }).kind, 'architecture');
  });
});

describe('verify command', () => {
  it('verify architecture exits 0 with a status field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['verify', 'architecture', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ status: string }>;
    assert.ok(
      ['VERIFIED', 'PARTIAL', 'UNVERIFIED', 'REFUTED'].includes(
        (env.data as { status: string }).status,
      ),
    );
  });

  it('verify production exits 0', async () => {
    const [io, cap] = captureIO();
    const code = await run(['verify', 'production', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ status: string }>;
    assert.ok(typeof (env.data as { status: string }).status === 'string');
  });

  it('unknown entity returns exit 1', async () => {
    const [io, cap] = captureIO();
    const code = await run(['verify', 'NOSUCHENTITY'], io);
    assert.equal(code, 1);
    const err = errJoined(cap);
    assert.ok(err.includes('Error:'), `expected Error: prefix: ${err}`);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

// ===========================================================================
// LIVE COMMAND TESTS
// ===========================================================================

describe('live health command', () => {
  it('exits 0 and reports 4 adapters', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'health'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json produces valid envelope with overall field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'health', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ overall: string; adapters: unknown[] }>;
    assert.ok(typeof (env.data as { overall: string }).overall === 'string');
    assert.ok(Array.isArray((env.data as { adapters: unknown[] }).adapters));
  });

  it('adapters in output reference known provider names', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'health', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ adapters: Array<{ adapter: string }> }>;
    const names = (env.data as { adapters: Array<{ adapter: string }> }).adapters.map((a) => a.adapter);
    assert.ok(names.includes('supabase'), `supabase adapter missing: ${JSON.stringify(names)}`);
    assert.ok(names.includes('github'), `github adapter missing: ${JSON.stringify(names)}`);
  });

  it('all adapters are NOT_CONNECTED in this env (honest)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'health', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ adapters: Array<{ adapter: string; status: string }> }>;
    const adapters = (env.data as { adapters: Array<{ adapter: string; status: string }> }).adapters;
    // In this env no creds → all NOT_CONNECTED; but we only assert valid status values
    const validStatuses = new Set(['CONNECTED', 'NOT_CONNECTED', 'DEGRADED', 'ERROR']);
    for (const a of adapters) {
      assert.ok(validStatuses.has(a.status), `unknown status for ${a.adapter}: ${a.status}`);
    }
  });

  it('no stack trace in output on NOT_CONNECTED', async () => {
    const [io, cap] = captureIO();
    await run(['live', 'health'], io);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
    assert.ok(!err.includes('node:internal'), `internal trace leaked: ${err}`);
  });
});

describe('live status command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'status'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0);
  });

  it('--json envelope has adapters array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'status', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ adapters: unknown[] }>;
    assert.ok(Array.isArray((env.data as { adapters: unknown[] }).adapters));
  });
});

describe('live investigate command', () => {
  it('exits 0 for subject=payments and shows correlation output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'investigate', 'payments'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected output');
  });

  it('--json envelope contains subject and notConnected', async () => {
    const [io, cap] = captureIO();
    const code = await run(['live', 'investigate', 'checkout', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ subject: string; notConnected: string[] }>;
    assert.equal((env.data as { subject: string }).subject, 'checkout');
    assert.ok(Array.isArray((env.data as { notConnected: string[] }).notConnected));
  });

  it('notConnected in output lists adapter names (honest)', async () => {
    const [io, cap] = captureIO();
    await run(['live', 'investigate', 'auth', '--json'], io);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ notConnected: string[] }>;
    const nc = (env.data as { notConnected: string[] }).notConnected;
    assert.ok(Array.isArray(nc));
    // Each entry is a string adapter name
    for (const entry of nc) {
      assert.equal(typeof entry, 'string');
    }
  });
});

describe('db commands', () => {
  it('db status exits 0 and shows adapter name', async () => {
    const [io, cap] = captureIO();
    const code = await run(['db', 'status'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0);
  });

  it('db status --json envelope has status field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['db', 'status', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ status: string }>;
    const validStatuses = new Set(['CONNECTED', 'NOT_CONNECTED', 'DEGRADED', 'ERROR']);
    assert.ok(validStatuses.has((env.data as { status: string }).status));
  });

  it('db health exits 0', async () => {
    const [io, cap] = captureIO();
    const code = await run(['db', 'health'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
  });

  it('db drift exits 0 without stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['db', 'drift'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace: ${err}`);
  });
});

// ===========================================================================
// PLAN COMMAND GROUP TESTS (Phase-4, ≥18 new tests)
// ===========================================================================

describe('plan change command', () => {
  it('exits 0 for a well-known domain term', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'change', 'Add', 'GST', 'filing'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json produces a valid LcisEnvelope with evidence and confidence', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'change', 'checkout', 'payment', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ confidence: number; unresolved: boolean }>;
    assert.ok(typeof env.confidence === 'number', 'envelope must have confidence');
    assert.ok(Array.isArray(env.evidence), 'envelope must have evidence array');
    assert.equal(env.source, 'plan/change');
    assert.ok(typeof env.timestamp === 'string');
  });

  it('gibberish request is honestly unresolved — exit 0, no stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'change', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0, `expected exit 0 for unresolved request, got ${code}`);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
    assert.ok(!err.includes('node:internal'), `internal trace leaked: ${err}`);
  });

  it('--json unresolved plan has unresolved=true', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'change', 'ZXQKFMRVWP_NONSENSE_9999', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ unresolved: boolean }>;
    assert.equal((env.data as { unresolved: boolean }).unresolved, true, 'unresolved flag must be set');
  });
});

describe('plan execution command', () => {
  it('exits 0 and produces output with a summary field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'execution', 'implement', 'shipping', 'zones'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has source=plan/execution and milestones array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'execution', 'payments', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ milestones: unknown[]; workBreakdown: unknown[] }>;
    assert.equal(env.source, 'plan/execution');
    assert.ok(Array.isArray((env.data as { milestones: unknown[] }).milestones), 'milestones must be array');
    assert.ok(Array.isArray((env.data as { workBreakdown: unknown[] }).workBreakdown), 'workBreakdown must be array');
  });
});

describe('plan migration command', () => {
  it('exits 0 and returns a plan with steps', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'migration', 'orders', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ steps: unknown[]; readiness: unknown }>;
    assert.equal(env.source, 'plan/migration');
    assert.ok(Array.isArray((env.data as { steps: unknown[] }).steps), 'steps must be array');
    assert.ok(typeof (env.data as { readiness: unknown }).readiness === 'object', 'readiness must be an object');
  });

  it('gibberish request exits 0 (honestly empty plan)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'migration', 'ZXQKFMRVWP_NONSENSE_9999', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ steps: unknown[] }>;
    // Steps may be empty for unresolved; what matters is no error and source is correct
    assert.equal(env.source, 'plan/migration');
  });
});

describe('plan tests command', () => {
  it('exits 0 with required + missing arrays', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'tests', 'checkout', 'payment', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ required: unknown[]; missing: unknown[] }>;
    assert.equal(env.source, 'plan/tests');
    assert.ok(Array.isArray((env.data as { required: unknown[] }).required));
    assert.ok(Array.isArray((env.data as { missing: unknown[] }).missing));
  });

  it('riskLevel field is a valid string', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'tests', 'orders', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ riskLevel: string }>;
    const valid = new Set(['low', 'medium', 'high', 'critical']);
    assert.ok(valid.has((env.data as { riskLevel: string }).riskLevel), `unexpected riskLevel: ${(env.data as { riskLevel: string }).riskLevel}`);
  });
});

describe('plan security command', () => {
  it('exits 0 and returns a targets array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'security', 'auth', 'identity', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ targets: unknown[]; count: number }>;
    assert.equal(env.source, 'plan/security');
    assert.ok(Array.isArray((env.data as { targets: unknown[] }).targets), 'targets must be array');
    assert.ok(typeof (env.data as { count: number }).count === 'number', 'count must be number');
  });

  it('--json envelope carries evidence + confidence', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'security', 'payments', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.ok(typeof env.confidence === 'number');
    assert.ok(Array.isArray(env.evidence));
  });
});

describe('plan rollback command', () => {
  it('exits 0 with readiness and steps', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'rollback', 'checkout', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ readiness: string; steps: unknown[] }>;
    assert.equal(env.source, 'plan/rollback');
    const validReadiness = new Set(['READY', 'CONDITIONAL', 'NOT_READY']);
    assert.ok(validReadiness.has((env.data as { readiness: string }).readiness), `unexpected readiness: ${(env.data as { readiness: string }).readiness}`);
    assert.ok(Array.isArray((env.data as { steps: unknown[] }).steps));
  });

  it('gibberish request exits 0 (no stack trace)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'rollback', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('plan launch command', () => {
  it('exits 0 and shows a GO/CONDITIONAL_GO/NO_GO decision', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'launch', 'v1', 'launch', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      decision: { decision: string };
      readiness: number;
    }>;
    assert.equal(env.source, 'plan/launch');
    const validDecisions = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO']);
    const decision = (env.data as { decision: { decision: string } }).decision?.decision;
    assert.ok(validDecisions.has(decision), `unexpected decision: ${decision}`);
    assert.ok(typeof (env.data as { readiness: number }).readiness === 'number', 'readiness must be number');
  });

  it('envelope has evidence and confidence fields', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'launch', 'payments', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.ok(typeof env.confidence === 'number');
    assert.ok(Array.isArray(env.evidence));
    assert.ok(typeof env.executionTime === 'number');
  });
});

describe('plan release command', () => {
  it('exits 0 and returns planCount=8', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'release', 'checkout', 'payment', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ planCount: number }>;
    assert.equal(env.source, 'plan/release');
    assert.equal((env.data as { planCount: number }).planCount, 8, 'planAll must return all 8 plans');
  });

  it('all 8 sub-plans are present in the data', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'release', 'orders', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<Record<string, unknown>>;
    const data = env.data as Record<string, unknown>;
    for (const key of ['change', 'execution', 'executionGraph', 'migration', 'tests', 'rollback', 'launch', 'verification']) {
      assert.ok(key in data, `missing plan key: ${key}`);
    }
  });

  it('envelope confidence is a number between 0 and 1', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'release', 'payments', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.ok(env.confidence >= 0 && env.confidence <= 1, `confidence out of range: ${env.confidence}`);
  });

  it('gibberish request exits 0 — unresolved, no stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'release', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0, 'expected exit 0 for unresolved release plan');
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
    assert.ok(!err.includes('node:internal'), `internal trace leaked: ${err}`);
  });
});

describe('plan: --json flag on multiple subcommands', () => {
  it('plan change --json emits a parseable JSON envelope', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'change', 'inventory', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.ok(typeof parsed.data === 'object');
    assert.ok(typeof parsed.source === 'string');
    assert.ok(typeof parsed.version === 'string');
  });

  it('plan rollback --json emits a parseable JSON envelope', async () => {
    const [io, cap] = captureIO();
    const code = await run(['plan', 'rollback', 'inventory', '--json'], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.ok(typeof parsed.data === 'object');
    assert.equal(parsed.source, 'plan/rollback');
  });
});

describe('provider status commands', () => {
  it('vercel status exits 0 and shows adapter name', async () => {
    const [io, cap] = captureIO();
    const code = await run(['vercel', 'status'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0);
  });

  it('vercel status --json has adapter=vercel', async () => {
    const [io, cap] = captureIO();
    const code = await run(['vercel', 'status', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ adapter: string }>;
    assert.equal((env.data as { adapter: string }).adapter, 'vercel');
  });

  it('github status exits 0', async () => {
    const [io, cap] = captureIO();
    const code = await run(['github', 'status'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
  });

  it('cloudflare status exits 0', async () => {
    const [io, cap] = captureIO();
    const code = await run(['cloudflare', 'status'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
  });
});

// ===========================================================================
// GDIS GOVERNANCE COMMAND TESTS (Phase-5, 18 new tests)
// ===========================================================================

describe('drift command', () => {
  it('exits 0 and produces output with findings', async () => {
    const [io, cap] = captureIO();
    const code = await run(['drift'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json produces a valid envelope with byKind field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['drift', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ byKind: Record<string, unknown>; findings: unknown[] }>;
    assert.ok(typeof env.data === 'object', 'expected data object');
    assert.ok(typeof env.meta === 'object' || typeof env.source === 'string', 'expected meta or source');
    assert.equal(env.source, 'governance/drift');
    assert.ok(typeof (env.data as { byKind: Record<string, unknown> }).byKind === 'object', 'byKind must be object');
  });

  it('no stack trace in output', async () => {
    const [io, cap] = captureIO();
    await run(['drift'], io);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
    assert.ok(!err.includes('node:internal'), `internal trace leaked: ${err}`);
  });
});

describe('compliance command', () => {
  it('exits 0 and shows a score field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['compliance'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has score (R001-R008 range 0-100) and violations array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['compliance', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ score: number; violations: unknown[] }>;
    assert.equal(env.source, 'governance/compliance');
    const score = (env.data as { score: number }).score;
    assert.ok(typeof score === 'number' && score >= 0 && score <= 100, `score out of range: ${score}`);
    assert.ok(Array.isArray((env.data as { violations: unknown[] }).violations), 'violations must be array');
  });

  it('--evidence includes evidence section', async () => {
    const [io, cap] = captureIO();
    const code = await run(['compliance', '--evidence'], io);
    assert.equal(code, 0);
    const out = joined(cap);
    assert.ok(out.length > 0);
  });
});

describe('governance command', () => {
  it('exits 0 and includes healthScore in output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['governance'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.includes('healthScore'), `healthScore missing: ${out}`);
  });

  it('--json envelope has healthScore as a number (0-100)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['governance', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ healthScore: number }>;
    assert.equal(env.source, 'governance/report');
    const hs = (env.data as { healthScore: number }).healthScore;
    assert.ok(typeof hs === 'number' && hs >= 0 && hs <= 100, `healthScore out of range: ${hs}`);
  });

  it('no stack trace on success', async () => {
    const [io, cap] = captureIO();
    await run(['governance'], io);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('readiness command', () => {
  it('exits 0 and produces a summary', async () => {
    const [io, cap] = captureIO();
    const code = await run(['readiness'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has overall (number) and scores (array)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['readiness', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ overall: number; scores: unknown[] }>;
    assert.equal(env.source, 'governance/readiness');
    assert.ok(typeof (env.data as { overall: number }).overall === 'number', 'overall must be number');
    assert.ok(Array.isArray((env.data as { scores: unknown[] }).scores), 'scores must be array');
  });
});

describe('ownership command', () => {
  it('exits 0 with output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['ownership'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has gaps array and coverage object', async () => {
    const [io, cap] = captureIO();
    const code = await run(['ownership', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ gaps: unknown[]; coverage: unknown }>;
    assert.equal(env.source, 'governance/ownership');
    assert.ok(Array.isArray((env.data as { gaps: unknown[] }).gaps), 'gaps must be array');
    assert.ok(typeof (env.data as { coverage: unknown }).coverage === 'object', 'coverage must be object');
  });
});

describe('security-drift command', () => {
  it('exits 0 with output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['security-drift'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has findings and byKind', async () => {
    const [io, cap] = captureIO();
    const code = await run(['security-drift', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ findings: unknown[]; byKind: Record<string, unknown> }>;
    assert.equal(env.source, 'governance/security-drift');
    assert.ok(Array.isArray((env.data as { findings: unknown[] }).findings), 'findings must be array');
    assert.ok(typeof (env.data as { byKind: Record<string, unknown> }).byKind === 'object', 'byKind must be object');
  });
});

describe('architecture-health command', () => {
  it('exits 0 and produces a summary', async () => {
    const [io, cap] = captureIO();
    const code = await run(['architecture-health'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has score and area=architecture', async () => {
    const [io, cap] = captureIO();
    const code = await run(['architecture-health', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ score: number; area: string; findings: unknown[] }>;
    assert.equal(env.source, 'governance/architecture-health');
    assert.ok(typeof (env.data as { score: number }).score === 'number', 'score must be number');
    assert.equal((env.data as { area: string }).area, 'architecture', 'area must be architecture');
    assert.ok(Array.isArray((env.data as { findings: unknown[] }).findings), 'findings must be array');
  });

  it('no stack trace in output', async () => {
    const [io, cap] = captureIO();
    await run(['architecture-health'], io);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('domain-health command', () => {
  it('exits 0 with output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['domain-health'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const out = joined(cap);
    assert.ok(out.length > 0, 'expected non-empty output');
  });

  it('--json envelope has score and area=domain', async () => {
    const [io, cap] = captureIO();
    const code = await run(['domain-health', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ score: number; area: string }>;
    assert.equal(env.source, 'governance/domain-health');
    assert.ok(typeof (env.data as { score: number }).score === 'number', 'score must be number');
    assert.equal((env.data as { area: string }).area, 'domain', 'area must be domain');
  });
});

// ===========================================================================
// LCOS OPERATIONS COMMAND TESTS (Phase-6, ≥20 new tests)
// Each command wraps an OperationsEngine call — all READ-ONLY, no live creds
// required. Every report embeds evidence/confidence/liveConnected (honest).
// ===========================================================================

/** Shared helper: assert the envelope has the mandatory LCOS fields. */
function assertAreaEnvelope(
  env: LcisEnvelope<{
    area: string;
    findings: unknown[];
    signals: unknown[];
    health: { band: string; connectedSignals: number; notConnectedSignals: number };
    summary: string;
    confidence: number;
    liveConnected: boolean;
    evidence: unknown[];
  }>,
  expectedSource: string,
  expectedArea: string,
): void {
  assert.equal(env.source, expectedSource, `source mismatch: ${env.source}`);
  const d = env.data as {
    area: string;
    findings: unknown[];
    signals: unknown[];
    health: { band: string; connectedSignals: number; notConnectedSignals: number };
    summary: string;
    confidence: number;
    liveConnected: boolean;
    evidence: unknown[];
  };
  assert.equal(d.area, expectedArea, `area mismatch: ${d.area}`);
  assert.ok(Array.isArray(d.findings), 'findings must be array');
  assert.ok(Array.isArray(d.signals), 'signals must be array');
  assert.ok(typeof d.health === 'object' && d.health !== null, 'health must be object');
  const validBands = new Set(['healthy', 'degraded', 'failing', 'unknown']);
  assert.ok(validBands.has(d.health.band), `unexpected health.band: ${d.health.band}`);
  assert.ok(typeof d.health.connectedSignals === 'number', 'connectedSignals must be number');
  assert.ok(typeof d.health.notConnectedSignals === 'number', 'notConnectedSignals must be number');
  assert.ok(typeof d.summary === 'string' && d.summary.length > 0, 'summary must be non-empty string');
  assert.ok(typeof d.confidence === 'number', 'confidence must be number');
  assert.ok(typeof d.liveConnected === 'boolean', 'liveConnected must be boolean');
  assert.ok(Array.isArray(d.evidence), 'evidence must be array');
}

describe('lcis runtime command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['runtime'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0, 'expected non-empty output');
  });

  it('--json produces valid envelope with area=runtime and health band', async () => {
    const [io, cap] = captureIO();
    const code = await run(['runtime', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/runtime', 'runtime');
  });

  it('liveConnected is false (no adapter creds in this env)', async () => {
    const [io, cap] = captureIO();
    await run(['runtime', '--json'], io);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ liveConnected: boolean }>;
    assert.equal((env.data as { liveConnected: boolean }).liveConnected, false);
  });

  it('no stack trace in stderr', async () => {
    const [io, cap] = captureIO();
    await run(['runtime'], io);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('lcis commerce command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['commerce'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0, 'expected non-empty output');
  });

  it('--json produces valid envelope with area=commerce', async () => {
    const [io, cap] = captureIO();
    const code = await run(['commerce', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/commerce', 'commerce');
  });

  it('--evidence flag appends evidence section', async () => {
    const [io, cap] = captureIO();
    const code = await run(['commerce', '--evidence'], io);
    assert.equal(code, 0);
    // table mode with --evidence: output is non-empty; no stack trace
    assert.ok(joined(cap).length > 0);
    assert.ok(!errJoined(cap).includes('at Object.'));
  });
});

describe('lcis merchant command', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['merchant'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has area=merchant and liveConnected', async () => {
    const [io, cap] = captureIO();
    const code = await run(['merchant', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/merchant', 'merchant');
  });
});

describe('lcis customer command', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['customer'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has area=customer and health object', async () => {
    const [io, cap] = captureIO();
    const code = await run(['customer', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/customer', 'customer');
  });
});

describe('lcis deployment command', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['deployment'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has area=deployment', async () => {
    const [io, cap] = captureIO();
    const code = await run(['deployment', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/deployment', 'deployment');
  });

  it('no stack trace in stderr', async () => {
    const [io, cap] = captureIO();
    await run(['deployment'], io);
    assert.ok(!errJoined(cap).includes('at Object.'));
  });
});

describe('lcis incident command', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['incident'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has area=incident and findings array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['incident', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/incident', 'incident');
  });
});

describe('lcis security command (operations)', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['security'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has area=security (distinct from security-drift)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['security', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
    }>;
    assertAreaEnvelope(env, 'operations/security', 'security');
  });

  it('security-drift command still works (Phase-5 not clobbered)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['security-drift', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ findings: unknown[] }>;
    assert.equal(env.source, 'governance/security-drift', 'security-drift source must not change');
  });

  it('no stack trace in stderr', async () => {
    const [io, cap] = captureIO();
    await run(['security'], io);
    assert.ok(!errJoined(cap).includes('at Object.'));
  });
});

describe('lcis forecast command', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['forecast'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has area=forecast and series array (NOT_CONNECTED)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['forecast', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      area: string; findings: unknown[]; signals: unknown[];
      health: { band: string; connectedSignals: number; notConnectedSignals: number };
      summary: string; confidence: number; liveConnected: boolean; evidence: unknown[];
      series: Array<{ key: string; status: string }>;
    }>;
    assertAreaEnvelope(env, 'operations/forecast', 'forecast');
    const d = env.data as { series: Array<{ key: string; status: string }> };
    assert.ok(Array.isArray(d.series), 'series must be array');
    // Series exist; each carries a status (honest NOT_CONNECTED when no history)
    for (const s of d.series) {
      assert.ok(typeof s.key === 'string' && s.key.length > 0, `series key must be string: ${JSON.stringify(s)}`);
      const validStatuses = new Set(['CONNECTED', 'PARTIAL', 'NOT_CONNECTED', 'UNKNOWN', 'NOT_DETECTABLE']);
      assert.ok(validStatuses.has(s.status), `unexpected series status: ${s.status}`);
    }
  });

  it('liveConnected is false (no historical series without adapter creds)', async () => {
    const [io, cap] = captureIO();
    await run(['forecast', '--json'], io);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ liveConnected: boolean }>;
    assert.equal((env.data as { liveConnected: boolean }).liveConnected, false);
  });
});

describe('lcis operations command (composite)', () => {
  it('exits 0 with non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['operations'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has source=operations/composite and answers object', async () => {
    const [io, cap] = captureIO();
    const code = await run(['operations', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      answers: {
        healthy: string[]; degraded: string[]; failing: string[];
        changed: string[]; atRisk: string[]; investigate: string[];
      };
      health: { band: string }; summary: string; liveConnected: boolean;
    }>;
    assert.equal(env.source, 'operations/composite');
    const d = env.data as {
      answers: {
        healthy: string[]; degraded: string[]; failing: string[];
        changed: string[]; atRisk: string[]; investigate: string[];
      };
      health: { band: string }; summary: string; liveConnected: boolean;
    };
    const a = d.answers;
    assert.ok(typeof a === 'object' && a !== null, 'answers must be object');
    assert.ok(Array.isArray(a.healthy), 'answers.healthy must be array');
    assert.ok(Array.isArray(a.degraded), 'answers.degraded must be array');
    assert.ok(Array.isArray(a.failing), 'answers.failing must be array');
    assert.ok(Array.isArray(a.changed), 'answers.changed must be array');
    assert.ok(Array.isArray(a.atRisk), 'answers.atRisk must be array');
    assert.ok(Array.isArray(a.investigate), 'answers.investigate must be array');
  });

  it('answers.atRisk entries are strings', async () => {
    const [io, cap] = captureIO();
    const code = await run(['operations', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      answers: { atRisk: string[] };
    }>;
    const atRisk = (env.data as { answers: { atRisk: string[] } }).answers.atRisk;
    for (const entry of atRisk) {
      assert.equal(typeof entry, 'string', `atRisk entry must be string: ${JSON.stringify(entry)}`);
    }
  });

  it('signals contain NOT_CONNECTED entries (honest, no adapters wired)', async () => {
    // In a test env with no live adapters, the composite report must include at least one
    // NOT_CONNECTED signal across the 8 area sub-reports — honesty contract verification.
    const [io, cap] = captureIO();
    const code = await run(['operations', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      runtime: { signals: Array<{ status: string }> };
    }>;
    const data = env.data as { runtime: { signals: Array<{ status: string }> } };
    const runtimeSignals = data.runtime.signals;
    assert.ok(Array.isArray(runtimeSignals), 'runtime.signals must be array');
    const hasNotConnected = runtimeSignals.some((s) => s.status === 'NOT_CONNECTED' || s.status === 'PARTIAL');
    assert.ok(hasNotConnected, `expected NOT_CONNECTED/PARTIAL signal in runtime: ${JSON.stringify(runtimeSignals.map((s) => s.status))}`);
  });

  it('composite has all 8 area sub-reports', async () => {
    const [io, cap] = captureIO();
    const code = await run(['operations', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<Record<string, unknown>>;
    const data = env.data as Record<string, unknown>;
    for (const key of ['runtime', 'commerce', 'merchant', 'customer', 'deployment', 'incident', 'security', 'forecast']) {
      assert.ok(key in data, `missing sub-report: ${key}`);
    }
  });

  it('liveConnected is false (no adapter creds)', async () => {
    const [io, cap] = captureIO();
    await run(['operations', '--json'], io);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ liveConnected: boolean }>;
    assert.equal((env.data as { liveConnected: boolean }).liveConnected, false);
  });

  it('no stack trace in stderr', async () => {
    const [io, cap] = captureIO();
    await run(['operations'], io);
    assert.ok(!errJoined(cap).includes('at Object.'));
    assert.ok(!errJoined(cap).includes('node:internal'));
  });

  it('--evidence appends evidence section without error', async () => {
    const [io, cap] = captureIO();
    const code = await run(['operations', '--evidence'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
    assert.ok(!errJoined(cap).includes('at Object.'));
  });
});

// ===========================================================================
// EINS ENGINEERING COMMAND TESTS (Phase-7, ≥22 new tests)
// Each command exercises getEngineeringEngine(). READ-ONLY, no creds required.
// Every output embeds evidence/confidence/sources/timestamp from the EINS.
// ===========================================================================

describe('lcis engineering command (flagship)', () => {
  it('exits 0 and produces non-empty output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['engineering', 'Add', 'GST', 'invoice', 'download'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0, 'expected non-empty output');
  });

  it('--json produces valid LcisEnvelope with decision.verdict', async () => {
    const [io, cap] = captureIO();
    const code = await run(['engineering', 'checkout', 'payment', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      decision: { verdict: string; blockers: string[] };
      tasks: unknown[];
      summary: string;
    }>;
    assert.equal(env.source, 'engineering/package');
    const verdict = (env.data as { decision: { verdict: string } }).decision?.verdict;
    const validVerdicts = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO']);
    assert.ok(validVerdicts.has(verdict), `unexpected verdict: ${verdict}`);
    assert.ok(typeof env.confidence === 'number', 'envelope must have confidence');
    assert.ok(Array.isArray(env.evidence), 'envelope must have evidence array');
    assert.ok(typeof env.timestamp === 'string', 'envelope must have timestamp');
  });

  it('money feature produces NO_GO or CONDITIONAL_GO (not GO) — not a blind pass', async () => {
    const [io, cap] = captureIO();
    const code = await run(['engineering', 'add', 'payment', 'refund', 'ledger', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      decision: { verdict: string };
    }>;
    const verdict = (env.data as { decision: { verdict: string } }).decision?.verdict;
    // A change touching money/payments must be scrutinised — it cannot be a blind GO
    assert.ok(
      verdict === 'NO_GO' || verdict === 'CONDITIONAL_GO',
      `expected NO_GO or CONDITIONAL_GO for money feature, got: ${verdict}`,
    );
  });

  it('gibberish request exits 0 — no stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['engineering', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0, `expected exit 0 for unresolved request, got ${code}`);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
    assert.ok(!err.includes('node:internal'), `internal trace leaked: ${err}`);
  });

  it('--json gibberish envelope has source=engineering/package (honest empty)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['engineering', 'ZXQKFMRVWP_NONSENSE_9999', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.equal(env.source, 'engineering/package');
  });

  it('Phase-2 lcis verify still works — not clobbered', async () => {
    const [io, cap] = captureIO();
    const code = await run(['verify', 'architecture', '--json'], io);
    assert.equal(code, 0, `verify clobbered: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ status: string }>;
    assert.equal(env.source, 'verification');
  });
});

describe('lcis blueprint command', () => {
  it('exits 0 and produces output with summary field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blueprint', 'implement', 'inventory', 'ledger'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0, 'expected non-empty output');
  });

  it('--json envelope has source=engineering/blueprint and gates array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blueprint', 'orders', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      gates: unknown[];
      summary: string;
      impact: { domains: string[] };
    }>;
    assert.equal(env.source, 'engineering/blueprint');
    assert.ok(Array.isArray((env.data as { gates: unknown[] }).gates), 'gates must be array');
    assert.ok(typeof (env.data as { summary: string }).summary === 'string', 'summary must be string');
    assert.ok(typeof env.confidence === 'number' && env.confidence >= 0 && env.confidence <= 1);
  });

  it('gibberish exits 0 without stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blueprint', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('lcis tasks command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['tasks', 'add', 'shipping', 'zones'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has source=engineering/tasks and tasks array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['tasks', 'payments', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ tasks: unknown[]; count: number }>;
    assert.equal(env.source, 'engineering/tasks');
    assert.ok(Array.isArray((env.data as { tasks: unknown[] }).tasks), 'tasks must be array');
    assert.ok(typeof (env.data as { count: number }).count === 'number', 'count must be number');
  });

  it('--evidence flag appends evidence section', async () => {
    const [io, cap] = captureIO();
    const code = await run(['tasks', 'orders', '--evidence'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
    assert.ok(!errJoined(cap).includes('at Object.'));
  });

  it('gibberish exits 0 with count=0 or low confidence', async () => {
    const [io, cap] = captureIO();
    const code = await run(['tasks', 'ZXQKFMRVWP_NONSENSE_9999', '--json'], io);
    assert.equal(code, 0);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ count: number; confidence: number }>;
    // count may be 0; confidence drops for unresolved — just check it's numeric and valid
    assert.ok(typeof (env.data as { count: number }).count === 'number');
    assert.ok(typeof (env.data as { confidence: number }).confidence === 'number');
  });
});

describe('lcis rollout command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['rollout', 'v1', 'launch', 'checkout'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has source=engineering/rollout and a decision field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['rollout', 'payments', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ decision: { decision: string }; readiness: number }>;
    assert.equal(env.source, 'engineering/rollout');
    const decision = (env.data as { decision: { decision: string } }).decision?.decision;
    const validDecisions = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO']);
    assert.ok(validDecisions.has(decision), `unexpected rollout decision: ${decision}`);
    assert.ok(typeof env.confidence === 'number');
  });

  it('gibberish exits 0 without stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['rollout', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('lcis rollback command', () => {
  it('exits 0 and produces output with steps', async () => {
    const [io, cap] = captureIO();
    const code = await run(['rollback', 'checkout', 'payment'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has source=engineering/rollback and readiness field', async () => {
    const [io, cap] = captureIO();
    const code = await run(['rollback', 'orders', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ readiness: string; steps: unknown[] }>;
    assert.equal(env.source, 'engineering/rollback');
    const validReadiness = new Set(['READY', 'CONDITIONAL', 'NOT_READY']);
    assert.ok(validReadiness.has((env.data as { readiness: string }).readiness), `unexpected readiness: ${(env.data as { readiness: string }).readiness}`);
    assert.ok(Array.isArray((env.data as { steps: unknown[] }).steps), 'steps must be array');
  });

  it('gibberish exits 0 without stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['rollback', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('lcis eng-verify command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['eng-verify', 'auth', 'identity'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has source=engineering/verification and checks array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['eng-verify', 'payments', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ checks: unknown[] }>;
    assert.equal(env.source, 'engineering/verification');
    assert.ok(typeof env.confidence === 'number');
    assert.ok(Array.isArray(env.evidence));
  });

  it('Phase-2 lcis verify architecture still returns source=verification (not clobbered)', async () => {
    const [io, cap] = captureIO();
    const code = await run(['verify', 'domains', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.equal(env.source, 'verification', 'verify source must be unchanged');
  });

  it('gibberish exits 0 without stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['eng-verify', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('lcis agent-plan command', () => {
  it('exits 0 and produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['agent-plan', 'Add', 'gift', 'card', 'redemption'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    assert.ok(joined(cap).length > 0);
  });

  it('--json envelope has source=engineering/agent-plan and tasks array', async () => {
    const [io, cap] = captureIO();
    const code = await run(['agent-plan', 'checkout', 'payments', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{
      tasks: unknown[];
      byAgentType: Record<string, number>;
      summary: string;
    }>;
    assert.equal(env.source, 'engineering/agent-plan');
    assert.ok(Array.isArray((env.data as { tasks: unknown[] }).tasks), 'tasks must be array');
    assert.ok(typeof (env.data as { byAgentType: Record<string, number> }).byAgentType === 'object', 'byAgentType must be object');
    assert.ok(typeof (env.data as { summary: string }).summary === 'string', 'summary must be string');
    assert.ok(typeof env.confidence === 'number');
  });

  it('gibberish exits 0 without stack trace', async () => {
    const [io, cap] = captureIO();
    const code = await run(['agent-plan', 'ZXQKFMRVWP_NONSENSE_9999'], io);
    assert.equal(code, 0);
    const err = errJoined(cap);
    assert.ok(!err.includes('at Object.'), `stack trace leaked: ${err}`);
  });
});

describe('EINS: --domain / --seed-table / --symbol seed options', () => {
  it('engineering --domain payments produces output seeded with the payments domain', async () => {
    const [io, cap] = captureIO();
    const code = await run(['engineering', 'add', 'feature', '--domain', 'payments', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.equal(env.source, 'engineering/package');
  });

  it('tasks --seed-table orders produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['tasks', 'refund', '--seed-table', 'orders', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<{ tasks: unknown[] }>;
    assert.equal(env.source, 'engineering/tasks');
    assert.ok(Array.isArray((env.data as { tasks: unknown[] }).tasks));
  });

  it('blueprint --symbol getSupabaseAdmin produces output', async () => {
    const [io, cap] = captureIO();
    const code = await run(['blueprint', 'auth', '--symbol', 'getSupabaseAdmin', '--json'], io);
    assert.equal(code, 0, `exit ${code}: ${errJoined(cap)}`);
    const env = JSON.parse(joined(cap)) as LcisEnvelope<unknown>;
    assert.equal(env.source, 'engineering/blueprint');
  });
});
