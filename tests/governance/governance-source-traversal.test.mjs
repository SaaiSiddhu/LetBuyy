// N1.1: validator source scans must preserve real source, exclude owned runtime
// output and never follow generated/dependency links into another tree.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';

const moduleUrl = new URL('../../scripts/validators/governance-common.mjs', import.meta.url).href;
const fixture = mkdtempSync(join(tmpdir(), 'letbuyy-source-traversal-'));
const write = (relative) => {
    const path = join(fixture, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, 'export const synthetic = true;\n');
};
write('apps/merchant/web/src/real.ts');
write('apps/merchant/web/.next-source/also-real.ts');
write('apps/merchant/web/.next-session-runtime-123-a1b2/dev/generated.ts');
write('apps/merchant/web/.next/server/generated.ts');
write('apps/merchant/web/node_modules/foreign/index.ts');
write('outside/foreign.ts');
symlinkSync(join(fixture, 'outside'), join(fixture, 'apps/merchant/web/external'));
symlinkSync(join(fixture, 'missing'), join(fixture, 'apps/merchant/web/broken'));
symlinkSync(join(fixture, 'apps'), join(fixture, 'apps/merchant/web/cycle'));
after(() => rmSync(fixture, { recursive: true, force: true }));

function inspect(roots=['apps']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { listWorkspaceFiles, listWorkspaceDirectories, listLocalArtifactDirectories, generatedArtifactPattern } from ${JSON.stringify(moduleUrl)};
      const roots=${JSON.stringify(roots)};
      console.log(JSON.stringify({files:listWorkspaceFiles(roots),dirs:listWorkspaceDirectories(roots),artifacts:listLocalArtifactDirectories(roots),
        generated:generatedArtifactPattern.test('apps/merchant/web/.next-session-runtime-123-a1b2/dev/generated.ts')}));
    `], { cwd:fixture, encoding:'utf8', timeout:10000 });
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout);
}

test('configured Next runtime outputs stay outside source scans; similar real directories remain visible', () => {
    const result=inspect();
    assert.deepEqual(result.files,['apps/merchant/web/.next-source/also-real.ts','apps/merchant/web/src/real.ts']);
    assert.equal(result.generated,true);
});

test('artifact inventory reports cache roots without descending into their children', () => {
    const result=inspect();
    assert.deepEqual(result.artifacts,['apps/merchant/web/.next','apps/merchant/web/.next-session-runtime-123-a1b2','apps/merchant/web/node_modules']);
    assert.ok(!result.dirs.some(path=>path.includes('/dev')||path.includes('/server')||path.includes('/foreign')));
});

test('broken, cyclic and external links are not source roots or traversed dependencies', () => {
    const result=inspect(['apps/merchant/web/external','apps/merchant/web/cycle','apps/merchant/web/broken']);
    assert.deepEqual(result.files,[]);
    assert.deepEqual(result.dirs,[]);
    assert.deepEqual(result.artifacts,[]);
});

test('generated descendants are represented by their artifact root; stray generated files remain findings', () => {
    assert.equal(spawnSync('git', ['init', '-q'], {cwd:fixture}).status, 0);
    write('apps/merchant/web/src/stray.tsbuildinfo');
    write('scratch-untracked.txt');
    const result=spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { collectStaleArtifactOffenders } from ${JSON.stringify(moduleUrl)};
      console.log(JSON.stringify(collectStaleArtifactOffenders()));
    `], {cwd:fixture, encoding:'utf8', timeout:10000});
    assert.equal(result.status,0,result.stderr);
    const found=JSON.parse(result.stdout);
    assert.deepEqual(found.untrackedFiles,['apps/merchant/web/src/stray.tsbuildinfo','scratch-untracked.txt']);
    assert.ok(found.artifactDirectories.includes('apps/merchant/web/.next-session-runtime-123-a1b2'),
        'the root remains a finding; the cleanup planner must still prove it is safe before classifying it');
});

