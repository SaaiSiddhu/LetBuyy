const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const evidence = 'docs/implementation/niche-themes-2026-10-23/dewdrop';
const commands = [
  ['facts-editor-lint',['node_modules/eslint/bin/eslint.js','src/components/products/niche-facts/dewdrop-facts-editor.tsx','src/components/products/niche-facts/dewdrop-facts-editor.test.tsx'],'apps/merchant/web'],
  ['facts-editor-typecheck',['node_modules/typescript/bin/tsc','--noEmit','--target','ES2022','--module','ESNext','--jsx','react-jsx','--moduleResolution','Bundler','--skipLibCheck','--esModuleInterop','--strict','apps/merchant/web/src/components/products/niche-facts/dewdrop-facts-editor.tsx','apps/merchant/web/src/components/products/niche-facts/dewdrop-facts-editor.test.tsx']],
  ['targeted-tests', ['--import','tsx','--test','packages/commerce-core/test/dewdrop-facts.test.ts','packages/theme-engine/test/dewdrop.test.ts','apps/commerce/web/src/lib/demo/dewdrop-demo.test.ts',`${evidence}/mapper-liquid.test.ts`,`${evidence}/collection-membership.test.ts`,'apps/merchant/web/src/components/products/niche-facts/dewdrop-facts-editor.test.tsx']],
  ['theme-typecheck',['node_modules/typescript/bin/tsc','--noEmit','--incremental','--tsBuildInfoFile','/private/tmp/dewdrop-theme-typecheck.tsbuildinfo','-p','packages/theme-engine/tsconfig.json']],
  ['facts-typecheck',['node_modules/typescript/bin/tsc','--noEmit','--incremental','--tsBuildInfoFile','/private/tmp/dewdrop-facts-typecheck.tsbuildinfo','-p','packages/commerce-core/tsconfig.json']],
  ['demo-typecheck',['node_modules/typescript/bin/tsc','--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--skipLibCheck','--esModuleInterop','--strict','apps/commerce/web/src/lib/demo/dewdrop-demo.ts','apps/commerce/web/src/lib/demo/dewdrop-demo.test.ts',`${evidence}/collection-membership.test.ts`]],
];
const checks=commands.map(([name,args,cwd])=>{const start=new Date().toISOString();const r=spawnSync(process.execPath,args,{encoding:'utf8',cwd:cwd||process.cwd()});const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(`${evidence}/${name}.log`,output);return{name,command:'node '+args.join(' '),cwd:cwd||'.',startedAt:start,exitCode:r.status,success:r.status===0,log:`${name}.log`,summary:output.match(/# (tests|pass|fail|skipped) \d+/g)||[],error:r.error?.message};});
const sources=['apps/merchant/web/src/components/products/niche-facts/dewdrop-facts-editor.tsx','apps/merchant/web/src/components/products/niche-facts/dewdrop-facts-editor.test.tsx','packages/theme-engine/src/dewdrop-theme.ts','packages/theme-engine/src/dewdrop-styles.ts','packages/theme-engine/src/dewdrop-discovery.ts','packages/theme-engine/test/dewdrop.test.ts','packages/commerce-core/src/dewdrop-facts.ts','packages/commerce-core/test/dewdrop-facts.test.ts','apps/commerce/web/src/lib/demo/dewdrop-demo.ts','apps/commerce/web/src/lib/demo/dewdrop-demo.test.ts'];
const hash=file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const audit=JSON.parse(fs.readFileSync(`${evidence}/browser-audit.json`,'utf8'));
const browserCases=[...audit.results,audit.textExpansion,audit.hindi];
const browserPass=browserCases.every(r=>r.bodyWidth===r.width&&r.documentWidth===r.width&&!r.brokenImages.length&&!r.overflow.length&&!r.smallPrimaryControls.length);
const report={generatedAt:new Date().toISOString(),checks,sources:sources.map(hash),sharedReadSnapshot:['packages/theme-engine/src/theme-renderer.ts','packages/theme-engine/src/first-party-theme-catalog.ts','apps/commerce/web/src/lib/theme-engine/product-liquid-drop.ts','apps/commerce/web/src/lib/demo/catalog-demo-dispatch.ts'].map(hash),browser:{success:browserPass,cases:browserCases.length,screenshots:audit.results.length+2,widths:[1440,834,390,320],evidence:'browser-audit.json',scope:audit.scope,resourcesReleased:true},complete:checks.every(c=>c.success)&&browserPass,merchantComponentBrowserVerified:false,fullLifecycleAccepted:false};
fs.writeFileSync(`${evidence}/verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:checks.map(({name,exitCode,summary})=>({name,exitCode,summary})),browser:report.browser,complete:report.complete}));
if(!report.complete)process.exitCode=1;
