import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.cwd(), out = dirname(fileURLToPath(import.meta.url));
const relative = 'services/api-gateway/src/__tests__/owned-db/circuit-facets-qualification.manual.ts';
const target = resolve(root, relative), candidate = readFileSync(resolve(root, relative), 'utf8');
// Type-check the exact proposed canonical path virtually. This avoids creating
// a Main file or misresolving a copied harness's relative dependency closure.
const configPath = resolve(root, 'services/api-gateway/tsconfig.json');
const read = ts.readConfigFile(configPath, ts.sys.readFile);
if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
const nodeDeclarations = resolve(root, 'node_modules/.pnpm/node_modules/@types/node/index.d.ts');
config.options.paths['@letbuyy/commerce-core'] = [resolve(root, 'packages/commerce-core/src/index.ts')];
const host = ts.createCompilerHost(config.options), original = host.getSourceFile;
host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => resolve(path) === target
  ? ts.createSourceFile(path, candidate, languageVersion, true)
  : original(path, languageVersion, onError, shouldCreateNewSourceFile);
const program = ts.createProgram([target, nodeDeclarations], config.options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
const text = ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n' });
writeFileSync(resolve(out, 'main-native-typecheck.log'), text, { flag: 'wx' });
process.stdout.write(JSON.stringify({ diagnosticCount: diagnostics.length, virtualCanonicalPath: relative, MainFileCreatedByChecker: false }) + '\n');
process.exitCode = diagnostics.length ? 1 : 0;
