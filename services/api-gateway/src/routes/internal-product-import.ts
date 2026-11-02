import { Hono } from 'hono';
import { z } from 'zod';
import { UuidSchema } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { admittedProductImportRequest } from '../lib/product-import-internal-request';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { AppError } from '../lib/errors';
import { ProductImportExecutionAdapter } from '../execution/product-import.adapter';

const router=new Hono<{Bindings:Env}>();
const Due=z.array(z.object({job_id:UuidSchema,store_id:UuidSchema,actor_id:UuidSchema}).strict()).max(2);
router.post('/run',async c=>{
    if(!admittedProductImportRequest(c.req.raw))throw new AppError('Invalid import recovery request',401,'UNAUTHORIZED');
    const selected=await getSupabaseAdmin(c).rpc('due_product_imports_v1');
    if(selected.error)throw new AppError('Import recovery is temporarily unavailable',503,'PRODUCT_IMPORT_UNAVAILABLE');
    const parsed=Due.safeParse(selected.data);
    if(!parsed.success)throw new AppError('Import recovery could not be confirmed',503,'PRODUCT_IMPORT_UNCONFIRMED');
    const results:{status:string;committed_rows?:number;pending_rows?:number}[]=[];
    // Exact bounded metadata only. Do not expose actor, file, plan or source.
    for(const due of parsed.data){
        const service=new ProductImportExecutionAdapter(c.env,due.store_id,due.actor_id);
        try{
            await service.process(due.job_id);
            const job=await service.read(due.job_id);
            results.push(job?{status:job.status,committed_rows:job.row_count,pending_rows:job.pending_rows}:{status:'unavailable'});
        }catch{results.push({status:'unavailable'});}
    }
    return c.json(success({observed_jobs:results.length,results}),200,{'Cache-Control':'private, no-store'});
});
export default router;
