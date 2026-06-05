import type { Context } from 'hono';
import type { Env } from '../index';
import type { GraphQLBulkOperationStatus, GraphQLBulkOperationType } from '@letbuyy/shared-types';

type GatewayContext = Context<{ Bindings: Env }>;
type JsonObject = Record<string, unknown>;
type GraphQLVariables = Record<string, unknown>;

export type GraphQLBulkRestDelegate = (c: GatewayContext, request: Request) => Promise<Response>;

export interface GraphQLBulkOperationRecord {
    id: string;
    storeId: string | null;
    apiSurface: 'admin' | 'storefront';
    operationType: GraphQLBulkOperationType;
    status: GraphQLBulkOperationStatus;
    query: string;
    variables: GraphQLVariables;
    inputUrl: string | null;
    resultUrl: string | null;
    objectCount: number;
    fileSizeBytes: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    idempotencyKey: string | null;
    createdAt: string;
    updatedAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    expiresAt: string | null;
    metadata: JsonObject;
}

interface CreateBulkOperationInput {
    operationType: GraphQLBulkOperationType;
    query: string;
    variables?: GraphQLVariables;
    stagedUploadPath?: string | null;
    idempotencyKey?: string | null;
}

interface BulkOperationIndex {
    operations: GraphQLBulkOperationRecord[];
}

interface BulkExecutionResult {
    jsonl: string;
    objectCount: number;
}

export class GraphQLBulkOperationError extends Error {
    constructor(
        message: string,
        readonly code = 'BULK_OPERATION_ERROR',
        readonly field?: string,
    ) {
        super(message);
    }
}

export function isGraphQLBulkOperationError(error: unknown): error is GraphQLBulkOperationError {
    return error instanceof GraphQLBulkOperationError;
}

export const GRAPHQL_BULK_OPERATION_R2_PREFIX = 'graphql-bulk';
export const GRAPHQL_BULK_OPERATION_QUEUE_NAME = 'graphql-bulk';
export const GRAPHQL_BULK_OPERATION_QUEUE_JOB_TYPE = 'graphql.bulk.operation';
export const GRAPHQL_BULK_OPERATION_CONCURRENCY_CAP = 2;

function recordValue(value: unknown): JsonObject | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonObject
        : null;
}

