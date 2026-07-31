/**
 * LPAS Phase 13 — mandatory security review source-scan tests.
 *
 * Mirrors packages/lcis-twin/test/security.test.ts EXACTLY (structure, per-file loops,
 * DB-token and envelope-clock refinements) with LPAS-specific adaptations:
 *
 *   • coverage gate checks the LPAS src tree (shared/ only for now, no engine.ts yet)
 *   • dependency allowlist is the LPAS contract:
 *       @letbuyy/lcis-adapters, @letbuyy/lcis-core, @letbuyy/lcis-operations,
 *       @letbuyy/lcis-twin, zod
 *   • LPAS advisory-only scan: no src file may contain mutation-hint tokens
 *       'scale(' (as a mutation call), '.deploy(', 'applyRecommendation', 'execute('
 *   • The literal string 'advisory: true' must appear in any RecommendationService source
 *     (grepped across all src files if the file exists; skipped with a note if absent).
 *
 * RULE: READ ONLY, deterministic, injectable clock. These tests enforce that invariant
 * against every .ts file under src/.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = new URL('../src', import.meta.url).pathname;
const PKG_JSON = new URL('../package.json', import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function strippedSource(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc)
    .replace(/\/\/.*$/gm, '');         // single-line comments
}

const SRC_FILES = walk(SRC_ROOT);

/** Execution / shell primitives — LPAS must never run anything. */
const FORBIDDEN_EXECUTION = [
  'child_process',
  'spawn(',
  'spawnSync',
  'execSync',
  'execFile',
  ' exec(',
  '.exec(',
  'eval(',
  'new Function(',
];

/** Filesystem mutation primitives — LPAS must never write, delete, or move files. */
const FORBIDDEN_FS_WRITE = [
  'writeFile',
  'appendFile',
  'unlink',
  'rmSync',
  'rmdir',
  'mkdir',
  'renameSync',
  'rename(',
  'copyFile',
  'chmod',
  'chown',
  'truncate',
  'createWriteStream',
];

/** Network primitives — LPAS is a pure computation layer; it makes no outbound calls. */
const FORBIDDEN_NETWORK = [
  'fetch(',
  'XMLHttpRequest',
  'new WebSocket',
  'http.request',
  'https.request',
  'net.connect',
  'net.createServer',
  'dgram.',
];

/** Module imports that would even make the above possible. */
const FORBIDDEN_IMPORTS = [
  "from 'node:child_process'",
  'from "node:child_process"',
  "from 'child_process'",
  "from 'node:fs'",
  'from "node:fs"',
  "from 'fs'",
  "from 'node:fs/promises'",
  "from 'node:http'",
  "from 'node:https'",
  "from 'node:net'",
  "from 'node:dgram'",
  "from 'node:worker_threads'",
  "from 'node:cluster'",
  'require(',
];

// ── Coverage gate ──────────────────────────────────────────────────────────────

test('security scan: src tree is non-empty and contains shared/ files', () => {
  assert.ok(
    SRC_FILES.length >= 2,
    `expected >= 2 source files, found ${SRC_FILES.length}`,
  );
  assert.ok(
    SRC_FILES.some((f) => f.includes('/src/shared/')),
    'no files scanned under src/shared/',
  );
});

test('security scan: shared/types.ts is present in the scan', () => {
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('shared/types.ts')),
    'shared/types.ts missing from scan',
  );
});

test('security scan: shared/envelope.ts is present in the scan', () => {
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('shared/envelope.ts')),
    'shared/envelope.ts missing from scan',
  );
});

test('security scan: shared/rules.ts is present in the scan', () => {
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('shared/rules.ts')),
    'shared/rules.ts missing from scan',
  );
});

// ── Per-file per-category forbids ─────────────────────────────────────────────

