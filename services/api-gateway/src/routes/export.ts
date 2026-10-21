import { Hono } from 'hono';
import { requireExportSigningSecret } from '../lib/export-signing-secret';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { timingSafeEqualText } from '../lib/crypto';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { ProductExecutionAdapter, isProductVariantDiffEnabled } from '../execution/product-execution.adapter';
import { CreateProductSchema } from '@letbuyy/commerce-core';
import { ProductCsvImportSchema } from '@letbuyy/shared-types';

const router = new Hono<{ Bindings: Env }>();

type ExportContext = Context<{ Bindings: Env }>;
type ExportJobType = 'products' | 'orders' | 'customers' | 'product_import';
type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface ProductExportRow {
    id: string;
    name: string;
    description?: string | null;
    price?: number | string | null;
    compare_price?: number | string | null;
    category?: string | null;
    stock?: number | null;
    is_active?: boolean | null;
    is_featured?: boolean | null;
    tags?: string[] | null;
    images?: string[] | null;
    created_at?: string | null;
}

interface OrderExportRow {
    order_number?: string | null;
    status?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    subtotal?: number | string | null;
    shipping_cost?: number | string | null;
    discount?: number | string | null;
    total?: number | string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    tracking_number?: string | null;
    carrier?: string | null;
    created_at?: string | null;
}

