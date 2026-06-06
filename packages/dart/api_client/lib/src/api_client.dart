import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';

import 'graphql.dart';
import 'types.dart';

class ApiClient {
  ApiClient({
    required String baseUrl,
    String apiVersionPath = '/v1',
    String? token,
    String? storeId,
    ApiTokenProvider? tokenProvider,
    ApiStoreIdProvider? storeIdProvider,
    Map<String, String>? headers,
    RequestIdFactory? requestIdFactory,
    bool attachSessionCookie = false,
    Dio? dio,
    Duration connectTimeout = const Duration(seconds: 30),
    Duration receiveTimeout = const Duration(seconds: 30),
    int maxRetries = 2,
  }) : _apiVersionPath = _normalizePath(apiVersionPath),
       _defaultToken = token,
       _defaultStoreId = storeId,
       _tokenProvider = tokenProvider,
       _storeIdProvider = storeIdProvider,
       _defaultHeaders = Map.unmodifiable(headers ?? const {}),
       _requestIdFactory = requestIdFactory,
       _attachSessionCookie = attachSessionCookie,
       _maxRetries = maxRetries,
       _dio = dio ?? Dio() {
    if (baseUrl.trim().isEmpty) {
      throw ArgumentError('LetBuyy API client requires a baseUrl');
    }

    final trimmedBase = _trimTrailingSlash(baseUrl.trim());
    _baseUrl = trimmedBase.endsWith(_apiVersionPath)
        ? _trimTrailingSlash(
            trimmedBase.substring(
              0,
              trimmedBase.length - _apiVersionPath.length,
            ),
          )
        : trimmedBase;

    _dio.options
      ..connectTimeout = connectTimeout
      ..receiveTimeout = receiveTimeout
      ..responseType = ResponseType.json
      ..validateStatus = (_) => true;

    _dio.interceptors.add(
      _AuthHeaderInterceptor(
        defaultToken: _defaultToken,
        defaultStoreId: _defaultStoreId,
        tokenProvider: _tokenProvider,
        storeIdProvider: _storeIdProvider,
        defaultHeaders: _defaultHeaders,
        requestIdFactory: _requestIdFactory,
        attachSessionCookie: _attachSessionCookie,
      ),
    );
  }

  late final StoresApi stores = StoresApi(this);
  late final AuthApi auth = AuthApi(this);
  late final ProductsApi products = ProductsApi(this);
  late final OrdersApi orders = OrdersApi(this);
  late final CustomersApi customers = CustomersApi(this);
  late final ThemesApi themes = ThemesApi(this);
  late final PaymentsApi payments = PaymentsApi(this);
  late final StorefrontApi storefront = StorefrontApi(this);
  late final AnalyticsApi analytics = AnalyticsApi(this);
  late final CatalogApi categories = CatalogApi(this, '/categories');
  late final InventoryApi inventory = InventoryApi(this);
  late final PagesApi pages = PagesApi(this);
  late final BlogApi blog = BlogApi(this);
  late final MediaApi media = MediaApi(this);
  late final UploadApi upload = UploadApi(this);
  late final ShippingApi shipping = ShippingApi(this);
  late final TaxesApi taxes = TaxesApi(this);
  late final CouponsApi coupons = CouponsApi(this);
  late final NotificationsApi notifications = NotificationsApi(this);
  late final EmployeesApi employees = EmployeesApi(this);
  late final ReviewsApi reviews = ReviewsApi(this);
  late final FormSubmissionsApi formSubmissions = FormSubmissionsApi(this);
  late final AppStoreApi appStore = AppStoreApi(this);
  late final GraphQLClient graphql = GraphQLClient(
    (path, {options}) => request(path, options: options),
  );

  final String _apiVersionPath;
  final String? _defaultToken;
  final String? _defaultStoreId;
  final ApiTokenProvider? _tokenProvider;
  final ApiStoreIdProvider? _storeIdProvider;
  final Map<String, String> _defaultHeaders;
  final RequestIdFactory? _requestIdFactory;
  final bool _attachSessionCookie;
  final Dio _dio;
  final int _maxRetries;

  late final String _baseUrl;