for (const file of SRC_FILES) {
  const rel = file.slice(SRC_ROOT.length + 1);
  const src = strippedSource(file);

  test(`NO EXEC — ${rel} has no execution/shell primitives`, () => {
    for (const tok of FORBIDDEN_EXECUTION) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden execution token: '${tok}'`);
    }
  });

  test(`NO WRITE — ${rel} has no filesystem mutation primitives`, () => {
    for (const tok of FORBIDDEN_FS_WRITE) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden fs-write token: '${tok}'`);
    }
  });

  test(`NO NETWORK — ${rel} has no network primitives`, () => {
    for (const tok of FORBIDDEN_NETWORK) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden network token: '${tok}'`);
    }
  });

  test(`NO IO IMPORTS — ${rel} imports no fs/net/process/child_process modules`, () => {
    for (const tok of FORBIDDEN_IMPORTS) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden import: '${tok}'`);
    }
  });

  test(`NO DB MUTATION — ${rel} has no insert/update/upsert/rpc/from calls`, () => {
    // '.delete(' is intentionally absent: in-memory Set/Map.delete() is legitimate and
    // no DB client exists in this package (see the dependency allowlist test) —
    // DB deletes are unreachable without '.from('/'.rpc(' first.
    for (const tok of ['.insert(', '.update(', '.upsert(', '.rpc(', '.from(']) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden DB mutation token: '${tok}'`);
    }
  });

  test(`NO WALL CLOCK — ${rel} has no argless Date.now() or new Date() calls`, () => {
    // The clock must always be injectable; argless Date.now() and new Date() (no arg) are
    // banned everywhere EXCEPT shared/envelope.ts — the single sanctioned clock boundary
    // (defaultNow), mirroring the fetch-only-in-http.ts pattern in lcis-adapters.
    if (rel.endsWith('shared/envelope.ts')) {
      // envelope.ts may define defaultNow via new Date(); Date.now() stays banned even there.
      assert.ok(
        !src.includes('Date.now('),
        `${rel} contains forbidden wall-clock call: 'Date.now('`,
      );
      return;
    }
    assert.ok(
      !src.includes('Date.now('),
      `${rel} contains forbidden wall-clock call: 'Date.now('`,
    );
    assert.ok(
      !src.match(/new Date\(\)/),
      `${rel} contains forbidden argless wall-clock call: 'new Date()'`,
    );
  });
}

// ── Whole-corpus AI token check ───────────────────────────────────────────────

test('NO AI — src has no LLM/embedding/vector-db imports or clients', () => {
  const all = SRC_FILES.map(strippedSource).join('\n');
  for (const tok of [
    'openai',
    'anthropic',
    'embedding',
    'qdrant',
    'Qdrant',
    'langchain',
    'llm(',
    'LLM(',
  ]) {
    assert.ok(!all.includes(tok), `src contains forbidden AI token: '${tok}'`);
  }
});

// ── LPAS advisory-only mutation scan ─────────────────────────────────────────
//
// LPAS recommendations are ADVISORY ONLY. No src file may contain tokens that
// indicate mutation, deployment, or execution of advice:
//   • '.deploy('   — LPAS never deploys anything
//   • 'applyRecommendation'  — no code path applies a recommendation
//   • 'execute('   — LPAS never executes operations
//   • 'scale(' used as a mutation call — LPAS models capacity, never scales infra
//
// Note: 'scale(' is checked only in the joined corpus because the word can appear in
// comments about scaling projections (which are stripped before the check).

test('NO MUTATION HINTS — no src file contains .deploy( call', () => {
  for (const file of SRC_FILES) {
    const rel = file.slice(SRC_ROOT.length + 1);
    const src = strippedSource(file);
    assert.ok(
      !src.includes('.deploy('),
      `${rel} contains forbidden mutation-hint token: '.deploy('`,
    );
  }
});

test('NO MUTATION HINTS — no src file contains applyRecommendation', () => {
  for (const file of SRC_FILES) {
    const rel = file.slice(SRC_ROOT.length + 1);
    const src = strippedSource(file);
    assert.ok(
      !src.includes('applyRecommendation'),
      `${rel} contains forbidden advisory-violation token: 'applyRecommendation'`,
    );
  }
});

test('NO MUTATION HINTS — no src file contains execute( call', () => {
  for (const file of SRC_FILES) {
    const rel = file.slice(SRC_ROOT.length + 1);
    const src = strippedSource(file);
    assert.ok(
      !src.includes('execute('),
      `${rel} contains forbidden mutation-hint token: 'execute('`,
    );
  }
});

test('NO MUTATION HINTS — no src file contains scale( as a mutation call', () => {
  // Strip comments first so structural mentions of scaling math do not trigger.
  const all = SRC_FILES.map(strippedSource).join('\n');
  // We forbid '.scale(' (method call on an object) as the mutation-intent form.
  assert.ok(
    !all.includes('.scale('),
    `src contains forbidden mutation-hint token: '.scale(' (infrastructure scaling call)`,
  );
});

// ── advisory: true corpus check ───────────────────────────────────────────────
//
// The literal string 'advisory: true' must appear in any RecommendationService source.
// If no RecommendationService file exists yet, we verify the literal appears in the
// frozen types contract (types.ts declares advisory: true as a required literal type).

test('ADVISORY ONLY — advisory: true literal present in shared/types.ts (frozen Recommendation contract)', () => {
  const typesFile = SRC_FILES.find((f) => f.endsWith('shared/types.ts'));
  assert.ok(typesFile !== undefined, 'shared/types.ts not found');
  const raw = readFileSync(typesFile!, 'utf8'); // raw source (comments intact) — the literal lives in the JSDoc and type
  assert.ok(
    raw.includes('advisory: true'),
    'shared/types.ts does not contain the required literal "advisory: true"',
  );
});

test('ADVISORY ONLY — if a RecommendationService file exists it must contain advisory: true', () => {
  const recFile = SRC_FILES.find((f) => f.toLowerCase().includes('recommendation'));
  if (recFile === undefined) {
    // No RecommendationService yet — the base contract in types.ts is sufficient.
    // This test is a future-proof guard; it passes vacuously until the file is added.
    assert.ok(true, 'No RecommendationService source present yet — vacuously passing');
    return;
  }
  const raw = readFileSync(recFile, 'utf8');
  assert.ok(
    raw.includes('advisory: true'),
    `${recFile.slice(SRC_ROOT.length + 1)} contains a recommendation service but not the literal 'advisory: true'`,
  );
});

// ── Package-level governance ──────────────────────────────────────────────────

test('dependencies are exactly the approved composition targets (lcis-adapters + lcis-core + lcis-operations + lcis-twin + zod)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {}).sort();
  assert.deepEqual(deps, [
    '@letbuyy/lcis-adapters',
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-operations',
    '@letbuyy/lcis-twin',
    'zod',
  ]);
});

test('package.json scripts contain no mutation verbs (deploy/push/publish/migrate)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = Object.values(pkg.scripts ?? {}).join(' ');
  for (const verb of ['deploy', 'push', 'publish', 'migrate']) {
    assert.ok(
      !scripts.includes(verb),
      `package.json scripts contain forbidden verb: '${verb}'`,
    );
  }
});

test('package.json has a name and it is the correct LPAS package', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { name?: string };
  assert.equal(pkg.name, '@letbuyy/lcis-performance');
});

test('package.json type is "module" (ESM-only — no CommonJS)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { type?: string };
  assert.equal(pkg.type, 'module');
});

test('NO defaultNow CALL — defaultNow() in production code is only at the definition site (envelope.ts)', () => {
  // Only envelope.ts is permitted to define/call defaultNow() because it is the injectable
  // clock provider. Any other src file that calls defaultNow() without injection breaks
  // the LPAS determinism guarantee. We allow the definition in envelope.ts but forbid
  // usage (invocation) elsewhere.
  const nonEnvelope = SRC_FILES.filter((f) => !f.endsWith('shared/envelope.ts'));
  for (const file of nonEnvelope) {
    const src = strippedSource(file);
    // Allow import of defaultNow (type-level or value import) but forbid calling it.
    // Concretely: 'defaultNow()' (invocation) must not appear outside envelope.ts.
    assert.ok(
      !src.includes('defaultNow()'),
      `${file.slice(SRC_ROOT.length + 1)} calls defaultNow() directly — pass the now() parameter instead`,
    );
  }
});
