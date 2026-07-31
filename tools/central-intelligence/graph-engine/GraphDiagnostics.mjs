/**
 * LCIS Graph Intelligence Engine — GraphDiagnostics
 * Health checks, dependency verification, and metrics for the graph subsystem.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPHRAG_ROOT = path.join(__dirname, 'graphrag');
const GRAPHRAG_OUTPUT = path.join(GRAPHRAG_ROOT, 'output');
const ARTIFACTS_DIR = path.join(GRAPHRAG_OUTPUT, 'artifacts');
const GRAPHRAG_INPUT = path.join(GRAPHRAG_ROOT, 'input');

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check whether a Python package is importable.
 * @param {string} pkg - importable package name
 * @returns {boolean}
 */
function isPythonPackageAvailable(pkg) {
  const result = spawnSync('python3', ['-c', `import ${pkg}`], {
    timeout: 8_000,
    encoding: 'utf8',
  });
  return result.status === 0;
}

/**
 * Run `python3 --version` and return the version string or null.
 * @returns {string|null}
 */
function getPython3Version() {
  const result = spawnSync('python3', ['--version'], {
    timeout: 5_000,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return (result.stdout || result.stderr || '').trim();
}

/**
 * Count .parquet files whose name starts with a given prefix in ARTIFACTS_DIR.
 * @param {string} prefix
 * @returns {number}
 */
function countArtifactFiles(prefix) {
  if (!fs.existsSync(ARTIFACTS_DIR)) return 0;
  return fs.readdirSync(ARTIFACTS_DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.parquet')).length;
}

/**
 * Attempt to read a numeric count from a JSON summary file if present.
 * GraphRAG may emit a summary JSON at output/artifacts/statistics.json or similar.
 * @param {string} field
 * @returns {number}
 */
function readSummaryField(field) {
  const candidates = ['statistics.json', 'summary.json', 'index_stats.json'].map((n) =>
    path.join(ARTIFACTS_DIR, n)
  );
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      try {
        const data = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (typeof data[field] === 'number') return data[field];
      } catch {
        // not parseable, skip
      }
    }
  }
  return 0;
}

class GraphDiagnostics {
  /**
   * Return the overall health status of the graph intelligence engine.
   * @returns {{status:'HEALTHY'|'NOT BUILT'|'STALE',graphrag:'INSTALLED'|'NOT FOUND',indexExists:boolean,lastBuilt:string|null,entityCount:number}}
   */
  getHealth() {
    // Check graphrag CLI.
    const graphragResult = spawnSync('python3', ['-m', 'graphrag', '--help'], {
      timeout: 8_000,
      encoding: 'utf8',
    });
    const graphragInstalled = graphragResult.status === 0;

    // Check index existence.
    const indexExists =
      fs.existsSync(ARTIFACTS_DIR) && fs.readdirSync(ARTIFACTS_DIR).length > 0;

    let lastBuilt = null;
    let isStale = false;
    if (indexExists) {
      const stat = fs.statSync(ARTIFACTS_DIR);
      lastBuilt = stat.mtime.toISOString();
      isStale = Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS;
    }

    const entityCount = readSummaryField('entity_count') || countArtifactFiles('entities');

    let status;
    if (!indexExists) {
      status = 'NOT BUILT';
    } else if (isStale) {
      status = 'STALE';
    } else {
      status = 'HEALTHY';
    }

    return {
      status,
      graphrag: graphragInstalled ? 'INSTALLED' : 'NOT FOUND',
      indexExists,
      lastBuilt,
      entityCount,
    };
  }

  /**
   * Run a self-test: check dependencies, validate input dir, and verify output dir.
   * @returns {{passed:boolean,checks:Array<{name:string,passed:boolean,detail:string}>}}
   */
  runSelfTest() {
    const checks = [];

    // 1. python3 available
    const py3Version = getPython3Version();
    checks.push({
      name: 'python3 available',
      passed: py3Version !== null,
      detail: py3Version || 'python3 not found on PATH',
    });

    // 2. graphrag importable
    const graphragOk = isPythonPackageAvailable('graphrag');
    checks.push({
      name: 'graphrag importable',
      passed: graphragOk,
      detail: graphragOk ? 'graphrag package importable' : 'Run: pip install graphrag>=0.3.6',
    });

    // 3. OPENAI_API_KEY present
    const apiKeyPresent = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0;
    checks.push({
      name: 'OPENAI_API_KEY set',
      passed: apiKeyPresent,
      detail: apiKeyPresent ? 'API key is set' : 'OPENAI_API_KEY environment variable is missing',
    });

    // 4. graphrag/settings.yml present
    const settingsPath = path.join(GRAPHRAG_ROOT, 'settings.yml');
    const settingsExists = fs.existsSync(settingsPath);
    checks.push({
      name: 'settings.yml present',
      passed: settingsExists,
      detail: settingsExists ? settingsPath : `Missing: ${settingsPath}`,
    });

    // 5. graphrag/input/ directory exists
    const inputExists = fs.existsSync(GRAPHRAG_INPUT);
    const inputCount = inputExists ? fs.readdirSync(GRAPHRAG_INPUT).length : 0;
    checks.push({
      name: 'input directory populated',
      passed: inputExists && inputCount > 0,
      detail: inputExists ? `${inputCount} file(s) in input/` : 'input/ directory missing — run indexer first',
    });

    // 6. index built (artifacts dir non-empty)
    const artifactsOk = fs.existsSync(ARTIFACTS_DIR) && fs.readdirSync(ARTIFACTS_DIR).length > 0;
    checks.push({
      name: 'index artifacts present',
      passed: artifactsOk,
      detail: artifactsOk ? `Artifacts at ${ARTIFACTS_DIR}` : 'No artifacts — run GraphBuilder.buildFull()',
    });

    const passed = checks.every((c) => c.passed);
    return { passed, checks };
  }

  /**
   * Verify all runtime dependencies are satisfied.
   * @returns {{python3:string|null,graphrag:boolean,lancedb:boolean,pyarrow:boolean,pandas:boolean,openaiApiKey:boolean}}
   */
  checkDependencies() {
    return {
      python3: getPython3Version(),
      graphrag: isPythonPackageAvailable('graphrag'),
      lancedb: isPythonPackageAvailable('lancedb'),
      pyarrow: isPythonPackageAvailable('pyarrow'),
      pandas: isPythonPackageAvailable('pandas'),
      openaiApiKey: typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0,
    };
  }

  /**
   * Read entity, relationship, and community counts from the output artifacts directory.
   * Returns best-effort counts — either from a summary JSON or from parquet file presence.
   * @returns {{entityCount:number,relationshipCount:number,communityCount:number,artifactsDir:string,artifactsPresent:boolean}}
   */
  getMetrics() {
    const artifactsPresent = fs.existsSync(ARTIFACTS_DIR) && fs.readdirSync(ARTIFACTS_DIR).length > 0;

    const entityCount = readSummaryField('entity_count') || countArtifactFiles('entities');
    const relationshipCount = readSummaryField('relationship_count') || countArtifactFiles('relationships');
    const communityCount = readSummaryField('community_count') || countArtifactFiles('communities');

    return {
      entityCount,
      relationshipCount,
      communityCount,
      artifactsDir: ARTIFACTS_DIR,
      artifactsPresent,
    };
  }
}

export default new GraphDiagnostics();
