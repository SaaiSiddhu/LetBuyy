const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = process.cwd();
const commands = JSON.parse(fs.readFileSync(path.join(__dirname, 'commands.json'), 'utf8'));
const configPath = path.join(root, 'apps/commerce/web/tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const entries = commands.flatMap(row => row.command.filter(file => /\.test\.tsx?$/.test(file)));
entries.push(path.relative(root, path.join(__dirname, 'builder-proof.ts')));
const queue = entries.map(file => path.resolve(root, file));
const seen = new Set(), external = new Set(), unresolved = new Set();
while (queue.length) {
    const next = fs.realpathSync(queue.pop());
    if (seen.has(next)) continue;
    seen.add(next);
    for (const reference of ts.preProcessFile(fs.readFileSync(next, 'utf8'), true, true).importedFiles) {
        const name = reference.fileName;
        if (name.startsWith('node:')) continue;
        const resolved = ts.resolveModuleName(name, next, parsed.options, ts.sys).resolvedModule;
        if (!resolved) { unresolved.add(name); continue; }
        const resolvedPath = fs.realpathSync(resolved.resolvedFileName);
        if (resolvedPath.startsWith(root + path.sep) && !resolvedPath.includes(path.sep + 'node_modules' + path.sep)) queue.push(resolvedPath);
        else external.add(name);
    }
}
for (const file of ['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'tsconfig.base.json',
    'apps/commerce/web/package.json', 'apps/commerce/web/tsconfig.json',
    'packages/theme-engine/package.json', 'packages/theme-engine/tsconfig.json']) {
    const absolute = path.join(root, file);
    if (fs.existsSync(absolute)) seen.add(absolute);
}
const pins = Object.fromEntries([...seen].sort().map(file => [path.relative(root, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
process.stdout.write(JSON.stringify({
    classification: 'TRANSITIVE_LITERAL_WORKSPACE_IMPORT_CLOSURE_USING_COMMERCE_TSCONFIG_PLUS_DEPENDENCY_LOCK_AND_CONFIGS',
    entrypoints: entries, pins, externalImports: [...external].sort(), unresolvedImports: [...unresolved].sort(),
    nodeVersions: process.versions,
    limits: 'Static import closure includes type imports and literal dynamic imports. External runtime dependency versions are pinned by the lockfile; dependency directories are not source authority.',
}, null, 2) + '\n');