interface CustomerExportRow {
    id?: string | null;
    email?: string | null;
    full_name?: string | null;
    phone?: string | null;
    status?: string | null;
    total_orders?: number | string | null;
    total_spent?: number | string | null;
    accepts_marketing?: boolean | null;
    tags?: string[] | null;
    last_order_at?: string | null;
    last_login_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

interface ExportJobRecord {
    id: string;
    type: ExportJobType;
    status: ExportJobStatus;
    actorId: string;
    storeIds: string[];
    filename: string;
    resultKey: string;
    sourceKey?: string | null;
    rowCount: number;
    errorCode?: string | null;
    errorMessage?: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    expiresAt: string;
    metadata: Record<string, unknown>;
}

const PRODUCT_EXPORT_HEADERS = ['id', 'name', 'description', 'price', 'compare_price', 'category', 'stock', 'is_active', 'is_featured', 'tags', 'images', 'created_at'] as const;
const ORDER_EXPORT_HEADERS = [
    'order_number',
    'status',
    'customer_name',
    'customer_email',
    'customer_phone',
    'subtotal',
    'shipping_cost',
    'discount',
    'total',
    'payment_method',
    'payment_status',
    'tracking_number',
    'carrier',
    'created_at',
] as const;
const CUSTOMER_EXPORT_HEADERS = [
    'id',
    'email',
    'full_name',
    'phone',
    'status',
    'total_orders',
    'total_spent',
    'accepts_marketing',
    'tags',
    'last_order_at',
    'last_login_at',
    'created_at',
    'updated_at',
] as const;
const PRODUCT_EXPORT_SELECT = PRODUCT_EXPORT_HEADERS.join(',');
const ORDER_EXPORT_SELECT = ORDER_EXPORT_HEADERS.join(',');
const CUSTOMER_EXPORT_SELECT = CUSTOMER_EXPORT_HEADERS.join(',');
const EXPORT_BATCH_SIZE = 1000;
const PRODUCT_IMPORT_MAX_ROWS = 500;

function createProductExecutionAdapter(c: ExportContext): ProductExecutionAdapter {
    return new ProductExecutionAdapter(getSupabaseAdmin(c), {
        variantDiffEnabled: isProductVariantDiffEnabled(c.env),
    });
}
const EXPORT_JOB_TTL_SECONDS = 7 * 24 * 60 * 60;

function nowIso(): string {
    return new Date().toISOString();
}

function expiresAtIso(): string {
    return new Date(Date.now() + EXPORT_JOB_TTL_SECONDS * 1000).toISOString();
}

function dateStamp(): string {
    return new Date().toISOString().slice(0, 10);
}

function exportJobKey(jobId: string): string {
    return `exports/jobs/${jobId}.json`;
}

function exportResultKey(jobId: string, filename: string): string {
    return `exports/results/${jobId}/${filename}`;
}

function exportSourceKey(jobId: string): string {
    return `exports/sources/${jobId}/products.csv`;
}

function recordValue(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function assertExportStorage(c: ExportContext): R2Bucket {
    if (!c.env.R2_BUCKET) {
        throw new Error('CSV export jobs require the R2_BUCKET binding.');
    }
    return c.env.R2_BUCKET;
}

function exportSigningSecret(c: ExportContext): string {
    return requireExportSigningSecret(c.env.INTERNAL_API_SECRET);
}

function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
    return values
        .map(v => {
            if (v == null) return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        })
        .join(',');
}

class CsvInputError extends Error {
    constructor(message: string, readonly code = 'INVALID_CSV', readonly status: 400 | 413 = 400) {
        super(message);
        this.name = 'CsvInputError';
    }
}

/** One bounded pass: record separators inside quoted fields are data. */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], pieces: string[] = [];
    let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    let quoted = false, closed = false, wasQuoted = false;
    const field = (end: number) => {
        pieces.push(text.slice(start, end));
        const value = pieces.join('');
        row.push(wasQuoted ? value : value.trim());
        pieces = []; wasQuoted = false; closed = false;
    };
    const record = () => {
        if (row.some(value => value.trim() !== '')) {
            rows.push(row);
            if (rows.length > PRODUCT_IMPORT_MAX_ROWS + 1) throw new CsvInputError(`Product CSV imports are capped at ${PRODUCT_IMPORT_MAX_ROWS} rows per job`, 'IMPORT_TOO_LARGE', 413);
        }
        row = [];
    };
    for (let index = start; index < text.length; index++) {
        const ch = text[index];
        if (quoted) {
            if (ch !== '"') continue;
            pieces.push(text.slice(start, index));
            if (text[index + 1] === '"') { pieces.push('"'); index++; start = index + 1; }
            else { quoted = false; closed = true; start = index + 1; }
            continue;
        }
        if (ch === ',' || ch === '\r' || ch === '\n') {
            field(closed ? start : index);
            if (ch !== ',') {
                record();
                if (ch === '\r' && text[index + 1] === '\n') index++;
            }
            start = index + 1;
        } else if (ch === '"') {
            if (closed || text.slice(start, index).trim() !== '') throw new CsvInputError('CSV contains an unexpected quote.');
            quoted = true; wasQuoted = true; start = index + 1;
        } else if (closed && ch !== ' ' && ch !== '\t') {
            throw new CsvInputError('CSV contains text after a closing quote.');
        }
    }
    if (quoted) throw new CsvInputError('CSV contains an unclosed quoted field.');
    if (start < text.length || pieces.length || wasQuoted || row.length) {
        field(closed ? start : text.length);
        record();
    }
    return rows;
}

