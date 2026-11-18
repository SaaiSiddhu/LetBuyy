import { fileURLToPath } from 'node:url';
import {nativeGatewayWasmPlugin,nativeGatewayModules,NATIVE_GATEWAY_MODULE_ROOT} from './native-gateway-wasm';
// Actual bundled workerd Gateway for owned cross-runtime acceptance only.
import assert from 'node:assert/strict';
import {createRequire,builtinModules} from 'node:module';
import {Miniflare} from 'miniflare';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {nextClientAddress} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
export class NativeGateway {
 private constructor(readonly mf:Miniflare){}
 static async create(env:Record<string,unknown>,capture:(request:Request)=>Promise<Response>){
  const owned=requireOwnedDatabase(),rest=owned.restEnv();assert.ok(env.SUPABASE_URL===rest.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY===rest.SUPABASE_SERVICE_ROLE_KEY,'native Gateway requires its exact owned REST service');
  const req=createRequire(new URL('../../services/api-gateway/package.json',import.meta.url));
  const compiler=createRequire(req.resolve('wrangler'))('esbuild') as {build(options:unknown):Promise<{outputFiles?:{text:string}[]}>};
  const result=await compiler.build({entryPoints:[fileURLToPath(new URL('../../services/api-gateway/src/index.ts',import.meta.url))],absWorkingDir:fileURLToPath(new URL('../..',import.meta.url)),
   bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',tsconfig:'services/api-gateway/tsconfig.json',external:['cloudflare:*','node:*'],conditions:['workerd','worker','browser'],logLevel:'silent',
   banner:{js:"import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-owned-gateway.mjs');"},
   plugins:[nativeGatewayWasmPlugin(),{name:'native-node-builtins',setup(build:{onResolve(options:{filter:RegExp},handler:(args:{path:string})=>{path:string;external:true}|undefined):void}){const native=new Set(builtinModules);build.onResolve({filter:/^[a-z][\w/]*$/},args=>native.has(args.path)?{path:'node:'+args.path,external:true}:undefined);}}]});
  assert.equal(result.outputFiles?.length,1);const restOrigin=new URL(String(env.SUPABASE_URL)).origin;
  const mf=new Miniflare({modules:nativeGatewayModules(result.outputFiles![0].text),modulesRoot:NATIVE_GATEWAY_MODULE_ROOT,compatibilityDate:'2026-05-25',compatibilityFlags:['nodejs_compat'],cf:false,unsafeTriggerHandlers:true,
   durableObjects:{RUNTIME_COORDINATOR:{className:'LetbuyyRuntimeDurableObject',useSQLite:true}},durableObjectsPersist:false,r2Buckets:['REEL_ORIGINALS_BUCKET','R2_BUCKET'],r2Persist:false,bindings:env as never,
   outboundService:async(request:Request)=>{const url=new URL(request.url);if(url.origin==='https://api.resend.com')return await capture(request) as never;
    assert.equal(url.origin,restOrigin,'native Gateway may reach only its owned REST service or the explicit email fixture');
    return await fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers.entries()),body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half',redirect:'error'} as RequestInit) as never;}});
  try{await mf.ready;return new NativeGateway(mf);}catch(error){await mf.dispose();throw error;}
 }
 async dispatch(path:string,init:RequestInit){const headers=new Headers(init.headers);headers.set('CF-Connecting-IP',nextClientAddress());return this.mf.dispatchFetch('https://gateway.test'+path,{...init,headers} as never);}
 async runScheduled(){const reply=await this.mf.dispatchFetch('https://gateway.test/cdn-cgi/handler/scheduled?cron=*/15%20*%20*%20*%20*&format=json');assert.equal(reply.status,200,'actual native scheduled handler completes');await reply.arrayBuffer();}
 async settle(){await this.mf.dispose();}
}
