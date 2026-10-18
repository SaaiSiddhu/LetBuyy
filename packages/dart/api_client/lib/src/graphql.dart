import 'types.dart';

typedef GraphQLRequestExecutor =
    Future<dynamic> Function(String path, {ApiRequestOptions? options});

const letbuyyGraphQLSdkSchemaVersion = '2026-06-05.g1';
const letbuyyAdminGraphQLPath = '/admin/graphql';
const letbuyyStorefrontGraphQLPath = '/storefront/graphql';

class GraphQLOperation {
  const GraphQLOperation({
    required this.surface,
    required this.operationName,
    required this.document,
  });

  final String surface;
  final String operationName;
  final String document;
}

class LetBuyyGraphQLOperations {
  const LetBuyyGraphQLOperations._();

  static const adminProducts = GraphQLOperation(
    surface: 'admin',
    operationName: 'AdminProducts',
    document: r'''query AdminProducts($first: Int, $after: String, $filter: ProductFilter) {
  products(first: $first, after: $after, filter: $filter) {
    nodes { id store_id name slug status price currency image_url updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
    queryCost { requested actual maximumAvailable currentlyAvailable restoreRate policy }
  }
  queryCost(document: "AdminProducts") { requested actual maximumAvailable currentlyAvailable restoreRate policy }
}''',
  );

  static const adminOrders = GraphQLOperation(
    surface: 'admin',
    operationName: 'AdminOrders',
    document: r'''query AdminOrders($first: Int, $after: String, $filter: OrderFilter) {
  orders(first: $first, after: $after, filter: $filter) {
    nodes { id store_id order_number status payment_status fulfillment_status total_amount currency created_at updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
    queryCost { requested actual maximumAvailable currentlyAvailable restoreRate policy }
  }
  queryCost(document: "AdminOrders") { requested actual maximumAvailable currentlyAvailable restoreRate policy }
}''',
  );

  static const adminBulkOperation = GraphQLOperation(
    surface: 'admin',
    operationName: 'AdminBulkOperation',
    document: r'''query AdminBulkOperation($id: ID!) {
  bulkOperation(id: $id) {
    id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt
  }
}''',
  );

  static const adminCurrentBulkOperation = GraphQLOperation(
    surface: 'admin',
    operationName: 'AdminCurrentBulkOperation',
    document: r'''query AdminCurrentBulkOperation($type: BulkOperationType) {
  currentBulkOperation(type: $type) {
    id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt
  }
}''',
  );

  static const adminBulkOperationRunQuery = GraphQLOperation(
    surface: 'admin',
    operationName: 'AdminBulkOperationRunQuery',
    document: r'''mutation AdminBulkOperationRunQuery($input: BulkOperationRunQueryInput!) {
  bulkOperationRunQuery(input: $input) {
    bulkOperation { id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt }
    userErrors { field message code }
  }
}''',
  );

  static const adminBulkOperationRunMutation = GraphQLOperation(
    surface: 'admin',
    operationName: 'AdminBulkOperationRunMutation',
    document: r'''mutation AdminBulkOperationRunMutation($input: BulkOperationRunMutationInput!) {
  bulkOperationRunMutation(input: $input) {
    bulkOperation { id storeId apiSurface operationType status resultUrl objectCount fileSizeBytes errorCode errorMessage createdAt updatedAt startedAt completedAt expiresAt }
    userErrors { field message code }
  }
}''',
  );

  static const storefrontStore = GraphQLOperation(
    surface: 'storefront',
    operationName: 'StorefrontStore',
    document: r'''query StorefrontStore($handle: String, $subdomain: String, $storeId: ID, $customDomain: String) {
  store(subdomain: $subdomain, customDomain: $customDomain) {
    id name subdomain site_type status currency locale timezone updated_at
  }
}''',
  );

  static const storefrontProducts = GraphQLOperation(
    surface: 'storefront',
    operationName: 'StorefrontProducts',
    document: r'''query StorefrontProducts($handle: String!, $first: Int, $after: String, $filter: ProductFilter) {
  store(subdomain: $handle) { id name subdomain site_type status currency locale }
  products(first: $first, after: $after, filter: $filter) {
    nodes { id store_id name slug status price currency image_url updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
    queryCost { requested actual maximumAvailable currentlyAvailable restoreRate policy }
  }
  queryCost(document: "StorefrontProducts") { requested actual maximumAvailable currentlyAvailable restoreRate policy }
}''',
  );

  static const storefrontPages = GraphQLOperation(
    surface: 'storefront',
    operationName: 'StorefrontPages',
    document: r'''query StorefrontPages($handle: String!, $first: Int, $after: String) {
  pages(first: $first, after: $after) {
    nodes { id title slug status updated_at }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
  }
}''',
  );
}