test('Git inventories larger than the default child-process buffer remain complete', () => {
    assert.equal(spawnSync('git', ['init', '-q'], {cwd:fixture}).status, 0);
    const expected=Array.from({length:5000},(_,i)=>`apps/merchant/web/src/large-${String(i).padStart(5,'0')}-${'x'.repeat(210)}.ts`);
    for (const path of expected) write(path);
    const result=spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { getUntrackedFiles } from ${JSON.stringify(moduleUrl)};
      const found=getUntrackedFiles().filter(path=>path.startsWith('apps/merchant/web/src/large-'));
      console.log(JSON.stringify({count:found.length,first:found[0],last:found.at(-1),bytes:found.join('\\0').length}));
    `], {cwd:fixture, encoding:'utf8', timeout:30000});
    assert.equal(result.status,0,result.stderr);
    const found=JSON.parse(result.stdout);
    assert.ok(found.bytes>1024*1024,'the real Git listing must exceed the previous limit');
    assert.equal(found.count,expected.length);
    assert.equal(found.first,expected[0]);
    assert.equal(found.last,expected.at(-1));
});

// Run the actual validator over isolated source, without executing an app or DB.
const ownershipValidator = fileURLToPath(new URL('../../scripts/validators/route-ownership-validator.mjs', import.meta.url));
const consoleImport = "import { requireConsolePermission } from '../identity-foundation/console-approval-repository';";
const customerImport = "import { getCustomerSession } from '../middleware/customer-session';";
const consoleGate = "await requireConsolePermission(c, 'merchant:pii', false);";
const customerGate = "const session = getCustomerSession(c); if (!session) return c.json({}, 401);";
const customerQuery = "await db.from('store_customers').select('id').eq('id', session.customerId).eq('store_id', session.storeId);";

function ownershipFixture(imports, body, wrap = source => source) {
    const dir = mkdtempSync(join(tmpdir(), 'letbuyy-route-guard-'));
    try {
        for (const relative of ['identity-foundation/console-approval-repository.ts', 'middleware/customer-session.ts']) {
            const dest = join(dir, 'services/api-gateway/src', relative);
            mkdirSync(dirname(dest), { recursive: true });
            copyFileSync(fileURLToPath(new URL(`../../services/api-gateway/src/${relative}`, import.meta.url)), dest);
        }
        const route = join(dir, 'services/api-gateway/src/routes/arbitrary.ts');
        mkdirSync(dirname(route), { recursive: true });
        writeFileSync(route, `${imports}\n${wrap(`router.get('/synthetic', async (c) => { ${body} });`)}\n`);
        const result = spawnSync(process.execPath, [ownershipValidator], { cwd: dir, encoding: 'utf8', timeout: 10000 });
        assert.ok(result.status === 0 || result.status === 1, result.stderr);
        return result;
    } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('ownership follows an awaited canonical Console permission before tenant access on any filename', () => {
    const result = ownershipFixture(consoleImport, `${consoleGate} await db.from('orders').select('*');`);
    assert.equal(result.status, 0, result.stderr);
});

test('ownership follows a canonical customer session, refusal, and both exact query predicates', () => {
    const result = ownershipFixture(customerImport, `${customerGate} ${customerQuery}`);
    assert.equal(result.status, 0, result.stderr);
});

const deniedOwnershipFixtures = [
    ['unguarded tenant read', '', "await db.from('orders').select('*');"],
    ['permission mention in comment', consoleImport, `// ${consoleGate}\n await db.from('orders').select('*');`],
    ['permission mention in string', consoleImport, `const note = ${JSON.stringify(consoleGate)}; await db.from('orders').select('*');`],
    ['unawaited permission', consoleImport, "requireConsolePermission(c, 'merchant:pii'); await db.from('orders').select('*');"],
    ['permission after read', consoleImport, `await db.from('orders').select('*'); ${consoleGate}`],
    ['conditional permission', consoleImport, `if (false) { ${consoleGate} } await db.from('orders').select('*');`],
    ['swallowed permission failure', consoleImport, `try { ${consoleGate} } catch {} await db.from('orders').select('*');`],
    ['permission for another context', consoleImport, `${consoleGate.replace('(c,', '(foreignContext,')} await db.from('orders').select('*');`],
    ['rewritten permission context', consoleImport, `c = foreignContext; ${consoleGate} await db.from('orders').select('*');`],
    ['aliased mutable permission context', consoleImport, `const alias = c; alias.req = foreignRequest; ${consoleGate} await db.from('orders').select('*');`],
    ['permission with no context', consoleImport, "await requireConsolePermission(); await db.from('orders').select('*');"],
    ['fake local permission', '', `async function requireConsolePermission() {} ${consoleGate} await db.from('orders').select('*');`],
    ['wrong permission import', consoleImport.replace('console-approval-repository', 'untrusted'), `${consoleGate} await db.from('orders').select('*');`],
    ['shadowed permission import', consoleImport, `const requireConsolePermission = async () => {}; ${consoleGate} await db.from('orders').select('*');`],
    ['outer parameter shadowing permission', consoleImport, `${consoleGate} await db.from('orders').select('*');`, source => `function register(requireConsolePermission) { ${source} }`],
    ['outer variable shadowing permission', consoleImport, `${consoleGate} await db.from('orders').select('*');`, source => `function register() { const requireConsolePermission = fake; ${source} }`],
    ['missing session refusal', customerImport, `const session = getCustomerSession(c); ${customerQuery}`],
    ['session refusal after read', customerImport, `const session = getCustomerSession(c); ${customerQuery} if (!session) return c.json({}, 401);`],
    ['session for another context', customerImport, `${customerGate.replace('(c)', '(foreignContext)')} ${customerQuery}`],
    ['wrong customer', customerImport, `${customerGate} ${customerQuery.replace('session.customerId', 'body.customerId')}`],
    ['wrong store', customerImport, `${customerGate} ${customerQuery.replace('session.storeId', 'body.storeId')}`],
    ['missing store bound', customerImport, `${customerGate} ${customerQuery.replace(".eq('store_id', session.storeId)", '')}`],
    ['session reassigned after refusal', customerImport, `${customerGate} session = body; ${customerQuery}`],
    ['session modified through alias', customerImport, `${customerGate} const alias = session; alias.storeId = body.storeId; ${customerQuery}`],
    ['caller-written session context', customerImport, `c.set('customer', body); ${customerGate} ${customerQuery}`],
    ['partial session refusal', customerImport, `const session = getCustomerSession(c); if (!session) { if (flag) return c.json({},401); } ${customerQuery}`],
    ['unbound raw SQL after customer read', customerImport, `${customerGate} ${customerQuery} await db.query('select * from public.products');`],
    ['unchecked second tenant read', customerImport, `${customerGate} ${customerQuery} await db.from('orders').select('*');`],
    ['wrong session import', customerImport.replace('customer-session', 'untrusted'), `${customerGate} ${customerQuery}`],
];
for (const [name, imports, body, wrap] of deniedOwnershipFixtures) {
    test(`ownership refuses ${name}`, () => {
        const result = ownershipFixture(imports, body, wrap);
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /tenant-table handlers without an ownership/);
    });
}

