import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const snapshotPath = join(packageRoot, 'snapshots', 'token-variables.json');
const tokensPath = join(packageRoot, 'src', 'tokens.ts');
const update = process.argv.includes('--update');
const selfTest = process.argv.includes('--self-test');
const moduleCache = new Map();

function resolveLocalModule(fromFile, specifier) {
    const base = resolve(dirname(fromFile), specifier);
    if (extname(base)) return base;
    if (existsSync(`${base}.ts`)) return `${base}.ts`;
    if (existsSync(`${base}.tsx`)) return `${base}.tsx`;
    throw new Error(`Could not resolve ${specifier} from ${fromFile}`);
}

function loadTsModule(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath);

    const source = readFileSync(filePath, 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            jsx: ts.JsxEmit.ReactJSX,
            esModuleInterop: true,
        },
        fileName: filePath,
    }).outputText;

    const module = { exports: {} };
    const sandbox = {
        module,
        exports: module.exports,
        require: (specifier) => {
            if (specifier.startsWith('.')) {
                return loadTsModule(resolveLocalModule(filePath, specifier));
            }
            throw new Error(`Unexpected external import in token snapshot validator: ${specifier}`);
        },
    };

    vm.runInNewContext(output, sandbox, { filename: filePath });
    moduleCache.set(filePath, module.exports);
    return module.exports;
}

function readTokenVariables() {
    const tokenModule = loadTsModule(tokensPath);
    const variables = new Set();

    for (const themeVariables of Object.values(tokenModule.letbuyyTokenCssVariables ?? {})) {
        for (const variableName of Object.keys(themeVariables)) {
            if (variableName.startsWith('--lb-')) variables.add(variableName);
        }
    }

    const css = String(tokenModule.letbuyyTokenCss ?? '');
    for (const match of css.matchAll(/--lb-[a-z0-9-]+/g)) {
        variables.add(match[0]);
    }

    return Array.from(variables).sort((a, b) => a.localeCompare(b));
}

function readSnapshot() {
    if (!existsSync(snapshotPath)) {
        throw new Error(`Token variable snapshot missing at ${snapshotPath}. Run pnpm --filter @letbuyy/ui snapshot:tokens:update.`);
    }
    return JSON.parse(readFileSync(snapshotPath, 'utf8')).variables ?? [];
}

function findMissing(expected, actual) {
    const actualSet = new Set(actual);
    return expected.filter((name) => !actualSet.has(name));
}

function assertNoMissing(expected, actual) {
    const missing = findMissing(expected, actual);
    if (missing.length > 0) {
        throw new Error(`Token variable snapshot violation: missing variable(s): ${missing.join(', ')}`);
    }
}

const currentVariables = readTokenVariables();

if (update) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(
        snapshotPath,
        `${JSON.stringify({
            package: '@letbuyy/ui',
            source: 'src/tokens.ts',
            variables: currentVariables,
        }, null, 2)}\n`,
    );
    console.log(`Updated token variable snapshot with ${currentVariables.length} --lb-* variable(s).`);
    process.exit(0);
}

const snapshotVariables = readSnapshot();

if (selfTest) {
    const brokenVariables = currentVariables.slice(1);
    const missing = findMissing(snapshotVariables, brokenVariables);
    if (missing.length === 0) {
        throw new Error('Token variable snapshot self-test failed: simulated removal did not fail.');
    }
    console.log(`Token variable snapshot self-test passed; simulated removal detected ${missing[0]}.`);
    process.exit(0);
}

assertNoMissing(snapshotVariables, currentVariables);
console.log(`Token variable snapshot passed (${snapshotVariables.length} protected variable(s)).`);
