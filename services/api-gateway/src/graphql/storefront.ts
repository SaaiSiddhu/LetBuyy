import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { verifyGatewayCustomerSession } from '../middleware/customer-session';
import { checkQueryCostRateLimitKey, type QueryCostRateLimitResult } from '../middleware/rateLimit';
import { calculateGraphQLQueryCost } from './cost';
import { createRestShimRequest, readRestShimEnvelope, type RestShimEnvelope } from './rest-shim';

type GatewayContext = Context<{ Bindings: Env }>;
type JsonObject = Record<string, unknown>;
type GraphQLVariables = Record<string, unknown>;

export type StorefrontGraphQLRestDelegate = (c: GatewayContext, request: Request) => Promise<Response>;

export interface StorefrontGraphQLRouterOptions {
    restDelegate: StorefrontGraphQLRestDelegate;
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

class StorefrontGraphQLError extends Error {
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

function fieldVariables(variables: GraphQLVariables | undefined, fieldName: string): JsonObject | null {
    return recordValue(variables?.[fieldName]);
}

function variableString(variables: GraphQLVariables | undefined, keys: string[]): string | null {
    for (const key of keys) {
        const direct = stringValue(variables?.[key]);
        if (direct) return direct;

        for (const fieldName of ['store', 'product', 'products', 'collection', 'page', 'policy', 'navigationMenu', 'blogPost', 'reviews', 'customer', 'order', 'cart']) {
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

function storefrontHandle(document: string, variables: GraphQLVariables | undefined): string | null {
    return variableString(variables, ['subdomain', 'storeHandle', 'handle'])
        || readStringArgument(document, 'store', 'subdomain')
        || readStringArgument(document, 'store', 'customDomain');
}

function cartTokenFromVariables(document: string, variables: GraphQLVariables | undefined): string | null {
    return variableString(variables, ['cartToken', 'cart_token', 'cartId', 'cart_id', 'id'])
        || readStringArgument(document, 'cart', 'cartToken')
        || readStringArgument(document, 'cart', 'cart_token')
        || readStringArgument(document, 'cart', 'id');
}

function storeIdFromVariables(variables: GraphQLVariables | undefined): string | null {
    const direct = variableString(variables, ['storeId', 'store_id']);
    if (direct) return direct;

    const filter = variableRecord(variables, ['filter']);
    return stringValue(filter?.storeId) || stringValue(filter?.store_id);
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
        category: 'category',
        search: 'search',
        productId: 'product_id',
        product_id: 'product_id',
        storeId: 'store_id',
        store_id: 'store_id',
        location: 'location',
        handle: 'location',
    };

    for (const [sourceKey, targetKey] of Object.entries(mapping)) {
        const queryValue = asQueryValue(filter[sourceKey]);
        if (queryValue) params.set(targetKey, queryValue);
    }
}

function cloneStorefrontHeaders(c: GatewayContext): Headers {
    const headers = new Headers();
    const names = [
        'Authorization',
        'Cookie',
        'X-Request-ID',
        'X-Trace-ID',
        'X-Store-ID',
        'X-Customer-ID',
        'X-Customer-Email',
        'X-LetBuyy-Customer-Token',
        'X-LetBuyy-Customer-Session',
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
    return readRestShimEnvelope(response, fieldName, (message, code, field) => new StorefrontGraphQLError(message, code, field));
}

async function restGet(
    c: GatewayContext,
    delegate: StorefrontGraphQLRestDelegate,
    path: string,
    params?: URLSearchParams,
    fieldName = path,
): Promise<RestEnvelope> {
    const response = await delegate(c, createRestShimRequest(c, path, params, cloneStorefrontHeaders(c)));

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

function hasCustomerContext(c: GatewayContext, document: string): boolean {
    return Boolean(
        c.req.header('Authorization')
            || c.req.header('Cookie')
            || c.req.header('X-Customer-ID')
            || c.req.header('X-Customer-Email')
            || c.req.header('X-LetBuyy-Customer-Token')
            || c.req.header('X-LetBuyy-Customer-Session')
            || /\b(customer|order|cart)\b/.test(document),
    );
}

function setStorefrontCacheHeaders(c: GatewayContext, document: string) {
    c.header(
        'Cache-Control',
        hasCustomerContext(c, document)
            ? 'private, no-store'
            : 'public, max-age=30, stale-while-revalidate=120',
    );
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

function connectionFromArray(nodes: unknown[], pagination: { limit: number; offset: number }, cost: ReturnType<typeof queryCostExtension>) {
    const pageNodes = nodes.slice(pagination.offset, pagination.offset + pagination.limit);
    return connectionFromEnvelope({
        data: pageNodes,
        meta: {
            page: Math.floor(pagination.offset / pagination.limit) + 1,
            per_page: pagination.limit,
            total: nodes.length,
            has_next: pagination.offset + pagination.limit < nodes.length,
            has_prev: pagination.offset > 0,
        },
    }, pagination, cost);
}

function paramsForConnection(variables: GraphQLVariables | undefined, fieldName: string) {
    const pagination = connectionPagination(variables, fieldName);
    const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
    });
    appendFilterParams(params, variableRecord(variables, ['filter']) || fieldVariables(variables, fieldName));
    return { params, pagination };
}

function slugOrId(document: string, variables: GraphQLVariables | undefined, fieldName: string): string | null {
    return variableString(variables, [`${fieldName}Id`, `${fieldName}_id`, 'id', 'slug'])
        || readStringArgument(document, fieldName, 'id')
        || readStringArgument(document, fieldName, 'slug')
        || readStringArgument(document, fieldName, 'type');
}

function requireStorefrontHandle(document: string, variables: GraphQLVariables | undefined, fieldName: string): string {
    const handle = storefrontHandle(document, variables);
    if (!handle) {
        throw new StorefrontGraphQLError(
            `Storefront GraphQL field ${fieldName} requires a store subdomain or storeHandle variable.`,
            'GRAPHQL_STOREFRONT_CONTEXT_REQUIRED',
            fieldName,
        );
    }
    return handle;
}

async function resolveStoreScopedConnection(
    c: GatewayContext,
    delegate: StorefrontGraphQLRestDelegate,
    document: string,
    variables: GraphQLVariables | undefined,
    fieldName: string,
    pathBuilder: (handle: string) => string,
    cost: ReturnType<typeof queryCostExtension>,
) {
    if (!hasField(document, fieldName)) return undefined;
    const handle = requireStorefrontHandle(document, variables, fieldName);
    const { params, pagination } = paramsForConnection(variables, fieldName);
    const envelope = await restGet(c, delegate, pathBuilder(handle), params, fieldName);
    return connectionFromEnvelope(envelope, pagination, cost);
}

async function resolveStorefrontData(
    c: GatewayContext,
    delegate: StorefrontGraphQLRestDelegate,
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
        throw new StorefrontGraphQLError('Storefront GraphQL mutations are reserved for G4/G6 resolver wiring in this stage.', 'GRAPHQL_MUTATION_NOT_READY');
    }

    if (hasField(document, 'cart')) {
        const handle = requireStorefrontHandle(document, variables, 'cart');
        const cartToken = cartTokenFromVariables(document, variables);
        if (!cartToken) {
            throw new StorefrontGraphQLError(
                'Storefront GraphQL cart reads require a persisted cart token.',
                'GRAPHQL_CART_TOKEN_REQUIRED',
                'cart',
            );
        }
        data.cart = (await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}/cart/${encodeURIComponent(cartToken)}`, undefined, 'cart')).data;
    }

    if (hasField(document, 'store')) {
        const storeId = storeIdFromVariables(variables);
        const handle = storefrontHandle(document, variables);
        data.store = storeId
            ? (await restGet(c, delegate, `/storefront/store/${encodeURIComponent(storeId)}`, undefined, 'store')).data
            : handle
                ? (await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}`, undefined, 'store')).data
                : null;
    }

    if (hasField(document, 'product') && !hasField(document, 'products')) {
        const handle = requireStorefrontHandle(document, variables, 'product');
        const identifier = slugOrId(document, variables, 'product');
        data.product = identifier
            ? (await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}/products/${encodeURIComponent(identifier)}`, undefined, 'product')).data
            : null;
    }

    if (hasField(document, 'products')) {
        const storeId = storeIdFromVariables(variables);
        if (storeId && !storefrontHandle(document, variables)) {
            const { params, pagination } = paramsForConnection(variables, 'products');
            const envelope = await restGet(c, delegate, `/storefront/store/${encodeURIComponent(storeId)}/products`, params, 'products');
            data.products = connectionFromEnvelope(envelope, pagination, cost);
        } else {
            data.products = await resolveStoreScopedConnection(
                c,
                delegate,
                document,
                variables,
                'products',
                (handle) => `/storefront/${encodeURIComponent(handle)}/products`,
                cost,
            );
        }
    }

    if (hasField(document, 'collections') || (hasField(document, 'collection') && !hasField(document, 'collections'))) {
        const handle = requireStorefrontHandle(document, variables, hasField(document, 'collections') ? 'collections' : 'collection');
        const { pagination } = paramsForConnection(variables, 'collections');
        const envelope = await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}/categories`, undefined, 'collections');
        const nodes = arrayValue(envelope.data);

        if (hasField(document, 'collections')) {
            data.collections = connectionFromArray(nodes, pagination, cost);
        }

        if (hasField(document, 'collection') && !hasField(document, 'collections')) {
            const identifier = slugOrId(document, variables, 'collection');
            data.collection = identifier
                ? nodes.find((node) => {
                    const record = recordValue(node);
                    return record?.id === identifier || record?.slug === identifier;
                }) || null
                : null;
        }
    }

