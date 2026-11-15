import {ProductCategoryReadSchema,ProductCategoryPageSchema,ProductCategoryCommandReceiptSchema,
 type ProductCategoryRead,type ProductCategoryPage,type ProductCategoryCommandReceipt,
 type CreateCategoryCommand,type UpdateCategoryCommand,type DeleteCategoryCommand}from '@letbuyy/shared-types';
import type {Env}from '../index';
import type {OwnedStoreScope}from '../lib/tenant-context';
import {withTenantTx,bindOwnedTenantActor,TenantTransactionUnavailableError}from '../lib/tenant-transaction';
import {AppError,ForbiddenError,NotFoundError,ValidationError}from '../lib/errors';

function failure(error:unknown):never{
 if(error instanceof AppError)throw error;
 if(error instanceof TenantTransactionUnavailableError)throw new AppError('Categories are temporarily unavailable. Keep the original request and retry.',503,'PRODUCT_CATEGORIES_UNAVAILABLE');
 const message=error instanceof Error?error.message:'',code=(error as {code?:string}|null)?.code;
 if(code==='42501'||message.includes('PRODUCT_CATEGORY_FORBIDDEN')||message.includes('PRODUCT_EDIT_FORBIDDEN'))throw new ForbiddenError('Your access to this store changed.');
 if(message.includes('PRODUCT_CATEGORY_NOT_FOUND'))throw new NotFoundError('Category not found.');
 if(message.includes('PRODUCT_EDIT_VERSION_CONFLICT')||code==='40P01'||code==='40001')throw new AppError('The category or an assigned product changed. Read and review the current version.',409,'PRODUCT_CATEGORY_VERSION_CONFLICT');
 for(const [marker,text]of [
  ['PRODUCT_CATEGORY_VERSION_CONFLICT','The category changed. Read and review its current version.'],
  ['PRODUCT_CATEGORY_KEY_CONFLICT','Recover the original category request before changing its details.'],
  ['PRODUCT_CATEGORY_IN_USE','Move assigned products and child categories before deleting this category.'],
  ['PRODUCT_CATEGORY_CONFLICT','A category with this name or slug already exists.'],
 ]as const)if(message.includes(marker))throw new AppError(text,409,marker);
 if(message.includes('PRODUCT_CATEGORY_CYCLE'))throw new ValidationError('Choose a parent outside this category and its descendants.');
 if(message.includes('PRODUCT_CATEGORY_PARENT_INVALID'))throw new ValidationError('Choose an available parent from this store.');
 if(message.includes('PRODUCT_CATEGORY_PATH_TOO_LONG'))throw new ValidationError('Use a shorter path or a shallower parent.');
 if(message.includes('PRODUCT_CATEGORY_INVALID')||code==='23505'||code==='23514'||code==='23503'||code?.startsWith('22'))throw new ValidationError('Review the category fields and selected store.');
 throw new AppError('The category outcome could not be confirmed. Retry the original request.',503,'PRODUCT_CATEGORIES_UNCONFIRMED');
}
async function call(env:Env,scope:OwnedStoreScope,query:string,args:readonly(string|number|null)[]):Promise<unknown>{
 try{return await withTenantTx(env,scope.tenant,async sql=>{
  await bindOwnedTenantActor(sql,scope);const rows=await sql.unsafe(query,[...args]);
  if(rows.length!==1||!rows[0]?.result)throw new Error('Category response unavailable');return rows[0].result;
 });}catch(error){return failure(error);}
}
export async function readProductCategoryPage(env:Env,scope:OwnedStoreScope,page:number,limit:number,search:string):Promise<ProductCategoryPage>{
 const raw=await call(env,scope,'SELECT public.read_product_category_page_v1($1::uuid,$2::uuid,$3::integer,$4::integer,$5::text)AS result',[scope.siteId,scope.customUser.id,page,limit,search]);
 const result=ProductCategoryPageSchema.safeParse(raw);
 if(!result.success||result.data.meta.page!==page||result.data.meta.per_page!==limit||result.data.data.some(row=>row.store_id!==scope.siteId))throw new AppError('The category page could not be confirmed.',503,'PRODUCT_CATEGORIES_UNCONFIRMED');
 return result.data;
}
export async function readProductCategory(env:Env,scope:OwnedStoreScope,id:string):Promise<ProductCategoryRead>{
 const result=ProductCategoryReadSchema.safeParse(await call(env,scope,'SELECT public.read_product_category_v1($1::uuid,$2::uuid,$3::uuid)AS result',[scope.siteId,scope.customUser.id,id]));
 if(!result.success||result.data.id!==id||result.data.store_id!==scope.siteId||result.data.deleted_at!==null)throw new AppError('The category could not be confirmed.',503,'PRODUCT_CATEGORIES_UNCONFIRMED');return result.data;
}
export async function executeProductCategoryCommand(env:Env,scope:OwnedStoreScope,operation:'create'|'update'|'delete',id:string|null,
 input:CreateCategoryCommand|UpdateCategoryCommand|DeleteCategoryCommand):Promise<ProductCategoryCommandReceipt>{
 if(input.store_id!==scope.siteId)throw new ForbiddenError('The selected store changed.');
 const {store_id:site,idempotency_key:key,...body}=input;void site;
 const version='version'in body?body.version:null;const payload:Record<string,unknown>={};
 for(const [field,value]of Object.entries(body))if(field!=='version')payload[field]=value;
 const result=ProductCategoryCommandReceiptSchema.safeParse(await call(env,scope,
  'SELECT public.apply_product_category_command_v1($1::uuid,$2::uuid,$3::text,$4::uuid,$5::integer,$6::uuid,$7::text::jsonb)AS result',
  [scope.siteId,scope.customUser.id,operation,id,version,key,JSON.stringify(payload)]));
 if(!result.success||result.data.store_id!==scope.siteId||result.data.operation!==operation||result.data.idempotency_key!==key
  ||id!==null&&result.data.id!==id||version!==null&&result.data.version<=version)throw new AppError('This category save was not confirmed. Recover its original request.',503,'PRODUCT_CATEGORIES_UNCONFIRMED');
 return result.data;
}