function productCsvInputs(csv: string, storeId: string) {
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new CsvInputError('CSV must have headers and at least one product row.');
    const headers = rows[0].map(value => value.trim().toLowerCase());
    if (!headers.includes('name')) throw new CsvInputError('CSV must have a "name" column.');
    if (new Set(headers).size !== headers.length) throw new CsvInputError('CSV column names must be unique.');
    const index = (name: string) => headers.indexOf(name);
    const name = index('name'), price = index('price'), description = index('description'), category = index('category');
    const stock = index('stock'), tags = index('tags'), images = index('images');
    return rows.slice(1).map((row, position) => {
        if (row.length > headers.length) throw new CsvInputError(`CSV row ${position + 2} has more fields than the header.`);
        const parsed = CreateProductSchema.safeParse({
            store_id: storeId, name: row[name] || 'Unnamed Product',
            description: description >= 0 ? row[description] || '' : '',
            price: price >= 0 && row[price]?.trim() ? Number(row[price]) : 0,
            category: category >= 0 ? row[category] || undefined : undefined,
            stock: stock >= 0 && row[stock]?.trim() ? Number(row[stock]) : 0,
            tags: tags >= 0 && row[tags] ? row[tags].split(';').map(value => value.trim()).filter(Boolean) : [],
            images: images >= 0 && row[images] ? row[images].split(';').map(value => value.trim()).filter(Boolean) : [],
            is_active: true,
        });
        if (!parsed.success) {
            const key = parsed.error.issues[0]?.path.join('.') || 'fields';
            throw new CsvInputError(`CSV row ${position + 2} has an invalid ${key}.`);
        }
        return parsed.data;
    });
}

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function signDownloadToken(c: ExportContext, job: ExportJobRecord): Promise<string> {
    const material = `${job.id}.${job.actorId}.${job.resultKey}.${job.expiresAt}`;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(exportSigningSecret(c)),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(material));
    return base64Url(new Uint8Array(signature));
}

async function signedDownloadUrl(c: ExportContext, job: ExportJobRecord): Promise<string> {
    const url = new URL(c.req.url);
    url.pathname = `/v1/export/jobs/${job.id}/download`;
    url.search = '';
    url.searchParams.set('token', await signDownloadToken(c, job));
    return url.toString();
}

async function readJsonObject<T>(bucket: R2Bucket, key: string, fallback: T): Promise<T> {
    const object = await bucket.get(key);
    if (!object) return fallback;

    try {
        const parsed = JSON.parse(await object.text()) as unknown;
        return (recordValue(parsed) as T | null) || fallback;
    } catch {
        return fallback;
    }
}

async function writeJsonObject(bucket: R2Bucket, key: string, value: Record<string, unknown>): Promise<void> {
    await bucket.put(key, JSON.stringify(value), {
        httpMetadata: { contentType: 'application/json' },
    });
}

async function readJob(c: ExportContext, jobId: string): Promise<ExportJobRecord | null> {
    const job = await readJsonObject<ExportJobRecord | null>(assertExportStorage(c), exportJobKey(jobId), null);
    return job?.id === jobId ? job : null;
}

async function writeJob(c: ExportContext, job: ExportJobRecord): Promise<ExportJobRecord> {
    const updated = { ...job, updatedAt: nowIso() };
    await writeJsonObject(assertExportStorage(c), exportJobKey(job.id), updated as unknown as Record<string, unknown>);
    return updated;
}

async function updateJob(c: ExportContext, job: ExportJobRecord, patch: Partial<ExportJobRecord>): Promise<ExportJobRecord> {
    return writeJob(c, { ...job, ...patch });
}

async function resolveActor(c: ExportContext): Promise<{ actorId: string } | { error: Response }> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return { error: c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403) };
    }

    return { actorId: customUser.id };
}

async function resolveExportScope(c: ExportContext, storeId?: string | null): Promise<
    | { actorId: string; storeIds: string[] }
    | { error: Response }
> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return { error: c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403) };
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId) {
        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return { error: c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403) };
        }
    }

    return { actorId: customUser.id, storeIds: ownedStoreIds };
}

async function readAccessibleJob(c: ExportContext, jobId: string): Promise<ExportJobRecord | null> {
    const actor = await resolveActor(c);
    if ('error' in actor) return null;
    const job = await readJob(c, jobId);
    if (!job || job.actorId !== actor.actorId) return null;
    if (!(Date.parse(job.expiresAt) > Date.now())) return null;
    const requestedStore = c.req.query('store_id');
    if (requestedStore && (job.storeIds.length !== 1 || job.storeIds[0] !== requestedStore)) return null;

    // A signature and the original actor do not preserve access after ownership
    // or the current session's store scope changes. Recheck at poll/download.
    const db = getSupabaseAdmin(c);
    const sessionStoreId = c.get('auth').user.storeId;
    if (job.storeIds.length === 1) {
        if (!(await verifySiteOwnership(db, job.storeIds[0], actor.actorId, sessionStoreId))) return null;
    } else if (job.storeIds.length > 1) {
        const current = new Set(await listOwnedStoreIds(db, actor.actorId, sessionStoreId));
        if (job.storeIds.some(id => !current.has(id))) return null;
    }
    return job;
}

