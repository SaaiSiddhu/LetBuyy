import assert from 'node:assert/strict';
import test from 'node:test';
import { readStoreThemeAllowance, resolveStoreThemeLimit } from '../lib/theme-library-limits';
import { AppError } from '../lib/errors';
const site='11111111-1111-4111-8111-111111111111';
type Db=Parameters<typeof resolveStoreThemeLimit>[0];
function fixture(limits:Record<string,unknown>,options:{plan?:string;foreign?:boolean;unavailable?:boolean}={}) {
  return {from(){throw new Error('The old plan/subscription reader must not be used');},async rpc(name:string,args:unknown){
    assert.equal(name,'resolve_site_entitlements');assert.deepEqual(args,{p_site_id:site});
    return options.unavailable?{data:null,error:{message:'Synthetic unavailable'}}:{data:{site_id:options.foreign?'22222222-2222-4222-8222-222222222222':site,site_type:'store',plan:options.plan||'free',features:[],limits,entitlements:{}},error:null};
  }} as unknown as Db;
}
test('theme allowance uses the canonical persisted plan and preserves current site overrides, zero and unlimited',async()=>{
  for(const themes of [0,1,7,null])assert.equal((await resolveStoreThemeLimit(fixture({themes}),site)).limit,themes);
  assert.deepEqual(await resolveStoreThemeLimit(fixture({}),site),{limit:1,plan_name:'Free'});
  assert.equal((await resolveStoreThemeLimit(fixture({},{plan:'starter'}),site)).limit,3);
});
test('malformed, foreign and unavailable allowances never become an unlimited installation grant',async()=>{
  for(const db of [fixture({themes:-1}),fixture({themes:1.5}),fixture({themes:'3'}),fixture({themes:false}),fixture({themes:3},{foreign:true}),fixture({themes:3},{unavailable:true})])
    await assert.rejects(resolveStoreThemeLimit(db,site),(error:unknown)=>error instanceof AppError&&error.code==='THEME_STATE_UNAVAILABLE'&&error.statusCode===503);
});

test('allowance projection takes included identities and custom count only from the owned database reader', async () => {
  const db = fixture({themes:1});
  const billingRpc = db.rpc.bind(db);
  const actor='22222222-2222-4222-8222-222222222222';
  db.rpc = (async (name:string,args:unknown) => {
    if(name==='resolve_site_entitlements') return billingRpc(name,args);
    assert.equal(name,'read_owned_theme_library_allowance_v1'); assert.deepEqual(args,{p_actor:actor,p_site:site,p_bound_site:null});
    return {data:{included_themes:['letbuyy-forge','letbuyy-sense'],custom_used:1},error:null};
  }) as unknown as Db['rpc'];
  assert.deepEqual(await readStoreThemeAllowance(db,site,actor),{included_themes:['letbuyy-forge','letbuyy-sense'],custom_used:1,custom_limit:1,plan_name:'Free'});
});
