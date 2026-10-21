// Existing storefront visitor capabilities, not buyer/merchant identity or an
// internal-app bypass. Every catalogue request checks current policy before cache.
import type {Context} from 'hono';
import {verifyStorefrontGateToken,verifyStorefrontPreviewToken} from '@letbuyy/auth-core';
import {normalizeStorefrontHandle,resolveStorefrontHost} from '@letbuyy/tenant-core';
import {getPooledSql} from '@letbuyy/infrastructure/pooled-sql-adapter';
import type {Env} from '../index';
import {getSupabaseAdmin,getSupabaseAdminUnguarded} from './supabase';
import {AppError} from './errors';
import {sha256Hex,timingSafeEqualText} from './crypto';
type C=Context<{Bindings:Env}>;
export type VisitorSite={id:string;subdomain:string|null;custom_domain?:string|null;custom_domain_status?:string|null;access_mode?:string|null;published?:boolean|null;status:string;access_revision?:string|null};
export type VisitorGrant={site:VisitorSite;preview:boolean;password:boolean};
declare module 'hono'{interface ContextVariableMap{storefrontVisitorGrant:VisitorGrant|undefined;storefrontPurchaseGrant:VisitorGrant|undefined}}
const metadataFields='id,subdomain,custom_domain,custom_domain_status,access_mode,published,status,access_password_hash';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const unavailable=()=>new AppError('Store access is unavailable',503,'STOREFRONT_ACCESS_UNAVAILABLE');
function proof(c:C,name:string,cookie:string){
 const header=c.req.header(name);if(header)return header.length<=4096?header:null;
 const value=(c.req.header('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);
 return value&&value.length<=4096?value:null;
}
async function restMetadata(c:C,selector:{id?:string;handle?:string},preview:boolean):Promise<VisitorSite|null>{
 // ID/handle is an untrusted globally unique lookup key, not validated
 // tenant authority. Resolve one candidate row with the reviewed bootstrap
 // client; authorizeVisitorSite rechecks policy/proof before any data/cache.
 let query=getSupabaseAdminUnguarded(c).from('sites').select(metadataFields).is('deleted_at',null);
 query=selector.id?query.eq('id',selector.id):query.eq('subdomain',selector.handle!);
 if(!preview)query=query.eq('status','published').not('published','is',false);
 const {data,error}=await query.maybeSingle();if(error)throw unavailable();if(!data)return null;
 const {access_password_hash,...row}=data as unknown as VisitorSite&{access_password_hash?:string|null};
 return {...row,access_revision:access_password_hash?await sha256Hex(access_password_hash):null};
}
export async function loadVisitorSite(c:C,selector:{id?:string;handle?:string}):Promise<VisitorSite|null>{
 if(selector.id&&!uuid.test(selector.id))throw new AppError('Invalid store id',400,'VALIDATION');
 if(selector.handle&&!normalizeStorefrontHandle(selector.handle))return null;
 const sql=getPooledSql(c.env);
 if(sql){
  try{
   const rows=await sql.unsafe<{payload:VisitorSite|null}[]>('select public.read_published_storefront_site_v1($1,true) as payload',[selector.id?'id:'+selector.id.toLowerCase():normalizeStorefrontHandle(selector.handle!)!]);
   const row=rows[0]?.payload;
   // The prior370 shape contained onlyid; its verified absence is still absent.
   if(row&&typeof row.status==='string')return row;
   if(row===null){
    const preview=await verifyStorefrontPreviewToken(proof(c,'X-LetBuyy-Storefront-Preview','__Host-lb_preview'),c.env.PREVIEW_SIGNING_KEY);
    if(!preview.valid)return null;
   }
  }catch{/* bounded independent REST compatibility path; never assume public */}
 }
 const preview=await verifyStorefrontPreviewToken(proof(c,'X-LetBuyy-Storefront-Preview','__Host-lb_preview'),c.env.PREVIEW_SIGNING_KEY);
 return restMetadata(c,selector,preview.valid);
}
export async function storefrontHostBelongsToSite(c:C,host:string,site:Pick<VisitorSite,'id'|'subdomain'|'custom_domain'|'custom_domain_status'>){
 const parsed=resolveStorefrontHost(host,c.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
 if(parsed.kind==='subdomain')return parsed.subdomain===site.subdomain;
 if(parsed.kind!=='custom_domain')return false;
 if(site.custom_domain_status==='active'&&site.custom_domain===parsed.domain)return true;
 const {data,error}=await getSupabaseAdmin(c).from('site_domains').select('site_id').eq('site_id',site.id).eq('domain',parsed.domain).eq('status','active').is('deleted_at',null).maybeSingle();
 if(error)throw unavailable();return Boolean(data);
}
export async function visitorGrants(c:C,site:VisitorSite):Promise<{preview:boolean;password:boolean}>{
 const previewToken=proof(c,'X-LetBuyy-Storefront-Preview','__Host-lb_preview');
 const gateToken=proof(c,'X-LetBuyy-Storefront-Gate','__Host-lb_store_gate');
 let preview=false,password=false;
 if(previewToken){
  const checked=await verifyStorefrontPreviewToken(previewToken,c.env.PREVIEW_SIGNING_KEY);
  if(checked.valid&&checked.payload?.sid===site.id&&await storefrontHostBelongsToSite(c,checked.payload.host,site)){
   const {data,error}=await getSupabaseAdmin(c).from('site_preview_links').select('jti,scope,theme_id,expires_at,revoked_at').eq('site_id',site.id).eq('jti',checked.payload.jti).is('deleted_at',null).maybeSingle();
   if(error)throw unavailable();
   preview=Boolean(data&&!data.revoked_at&&data.scope===checked.payload.scope&&(data.theme_id??null)===(checked.payload.theme_id??null)&&new Date(data.expires_at).getTime()>Date.now());
  }
 }
 if(gateToken&&site.access_mode==='password'){
  const checked=await verifyStorefrontGateToken(gateToken,c.env.STORE_ACCESS_SIGNING_KEY);
  password=Boolean(checked.valid&&checked.payload?.sid===site.id&&site.access_revision
   &&checked.payload.revision&&timingSafeEqualText(checked.payload.revision,site.access_revision)
   &&await storefrontHostBelongsToSite(c,checked.payload.host,site));
 }
 return{preview,password};
}
export async function authorizeVisitorSite(c:C,site:VisitorSite):Promise<VisitorGrant>{
 const mode=site.access_mode??'public';
 if(!['public','password','preview_only','offline'].includes(mode))throw unavailable();
 if(mode==='offline')throw new AppError('Store is offline',503,'STOREFRONT_OFFLINE');
 const grants=mode==='public'&&site.status==='published'&&site.published!==false?{preview:false,password:false}:await visitorGrants(c,site);
 if(!grants.preview&&(site.status!=='published'||site.published===false))throw new AppError('Store not found',404,'NOT_FOUND');
 if(!grants.preview&&(mode==='preview_only'||mode==='password'&&!grants.password))throw new AppError('Store access required',401,'STOREFRONT_ACCESS_REQUIRED');
 const result={site,...grants};c.set('storefrontVisitorGrant',result);return result;
}
export async function authorizeVisitor(c:C,selector:{id?:string;handle?:string}):Promise<VisitorGrant>{
 selector=selector.id?{id:selector.id.toLowerCase()}:{handle:normalizeStorefrontHandle(selector.handle||'')||selector.handle};
 const prior=c.get('storefrontVisitorGrant');
 if(prior&&(selector.id===prior.site.id||selector.handle===prior.site.subdomain))return prior;
 const site=await loadVisitorSite(c,selector);if(!site)throw new AppError('Store not found',404,'NOT_FOUND');
 return authorizeVisitorSite(c,site);
}

/** Commands must not admit against a potentially cached SQL/Hyperdrive policy.
 * One current bounded REST metadata read precedes storefront cart/order work.
 * This is a request admission snapshot, not a claim of transaction-wide locking.
 */
export async function authorizeFreshStorefrontPurchase(c:C,siteId:string):Promise<VisitorGrant>{
 c.header('Cache-Control','no-store');
 if(!uuid.test(siteId))throw new AppError('Invalid store id',400,'VALIDATION');
 const prior=c.get('storefrontPurchaseGrant');
 if(prior?.site.id===siteId.toLowerCase())return prior;
 const site=await restMetadata(c,{id:siteId.toLowerCase()},false);
 if(!site)throw new AppError('Store not found',404,'NOT_FOUND');
 const grant=await authorizeVisitorSite(c,site);
 // A share/theme preview is a read capability, never purchase authority.
 if(site.access_mode==='preview_only'||site.access_mode==='password'&&!grant.password)
  throw new AppError('Store access required',401,'STOREFRONT_ACCESS_REQUIRED');
 c.set('storefrontPurchaseGrant',grant);
 return grant;
}

export type HostedStorefrontAdmission={version:1;mode:'public'|'password';revision:string|null;host?:string;expires_at:number;signature:string};
/** Translate an already verified password gate to the existing server-issued
 * checkout handoff. No raw gate cookie/password/identity token is persisted. */
export async function issueHostedStorefrontAdmission(c:C,siteId:string,signature:string,expiresAt:number):Promise<HostedStorefrontAdmission>{
 const grant=await authorizeFreshStorefrontPurchase(c,siteId);
 if(grant.site.access_mode!=='password')return{version:1,mode:'public',revision:null,expires_at:expiresAt,signature};
 const checked=await verifyStorefrontGateToken(proof(c,'X-LetBuyy-Storefront-Gate','__Host-lb_store_gate'),c.env.STORE_ACCESS_SIGNING_KEY);
 if(!checked.valid||!checked.payload||checked.payload.sid!==siteId||!checked.payload.revision||!grant.site.access_revision
  ||!timingSafeEqualText(checked.payload.revision,grant.site.access_revision))throw new AppError('Store access required',401,'STOREFRONT_ACCESS_REQUIRED');
 return{version:1,mode:'password',revision:grant.site.access_revision,host:checked.payload.host,expires_at:Math.min(expiresAt,checked.payload.exp),signature};
}
/** Fresh purchase eligibility for a cryptographically verified hosted link.
 * An old public link cannot borrow a newer private link's stored admission.
 * Public legacy links remain usable only while the store is currently public. */
export async function authorizeHostedStorefrontPurchase(c:C,siteId:string,admission:unknown,signature:string):Promise<void>{
 c.header('Cache-Control','no-store');
 if(!uuid.test(siteId))throw new AppError('Invalid store id',400,'VALIDATION');
 const site=await restMetadata(c,{id:siteId.toLowerCase()},false);
 if(!site)throw new AppError('Store not found',404,'NOT_FOUND');
 const mode=site.access_mode??'public';
 if(mode==='public')return;
 if(mode==='offline')throw new AppError('Store is offline',503,'STOREFRONT_OFFLINE');
 if(mode==='preview_only')throw new AppError('Store access required',401,'STOREFRONT_ACCESS_REQUIRED');
 if(mode!=='password')throw unavailable();
 const value=admission&&typeof admission==='object'&&!Array.isArray(admission)?admission as Partial<HostedStorefrontAdmission>:null;
 if(!value||value.version!==1||value.mode!=='password'||typeof value.signature!=='string'||!timingSafeEqualText(value.signature,signature)
  ||typeof value.revision!=='string'||!site.access_revision||!timingSafeEqualText(value.revision,site.access_revision)
  ||typeof value.expires_at!=='number'||!Number.isSafeInteger(value.expires_at)||value.expires_at<=Date.now()/1000
  ||typeof value.host!=='string'||value.host.length>300||!await storefrontHostBelongsToSite(c,value.host,site))
  throw new AppError('Store access required',401,'STOREFRONT_ACCESS_REQUIRED');
}
