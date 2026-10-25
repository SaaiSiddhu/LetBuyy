// Pure semantic compile of current CI and explicit qualification roots; no native execution/output/DB.
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const root=new URL('../../../../',import.meta.url);
const config=fileURLToPath(new URL('services/api-gateway/tsconfig.json',root));
const loaded=ts.readConfigFile(config,ts.sys.readFile);
if(loaded.error)throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(loaded.config,ts.sys,dirname(config));
const roots=['services/api-gateway/src/__tests__/owned-db/theme-publisher-acl.postgres.test.ts','services/api-gateway/src/__tests__/owned-db/theme-publisher-acl-qualification.manual.ts','services/api-gateway/src/__tests__/owned-db/playfield201-promotion-qualification.manual.ts'].map(path=>fileURLToPath(new URL(path,root)));
const program=ts.createProgram(roots,{...parsed.options,noEmit:true,incremental:false});
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length)process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:p=>p,getCurrentDirectory:ts.sys.getCurrentDirectory,getNewLine:()=> '\n'}));
process.exitCode=diagnostics.length?1:0;