    data.pages = await resolveStoreScopedConnection(c, delegate, document, variables, 'pages', (handle) => `/storefront/${encodeURIComponent(handle)}/pages`, cost) ?? data.pages;
    data.policies = await resolveStoreScopedConnection(c, delegate, document, variables, 'policies', (handle) => `/storefront/${encodeURIComponent(handle)}/policies`, cost) ?? data.policies;
    data.blogPosts = await resolveStoreScopedConnection(c, delegate, document, variables, 'blogPosts', (handle) => `/storefront/${encodeURIComponent(handle)}/blog`, cost) ?? data.blogPosts;

    if (hasField(document, 'page') && !hasField(document, 'pages')) {
        const handle = requireStorefrontHandle(document, variables, 'page');
        const slug = slugOrId(document, variables, 'page');
        data.page = slug
            ? (await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}/pages/${encodeURIComponent(slug)}`, undefined, 'page')).data
            : null;
    }

    if (hasField(document, 'policy') && !hasField(document, 'policies')) {
        const handle = requireStorefrontHandle(document, variables, 'policy');
        const policyType = slugOrId(document, variables, 'policy');
        data.policy = policyType
            ? (await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}/policies/${encodeURIComponent(policyType)}`, undefined, 'policy')).data
            : null;
    }

    if (hasField(document, 'navigationMenu')) {
        const handle = requireStorefrontHandle(document, variables, 'navigationMenu');
        const location = variableString(variables, ['location', 'navigationHandle', 'handle'])
            || readStringArgument(document, 'navigationMenu', 'handle')
            || 'main';
        data.navigationMenu = (await restGet(
            c,
            delegate,
            `/storefront/${encodeURIComponent(handle)}/navigation`,
            new URLSearchParams({ location }),
            'navigationMenu',
        )).data;
    }

    if (hasField(document, 'blogPost')) {
        const handle = requireStorefrontHandle(document, variables, 'blogPost');
        const slug = slugOrId(document, variables, 'blogPost');
        data.blogPost = slug
            ? (await restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}/blog/${encodeURIComponent(slug)}`, undefined, 'blogPost')).data
            : null;
    }

    if (hasField(document, 'reviews')) {
        const productId = variableString(variables, ['productId', 'product_id'])
            || readStringArgument(document, 'reviews', 'productId');
        const storeId = storeIdFromVariables(variables);
        const { pagination } = paramsForConnection(variables, 'reviews');
        const params = new URLSearchParams();
        if (productId) params.set('product_id', productId);
        if (storeId) params.set('store_id', storeId);
        data.reviews = productId && storeId
            ? connectionFromArray(arrayValue((await restGet(c, delegate, '/storefront/reviews', params, 'reviews')).data), pagination, cost)
            : connectionFromArray([], pagination, cost);
    }

    if (hasField(document, 'customer')) {
        const session = await requireCustomerGraphQLSession(c, 'customer');
        const { data: customer, error } = await getSupabaseAdmin(c)
            .from('store_customers')
            .select('id')
            .eq('id', session.customerId)
            .eq('store_id', session.storeId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .maybeSingle();
        if (error) {
            throw new StorefrontGraphQLError(
                'The customer account is temporarily unavailable.',
                'CUSTOMER_ACCOUNT_UNAVAILABLE',
                'customer',
            );
        }
        if (!customer) {
            throw new StorefrontGraphQLError(
                'A valid customer session is required for this Storefront GraphQL field.',
                'CUSTOMER_SESSION_REQUIRED',
                'customer',
            );
        }
        data.customer = {
            id: session.customerId,
            store_id: session.storeId,
        };
    }

    if (hasField(document, 'order')) {
        const session = await requireCustomerGraphQLSession(c, 'order');
        const orderId = slugOrId(document, variables, 'order');
        const params = new URLSearchParams({
            store_id: session.storeId,
            customer_id: session.customerId,
        });
        const envelope = await restGet(c, delegate, '/storefront/customer/orders', params, 'order');
        data.order = orderId
            ? arrayValue(recordValue(envelope?.data)?.orders).find((node) => recordValue(node)?.id === orderId) || null
            : null;
    }

    if (Object.keys(data).length === 0) {
        throw new StorefrontGraphQLError('No supported Storefront GraphQL fields were requested.', 'GRAPHQL_FIELD_UNSUPPORTED');
    }

    return /\bstorefront\s*\{/.test(document) ? { storefront: data } : data;
}

async function requireCustomerGraphQLSession(c: GatewayContext, fieldName: string) {
    const session = await verifyGatewayCustomerSession(c);
    if (!session) {
        throw new StorefrontGraphQLError(
            'A valid customer session is required for this Storefront GraphQL field.',
            'CUSTOMER_SESSION_REQUIRED',
            fieldName,
        );
    }

    return session;
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
        if (!query) throw new StorefrontGraphQLError('Missing GraphQL query.', 'GRAPHQL_QUERY_MISSING');
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
        throw new StorefrontGraphQLError('GraphQL requests must include a JSON body.', 'GRAPHQL_BODY_INVALID');
    }

    const result = GraphQLRequestPayloadSchema.safeParse(body);
    if (!result.success) {
        throw new StorefrontGraphQLError('GraphQL request payload failed validation.', 'GRAPHQL_BODY_INVALID');
    }

    return {
        query: result.data.query,
        variables: result.data.variables || undefined,
        operationName: result.data.operationName || null,
    };
}

async function executeStorefrontGraphQL(c: GatewayContext, options: StorefrontGraphQLRouterOptions) {
    let payload: GraphQLRequestPayload;
    try {
        payload = await readGraphQLPayload(c);
    } catch (error) {
        const requestError = error instanceof StorefrontGraphQLError
            ? error
            : new StorefrontGraphQLError('Invalid GraphQL request.', 'GRAPHQL_REQUEST_INVALID');
        return c.json({ errors: [graphQLError(requestError.message, requestError.code)] }, 400);
    }

    setStorefrontCacheHeaders(c, payload.query);

    const requestedCost = calculateGraphQLQueryCost({
        query: payload.query,
        variables: payload.variables,
        surface: 'storefront',
    });
    const limit = await checkQueryCostRateLimitKey(c.env, {
        key: `${c.req.header('X-Customer-ID') || c.req.header('X-Store-ID') || 'anonymous'}:${payload.operationName || stableHash(payload.query)}`,
        cost: requestedCost,
        pointsPerSecond: 20,
        capacity: 200,
        prefix: 'rl:graphql-storefront',
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
        const data = await resolveStorefrontData(c, options.restDelegate, payload, cost);
        return c.json({
            data,
            extensions: { cost },
        });
    } catch (error) {
        const graphQLErrorValue = error instanceof StorefrontGraphQLError
            ? graphQLError(error.message, error.code, error.field)
            : graphQLError('GraphQL execution failed.', 'GRAPHQL_EXECUTION_ERROR');

        return c.json({
            errors: [graphQLErrorValue],
            extensions: { cost },
        });
    }
}

export function createStorefrontGraphQLRouter(options: StorefrontGraphQLRouterOptions) {
    const router = new Hono<{ Bindings: Env }>();

    router.get('/', (c) => executeStorefrontGraphQL(c, options));
    router.post('/', (c) => executeStorefrontGraphQL(c, options));

    return router;
}
