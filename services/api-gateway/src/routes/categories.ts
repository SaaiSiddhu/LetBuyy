// Canonical category metadata. Every mutation owns its SQL receipt and live
// owner/version check; every read returns a bounded, confirmed population.
import {Hono,type Context}from 'hono';
import {CreateCategoryCommandSchema,UpdateCategoryCommandSchema,DeleteCategoryCommandSchema,
 ProductCategoryListQuerySchema,IdParam,UuidSchema,type CreateCategoryCommand,type UpdateCategoryCommand,type DeleteCategoryCommand}from '@letbuyy/shared-types';
import type {Env}from '../index';
import {validate}from '../middleware/validation';
import {resolveOwnedStoreScope,type OwnedStoreScope}from '../lib/tenant-context';
import {ValidationError,AppError}from '../lib/errors';
import {readProductCategoryPage,readProductCategory,executeProductCategoryCommand}from '../execution/product-category.adapter';
import {bumpStorefrontCacheVersion}from '../lib/storefront-cache';
const router=new Hono<{Bindings:Env}>();
const privateHeaders={'Cache-Control':'private, no-store'};
function originalKey(c:Context<{Bindings:Env}>,key:string){
 if(c.req.header('X-Idempotency-Key')!==key)throw new ValidationError('Keep the same original category request key.');
}
async function refreshStorefront(c:Context<{Bindings:Env}>,scope:OwnedStoreScope){
 if(!c.env.CACHE)return;
 const {data,error}=await scope.db.from('sites').select('subdomain,store_name,custom_domain').eq('id',scope.siteId).maybeSingle();
 if(error||!data)throw new AppError('The save committed but storefront refresh could not be confirmed. Retry its original request.',503,'PRODUCT_CATEGORY_REFRESH_UNAVAILABLE');
 const handles=[data.subdomain,data.store_name,data.custom_domain].filter((value):value is string=>typeof value==='string'&&value.length>0);
 if(!handles.length)throw new AppError('Storefront refresh could not be confirmed. Retry the original category request.',503,'PRODUCT_CATEGORY_REFRESH_UNAVAILABLE');
 await bumpStorefrontCacheVersion(c,handles);
}
router.get('/',validate('query',ProductCategoryListQuerySchema),async c=>{
 const input=ProductCategoryListQuerySchema.parse(c.get('validatedQuery'));
 const scope=await resolveOwnedStoreScope(c,input.store_id);
 return c.json(await readProductCategoryPage(c.env,scope,input.page,input.limit,input.search||''),200,privateHeaders);
});
router.get('/:id',validate('param',IdParam),async c=>{
 const selected=c.req.query('store_id')||c.req.header('X-Store-ID')||c.get('auth').user.storeId;
 const site=UuidSchema.safeParse(selected);if(!site.success)throw new ValidationError('Choose the category store.');
 const {id}=c.get('validatedParam')as {id:string};const scope=await resolveOwnedStoreScope(c,site.data);
 return c.json({success:true,data:await readProductCategory(c.env,scope,id)},200,privateHeaders);
});
router.post('/',validate('json',CreateCategoryCommandSchema),async c=>{
 const input=c.get('validatedBody')as CreateCategoryCommand;originalKey(c,input.idempotency_key);
 const scope=await resolveOwnedStoreScope(c,input.store_id);
 const data=await executeProductCategoryCommand(c.env,scope,'create',null,input);await refreshStorefront(c,scope);
 return c.json({success:true,data},201,privateHeaders);
});
router.patch('/:id',validate('param',IdParam),validate('json',UpdateCategoryCommandSchema),async c=>{
 const input=c.get('validatedBody')as UpdateCategoryCommand;originalKey(c,input.idempotency_key);
 const {id}=c.get('validatedParam')as {id:string};const scope=await resolveOwnedStoreScope(c,input.store_id);
 const data=await executeProductCategoryCommand(c.env,scope,'update',id,input);await refreshStorefront(c,scope);
 return c.json({success:true,data},200,privateHeaders);
});
router.delete('/:id',validate('param',IdParam),validate('json',DeleteCategoryCommandSchema),async c=>{
 const input=c.get('validatedBody')as DeleteCategoryCommand;originalKey(c,input.idempotency_key);
 const {id}=c.get('validatedParam')as {id:string};const scope=await resolveOwnedStoreScope(c,input.store_id);
 const data=await executeProductCategoryCommand(c.env,scope,'delete',id,input);await refreshStorefront(c,scope);
 return c.json({success:true,data},200,privateHeaders);
});
export default router;
