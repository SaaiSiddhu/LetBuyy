import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const snapshotPath = join(packageRoot, 'snapshots', 'token-aliases.json');
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
            throw new Error(`Unexpected external import in token alias validator: ${specifier}`);
        },
    };

    vm.runInNewContext(output, sandbox, { filename: filePath });
    moduleCache.set(filePath, module.exports);
    return module.exports;
}

function createAliasSnapshot() {
    const tokenModule = loadTsModule(tokensPath);
    const themes = {};

    for (const [theme, variables] of Object.entries(tokenModule.letbuyyTokenCssVariables ?? {})) {
        const byValue = new Map();

        for (const [name, value] of Object.entries(variables)) {
            if (!name.startsWith('--lb-') || typeof value !== 'string') continue;
            const names = byValue.get(value) ?? [];
            names.push(name);
            byValue.set(value, names);
        }

        themes[theme] = Array.from(byValue.entries())
            .map(([value, names]) => ({ value, variables: names.sort((a, b) => a.localeCompare(b)) }))
            .filter((group) => group.variables.length > 1)
            .sort((a, b) => a.value.localeCompare(b.value) || a.variables[0].localeCompare(b.variables[0]));
    }

    return {
        package: '@letbuyy/ui',
        source: 'src/tokens.ts',
        policy: 'Existing duplicate-value CSS variable groups are allowed for backward compatibility; new duplicate-value aliases require an intentional snapshot update.',
        themes,
    };
}

function readSnapshot() {
    if (!existsSync(snapshotPath)) {
        throw new Error(`Token alias snapshot missing at ${snapshotPath}. Run pnpm --filter @letbuyy/ui snapshot:aliases:update.`);
    }
    return JSON.parse(readFileSync(snapshotPath, 'utf8'));
}

function groupMap(snapshot, theme) {
    const map = new Map();
    for (const group of snapshot.themes?.[theme] ?? []) {
        map.set(group.value, new Set(group.variables));
    }
    return map;
}

function findViolations(expectedSnapshot, currentSnapshot) {
    const violations = [];

    for (const [theme, currentGroups] of Object.entries(currentSnapshot.themes ?? {})) {
        const expectedGroups = groupMap(expectedSnapshot, theme);

        for (const group of currentGroups) {
            const expectedNames = expectedGroups.get(group.value);
            if (!expectedNames) {
                violations.push(`${theme}: new duplicate value group ${JSON.stringify(group.value)} => ${group.variables.join(', ')}`);
                continue;
            }

            const unexpected = group.variables.filter((name) => !expectedNames.has(name));
            if (unexpected.length > 0) {
                violations.push(`${theme}: new alias for ${JSON.stringify(group.value)} => ${unexpected.join(', ')}`);
            }
        }
    }

    return violations;
}

const currentSnapshot = createAliasSnapshot();

if (update) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, `${JSON.stringify(currentSnapshot, null, 2)}\n`);
    const groupCount = Object.values(currentSnapshot.themes).reduce((count, groups) => count + groups.length, 0);
    console.log(`Updated token alias snapshot with ${groupCount} duplicate-value group(s).`);
    process.exit(0);
}

const expectedSnapshot = readSnapshot();

if (selfTest) {
    const baselineViolations = findViolations(expectedSnapshot, currentSnapshot);
    if (baselineViolations.length > 0) {
        throw new Error(`Token alias validator self-test requires a clean baseline:\n${baselineViolations.join('\n')}`);
    }

    let tested = 0;
    for (const [theme, groups] of Object.entries(currentSnapshot.themes)) {
        if (!groups.length) throw new Error(`No duplicate-value groups to test in ${theme}.`);
        // Test both rejection paths independently. A stale real snapshot must
        // never make a broken mutation check look successful.
        const addedAlias = structuredClone(currentSnapshot);
        addedAlias.themes[theme][0].variables.push('--lb-self-test-new-alias');
        const newGroup = structuredClone(currentSnapshot);
        newGroup.themes[theme].push({
            value: '__self_test_unique_value__',
            variables: ['--lb-self-test-first', '--lb-self-test-second'],
        });
        for (const [mutated, marker] of [[addedAlias, '--lb-self-test-new-alias'], [newGroup, '__self_test_unique_value__']]) {
            const violations = findViolations(expectedSnapshot, mutated);
            if (violations.length !== 1 || !violations[0].startsWith(`${theme}:`) || !violations[0].includes(marker)) {
                throw new Error(`Token alias validator self-test failed for ${theme}: ${JSON.stringify(violations)}`);
            }
            tested++;
        }
    }
    console.log(`Token alias validator self-test passed (${tested} independent alias/group mutations rejected).`);
    process.exit(0);
}

const violations = findViolations(expectedSnapshot, currentSnapshot);
if (violations.length > 0) {
    throw new Error(`Token alias snapshot violation:\n${violations.map((violation) => `- ${violation}`).join('\n')}`);
}

const protectedGroups = Object.values(expectedSnapshot.themes ?? {}).reduce((count, groups) => count + groups.length, 0);
console.log(`Token alias snapshot passed (${protectedGroups} protected duplicate-value group(s)).`);
