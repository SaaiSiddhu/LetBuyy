import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductCsvImportSchema, ProductImportCapabilitiesSchema, ProductImportJobSchema,
    ProductImportRowsPageSchema } from '@letbuyy/shared-types';

const site = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';
const rowId = '44444444-4444-4444-8444-444444444444';
const key = '55555555-5555-4555-8555-555555555555';
const job = { id: jobId, type: 'product_import', contract_version: 2, store_id: site,
    actor_id: actor, idempotency_key: key, source_sha256: 'a'.repeat(64), status: 'failed',
    total_rows: 2, row_count: 1, failed_rows: 1, pending_rows: 0, stopped_rows: 0,
    resumable: true, error_code: 'PRODUCT_IMPORT_ROW_FAILED', created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:01Z', started_at: '2026-11-01T00:00:00Z', completed_at: null,
    download_url: null };

test('new imports require original identity and a durable protocol acknowledgement', () => {
    const input = {store_id:site,csv:'name,price\nSynthetic,1',idempotency_key:key,contract_version:2};
    assert.deepEqual(ProductCsvImportSchema.parse(input), input);
    assert.equal(ProductCsvImportSchema.safeParse({store_id:site,csv:input.csv}).success, false);
    assert.equal(ProductCsvImportSchema.safeParse({...input,contract_version:1}).success, false);
    assert.equal(ProductImportCapabilitiesSchema.safeParse({store_id:site,actor_id:actor,contract_version:1}).success, false);
});

test('UTF8 byte limits preserve Unicode content but refuse oversized multibyte files', () => {
    const csv = 'name\n'+'அ'.repeat(350000);
    assert.ok(csv.length < 1_048_576);
    assert.equal(ProductCsvImportSchema.safeParse({store_id:site,idempotency_key:key,contract_version:2,csv}).success, false);
    const valid = {store_id:site,idempotency_key:key,contract_version:2,csv:'name,description\n"東京","  a\r\nb  "'};
    assert.equal(ProductCsvImportSchema.parse(valid).csv, valid.csv);
});

test('formatted command bytes share the Gateway limit even when raw CSV is smaller',()=>{
    const csv='"'.repeat(530000);
    assert.ok(new TextEncoder().encode(csv).length<1048576);
    assert.equal(ProductCsvImportSchema.safeParse({store_id:site,idempotency_key:key,contract_version:2,csv}).success,false);
});

test('failed imports acknowledge the exact committed population rather than a false zero', () => {
    assert.equal(ProductImportJobSchema.parse(job).row_count, 1);
    assert.equal(ProductImportJobSchema.safeParse({...job,row_count:0}).success, false);
    assert.equal(ProductImportJobSchema.safeParse({...job,status:'completed',resumable:false}).success, false);
    assert.equal(ProductImportJobSchema.safeParse({...job,status:'running',resumable:true}).success, false);
});

test('an import must not advertise nonexistent downloads or raw database errors', () => {
    assert.equal(ProductImportJobSchema.safeParse({...job,download_url:'https://example.invalid/report.csv'}).success, false);
    assert.equal(ProductImportJobSchema.safeParse({...job,error_code:'private-database-column-detail'}).success, false);
});

test('zero accepted rows represent only a verified stop before registration',()=>{
    const stopped={...job,status:'stopped',total_rows:0,row_count:0,failed_rows:0,pending_rows:0,stopped_rows:0,
        resumable:false,error_code:'PRODUCT_IMPORT_STOPPED',completed_at:'2026-11-01T00:00:01Z'};
    assert.equal(ProductImportJobSchema.parse(stopped).total_rows,0);
    assert.equal(ProductImportJobSchema.safeParse({...stopped,status:'completed',error_code:null}).success,false);
    assert.equal(ProductImportJobSchema.safeParse({...stopped,completed_at:null}).success,false);
    assert.equal(ProductImportJobSchema.safeParse({...stopped,status:'queued',resumable:true,error_code:null}).success,false);
});

test('row pages reject foreign scope, duplicate rows and unsupported exact totals', () => {
    const row = {id:rowId,job_id:jobId,store_id:site,ordinal:1,status:'failed',product_id:null,
        error_code:'PRODUCT_IMPORT_ROW_FAILED',attempt_count:1};
    const meta = {store_id:site,actor_id:actor,job_id:jobId,page:1,per_page:20,total:1,total_is_exact:true,has_next:false};
    assert.equal(ProductImportRowsPageSchema.parse({data:[row],meta}).data.length, 1);
    assert.equal(ProductImportRowsPageSchema.safeParse({data:[{...row,store_id:actor}],meta}).success, false);
    assert.equal(ProductImportRowsPageSchema.safeParse({data:[row,row],meta:{...meta,total:2}}).success, false);
    assert.equal(ProductImportRowsPageSchema.safeParse({data:[row],meta:{...meta,total:0}}).success, false);
    assert.equal(ProductImportRowsPageSchema.safeParse({data:[row],meta:{...meta,total_is_exact:false}}).success, false);
});

test('a beyond-last row page keeps the actual population without invented data', () => {
    const meta = {store_id:site,actor_id:actor,job_id:jobId,page:2,per_page:20,total:1,total_is_exact:true,has_next:false};
    assert.equal(ProductImportRowsPageSchema.parse({data:[],meta}).meta.total, 1);
    assert.equal(ProductImportRowsPageSchema.safeParse({data:[],meta:{...meta,has_next:true}}).success, false);
});
