import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { checkQueryCostRateLimitKey, type QueryCostRateLimitResult } from '../middleware/rateLimit';
import {
    cancelGraphQLBulkOperation,
    createGraphQLBulkOperation,
    currentGraphQLBulkOperation,
    getGraphQLBulkOperation,
    isGraphQLBulkOperationError,
    listGraphQLBulkOperations,
    readGraphQLBulkOperationResult,
} from './bulk';
import { calculateGraphQLQueryCost } from './cost';
import { createRestShimRequest, readRestShimEnvelope, type RestShimEnvelope } from './rest-shim';
import type { GraphQLBulkOperationType } from '@letbuyy/shared-types';

type GatewayContext = Context<{ Bindings: Env }>;
type JsonObject = Record<string, unknown>;
type GraphQLVariables = Record<string, unknown>;

export type AdminGraphQLRestDelegate = (c: GatewayContext, request: Request) => Promise<Response>;

export interface AdminGraphQLRouterOptions {
    restDelegate: AdminGraphQLRestDelegate;
}

interface GraphQLRequestPayload {
    query: string;
    variables?: GraphQLVariables;
    operationName?: string | null;
}

type RestEnvelope = RestShimEnvelope;

const GraphQLRequestPayloadSchema = z.object({
    query: z.string().trim().min(1).max(500_000),
    variables: z.record(z.string(), z.unknown()).optional().nullable(),
    operationName: z.string().trim().min(1).max(120).optional().nullable(),
}).strict();

class AdminGraphQLError extends Error {
    constructor(
        message: string,
        readonly code = 'GRAPHQL_EXECUTION_ERROR',
        readonly field?: string,
    ) {
        super(message);
    }
}

function graphQLError(message: string, code: string, field?: string) {
    return {
        message,
        extensions: {
            code,
            ...(field ? { field } : {}),
        },
    };
}

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

function numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function booleanValue(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function stableHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

function hasField(document: string, fieldName: string): boolean {
    return new RegExp(`\\b${fieldName}\\b`).test(document);
}

function readStringArgument(document: string, fieldName: string, argumentName: string): string | null {
    const match = new RegExp(`\\b${fieldName}\\s*\\([^)]*\\b${argumentName}\\s*:\\s*"([^"]+)"`, 'i').exec(document);
    return match?.[1] || null;
}

function readIdentifierArgument(document: string, fieldName: string, argumentName: string): string | null {
    return readStringArgument(document, fieldName, argumentName)
        || new RegExp(`\\b${fieldName}\\s*\\([^)]*\\b${argumentName}\\s*:\\s*([A-Za-z_][A-Za-z0-9_]*)`, 'i').exec(document)?.[1]
        || null;
}

function fieldVariables(variables: GraphQLVariables | undefined, fieldName: string): JsonObject | null {
    return recordValue(variables?.[fieldName]);
}

function variableString(variables: GraphQLVariables | undefined, keys: string[]): string | null {
    for (const key of keys) {
        const direct = stringValue(variables?.[key]);
        if (direct) return direct;

        for (const fieldName of ['store', 'product', 'order', 'customer', 'theme', 'collection']) {
            const nested = fieldVariables(variables, fieldName);
            const value = stringValue(nested?.[key]);
            if (value) return value;
        }
    }
    return null;
}

function variableRecord(variables: GraphQLVariables | undefined, keys: string[]): JsonObject | null {
    for (const key of keys) {
        const direct = recordValue(variables?.[key]);
        if (direct) return direct;
    }
    return null;
}

function storeIdFromVariables(c: GatewayContext, variables: GraphQLVariables | undefined): string | null {
    const direct = variableString(variables, ['storeId', 'store_id']);
    if (direct) return direct;

    const filter = variableRecord(variables, ['filter']);
    const filtered = stringValue(filter?.storeId) || stringValue(filter?.store_id);
    if (filtered) return filtered;

    return c.get('auth')?.user.storeId || null;
}

function firstFromVariables(variables: GraphQLVariables | undefined, fieldName: string): number {
    const field = fieldVariables(variables, fieldName);
    const direct = numberValue(variables?.first);
    const nested = numberValue(field?.first);
    const connection = numberValue(recordValue(variables?.connection)?.first);
    return Math.max(1, Math.min(direct ?? nested ?? connection ?? 20, 100));
}

function afterFromVariables(variables: GraphQLVariables | undefined, fieldName: string): string | null {
    const field = fieldVariables(variables, fieldName);
    return stringValue(variables?.after)
        || stringValue(field?.after)
        || stringValue(recordValue(variables?.connection)?.after);
}

function decodeCursor(cursor: string | null): number {
    if (!cursor) return 0;
    try {
        const decoded = atob(cursor);
        const match = /^offset:(\d+)$/.exec(decoded);
        return match?.[1] ? Number.parseInt(match[1], 10) : 0;
    } catch {
        return 0;
    }
}

function encodeCursor(offset: number): string {
    return btoa(`offset:${Math.max(0, offset)}`);
}

function connectionPagination(variables: GraphQLVariables | undefined, fieldName: string) {
    const limit = firstFromVariables(variables, fieldName);
    const offset = decodeCursor(afterFromVariables(variables, fieldName));
    const page = Math.floor(offset / limit) + 1;
    return { limit, offset, page };
}

function asQueryValue(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return null;
}

function appendFilterParams(params: URLSearchParams, filter: JsonObject | null | undefined) {
    if (!filter) return;
    const mapping: Record<string, string> = {
        storeId: 'store_id',
        store_id: 'store_id',
        status: 'status',
        search: 'search',
        category: 'category',
        vendor: 'vendor',
        productType: 'product_type',
        product_type: 'product_type',
        tag: 'tag',
        paymentStatus: 'payment_status',
        payment_status: 'payment_status',
        fulfillmentStatus: 'fulfillment_status',
        fulfillment_status: 'fulfillment_status',
        customerId: 'customer_id',
        customer_id: 'customer_id',
    };

    for (const [sourceKey, targetKey] of Object.entries(mapping)) {
        const queryValue = asQueryValue(filter[sourceKey]);
        if (queryValue) params.set(targetKey, queryValue.toLowerCase());
    }
}

function cloneGatewayHeaders(c: GatewayContext): Headers {
    const headers = new Headers();
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

async function readRestEnvelope(response: Response, fieldName: string): Promise<RestEnvelope> {
    return readRestShimEnvelope(response, fieldName, (message, code, field) => new AdminGraphQLError(message, code, field));
}

async function restGet(
    c: GatewayContext,
    delegate: AdminGraphQLRestDelegate,
    path: string,
    params?: URLSearchParams,
    fieldName = path,
): Promise<RestEnvelope> {
    const response = await delegate(c, createRestShimRequest(c, path, params, cloneGatewayHeaders(c)));

    return readRestEnvelope(response, fieldName);
}

function queryCostExtension(cost: number, limit?: QueryCostRateLimitResult) {
    return {
        requested: cost,
        actual: limit?.cost ?? cost,
        maximumAvailable: limit?.limit ?? 200,
        currentlyAvailable: limit?.remaining ?? Math.max(0, 200 - cost),
        restoreRate: 20,
        policy: limit?.policy ?? '200;w=leaky;rate=20',
    };
}

function setRateLimitHeaders(c: GatewayContext, limit: QueryCostRateLimitResult) {
    c.header('X-RateLimit-Limit', String(limit.limit));
    c.header('X-RateLimit-Remaining', String(limit.remaining));
    c.header('X-RateLimit-Reset', String(limit.resetAt));
    c.header('X-RateLimit-Cost', String(limit.cost));
    c.header('X-RateLimit-Policy', limit.policy);
}

function connectionFromEnvelope(envelope: RestEnvelope, pagination: { limit: number; offset: number }, cost: ReturnType<typeof queryCostExtension>) {
    const nodes = arrayValue(envelope.data);
    const meta = envelope.meta || {};
    const page = numberValue(meta.page) || Math.floor(pagination.offset / pagination.limit) + 1;
    const perPage = numberValue(meta.per_page) || pagination.limit;
    const total = numberValue(meta.total) ?? nodes.length;
    const hasNext = booleanValue(meta.has_next) ?? (page * perPage < total);
    const hasPrevious = booleanValue(meta.has_prev) ?? page > 1;
    const startOffset = pagination.offset;

    return {
        edges: nodes.map((node, index) => ({
            cursor: encodeCursor(startOffset + index),
            node,
        })),
        nodes,
        pageInfo: {
            hasNextPage: hasNext,
            hasPreviousPage: hasPrevious,
            startCursor: nodes.length > 0 ? encodeCursor(startOffset) : null,
            endCursor: nodes.length > 0 ? encodeCursor(startOffset + nodes.length - 1) : null,
        },
        totalCount: total,
        queryCost: cost,
    };
}

function connectionFromArray(
    nodes: unknown[],
    pagination: { limit: number; offset: number },
    cost: ReturnType<typeof queryCostExtension>,
) {
    const page = Math.floor(pagination.offset / pagination.limit) + 1;
    const sliced = nodes.slice(pagination.offset, pagination.offset + pagination.limit);
    return connectionFromEnvelope({
        data: sliced,
        meta: {
            page,
            per_page: pagination.limit,
            total: nodes.length,
            has_next: pagination.offset + sliced.length < nodes.length,
            has_prev: pagination.offset > 0,
        },
    }, pagination, cost);
}

function paramsForConnection(c: GatewayContext, variables: GraphQLVariables | undefined, fieldName: string) {
    const pagination = connectionPagination(variables, fieldName);
    const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
    });
    appendFilterParams(params, variableRecord(variables, ['filter']) || fieldVariables(variables, fieldName));

    const storeId = storeIdFromVariables(c, variables);
    if (storeId && !params.has('store_id')) params.set('store_id', storeId);

    return { params, pagination };
}

