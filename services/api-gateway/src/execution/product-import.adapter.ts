import { planProductCreate, type ProductCreatePlan } from '@letbuyy/commerce-core';
import { ProductImportJobSchema, ProductImportCapabilitiesSchema, ProductImportRowsPageSchema,
    ProductImportHistoryPageSchema, UuidSchema, type ProductImportJob, type ProductImportErrorCode,
    type ProductCsvImportInput } from '@letbuyy/shared-types';
import type { PooledSqlClient } from '@letbuyy/infrastructure/pooled-sql-adapter';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { sha256Hex } from '../lib/crypto';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';
import { productCsvInputs } from './product-csv-input';
import { createProductInTenantTransaction } from './product-mutation.adapter';

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Product import source unavailable');
    return value as Record<string, unknown>;
}

function importError(error: unknown): never {
    if (error instanceof AppError) throw error;
    const code = (error as {code?: string})?.code;
    const message = error instanceof Error ? error.message : '';
    if (code === '42501' || message === 'PRODUCT_IMPORT_FORBIDDEN') throw new ForbiddenError('Your access to this import changed.');
    if (message === 'PRODUCT_IMPORT_KEY_CONFLICT') throw new AppError('This request belongs to another file. Recover the original import.',409,'PRODUCT_IMPORT_KEY_CONFLICT');
    if (message === 'PRODUCT_IMPORT_NOT_FOUND') throw new NotFoundError('Import not found');
    if (message === 'PRODUCT_IMPORT_LEASE_EXPIRED') throw new AppError('Import work changed. Reload its current status.',409,'PRODUCT_IMPORT_LEASE_EXPIRED');
    if (message === 'PRODUCT_LIMIT_REACHED') throw new AppError('Your store has reached its current product limit.',403,'PRODUCT_LIMIT_REACHED');
    if (message === 'ENTITLEMENT_AUTHORITY_UNAVAILABLE') throw new AppError('Product limits are temporarily unavailable.',503,'ENTITLEMENT_AUTHORITY_UNAVAILABLE');
    if (message === 'PRODUCT_IMPORT_INVALID' || code?.startsWith('22')) throw new ValidationError('Review this import and retry the original request.');
    if (error instanceof TenantTransactionUnavailableError || code === '42883' || code === '42P01') {
        throw new AppError('CSV import is temporarily unavailable. Keep the original file and retry later.',503,'PRODUCT_IMPORT_UNAVAILABLE');
    }
    console.error(JSON.stringify({level:'error',service:'letbuyy-api',event:'product_import_transaction_unconfirmed',
        error_code:typeof code==='string'&&/^[A-Z0-9]{5}$/.test(code)?code:'UNKNOWN'}));
    throw new AppError('The import outcome could not be confirmed. Keep the original request.',503,'PRODUCT_IMPORT_UNCONFIRMED');
}

export class ProductImportExecutionAdapter {
    constructor(private readonly env: Env, private readonly storeId: string, private readonly actorId: string) {
        UuidSchema.parse(storeId); UuidSchema.parse(actorId);
    }

    private async transaction<T>(run: (sql:PooledSqlClient)=>Promise<T>):Promise<T> {
        try {
            return await withTenantTx(this.env,{siteId:this.storeId,requestId:crypto.randomUUID()},async sql=>{
                await sql.unsafe('SELECT set_config($1,$2,true)',['app.actor_id',this.actorId]);
                return run(sql);
            });
        } catch(error) { return importError(error); }
    }

    async register(input: ProductCsvImportInput): Promise<ProductImportJob> {
        if(input.store_id!==this.storeId) throw new ForbiddenError('The selected store changed.');
        const plans = productCsvInputs(input.csv,this.storeId).map(planProductCreate);
        const sourceHash = await sha256Hex(input.csv);
        return this.transaction(async sql=>{
            const rows=await sql.unsafe('SELECT public.register_product_import_v1($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text::jsonb) AS job',
                [this.storeId,this.actorId,input.idempotency_key,sourceHash,JSON.stringify(plans)]);
            return ProductImportJobSchema.parse(rows[0]?.job);
        });
    }

    async read(jobId:string):Promise<ProductImportJob|null> {
        UuidSchema.parse(jobId);
        return this.transaction(async sql=>{
            const rows=await sql.unsafe('SELECT public.read_product_import_v1($1::uuid,$2::uuid,$3::uuid) AS job',[this.storeId,this.actorId,jobId]);
            return rows[0]?.job == null ? null : ProductImportJobSchema.parse(rows[0].job);
        });
    }

    async capabilities() {
        return this.transaction(async sql => {
            const rows = await sql.unsafe('SELECT public.product_import_capabilities_v1($1::uuid,$2::uuid) AS result', [this.storeId,this.actorId]);
            return ProductImportCapabilitiesSchema.parse(rows[0]?.result);
        });
    }

    async readKey(key:string):Promise<ProductImportJob|null> {
        UuidSchema.parse(key);
        return this.transaction(async sql => {
            const rows = await sql.unsafe('SELECT public.read_product_import_key_v1($1::uuid,$2::uuid,$3::uuid) AS job', [this.storeId,this.actorId,key]);
            return rows[0]?.job == null ? null : ProductImportJobSchema.parse(rows[0].job);
        });
    }

