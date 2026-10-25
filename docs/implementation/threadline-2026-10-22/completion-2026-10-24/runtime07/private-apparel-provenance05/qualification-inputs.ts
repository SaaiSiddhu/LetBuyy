/** Cohort metadata validation only. No application imports, process/DB/network actions. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, basename, dirname, join } from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import ts from 'typescript';
import { createHash } from 'node:crypto';

export type Pin = { path: string; sha256: string; bytes?: number };
export type Closure = { classification: string; suitePath: string; files: Pin[]; runtimeModules: string[]; edges: Array<{ from: string; to: string; specifier: string; kind: string }>; migrationInventory: Pin[]; migrationCount: number; migrationMaximum: number; migrationCeiling: null; excludedEnvironmentTemplates: string[]; complete: boolean; sqlSets: Record<string, string[]>; entryPoints: string[]; toolDependencies: Pin[]; discoveredModulesExecuted: false };
export type FutureAdmission = { status: string; allocatorThreadId: string; ownerThreadId: string; privateRoot: string; suitePath: string; sourceClosureSha256: string; planSha256: string; proposalUpSha256: string; proposalDownSha256: string; expiresAt: string; cohortCount: number; maxAttempts: number; jobs: number; timeoutSeconds: number; noReap: boolean; preparedTransactions: number; migrationCeiling: null; runReceiptPath: string; evidenceDirectory: string; argv: string[] };
export const suitePath = 'services/api-gateway/src/__tests__/owned-db/apparel-cart-order-provenance-qualification.manual.ts';
export const ownerThreadId = '01a16d03-613e-71b0-a591-07d4d24347d4';
export const allocatorThreadId = '01a164a4-a342-76d3-ab33-65e021ed57db';
export const sha256 = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const same = (a: unknown, b: unknown, message: string) => assert.deepEqual(a, b, message);
export function localPath(root: string, path: string): string {
    assert.ok(path && !isAbsolute(path) && !path.split(/[\\/]/).includes('..'), 'Unsafe relative source input');
    assert.ok(!path.split('/').includes('node_modules'), 'Vendor source cannot masquerade as workspace input');
    const file = resolve(root, path), actual = realpathSync(file);
    assert.ok(actual.startsWith(realpathSync(root) + '/'), 'Source input escaped private root');
    return file;
}
export function actualMigrationInventory(root: string): Pin[] {
    return readdirSync(resolve(root, 'database/supabase/migrations')).filter(name => name.endsWith('.sql')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b)).map(name => {
        const path = 'database/supabase/migrations/' + name, bytes = readFileSync(localPath(root, path));
        return { path, sha256: sha256(bytes), bytes: bytes.length };
    });
}
export function verifyClosure(root: string, closure: Closure, expectedSha256: string, raw: Uint8Array): void {
    assert.match(expectedSha256, /^[a-f0-9]{64}$/); assert.equal(sha256(raw), expectedSha256, 'Closure digest mismatch');
    assert.equal(closure.classification, 'COMPLETE_PRIVATE_NATIVE_SOURCE_CLOSURE_NOT_EXECUTION_ADMISSION');
    assert.equal(closure.complete, true); assert.equal(closure.discoveredModulesExecuted, false); assert.equal(closure.suitePath, suitePath);
    assert.ok(closure.files.length > 1000, 'Incomplete native closure'); assert.ok(closure.runtimeModules.length > 100, 'Incomplete import/export traversal');
    const paths = new Set(closure.files.map(pin => pin.path)); assert.equal(paths.size, closure.files.length, 'Duplicate source pins');
    for (const required of [suitePath, 'qualification-inputs.ts', 'capture-native-source.mjs', 'dependency-launcher-preflight.cjs', 'dependency-launcher-smoke.ts', 'dependency-launcher-provenance.json', 'VENDOR_BASELINE04.json', 'SOURCE_MANIFEST.json', 'NATIVE_PREPARATION_PLAN.json', 'pnpm-lock.yaml', 'package.json',
        'scripts/governance/run-executable-suites.mjs', 'scripts/governance/owned-database-provision.mjs', 'scripts/governance/supabase-faithful-bootstrap.mjs',
        'scripts/governance/owned-fixture-guard.mjs', 'scripts/governance/test-suite-catalog.mjs', 'UNNUMBERED_apparel_order_facts.up.proposal.sql', 'UNNUMBERED_apparel_order_facts.down.proposal.sql']) assert.ok(paths.has(required), 'Required source input missing: ' + required);
    for (const pin of closure.files) { const bytes = readFileSync(localPath(root, pin.path)); assert.equal(sha256(bytes), pin.sha256, 'Changed source input: ' + pin.path); if (pin.bytes !== undefined) assert.equal(bytes.length, pin.bytes); }
    for (const path of closure.runtimeModules) assert.ok(paths.has(path), 'Unpinned module: ' + path);
    for (const pin of closure.toolDependencies) { assert.ok(isAbsolute(pin.path)); assert.equal(sha256(readFileSync(pin.path)), pin.sha256, 'Changed vendor/tool input'); }
    for (const edge of closure.edges) assert.ok(paths.has(edge.from) && paths.has(edge.to), 'Incomplete import/export edge');
    for (const path of closure.excludedEnvironmentTemplates) assert.ok(!paths.has(path), 'Excluded environment template entered native closure');
    const migrations = actualMigrationInventory(root); same(migrations, closure.migrationInventory, 'Actual private migration inventory differs');
    assert.equal(migrations.length, 322); assert.equal(Math.max(...migrations.map(pin => parseInt(basename(pin.path), 10))), 393);
    assert.equal(closure.migrationCount, 322); assert.equal(closure.migrationMaximum, 393); assert.equal(closure.migrationCeiling, null);
    const fresh = discoverNativeSource(root);
    for (const key of ['files', 'runtimeModules', 'edges', 'sqlSets', 'migrationInventory', 'entryPoints', 'toolDependencies'] as const) same(closure[key], fresh[key], 'Incomplete or changed independently rediscovered closure: ' + key);
}
export function verifyAdmissionShape(admission: FutureAdmission, root: string, now = Date.now()): void {
    assert.equal(admission.status, 'GRANTED_ONE_FRESH_OWNED_APPAREL_NATIVE_COHORT');
    assert.equal(admission.allocatorThreadId, allocatorThreadId); assert.equal(admission.ownerThreadId, ownerThreadId);
    assert.equal(admission.privateRoot, realpathSync(root)); assert.equal(admission.suitePath, suitePath);
    assert.ok(Number.isFinite(Date.parse(admission.expiresAt)) && now < Date.parse(admission.expiresAt), 'Expired native admission');
    for (const field of ['sourceClosureSha256', 'planSha256', 'proposalUpSha256', 'proposalDownSha256'] as const) assert.match(admission[field], /^[a-f0-9]{64}$/);
    same([admission.cohortCount, admission.maxAttempts, admission.jobs, admission.timeoutSeconds, admission.noReap, admission.preparedTransactions, admission.migrationCeiling], [1, 1, 1, 600, true, 2, null], 'Native envelope mismatch');
    assert.ok(isAbsolute(admission.runReceiptPath) && isAbsolute(admission.evidenceDirectory));
    const argv = admission.argv; assert.ok(Array.isArray(argv));
    for (const [flag, value] of [['--suite', suitePath], ['--kind', 'gateway-db'], ['--jobs', '1'], ['--timeout', '600'], ['--prepared-transactions', '2'], ['--run-receipt', admission.runReceiptPath]]) { assert.equal(argv.filter(arg => arg === flag).length, 1); assert.equal(argv[argv.indexOf(flag) + 1], value); }
    assert.ok(argv.includes('--no-reap')); assert.ok(!argv.includes('--through-migration') && !argv.includes('--keep-container') && !argv.includes('--reap-only') && !argv.includes('--gateway-db') && !argv.includes('--suite-dir') && !argv.includes('--filter'));
    assert.equal(argv[0], 'node'); assert.equal(argv[1], 'scripts/governance/run-executable-suites.mjs');
}
export function verifyFutureInputs(env: NodeJS.ProcessEnv, root: string): { admission: FutureAdmission; closure: Closure; admissionSha256: string } {
    const admissionFile = env.LETBUYY_APPAREL_NATIVE_ADMISSION, expected = env.LETBUYY_APPAREL_NATIVE_ADMISSION_SHA256;
    assert.ok(admissionFile && expected, 'Future allocator native admission is absent; preparation is not permission to execute');
    assert.match(expected, /^[a-f0-9]{64}$/); const rawAdmission = readFileSync(admissionFile); assert.equal(sha256(rawAdmission), expected, 'Native admission pin mismatch');
    const admission = JSON.parse(rawAdmission.toString('utf8')) as FutureAdmission; verifyAdmissionShape(admission, root);
    const rawClosure = readFileSync(resolve(root, 'native-source-closure.json')), closure = JSON.parse(rawClosure.toString('utf8')) as Closure;
    assert.equal(sha256(rawClosure),admission.sourceClosureSha256,'Closure pin before launcher check');
    const launcherPin=closure.files.find(pin=>pin.path==='dependency-launcher-provenance.json');assert.ok(launcherPin,'Canonical launcher provenance absent');
    const launcherBytes=readFileSync(localPath(root,launcherPin.path));assert.equal(sha256(launcherBytes),launcherPin.sha256,'Launcher policy changed');
    const codePin=closure.files.find(pin=>pin.path==='dependency-launcher-preflight.cjs');assert.ok(codePin,'Canonical launcher guard absent');
    assert.equal(sha256(readFileSync(localPath(root,codePin.path))),codePin.sha256,'Launcher guard changed before load');
    const launcher=createRequire(resolve(root,'package.json'))('./dependency-launcher-preflight.cjs') as {verifyLauncher(root:string,policy:unknown):unknown};
    launcher.verifyLauncher(root,JSON.parse(launcherBytes.toString('utf8')));
    verifyClosure(root, closure, admission.sourceClosureSha256, rawClosure);
    for (const [path, hash] of [['NATIVE_PREPARATION_PLAN.json', admission.planSha256], ['UNNUMBERED_apparel_order_facts.up.proposal.sql', admission.proposalUpSha256], ['UNNUMBERED_apparel_order_facts.down.proposal.sql', admission.proposalDownSha256]]) assert.equal(sha256(readFileSync(localPath(root, path))), hash, path);
    const plan = JSON.parse(readFileSync(resolve(root, 'NATIVE_PREPARATION_PLAN.json'), 'utf8')) as { proposedArgv: string[]; expectedEvidenceDirectory: string };
    same(admission.argv, plan.proposedArgv, 'Actual future admission argv differs from sealed finite plan');
    assert.equal(admission.evidenceDirectory, plan.expectedEvidenceDirectory);
    return { admission, closure, admissionSha256: expected };
}
export function verifyRunnerCommand(command: string, admission: FutureAdmission): void {
    assert.ok(command.includes('scripts/governance/run-executable-suites.mjs') && command.includes(admission.runReceiptPath));
    assert.ok(!command.includes('--through-migration') && !command.includes('--reap-only') && !command.includes('--keep-container') && !command.includes('--suite-dir') && !command.includes('--filter'));
    for (const required of ['--no-reap', '--jobs 1', '--prepared-transactions 2', '--timeout 600', '--kind gateway-db', '--suite ' + suitePath]) assert.ok(new RegExp('(?:^|\\s)' + required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)').test(command), 'Actual runner command lacks exact token ' + required);
}

/** Parent writes real applied-migration evidence only after TAP exits. Mandatory acceptance gate, never inferred early. */
export function verifyNativeResult(result: Record<string, unknown>, closure: Closure): void {
    assert.equal(result.jobs, 1); assert.equal(result.suites, 1); assert.equal(result.failedSuites, 0);
    same(result.reaped, [], 'No other run may be reaped');
    same(result.cleanup, { failures: [], remaining: { containers: [], networks: [], volumes: [] } }, 'Owned run cleanup incomplete');
    const rows = result.results as Array<Record<string, unknown>>; assert.equal(rows.length, 1); const row = rows[0];
    assert.equal(row.path, suitePath); assert.equal(row.kind, 'gateway-db'); assert.equal(row.code, 0); assert.equal(row.timedOut, false);
    assert.equal(row.tests, 4); assert.equal(row.pass, 4); assert.equal(row.fail, 0); assert.equal(row.cancelled, 0); assert.equal(row.skipped, 0); assert.equal(row.todo, 0);
    assert.equal(row.ownership, 'verified before start'); same(row.cleanup, { rest: true, database: true }, 'Owned suite cleanup incomplete');
    const migrations = row.migrations as { throughMigration: number | null; applied: Array<{ name: string; prefix: number; sha256: string }> };
    assert.equal(migrations.throughMigration, null);
    same(migrations.applied, closure.migrationInventory.map(pin => ({ name: basename(pin.path), prefix: parseInt(basename(pin.path), 10), sha256: pin.sha256 })), 'Actual parent applied-migration evidence differs from exact322/max393 source inventory');
}