async function serializeJob(c: ExportContext, job: ExportJobRecord) {
    return {
        id: job.id,
        type: job.type,
        status: job.status,
        row_count: job.rowCount,
        filename: job.filename,
        error_code: job.errorCode || null,
        error_message: job.errorMessage || null,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        started_at: job.startedAt || null,
        completed_at: job.completedAt || null,
        expires_at: job.expiresAt,
        download_url: await signedDownloadUrl(c, job),
        metadata: job.metadata,
    };
}

async function createJob(
    c: ExportContext,
    input: {
        type: ExportJobType;
        actorId: string;
        storeIds: string[];
        filename: string;
        sourceKey?: string | null;
        metadata?: Record<string, unknown>;
    },
): Promise<ExportJobRecord> {
    assertExportStorage(c);
    exportSigningSecret(c);

    const id = crypto.randomUUID();
    const createdAt = nowIso();
    const job: ExportJobRecord = {
        id,
        type: input.type,
        status: 'queued',
        actorId: input.actorId,
        storeIds: input.storeIds,
        filename: input.filename,
        resultKey: exportResultKey(id, input.filename),
        sourceKey: input.sourceKey || null,
        rowCount: 0,
        errorCode: null,
        errorMessage: null,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: null,
        expiresAt: expiresAtIso(),
        metadata: input.metadata || {},
    };

    return writeJob(c, job);
}

async function streamCsvToR2(
    bucket: R2Bucket,
    key: string,
    filename: string,
    writeRows: (writeLine: (line: string) => Promise<void>) => Promise<number>,
): Promise<number> {
    // R2 rejects a generated TransformStream whose total length is unknown.
    // Keep one 5 MiB part in memory; upload parts serially with known lengths.
    const partSize = 5 * 1024 * 1024;
    const encoder = new TextEncoder();
    let buffer = new Uint8Array(partSize);
    let used = 0;
    let upload: R2MultipartUpload | null = null;
    const parts: R2UploadedPart[] = [];
    const httpMetadata = { contentType: 'text/csv; charset=utf-8', contentDisposition: `attachment; filename="${filename}"` };
    const flush = async () => {
        upload ||= await bucket.createMultipartUpload(key, { httpMetadata });
        if (parts.length >= 10_000) throw new Error('Export exceeds the storage part limit');
        parts.push(await upload.uploadPart(parts.length + 1, buffer.subarray(0, used)));
        used = 0;
    };
    try {
        const rowCount = await writeRows(async line => {
            const bytes = encoder.encode(`${line}\n`);
            let offset = 0;
            while (offset < bytes.length) {
                const length = Math.min(partSize - used, bytes.length - offset);
                buffer.set(bytes.subarray(offset, offset + length), used);
                used += length;
                offset += length;
                if (used === partSize) await flush();
            }
        });
        if (upload) {
            if (used > 0) await flush();
            await (upload as R2MultipartUpload).complete(parts);
        } else {
            const object = await bucket.put(key, buffer.subarray(0, used), { httpMetadata });
            if (!object) throw new Error('Export result was not stored');
        }
        return rowCount;
    } catch (error) {
        if (upload) await (upload as R2MultipartUpload).abort().catch(() => undefined);
        throw error;
    } finally {
        buffer = new Uint8Array(0);
    }
}

