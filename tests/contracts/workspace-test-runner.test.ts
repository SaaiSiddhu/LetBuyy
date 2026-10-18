import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const deployableWorkspaces = [
    'apps/frozen/app-store',
    'apps/frozen/developer-portal',
    'apps/platform/identity',
    'apps/marketing/web',
    'apps/merchant/web',
    'apps/internal/console',
    'apps/frozen/operations-portal',
    'apps/commerce/web',
    'apps/frozen/theme-store',
    'services/api-gateway',
    'services/queue-workers',
    'services/webhook-service',
];

function readPackageJson(workspace: string) {
    return JSON.parse(readFileSync(join(repoRoot, workspace, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>
    };
}

test('deployable workspaces run real test commands instead of no-op placeholders', () => {
    for (const workspace of deployableWorkspaces) {
        const testScript = readPackageJson(workspace).scripts?.test || '';
        assert.notEqual(testScript, '', `${workspace} must define a test script`);
        assert.doesNotMatch(testScript, /No tests yet|echo\s+['"]?No tests|exit\s+0/i, `${workspace} test script must not be a no-op`);
        assert.match(testScript, /node --test|tsx --test|pnpm exec tsx --test/, `${workspace} test script must invoke a real test runner`);
    }
});

test('root and governance runners include workspace and TypeScript contract tests', () => {
    const rootPackageJson = readPackageJson('.');
    // The root `test` script runs the behavioral wrapper AND the contract tests, and always both: the
    // wrapper takes `--with-contracts` instead of the old `a && b` chain, which never ran the contract
    // tests once the first part had failed and so hid a whole lane behind the first red.
    assert.match(rootPackageJson.scripts?.test || '', /node scripts\/governance\/test-behavioral\.mjs --with-contracts/);
    assert.doesNotMatch(rootPackageJson.scripts?.test || '', /&&/, 'a short-circuiting chain hides every part after the first failure');
    // SUSTAINED-J: test:behavioral delegates to scripts/governance/test-behavioral.mjs; the next test
    // checks that wrapper covers the full tests/*/*.test.mjs surface.
    assert.match(rootPackageJson.scripts?.['test:behavioral'] || '', /node scripts\/governance\/test-behavioral\.mjs/);
    assert.match(rootPackageJson.scripts?.['test:workspaces'] || '', /turbo test/);
    assert.equal(rootPackageJson.scripts?.['test:contracts'], 'tsx --test tests/contracts/*.test.ts');
});

test('behavioral and explicit native CI lanes cover every tests/*/*.test.mjs suite exactly once', async () => {
    const { discoverSuites, EXPLICIT_RUNTIME_SUITES } = await import('../../scripts/governance/test-suite-catalog.mjs');
    const { all, pure, postgres, live } = discoverSuites(repoRoot) as Record<string, string[]>;
    // The surface `tests/*/*.test.mjs` would glob, computed without the catalog.
    const globbed = readdirSync(join(repoRoot, 'tests'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((dir) => readdirSync(join(repoRoot, 'tests', dir.name)).filter((name) => name.endsWith('.test.mjs')).map((name) => `tests/${dir.name}/${name}`))
        .sort();
    assert.deepEqual([...all, ...EXPLICIT_RUNTIME_SUITES].sort(), globbed);
    assert.deepEqual([...pure, ...postgres, ...live, ...EXPLICIT_RUNTIME_SUITES].sort(), globbed, 'every suite is classified, none twice');
    const ci=readFileSync(join(repoRoot,'.github/workflows/ci.yml'),'utf8');
    for(const runtime of EXPLICIT_RUNTIME_SUITES) assert.ok(ci.includes(`node --test ${runtime}`), `${runtime} must have an explicit CI invocation`);

    const wrapper = readFileSync(join(repoRoot, 'scripts/governance/test-behavioral.mjs'), 'utf8');
    assert.match(wrapper, /'node', \['--test', '--test-concurrency=1', \.\.\.pure, \.\.\.live\]/, 'database-free suites keep the sequential node --test invocation');
    assert.match(wrapper, /scripts\/governance\/run-executable-suites\.mjs/, 'Postgres-backed suites go through the owned-cluster runner');
    assert.doesNotMatch(wrapper, /foundation-ephemeral-postgres/, 'the shared fixture is not part of the gate');
});

// customer-web and merchant-web list their test files by hand, and `node --test` reads every path argument as a GLOB. Two
// failure modes follow, and both end in a green run that executed nothing: a test file that is never named in the script is
// simply never run, and a path containing glob characters (the [subdomain] directory of a Next dynamic route is a character
// class) matches no file, so the runner reports 0 tests and exits 0. This pins that neither can happen unnoticed.
for (const workspace of ['apps/commerce/web', 'apps/merchant/web']) {
    test(`${workspace} names every test file it owns, and every named test path is a literal file that exists`, () => {
        const script = readPackageJson(workspace).scripts?.test || '';

        // The script is a chain: the first segments run from the app directory, everything after `cd ../../..` from the repo root.
        let cwd = join(repoRoot, workspace);
        const listed = new Set<string>();
        for (const segment of script.split('&&').map((part) => part.trim())) {
            if (/^cd\s+\.\.\/\.\.\/\.\.$/.test(segment)) { cwd = repoRoot; continue; }
            for (const token of segment.split(/\s+/)) {
                const path = token.replace(/^["']|["']$/g, '');
                if (!/\.test\.(ts|tsx|mjs)$/.test(path)) continue;
                assert.doesNotMatch(path, /[[\]*?{}]/, `${path} contains glob characters: node --test would match nothing and report 0 tests with exit 0`);
                assert.ok(existsSync(join(cwd, path)), `${path} is named in the test script but does not exist`);
                listed.add(join(cwd, path));
            }
        }
        assert.ok(listed.size > 0, 'the test script names at least one test');

        const owned: string[] = [];
        const walk = (dir: string) => {
            for (const entry of readdirSync(join(repoRoot, workspace, dir), { withFileTypes: true })) {
                const relative = `${dir}/${entry.name}`;
                if (entry.isDirectory()) walk(relative);
                else if (/\.test\.(ts|tsx|mjs)$/.test(entry.name)) owned.push(relative);
            }
        };
        for (const dir of ['src', 'scripts', 'tests']) if (existsSync(join(repoRoot, workspace, dir))) walk(dir);
        assert.ok(owned.length > 0, 'the workspace owns at least one test file');
        assert.deepEqual(
            owned.filter((file) => !listed.has(join(repoRoot, workspace, file))).sort(),
            [],
            'a test file under src/, scripts/ or tests/ that the test script never names is never run',
        );
    });
}

test('main CI runs the behavioral gate before filtered workspace tests', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const behavioralIndex = workflow.indexOf('pnpm run test:behavioral');
    const filteredWorkspaceIndex = workflow.indexOf('pnpm turbo test --filter="...[HEAD^1]"');

    assert.notEqual(behavioralIndex, -1, 'CI must run the root behavioral gate');
    assert.notEqual(filteredWorkspaceIndex, -1, 'CI must run filtered workspace tests');
    assert.ok(
        behavioralIndex < filteredWorkspaceIndex,
        'behavioral gate must run before filtered workspace tests so root tests are not skipped by workspace filters',
    );
});
