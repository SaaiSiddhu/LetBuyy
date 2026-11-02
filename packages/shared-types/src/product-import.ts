import { z } from 'zod';
import { UuidSchema } from './uuid';

export const PRODUCT_IMPORT_CONTRACT_VERSION = 2 as const;
export const PRODUCT_IMPORT_MAX_ROWS = 500;
export const PRODUCT_IMPORT_MAX_BYTES = 1_048_576;

export function isProductImportCommandPath(path:string):boolean {
    const normalized=path.replace(/^\/v1(?=\/|$)/,'');
    return normalized==='/export/imports/register'||normalized==='/export/imports/stop-registration'
        || /^\/export\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:retry|stop)$/i.test(normalized);
}

const version = z.literal(PRODUCT_IMPORT_CONTRACT_VERSION);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const count = z.number().int().min(0).max(PRODUCT_IMPORT_MAX_ROWS);
const date = z.string().datetime({ offset: true });

export const ProductImportErrorCodeSchema = z.enum([
    'PRODUCT_IMPORT_ROW_FAILED',
    'PRODUCT_LIMIT_REACHED',
    'ENTITLEMENT_AUTHORITY_UNAVAILABLE',
    'PRODUCT_IMPORT_ACCESS_CHANGED',
    'PRODUCT_IMPORT_LEASE_EXPIRED',
    'PRODUCT_IMPORT_SOURCE_CONFLICT',
    'PRODUCT_IMPORT_STOPPED',
]);
export type ProductImportErrorCode = z.infer<typeof ProductImportErrorCodeSchema>;

/** A retry is the original file and command, never a newly minted import. */
export const ProductCsvImportSchema = z.object({
    store_id: UuidSchema,
    idempotency_key: UuidSchema,
    contract_version: version,
    csv: z.string().min(1).max(PRODUCT_IMPORT_MAX_BYTES)
        .refine(value => value.trim().length > 0, 'A product CSV is required')
        .refine(value => new TextEncoder().encode(value).length <= PRODUCT_IMPORT_MAX_BYTES,
            'Split this CSV into files of at most one MiB.'),
}).strict().superRefine((input,context)=>{
    if(new TextEncoder().encode(JSON.stringify(input)).length>PRODUCT_IMPORT_MAX_BYTES)
        context.addIssue({code:'custom',message:'Split this CSV into smaller files; the formatted request must fit one MiB.'});
});
export type ProductCsvImportInput = z.infer<typeof ProductCsvImportSchema>;

export const ProductImportRegistrationStopSchema=z.object({
    store_id:UuidSchema,idempotency_key:UuidSchema,contract_version:version,source_sha256:hash,
}).strict();
export type ProductImportRegistrationStop=z.infer<typeof ProductImportRegistrationStopSchema>;

export const ProductImportJobCommandSchema = z.object({
    store_id: UuidSchema,
    job_id: UuidSchema,
    idempotency_key: UuidSchema,
    contract_version: version,
}).strict();
export type ProductImportJobCommand = z.infer<typeof ProductImportJobCommandSchema>;

export const ProductImportCapabilitiesSchema = z.object({
    store_id: UuidSchema,
    actor_id: UuidSchema,
    contract_version: version,
    max_rows: z.literal(PRODUCT_IMPORT_MAX_ROWS),
    max_bytes: z.literal(PRODUCT_IMPORT_MAX_BYTES),
    durable_registration: z.literal(true),
    durable_rows: z.literal(true),
    async_recovery: z.literal(true),
}).strict();
export type ProductImportCapabilities = z.infer<typeof ProductImportCapabilitiesSchema>;

