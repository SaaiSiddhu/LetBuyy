import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import guardImport from '/Volumes/Projects/LetBuyy/services/api-gateway/src/tenant/tenant-scoped.ts';
import sessions from '/Volumes/Projects/LetBuyy/services/api-gateway/src/lib/hosted-checkout-session.ts';
const {createTenantGuardedSupabaseClient}=guardImport;
const ts=createRequire('/Volumes/Projects/LetBuyy/package.json')('typescript');
const unit=readFileSync(new URL('file:///private/tmp/madeyours-checkout-reentry-proposal-20261024-05/implementation-tests.mjs'),'utf8');
const prefix=unit.slice(unit.indexOf('const scope ='),unit.indexOf('async function claim('));
function model(route){return new Function('route','ts','sessions',prefix+'\nreturn {MemoryDb,runtime,scope,handoff,clone};')(route,ts,sessions);}
const old=readFileSync('/private/tmp/madeyours-checkout-reentry-proposal-20261024-03/implementation/services/api-gateway/src/routes/checkout.ts','utf8');
const current=readFileSync(new URL('file:///Volumes/Projects/LetBuyy/services/api-gateway/src/routes/checkout.ts'),'utf8');
for(const [label,source,refused]of [['sealed03',old,true],['actualMain08',current,false]]){
 test(`actual ${label} reentry function through canonical guard ${refused?'refuses':'accepts'} exact tenant/cart-scoped model`,async()=>{
  const {MemoryDb,runtime,handoff}=model(source),raw=new MemoryDb(),db=createTenantGuardedSupabaseClient(raw),api=runtime(db);
  if(refused)await assert.rejects(()=>api.canRestartContact({},handoff,raw.row),/requires a tenant\/owner predicate/);
  else assert.equal(await api.canRestartContact({},handoff,raw.row),true);
  assert.equal(raw.writes.length,0);
 });
 test(`actual ${label} committed COD receipt lookup through canonical guard ${refused?'refuses':'accepts'} exact tenant/order-scoped model`,async()=>{
  const {MemoryDb,scope,handoff}=model(source),raw=new MemoryDb(),db=createTenantGuardedSupabaseClient(raw);
  raw.receipt={site_id:scope.siteId,idempotency_key:'original-key',order_id:'committed',deleted_at:null};raw.owner={order_id:'committed'};
  raw.orderItems=[{product_id:'product',variant_id:null,quantity:1,product_snapshot:{cart_id:scope.cartId,cart_line_id:'line',product_version:1,configuration_fingerprint:'configuration',snapshot_fingerprint:'snapshot'}}];
  raw.order={id:'committed',store_id:scope.siteId,payment_method:'cod',total:219};
  const command={idempotency_key:'original-key',items:[{product_id:'product',variant_id:null,quantity:1,cart_fact_ref:{cart_id:scope.cartId,line_id:'line',product_version:1,configuration_fingerprint:'configuration',snapshot_fingerprint:'snapshot'}}]};
  const from=source.indexOf('async function loadCommittedCodOrder('),to=source.indexOf('async function runIdempotentStep(');
  const output=ts.transpileModule(source.slice(from,to)+'\nexport {loadCommittedCodOrder};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};new Function('canonicalizeExecutionPayload','exports',output)(JSON.stringify,exports);
  const bound={...handoff,cart:{...handoff.cart,status:'converted',checkout_handoff:{...handoff.cart.checkout_handoff,order_id:'committed'}}};
  if(refused)await assert.rejects(()=>exports.loadCommittedCodOrder(db,bound,raw.row,command),/requires a tenant\/owner predicate/);
  else assert.equal((await exports.loadCommittedCodOrder(db,bound,raw.row,command)).id,'committed');
  assert.equal(raw.writes.length,0);
 });
}
console.info('GUARD/SOURCE MODEL ONLY: actual route functions and canonical query guard; no mounted worker, Postgres or native result.');