class GraphQLResult {
  const GraphQLResult({
    required this.data,
    this.extensions = const {},
  });

  final JsonMap data;
  final JsonMap extensions;
}

class GraphQLException implements Exception {
  const GraphQLException({
    required this.message,
    required this.errors,
    required this.response,
  });

  final String message;
  final List<JsonMap> errors;
  final JsonMap response;

  @override
  String toString() => message;
}

class GraphQLClient {
  const GraphQLClient(this._executeRequest);

  final GraphQLRequestExecutor _executeRequest;

  Future<GraphQLResult> adminProducts({
    JsonMap variables = const <String, dynamic>{},
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyAdminGraphQLPath,
      LetBuyyGraphQLOperations.adminProducts,
      variables: variables,
      options: options,
    );
  }

  Future<GraphQLResult> adminOrders({
    JsonMap variables = const <String, dynamic>{},
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyAdminGraphQLPath,
      LetBuyyGraphQLOperations.adminOrders,
      variables: variables,
      options: options,
    );
  }

  Future<GraphQLResult> adminBulkOperation(
    String id, {
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyAdminGraphQLPath,
      LetBuyyGraphQLOperations.adminBulkOperation,
      variables: {'id': id},
      options: options,
    );
  }

  Future<GraphQLResult> adminCurrentBulkOperation({
    String? type,
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyAdminGraphQLPath,
      LetBuyyGraphQLOperations.adminCurrentBulkOperation,
      variables: {if (type != null) 'type': type},
      options: options,
    );
  }

  Future<GraphQLResult> adminBulkOperationRunQuery({
    required String query,
    JsonMap variables = const <String, dynamic>{},
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyAdminGraphQLPath,
      LetBuyyGraphQLOperations.adminBulkOperationRunQuery,
      variables: {
        'input': {'query': query, 'variables': variables},
      },
      options: options,
    );
  }

  Future<GraphQLResult> adminBulkOperationRunMutation({
    required String mutation,
    required String idempotencyKey,
    String? stagedUploadPath,
    JsonMap variables = const <String, dynamic>{},
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyAdminGraphQLPath,
      LetBuyyGraphQLOperations.adminBulkOperationRunMutation,
      variables: {
        'input': {
          'mutation': mutation,
          'idempotencyKey': idempotencyKey,
          if (stagedUploadPath != null) 'stagedUploadPath': stagedUploadPath,
          'variables': variables,
        },
      },
      options: (options ?? const ApiRequestOptions()).copyWith(
        idempotencyKey: idempotencyKey,
      ),
    );
  }

  Future<GraphQLResult> storefrontStore({
    JsonMap variables = const <String, dynamic>{},
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyStorefrontGraphQLPath,
      LetBuyyGraphQLOperations.storefrontStore,
      variables: variables,
      options: options,
    );
  }

  Future<GraphQLResult> storefrontProducts({
    required String handle,
    int? first,
    String? after,
    JsonMap? filter,
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyStorefrontGraphQLPath,
      LetBuyyGraphQLOperations.storefrontProducts,
      variables: {
        'handle': handle,
        if (first != null) 'first': first,
        if (after != null) 'after': after,
        if (filter != null) 'filter': filter,
      },
      options: options,
    );
  }

  Future<GraphQLResult> storefrontPages({
    required String handle,
    int? first,
    String? after,
    ApiRequestOptions? options,
  }) {
    return execute(
      letbuyyStorefrontGraphQLPath,
      LetBuyyGraphQLOperations.storefrontPages,
      variables: {
        'handle': handle,
        if (first != null) 'first': first,
        if (after != null) 'after': after,
      },
      options: options,
    );
  }

  Future<GraphQLResult> execute(
    String path,
    GraphQLOperation operation, {
    JsonMap variables = const <String, dynamic>{},
    ApiRequestOptions? options,
  }) async {
    final response = await _executeRequest(
      path,
      options: (options ?? const ApiRequestOptions()).copyWith(
        method: HttpMethod.post,
        body: {
          'query': operation.document,
          'variables': variables,
          'operationName': operation.operationName,
        },
      ),
    );
    final json = asJsonMap(response);
    final errors = _readGraphQLErrors(json['errors']);
    if (errors.isNotEmpty) {
      throw GraphQLException(
        message: stringValue(errors.first['message'], fallback: 'GraphQL error'),
        errors: errors,
        response: json,
      );
    }

    return GraphQLResult(
      data: asJsonMap(json['data']),
      extensions: json['extensions'] is Map
          ? asJsonMap(json['extensions'])
          : const <String, dynamic>{},
    );
  }
}

List<JsonMap> _readGraphQLErrors(Object? value) {
  if (value is! List) return const [];
  return value.map(asJsonMap).toList(growable: false);
}
