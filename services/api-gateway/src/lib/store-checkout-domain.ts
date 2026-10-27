import type { Context } from 'hono';
import type { Env } from '../index';
import { CheckoutDomainSetupSchema, type CheckoutDomainSetup } from '@letbuyy/shared-types';
import { buildStoreCheckoutHostname, normalizeStoreRootDomain } from '@letbuyy/tenant-core';
import { canonicalCheckoutDomainProbePayload, LETBUYY_CHECKOUT_DOMAIN_PROBE_PATH } from '@letbuyy/checkout-core';
import { getSupabaseAdmin } from './supabase';
import { AppError } from './errors';
import { hmacSha256Hex, timingSafeEqualHex } from './crypto';
import { attachVercelProjectDomain, getVercelProjectDomain, readVercelDomainStatus } from './vercel-domains';
import { getCustomDomainCnameTarget } from './custom-domain-config';

type AppContext = Context<{Bindings:Env}>;
type Db = ReturnType<typeof getSupabaseAdmin>;
export interface CheckoutDomainRow {
  id:string;site_id:string;domain:string;purpose:'checkout';status:string;ssl_status:string;
  checkout_parent_domain_id:string|null;last_checked_at:string|null;metadata:Record<string,unknown>;
}
export interface CheckoutDomainSite {
  id:string;subdomain:string;custom_domain:string|null;custom_domain_status:string|null;
  name?:string|null;access_mode?:string|null;access_message?:string|null;published?:boolean|null;status?:string|null;
}
const COLUMNS='id,site_id,domain,purpose,status,ssl_status,checkout_parent_domain_id,last_checked_at,metadata';
const SITE_COLUMNS='id,name,subdomain,custom_domain,custom_domain_status,access_mode,access_message,published,status';
const LEASE_MS=7*60*60*1000;
const unavailable=()=>new AppError('Secure checkout domain is temporarily unavailable',503,'CHECKOUT_DOMAIN_UNAVAILABLE');
export function centralCheckoutOrigin(env:Pick<Env,'CHECKOUT_ORIGIN'>):string {
  const url=new URL(env.CHECKOUT_ORIGIN||'https://checkout.letbuyy.com');
  const local=url.hostname==='localhost'||url.hostname.endsWith('.localhost');
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash
      ||(url.protocol!=='https:'&&!(local&&url.protocol==='http:')))throw unavailable();
  return url.origin;
}
function fresh(row:CheckoutDomainRow):boolean {
  const checked=Date.parse(row.last_checked_at||'');
  return row.status==='active'&&row.ssl_status==='active'&&Number.isFinite(checked)
    &&checked<=Date.now()+60_000&&checked>Date.now()-LEASE_MS;
}
export async function readStoreCheckoutDomain(db:Db,siteId:string):Promise<CheckoutDomainRow|null> {
  const {data,error}=await db.from('site_domains').select(COLUMNS).eq('site_id',siteId)
    .eq('purpose','checkout').is('deleted_at',null).maybeSingle();
  if(error)throw unavailable();
  return data as CheckoutDomainRow|null;
}
async function siteById(db:Db,siteId:string):Promise<CheckoutDomainSite> {
  const {data,error}=await db.from('sites').select(SITE_COLUMNS).eq('id',siteId).is('deleted_at',null).maybeSingle();
  if(error||!data)throw unavailable();
  return data as CheckoutDomainSite;
}
async function expectedAddress(db:Db,site:CheckoutDomainSite,root:string):Promise<{
  host:string|null;parentId:string|null;base:string;source:'platform'|'custom';verified:boolean;
}> {
  const custom=site.custom_domain_status==='active'?site.custom_domain:null;
  if(!custom)return {host:buildStoreCheckoutHostname({subdomain:site.subdomain,storeRootDomain:root}),parentId:null,base:root,source:'platform',verified:true};
  const {data,error}=await db.from('site_domains').select('id,domain,status,ssl_status')
    .eq('site_id',site.id).eq('domain',custom).eq('purpose','storefront').eq('role','primary').is('deleted_at',null).maybeSingle();
  if(error)throw unavailable();
  return {host:buildStoreCheckoutHostname({subdomain:site.subdomain,storeRootDomain:root,connectedHost:custom}),
    parentId:data?.id??null,base:custom,source:'custom',verified:!!data&&data.status==='active'&&data.ssl_status==='active'};
}
/** A status bit alone never grants a hostname: recheck exact derivation and current parent. */
export async function checkoutDomainMatchesSite(db:Db,row:CheckoutDomainRow,site:CheckoutDomainSite,root:string):Promise<boolean> {
  const expected=await expectedAddress(db,site,root);
  return fresh(row)&&row.site_id===site.id&&expected.verified&&expected.host===row.domain
    &&expected.parentId===row.checkout_parent_domain_id;
}
/** For the existing signed internal bootstrap only; returns public routing metadata. */
export async function resolveCheckoutDomainSite(db:Db,hostname:string,root:string):Promise<CheckoutDomainSite|null> {
  if(!hostname.startsWith('checkout.')||hostname.length>253||/[^a-z0-9.-]/.test(hostname))return null;
  const {data,error}=await db.from('site_domains').select(COLUMNS).eq('domain',hostname)
    .eq('purpose','checkout').eq('status','active').eq('ssl_status','active').is('deleted_at',null).maybeSingle();
  if(error)throw unavailable();
  if(!data)return null;
  const row=data as CheckoutDomainRow;const site=await siteById(db,row.site_id);
  return await checkoutDomainMatchesSite(db,row,site,root)?site:null;
}
function projection(env:Env,siteId:string,address:Awaited<ReturnType<typeof expectedAddress>>,row:CheckoutDomainRow|null,reason:string|null):CheckoutDomainSetup {
  const active=!!row&&fresh(row)&&address.verified&&row.domain===address.host&&row.checkout_parent_domain_id===address.parentId;
  const fallback=centralCheckoutOrigin(env);
  const status=active?'active':reason==='PROVIDER_UNAVAILABLE'||reason==='NOT_CONFIGURED'?'unavailable':row?.status==='error'?'error':row?'verifying':'pending';
  let target:string|null=null;try{target=getCustomDomainCnameTarget(env);}catch{/* no fabricated DNS target */}
  return CheckoutDomainSetupSchema.parse({site_id:siteId,hostname:address.host,parent_hostname:address.base,
    source:address.source,status,ssl_status:active?'active':row?.ssl_status==='error'?'error':'pending',
    checkout_origin:active?`https://${address.host}`:fallback,fallback_origin:fallback,reason,
    dns_records:address.host&&target&&address.source==='custom'?[{type:'CNAME',name:address.host,value:target}]:[]});
}
async function verifyHttpsApplication(env:Env,siteId:string,hostname:string,fetchImpl:typeof fetch):Promise<boolean> {
  const key=env.STORE_ACCESS_SIGNING_KEY;if(!key||key.length<16)return false;
  const proof={site_id:siteId,hostname,nonce:(crypto.randomUUID()+crypto.randomUUID()).replaceAll('-',''),
    expires_at:new Date(Date.now()+30_000).toISOString()};
  const requestSignature=await hmacSha256Hex(key,canonicalCheckoutDomainProbePayload('request',proof));
  try {
    const reply=await fetchImpl(`https://${hostname}${LETBUYY_CHECKOUT_DOMAIN_PROBE_PATH}`,{method:'GET',redirect:'manual',cache:'no-store',
      signal:AbortSignal.timeout(3000),headers:{'X-LetBuyy-Checkout-Probe':JSON.stringify({...proof,signature:requestSignature})}});
    if(!reply.ok||Number(reply.headers.get('content-length')||0)>4096)return false;
    const text=await reply.text();if(new TextEncoder().encode(text).length>4096)return false;
    const body=JSON.parse(text) as Record<string,unknown>;
    if(body.site_id!==proof.site_id||body.hostname!==hostname||body.nonce!==proof.nonce||body.expires_at!==proof.expires_at
       ||typeof body.signature!=='string')return false;
    return timingSafeEqualHex(body.signature,await hmacSha256Hex(key,canonicalCheckoutDomainProbePayload('response',proof)));
  }catch{return false;}
}
/** Owned setup or the current site's signed-cart POST only. Provider effects are idempotent by exact hostname. */
export async function prepareStoreCheckoutDomain(c:AppContext,siteId:string,options:{force?:boolean;fetchImpl?:typeof fetch}={}):Promise<CheckoutDomainSetup> {
  const db=getSupabaseAdmin(c),site=await siteById(db,siteId),root=normalizeStoreRootDomain(c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
  const address=await expectedAddress(db,site,root);let row=await readStoreCheckoutDomain(db,siteId);
  if(!address.host||!address.verified)return projection(c.env,siteId,address,row,'PARENT_NOT_VERIFIED');
  if(row&&await checkoutDomainMatchesSite(db,row,site,root)&&!options.force)return projection(c.env,siteId,address,row,null);
  if(row&&(row.domain!==address.host||row.checkout_parent_domain_id!==address.parentId)) {
    const {error}=await db.from('site_domains').update({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      metadata:{...row.metadata,checkout_retire_after:new Date(Date.now()+11*60_000).toISOString()}})
      .eq('id',row.id).eq('site_id',siteId).eq('purpose','checkout').is('deleted_at',null);
    if(error)throw unavailable();row=null;
  }
  if(!row) {
    const id=crypto.randomUUID();const {data,error}=await db.from('site_domains').insert({id,site_id:siteId,domain:address.host,
      role:'redirect',purpose:'checkout',checkout_parent_domain_id:address.parentId,status:'pending',ssl_status:'pending',
      metadata:{checkout_source:address.source,checkout_base_host:address.base,managed_by:'letbuyy-checkout-v1'}}).select(COLUMNS).maybeSingle();
    if(error) {
      if(error.code!=='23505')throw unavailable();
      row=await readStoreCheckoutDomain(db,siteId);
      if(!row||row.domain!==address.host||row.checkout_parent_domain_id!==address.parentId)throw unavailable();
    }else row=data as CheckoutDomainRow;
    if(!row)throw unavailable();
  }
  if(!options.force&&Date.parse(row.last_checked_at||'')>Date.now()-30_000)return projection(c.env,siteId,address,row,'CERTIFICATE_PENDING');
  const modes=[c.env.ENVIRONMENT,c.env.APP_ENV,c.env.NODE_ENV,c.env.DEPLOYMENT_ENV];
  if(!modes.includes('production')||modes.includes('staging')||!c.env.VERCEL_API_TOKEN||!c.env.VERCEL_STOREFRONT_PROJECT_ID||!c.env.STORE_ACCESS_SIGNING_KEY)
    return projection(c.env,siteId,address,row,'NOT_CONFIGURED');
  const fetchImpl=options.fetchImpl??fetch;let active=false,reason='CERTIFICATE_PENDING';
  try {
    let domain=await getVercelProjectDomain(c.env,address.host,fetchImpl);
    if(!domain)domain=await attachVercelProjectDomain(c.env,address.host,fetchImpl);
    const exact=domain?.name===address.host&&domain?.projectId===c.env.VERCEL_STOREFRONT_PROJECT_ID
      &&domain?.gitBranch==null&&domain?.customEnvironmentId==null&&domain?.redirect==null;
    if(!exact)reason='PROVIDER_BINDING_INVALID';
    else {
      const status=await readVercelDomainStatus(c.env,address.host,fetchImpl);
      if(status.status==='active'&&status.verified&&!status.misconfigured)active=await verifyHttpsApplication(c.env,siteId,address.host,fetchImpl);
    }
  }catch{reason='PROVIDER_UNAVAILABLE';}
  const patch={status:active?'active':'verifying',ssl_status:active?'active':'pending',last_checked_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),...(active?{connected_at:new Date().toISOString()}:{})};
  const {data,error}=await db.from('site_domains').update(patch).eq('id',row.id).eq('site_id',siteId).eq('purpose','checkout')
    .eq('domain',address.host).is('deleted_at',null).select(COLUMNS).maybeSingle();
  if(error||!data)throw unavailable();
  return projection(c.env,siteId,address,data as CheckoutDomainRow,active?null:reason);
}
export async function getStoreCheckoutDomainSetup(c:AppContext,siteId:string):Promise<CheckoutDomainSetup> {
  const db=getSupabaseAdmin(c),site=await siteById(db,siteId),address=await expectedAddress(db,site,normalizeStoreRootDomain(c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN));
  return projection(c.env,siteId,address,await readStoreCheckoutDomain(db,siteId),address.verified?null:'PARENT_NOT_VERIFIED');
}
export async function checkoutOriginForStore(c:AppContext,siteId:string):Promise<string> {
  try{return (await prepareStoreCheckoutDomain(c,siteId)).checkout_origin;}
  catch{return centralCheckoutOrigin(c.env);}
}