    async rows(jobId:string,page:number,limit:number,status:string) {
        UuidSchema.parse(jobId);
        return this.transaction(async sql => {
            const rows = await sql.unsafe('SELECT public.read_product_import_rows_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::integer,$6::text) AS result',
                [this.storeId,this.actorId,jobId,page,limit,status]);
            return ProductImportRowsPageSchema.parse(rows[0]?.result);
        });
    }

    async history(page:number,limit:number) {
        return this.transaction(async sql => {
            const rows = await sql.unsafe('SELECT public.read_product_import_history_v1($1::uuid,$2::uuid,$3::integer,$4::integer) AS result',
                [this.storeId,this.actorId,page,limit]);
            return ProductImportHistoryPageSchema.parse(rows[0]?.result);
        });
    }

    async command(jobId:string,key:string,stop:boolean):Promise<ProductImportJob> {
        UuidSchema.parse(jobId);UuidSchema.parse(key);
        return this.transaction(async sql=>{
            const rows=await sql.unsafe('SELECT public.command_product_import_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::boolean) AS job',
                [this.storeId,this.actorId,jobId,key,stop]);
            return ProductImportJobSchema.parse(rows[0]?.job);
        });
    }

    async stopRegistration(key:string,sourceHash:string):Promise<ProductImportJob> {
        UuidSchema.parse(key);
        return this.transaction(async sql=>{
            const rows=await sql.unsafe('SELECT public.stop_product_import_registration_v1($1::uuid,$2::uuid,$3::uuid,$4::text) AS job',
                [this.storeId,this.actorId,key,sourceHash]);
            return ProductImportJobSchema.parse(rows[0]?.job);
        });
    }

    /** Bounded execution; its durable lease/rows survive waitUntil termination. */
    async process(jobId:string):Promise<void> {
        UuidSchema.parse(jobId);
        const lease=await this.transaction(async sql=>{
            const rows=await sql.unsafe('SELECT public.claim_product_import_v1($1::uuid,$2::uuid,$3::uuid) AS lease',
                [this.storeId,this.actorId,jobId]);
            return rows[0]?.lease;
        });
        if(lease==null)return;
        const leaseId=UuidSchema.parse(lease),started=Date.now();
        for(let index=0;index<50&&Date.now()-started<8000;index++) {
            let attemptId:string|null=null;
            try {
                const outcome=await this.transaction(async sql=>{
                    const rows=await sql.unsafe('SELECT public.begin_product_import_row_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid) AS work',
                        [this.storeId,this.actorId,jobId,leaseId]);
                    if(rows[0]?.work==null)return 'empty';
                    const work=record(rows[0].work),stored=record(work.plan),parent=record(stored.productInsert);
                    attemptId=UuidSchema.parse(work.id);
                    // Reuse the canonical planner and reject reinterpretation of
                    // a stored plan after an incompatible code/schema change.
                    const input=Object.fromEntries(Object.entries(parent).filter(([,value])=>value!==null));
                    const plan:ProductCreatePlan=planProductCreate({...input,stock:stored.initialStock,
                        product_options:stored.productOptions,variants:stored.productVariants} as Parameters<typeof planProductCreate>[0]);
                    const same=await sql.unsafe('SELECT $1::text::jsonb=$2::text::jsonb AS matches',[JSON.stringify(stored),JSON.stringify(plan)]);
                    if(same[0]?.matches!==true)throw new Error('Product import plan version unavailable');
                    const product=await createProductInTenantTransaction(sql,plan,this.storeId,this.actorId,attemptId);
                    await sql.unsafe('SELECT public.complete_product_import_row_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text::jsonb)',
                        [this.storeId,this.actorId,jobId,leaseId,attemptId,JSON.stringify(product)]);
                    const current=await sql.unsafe('SELECT public.read_product_import_v1($1::uuid,$2::uuid,$3::uuid) AS job',[this.storeId,this.actorId,jobId]);
                    return ProductImportJobSchema.parse(current[0]?.job).status;
                });
                if(outcome==='completed'||outcome==='empty')break;
            }catch(error){
                if(!attemptId)throw error;
                const errorCode:ProductImportErrorCode=error instanceof AppError&&error.code==='PRODUCT_LIMIT_REACHED'
                    ?'PRODUCT_LIMIT_REACHED':error instanceof AppError&&error.code==='ENTITLEMENT_AUTHORITY_UNAVAILABLE'
                        ?'ENTITLEMENT_AUTHORITY_UNAVAILABLE':'PRODUCT_IMPORT_ROW_FAILED';
                const failed=await this.transaction(async sql=>{
                    const rows=await sql.unsafe('SELECT public.fail_product_import_row_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text) AS failed',
                        [this.storeId,this.actorId,jobId,leaseId,attemptId,errorCode]);
                    return rows[0]?.failed===true;
                });
                if(failed)return;
                // A negative acknowledgement cannot turn an already committed
                // row into a failure. A completed/stopped job needs no further
                // lease operation; any remaining row still checks the lease.
                const reconciled=await this.read(jobId);
                if(reconciled&&['completed','stopped','blocked'].includes(reconciled.status))return;
            }
        }
        await this.transaction(sql=>sql.unsafe('SELECT public.release_product_import_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid)',
            [this.storeId,this.actorId,jobId,leaseId]));
    }
}
