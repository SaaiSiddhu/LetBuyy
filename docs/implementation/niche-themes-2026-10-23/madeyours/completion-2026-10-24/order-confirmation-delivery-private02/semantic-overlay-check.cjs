const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const main='/Volumes/Projects/LetBuyy',priv='/private/tmp/letbuyy-order-confirmation-delivery-prep-20261025-02';
const ts=createRequire(main+'/package.json')('typescript');
const files=['services/api-gateway/src/lib/order-confirmation-email.ts','services/api-gateway/src/__tests__/order-confirmation-email.test.ts','services/queue-workers/src/index.ts'];
function run(root,configName,overlay){
 const configPath=path.join(root,configName),raw=ts.readConfigFile(configPath,ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(raw.config,ts.sys,path.dirname(configPath));
 const host=ts.createCompilerHost({...parsed.options,noEmit:true}),read=host.readFile.bind(host),exists=host.fileExists.bind(host),loaded=new Map();
 const virtual=new Map(overlay?files.map(p=>[path.join(main,p),fs.readFileSync(path.join(priv,p),'utf8')]):[]);
 host.readFile=p=>{const s=virtual.has(p)?virtual.get(p):read(p);if(s!==undefined)loaded.set(p,crypto.createHash('sha256').update(s).digest('hex'));return s;};
 host.fileExists=p=>virtual.has(p)||exists(p);
 host.getSourceFile=(p,v)=>{const s=host.readFile(p);return s===undefined?undefined:ts.createSourceFile(p,s,v,true);};
 const program=ts.createProgram({rootNames:parsed.fileNames,options:{...parsed.options,noEmit:true},host});
 return{diagnostics:ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),inputs:[...loaded].map(([file,sha256])=>({file,sha256}))};
}
const witnessOnly=process.argv.includes('--witness-only');
const results=witnessOnly?JSON.parse(fs.readFileSync(path.join(__dirname,'SEMANTIC_RESULTS_ATTEMPT01.json'),'utf8')).results:[];
for(const name of witnessOnly?[]:['services/api-gateway/tsconfig.json','services/queue-workers/tsconfig.json']){
 const baseline=run(main,name,false),proposal=run(main,name,true),previous=new Set(baseline.diagnostics.map(d=>JSON.stringify(d))),introduced=proposal.diagnostics.filter(d=>!previous.has(JSON.stringify(d)));
 results.push({config:name,baseline,proposal,introduced});
 console.log(JSON.stringify({config:name,baseline:baseline.diagnostics.length,proposal:proposal.diagnostics.length,introduced:introduced.length}));
}
const witness=[];
for(const root of ['/private/tmp/letbuyy-hosted-capture-native-red-20261025-01','/private/tmp/letbuyy-hosted-capture-native-green-20261025-01']){
 const result=run(root,'services/api-gateway/tsconfig.json',false);witness.push({root,...result});console.log(JSON.stringify({witnessRoot:root,diagnostics:result.diagnostics.length,inputs:result.inputs.length}));
}
fs.writeFileSync(path.join(__dirname,'SEMANTIC_RESULTS.json'),JSON.stringify({classification:'PURE_NO_EMIT_SEMANTIC_ANALYSIS_NO_APPLICATION_MODULE_OR_STANDALONE_PREFLIGHT_EXECUTION',results,witness},null,2)+'\n');
if(results.some(r=>r.introduced.length)||witness.some(r=>r.diagnostics.length))process.exitCode=1;
