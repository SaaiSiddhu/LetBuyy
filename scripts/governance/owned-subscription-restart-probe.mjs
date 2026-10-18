// Fixed zero/internal subscription restart probe under the owned supervisor.
// No arbitrary program, path, URL, role, provider input or ambient credential seam.
import harness from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness.ts';
import support from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support.ts';
const {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders}=harness;
const {requireOwnedDatabase}=support;
const owned=requireOwnedDatabase();
const actor=process.env.LETBUYY_FREE_RESTART_ACTOR,email=process.env.LETBUYY_FREE_RESTART_EMAIL;
const store=process.env.LETBUYY_FREE_RESTART_STORE,key=process.env.LETBUYY_FREE_RESTART_KEY;
let lose=process.env.LETBUYY_FREE_RESTART_LOSE;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!actor||!store||!uuid.test(actor)||!uuid.test(store)||!email?.endsWith('@example.invalid')||!key||!/^[a-zA-Z0-9:.-]{8,200}$/.test(key)||!['0','1'].includes(lose||''))throw new Error('invalid fixed synthetic restart probe input');
const originalFetch=globalThis.fetch,origin=new URL(owned.restEnv().SUPABASE_URL).origin;
globalThis.fetch=async(resource,options)=>{
 const url=new URL(typeof resource==='string'?resource:resource instanceof URL?resource.href:resource.url);
 if(url.origin!==origin)throw new Error('owned free restart probe refuses provider or external network');
 const response=await originalFetch(resource,options);
 if(lose==='1'&&url.pathname.endsWith('/rpc/activate_merchant_subscription_v1')&&response.ok){lose='0';await response.arrayBuffer();return new Response(JSON.stringify({message:'synthetic-child-reply-loss-after-commit'}),{status:503,headers:{'Content-Type':'application/json'}});}
 return response;
};
const gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
try{
 const result=await gateway.request('/v1/payments/subscription/order',{method:'POST',headers:{...await signedIdentityHeaders(actor,email),'X-Idempotency-Key':key},body:JSON.stringify({store_id:store,plan_slug:'free',site_type:'store',billing_period:'monthly'})});
 await gateway.settle();process.stdout.write('N2_FREE_RESULT='+JSON.stringify({probePid:process.pid,status:result.status,json:result.json})+'\n');
}finally{globalThis.fetch=originalFetch;}