// Run the real checker on the actual shipping/tax module and deliberate unsafe
// call-site mutations. Runtime owner/scoping behavior is independently exercised
// by shipping-tax-settings.postgres.test.ts against owned PostgreSQL.
test('shipping/tax ownership recognition is file-bound, awaited and ordered before tenant access', () => {
    const source = readFileSync(fileURLToPath(new URL('../../services/api-gateway/src/routes/shipping-tax.ts', import.meta.url)), 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'letbuyy-shipping-guard-'));
    const root = join(dir, 'services/api-gateway/src/routes'); mkdirSync(root, { recursive: true });
    try {
        const run = (body, filename = 'shipping-tax.ts') => {
            const file = join(root, filename); writeFileSync(file, body);
            try { return spawnSync(process.execPath, [ownershipValidator], { cwd: dir, encoding: 'utf8', timeout: 10000 }); }
            finally { rmSync(file); }
        };
        assert.equal(run(source).status, 0, 'the reviewed real transport is recognized');
        const cases = [
            ['another filename', source, 'unreviewed.ts'],
            ['unawaited scope', source.replaceAll('await resolveShippingTaxResourceScope(c,', 'resolveShippingTaxResourceScope(c,')],
            ['wrong context', source.replaceAll('resolveShippingTaxResourceScope(c,', 'resolveShippingTaxResourceScope(foreign,')],
            ['mention only', source.replaceAll('await resolveShippingTaxResourceScope(c,', '/* await resolveShippingTaxResourceScope(c, */ await unchecked(c,')],
            ['shadowed helper', source.replaceAll('const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope', 'const resolveShippingTaxResourceScope = fake; const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope')],
            ['unchecked resource type', source.replaceAll("resolveShippingTaxResourceScope(c, 'tax_rates'", "resolveShippingTaxResourceScope(c, 'unreviewed_table'")],
            ['read before scope', source.replaceAll("    const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope", "    await unsafe.from('tax_rates').select('*'); const { db, storeId, scopeColumn } = await resolveShippingTaxResourceScope")],
        ];
        for (const [label, body, filename] of cases) {
            const result = run(body, filename); assert.equal(result.status, 1, label); assert.match(result.stderr, /tenant-table handlers without an ownership/, label);
        }
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
