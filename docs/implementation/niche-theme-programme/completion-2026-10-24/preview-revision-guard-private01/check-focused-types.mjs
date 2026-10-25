import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
const root = process.cwd();
const leaf = resolve(root, 'services/api-gateway/src/routes/storefront/theme-preview-session-revision.test.ts');
const program = ts.createProgram([leaf], { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ['node'], esModuleInterop: true });
const sourceFiles = program.getSourceFiles().map(file => ({ path: file.fileName, sha256: createHash('sha256').update(readFileSync(file.fileName)).digest('hex') }));
const unexpectedBusinessFiles = sourceFiles.filter(file => file.path !== leaf && !file.path.includes('/node_modules/'));
const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({ file: d.file && relative(root, d.file.fileName), code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
const syntax = ['services/api-gateway/src/routes/storefront/public-routes.ts', 'services/api-gateway/src/__tests__/owned-db/theme-editor-preview-content.postgres.test.ts'].map(path => {
    const text = readFileSync(resolve(root, path), 'utf8');
    const output = ts.transpileModule(text, { fileName: path, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    return { path, sha256: createHash('sha256').update(text).digest('hex'), syntaxDiagnostics: (output.diagnostics || []).map(d => d.code), semanticTypecheck: 'PENDING_FULL_INTEGRATION; only syntax transpilation performed for these two existing source files' };
});
const record = { classification: 'FOCUSED_NEW_TEST_SEMANTIC_TYPES_AND_TWO_EXISTING_FILE_SYNTAX_ONLY', compiler: ts.version, sourceFiles, unexpectedBusinessFiles, diagnostics, syntax, actualWorkerDatabaseOrNativeExecution: false };
writeFileSync('focused-types.json', JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ sourceFiles: sourceFiles.length, diagnostics, unexpectedBusinessFiles, syntax }));
if (diagnostics.length || unexpectedBusinessFiles.length || syntax.some(row => row.syntaxDiagnostics.length)) process.exitCode = 1;
