import type {Hono} from 'hono';
import {z} from 'zod';
import type {Env} from '../../index';
import {BuyerPrivacyExportExecutionAdapter} from '../../execution/buyer-privacy-export.adapter';
import {requireBuyerSession} from '../../middleware/buyer-session';
import {verifyInternalAppRequest} from '../../lib/internal-auth';
import {AppError,ValidationError} from '../../lib/errors';
import {KmsHumanRequiredError} from '../../lib/crypto';
import {success} from '../../lib/supabase';

const uuid=z.string().uuid();
export function registerBuyerPrivacyExportRoutes(router:Hono<{Bindings:Env}>){
 router.use('/buyer/privacy-requests/:id/*',async(c,next)=>{c.header('Cache-Control','private, no-store');c.header('Referrer-Policy','no-referrer');await next();});
 router.post('/buyer/privacy-requests/:id/export',requireBuyerSession,async c=>{
  if(!await verifyInternalAppRequest(c,'accounts'))throw new AppError('A signed Identity verification request is required.',401,'UNAUTHORIZED');
  const id=uuid.safeParse(c.req.param('id')),body=z.object({password:z.string().min(8).max(128),request_key:uuid}).strict().safeParse(await c.req.json().catch(()=>null));
  if(!id.success||!body.success)throw new ValidationError('Provide your current password and a valid export request.');
  c.header('Cache-Control','private, no-store');
  try{const result=await new BuyerPrivacyExportExecutionAdapter(c).prepare(id.data,body.data.request_key,body.data.password);return c.json(success({...result.metadata,replayed:result.replayed}),result.replayed?200:201);}
  catch(error){if(error instanceof KmsHumanRequiredError)throw new AppError('Export encryption is not configured for this environment.',503,'BUYER_EXPORT_UNAVAILABLE');throw error;}
 });
 router.get('/buyer/privacy-requests/:id/exports',requireBuyerSession,async c=>{
  const id=uuid.safeParse(c.req.param('id'));if(!id.success)throw new ValidationError('Invalid access request.');
  c.header('Cache-Control','private, no-store');return c.json(success(await new BuyerPrivacyExportExecutionAdapter(c).list(id.data)));
 });
 // POST prevents crawlers, prefetch and a copied bare URL from consuming access.
 router.post('/buyer/privacy-requests/:id/exports/:exportId/download',requireBuyerSession,async c=>{
  const id=uuid.safeParse(c.req.param('id')),artifact=uuid.safeParse(c.req.param('exportId'));
  if(!id.success||!artifact.success||!z.object({}).strict().safeParse(await c.req.json().catch(()=>null)).success)throw new ValidationError('Invalid download request.');
  const raw=await new BuyerPrivacyExportExecutionAdapter(c).download(id.data,artifact.data);
  return new Response(raw,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="letbuyy-data-'+artifact.data+'.json"',
   'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 });
}
