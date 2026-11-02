import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const validator=resolve('scripts/validators/platform-domain-literal-validator.mjs');
const declaration=readFileSync('packages/shared-types/src/brand.ts','utf8').split('\n').find(l=>l.startsWith('export const DEFAULT_STOREFRONT_DOMAIN ='));
assert.ok(declaration);assert.match(declaration,/^export const DEFAULT_STOREFRONT_DOMAIN = 'letbuyy\.store';$/);const storefront=declaration.match(/'([^']+)'/)[1];
const nativeDeclaration=readFileSync('packages/dart/models/lib/src/storefront_config.dart','utf8').split('\n').find(l=>l.startsWith('const defaultStorefrontDomain ='));
assert.equal(nativeDeclaration,`const defaultStorefrontDomain = '${storefront}';`,'native root must mirror the shared brand contract');
function run(files){const root=mkdtempSync(join(tmpdir(),'letbuyy-domain-policy-'));try{for(const[path,text]of Object.entries(files)){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text);}
 const result=spawnSync(process.execPath,[validator],{cwd:root,encoding:'utf8'});assert.equal(result.error,undefined);return result.status;
}finally{rmSync(root,{recursive:true,force:true});}}
test('real domain guard admits explicit API tenant root without changing platform hosts',()=>{
 assert.equal(run({'services/api-gateway/wrangler.toml':`[vars]\nNEXT_PUBLIC_STORE_ROOT_DOMAIN = "${storefront}"`}),0);
 assert.notEqual(run({'services/api-gateway/wrangler.toml':`API_URL = "https://api.${storefront}"`}),0);
});
test('real domain guard admits only the canonical storefront declaration and exact approved env keys',()=>{
 assert.equal(run({'packages/shared-types/src/brand.ts':declaration,'config/env/production.env.template':`NEXT_PUBLIC_STORE_ROOT_DOMAIN=${storefront}\nSTOREFRONT_ROOT_DOMAIN=${storefront}\nNEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.com`}),0);
});
test('native storefront declaration is admitted only at the exact shared Dart constant',()=>{
 assert.equal(run({'packages/dart/models/lib/src/storefront_config.dart':nativeDeclaration}),0);
 assert.notEqual(run({'apps/merchant/mobile/lib/config/local.dart':nativeDeclaration}),0);
 assert.notEqual(run({'packages/dart/models/lib/src/storefront_config.dart':`${nativeDeclaration}\nconst account='https://accounts.${storefront}';`}),0);
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

test('provider aliases are admitted only for the canonical Commerce project',()=>{
 for(const directory of ['apps/commerce/web','apps/platform/identity']){
  const config=JSON.stringify({apps:[{directory,production:{url:`https://storefront.${storefront}`}}]},null,2);
  assert.equal(run({'config/vercel/projects.json':config}),directory==='apps/commerce/web'?0:1);
 }
});

test('only matching deployed API environments admit the existing Commerce CNAME targets',()=>{
 const file='services/api-gateway/wrangler.toml';
 assert.equal(run({[file]:`[env.staging.vars]\nCUSTOM_DOMAIN_CNAME_TARGET = "storefront-staging.${storefront}"\n[env.production.vars]\nCUSTOM_DOMAIN_CNAME_TARGET = "storefront.${storefront}"`}),0);
 for(const [environment,hostname] of [['production','storefront-staging'],['staging','storefront'],['production','accounts'],['production','admin'],['production','api'],['production','some-shop']]){
  assert.notEqual(run({[file]:`[env.${environment}.vars]\nCUSTOM_DOMAIN_CNAME_TARGET = "${hostname}.${storefront}"`}),0);
 }
 assert.notEqual(run({'apps/merchant/web/.env.example':`CUSTOM_DOMAIN_CNAME_TARGET=storefront.${storefront}`}),0);
});


test('native callback exception admits only exact generated OS schemes, never an HTTPS host or suffix',()=>{
 const file='apps/merchant/mobile/lib/services/merchant_auth_contract.g.dart';
 for(const scheme of ['com.letbuyy.store.accounts://auth/callback','com.letbuyy.store.accounts.development://auth/callback','com.letbuyy.store.accounts.staging://auth/callback']) {
  assert.equal(run({[file]:`const callback = '${scheme}';`}),0);
  assert.notEqual(run({'apps/merchant/mobile/lib/config/local.dart':`const callback = '${scheme}';`}),0);
 }
 for(const value of ['https://com.letbuyy.store.accounts/auth/callback','com.letbuyy.store.accounts.evil://auth/callback','com.letbuyy.store.accounts://auth/callback/extra','https://accounts.letbuyy.store'])
  assert.notEqual(run({[file]:`const callback = '${value}';`}),0,value);
});
