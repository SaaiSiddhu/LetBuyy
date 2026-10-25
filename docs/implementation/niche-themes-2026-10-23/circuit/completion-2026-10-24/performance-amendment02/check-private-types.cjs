// Pure compiler inspection. No native leaf or canonical runtime is imported.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = '/Volumes/Projects/LetBuyy';
const dir = '/private/tmp/letbuyy-circuit-performance-prep-20261025-02';
const outputName = process.argv[2] || 'scoped-types-attempt02.json';
if (!/^[a-z0-9.-]+\.json$/.test(outputName)) throw Error('Output must be an owned JSON filename');
const out = path.join(__dirname, outputName);
if (fs.existsSync(out)) throw Error('Preserve the earlier qualification; use a fresh output filename');
const ts = require(root + '/node_modules/typescript');
const names = ['circuit-indexed-performance-qualification.manual.ts', 'plan-parser.ts'];
const inputNames = [...names, 'plan-parser.test.ts', 'PERFORMANCE_PROTOCOL.json'];
const pins = () => inputNames.map(name => ({ name, sha256: crypto.createHash('sha256').update(fs.readFileSync(dir + '/' + name)).digest('hex') }));
const before = pins();
const overlays = new Map(names.map(name => [root + '/services/api-gateway/src/__tests__/owned-db/' + name, fs.readFileSync(dir + '/' + name, 'utf8')]));
const suite = overlays.get(root + '/services/api-gateway/src/__tests__/owned-db/' + names[0]);
const literal = suite.match(/^const effective=(\{[^\n]+\});$/m);
if (!literal) throw Error('Missing exact executable protocol declaration');
const effective = JSON.parse(JSON.stringify(vm.runInNewContext('(' + literal[1] + ')', Object.create(null), { timeout: 1000 })));
require('node:assert/strict').deepEqual(JSON.parse(fs.readFileSync(dir + '/PERFORMANCE_PROTOCOL.json', 'utf8')).effective, effective);
const configPath = root + '/services/api-gateway/tsconfig.json';
const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
if (cfg.error) throw Error(ts.flattenDiagnosticMessageText(cfg.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(configPath));
const options = {
  ...parsed.options, noEmit: true, incremental: false, composite: false, skipLibCheck: true, strict: true,
  types: [...new Set([...(parsed.options.types || []), 'node'])],
  typeRoots: [root + '/node_modules/.pnpm/@types+node@20.19.33/node_modules/@types', root + '/services/api-gateway/node_modules', root + '/node_modules'],
};
const host = ts.createCompilerHost(options);
const oldRead = host.readFile.bind(host), oldExists = host.fileExists.bind(host), oldSource = host.getSourceFile.bind(host);
host.readFile = file => overlays.get(file) || oldRead(file);
host.fileExists = file => overlays.has(file) || oldExists(file);
host.getSourceFile = (file, version, error, create) => overlays.has(file) ? ts.createSourceFile(file, overlays.get(file), version, true) : oldSource(file, version, error, create);
host.writeFile = () => { throw Error('No emission permitted'); };
const program = ts.createProgram([...overlays.keys()], options, host);
const all = ts.getPreEmitDiagnostics(program);
const relevant = all.filter(diagnostic => !diagnostic.file || overlays.has(diagnostic.file.fileName));
const details = diagnostics => diagnostics.map(diagnostic => ({ file: diagnostic.file?.fileName, line: diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : null, code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n') }));
const syntax = [];
for (const name of [...names, 'plan-parser.test.ts']) {
  const result = ts.transpileModule(fs.readFileSync(dir + '/' + name, 'utf8'), { fileName: name, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
  syntax.push(...details(result.diagnostics || []).map(diagnostic => ({ ...diagnostic, file: name })));
}
const after = pins();
require('node:assert/strict').deepEqual(after, before);
const report = { scope: 'Strict private suite/parser virtual overlays and three-file syntax only; dependencies inspected, never executed', inputPinsBefore: before, inputPinsAfter: after, effectiveProtocolMatches: true, virtualMainWrites: 0, programSourceFiles: program.getSourceFiles().length, scopedDiagnostics: details(relevant), otherDependencyDiagnostics: all.length - relevant.length, otherDependencyDiagnosticSample: details(all.filter(diagnostic => diagnostic.file && !overlays.has(diagnostic.file.fileName)).slice(0, 3)), transpileDiagnostics: syntax, wholeBackendTypecheckClaimed: false, nativeExecuted: false };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ sourceFiles: report.programSourceFiles, scopedDiagnostics: report.scopedDiagnostics, otherDependencyDiagnostics: report.otherDependencyDiagnostics, transpileDiagnostics: syntax, inputPinsExact: true }) + '\n');
if (relevant.length || syntax.length) process.exitCode = 1;
