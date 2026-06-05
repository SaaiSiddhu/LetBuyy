import type {
  GraphQLApiSurface,
  GraphQLBulkOperation,
  GraphQLConnection,
  GraphQLQueryCost,
  JsonRecord,
  Order,
  Page,
  Product,
  Store,
} from '@letbuyy/shared-types';

export const LETBUYY_GRAPHQL_SDK_SCHEMA_VERSION = '2026-06-05.g1';
export const LETBUYY_ADMIN_GRAPHQL_PATH = '/admin/graphql';
export const LETBUYY_STOREFRONT_GRAPHQL_PATH = '/storefront/graphql';

export interface LetbuyyGraphQLTransportRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: HeadersInit;
  token?: string | null;
  storeId?: string | null;
  idempotencyKey?: string | null;
  signal?: AbortSignal;
  versioned?: boolean;
}

export interface LetbuyyGraphQLTransport {
  request<T>(path: string, options?: LetbuyyGraphQLTransportRequestOptions): Promise<T>;
}

export interface GraphQLExecutionError {
  message: string;
  extensions?: JsonRecord & {
    code?: string;
    field?: string;
  };
}

export interface GraphQLResponseEnvelope<TData> {
  data?: TData;
  errors?: GraphQLExecutionError[];
  extensions?: JsonRecord & {
    cost?: GraphQLQueryCost;
  };
}

export interface GraphQLResult<TData> {
  data: TData;
  extensions?: GraphQLResponseEnvelope<TData>['extensions'];
}

export interface GeneratedGraphQLOperation<TData, TVariables extends JsonRecord = JsonRecord> {
  surface: GraphQLApiSurface;
  operationName: string;
  document: string;
  __data?: TData;
  __variables?: TVariables;
}

export interface GraphQLUserError {
  field?: string[] | string | null;
  message: string;
  code?: string | null;
}

export interface AdminProductsVariables extends JsonRecord {
  first?: number;
  after?: string | null;
  filter?: JsonRecord | null;
}

export interface AdminProductsData {
  products: GraphQLConnection<Product>;
  queryCost?: GraphQLQueryCost;
}

export interface AdminOrdersVariables extends JsonRecord {
  first?: number;
  after?: string | null;
  filter?: JsonRecord | null;
}

export interface AdminOrdersData {
  orders: GraphQLConnection<Order>;
  queryCost?: GraphQLQueryCost;
}

export interface AdminBulkOperationVariables extends JsonRecord {
  id: string;
}

export interface AdminBulkOperationData {
  bulkOperation: GraphQLBulkOperation | null;
}

export interface AdminCurrentBulkOperationVariables extends JsonRecord {
  type?: 'query' | 'mutation' | 'QUERY' | 'MUTATION' | null;
}

export interface AdminCurrentBulkOperationData {
  currentBulkOperation: GraphQLBulkOperation | null;
}

export interface AdminBulkOperationRunQueryVariables extends JsonRecord {
  input: {
    query: string;
    variables?: JsonRecord;
  };
}

export interface AdminBulkOperationRunMutationVariables extends JsonRecord {
  input: {
    mutation: string;
    stagedUploadPath?: string | null;
    variables?: JsonRecord;
    idempotencyKey: string;
  };
}

export interface AdminBulkOperationPayloadData {
  bulkOperationRunQuery?: {
    bulkOperation: GraphQLBulkOperation | null;
    userErrors: GraphQLUserError[];
  };
  bulkOperationRunMutation?: {
    bulkOperation: GraphQLBulkOperation | null;
    userErrors: GraphQLUserError[];
  };
}

export interface StorefrontStoreVariables extends JsonRecord {
  handle?: string;
  subdomain?: string;
  storeId?: string;
  customDomain?: string;
}

export interface StorefrontStoreData {
  store: Store | null;
}

export interface StorefrontProductsVariables extends JsonRecord {
  handle: string;
  first?: number;
  after?: string | null;
  filter?: JsonRecord | null;
}

export interface StorefrontProductsData {
  store?: Store | null;
  products: GraphQLConnection<Product>;
  queryCost?: GraphQLQueryCost;
}

export interface StorefrontPagesVariables extends JsonRecord {
  handle: string;
  first?: number;
  after?: string | null;
}

export interface StorefrontPagesData {
  pages: GraphQLConnection<Page>;
}

export interface StorefrontCustomerOrdersVariables extends JsonRecord {
  storeId: string;
  email: string;
  orderId?: string | null;
}

export interface StorefrontCustomerOrdersData {
  customerOrders: JsonRecord;
}