function singleId(document: string, variables: GraphQLVariables | undefined, fieldName: string): string | null {
    return variableString(variables, [`${fieldName}Id`, `${fieldName}_id`, 'id'])
        || readStringArgument(document, fieldName, 'id')
        || readStringArgument(document, fieldName, 'slug')
        || readStringArgument(document, fieldName, 'orderNumber');
}

async function resolveConnection(
    c: GatewayContext,
    delegate: AdminGraphQLRestDelegate,
    document: string,
    variables: GraphQLVariables | undefined,
    fieldName: string,
    restPath: string,
    cost: ReturnType<typeof queryCostExtension>,
) {
    if (!hasField(document, fieldName)) return undefined;
    const { params, pagination } = paramsForConnection(c, variables, fieldName);
    const envelope = await restGet(c, delegate, restPath, params, fieldName);
    return connectionFromEnvelope(envelope, pagination, cost);
}

async function resolveArrayField(
    c: GatewayContext,
    delegate: AdminGraphQLRestDelegate,
    variables: GraphQLVariables | undefined,
    restPath: string,
    fieldName: string,
) {
    const storeId = storeIdFromVariables(c, variables);
    const params = new URLSearchParams();
    if (storeId) params.set('store_id', storeId);
    const envelope = await restGet(c, delegate, restPath, params, fieldName);
    return arrayValue(envelope.data);
}

function normalizeBulkOperationType(value: unknown): GraphQLBulkOperationType | null {
    const normalized = stringValue(value)?.toLowerCase();
    return normalized === 'query' || normalized === 'mutation' ? normalized : null;
}

function bulkInputForField(variables: GraphQLVariables | undefined, fieldName: string): JsonObject | null {
    return fieldVariables(variables, fieldName)
        || recordValue(variables?.input)
        || recordValue(variables);
}

function bulkInputVariables(input: JsonObject | null): GraphQLVariables {
    return recordValue(input?.variables) || {};
}

function bulkOperationTypeFromRequest(
    document: string,
    variables: GraphQLVariables | undefined,
    fieldName: string,
): GraphQLBulkOperationType | null {
    return normalizeBulkOperationType(variableString(variables, ['type', 'operationType', 'operation_type']))
        || normalizeBulkOperationType(readIdentifierArgument(document, fieldName, 'type'));
}