async function processProductsExport(c: ExportContext, jobId: string): Promise<void> {
    const initialJob = await readJob(c, jobId);
    if (!initialJob) return;
    let job = await updateJob(c, initialJob, { status: 'running', startedAt: nowIso() });

    try {
        const bucket = assertExportStorage(c);
        const db = getSupabaseAdmin(c);
        const rowCount = await streamCsvToR2(bucket, job.resultKey, job.filename, async (writeLine) => {
            await writeLine(toCsvRow([...PRODUCT_EXPORT_HEADERS]));
            if (job.storeIds.length === 0) return 0;

            let from = 0;
            let exported = 0;
            while (true) {
                const { data, error } = await db
                    .from('products')
                    .select(PRODUCT_EXPORT_SELECT)
                    .in('store_id', job.storeIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: true })
                    .range(from, from + EXPORT_BATCH_SIZE - 1);

                if (error) throw new Error(error.message);
                const rows = (data || []) as unknown as ProductExportRow[];
                for (const product of rows) {
                    await writeLine(toCsvRow([
                        product.id,
                        product.name,
                        product.description,
                        product.price,
                        product.compare_price,
                        product.category,
                        product.stock,
                        product.is_active,
                        product.is_featured,
                        (product.tags || []).join(';'),
                        (product.images || []).join(';'),
                        product.created_at,
                    ]));
                }
                exported += rows.length;
                if (rows.length < EXPORT_BATCH_SIZE) return exported;
                from += EXPORT_BATCH_SIZE;
            }
        });

        job = await updateJob(c, job, { status: 'completed', rowCount, completedAt: nowIso() });
        await writeJob(c, job);
    } catch (error) {
        await updateJob(c, job, {
            status: 'failed',
            errorCode: 'EXPORT_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Export failed',
            completedAt: nowIso(),
        });
    }
}

async function processOrdersExport(c: ExportContext, jobId: string): Promise<void> {
    const initialJob = await readJob(c, jobId);
    if (!initialJob) return;
    let job = await updateJob(c, initialJob, { status: 'running', startedAt: nowIso() });

    try {
        const bucket = assertExportStorage(c);
        const db = getSupabaseAdmin(c);
        const status = stringValue(job.metadata.status);
        const rowCount = await streamCsvToR2(bucket, job.resultKey, job.filename, async (writeLine) => {
            await writeLine(toCsvRow([...ORDER_EXPORT_HEADERS]));
            if (job.storeIds.length === 0) return 0;

            let from = 0;
            let exported = 0;
            while (true) {
                let query = db
                    .from('orders')
                    .select(ORDER_EXPORT_SELECT)
                    .in('store_id', job.storeIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: true })
                    .range(from, from + EXPORT_BATCH_SIZE - 1);

                if (status) query = query.eq('status', status);

                const { data, error } = await query;
                if (error) throw new Error(error.message);
                const rows = (data || []) as OrderExportRow[];
                for (const order of rows) {
                    await writeLine(toCsvRow([
                        order.order_number,
                        order.status,
                        order.customer_name,
                        order.customer_email,
                        order.customer_phone,
                        order.subtotal,
                        order.shipping_cost,
                        order.discount,
                        order.total,
                        order.payment_method,
                        order.payment_status,
                        order.tracking_number,
                        order.carrier,
                        order.created_at,
                    ]));
                }
                exported += rows.length;
                if (rows.length < EXPORT_BATCH_SIZE) return exported;
                from += EXPORT_BATCH_SIZE;
            }
        });

        job = await updateJob(c, job, { status: 'completed', rowCount, completedAt: nowIso() });
        await writeJob(c, job);
    } catch (error) {
        await updateJob(c, job, {
            status: 'failed',
            errorCode: 'EXPORT_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Export failed',
            completedAt: nowIso(),
        });
    }
}

