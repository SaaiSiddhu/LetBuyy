// Exercise the actual validators in owned source fixtures. Unsafe variants must
// stay red; the current composition/private-custody source must remain admitted.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
function run(validator,files){
 const fixture=mkdtempSync(join(tmpdir(),'letbuyy-source-guard-'));
 try{
  for(const[path,source]of Object.entries(files)){const target=join(fixture,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,source);}
  const result=spawnSync(process.execPath,[join(root,'scripts/validators',validator)],{cwd:fixture,encoding:'utf8',timeout:15000});
  assert.ok(result.status===0||result.status===1,result.stderr);return result;
 }finally{rmSync(fixture,{recursive:true,force:true});}
}
const read=path=>readFileSync(join(root,path),'utf8');
const migration='database/supabase/migrations/372_merchant_account_messages.sql';
const custody=read(migration);
test('policy classifier accepts the exact private owner custody with FORCE RLS and denied app roles',()=>{
 const result=run('foundation-sql-policy-residue-validator.mjs',{[migration]:custody});assert.equal(result.status,0,result.stderr);
});
for(const role of ['PUBLIC','anon','authenticated','app_tenant','service_role'])test('private custody classification rejects broader '+role+' authority',()=>{
 const changed=custody.replaceAll('TO postgres USING(true)',`TO ${role} USING(true)`);assert.notEqual(changed,custody);
 const result=run('foundation-sql-policy-residue-validator.mjs',{[migration]:changed});assert.equal(result.status,1,result.stdout);
});
for(const [name,mutate]of [
 ['missing forced RLS',s=>s.replaceAll('FORCE ROW LEVEL SECURITY','ENABLE ROW LEVEL SECURITY')],
 ['missing application-role revocation',s=>s.replace('REVOKE ALL ON public.merchant_announcements,public.merchant_announcement_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;','')],
 ['same policy on a foreign table',s=>s.replace('CREATE POLICY platform_message_custody ON public.merchant_announcements','CREATE POLICY platform_message_custody ON public.unreviewed_table')],
])test('private custody classification rejects '+name,()=>{
 const changed=mutate(custody);assert.notEqual(changed,custody);assert.equal(run('foundation-sql-policy-residue-validator.mjs',{[migration]:changed}).status,1);
});
const page='apps/marketing/web/src/app/[locale]/page.tsx',composition='apps/marketing/web/src/components/MarketingHome.tsx';
const marketing={[page]:read(page),[composition]:read(composition)};
for(const name of ['Navbar','HeroSection','FeaturesSection','PricingSection','TestimonialsSection','Testimonials','CTASection','SocialProof','Capabilities'])marketing[`docs/archive/dead-code/marketing-site/components/${name}.tsx`]='// Owned fixture archive marker\n';
test('marketing validator admits server pricing supplied to the live client composition',()=>{
 const result=run('marketing-dead-twin-validator.mjs',marketing);assert.equal(result.status,0,result.stderr);
});
for(const [name,path,mutate]of [
 ['archived twin in client composition',composition,s=>s+"\nimport Dead from '@/components/TestimonialsSection';\n"],
 ['missing live Header',composition,s=>s.replace("import Header from '@/components/Header'",'')],
 ['missing server pricing read',page,s=>s.replace('await loadPublicPricing()','null')],
 ['missing composed pricing slot',composition,s=>s.replace('{pricing}','{null}')],
])test('marketing composition validator rejects '+name,()=>{
 const changed=mutate(marketing[path]);assert.notEqual(changed,marketing[path]);assert.equal(run('marketing-dead-twin-validator.mjs',{...marketing,[path]:changed}).status,1);
});
