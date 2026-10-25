import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),candidate='/private/tmp/letbuyy-shared-completion-20261024-06';
const req=createRequire(candidate+'/packages/commerce-core/package.json'),ts=req('typescript');
const nodeTypes=createRequire(candidate+'/apps/merchant/web/package.json').resolve('@types/node/package.json');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,allowImportingTsExtensions:true,resolveJsonModule:true,types:['node'],typeRoots:[path.dirname(path.dirname(nodeTypes))],lib:['lib.es2022.d.ts'],baseUrl:candidate+'/services/api-gateway',paths:{'@letbuyy/commerce-core':[root+'/packages/commerce-core/src/index.ts']}};
const host=ts.createCompilerHost(options);const defaultResolve=host.resolveModuleNames;
host.resolveModuleNames=(names,file)=>names.map(name=>{let found=ts.resolveModuleName(name,file,options,host).resolvedModule;
 if(!found&&file.startsWith(root+'/'))found=ts.resolveModuleName(name,candidate+file.slice(root.length),options,host).resolvedModule;
 if(false && found?.resolvedFileName.startsWith(candidate+'/')){const overlay=root+found.resolvedFileName.slice(candidate.length);if(fs.existsSync(overlay))found={...found,resolvedFileName:overlay};}
 return found;});
const roots=[candidate+'/services/api-gateway/src/lib/cart-product-facts.ts',candidate+'/services/api-gateway/src/__tests__/owned-db/gateway-harness.ts',candidate+'/services/api-gateway/node_modules/@cloudflare/workers-types/index.d.ts'];
options.paths={'@letbuyy/commerce-core':[candidate+'/packages/commerce-core/src/index.ts']};
const program=ts.createProgram(roots,options,host),diagnostics=ts.getPreEmitDiagnostics(program);
const ownedDiagnostics=diagnostics.filter(d=>d.file?.fileName.startsWith(root+'/'));
const leaks=program.getSourceFiles().map(x=>x.fileName).filter(x=>/^\/Volumes\/Projects\/LetBuyy\/(packages|apps|services)\//.test(x));
const format=d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});
const report={classification:'WORKER_CLOSURE_SOURCE_ONLY_NO_NATIVE_OR_DATABASE_EXECUTION',rootPaths:roots,sourceFileCount:program.getSourceFiles().length,ownedDiagnostics:ownedDiagnostics.map(format),candidateDiagnostics:diagnostics.filter(d=>!ownedDiagnostics.includes(d)).map(format),MainWorkspaceBusinessLeaks:leaks,limits:'Read-only candidate support resolution is not an execution materialization. Fresh allocator must close and pin actual native source/dependency profile separately.'};fs.writeFileSync('evidence/worker-baseline-typecheck01.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({ownedDiagnostics:ownedDiagnostics.length,candidateDiagnostics:report.candidateDiagnostics.length,MainWorkspaceBusinessLeaks:leaks.length,sourceFiles:report.sourceFileCount}));process.exitCode=ownedDiagnostics.length||leaks.length?1:0;