function arrayValue(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nowIso(): string {
    return new Date().toISOString();
}

function expiresAtIso(): string {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function stableHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

function actorId(c: GatewayContext): string {
    return c.get('auth')?.user.id || 'anonymous';
}

function actorStoreId(c: GatewayContext): string | null {
    return c.get('auth')?.user.storeId || null;
}

function actorIndexKey(c: GatewayContext): string {
    return `${GRAPHQL_BULK_OPERATION_R2_PREFIX}/indexes/${actorId(c)}.json`;
}

function operationKey(operationId: string): string {
    return `${GRAPHQL_BULK_OPERATION_R2_PREFIX}/operations/${operationId}.json`;
}

function resultKey(operationId: string): string {
    return `${GRAPHQL_BULK_OPERATION_R2_PREFIX}/results/${operationId}.jsonl`;
}

function normalizedR2Path(path: string): string {
    return path.replace(/^\/+/, '');
}

function resultUrl(c: GatewayContext, operationId: string): string {
    const url = new URL(c.req.url);
    url.pathname = `/v1/admin/graphql/bulk/${operationId}/result`;
    url.search = '';
    return url.toString();
}

function assertBulkStorage(c: GatewayContext): R2Bucket {
    if (!c.env.R2_BUCKET) {
        throw new GraphQLBulkOperationError('GraphQL bulk operations require the R2_BUCKET binding.', 'BULK_STORAGE_UNAVAILABLE', 'bulkOperation');
    }
    return c.env.R2_BUCKET;
}

async function readJsonObject<T>(bucket: R2Bucket, key: string, fallback: T): Promise<T> {
    const object = await bucket.get(key);
    if (!object) return fallback;

    try {
        const parsed = JSON.parse(await object.text()) as unknown;
        const record = recordValue(parsed);
        return record ? record as unknown as T : fallback;
    } catch {
        return fallback;
    }
}

async function writeJsonObject(bucket: R2Bucket, key: string, value: JsonObject): Promise<void> {
    await bucket.put(key, JSON.stringify(value), {
        httpMetadata: { contentType: 'application/json' },
    });
}

async function readIndex(c: GatewayContext): Promise<BulkOperationIndex> {
    const bucket = assertBulkStorage(c);
    const index = await readJsonObject<BulkOperationIndex>(bucket, actorIndexKey(c), { operations: [] });
    const operations: GraphQLBulkOperationRecord[] = [];
    for (const entry of arrayValue(index.operations)) {
        const operation = recordValue(entry);
        if (stringValue(operation?.id) && stringValue(operation?.status)) {
            operations.push(operation as unknown as GraphQLBulkOperationRecord);
        }
    }

    return {
        operations,
    };
}

async function writeIndex(c: GatewayContext, operations: GraphQLBulkOperationRecord[]): Promise<void> {
    const bucket = assertBulkStorage(c);
    await writeJsonObject(bucket, actorIndexKey(c), {
        operations: operations
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, 50),
    });
}

async function writeOperation(c: GatewayContext, operation: GraphQLBulkOperationRecord): Promise<GraphQLBulkOperationRecord> {
    const bucket = assertBulkStorage(c);
    const updated = {
        ...operation,
        updatedAt: nowIso(),
    };
    await writeJsonObject(bucket, operationKey(operation.id), updated as unknown as JsonObject);
    return updated;
}

async function updateOperation(
    c: GatewayContext,
    operation: GraphQLBulkOperationRecord,
    patch: Partial<GraphQLBulkOperationRecord>,
): Promise<GraphQLBulkOperationRecord> {
    return writeOperation(c, { ...operation, ...patch });
}

function canAccessOperation(c: GatewayContext, operation: GraphQLBulkOperationRecord): boolean {
    const metadata = recordValue(operation.metadata);
    return stringValue(metadata?.actorId) === actorId(c);
}

export async function getGraphQLBulkOperation(c: GatewayContext, operationId: string): Promise<GraphQLBulkOperationRecord | null> {
    const bucket = assertBulkStorage(c);
    const operation = await readJsonObject<GraphQLBulkOperationRecord>(bucket, operationKey(operationId), {} as GraphQLBulkOperationRecord);
    if (!operation.id || !canAccessOperation(c, operation)) return null;
    return operation;
}

export async function listGraphQLBulkOperations(c: GatewayContext): Promise<GraphQLBulkOperationRecord[]> {
    const bucket = assertBulkStorage(c);
    const index = await readIndex(c);
    const operations = await Promise.all(index.operations.map((entry) => (
        readJsonObject<GraphQLBulkOperationRecord>(bucket, operationKey(entry.id), entry)
    )));
    return operations.filter((operation) => operation.id && canAccessOperation(c, operation));
}

export async function currentGraphQLBulkOperation(
    c: GatewayContext,
    operationType?: GraphQLBulkOperationType | null,
): Promise<GraphQLBulkOperationRecord | null> {
    const operations = await listGraphQLBulkOperations(c);
    return operations.find((operation) => {
        const active = operation.status === 'queued' || operation.status === 'running';
        return active && (!operationType || operation.operationType === operationType);
    }) || null;
}

function cloneBulkHeaders(c: GatewayContext, extra?: Record<string, string>): Headers {
    const headers = new Headers(extra);
    const names = [
        'Authorization',
        'Cookie',
        'X-CSRF-Token',
        'X-LetBuyy-CSRF-Token',
        'X-LetBuyy-Internal-User-ID',
        'X-LetBuyy-Internal-Email',
        'X-LetBuyy-Internal-Store-ID',
        'X-LetBuyy-Internal-Timestamp',
        'X-LetBuyy-Internal-Signature',
        'X-LetBuyy-Internal-Session-Token',
        'X-Request-ID',
        'X-Trace-ID',
        'X-Store-ID',
        'X-LetBuyy-API-Version',
        'LetBuyy-API-Version',
    ];

    for (const name of names) {
        const value = c.req.header(name);
        if (value) headers.set(name, value);
    }

    return headers;
}

async function executeGraphQLDocument(
    c: GatewayContext,
    delegate: GraphQLBulkRestDelegate,
    document: string,
    variables: GraphQLVariables,
    operationId: string,
): Promise<JsonObject> {
    const url = new URL(c.req.url);
    url.pathname = '/v1/admin/graphql';
    url.search = '';

    const response = await delegate(c, new Request(url.toString(), {
        method: 'POST',
        headers: cloneBulkHeaders(c, {
            'Content-Type': 'application/json',
            'X-LetBuyy-Bulk-Operation-ID': operationId,
        }),
        body: JSON.stringify({ query: document, variables }),
    }));

    const payload = await response.json().catch(() => null) as unknown;
    const record = recordValue(payload);
    if (!response.ok || !record) {
        throw new GraphQLBulkOperationError('Bulk GraphQL execution failed.', 'BULK_GRAPHQL_EXECUTION_FAILED');
    }

    return record;
}

function rowsFromGraphQLData(data: unknown): unknown[] {
    const record = recordValue(data);
    if (!record) return data === null || data === undefined ? [] : [data];

    const rows: unknown[] = [];
    for (const [key, value] of Object.entries(record)) {
        if (key === 'queryCost') continue;
        const nested = recordValue(value);
        const nodes = arrayValue(nested?.nodes);
        if (nodes.length > 0) {
            rows.push(...nodes);
            continue;
        }
        const directRows = arrayValue(value);
        if (directRows.length > 0) {
            rows.push(...directRows);
            continue;
        }
        if (value !== null && value !== undefined) rows.push(value);
    }

    return rows;
}

async function executeBulkQuery(
    c: GatewayContext,
    delegate: GraphQLBulkRestDelegate,
    operation: GraphQLBulkOperationRecord,
): Promise<BulkExecutionResult> {
    const payload = await executeGraphQLDocument(c, delegate, operation.query, operation.variables, operation.id);
    const errors = arrayValue(payload.errors);
    if (errors.length > 0) {
        throw new GraphQLBulkOperationError('Bulk query returned GraphQL errors.', 'BULK_GRAPHQL_QUERY_FAILED');
    }

    const rows = rowsFromGraphQLData(payload.data);
    return {
        jsonl: rows.map((row) => JSON.stringify(row)).join('\n'),
        objectCount: rows.length,
    };
}

async function mutationInputRows(c: GatewayContext, operation: GraphQLBulkOperationRecord): Promise<unknown[]> {
    const stagedPath = stringValue(recordValue(operation.metadata)?.stagedUploadPath);
    if (stagedPath) {
        const object = await assertBulkStorage(c).get(normalizedR2Path(stagedPath));
        if (!object) {
            throw new GraphQLBulkOperationError('Bulk mutation staged upload was not found in R2.', 'BULK_STAGED_UPLOAD_NOT_FOUND');
        }
        return (await object.text())
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => JSON.parse(line) as unknown);
    }

    const records = arrayValue(operation.variables.records);
    return records.length > 0 ? records : [operation.variables];
}