  String get baseUrl => '$_baseUrl$_apiVersionPath';
  String get apiRootUrl => _baseUrl;
  Dio get dio => _dio;

  ApiClient withOptions({
    String? baseUrl,
    String? apiVersionPath,
    String? token,
    String? storeId,
    ApiTokenProvider? tokenProvider,
    ApiStoreIdProvider? storeIdProvider,
    Map<String, String>? headers,
    RequestIdFactory? requestIdFactory,
    bool? attachSessionCookie,
    Dio? dio,
    int? maxRetries,
  }) {
    return ApiClient(
      baseUrl: baseUrl ?? this.baseUrl,
      apiVersionPath: apiVersionPath ?? _apiVersionPath,
      token: token ?? _defaultToken,
      storeId: storeId ?? _defaultStoreId,
      tokenProvider: tokenProvider ?? _tokenProvider,
      storeIdProvider: storeIdProvider ?? _storeIdProvider,
      headers: headers ?? _defaultHeaders,
      requestIdFactory: requestIdFactory ?? _requestIdFactory,
      attachSessionCookie: attachSessionCookie ?? _attachSessionCookie,
      dio: dio ?? Dio(),
      maxRetries: maxRetries ?? _maxRetries,
    );
  }

  Future<HealthResponse> health({ApiRequestOptions? options}) async {
    return requestData(
      '/health',
      options: (options ?? const ApiRequestOptions()).copyWith(
        versioned: false,
      ),
      decoder: HealthResponse.fromJson,
    );
  }

  Future<dynamic> get(
    String path, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) {
    return request(
      path,
      options: _mergeOptions(options, method: HttpMethod.get, query: query),
    );
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    ApiRequestOptions? options,
  }) {
    return request(
      path,
      options: _mergeOptions(options, method: HttpMethod.post, body: body),
    );
  }

  Future<dynamic> put(String path, {Object? body, ApiRequestOptions? options}) {
    return request(
      path,
      options: _mergeOptions(options, method: HttpMethod.put, body: body),
    );
  }

  Future<dynamic> patch(
    String path, {
    Object? body,
    ApiRequestOptions? options,
  }) {
    return request(
      path,
      options: _mergeOptions(options, method: HttpMethod.patch, body: body),
    );
  }

  Future<dynamic> delete(
    String path, {
    Object? body,
    ApiRequestOptions? options,
  }) {
    return request(
      path,
      options: _mergeOptions(options, method: HttpMethod.delete, body: body),
    );
  }

  Future<String> uploadFile(
    File file, {
    String folder = 'uploads',
    ApiRequestOptions? options,
  }) async {
    final fileName = file.path.split(Platform.pathSeparator).last;
    final formData = FormData.fromMap({
      'folder': folder,
      'file': await MultipartFile.fromFile(file.path, filename: fileName),
    });
    final data = await requestData<JsonMap>(
      '/upload',
      options: _mergeOptions(options, method: HttpMethod.post, body: formData),
      decoder: asJsonMap,
    );

    final url = data['url'] ?? data['public_url'] ?? data['cdn_url'];
    if (url is String && url.isNotEmpty) return url;
    throw ApiException(
      message: 'Upload response did not include a file URL.',
      statusCode: 200,
      code: 'INVALID_UPLOAD_RESPONSE',
      body: data,
    );
  }

  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    final body = await request(path, options: options);
    return decoder(_unwrapData(body, 200, null));
  }

  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) {
    return requestData(path, options: options, decoder: asJsonMap);
  }

  Future<PaginatedResponse<T>> requestPaginated<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    final body = await request(path, options: options);
    final payload = _unwrapData(body, 200, null);
    final rows = asJsonList(payload).map(decoder).toList(growable: false);
    final meta = body is Map
        ? asJsonMap(body['meta'] ?? const {})
        : <String, dynamic>{};
    final limit = intValue(meta['per_page'], fallback: rows.length);
    final hasNext = meta['has_next'] is bool ? meta['has_next'] as bool : null;

    return PaginatedResponse<T>(
      data: rows,
      total: intValue(meta['total'], fallback: rows.length),
      page: intValue(meta['page'], fallback: 1),
      limit: limit,
      totalPages: meta['total_pages'] == null
          ? null
          : intValue(meta['total_pages']),
      hasNext: hasNext,
      hasPrev: meta['has_prev'] is bool ? meta['has_prev'] as bool : null,
      hasMore: hasNext ?? boolValue(meta['has_more']),
      meta: meta,
    );
  }

  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) {
    return requestPaginated(path, options: options, decoder: asJsonMap);
  }

  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    final requestOptions = options ?? const ApiRequestOptions();
    final maxRetries = requestOptions.maxRetries ?? _maxRetries;

    for (var attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        final response = await _dio.request<Object?>(
          _buildUrl(path, requestOptions),
          data: requestOptions.body,
          queryParameters: _normalizeQuery(requestOptions.query),
          options: Options(
            method: (requestOptions.method ?? HttpMethod.get).value,
            headers: requestOptions.headers,
            extra: {
              _extraToken: requestOptions.token,
              _extraStoreId: requestOptions.storeId,
              _extraIdempotencyKey: requestOptions.idempotencyKey,
            },
          ),
        );

        final requestId = _requestIdFromResponse(response);
        if (_isRetryableStatus(response.statusCode) &&
            attempt < maxRetries &&
            _canRetry(requestOptions)) {
          await _retryDelay(attempt);
          continue;
        }

        if ((response.statusCode ?? 500) < 200 ||
            (response.statusCode ?? 500) >= 300) {
          throw _errorFromBody(
            response.data,
            response.statusCode ?? 500,
            requestId,
          );
        }

        if (_isFailurePayload(response.data)) {
          throw _errorFromBody(
            response.data,
            response.statusCode ?? 200,
            requestId,
          );
        }

        return response.data;
      } on ApiException {
        rethrow;
      } on DioException catch (error) {
        if (attempt < maxRetries &&
            _isRetryableDioError(error) &&
            _canRetry(requestOptions)) {
          await _retryDelay(attempt);
          continue;
        }
        throw _networkException(error);
      }
    }

    throw const ApiException(
      message: 'Request retry loop ended without a response.',
      statusCode: 500,
      code: 'RETRY_EXHAUSTED',
    );
  }

  void close() {
    _dio.close(force: true);
  }

  String _buildUrl(String path, ApiRequestOptions options) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final base = options.versioned ? baseUrl : apiRootUrl;
    return '$base${_normalizePath(path)}';
  }
}