export const ProductImportJobSchema = z.object({
    id: UuidSchema,
    type: z.literal('product_import'),
    contract_version: version,
    store_id: UuidSchema,
    actor_id: UuidSchema,
    idempotency_key: UuidSchema,
    source_sha256: hash,
    status: z.enum(['queued', 'running', 'completed', 'failed', 'stopped', 'blocked']),
    total_rows: count,
    row_count: count,
    failed_rows: count,
    pending_rows: count,
    stopped_rows: count,
    resumable: z.boolean(),
    error_code: ProductImportErrorCodeSchema.nullable(),
    created_at: date,
    updated_at: date,
    started_at: date.nullable(),
    completed_at: date.nullable(),
    // Registration does not create result CSV bytes. No fabricated download.
    download_url: z.null(),
}).strict().superRefine((job, context) => {
    if(job.total_rows===0&&(job.status!=='stopped'||job.error_code!=='PRODUCT_IMPORT_STOPPED'||!job.completed_at))
        context.addIssue({code:'custom',message:'A zero-row import is only a verified stop before registration.'});
    if (job.row_count + job.failed_rows + job.pending_rows + job.stopped_rows !== job.total_rows) {
        context.addIssue({ code: 'custom', message: 'Import progress does not match its original rows.' });
    }
    if (job.status === 'completed' && (job.row_count !== job.total_rows || !job.completed_at)) {
        context.addIssue({ code: 'custom', message: 'Import completion is unverified.' });
    }
    if (job.resumable && ['completed', 'stopped', 'blocked', 'running'].includes(job.status)) {
        context.addIssue({ code: 'custom', message: 'This import cannot be resumed in its current state.' });
    }
});
export type ProductImportJob = z.infer<typeof ProductImportJobSchema>;

export const ProductImportRowSchema = z.object({
    id: UuidSchema,
    job_id: UuidSchema,
    store_id: UuidSchema,
    ordinal: z.number().int().min(1).max(PRODUCT_IMPORT_MAX_ROWS),
    status: z.enum(['queued', 'completed', 'failed', 'stopped']),
    product_id: UuidSchema.nullable(),
    error_code: ProductImportErrorCodeSchema.nullable(),
    attempt_count: z.number().int().min(0),
}).strict().superRefine((row, context) => {
    if ((row.status === 'completed') !== (row.product_id !== null)) {
        context.addIssue({ code: 'custom', message: 'An imported product acknowledgement is missing or inconsistent.' });
    }
});
export type ProductImportRow = z.infer<typeof ProductImportRowSchema>;

export const ProductImportRowsQuerySchema = z.object({
    store_id: UuidSchema,
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['all', 'queued', 'completed', 'failed', 'stopped']).default('all'),
}).strict();
export type ProductImportRowsQuery = z.input<typeof ProductImportRowsQuerySchema>;

export const ProductImportRowsPageSchema = z.object({
    data: z.array(ProductImportRowSchema),
    meta: z.object({
        store_id: UuidSchema,
        actor_id: UuidSchema,
        job_id: UuidSchema,
        page: z.number().int().min(1),
        per_page: z.number().int().min(1).max(100),
        total: count,
        total_is_exact: z.literal(true),
        has_next: z.boolean(),
    }).strict(),
}).strict().superRefine((page, context) => {
    const meta = page.meta;
    const remaining = Math.max(0, meta.total - (meta.page - 1) * meta.per_page);
    if (page.data.length !== Math.min(remaining, meta.per_page)
        || meta.has_next !== (meta.page * meta.per_page < meta.total)
        || new Set(page.data.map(row => row.id)).size !== page.data.length
        || page.data.some((row, index) => row.store_id !== meta.store_id || row.job_id !== meta.job_id
            || (index > 0 && row.ordinal <= page.data[index - 1].ordinal))) {
        context.addIssue({ code: 'custom', message: 'Import rows or their exact page scope could not be confirmed.' });
    }
});
export type ProductImportRowsPage = z.infer<typeof ProductImportRowsPageSchema>;

export const ProductImportHistoryQuerySchema = ProductImportRowsQuerySchema.omit({ status: true });
export const ProductImportHistoryPageSchema = z.object({
    data: z.array(ProductImportJobSchema),
    meta: z.object({
        store_id: UuidSchema, actor_id: UuidSchema,
        page: z.number().int().min(1), per_page: z.number().int().min(1).max(100),
        total: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        total_is_exact: z.literal(true), has_next: z.boolean(),
    }).strict(),
}).strict().superRefine((page, context) => {
    const m = page.meta;
    if (page.data.length !== Math.min(Math.max(0, m.total - (m.page - 1) * m.per_page), m.per_page)
        || m.has_next !== (m.page * m.per_page < m.total)
        || new Set(page.data.map(job => job.id)).size !== page.data.length
        || page.data.some(job => job.store_id !== m.store_id || job.actor_id !== m.actor_id)) {
        context.addIssue({ code: 'custom', message: 'Import history scope could not be confirmed.' });
    }
});
export type ProductImportHistoryPage = z.infer<typeof ProductImportHistoryPageSchema>;
