// Test-only compiled canonical BFF. No deployable runtime or alternate route implementation.
import assert from 'node:assert/strict';
import {createRequire, builtinModules} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Miniflare} from 'miniflare';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';

export class NativeMobileBff {
 private constructor(readonly mf:Miniflare, readonly compiledScript:string){}
 static async create(bindings:Record<string,string>, gatewayService:(request:Request)=>Promise<Response>, providerFetch:typeof fetch){
  requireOwnedDatabase();
  const config=readFileSync(new URL('../../services/mobile-bff/wrangler.toml',import.meta.url),'utf8');
  assert.match(config,/^main = "src\/index\.ts"$/m);
  assert.match(config,/^compatibility_date = "2026-05-25"$/m);
  assert.match(config,/^compatibility_flags = \["nodejs_compat"\]$/m);
  const req=createRequire(new URL('../../services/mobile-bff/package.json',import.meta.url));
  const compiler=createRequire(req.resolve('wrangler'))('esbuild') as {build(options:unknown):Promise<{outputFiles?:{text:string}[]}>};
  const result=await compiler.build({entryPoints:[new URL('../../services/mobile-bff/src/index.ts',import.meta.url).pathname],absWorkingDir:new URL('../..',import.meta.url).pathname,
   bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',tsconfig:'services/mobile-bff/tsconfig.json',external:['cloudflare:*','node:*'],conditions:['workerd','worker','browser'],logLevel:'silent',
   banner:{js:"import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-owned-mobile-bff.mjs');"},
   plugins:[{name:'native-node-builtins',setup(build:{onResolve(options:{filter:RegExp},handler:(args:{path:string})=>{path:string;external:true}|undefined):void}){const native=new Set(builtinModules);build.onResolve({filter:/^[a-z][\w/]*$/},args=>native.has(args.path)?{path:'node:'+args.path,external:true}:undefined);}}]});
  assert.equal(result.outputFiles?.length,1);const compiledScript=result.outputFiles![0].text;
  const modulesRoot=fileURLToPath(new URL('../../',import.meta.url));
  const mf=new Miniflare({modules:[{type:'ESModule',path:join(modulesRoot,'owned-native-mobile-bff.mjs'),contents:compiledScript}],modulesRoot,compatibilityDate:'2026-05-25',compatibilityFlags:['nodejs_compat'],cf:false,
   bindings,serviceBindings:{API_GATEWAY_SERVICE:async(request:Request)=>await gatewayService(request) as never},
   outboundService:async(request:Request)=>{
    // The existing verified one-use fixture wrapper denies every external destination,
    // except rewriting the exact production verifier POST to this run's local provider.
    const response=await providerFetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers.entries()),body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),redirect:'error'});
    return response as never;
   }});
  try{await mf.ready;return new NativeMobileBff(mf,compiledScript);}catch(error){await mf.dispose();throw error;}
 }
 async dispatch(request:Request){return this.mf.dispatchFetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers.entries()),body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer()} as never);}
 async settle(){await this.mf.dispose();}
}
