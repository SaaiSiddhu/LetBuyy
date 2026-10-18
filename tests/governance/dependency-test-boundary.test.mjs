import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSuites, GATEWAY_DB_SUITE_DIR, ROOT_GATEWAY_DB_SUITES, isGatewayDatabaseSuite } from '../../scripts/governance/test-suite-catalog.mjs';

const validator = fileURLToPath(new URL('../../scripts/validators/dependency-graph-validator.mjs', import.meta.url));
function fixture(action) {
    const root = mkdtempSync(join(tmpdir(), 'letbuyy-test-boundary-'));
    const write = (file, text = '') => { const target = join(root, file); mkdirSync(dirname(target), {recursive:true}); writeFileSync(target, text); };
    try { return action(root, write); } finally { rmSync(root, {recursive:true, force:true}); }
}
function graph(root) {
    assert.equal(spawnSync('git', ['init', '-q'], {cwd:root}).status, 0);
    const result = spawnSync(process.execPath, [validator], {cwd:root, encoding:'utf8', timeout:20000});
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    return result;
}
const badSources = [
    ['service relative import', 'services/api-gateway/src/rogue.ts', source => `import '${source}';`],
    ['app relative export', 'apps/merchant/web/src/rogue.ts', source => `export * from '${source}';`],
    ['package dynamic import', 'packages/commerce-core/src/rogue.ts', source => `const x = import('${source}');`],
    ['test-named runtime source', 'services/api-gateway/src/innocent.test.ts', source => `const x = require('${source}');`],
    ['direct test-root specifier', 'services/api-gateway/src/rogue.ts', () => "import 'tests/helpers/private';"],
    ['canonical source alias traversal', 'services/api-gateway/src/rogue.ts', () => "import '@/../../../tests/helpers/private';"],
    ['configured compiler alias', 'services/api-gateway/src/rogue.ts', () => "import '@fixture/private';"],
];
for (const [name, file, source] of badSources) test(`runtime dependency boundary refuses ${name}`, () => fixture((root, write) => {
    write('tests/helpers/private.ts', 'export const privateFixture = true;');
    write('services/api-gateway/tsconfig.json', JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@fixture/*':['../../tests/helpers/*']}}}));
    write(file, source(relative(dirname(file), 'tests/helpers/private').split('\\').join('/')));
    const result = graph(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /may not import root test code/);
}));

test('ordinary production package edges and root integration composition remain visible and valid', () => fixture((root, write) => {
    write('packages/shared-types/src/index.ts', 'export const version = 1;');
    write('services/api-gateway/src/index.ts', "import '../../../packages/shared-types/src/index';");
    write('tests/owned-db/synthetic.test.ts', "import '../../services/api-gateway/src/index';");
    const result = graph(root); assert.equal(result.status, 0, result.stderr);
}));

function catalogFixture(action) { return fixture((root, write) => {
    for (const suite of ROOT_GATEWAY_DB_SUITES) write(suite, 'requireOwnedDatabase();');
    write(`${GATEWAY_DB_SUITE_DIR}/original.test.ts`, 'requireOwnedDatabase();');
    write('tests/owned-device/synthetic-device.test.ts', 'throw new Error("device requires explicit ownership");');
    return action(root, write);
}); }
test('relocated suites auto-discover once in the same gateway-db lane; devices never auto-discover', () => catalogFixture(root => {
    const catalog = discoverSuites(root);
    assert.deepEqual(catalog.gatewayDb, [`${GATEWAY_DB_SUITE_DIR}/original.test.ts`, ...ROOT_GATEWAY_DB_SUITES]);
    assert.ok(catalog.gatewayDb.every(isGatewayDatabaseSuite));
    assert.deepEqual(catalog.all, []);
    assert.ok(!catalog.gatewayDb.some(path => path.includes('owned-device')));
    assert.equal(isGatewayDatabaseSuite('tests/owned-db/../owned-db/ad-credit-purchase.postgres.test.ts'), false);
}));
test('catalog rejects an unregistered root extra instead of dropping or reclassifying it', () => catalogFixture((root, write) => {
    write('tests/owned-db/unregistered.test.ts');
    assert.throws(() => discoverSuites(root), /inventory mismatch; unregistered: tests\/owned-db\/unregistered/);
}));
test('catalog rejects a missing relocated suite', () => catalogFixture(root => {
    rmSync(join(root, ROOT_GATEWAY_DB_SUITES[0]));
    assert.throws(() => discoverSuites(root), /inventory mismatch.*missing:/);
}));
test('catalog rejects duplicate basenames across the old and root owned lanes', () => catalogFixture((root, write) => {
    write(`${GATEWAY_DB_SUITE_DIR}/ad-credit-purchase.postgres.test.ts`);
    assert.throws(() => discoverSuites(root), /duplicate gateway-db suite basenames/);
}));
test('catalog refuses external and broken linked suites', () => catalogFixture((root, write) => {
    write('external/private.ts');
    for (const target of ['external/private.ts', 'external/missing.ts']) {
        const suite = join(root, ROOT_GATEWAY_DB_SUITES[0]); rmSync(suite);
        symlinkSync(join(root, target), suite);
        assert.throws(() => discoverSuites(root), /suite must be a regular file/);
    }
}));
test('catalog refuses linked suite directories and linked parents', () => catalogFixture((root, write) => {
    write('external/do-not-follow.test.mjs', 'throw new Error("external source must never be read");');
    rmSync(join(root, 'tests/owned-db'), {recursive:true});
    symlinkSync(join(root, 'external'), join(root, 'tests/owned-db'));
    assert.throws(() => discoverSuites(root), /suite directory must not be a symlink/);
    rmSync(join(root, 'tests'), {recursive:true});
    symlinkSync(join(root, 'external'), join(root, 'tests'));
    assert.throws(() => discoverSuites(root), /ENOENT|symlink/);
}));