export const LETBUYY_ADMIN_GRAPHQL_OPERATIONS = {
  products: {
    surface: 'admin',
    operationName: 'AdminProducts',
    document: String.raw`query AdminProducts($first: Int, $after: String, $filter: ProductFilter) {
  products(first: $first, after: $after, filter: $filter) {
    nodes { id store_id name slug status price currency image_url updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
    queryCost { requested actual maximumAvailable currentlyAvailable restoreRate policy }
  }
  queryCost(document: "AdminProducts") { requested actual maximumAvailable currentlyAvailable restoreRate policy }
}`,
  } satisfies GeneratedGraphQLOperation<AdminProductsData, AdminProductsVariables>,
  orders: {
    surface: 'admin',
    operationName: 'AdminOrders',
    document: String.raw`query AdminOrders($first: Int, $after: String, $filter: OrderFilter) {
  orders(first: $first, after: $after, filter: $filter) {
    nodes { id store_id order_number status payment_status fulfillment_status total_amount currency created_at updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
    queryCost { requested actual maximumAvailable currentlyAvailable restoreRate policy }
  }
  queryCost(document: "AdminOrders") { requested actual maximumAvailable currentlyAvailable restoreRate policy }
}`,
  } satisfies GeneratedGraphQLOperation<AdminOrdersData, AdminOrdersVariables>,
  bulkOperation: {
    surface: 'admin',
    operationName: 'AdminBulkOperation',
    document: String.raw`query AdminBulkOperation($id: ID!) {
  bulkOperation(id: $id) {
    id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt
  }
}`,
  } satisfies GeneratedGraphQLOperation<AdminBulkOperationData, AdminBulkOperationVariables>,
  currentBulkOperation: {
    surface: 'admin',
    operationName: 'AdminCurrentBulkOperation',
    document: String.raw`query AdminCurrentBulkOperation($type: BulkOperationType) {
  currentBulkOperation(type: $type) {
    id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt
  }
}`,
  } satisfies GeneratedGraphQLOperation<AdminCurrentBulkOperationData, AdminCurrentBulkOperationVariables>,
  bulkOperationRunQuery: {
    surface: 'admin',
    operationName: 'AdminBulkOperationRunQuery',
    document: String.raw`mutation AdminBulkOperationRunQuery($input: BulkOperationRunQueryInput!) {
  bulkOperationRunQuery(input: $input) {
    bulkOperation { id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt }
    userErrors { field message code }
  }
}`,
  } satisfies GeneratedGraphQLOperation<AdminBulkOperationPayloadData, AdminBulkOperationRunQueryVariables>,
  bulkOperationRunMutation: {
    surface: 'admin',
    operationName: 'AdminBulkOperationRunMutation',
    document: String.raw`mutation AdminBulkOperationRunMutation($input: BulkOperationRunMutationInput!) {
  bulkOperationRunMutation(input: $input) {
    bulkOperation { id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt }
    userErrors { field message code }
  }
}`,
  } satisfies GeneratedGraphQLOperation<AdminBulkOperationPayloadData, AdminBulkOperationRunMutationVariables>,
} as const;

export const LETBUYY_STOREFRONT_GRAPHQL_OPERATIONS = {
  store: {
    surface: 'storefront',
    operationName: 'StorefrontStore',
    document: String.raw`query StorefrontStore($handle: String, $subdomain: String, $storeId: ID, $customDomain: String) {
  store(subdomain: $subdomain, customDomain: $customDomain) {
    id name subdomain site_type status currency locale timezone updated_at
  }
}`,
  } satisfies GeneratedGraphQLOperation<StorefrontStoreData, StorefrontStoreVariables>,
  products: {
    surface: 'storefront',
    operationName: 'StorefrontProducts',
    document: String.raw`query StorefrontProducts($handle: String!, $first: Int, $after: String, $filter: ProductFilter) {
  store(subdomain: $handle) { id name subdomain site_type status currency locale }
  products(first: $first, after: $after, filter: $filter) {
    nodes { id store_id name slug status price currency image_url updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
    queryCost { requested actual maximumAvailable currentlyAvailable restoreRate policy }
  }
  queryCost(document: "StorefrontProducts") { requested actual maximumAvailable currentlyAvailable restoreRate policy }
}`,
  } satisfies GeneratedGraphQLOperation<StorefrontProductsData, StorefrontProductsVariables>,
  pages: {
    surface: 'storefront',
    operationName: 'StorefrontPages',
    document: String.raw`query StorefrontPages($handle: String!, $first: Int, $after: String) {
  pages(first: $first, after: $after) {
    nodes { id title slug status updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
  }
}`,
  } satisfies GeneratedGraphQLOperation<StorefrontPagesData, StorefrontPagesVariables>,
  customerOrders: {
    surface: 'storefront',
    operationName: 'StorefrontCustomerOrders',
    document: String.raw`query StorefrontCustomerOrders($storeId: ID!, $email: String!, $orderId: ID) {
  customerOrders(storeId: $storeId, email: $email, orderId: $orderId)
}`,
  } satisfies GeneratedGraphQLOperation<StorefrontCustomerOrdersData, StorefrontCustomerOrdersVariables>,
} as const;