async function resolveBulkOperationQueryFields(
    c: GatewayContext,
    document: string,
    variables: GraphQLVariables | undefined,
    cost: ReturnType<typeof queryCostExtension>,
    data: JsonObject,
) {
    if (hasField(document, 'bulkOperation')) {
        const id = singleId(document, variables, 'bulkOperation');
        data.bulkOperation = id ? await getGraphQLBulkOperation(c, id) : null;
    }

    if (hasField(document, 'currentBulkOperation')) {
        const operationType = bulkOperationTypeFromRequest(document, variables, 'currentBulkOperation');
        data.currentBulkOperation = await currentGraphQLBulkOperation(c, operationType);
    }

    if (hasField(document, 'bulkOperations')) {
        const pagination = connectionPagination(variables, 'bulkOperations');
        data.bulkOperations = connectionFromArray(await listGraphQLBulkOperations(c), pagination, cost);
    }
}

async function resolveBulkOperationMutationFields(
    c: GatewayContext,
    delegate: AdminGraphQLRestDelegate,
    document: string,
    variables: GraphQLVariables | undefined,
    data: JsonObject,
) {
    if (hasField(document, 'bulkOperationRunQuery')) {
        const input = bulkInputForField(variables, 'bulkOperationRunQuery');
        const query = stringValue(input?.query) || variableString(variables, ['query', 'document']);
        if (!query) {
            throw new AdminGraphQLError('bulkOperationRunQuery requires an input.query document.', 'GRAPHQL_BULK_QUERY_MISSING', 'bulkOperationRunQuery');
        }

        data.bulkOperationRunQuery = {
            bulkOperation: await createGraphQLBulkOperation(c, delegate, {
                operationType: 'query',
                query,
                variables: bulkInputVariables(input),
            }),
            userErrors: [],
        };
    }

    if (hasField(document, 'bulkOperationRunMutation')) {
        const input = bulkInputForField(variables, 'bulkOperationRunMutation');
        const mutation = stringValue(input?.mutation) || variableString(variables, ['mutation', 'document', 'query']);
        const idempotencyKey = stringValue(input?.idempotencyKey)
            || stringValue(input?.idempotency_key)
            || c.req.header('X-Idempotency-Key')
            || null;
        if (!mutation) {
            throw new AdminGraphQLError('bulkOperationRunMutation requires an input.mutation document.', 'GRAPHQL_BULK_MUTATION_MISSING', 'bulkOperationRunMutation');
        }
        if (!idempotencyKey) {
            throw new AdminGraphQLError('bulkOperationRunMutation requires an idempotency key.', 'GRAPHQL_IDEMPOTENCY_KEY_REQUIRED', 'idempotencyKey');
        }

        data.bulkOperationRunMutation = {
            bulkOperation: await createGraphQLBulkOperation(c, delegate, {
                operationType: 'mutation',
                query: mutation,
                stagedUploadPath: stringValue(input?.stagedUploadPath) || stringValue(input?.staged_upload_path),
                variables: bulkInputVariables(input),
                idempotencyKey,
            }),
            userErrors: [],
        };
    }

    if (hasField(document, 'bulkOperationCancel')) {
        const id = singleId(document, variables, 'bulkOperationCancel');
        if (!id) {
            throw new AdminGraphQLError('bulkOperationCancel requires an id.', 'GRAPHQL_BULK_OPERATION_ID_MISSING', 'bulkOperationCancel');
        }

        data.bulkOperationCancel = {
            bulkOperation: await cancelGraphQLBulkOperation(c, id),
            userErrors: [],
        };
    }
}

