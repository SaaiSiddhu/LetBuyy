// Local provider-contract simulation only, never human/provider acceptance.
// The real Identity forms, password verification, session issuer and Gateway
// remain in the path. No production source imports this fixture.
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import type {BrowserContext} from '@playwright/test';
import {requireOwnedDatabase,type OwnedDatabase} from './owned-db-support';

export const LOCAL_TURNSTILE_SITE_KEY='1x00000000000000000000AA';
export const LOCAL_TURNSTILE_SECRET='1x0000000000000000000000000000000AA';
const kind='turnstile-local-v1' as const;
const binding='__letbuyyOwnedTurnstileIssue';

const sdk=`(()=>{
 const widgets=new Map();let sequence=0;
 const issue=(id)=>{const item=widgets.get(id);if(!item)return;
  Promise.resolve(globalThis.${binding}()).then(token=>{if(widgets.get(id)!==item||!item.element.isConnected)return;
   item.token=token;item.input.value=token;item.options.callback?.(token);
  }).catch(()=>item.options['error-callback']?.('owned-fixture-unavailable'));
 };
 globalThis.turnstile={
  render(element,options){const id='owned-widget-'+(++sequence);const input=document.createElement('input');
   element=typeof element==='string'?document.querySelector(element):element;
   if(!element)throw new Error('owned fixture widget container required');
   input.type='hidden';input.name='cf-turnstile-response';element.appendChild(input);
   widgets.set(id,{element,input,options,token:''});
   if(options.sitekey!==${JSON.stringify(LOCAL_TURNSTILE_SITE_KEY)})queueMicrotask(()=>options['error-callback']?.('110110'));
   else issue(id);return id;
  },
  remove(id){const item=widgets.get(id);if(item)item.input.remove();widgets.delete(id);},
  reset(id){const item=widgets.get(id);if(item){item.input.value='';item.token='';issue(id);}},
  getResponse(id){return widgets.get(id)?.token??'';},
  execute(id){issue(id);}
 };
})();`;

export async function createLocalTurnstileProvider(owned:OwnedDatabase) {
    if(owned!==requireOwnedDatabase())throw new Error('local provider fixture requires the verified owned database');
    const capability=randomBytes(32).toString('hex');
    const tokens=new Map<string,{expires:number;used:boolean}>();
    const nativeOrigins=new Set<string>();
    const counts={issued:0,verified:0,refused:0,browserExternalRefused:0,nativeSdkServed:0,nativeIssued:0};
    const issue=()=>{
        if(counts.issued>=500)throw new Error('local provider fixture issuance limit');
        const token='owned-turnstile-'+randomBytes(24).toString('hex');tokens.set(token,{expires:Date.now()+120000,used:false});counts.issued++;return token;
    };
    const nativeSdk=sdk.replace('(()=>{','(()=>{const ownedSdkOrigin=new URL(document.currentScript.src).origin;')
        .replace(`globalThis.${binding}()`,"fetch(ownedSdkOrigin+'/fixtures/turnstile/challenge',{method:'POST',headers:{'Content-Type':'text/plain'}}).then(response=>{if(!response.ok)throw new Error('owned challenge refused');return response.json();}).then(value=>value.token)");
    const server=createServer(async(request,response)=>{
        response.setHeader('Content-Type','application/json');
        response.setHeader('Cache-Control','private, no-store');
        const send=(status:number,value:unknown)=>{response.writeHead(status);response.end(JSON.stringify(value));};
        // Explicit native SDK simulation. No capability, DB credentials or
        // Merchant session is exposed. Only owned local callers are admitted.
        if(nativeOrigins.size&&request.method==='GET'&&request.url==='/fixtures/turnstile/api.js'){
            let referrer='';try{referrer=new URL(String(request.headers.referer||'')).origin;}catch{/* denied below */}
            if(!nativeOrigins.has(referrer)){send(403,{error:'native SDK origin refused'});return;}
            counts.nativeSdkServed++;response.setHeader('Content-Type','application/javascript');response.end(nativeSdk);return;
        }
        if(nativeOrigins.size&&request.method==='POST'&&request.url==='/fixtures/turnstile/challenge'){
            const origin=String(request.headers.origin||'');
            if(!nativeOrigins.has(origin)){send(403,{error:'native challenge origin refused'});return;}
            response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');
            try{counts.nativeIssued++;send(200,{token:issue()});}catch{send(429,{error:'native challenge limit'});}return;
        }
        if(request.headers['x-owned-provider-capability']!==capability){send(403,{error:'fixture capability required'});return;}
        if(request.method==='GET'&&request.url==='/_owned_provider_fixture'){
            send(200,{kind,runId:owned.runId,database:owned.database});return;
        }
        if(request.method!=='POST'||request.url!=='/turnstile/siteverify'){send(404,{error:'fixture route refused'});return;}
        try {
            const chunks:Buffer[]=[];let bytes=0;
            for await(const chunk of request){bytes+=chunk.length;if(bytes>8192){send(413,{error:'fixture body limit'});return;}chunks.push(Buffer.from(chunk));}
            const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
            if(form.get('secret')!==LOCAL_TURNSTILE_SECRET){counts.refused++;send(400,{success:false,'error-codes':['invalid-input-secret']});return;}
            const token=form.get('response')??'',record=tokens.get(token);
            if(!record||record.used||record.expires<=Date.now()){
                counts.refused++;send(200,{success:false,'error-codes':['timeout-or-duplicate']});return;
            }
            record.used=true;counts.verified++;send(200,{success:true,'error-codes':[]});
        }catch{send(400,{success:false,'error-codes':['bad-request']});}
    });
    server.requestTimeout=3000;server.headersTimeout=3000;
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin='http://127.0.0.1:'+String((server.address()as {port:number}).port);
    const profile=Object.freeze({kind,origin,capability});
    return {
        profile,
        counts,
        issue,
        enableNativeSdk(origins:string[]){
            if(!origins.length||origins.some(value=>{const url=new URL(value);return value!==url.origin||url.protocol!=='http:'
                ||!['localhost','127.0.0.1','[::1]','10.0.2.2'].includes(url.hostname)||!url.port||url.username||url.password;}))throw new Error('native provider fixture requires explicit local origins');
            for(const origin of origins)nativeOrigins.add(origin);
        },
        async attachBrowser(context:BrowserContext,origins:string[]){
            const allowed=new Set(origins);
            if(!allowed.size||origins.some(value=>{const url=new URL(value);return url.origin!==value||url.protocol!=='http:'
                ||!(['127.0.0.1','localhost','[::1]'].includes(url.hostname)||/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.localhost$/.test(url.hostname))||!url.port||url.username||url.password;}))throw new Error('local browser fixture requires explicit loopback origins');
            await context.exposeBinding(binding,source=>{
                if(!allowed.has(new URL(source.frame.url()).origin))throw new Error('local challenge belongs to another origin');
                return issue();
            });
            await context.route('**/*',async route=>{
                const url=new URL(route.request().url());
                if(url.origin==='https://challenges.cloudflare.com'&&url.pathname==='/turnstile/v0/api.js'){
                    await route.fulfill({status:200,contentType:'application/javascript',body:sdk,headers:{'Cache-Control':'no-store'}});return;
                }
                if(allowed.has(url.origin)){await route.continue();return;}
                counts.browserExternalRefused++;await route.abort('blockedbyclient');
            });
        },
        async close(){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));tokens.clear();nativeOrigins.clear();},
    };
}
