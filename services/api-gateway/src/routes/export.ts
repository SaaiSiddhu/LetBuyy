import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { timingSafeEqualText } from '../lib/crypto';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { ProductExecutionAdapter, isProductVariantDiffEnabled } from '../execution/product-execution.adapter';

const router = new Hono<{ Bindings: Env }>();

type ExportContext = Context<{ Bindings: Env }>;
type ExportJobType = 'products' | 'orders' | 'product_import';
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
const PRODUCT_EXPORT_SELECT = PRODUCT_EXPORT_HEADERS.join(',');
const ORDER_EXPORT_SELECT = ORDER_EXPORT_HEADERS.join(',');
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
    const secret = c.env.INTERNAL_API_SECRET || c.env.CUSTOMER_SESSION_SECRET || c.env.AUTH_SECRET;
    if (!secret) throw new Error('CSV export jobs require a signing secret.');
    return secret;
}

function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
    return values
        .map(v => {
            if (v == null) return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        })
        .join(',');
}

function parseCsv(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
        const result: string[] = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { currentField += '"'; i++; }
                else if (ch === '"') { inQuotes = false; }
                else { currentField += ch; }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { result.push(currentField.trim()); currentField = ''; }
                else { currentField += ch; }
            }
        }
        result.push(currentField.trim());
        return result;
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
    const encoder = new TextEncoder();
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();

    const writePromise = (async () => {
        try {
            const rowCount = await writeRows(async (line) => {
                await writer.write(encoder.encode(`${line}\n`));
            });
            await writer.close();
            return rowCount;
        } catch (error) {
            await writer.abort(error);
            throw error;
        }
    })();

    const putPromise = bucket.put(key, stream.readable, {
        httpMetadata: {
            contentType: 'text/csv; charset=utf-8',
            contentDisposition: `attachment; filename="${filename}"`,
        },
    });

    const [rowCount] = await Promise.all([writePromise, putPromise]);
    return rowCount;
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
                    .order('created_at', { ascending: false })
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
                    .order('created_at', { ascending: false })
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

async function processProductImport(c: ExportContext, jobId: string): Promise<void> {
    const initialJob = await readJob(c, jobId);
    if (!initialJob || !initialJob.sourceKey) return;
    const sourceKey = initialJob.sourceKey;
    let job = await updateJob(c, initialJob, { status: 'running', startedAt: nowIso() });

    try {
        const source = await assertExportStorage(c).get(sourceKey);
        if (!source) throw new Error('Import source object not found');

        const rows = parseCsv(await source.text());
        const headers = rows[0]?.map(h => h.toLowerCase().trim()) || [];
        const nameIdx = headers.indexOf('name');
        const priceIdx = headers.indexOf('price');
        const descIdx = headers.indexOf('description');
        const categoryIdx = headers.indexOf('category');
        const stockIdx = headers.indexOf('stock');
        const tagsIdx = headers.indexOf('tags');
        const imagesIdx = headers.indexOf('images');

        if (nameIdx === -1) throw new Error('CSV must have a "name" column');

        const service = createProductExecutionAdapter(c);
        let imported = 0;

        for (const row of rows.slice(1)) {
            await service.createProduct({
                store_id: job.storeIds[0],
                name: row[nameIdx] || 'Unnamed Product',
                description: descIdx >= 0 ? row[descIdx] || '' : '',
                price: priceIdx >= 0 ? parseFloat(row[priceIdx]) || 0 : 0,
                category: categoryIdx >= 0 ? row[categoryIdx] || undefined : undefined,
                stock: stockIdx >= 0 ? parseInt(row[stockIdx]) || 0 : 0,
                tags: tagsIdx >= 0 && row[tagsIdx] ? row[tagsIdx].split(';').map(t => t.trim()).filter(Boolean) : [],
                images: imagesIdx >= 0 && row[imagesIdx] ? row[imagesIdx].split(';').map(u => u.trim()).filter(Boolean) : [],
                is_active: true,
            }, job.actorId, job.storeIds[0]);
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
    return c.json(success({ job: await serializeJob(c, job) }));
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
    } catch (error) {
        return c.json({ error: { code: 'EXPORT_UNAVAILABLE', message: error instanceof Error ? error.message : 'Export unavailable' } }, 503);
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
    } catch (error) {
        return c.json({ error: { code: 'EXPORT_UNAVAILABLE', message: error instanceof Error ? error.message : 'Export unavailable' } }, 503);
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

        const body = recordValue(await c.req.json());
        const storeId = stringValue(body?.store_id);
        const csv = stringValue(body?.csv);

        if (!storeId || !csv) {
            return c.json({ error: { code: 'VALIDATION', message: 'store_id and csv string required' } }, 400);
        }

        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const rows = parseCsv(csv);
        if (rows.length < 2) {
            return c.json({ error: { code: 'VALIDATION', message: 'CSV must have headers + at least one row' } }, 400);
        }

        const importRows = rows.slice(1);
        if (importRows.length > PRODUCT_IMPORT_MAX_ROWS) {
            return c.json({
                error: {
                    code: 'IMPORT_TOO_LARGE',
                    message: `Product CSV imports are capped at ${PRODUCT_IMPORT_MAX_ROWS} rows per job`,
                },
            }, 413);
        }

        const headers = rows[0].map(h => h.toLowerCase().trim());
        if (!headers.includes('name')) {
            return c.json({ error: { code: 'VALIDATION', message: 'CSV must have a "name" column' } }, 400);
        }

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
                requestedRows: importRows.length,
                processor: 'api-gateway.waitUntil',
                sourceStorage: 'Cloudflare R2',
            },
        });

        c.executionCtx.waitUntil(processProductImport(c, job.id));
        return c.json(success({ job: await serializeJob(c, job) }), 202);
    } catch (error) {
        return c.json({ error: { code: 'IMPORT_UNAVAILABLE', message: error instanceof Error ? error.message : 'Import unavailable' } }, 503);
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
