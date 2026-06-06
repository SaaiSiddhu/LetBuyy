import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const snapshotPath = join(packageRoot, 'snapshots', 'public-api.json');
const indexPath = join(packageRoot, 'src', 'index.ts');
const update = process.argv.includes('--update');
const selfTest = process.argv.includes('--self-test');

function readPublicExports() {
    const program = ts.createProgram([indexPath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        skipLibCheck: true,
        strict: true,
    });
    const source = program.getSourceFile(indexPath);
    if (!source) throw new Error(`Could not read ${indexPath}`);

    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(source);
    if (!symbol) throw new Error('Could not resolve @letbuyy/ui public module symbol');

    return checker
        .getExportsOfModule(symbol)
        .map((exportSymbol) => exportSymbol.getName())
        .filter((name) => name !== 'default')
        .sort((a, b) => a.localeCompare(b));
}

function readSnapshot() {
    if (!existsSync(snapshotPath)) {
        throw new Error(`Public API snapshot missing at ${snapshotPath}. Run pnpm --filter @letbuyy/ui snapshot:api:update.`);
    }
    return JSON.parse(readFileSync(snapshotPath, 'utf8')).exports ?? [];
}

function findMissing(expected, actual) {
    const actualSet = new Set(actual);
    return expected.filter((name) => !actualSet.has(name));
}

function assertNoMissing(expected, actual) {
    const missing = findMissing(expected, actual);
    if (missing.length > 0) {
        throw new Error(`Public API snapshot violation: missing export(s): ${missing.join(', ')}`);
    }
}

const currentExports = readPublicExports();

if (update) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(
        snapshotPath,
        `${JSON.stringify({
            package: '@letbuyy/ui',
            source: 'src/index.ts',
            exports: currentExports,
        }, null, 2)}\n`,
    );
    console.log(`Updated public API snapshot with ${currentExports.length} export(s).`);
    process.exit(0);
}

const snapshotExports = readSnapshot();

if (selfTest) {
    const brokenExports = currentExports.slice(1);
    const missing = findMissing(snapshotExports, brokenExports);
    if (missing.length === 0) {
        throw new Error('Public API snapshot self-test failed: simulated removal did not fail.');
    }
    console.log(`Public API snapshot self-test passed; simulated removal detected ${missing[0]}.`);
    process.exit(0);
}

assertNoMissing(snapshotExports, currentExports);
console.log(`Public API snapshot passed (${snapshotExports.length} protected export(s)).`);