async function resolveAdminData(
    c: GatewayContext,
    delegate: AdminGraphQLRestDelegate,
    payload: GraphQLRequestPayload,
    cost: ReturnType<typeof queryCostExtension>,
) {
    const document = payload.query;
    const variables = payload.variables;
    const data: JsonObject = {};

    if (hasField(document, 'queryCost')) {
        data.queryCost = cost;
    }

    if (/^\s*mutation\b/i.test(document)) {
        await resolveBulkOperationMutationFields(c, delegate, document, variables, data);
        if (Object.keys(data).length === 0 || (Object.keys(data).length === 1 && data.queryCost)) {
            throw new AdminGraphQLError('Admin GraphQL mutations are reserved for bulk operations until G6 resolver wiring lands.', 'GRAPHQL_MUTATION_NOT_READY');
        }
        return /\badmin\s*\{/.test(document) ? { admin: data } : data;
    }

    await resolveBulkOperationQueryFields(c, document, variables, cost, data);

    if (hasField(document, 'stores')) {
        const { params, pagination } = paramsForConnection(c, variables, 'stores');
        const envelope = await restGet(c, delegate, '/stores', params, 'stores');
        data.stores = connectionFromEnvelope(envelope, pagination, cost);
    }

    if (hasField(document, 'currentStore')) {
        const storeId = storeIdFromVariables(c, variables);
        data.currentStore = storeId
            ? (await restGet(c, delegate, `/stores/${storeId}`, undefined, 'currentStore')).data
            : arrayValue((await restGet(c, delegate, '/stores', new URLSearchParams({ page: '1', limit: '1' }), 'currentStore')).data)[0] || null;
    }

    if (hasField(document, 'storePaymentConfig')) {
        const storeId = storeIdFromVariables(c, variables);
        data.storePaymentConfig = storeId
            ? (await restGet(c, delegate, `/stores/${storeId}/payment-config`, undefined, 'storePaymentConfig')).data
            : null;
    }

    if (hasField(document, 'subscription')) {
        const storeId = storeIdFromVariables(c, variables);
        const params = new URLSearchParams();
        if (storeId) params.set('store_id', storeId);
        data.subscription = storeId
            ? (await restGet(c, delegate, '/payments/subscription', params, 'subscription')).data
            : null;
    }

    if (hasField(document, 'store') && !hasField(document, 'storePaymentConfig') && !hasField(document, 'stores')) {
        const storeId = singleId(document, variables, 'store') || storeIdFromVariables(c, variables);
        data.store = storeId
            ? (await restGet(c, delegate, `/stores/${storeId}`, undefined, 'store')).data
            : null;
    }

    if (hasField(document, 'product') && !hasField(document, 'products')) {
        const id = singleId(document, variables, 'product');
        data.product = id ? (await restGet(c, delegate, `/products/${id}`, undefined, 'product')).data : null;
    }

    data.products = await resolveConnection(c, delegate, document, variables, 'products', '/products', cost) ?? data.products;
    data.collections = await resolveConnection(c, delegate, document, variables, 'collections', '/products/collections', cost) ?? data.collections;
    data.inventoryLevels = await resolveConnection(c, delegate, document, variables, 'inventoryLevels', '/inventory/levels', cost) ?? data.inventoryLevels;
    data.customers = await resolveConnection(c, delegate, document, variables, 'customers', '/customers', cost) ?? data.customers;
    data.orders = await resolveConnection(c, delegate, document, variables, 'orders', '/orders', cost) ?? data.orders;
    data.pages = await resolveConnection(c, delegate, document, variables, 'pages', '/pages', cost) ?? data.pages;
    data.policies = await resolveConnection(c, delegate, document, variables, 'policies', '/pages/policies', cost) ?? data.policies;
    data.themes = await resolveConnection(c, delegate, document, variables, 'themes', '/themes', cost) ?? data.themes;
    data.marketplaceApps = await resolveConnection(c, delegate, document, variables, 'marketplaceApps', '/app-store/apps', cost) ?? data.marketplaceApps;
    data.installedApps = await resolveConnection(c, delegate, document, variables, 'installedApps', '/app-store/installations', cost) ?? data.installedApps;

    if (hasField(document, 'order') && !hasField(document, 'orders')) {
        const id = singleId(document, variables, 'order');
        data.order = id ? (await restGet(c, delegate, `/orders/${id}`, undefined, 'order')).data : null;
    }

    if (hasField(document, 'navigationMenu')) {
        const storeId = storeIdFromVariables(c, variables);
        const handle = variableString(variables, ['handle']) || readStringArgument(document, 'navigationMenu', 'handle') || 'main';
        const params = new URLSearchParams({ handle });
        if (storeId) params.set('store_id', storeId);
        data.navigationMenu = (await restGet(c, delegate, '/pages/navigation', params, 'navigationMenu')).data;
    }

    if (hasField(document, 'analyticsDashboard')) {
        const storeId = storeIdFromVariables(c, variables);
        const period = variableString(variables, ['period']) || '30d';
        const params = new URLSearchParams({ period });
        if (storeId) params.set('store_id', storeId);
        data.analyticsDashboard = (await restGet(c, delegate, '/analytics/dashboard', params, 'analyticsDashboard')).data;
    }

    if (hasField(document, 'formSubmissions')) {
        data.formSubmissions = await resolveArrayField(c, delegate, variables, '/form-submissions', 'formSubmissions');
    }

    if (hasField(document, 'shippingRates')) {
        data.shippingRates = await resolveArrayField(c, delegate, variables, '/shipping-tax/shipping', 'shippingRates');
    }

    if (hasField(document, 'taxRates')) {
        data.taxRates = await resolveArrayField(c, delegate, variables, '/shipping-tax/taxes', 'taxRates');
    }

    if (Object.keys(data).length === 0) {
        throw new AdminGraphQLError('No supported Admin GraphQL fields were requested.', 'GRAPHQL_FIELD_UNSUPPORTED');
    }

    return /\badmin\s*\{/.test(document) ? { admin: data } : data;
}

function parseVariables(raw: string | undefined): GraphQLVariables | undefined {
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    const record = recordValue(parsed);
    return record || undefined;
}

async function readGraphQLPayload(c: GatewayContext): Promise<GraphQLRequestPayload> {
    if (c.req.method === 'GET') {
        const query = c.req.query('query');
        if (!query) throw new AdminGraphQLError('Missing GraphQL query.', 'GRAPHQL_QUERY_MISSING');
        return {
            query,
            variables: parseVariables(c.req.query('variables')),
            operationName: c.req.query('operationName') || null,
        };
    }

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        throw new AdminGraphQLError('GraphQL requests must include a JSON body.', 'GRAPHQL_BODY_INVALID');
    }

    const result = GraphQLRequestPayloadSchema.safeParse(body);
    if (!result.success) {
        throw new AdminGraphQLError('GraphQL request payload failed validation.', 'GRAPHQL_BODY_INVALID');
    }

    return {
        query: result.data.query,
        variables: result.data.variables || undefined,
        operationName: result.data.operationName || null,
    };
}

async function executeAdminGraphQL(c: GatewayContext, options: AdminGraphQLRouterOptions) {
    let payload: GraphQLRequestPayload;
    try {
        payload = await readGraphQLPayload(c);
    } catch (error) {
        const requestError = error instanceof AdminGraphQLError
            ? error
            : new AdminGraphQLError('Invalid GraphQL request.', 'GRAPHQL_REQUEST_INVALID');
        return c.json({ errors: [graphQLError(requestError.message, requestError.code)] }, 400);
    }

    const requestedCost = calculateGraphQLQueryCost({
        query: payload.query,
        variables: payload.variables,
        surface: 'admin',
    });
    const auth = c.get('auth');
    const limit = await checkQueryCostRateLimitKey(c.env, {
        key: `${auth?.user.id || 'anonymous'}:${payload.operationName || stableHash(payload.query)}`,
        cost: requestedCost,
        pointsPerSecond: 20,
        capacity: 200,
        prefix: 'rl:graphql-admin',
    });
    setRateLimitHeaders(c, limit);

    const cost = queryCostExtension(requestedCost, limit);
    if (!limit.allowed) {
        return c.json({
            errors: [graphQLError('GraphQL query cost limit exceeded.', 'QUERY_COST_RATE_LIMITED')],
            extensions: { cost },
        }, 429);
    }

    try {
        const data = await resolveAdminData(c, options.restDelegate, payload, cost);
        return c.json({
            data,
            extensions: { cost },
        });
    } catch (error) {
        const graphQLErrorValue = error instanceof AdminGraphQLError
            ? graphQLError(error.message, error.code, error.field)
            : isGraphQLBulkOperationError(error)
                ? graphQLError(error.message, error.code, error.field)
            : graphQLError('GraphQL execution failed.', 'GRAPHQL_EXECUTION_ERROR');

        return c.json({
            errors: [graphQLErrorValue],
            extensions: { cost },
        });
    }
}

export function createAdminGraphQLRouter(options: AdminGraphQLRouterOptions) {
    const router = new Hono<{ Bindings: Env }>();

    router.get('/bulk/:id/result', (c) => readGraphQLBulkOperationResult(c, c.req.param('id')));
    router.get('/', (c) => executeAdminGraphQL(c, options));
    router.post('/', (c) => executeAdminGraphQL(c, options));

    return router;
}