async function processCustomersExport(c: ExportContext, jobId: string): Promise<void> {
    const initialJob = await readJob(c, jobId);
    if (!initialJob) return;
    let job = await updateJob(c, initialJob, { status: 'running', startedAt: nowIso() });

    try {
        const bucket = assertExportStorage(c);
        const db = getSupabaseAdmin(c);
        const rowCount = await streamCsvToR2(bucket, job.resultKey, job.filename, async (writeLine) => {
            await writeLine(toCsvRow([...CUSTOMER_EXPORT_HEADERS]));
            if (job.storeIds.length === 0) return 0;

            let from = 0;
            let exported = 0;
            while (true) {
                const { data, error } = await db
                    .from('store_customers')
                    .select(CUSTOMER_EXPORT_SELECT)
                    .in('store_id', job.storeIds)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: true })
                    .range(from, from + EXPORT_BATCH_SIZE - 1);

                if (error) throw new Error(error.message);
                const rows = (data || []) as CustomerExportRow[];
                for (const customer of rows) {
                    await writeLine(toCsvRow([
                        customer.id,
                        customer.email,
                        customer.full_name,
                        customer.phone,
                        customer.status,
                        customer.total_orders,
                        customer.total_spent,
                        customer.accepts_marketing,
                        (customer.tags || []).join(';'),
                        customer.last_order_at,
                        customer.last_login_at,
                        customer.created_at,
                        customer.updated_at,
                    ]));
                }
                exported += rows.length;
                if (rows.length < EXPORT_BATCH_SIZE) return exported;
                from += EXPORT_BATCH_SIZE;
            }
        });

        job = await updateJob(c, job, { status: 'completed', rowCount, completedAt: nowIso() });
        await writeJob(c, job);
    } catch (error) {
        await updateJob(c, job, {
            status: 'failed',
            errorCode: 'EXPORT_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Export failed',
            completedAt: nowIso(),
        });
    }
}

async function processProductImport(c: ExportContext, jobId: string): Promise<void> {
    const initialJob = await readJob(c, jobId);
    if (!initialJob || !initialJob.sourceKey) return;
    const sourceKey = initialJob.sourceKey;
    let job = await updateJob(c, initialJob, { status: 'running', startedAt: nowIso() });

    try {
        const source = await assertExportStorage(c).get(sourceKey);
        if (!source) throw new Error('Import source object not found');

        const inputs = productCsvInputs(await source.text(), job.storeIds[0]);
        const service = createProductExecutionAdapter(c);
        let imported = 0;
        for (const input of inputs) {
            await service.createProduct(input, job.actorId, job.storeIds[0]);
            imported += 1;
        }

        job = await updateJob(c, job, { status: 'completed', rowCount: imported, completedAt: nowIso() });
        await writeJob(c, job);
    } catch (error) {
        await updateJob(c, job, {
            status: 'failed',
            errorCode: 'IMPORT_FAILED',
            errorMessage: error instanceof Error ? error.message : 'Import failed',
            completedAt: nowIso(),
        });
    }
}

router.get('/jobs/:id', async (c) => {
    const job = await readAccessibleJob(c, c.req.param('id'));
    if (!job) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Export job not found' } }, 404);
    }
    return c.json(success({ job: await serializeJob(c, job) }), 200, { 'Cache-Control': 'private, no-store' });
});

router.get('/jobs/:id/download', async (c) => {
    const job = await readAccessibleJob(c, c.req.param('id'));
    if (!job) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Export job not found' } }, 404);
    }

    if (job.status !== 'completed') {
        return c.json({ error: { code: 'EXPORT_NOT_READY', message: 'Export result is not ready' } }, 409);
    }

    const token = c.req.query('token') || '';
    const expected = await signDownloadToken(c, job);
    if (!timingSafeEqualText(token, expected)) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid export download token' } }, 403);
    }

    const object = await assertExportStorage(c).get(job.resultKey);
    if (!object) {
        return c.json({ error: { code: 'EXPORT_RESULT_NOT_FOUND', message: 'Export result object was not found' } }, 404);
    }

    return new Response(object.body, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${job.filename}"`,
            'X-LetBuyy-Export-Job-ID': job.id,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
});