async function executeBulkMutation(
    c: GatewayContext,
    delegate: GraphQLBulkRestDelegate,
    operation: GraphQLBulkOperationRecord,
): Promise<BulkExecutionResult> {
    const rows = await mutationInputRows(c, operation);
    void delegate;
    throw new GraphQLBulkOperationError(
        `Bulk GraphQL mutations require direct execution adapters before processing ${rows.length} input rows.`,
        'BULK_MUTATION_DIRECT_EXECUTION_REQUIRED',
        'bulkOperationRunMutation',
    );
}

async function processGraphQLBulkOperation(
    c: GatewayContext,
    delegate: GraphQLBulkRestDelegate,
    operationId: string,
): Promise<void> {
    const existing = await getGraphQLBulkOperation(c, operationId);
    if (!existing || existing.status === 'cancelled') return;

    let operation = await updateOperation(c, existing, {
        status: 'running',
        startedAt: existing.startedAt || nowIso(),
        errorCode: null,
        errorMessage: null,
    });

    try {
        const result = operation.operationType === 'query'
            ? await executeBulkQuery(c, delegate, operation)
            : await executeBulkMutation(c, delegate, operation);
        const key = resultKey(operation.id);
        await assertBulkStorage(c).put(key, result.jsonl, {
            httpMetadata: { contentType: 'application/x-ndjson; charset=utf-8' },
            customMetadata: {
                operation_id: operation.id,
                operation_type: operation.operationType,
            },
        });
        const fileSizeBytes = new TextEncoder().encode(result.jsonl).byteLength;
        operation = await updateOperation(c, operation, {
            status: 'completed',
            resultUrl: resultUrl(c, operation.id),
            objectCount: result.objectCount,
            fileSizeBytes,
            completedAt: nowIso(),
        });
    } catch (error) {
        const failure = error instanceof GraphQLBulkOperationError
            ? error
            : new GraphQLBulkOperationError('Bulk operation execution failed.', 'BULK_OPERATION_FAILED');
        await updateOperation(c, operation, {
            status: 'failed',
            errorCode: failure.code,
            errorMessage: failure.message,
            completedAt: nowIso(),
        });
    }
}

