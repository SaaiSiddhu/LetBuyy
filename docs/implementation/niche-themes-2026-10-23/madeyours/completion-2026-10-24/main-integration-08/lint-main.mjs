import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root='/Volumes/Projects/LetBuyy',out=dirname(fileURLToPath(import.meta.url));
const req=createRequire(join(root,'package.json')),{ESLint}=req('eslint');
const config=(await import(join(root,'apps/commerce/web/eslint.config.mjs'))).default;
const eslint=new ESLint({cwd:root,overrideConfigFile:true,overrideConfig:config,ignore:false});
const allocation=JSON.parse(readFileSync(join(root,'docs/implementation/niche-theme-programme/completion-checkout-main-allocation-20261024-08.json'),'utf8'));
const epoch=process.argv[2];if(!['before','after'].includes(epoch))throw Error('Choose before/after');
const rows=[];for(const f of allocation.files){const p=join(root,f.path);if(!existsSync(p))continue;const [r]=await eslint.lintText(readFileSync(p,'utf8'),{filePath:p,warnIgnored:true});rows.push({path:f.path,errors:r.errorCount,warnings:r.warningCount,messages:r.messages});}
const counts={errors:rows.reduce((n,r)=>n+r.errors,0),warnings:rows.reduce((n,r)=>n+r.warnings,0)};
const report={classification:'ACTUAL_MAIN_TOUCHED_SOURCE_ESLINT_EXISTING_COMMERCE_POLICY',epoch,counts,rows};
if(epoch==='after'){
 const before=JSON.parse(readFileSync(join(out,'lint-before.json'),'utf8'));
 const flat=v=>v.rows.flatMap(r=>r.messages.map(m=>({path:r.path,...m})));
 const key=m=>JSON.stringify([m.path,m.ruleId,m.severity,m.message,m.column]);
 const seen=new Map();for(const m of flat(before))seen.set(key(m),(seen.get(key(m))||0)+1);
 report.introduced=flat(report).filter(m=>{const n=seen.get(key(m))||0;if(n){seen.set(key(m),n-1);return false;}return true;});
}
writeFileSync(join(out,`lint-${epoch}.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({epoch,counts,introduced:report.introduced||[]}));if(report.introduced?.some(m=>m.severity===2))process.exitCode=1;
