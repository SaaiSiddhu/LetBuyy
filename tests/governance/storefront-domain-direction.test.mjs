import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const validator=resolve('scripts/validators/platform-domain-literal-validator.mjs');
const declaration=readFileSync('packages/shared-types/src/brand.ts','utf8').split('\n').find(l=>l.startsWith('export const DEFAULT_STOREFRONT_DOMAIN ='));
assert.ok(declaration);assert.match(declaration,/^export const DEFAULT_STOREFRONT_DOMAIN = 'letbuyy\.store';$/);const storefront=declaration.match(/'([^']+)'/)[1];
function run(files){const root=mkdtempSync(join(tmpdir(),'letbuyy-domain-policy-'));try{for(const[path,text]of Object.entries(files)){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text);}
 const result=spawnSync(process.execPath,[validator],{cwd:root,encoding:'utf8'});assert.equal(result.error,undefined);return result.status;
}finally{rmSync(root,{recursive:true,force:true});}}
test('real domain guard admits only the canonical storefront declaration and exact approved env keys',()=>{
 assert.equal(run({'packages/shared-types/src/brand.ts':declaration,'config/env/production.env.template':`NEXT_PUBLIC_STORE_ROOT_DOMAIN=${storefront}\nSTOREFRONT_ROOT_DOMAIN=${storefront}\nNEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.com`}),0);
});
for(const[name,path,text]of [
 ['account URL','apps/platform/identity/src/urls.ts',`const account='https://accounts.${storefront}'`],
 ['API URL','config/env/production.env.template',`NEXT_PUBLIC_API_URL=https://api.${storefront}`],
 ['admin URL','config/env/production.env.template',`NEXT_PUBLIC_ADMIN_URL=https://admin.${storefront}`],
 ['merchant cookie parent','config/env/production.env.template',`COOKIE_DOMAIN=.${storefront}`],
 ['app-local tenant literal','apps/merchant/web/src/urls.ts',`const url='https://some-shop.${storefront}'`],
 ['other line in canonical file','packages/shared-types/src/brand.ts',`${declaration}\nexport const BAD_ACCOUNT='https://accounts.${storefront}';`],
 ['unapproved env copy','apps/merchant/web/.env.example',`NEXT_PUBLIC_STORE_ROOT_DOMAIN=${storefront}`],
])test(`real domain guard rejects ${name}`,()=>assert.notEqual(run({[path]:text}),0));