export async function createGraphQLBulkOperation(
    c: GatewayContext,
    delegate: GraphQLBulkRestDelegate,
    input: CreateBulkOperationInput,
): Promise<GraphQLBulkOperationRecord> {
    const bucket = assertBulkStorage(c);
    if (/\bbulkOperationRun(Query|Mutation)\b/.test(input.query)) {
        throw new GraphQLBulkOperationError('Bulk operations cannot enqueue nested bulk operations.', 'BULK_OPERATION_NESTED_UNSUPPORTED');
    }

    const index = await readIndex(c);
    const idempotencyKey = input.idempotencyKey || c.req.header('X-Idempotency-Key') || null;
    const idempotentMatch = idempotencyKey
        ? index.operations.find((operation) => operation.idempotencyKey === idempotencyKey)
        : null;
    if (idempotentMatch) return idempotentMatch;

    const activeCount = index.operations.filter((operation) => (
        operation.operationType === input.operationType
            && (operation.status === 'queued' || operation.status === 'running')
    )).length;
    if (activeCount >= GRAPHQL_BULK_OPERATION_CONCURRENCY_CAP) {
        throw new GraphQLBulkOperationError('Too many active GraphQL bulk operations for this actor.', 'BULK_OPERATION_CONCURRENCY_LIMIT');
    }

    const createdAt = nowIso();
    const operation: GraphQLBulkOperationRecord = {
        id: crypto.randomUUID(),
        storeId: actorStoreId(c),
        apiSurface: 'admin',
        operationType: input.operationType,
        status: 'queued',
        query: input.query,
        variables: input.variables || {},
        inputUrl: input.stagedUploadPath || null,
        resultUrl: null,
        objectCount: 0,
        fileSizeBytes: null,
        errorCode: null,
        errorMessage: null,
        idempotencyKey,
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: null,
        expiresAt: expiresAtIso(),
        metadata: {
            actorId: actorId(c),
            processor: 'api-gateway.waitUntil',
            processingPath: 'api-gateway.waitUntil',
            statusKey: operationKey('pending'),
            resultKey: resultKey('pending'),
            stagedUploadPath: input.stagedUploadPath || null,
            concurrencyCap: GRAPHQL_BULK_OPERATION_CONCURRENCY_CAP,
            resultStorage: 'Cloudflare R2',
        },
    };
    operation.metadata = {
        ...operation.metadata,
        statusKey: operationKey(operation.id),
        resultKey: resultKey(operation.id),
    };

    await writeJsonObject(bucket, operationKey(operation.id), operation as unknown as JsonObject);
    await writeIndex(c, [operation, ...index.operations]);

    c.executionCtx.waitUntil(processGraphQLBulkOperation(c, delegate, operation.id));
    return operation;
}

export async function cancelGraphQLBulkOperation(c: GatewayContext, operationId: string): Promise<GraphQLBulkOperationRecord> {
    const operation = await getGraphQLBulkOperation(c, operationId);
    if (!operation) {
        throw new GraphQLBulkOperationError('Bulk operation not found.', 'BULK_OPERATION_NOT_FOUND', 'bulkOperationCancel');
    }
    if (operation.status === 'completed' || operation.status === 'failed' || operation.status === 'expired') {
        return operation;
    }
    return updateOperation(c, operation, {
        status: 'cancelled',
        completedAt: nowIso(),
    });
}

export async function readGraphQLBulkOperationResult(c: GatewayContext, operationId: string): Promise<Response> {
    const operation = await getGraphQLBulkOperation(c, operationId);
    if (!operation) {
        return c.json({ errors: [{ message: 'Bulk operation not found.', extensions: { code: 'BULK_OPERATION_NOT_FOUND' } }] }, 404);
    }
    if (operation.status !== 'completed') {
        return c.json({ errors: [{ message: 'Bulk operation result is not ready.', extensions: { code: 'BULK_OPERATION_RESULT_NOT_READY' } }] }, 409);
    }
    const object = await assertBulkStorage(c).get(resultKey(operation.id));
    if (!object) {
        return c.json({ errors: [{ message: 'Bulk operation result object was not found.', extensions: { code: 'BULK_OPERATION_RESULT_NOT_FOUND' } }] }, 404);
    }

    return new Response(object.body, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Content-Disposition': `attachment; filename="letbuyy-bulk-${operation.id}.jsonl"`,
            'X-LetBuyy-Bulk-Operation-ID': operation.id,
        },
    });
}
