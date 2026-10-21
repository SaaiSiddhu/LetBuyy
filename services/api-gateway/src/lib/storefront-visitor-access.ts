// Existing storefront visitor capabilities, not buyer/merchant identity or an
// internal-app bypass. Every catalogue request checks current policy before cache.
import type {Context} from 'hono';
import {verifyStorefrontGateToken,verifyStorefrontPreviewToken} from '@letbuyy/auth-core';
import {normalizeStorefrontHandle,resolveStorefrontHost} from '@letbuyy/tenant-core';
import {getPooledSql} from '@letbuyy/infrastructure/pooled-sql-adapter';
import type {Env} from '../index';
import {getSupabaseAdmin} from './supabase';
import {AppError} from './errors';
import {sha256Hex,timingSafeEqualText} from './crypto';
type C=Context<{Bindings:Env}>;
export type VisitorSite={id:string;subdomain:string|null;custom_domain?:string|null;custom_domain_status?:string|null;access_mode?:string|null;published?:boolean|null;status:string;access_revision?:string|null};
export type VisitorGrant={site:VisitorSite;preview:boolean;password:boolean};
declare module 'hono'{interface ContextVariableMap{storefrontVisitorGrant:VisitorGrant|undefined}}
const metadataFields='id,subdomain,custom_domain,custom_domain_status,access_mode,published,status,access_password_hash';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const unavailable=()=>new AppError('Store access is unavailable',503,'STOREFRONT_ACCESS_UNAVAILABLE');
function proof(c:C,name:string,cookie:string){
 const header=c.req.header(name);if(header)return header.length<=4096?header:null;
 const value=(c.req.header('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);
 return value&&value.length<=4096?value:null;
}
async function restMetadata(c:C,selector:{id?:string;handle?:string}):Promise<VisitorSite|null>{
 let query=getSupabaseAdmin(c).from('sites').select(metadataFields).is('deleted_at',null);
 query=selector.id?query.eq('id',selector.id):query.eq('subdomain',selector.handle!);
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
 return restMetadata(c,selector);
}
async function hostBelongs(c:C,host:string,site:VisitorSite){
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
  if(checked.valid&&checked.payload?.sid===site.id&&await hostBelongs(c,checked.payload.host,site)){
   const {data,error}=await getSupabaseAdmin(c).from('site_preview_links').select('jti,scope,theme_id,expires_at,revoked_at').eq('site_id',site.id).eq('jti',checked.payload.jti).is('deleted_at',null).maybeSingle();
   if(error)throw unavailable();
   preview=Boolean(data&&!data.revoked_at&&data.scope===checked.payload.scope&&(data.theme_id??null)===(checked.payload.theme_id??null)&&new Date(data.expires_at).getTime()>Date.now());
  }
 }
 if(gateToken&&site.access_mode==='password'){
  const checked=await verifyStorefrontGateToken(gateToken,c.env.STORE_ACCESS_SIGNING_KEY);
  password=Boolean(checked.valid&&checked.payload?.sid===site.id&&site.access_revision
   &&checked.payload.revision&&timingSafeEqualText(checked.payload.revision,site.access_revision)
   &&await hostBelongs(c,checked.payload.host,site));
 }
 return{preview,password};
}
export async function authorizeVisitorSite(c:C,site:VisitorSite):Promise<VisitorGrant>{
 const mode=site.access_mode??'public';
 if(!['public','password','preview_only','offline'].includes(mode))throw unavailable();
 if(mode==='offline')throw new AppError('Store is offline',503,'STOREFRONT_OFFLINE');
 const grants=mode==='public'&&site.status==='published'&&site.published!==false?{preview:false,password:false}:await visitorGrants(c,site);
 if(!grants.preview&&(site.status!=='published'||site.published===false||mode==='preview_only'||mode==='password'&&!grants.password))throw new AppError('Store access required',401,'STOREFRONT_ACCESS_REQUIRED');
 const result={site,...grants};c.set('storefrontVisitorGrant',result);return result;
}
export async function authorizeVisitor(c:C,selector:{id?:string;handle?:string}):Promise<VisitorGrant>{
 const prior=c.get('storefrontVisitorGrant');
 if(prior&&(selector.id===prior.site.id||selector.handle===prior.site.subdomain))return prior;
 const site=await loadVisitorSite(c,selector);if(!site)throw new AppError('Store not found',404,'NOT_FOUND');
 return authorizeVisitorSite(c,site);
}
