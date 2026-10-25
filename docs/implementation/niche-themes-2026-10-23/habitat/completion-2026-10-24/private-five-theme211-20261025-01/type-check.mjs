// No emit, no native module import/execution, no build/DB/browser/provider.
import ts from 'typescript';
import {writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.argv[2]||'/private/tmp/letbuyy-five-theme211-prep-20261025-01';
const here=dirname(fileURLToPath(import.meta.url));
const paths=['packages/theme-engine/src/first-party-theme-catalog.ts','packages/theme-engine/test/first-party-five-theme-v211.test.ts','docs/implementation/niche-theme-programme/completion-2026-10-24/five-theme211-integration01/generate-sense211-proposal.ts'];
const config=ts.readConfigFile(resolve(root,'services/api-gateway/tsconfig.json'),ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,resolve(root,'services/api-gateway'));
const options={...parsed.options,noEmit:true,incremental:false,composite:false,declaration:false,declarationMap:false,tsBuildInfoFile:undefined};
const program=ts.createProgram(paths.map(path=>resolve(root,path)),options);
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?relative(root,d.file.fileName):null,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,code:d.code,category:ts.DiagnosticCategory[d.category],message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const touched=diagnostics.filter(d=>d.file&&paths.includes(d.file));
writeFileSync(resolve(here,process.argv[3]||'TYPE_EVIDENCE.json'),JSON.stringify({recordedAt:new Date().toISOString(),classification:'NO_EMIT_TYPESCRIPT_SOURCE_PROGRAM_NOT_BUILD_OR_NATIVE',rootPaths:paths,sourceFiles:program.getSourceFiles().length,diagnostics,touchedDiagnostics:touched,noEmit:true,modulesExecuted:false,nativeOrBuild:false},null,2)+'\n');
process.stdout.write(JSON.stringify({sourceFiles:program.getSourceFiles().length,diagnostics:diagnostics.length,touchedDiagnostics:touched.length,noEmit:true})+'\n');
process.exitCode=touched.length?1:0;