export class LetbuyyGraphQLExecutionError extends Error {
  readonly errors: GraphQLExecutionError[];
  readonly response: GraphQLResponseEnvelope<unknown>;

  constructor(response: GraphQLResponseEnvelope<unknown>) {
    super(response.errors?.[0]?.message || 'LetBuyy GraphQL execution failed.');
    this.name = 'LetbuyyGraphQLExecutionError';
    this.errors = response.errors || [];
    this.response = response;
  }
}

export class LetbuyyGraphQLSdk {
  constructor(private readonly transport: LetbuyyGraphQLTransport) {}

  readonly admin = {
    products: (variables: AdminProductsVariables = {}, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_ADMIN_GRAPHQL_PATH, LETBUYY_ADMIN_GRAPHQL_OPERATIONS.products, variables, options),
    orders: (variables: AdminOrdersVariables = {}, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_ADMIN_GRAPHQL_PATH, LETBUYY_ADMIN_GRAPHQL_OPERATIONS.orders, variables, options),
    bulkOperation: (variables: AdminBulkOperationVariables, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_ADMIN_GRAPHQL_PATH, LETBUYY_ADMIN_GRAPHQL_OPERATIONS.bulkOperation, variables, options),
    currentBulkOperation: (variables: AdminCurrentBulkOperationVariables = {}, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_ADMIN_GRAPHQL_PATH, LETBUYY_ADMIN_GRAPHQL_OPERATIONS.currentBulkOperation, variables, options),
    bulkOperationRunQuery: (variables: AdminBulkOperationRunQueryVariables, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_ADMIN_GRAPHQL_PATH, LETBUYY_ADMIN_GRAPHQL_OPERATIONS.bulkOperationRunQuery, variables, options),
    bulkOperationRunMutation: (variables: AdminBulkOperationRunMutationVariables, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_ADMIN_GRAPHQL_PATH, LETBUYY_ADMIN_GRAPHQL_OPERATIONS.bulkOperationRunMutation, variables, {
        ...options,
        idempotencyKey: options?.idempotencyKey ?? variables.input.idempotencyKey,
      }),
  };

  readonly storefront = {
    store: (variables: StorefrontStoreVariables = {}, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_STOREFRONT_GRAPHQL_PATH, LETBUYY_STOREFRONT_GRAPHQL_OPERATIONS.store, variables, options),
    products: (variables: StorefrontProductsVariables, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_STOREFRONT_GRAPHQL_PATH, LETBUYY_STOREFRONT_GRAPHQL_OPERATIONS.products, variables, options),
    pages: (variables: StorefrontPagesVariables, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_STOREFRONT_GRAPHQL_PATH, LETBUYY_STOREFRONT_GRAPHQL_OPERATIONS.pages, variables, options),
    customerOrders: (variables: StorefrontCustomerOrdersVariables, options?: LetbuyyGraphQLTransportRequestOptions) =>
      this.execute(LETBUYY_STOREFRONT_GRAPHQL_PATH, LETBUYY_STOREFRONT_GRAPHQL_OPERATIONS.customerOrders, variables, options),
  };

  execute<TData, TVariables extends JsonRecord>(
    path: string,
    operation: GeneratedGraphQLOperation<TData, TVariables>,
    variables: TVariables,
    options?: LetbuyyGraphQLTransportRequestOptions,
  ): Promise<GraphQLResult<TData>> {
    return executeGraphQL(this.transport, path, operation, variables, options);
  }
}

export function createLetbuyyGraphQLSdk(transport: LetbuyyGraphQLTransport): LetbuyyGraphQLSdk {
  return new LetbuyyGraphQLSdk(transport);
}

async function executeGraphQL<TData, TVariables extends JsonRecord>(
  transport: LetbuyyGraphQLTransport,
  path: string,
  operation: GeneratedGraphQLOperation<TData, TVariables>,
  variables: TVariables,
  options?: LetbuyyGraphQLTransportRequestOptions,
): Promise<GraphQLResult<TData>> {
  const response = await transport.request<GraphQLResponseEnvelope<TData>>(path, {
    ...options,
    method: 'POST',
    body: {
      query: operation.document,
      variables,
      operationName: operation.operationName,
    },
  });

  if (response.errors?.length) {
    throw new LetbuyyGraphQLExecutionError(response as GraphQLResponseEnvelope<unknown>);
  }

  if (!response.data) {
    throw new LetbuyyGraphQLExecutionError({
      ...response,
      errors: [{ message: 'GraphQL response did not include data.', extensions: { code: 'GRAPHQL_DATA_MISSING' } }],
    });
  }

  return {
    data: response.data,
    extensions: response.extensions,
  };
}
