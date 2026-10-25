import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),candidate='/private/tmp/letbuyy-shared-completion-20261024-06';
const req=createRequire(candidate+'/packages/commerce-core/package.json'),ts=req('typescript');
const nodeTypes=createRequire(candidate+'/apps/merchant/web/package.json').resolve('@types/node/package.json');
const roots=['packages/commerce-core/src/product-fact-snapshot.ts','packages/commerce-core/src/product-facts-summary.ts','packages/commerce-core/test/apparel-order-history.test.ts','packages/theme-engine/src/niche-order-presentation.ts','apps/commerce/web/src/lib/order-fact-readback.test.ts'].map(x=>path.join(root,x));
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,allowImportingTsExtensions:true,types:['node'],typeRoots:[path.dirname(path.dirname(nodeTypes))],lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']};
const program=ts.createProgram(roots,options),diagnostics=ts.getPreEmitDiagnostics(program);
const leaks=program.getSourceFiles().map(x=>x.fileName).filter(x=>/^\/Volumes\/Projects\/LetBuyy\/(packages|apps|services)\//.test(x));
const allocation=JSON.parse(fs.readFileSync('BASE_INPUTS.json','utf8')).grant;
const syntax=[];
for(const x of allocation.exactPrivateSourceOverlayPaths){const filename=path.join(root,x.path),s=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,reportDiagnostics:true,compilerOptions:options});for(const d of s.diagnostics??[])syntax.push({path:x.path,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});}
const report={classification:'FOCUSED_STRICT_PRIVATE_TYPECHECK_AND_EIGHT_OVERLAY_SYNTAX_CHECKS_NOT_NATIVE_EXECUTION_OR_BUILD',strictRoots:roots,sourceFileCount:program.getSourceFiles().length,diagnostics:diagnostics.map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),syntaxDiagnostics:syntax,MainWorkspaceBusinessLeaks:leaks,limits:'Native case source and Gateway cart source syntax checked only here; their full coherent Worker closure type/native qualification requires fresh admission.'};
fs.writeFileSync('evidence/typecheck01.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({diagnostics:diagnostics.length,syntaxDiagnostics:syntax.length,MainWorkspaceBusinessLeaks:leaks.length,sourceFiles:report.sourceFileCount}));process.exitCode=diagnostics.length||syntax.length||leaks.length?1:0;