class StoresApi {
  const StoresApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/stores',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/stores/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> getBySubdomain(
    String subdomain, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/public/${_encodePathSegment(subdomain)}',
    options: options,
  );

  Future<JsonMap> getByHandle(String handle, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores/handle/${_encodePathSegment(handle)}',
        options: options,
      );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> publish(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores/${_encodePathSegment(id)}/publish',
        options: _mergeOptions(options, method: HttpMethod.post),
      );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );

  StorePaymentConfigApi get paymentConfig => StorePaymentConfigApi(_client);
}

class StorePaymentConfigApi {
  const StorePaymentConfigApi(this._client);

  final ApiClient _client;

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores/${_encodePathSegment(id)}/payment-config',
        options: options,
      );

  Future<JsonMap> save(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/payment-config',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class AuthApi {
  const AuthApi(this._client);

  final ApiClient _client;

  Future<JsonMap> session({ApiRequestOptions? options}) =>
      _client.requestJson('/auth/custom/session', options: options);
}

class ProductsApi {
  const ProductsApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/products',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/products/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/products',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/products/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/products/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );

  Future<JsonMap> bulk(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/products/bulk',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<List<JsonMap>> collections({
    required String storeId,
    ApiRequestOptions? options,
  }) async {
    final data = await _client.requestData<List<JsonMap>>(
      '/products/collections',
      options: _mergeOptions(options, query: {'store_id': storeId}),
      decoder: (value) =>
          asJsonList(value).map(asJsonMap).toList(growable: false),
    );
    return data;
  }

  Future<JsonMap> createCollection(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/products/collections',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<List<JsonMap>> giftCards({
    required String storeId,
    ApiRequestOptions? options,
  }) async {
    return _client.requestData<List<JsonMap>>(
      '/products/gift-cards',
      options: _mergeOptions(options, query: {'store_id': storeId}),
      decoder: (value) =>
          asJsonList(value).map(asJsonMap).toList(growable: false),
    );
  }

  Future<JsonMap> createGiftCard(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/products/gift-cards',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> importCsv(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/export/import-products',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class OrdersApi {
  const OrdersApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/orders',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/orders/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/orders',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/orders/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> fulfill(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/orders/${_encodePathSegment(id)}/fulfill',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> refund(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/orders/${_encodePathSegment(id)}/refund',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> completeRefund(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/orders/${_encodePathSegment(id)}/refund/complete',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class CustomersApi {
  const CustomersApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/customers',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> getByEmail(String email, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/customers/${_encodePathSegment(email)}',
        options: options,
      );

  CustomerAddressApi get addresses => CustomerAddressApi(_client);
}

class CustomerAddressApi {
  const CustomerAddressApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list(String email, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/customers/${_encodePathSegment(email)}/addresses',
        options: options,
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> create(
    String email,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/addresses',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> update(
    String email,
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/addresses/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(
    String email,
    String id, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/addresses/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.delete),
  );
}

class ThemesApi {
  const ThemesApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/themes',
    options: _mergeOptions(options, query: query),
  );

  Future<PaginatedResponse<JsonMap>> listCatalog({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => list(query: query, options: options);

  Future<JsonMap> catalogPayload({
    QueryParams? query,
    ApiRequestOptions? options,
  }) async {
    final body = await _client.request(
      '/themes',
      options: _mergeOptions(options, query: query),
    );
    return asJsonMap(body);
  }

  Future<JsonMap> get(String slug, {ApiRequestOptions? options}) => _client
      .requestJson('/themes/${_encodePathSegment(slug)}', options: options);

  Future<JsonMap> schema(String slug, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/themes/${_encodePathSegment(slug)}/schema',
        options: options,
      );

  Future<List<String>> categories({ApiRequestOptions? options}) =>
      _client.requestData(
        '/themes/categories',
        options: options,
        decoder: (value) => asJsonList(value).map((item) => '$item').toList(),
      );

  Future<List<String>> industries({ApiRequestOptions? options}) =>
      _client.requestData(
        '/themes/industries',
        options: options,
        decoder: (value) => asJsonList(value).map((item) => '$item').toList(),
      );

  Future<List<JsonMap>> purchases({ApiRequestOptions? options}) =>
      _client.requestData(
        '/themes/purchases/list',
        options: options,
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<List<JsonMap>> installations({ApiRequestOptions? options}) =>
      _client.requestData(
        '/themes/installations/list',
        options: options,
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> install(
    String slug,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/install',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> editor(
    String slug,
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/editor',
    options: _mergeOptions(options, query: {'store_id': storeId}),
  );

  Future<JsonMap> saveDraft(
    String slug,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/editor/draft',
    options: _mergeOptions(options, method: HttpMethod.put, body: input),
  );

  Future<JsonMap> deleteDraft(
    String slug,
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/editor/draft',
    options: _mergeOptions(
      options,
      method: HttpMethod.delete,
      query: {'store_id': storeId},
    ),
  );

  Future<JsonMap> publish(
    String slug,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/publish',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> previewSession(
    String slug,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/preview-session',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<List<JsonMap>> releases(
    String slug,
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/themes/${_encodePathSegment(slug)}/releases',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> rollbackRelease(
    String slug,
    String releaseId,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/releases/${_encodePathSegment(releaseId)}/rollback',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class PaymentsApi {
  const PaymentsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payments',
        options: _mergeOptions(
          options,
          method: HttpMethod.post,
          body: input,
          idempotencyKey:
              options?.idempotencyKey ?? input['idempotency_key'] as String?,
        ),
      );

  Future<List<JsonMap>> plans(
    QueryParams query, {
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/payments/plans',
    options: _mergeOptions(options, query: query),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  SubscriptionApi get subscription => SubscriptionApi(_client);
}

class SubscriptionApi {
  const SubscriptionApi(this._client);

  final ApiClient _client;

  Future<JsonMap> get(String storeId, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payments/subscription',
        options: _mergeOptions(options, query: {'store_id': storeId}),
      );

  Future<List<JsonMap>> history(String storeId, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/payments/subscription/history',
        options: _mergeOptions(options, query: {'store_id': storeId}),
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> cancel(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payments/subscription/cancel',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> createOrder(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payments/subscription/order',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> verify(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payments/subscription/verify',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class StorefrontApi {
  const StorefrontApi(this._client);

  final ApiClient _client;

  Future<JsonMap> lookup(QueryParams query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/storefront/lookup',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> directory({ApiRequestOptions? options}) =>
      _client.requestJson('/storefront/directory', options: options);

  Future<JsonMap> getStoreById(String storeId, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/storefront/store/${_encodePathSegment(storeId)}',
        options: options,
      );

  Future<JsonMap> getStore(String subdomain, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/storefront/${_encodePathSegment(subdomain)}',
        options: options,
      );

  Future<JsonMap> status(String subdomain, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/storefront/${_encodePathSegment(subdomain)}/status',
        options: options,
      );

  Future<JsonMap> themePreview(
    String subdomain,
    String token, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/theme-preview',
    options: _mergeOptions(options, query: {'token': token}),
  );

  Future<JsonMap> navigation(
    String subdomain,
    String location, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/navigation',
    options: _mergeOptions(options, query: {'location': location}),
  );

  Future<PaginatedResponse<JsonMap>> listProducts(
    String subdomain, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/storefront/${_encodePathSegment(subdomain)}/products',
    options: _mergeOptions(options, query: query),
  );

  Future<PaginatedResponse<JsonMap>> listProductsByStoreId(
    String storeId, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/storefront/store/${_encodePathSegment(storeId)}/products',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> getProduct(
    String subdomain,
    String slug, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/products/${_encodePathSegment(slug)}',
    options: options,
  );

  Future<List<JsonMap>> productsByIds(
    String subdomain,
    List<String> productIds, {
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/storefront/${_encodePathSegment(subdomain)}/products/by-ids',
    options: _mergeOptions(options, query: {'ids': productIds}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createOrder(
    String subdomain,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/orders',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<List<JsonMap>> pages(String subdomain, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/storefront/${_encodePathSegment(subdomain)}/pages',
        options: options,
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> page(
    String subdomain,
    String slug, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/pages/${_encodePathSegment(slug)}',
    options: options,
  );

  Future<List<JsonMap>> policies(
    String subdomain, {
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/storefront/${_encodePathSegment(subdomain)}/policies',
    options: options,
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> policy(
    String subdomain,
    String policyType, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/policies/${_encodePathSegment(policyType)}',
    options: options,
  );

  Future<PaginatedResponse<JsonMap>> blogPosts(
    String subdomain, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/storefront/${_encodePathSegment(subdomain)}/blog',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> blogPost(
    String subdomain,
    String slug, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/blog/${_encodePathSegment(slug)}',
    options: options,
  );

  Future<JsonMap> validateCoupon(
    String subdomain,
    QueryParams query, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/coupons/validate',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> customerOrders(
    QueryParams query, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/customer/orders',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> customerWishlist(
    QueryParams query, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/customer/wishlist',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> addCustomerWishlistItem(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/customer/wishlist',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> removeCustomerWishlistItem(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/customer/wishlist',
    options: _mergeOptions(options, method: HttpMethod.delete, body: input),
  );

  Future<JsonMap> syncCustomerWishlist(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/customer/wishlist/sync',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class AnalyticsApi {
  const AnalyticsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> dashboard(QueryParams query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/analytics/dashboard',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> orders(QueryParams query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/analytics/orders',
        options: _mergeOptions(options, query: query),
      );
}

class CatalogApi {
  const CatalogApi(this._client, this._basePath);

  final ApiClient _client;
  final String _basePath;

  Future<List<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestData(
    _basePath,
    options: _mergeOptions(options, query: query),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) => _client
      .requestJson('$_basePath/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        _basePath,
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '$_basePath/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '$_basePath/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class InventoryApi {
  const InventoryApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> locations({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/inventory/locations',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createLocation(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/inventory/locations',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<List<JsonMap>> suppliers({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/inventory/suppliers',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createSupplier(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/inventory/suppliers',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<List<JsonMap>> purchaseOrders({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/inventory/purchase-orders',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createPurchaseOrder(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/purchase-orders',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> receivePurchaseOrder(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/purchase-orders/${_encodePathSegment(id)}/receive',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<List<JsonMap>> transfers({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/inventory/transfers',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createTransfer(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/inventory/transfers',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> shipTransfer(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/transfers/${_encodePathSegment(id)}/ship',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> receiveTransfer(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/transfers/${_encodePathSegment(id)}/receive',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<PaginatedResponse<JsonMap>> levels({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/levels',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> adjust(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/inventory/adjust',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class PagesApi {
  const PagesApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/pages',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/pages',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/pages/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/pages/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );

  Future<JsonMap> navigation({
    required String storeId,
    String location = 'main',
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/pages/navigation',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'location': location},
    ),
  );

  Future<JsonMap> replaceNavigation(
    String location,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/pages/navigation/${_encodePathSegment(location)}',
    options: _mergeOptions(options, method: HttpMethod.put, body: input),
  );
}

class BlogApi {
  const BlogApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> posts({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/blog/posts',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> post(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/blog/posts/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> createPost(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/blog/posts',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> updatePost(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/blog/posts/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> removePost(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/blog/posts/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );

  Future<List<JsonMap>> categories(
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/blog/categories',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createCategory(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/blog/categories',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> removeCategory(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/blog/categories/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );

  Future<List<JsonMap>> tags(String storeId, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/blog/tags',
        options: _mergeOptions(options, query: {'store_id': storeId}),
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> createTag(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/blog/tags',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<PaginatedResponse<JsonMap>> comments({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/blog/comments',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> updateComment(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/blog/comments/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> removeComment(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/blog/comments/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class MediaApi {
  const MediaApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/media',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/media',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/media/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/media/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class UploadApi {
  const UploadApi(this._client);

  final ApiClient _client;

  Future<JsonMap> file(
    File file, {
    String folder = 'uploads',
    ApiRequestOptions? options,
  }) async {
    final fileName = file.path.split(Platform.pathSeparator).last;
    final formData = FormData.fromMap({
      'folder': folder,
      'file': await MultipartFile.fromFile(file.path, filename: fileName),
    });
    return _client.requestJson(
      '/upload',
      options: _mergeOptions(options, method: HttpMethod.post, body: formData),
    );
  }

  Future<JsonMap> remove(String key, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/upload/${_encodePathSegment(key)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class ShippingApi {
  ShippingApi(ApiClient client)
    : zones = ShippingZonesApi(client),
      rates = ShippingRatesApi(client);

  final ShippingZonesApi zones;
  final ShippingRatesApi rates;
}

class ShippingZonesApi {
  const ShippingZonesApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list(String storeId, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/shipping-tax/shipping/zones',
        options: _mergeOptions(options, query: {'store_id': storeId}),
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/shipping/zones',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/shipping-tax/shipping/zones/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/shipping/zones/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class ShippingRatesApi {
  const ShippingRatesApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list(String storeId, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/shipping-tax/shipping',
        options: _mergeOptions(options, query: {'store_id': storeId}),
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/shipping',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/shipping-tax/shipping/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/shipping/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class TaxesApi {
  const TaxesApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list(String storeId, {ApiRequestOptions? options}) =>
      _client.requestData(
        '/shipping-tax/taxes',
        options: _mergeOptions(options, query: {'store_id': storeId}),
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/taxes',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/shipping-tax/taxes/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/taxes/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class CouponsApi {
  const CouponsApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/coupons',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> validate(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/coupons/validate',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/coupons',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/coupons/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/coupons/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class NotificationsApi {
  const NotificationsApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> getPreferences(
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/notifications/preferences',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) => asJsonList(value).map(asJsonMap).toList(),
  );

  Future<JsonMap> upsertPreference(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/notifications/preferences',
    options: _mergeOptions(options, method: HttpMethod.put, body: input),
  );
}

class EmployeesApi {
  const EmployeesApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/employees',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/employees',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> invite(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/employees/invite',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/employees/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/employees/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class ReviewsApi {
  const ReviewsApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    required String storeId,
    String status = 'all',
    int page = 1,
    int limit = 50,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/reviews',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        'status': status,
        'page': page,
        'limit': limit,
      },
    ),
  );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/reviews/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/reviews/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class FormSubmissionsApi {
  const FormSubmissionsApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    required String storeId,
    String type = 'all',
    String status = 'all',
    int page = 1,
    int limit = 50,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/form-submissions',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        'type': type,
        'status': status,
        'page': page,
        'limit': limit,
      },
    ),
  );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/form-submissions/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/form-submissions/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );
}

class AppStoreApi {
  const AppStoreApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> apps({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/app-store/apps',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> app(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/app-store/apps/${_encodePathSegment(id)}',
        options: options,
      );

  Future<List<JsonMap>> categories({ApiRequestOptions? options}) =>
      _client.requestData<List<JsonMap>>(
        '/app-store/categories',
        options: options,
        decoder: (value) =>
            asJsonList(value).map(asJsonMap).toList(growable: false),
      );

  Future<List<JsonMap>> installations({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestData<List<JsonMap>>(
    '/app-store/installations',
    options: _mergeOptions(options, query: query),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> install(
    String appId,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/app-store/apps/${_encodePathSegment(appId)}/install',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      body: input,
      idempotencyKey:
          options?.idempotencyKey ?? input['idempotency_key'] as String?,
    ),
  );

  Future<JsonMap> uninstall(
    String appId, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/app-store/apps/${_encodePathSegment(appId)}/install',
    options: _mergeOptions(options, method: HttpMethod.delete, query: query),
  );

  Future<JsonMap> embedSession(
    String installationId, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/app-store/installations/${_encodePathSegment(installationId)}/embed-session',
    options: _mergeOptions(options, method: HttpMethod.post, query: query),
  );
}

ApiRequestOptions _mergeOptions(
  ApiRequestOptions? options, {
  HttpMethod? method,
  QueryParams? query,
  Object? body,
  String? idempotencyKey,
}) {
  return (options ?? const ApiRequestOptions()).copyWith(
    method: method,
    query: query,
    body: body,
    idempotencyKey: idempotencyKey,
  );
}

class _AuthHeaderInterceptor extends Interceptor {
  _AuthHeaderInterceptor({
    required this.defaultToken,
    required this.defaultStoreId,
    required this.tokenProvider,
    required this.storeIdProvider,
    required this.defaultHeaders,
    required this.requestIdFactory,
    required this.attachSessionCookie,
  });

  final String? defaultToken;
  final String? defaultStoreId;
  final ApiTokenProvider? tokenProvider;
  final ApiStoreIdProvider? storeIdProvider;
  final Map<String, String> defaultHeaders;
  final RequestIdFactory? requestIdFactory;
  final bool attachSessionCookie;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    for (final entry in defaultHeaders.entries) {
      options.headers.putIfAbsent(entry.key, () => entry.value);
    }
    options.headers.putIfAbsent('Accept', () => 'application/json');

    if (options.data != null && options.data is! FormData) {
      options.headers.putIfAbsent('Content-Type', () => 'application/json');
    }

    final token =
        options.extra[_extraToken] as String? ??
        await tokenProvider?.call() ??
        defaultToken;
    final storeId =
        options.extra[_extraStoreId] as String? ??
        await storeIdProvider?.call() ??
        defaultStoreId;
    final idempotencyKey = options.extra[_extraIdempotencyKey] as String?;

    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
      if (attachSessionCookie) {
        options.headers['X-LetBuyy-Session-Token'] = token;
        options.headers['Cookie'] = _appendCookieHeader(
          options.headers['Cookie']?.toString(),
          'lb_session=$token',
        );
      }
    }
    if (storeId != null && storeId.isNotEmpty) {
      options.headers['X-Store-ID'] = storeId;
    }
    if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
      options.headers['X-Idempotency-Key'] = idempotencyKey;
    }
    if (requestIdFactory != null &&
        !options.headers.containsKey('X-Request-ID')) {
      options.headers['X-Request-ID'] = requestIdFactory!.call();
    }

    handler.next(options);
  }
}

String _appendCookieHeader(String? existing, String cookie) {
  if (existing == null || existing.trim().isEmpty) return cookie;
  if (existing.contains('lb_session=')) return existing;
  return '$existing; $cookie';
}

String _requestIdFromResponse(Response<Object?> response) {
  return response.headers.value('X-Request-ID') ??
      response.headers.value('x-request-id') ??
      '';
}

Object? _unwrapData(Object? body, int status, String? requestId) {
  if (_isFailurePayload(body)) throw _errorFromBody(body, status, requestId);
  if (body is Map && body.containsKey('data')) return body['data'];
  return body;
}

bool _isFailurePayload(Object? body) {
  return body is Map && body['success'] == false && body.containsKey('error');
}

ApiException _errorFromBody(Object? body, int status, String? requestId) {
  var code = 'API_ERROR';
  var message = 'Request failed';
  var mappedStatus = status;

  if (body is Map) {
    final error = body['error'];
    if (error is Map) {
      code = (error['code'] ?? code).toString();
      message = (error['message'] ?? error['detail'] ?? message).toString();
      mappedStatus = intValue(error['status'], fallback: mappedStatus);
    } else if (error is String) {
      message = error;
    } else if (body['message'] is String) {
      message = body['message'] as String;
    }
  }

  return ApiException(
    message: message,
    statusCode: mappedStatus,
    code: code,
    requestId: requestId?.isEmpty == true ? null : requestId,
    body: body,
  );
}

ApiException _networkException(DioException error) {
  final response = error.response;
  if (response != null) {
    return _errorFromBody(
      response.data,
      response.statusCode ?? 500,
      _requestIdFromResponse(response),
    );
  }

  final isTimeout =
      error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.receiveTimeout ||
      error.type == DioExceptionType.sendTimeout;

  return ApiException(
    message: isTimeout ? 'Request timed out' : 'Network request failed',
    statusCode: isTimeout ? 408 : 0,
    code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
    body: error.message,
  );
}

bool _isRetryableStatus(int? statusCode) {
  return statusCode == 408 ||
      statusCode == 429 ||
      statusCode == 500 ||
      statusCode == 502 ||
      statusCode == 503 ||
      statusCode == 504;
}

bool _isRetryableDioError(DioException error) {
  return error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.receiveTimeout ||
      error.type == DioExceptionType.sendTimeout ||
      error.type == DioExceptionType.connectionError;
}

bool _canRetry(ApiRequestOptions options) {
  final method = options.method ?? HttpMethod.get;
  if (method == HttpMethod.get) return true;
  if (method == HttpMethod.delete)
    return options.idempotencyKey != null || options.retryUnsafe;
  return options.idempotencyKey != null || options.retryUnsafe;
}

Future<void> _retryDelay(int attempt) {
  final baseMs = 120 * pow(2, attempt).toInt();
  return Future<void>.delayed(Duration(milliseconds: baseMs));
}

Map<String, Object?>? _normalizeQuery(QueryParams? query) {
  if (query == null || query.isEmpty) return null;

  final normalized = <String, Object?>{};
  for (final entry in query.entries) {
    final value = entry.value;
    if (value == null) continue;
    if (value is Iterable) {
      normalized[entry.key] = value
          .map((item) => item.toString())
          .toList(growable: false);
    } else {
      normalized[entry.key] = value;
    }
  }
  return normalized;
}

String _normalizePath(String path) {
  final trimmed = path.trim();
  if (trimmed.isEmpty || trimmed == '/') return '';
  return trimmed.startsWith('/') ? trimmed : '/$trimmed';
}

String _trimTrailingSlash(String value) {
  return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
}

String _encodePathSegment(String value) {
  return Uri.encodeComponent(value);
}

const _extraToken = 'letbuyy.token';
const _extraStoreId = 'letbuyy.storeId';
const _extraIdempotencyKey = 'letbuyy.idempotencyKey';