router.get('/products', async (c) => {
    try {
        const scope = await resolveExportScope(c, c.req.query('store_id'));
        if ('error' in scope) return scope.error;

        const job = await createJob(c, {
            type: 'products',
            actorId: scope.actorId,
            storeIds: scope.storeIds,
            filename: `products-${dateStamp()}.csv`,
            metadata: { processor: 'api-gateway.waitUntil', resultStorage: 'Cloudflare R2' },
        });

        c.executionCtx.waitUntil(processProductsExport(c, job.id));
        return c.json(success({ job: await serializeJob(c, job) }), 202);
    } catch {
        return c.json({ error: { code: 'EXPORT_UNAVAILABLE', message: 'Export unavailable' } }, 503);
    }
});

router.get('/orders', async (c) => {
    try {
        const scope = await resolveExportScope(c, c.req.query('store_id'));
        if ('error' in scope) return scope.error;

        const status = c.req.query('status') || null;
        const job = await createJob(c, {
            type: 'orders',
            actorId: scope.actorId,
            storeIds: scope.storeIds,
            filename: `orders-${dateStamp()}.csv`,
            metadata: { status, processor: 'api-gateway.waitUntil', resultStorage: 'Cloudflare R2' },
        });

        c.executionCtx.waitUntil(processOrdersExport(c, job.id));
        return c.json(success({ job: await serializeJob(c, job) }), 202);
    } catch {
        return c.json({ error: { code: 'EXPORT_UNAVAILABLE', message: 'Export unavailable' } }, 503);
    }
});

router.get('/customers', async (c) => {
    try {
        const scope = await resolveExportScope(c, c.req.query('store_id'));
        if ('error' in scope) return scope.error;

        const job = await createJob(c, {
            type: 'customers',
            actorId: scope.actorId,
            storeIds: scope.storeIds,
            filename: `customers-${dateStamp()}.csv`,
            metadata: { processor: 'api-gateway.waitUntil', resultStorage: 'Cloudflare R2' },
        });

        c.executionCtx.waitUntil(processCustomersExport(c, job.id));
        return c.json(success({ job: await serializeJob(c, job) }), 202);
    } catch {
        return c.json({ error: { code: 'EXPORT_UNAVAILABLE', message: 'Export unavailable' } }, 503);
    }
});

router.post('/import-products', async (c) => {
    try {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const parsed = ProductCsvImportSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) {
            return c.json({ error: { code: 'VALIDATION', message: 'store_id and csv string required' } }, 400);
        }
        const { store_id: storeId, csv } = parsed.data;

        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const inputs = productCsvInputs(csv, storeId);

        const sourceJobId = crypto.randomUUID();
        const sourceKey = exportSourceKey(sourceJobId);
        await assertExportStorage(c).put(sourceKey, csv, {
            httpMetadata: { contentType: 'text/csv; charset=utf-8' },
        });

        const job = await createJob(c, {
            type: 'product_import',
            actorId: customUser.id,
            storeIds: [storeId],
            filename: `product-import-${dateStamp()}.csv`,
            sourceKey,
            metadata: {
                requestedRows: inputs.length,
                processor: 'api-gateway.waitUntil',
                sourceStorage: 'Cloudflare R2',
            },
        });

        c.executionCtx.waitUntil(processProductImport(c, job.id));
        return c.json(success({ job: await serializeJob(c, job) }), 202);
    } catch (error) {
        if (error instanceof CsvInputError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
        return c.json({ error: { code: 'IMPORT_UNAVAILABLE', message: 'Import unavailable' } }, 503);
    }
});

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null);

    if (sessionStoreId) query = query.eq('id', sessionStoreId);

    const { data, error } = await query;
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
