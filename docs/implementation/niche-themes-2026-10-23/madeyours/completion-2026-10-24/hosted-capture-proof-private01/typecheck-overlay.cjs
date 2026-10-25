// Semantic analysis only: no application import/evaluation, no emit, no build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const root='/Volumes/Projects/LetBuyy',privateRoot='/private/tmp/letbuyy-hosted-capture-proof-prep-20261025-01';
const ts=createRequire(path.join(root,'package.json'))('typescript');
const configPath=path.join(root,'services/api-gateway/tsconfig.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,path.dirname(configPath));
const files=['services/api-gateway/src/routes/checkout.ts','services/api-gateway/src/__tests__/owned-db/hosted-checkout-buyer-ownership.postgres.test.ts','services/api-gateway/src/__tests__/owned-db/hosted-checkout-capture-proof-qualification.manual.ts'];
function run(overlay){
 const host=ts.createCompilerHost({...parsed.options,noEmit:true}),readFile=host.readFile.bind(host),fileExists=host.fileExists.bind(host),loaded=new Map();
 const virtual=new Map(overlay?files.map(p=>[path.join(root,p),fs.readFileSync(path.join(privateRoot,p),'utf8')]):[]);
 host.readFile=p=>{const source=virtual.has(p)?virtual.get(p):readFile(p);if(source!==undefined)loaded.set(p,crypto.createHash('sha256').update(source).digest('hex'));return source;};
 host.fileExists=p=>virtual.has(p)||fileExists(p);
 host.getSourceFile=(p,languageVersion)=>{const source=host.readFile(p);return source===undefined?undefined:ts.createSourceFile(p,source,languageVersion,true);};
 const rootNames=[...parsed.fileNames,...(overlay?[path.join(root,files[2])]:[])];
 const program=ts.createProgram({rootNames,options:{...parsed.options,noEmit:true},host});
 const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
 return {diagnostics,loaded:[...loaded].map(([file,sha256])=>({file,sha256}))};
}
const baseline=run(false),proposal=run(true);
const baselineSet=new Set(baseline.diagnostics.map(d=>JSON.stringify(d)));
const introduced=proposal.diagnostics.filter(d=>!baselineSet.has(JSON.stringify(d)));
const result={classification:'PURE_TYPESCRIPT_SEMANTIC_ANALYSIS_NO_APPLICATION_MODULE_EXECUTION',baselineDiagnosticCount:baseline.diagnostics.length,proposalDiagnosticCount:proposal.diagnostics.length,introducedDiagnosticCount:introduced.length,baselineDiagnostics:baseline.diagnostics,proposalDiagnostics:proposal.diagnostics,introduced,overlayPaths:files,sourceInputs:proposal.loaded};
fs.writeFileSync(path.join(__dirname,'typecheck-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({baseline:baseline.diagnostics.length,proposal:proposal.diagnostics.length,introduced:introduced.length,inputs:proposal.loaded.length}));
if(introduced.length)process.exitCode=1;
