import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root='/Volumes/Projects/LetBuyy',out=dirname(fileURLToPath(import.meta.url));
const privateRoot=JSON.parse(readFileSync(join(out,'CART_EDIT_PRIVATE02_BASE.json'),'utf8')).privateRoot;
const req=createRequire(join(root,'package.json')),{ESLint}=req('eslint');
const config=(await import(join(root,'apps/commerce/web/eslint.config.mjs'))).default;
const eslint=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:config,ignore:false});
const allocation=JSON.parse(readFileSync(join(root,'docs/implementation/niche-theme-programme/completion-madeyours-cart-edit-private-allocation-20261024-02.json'),'utf8'));
const reports=[];
for(const epoch of ['before','after']){
 const rows=[];
 for(const f of allocation.sourceInputs){const p=join(epoch==='before'?root:privateRoot,f.path);if(!existsSync(p))continue;const[r]=await eslint.lintText(readFileSync(p,'utf8'),{filePath:join(root,f.path),warnIgnored:true});rows.push({path:f.path,errors:r.errorCount,warnings:r.warningCount,messages:r.messages});}
 reports.push({epoch,rows,counts:{errors:rows.reduce((n,r)=>n+r.errors,0),warnings:rows.reduce((n,r)=>n+r.warnings,0)}});
}
const flat=v=>v.rows.flatMap(r=>r.messages.map(m=>({path:r.path,...m})));
const key=m=>JSON.stringify([m.path,m.ruleId,m.severity,m.message,m.column]);
const seen=new Map();for(const m of flat(reports[0]))seen.set(key(m),(seen.get(key(m))||0)+1);
const introduced=flat(reports[1]).filter(m=>{const n=seen.get(key(m))||0;if(n){seen.set(key(m),n-1);return false;}return true;});
const report={classification:'ACTUAL_PRIVATE_CART_SOURCE_EXISTING_MAIN_ESLINT_POLICY_NO_MAIN_MUTATION',privateRoot,before:reports[0],after:reports[1],introduced};
writeFileSync(join(out,'cart-edit02-lint.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:reports[0].counts,after:reports[1].counts,introduced}));
if(introduced.some(m=>m.severity===2))process.exitCode=1;
