const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const evidence = 'docs/implementation/niche-themes-2026-10-23/dewdrop';
const files = ['packages/commerce-core/src/product-facts-summary.ts','packages/commerce-core/test/product-facts-summary.test.ts','apps/commerce/web/src/components/storefront/niche-order-facts.tsx','apps/commerce/web/src/components/storefront/niche-order-facts.test.tsx','apps/merchant/web/src/components/orders/niche-order-facts.tsx','apps/merchant/web/src/components/orders/niche-order-facts.test.tsx'];
const commands = [
 ['order-facts-tests',['--import','tsx','--test',files[1],files[3],files[5]]],
 ['order-facts-focused-typecheck',['node_modules/typescript/bin/tsc','--noEmit','--target','ES2022','--module','ESNext','--jsx','react-jsx','--moduleResolution','Bundler','--skipLibCheck','--esModuleInterop','--strict','--types','node','--typeRoots','apps/merchant/web/node_modules/@types',...files]],
 ['order-facts-package-typecheck',['node_modules/typescript/bin/tsc','--noEmit','--incremental','--tsBuildInfoFile','/private/tmp/dewdrop-summary-typecheck.tsbuildinfo','-p','packages/commerce-core/tsconfig.json']],
 ['order-facts-buyer-lint',['node_modules/eslint/bin/eslint.js','src/components/storefront/niche-order-facts.tsx','src/components/storefront/niche-order-facts.test.tsx'],'apps/commerce/web'],
 ['order-facts-merchant-lint',['node_modules/eslint/bin/eslint.js','src/components/orders/niche-order-facts.tsx','src/components/orders/niche-order-facts.test.tsx'],'apps/merchant/web'],
];
const checks=commands.map(([name,args,cwd])=>{const startedAt=new Date().toISOString();const r=spawnSync(process.execPath,args,{encoding:'utf8',cwd:cwd||process.cwd()});const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(`${evidence}/${name}.log`,output);return{name,command:'node '+args.join(' '),cwd:cwd||'.',startedAt,exitCode:r.status,success:r.status===0,log:`${name}.log`,summary:output.match(/# (tests|pass|fail|skipped) \d+/g)||[]};});
const hash=path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
const report={generatedAt:new Date().toISOString(),scope:'New pure order-facts presentation and thin host wrappers only; prior34 Dewdrop qualification retained separately.',checks,sources:files.map(hash),publicExportSnapshot:hash('packages/commerce-core/src/index.ts'),complete:checks.every(c=>c.success),snapshotWriterOwnedBy:'MadeYours',sharedOrderProjectionsEdited:false,realOrderReadbackAccepted:false,browserOrDbUsed:false};
fs.writeFileSync(`${evidence}/order-facts-verification.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:checks.map(({name,exitCode,summary})=>({name,exitCode,summary})),complete:report.complete}));if(!report.complete)process.exitCode=1;
