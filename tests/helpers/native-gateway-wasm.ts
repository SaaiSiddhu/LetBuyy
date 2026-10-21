// Carry the same static crypto modules Wrangler uploads; no runtime crypto shim.
import {readFileSync} from 'node:fs';
import {join,basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const NATIVE_GATEWAY_MODULE_ROOT=fileURLToPath(new URL('../../',import.meta.url));
const directory=join(NATIVE_GATEWAY_MODULE_ROOT,'services/api-gateway/src/lib/store-access-wasm');
export function nativeGatewayWasmPlugin(){return{name:'native-static-crypto-modules',setup(build:any){build.onResolve({filter:/\.wasm$/},(args:any)=>{const name=basename(args.path);if(!['argon2.wasm','blake2b.wasm'].includes(name)||resolve(args.resolveDir,args.path)!==join(directory,name))throw new Error('Unexpected native Wasm import');return{path:'./letbuyy-store-access-'+name,external:true};});}};}
export function nativeGatewayModules(script:string){return[{type:'ESModule' as const,path:join(NATIVE_GATEWAY_MODULE_ROOT,'owned-native-gateway.mjs'),contents:script},...['argon2.wasm','blake2b.wasm'].map(name=>({type:'CompiledWasm' as const,path:join(NATIVE_GATEWAY_MODULE_ROOT,'letbuyy-store-access-'+name),contents:readFileSync(join(directory,name))}))];}