/** Adapted from the existing shared native capture pattern. Resolve only; NEVER import discovered modules. */
export function discoverNativeSource(root: string): Closure {
    const internal = (file: string) => file.startsWith(root + '/') && !file.includes('/node_modules/');
    const manifest = JSON.parse(readFileSync(resolve(root, 'SOURCE_MANIFEST.json'), 'utf8')) as { overlayPaths: Pin[]; excludedEnvironmentTemplates: Pin[] };
    const sqlInput = JSON.parse(readFileSync(resolve(root, 'SQL_SOURCE_CONSERVATION.json'), 'utf8')) as { exactUPOrder: Pin[] };
    const config = ts.readConfigFile(resolve(root, 'services/api-gateway/tsconfig.json'), ts.sys.readFile); assert.ok(!config.error);
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, 'services/api-gateway')).options;
    const files = new Map<string, Pin>(), queue: string[] = [], visited = new Set<string>();
    const edges: Closure['edges'] = [], tools = new Map<string, Pin>(), vendorPackages = new Set<string>();
    const tool = (file: string) => {
        const actual = realpathSync(file);
        assert.ok(actual === process.execPath || actual.includes('/node_modules/'), 'External business input refused: ' + actual);
        const bytes = readFileSync(actual); tools.set(actual, { path: actual, sha256: sha256(bytes), bytes: bytes.length });
        let parent = dirname(actual);
        while (parent.includes('/node_modules/')) {
            const json = join(parent, 'package.json');
            if (existsSync(json)) { vendorPackages.add(parent); const bytes = readFileSync(json); tools.set(realpathSync(json), { path: realpathSync(json), sha256: sha256(bytes), bytes: bytes.length }); break; }
            parent = dirname(parent);
        }
    };
    const add = (path: string, traverse = true) => {
        assert.ok(!manifest.excludedEnvironmentTemplates.some(pin => pin.path === path), 'Dependency needs an excluded environment template: ' + path);
        const file = localPath(root, path), bytes = readFileSync(file), pin = { path, sha256: sha256(bytes), bytes: bytes.length };
        if (files.has(path)) assert.equal(files.get(path)!.sha256, pin.sha256, 'Source changed during recursive discovery'); else files.set(path, pin);
        if (traverse && /\.(?:[cm]?[jt]sx?)$/.test(path) && !/\.d\.(?:ts|mts|cts)$/.test(path) && !visited.has(path) && !queue.includes(path)) queue.push(path);
    };
    const entryPoints = [suitePath, 'scripts/governance/run-executable-suites.mjs', 'scripts/governance/test-suite-catalog.mjs', 'qualification-inputs.ts', 'capture-native-source.mjs', 'verify-native-result.mjs', 'dependency-launcher-preflight.cjs', 'dependency-launcher-smoke.ts'];
    for (const path of entryPoints) add(path);
    for (const pin of manifest.overlayPaths) add(pin.path, false);
    for (const pin of sqlInput.exactUPOrder) add(pin.path, false);
    for (const path of ['SOURCE_MANIFEST.json', 'NATIVE_PREPARATION_PLAN.json', 'dependency-launcher-provenance.json', 'VENDOR_BASELINE04.json', 'SQL_SOURCE_CONSERVATION.json', 'UNNUMBERED_apparel_order_facts.up.proposal.sql', 'UNNUMBERED_apparel_order_facts.down.proposal.sql',
        'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'services/api-gateway/tsconfig.json', 'services/api-gateway/package.json', 'services/api-gateway/runtime.manifest.json', 'services/api-gateway/wrangler.toml']) add(path, false);
    for (const path of ['verify-preparation.mjs', 'check-changed-leaf-types.mjs']) add(path, false);
    const sqlSets: Record<string, string[]> = {};
    for (const dir of ['database/supabase/migrations', 'database/supabase/rollback', 'database/supabase/bootstrap', 'database/supabase/deploy', 'config/runtime']) {
        const paths = existsSync(resolve(root, dir)) ? (readdirSync(resolve(root, dir), { recursive: true }) as string[]).filter(path => /\.(sql|json|toml|ya?ml)$/.test(path)).map(path => dir + '/' + path).sort() : [];
        sqlSets[dir] = paths; for (const path of paths) add(path, false);
    }
    tool(process.execPath);
    const rootRequire = createRequire(resolve(root, 'package.json'));
    for (const specifier of ['typescript', 'tsx', 'tsx/cli']) tool(rootRequire.resolve(specifier));
    tool(resolve(root,'node_modules/.bin/tsx')); // Actual selected child launcher, not only module resolution.
    while (queue.length) {
        const path = queue.shift()!; if (visited.has(path)) continue; visited.add(path);
        const source = ts.createSourceFile(path, readFileSync(resolve(root, path), 'utf8'), ts.ScriptTarget.Latest, true);
        assert.equal((source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics.length, 0, path);
        for (const reference of source.referencedFiles) { const target = relative(root, resolve(root, dirname(path), reference.fileName)); add(target, false); edges.push({ from: path, to: target, specifier: reference.fileName, kind: 'declaration-reference' }); }
        function visit(node: ts.Node): void {
            let specifier: string | undefined, typeOnly = false;
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                specifier = node.moduleSpecifier.text; typeOnly = Boolean(ts.isExportDeclaration(node) ? node.isTypeOnly : node.importClause?.isTypeOnly);
                const named = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
                if (named && ts.isNamedImports(named) && named.elements.length && named.elements.every(element => element.isTypeOnly)) typeOnly = true;
            } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) { specifier = node.argument.literal.text; typeOnly = true; }
            else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
                assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), 'Nonliteral import needs allocator review: ' + path); specifier = node.arguments[0].text;
            }
            if (specifier && !isBuiltin(specifier)) {
                const typed = ts.resolveModuleName(specifier, resolve(root, path), options, ts.sys).resolvedModule?.resolvedFileName;
                if (typed && internal(typed)) { const target = relative(root, typed); assert.ok(!target.startsWith('apps/'), 'Native runtime may not import an app'); add(target); edges.push({ from: path, to: target, specifier, kind: 'TypeScript' }); }
                else if (typed) tool(typed);
                else assert.ok(!specifier.startsWith('.') && !specifier.startsWith('@letbuyy/'), 'Unresolved internal import: ' + path + ' -> ' + specifier);
                if (!typeOnly) {
                    const runtime = createRequire(resolve(root, path)).resolve(specifier);
                    if (internal(runtime)) { const target = relative(root, runtime); assert.ok(!target.startsWith('apps/') && !/\.d\.(ts|mts|cts)$/.test(target)); add(target); edges.push({ from: path, to: target, specifier, kind: 'Node-tsx-runtime' }); }
                    else tool(runtime);
                }
            }
            if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('.')) {
                const target = relative(root, resolve(root, dirname(path), node.arguments[0].text)); if (/\.(sql|json)$/.test(target)) { add(target, false); edges.push({ from: path, to: target, specifier: node.arguments[0].text, kind: 'literal-data-url' }); }
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
        let parent = dirname(path);
        while (parent !== '.' && parent !== '/') { const json = join(parent, 'package.json'); if (existsSync(resolve(root, json))) { add(json, false); break; } parent = dirname(parent); }
    }
    // Pin complete installed vendor package contents and declared transitive packages.
    // This reads bytes/metadata only; it never evaluates an external or workspace module.
    const vendorVisited = new Set<string>();
    while ([...vendorPackages].some(path => !vendorVisited.has(path))) {
        const directory = [...vendorPackages].find(path => !vendorVisited.has(path))!; vendorVisited.add(directory);
        const manifestPath = join(directory, 'package.json');
        const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
        const scan = (dir: string): void => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (entry.name === 'node_modules' || entry.name.includes('.env') || entry.name.includes('.dev.vars')) continue;
                const file = join(dir, entry.name);
                if (entry.isDirectory()) scan(file);
                else if (entry.isFile()) { const bytes = readFileSync(file); tools.set(file, { path: file, sha256: sha256(bytes), bytes: bytes.length }); }
                // Symlinked dependencies are resolved explicitly from their own manifests below.
            }
        };
        scan(directory);
        const req = createRequire(manifestPath);
        for (const dependency of new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {})])) {
            if (isBuiltin(dependency)) continue;
            let dependencyManifest: string | undefined;
            for (const dir of req.resolve.paths(dependency) ?? []) { const path = join(dir, dependency, 'package.json'); if (existsSync(path)) { dependencyManifest = realpathSync(path); break; } }
            if (!dependencyManifest) { assert.ok(Object.hasOwn(pkg.optionalDependencies ?? {}, dependency), 'Missing required installed vendor dependency: ' + dependency); continue; }
            assert.ok(dependencyManifest.includes('/node_modules/'), 'Vendor dependency escaped to business source');
            vendorPackages.add(dirname(dependencyManifest));
        }
    }
    // Layout normalization can narrow incidental type/vendor discovery. Retain every
    // previously accepted04 vendor byte, and reject any unreviewed new vendor input.
    const vendorBaseline=JSON.parse(readFileSync(resolve(root,'VENDOR_BASELINE04.json'),'utf8')) as {toolDependencies:Pin[]};
    const acceptedTools=new Map(vendorBaseline.toolDependencies.map(pin=>[pin.path,pin]));
    for(const pin of tools.values())assert.equal(acceptedTools.get(pin.path)?.sha256,pin.sha256,'New or changed vendor input needs allocator review');
    for(const pin of vendorBaseline.toolDependencies){assert.equal(sha256(readFileSync(pin.path)),pin.sha256,'Changed accepted04 vendor input');tools.set(pin.path,pin);}
    for (const pin of files.values()) assert.equal(sha256(readFileSync(resolve(root, pin.path))), pin.sha256, 'Source changed after discovery');
    const migrations = actualMigrationInventory(root); assert.equal(migrations.length, 322); assert.equal(Math.max(...migrations.map(pin => parseInt(basename(pin.path), 10))), 393);
    return { classification: 'COMPLETE_PRIVATE_NATIVE_SOURCE_CLOSURE_NOT_EXECUTION_ADMISSION', suitePath, files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
        runtimeModules: [...visited].sort(), edges: edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), entryPoints, sqlSets,
        migrationInventory: migrations, migrationCount: 322, migrationMaximum: 393, migrationCeiling: null, toolDependencies: [...tools.values()].sort((a, b) => a.path.localeCompare(b.path)),
        excludedEnvironmentTemplates: manifest.excludedEnvironmentTemplates.map(pin => pin.path), complete: true, discoveredModulesExecuted: false };
}
