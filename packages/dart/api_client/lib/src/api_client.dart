import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';

import 'graphql.dart';
import 'types.dart';
import 'marketplace.dart';
import 'product_import.dart';

class ApiClient {
  ApiClient({
    required String baseUrl,
    String apiVersionPath = '/v1',
    String? token,
    String? storeId,
    ApiTokenProvider? tokenProvider,
    ApiStoreIdProvider? storeIdProvider,
    Object? Function()? contextVersionProvider,
    Map<String, String>? headers,
    RequestIdFactory? requestIdFactory,
    ApiUnauthorizedHandler? unauthorizedHandler,
    bool attachSessionCookie = false,
    String sessionCookieName = 'lb_session',
    Dio? dio,
    Duration connectTimeout = const Duration(seconds: 30),
    Duration receiveTimeout = const Duration(seconds: 30),
    int maxRetries = 2,
  }) : _apiVersionPath = _normalizePath(apiVersionPath),
       _defaultToken = token,
       _defaultStoreId = storeId,
       _tokenProvider = tokenProvider,
       _storeIdProvider = storeIdProvider,
       _contextVersionProvider = contextVersionProvider,
       _defaultHeaders = Map.unmodifiable(headers ?? const {}),
       _requestIdFactory = requestIdFactory,
       _unauthorizedHandler = unauthorizedHandler,
       _attachSessionCookie = attachSessionCookie,
       _sessionCookieName = sessionCookieName,
       _maxRetries = maxRetries,
       _dio = dio ?? Dio() {
    if (baseUrl.trim().isEmpty) {
      throw ArgumentError('LetBuyy API client requires a baseUrl');
    }
    if (!const {
      'lb_session',
      'lb_session_staging',
    }.contains(sessionCookieName)) {
      throw ArgumentError('Unsupported Merchant session cookie name');
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
        sessionCookieName: _sessionCookieName,
        contextVersionProvider: _contextVersionProvider,
      ),
    );
  }

  late final StoresApi stores = StoresApi(this);
  late final CustomDomainsApi customDomains = CustomDomainsApi(this);
  late final DomainsApi domains = DomainsApi(this);
  late final MetafieldsApi metafields = MetafieldsApi(this);
  late final AuthApi auth = AuthApi(this);
  late final ProductsApi products = ProductsApi(this);
  late final OrdersApi orders = OrdersApi(this);
  late final ReturnsApi returns = ReturnsApi(this);
  late final ShippingLabelsApi shippingLabels = ShippingLabelsApi(this);
  late final PayoutsApi payouts = PayoutsApi(this);
  late final WalletApi wallet = WalletApi(this);
  late final CommissionApi commission = CommissionApi(this);
  late final CodApi cod = CodApi(this);
  late final KycApi kyc = KycApi(this);
  late final TwoFactorApi twoFactor = TwoFactorApi(this);
  late final MerchantSecurityApi security = MerchantSecurityApi(this);
  late final CustomersApi customers = CustomersApi(this);
  late final ThemesApi themes = ThemesApi(this);
  late final PaymentsApi payments = PaymentsApi(this);
  late final StorefrontApi storefront = StorefrontApi(this);
  late final AnalyticsApi analytics = AnalyticsApi(this);
  late final AiApi ai = AiApi(this);
  late final CatalogApi categories = CatalogApi(this, '/categories');
  late final InventoryApi inventory = InventoryApi(this);
  late final CommerceAnalyticsApi commerceAnalytics = CommerceAnalyticsApi(
    this,
  );
  late final PagesApi pages = PagesApi(this);
  late final BlogApi blog = BlogApi(this);
  late final MediaApi media = MediaApi(this);
  late final UploadApi upload = UploadApi(this);
  late final ShippingApi shipping = ShippingApi(this);
  late final TaxesApi taxes = TaxesApi(this);
  late final CouponsApi coupons = CouponsApi(this);
  late final MerchantLoyaltyApi loyalty = MerchantLoyaltyApi(this);
  late final NotificationsApi notifications = NotificationsApi(this);
  late final WhatsAppApi whatsapp = WhatsAppApi(this);
  late final MarketingApi marketing = MarketingApi(this);
  late final OnboardingApi onboarding = OnboardingApi(this);
  late final ExportsApi exports = ExportsApi(this);
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
  final Object? Function()? _contextVersionProvider;
  final Map<String, String> _defaultHeaders;
  final RequestIdFactory? _requestIdFactory;
  final ApiUnauthorizedHandler? _unauthorizedHandler;
  final bool _attachSessionCookie;
  final String _sessionCookieName;
  final Dio _dio;
  final int _maxRetries;

  late final String _baseUrl;

  String get baseUrl => '$_baseUrl$_apiVersionPath';
  String get apiRootUrl => _baseUrl;
  Dio get dio => _dio;

  /// Read-only context snapshot; contains no credential or grant of authority.
  Object? captureRequestContext() => _contextVersionProvider?.call();

  ApiClient withOptions({
    String? baseUrl,
    String? apiVersionPath,
    String? token,
    String? storeId,
    ApiTokenProvider? tokenProvider,
    ApiStoreIdProvider? storeIdProvider,
    Object? Function()? contextVersionProvider,
    Map<String, String>? headers,
    RequestIdFactory? requestIdFactory,
    ApiUnauthorizedHandler? unauthorizedHandler,
    bool? attachSessionCookie,
    String? sessionCookieName,
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
      contextVersionProvider: contextVersionProvider ?? _contextVersionProvider,
      headers: headers ?? _defaultHeaders,
      requestIdFactory: requestIdFactory ?? _requestIdFactory,
      unauthorizedHandler: unauthorizedHandler ?? _unauthorizedHandler,
      attachSessionCookie: attachSessionCookie ?? _attachSessionCookie,
      sessionCookieName: sessionCookieName ?? _sessionCookieName,
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

  // ── Marketplace (CUS-1) ─────────────────────────────────────────────────────────────────────
  // Public reads: no token is required and none is sent. The gateway fences visibility itself
  // (migration 217's seven predicates, shared by the feed and the detail), so the client never
  // filters — it asks and renders what it is given.

  /// One page of the marketplace grid, optionally scoped to one seller's canonical site ID.
  /// Seller scope is a public listing filter; it never grants access to a seller profile.
  ///
  /// [cursor] must come from a previous page's [MarketplaceFeedPage.nextCursor]; its two halves are
  /// sent together or not at all, because the gateway rejects a half cursor and a client that
  /// rebuilds one from the last item drifts out of step with the server's ordering.
  Future<MarketplaceFeedPage> marketplaceFeed({
    String? sellerSiteId,
    String? category,
    String? search,
    String? countryOfOrigin,
    int? limit,
    MarketplaceFeedCursor? cursor,
    ApiRequestOptions? options,
  }) async {
    final query = <String, dynamic>{
      if (sellerSiteId != null) 'site_id': sellerSiteId,
      if (category != null && category.isNotEmpty) 'category': category,
      if (search != null && search.isNotEmpty) 'search': search,
      if (countryOfOrigin != null && countryOfOrigin.isNotEmpty)
        'country_of_origin': countryOfOrigin,
      if (limit != null) 'limit': limit,
      if (cursor != null) ...<String, dynamic>{
        'after_approved_at': cursor.afterApprovedAt,
        'after_id': cursor.afterId,
      },
    };
    final body = await get(
      '/storefront/marketplace/feed',
      query: query,
      options: options,
    );
    final envelope = body is Map
        ? Map<String, dynamic>.from(body)
        : const <String, dynamic>{};
    final data = envelope['data'];
    final meta = envelope['meta'];
    final items = data is List
        ? data
              .whereType<Map>()
              .map(
                (row) => MarketplaceFeedItem.fromJson(
                  Map<String, dynamic>.from(row),
                ),
              )
              .toList(growable: false)
        : const <MarketplaceFeedItem>[];
    return MarketplaceFeedPage(
      items: items,
      nextCursor: meta is Map
          ? MarketplaceFeedCursor.fromJson(meta['next_cursor'])
          : null,
      limit: meta is Map && meta['limit'] is num
          ? (meta['limit'] as num).toInt()
          : null,
    );
  }

  /// Sorted origin choices from currently visible marketplace listings.
  Future<List<String>> marketplaceOrigins({ApiRequestOptions? options}) async {
    final body = await get('/storefront/marketplace/origins', options: options);
    final envelope = body is Map
        ? Map<String, dynamic>.from(body)
        : const <String, dynamic>{};
    final data = envelope['data'];
    if (data is! List) return const <String>[];
    return data
        .whereType<Map>()
        .map((row) {
          final value = Map<String, dynamic>.from(row)['country_of_origin'];
          return value is String && value.trim().isNotEmpty
              ? value.trim()
              : null;
        })
        .whereType<String>()
        .toList(growable: false);
  }

  /// The live platform taxonomy. Inactive categories are never returned by the gateway.
  Future<List<MarketplaceCategory>> marketplaceCategories({
    ApiRequestOptions? options,
  }) async {
    final body = await get(
      '/storefront/marketplace/categories',
      options: options,
    );
    final envelope = body is Map
        ? Map<String, dynamic>.from(body)
        : const <String, dynamic>{};
    final data = envelope['data'];
    if (data is! List) return const <MarketplaceCategory>[];
    return data
        .whereType<Map>()
        .map(
          (row) => MarketplaceCategory.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList(growable: false);
  }

  /// One listing, or null when the marketplace fence excludes it.
  ///
  /// Absence is returned rather than thrown because it is an ordinary outcome here: a listing can be
  /// rejected, taken down, hidden, or belong to an unpublished store between a shopper opening the
  /// grid and tapping a card. A screen should show "no longer available", not an error.
  Future<MarketplaceListingDetail?> marketplaceListing(
    String listingId, {
    ApiRequestOptions? options,
  }) async {
    try {
      final body = await get(
        '/storefront/marketplace/listings/$listingId',
        options: options,
      );
      final envelope = body is Map
          ? Map<String, dynamic>.from(body)
          : const <String, dynamic>{};
      final data = envelope['data'];
      if (data is! Map) return null;
      return MarketplaceListingDetail.fromJson(Map<String, dynamic>.from(data));
    } on ApiException catch (error) {
      if (error.statusCode == 404) return null;
      rethrow;
    }
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
    String? storeId,
    ApiRequestOptions? options,
  }) async {
    final fileName = file.path.split(Platform.pathSeparator).last;
    final formData = FormData.fromMap({
      'folder': folder,
      if (storeId != null && storeId.trim().isNotEmpty)
        'store_id': storeId.trim(),
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
    final nextCursor = meta['next_cursor'] is String
        ? meta['next_cursor'] as String
        : null;

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
      nextCursor: nextCursor,
      meta: meta,
    );
  }

  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) {
    return requestPaginated(path, options: options, decoder: asJsonMap);
  }

  /// Compose the same finite complete settings view as the TypeScript client.
  /// Never publish a first page as the whole configuration or cross contexts.
  Future<List<JsonMap>> _settingsList(
    String path,
    String storeId, {
    ApiRequestOptions? options,
  }) async {
    final version = options?.expectedContextVersion ?? captureRequestContext(),
        rows = <JsonMap>[],
        ids = <String>{};
    int? observedTotal;
    for (var number = 1; number <= 10; number++) {
      final page = await requestPaginatedJson(
        path,
        options: (options ?? const ApiRequestOptions()).copyWith(
          storeId: storeId,
          expectedContextVersion: version,
          query: {'store_id': storeId, 'page': number, 'limit': 100},
        ),
      );
      final meta = page.meta, total = meta['total'];
      if (captureRequestContext() != version)
        throw const ApiException(
          message: 'Store access changed. Reload settings.',
          statusCode: 409,
          code: 'SESSION_CONTEXT_CHANGED',
        );
      if (meta['store_id'] != storeId ||
          meta['page'] != number ||
          meta['per_page'] != 100 ||
          total is! int ||
          total < 0 ||
          meta['has_next'] is! bool ||
          meta['has_prev'] != (number > 1) ||
          meta['total_pages'] != (total / 100).ceil() ||
          meta['has_next'] != (number * 100 < total) ||
          page.data.length != (total - (number - 1) * 100).clamp(0, 100) ||
          observedTotal != null && observedTotal != total) {
        throw const ApiException(
          message:
              'The complete settings view could not be verified. Reload settings.',
          statusCode: 503,
          code: 'SETTINGS_PAGE_UNVERIFIED',
        );
      }
      if (total > 1000)
        throw const ApiException(
          message: 'This settings collection needs a paginated view.',
          statusCode: 409,
          code: 'SETTINGS_LIMIT_REACHED',
        );
      observedTotal = total;
      for (final row in page.data) {
        if (row['id'] is! String ||
            row['id'].toString().isEmpty ||
            !ids.add(row['id'] as String) ||
            row['store_id'] != null && row['store_id'] != storeId ||
            row['site_id'] != null && row['site_id'] != storeId ||
            row['shipping_zones'] is Map &&
                (row['shipping_zones'] as Map)['store_id'] != storeId) {
          throw const ApiException(
            message: 'The selected store settings could not be confirmed.',
            statusCode: 503,
            code: 'SETTINGS_SCOPE_UNVERIFIED',
          );
        }
        rows.add(row);
      }
      if (meta['has_next'] == false) return rows;
    }
    throw const ApiException(
      message: 'This settings collection needs a paginated view.',
      statusCode: 409,
      code: 'SETTINGS_LIMIT_REACHED',
    );
  }

  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    final contextVersion =
        options?.expectedContextVersion ?? _contextVersionProvider?.call();
    void checkContext() {
      if (_contextVersionProvider != null &&
          _contextVersionProvider() != contextVersion) {
        throw const ApiException(
          message:
              'The signed-in context changed. Retry from the current account.',
          statusCode: 409,
          code: 'SESSION_CONTEXT_CHANGED',
        );
      }
    }

    final requestOptions = _withAutomaticIdempotency(
      path,
      options ?? const ApiRequestOptions(),
    );
    final maxRetries = requestOptions.maxRetries ?? _maxRetries;
    var unauthorizedRetried = false;

    for (var attempt = 0; attempt <= maxRetries; attempt += 1) {
      checkContext();
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
              _extraContextVersion: contextVersion,
            },
          ),
        );

        checkContext();
        final requestId = _requestIdFromResponse(response);
        if (_isRetryableStatus(response.statusCode) &&
            attempt < maxRetries &&
            _canRetry(requestOptions)) {
          await _retryDelay(attempt);
          continue;
        }

        if ((response.statusCode ?? 500) < 200 ||
            (response.statusCode ?? 500) >= 300) {
          final exception = _errorFromBody(
            response.data,
            response.statusCode ?? 500,
            requestId,
          );
          if (await _shouldRetryAfterUnauthorized(
            exception,
            requestOptions,
            unauthorizedRetried,
          )) {
            unauthorizedRetried = true;
            continue;
          }
          throw exception;
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
        checkContext();
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

  Future<bool> _shouldRetryAfterUnauthorized(
    ApiException exception,
    ApiRequestOptions options,
    bool alreadyRetried,
  ) async {
    if (alreadyRetried || exception.statusCode != 401) return false;
    if (options.token != null) return false;
    final handler = _unauthorizedHandler;
    if (handler == null) return false;
    return handler(exception);
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

  Future<JsonMap> health(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores/${_encodePathSegment(id)}/health',
        options: options,
      );

  Future<JsonMap> localization(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/stores/${_encodePathSegment(id)}/localization',
        options: options,
      );

  Future<JsonMap> updateLocalization(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> createMarket(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/markets',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> updateMarket(
    String id,
    String marketId,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/markets/${_encodePathSegment(marketId)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> deleteMarket(
    String id,
    String marketId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/markets/${_encodePathSegment(marketId)}',
    options: _mergeOptions(options, method: HttpMethod.delete),
  );

  Future<JsonMap> createLocale(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/locales',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> updateLocale(
    String id,
    String localeId,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/locales/${_encodePathSegment(localeId)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> deleteLocale(
    String id,
    String localeId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/locales/${_encodePathSegment(localeId)}',
    options: _mergeOptions(options, method: HttpMethod.delete),
  );

  Future<JsonMap> createTranslation(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/translations',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> updateTranslation(
    String id,
    String translationId,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/translations/${_encodePathSegment(translationId)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> deleteTranslation(
    String id,
    String translationId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/localization/translations/${_encodePathSegment(translationId)}',
    options: _mergeOptions(options, method: HttpMethod.delete),
  );

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

  Future<JsonMap> updateMethods(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/stores/${_encodePathSegment(id)}/payment-config',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );
}

class CustomDomainsApi {
  const CustomDomainsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> history(
    String domain,
    String siteId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/custom/domains/${_encodePathSegment(domain)}/history',
    options: _mergeOptions(options, query: {'site_id': siteId}),
  );

  Future<JsonMap> setRedirect(
    String domain,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/custom/domains/${_encodePathSegment(domain)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> checkout(String siteId, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/custom/checkout-domain',
        options: _mergeOptions(options, query: {'site_id': siteId}),
      );

  Future<JsonMap> prepareCheckout(
    String siteId, {
    required ApiRequestOptions options,
  }) => _client.requestJson(
    '/custom/checkout-domain',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      body: {'site_id': siteId},
    ),
  );

  Future<JsonMap> list(String siteId, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/custom/domains',
        options: _mergeOptions(options, query: {'site_id': siteId}),
      );

  Future<JsonMap> connect(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/custom/domains',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> verify(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/custom/domains/verify',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> setPrimary(
    String domain,
    String siteId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/custom/domains/${_encodePathSegment(domain)}/primary',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      body: {'site_id': siteId},
    ),
  );

  Future<JsonMap> remove(
    String domain,
    String siteId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/custom/domains/${_encodePathSegment(domain)}',
    options: _mergeOptions(
      options,
      method: HttpMethod.delete,
      query: {'site_id': siteId},
    ),
  );

  Future<JsonMap> health(
    String domain, {
    required String siteId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/custom/domains/${_encodePathSegment(domain)}/status',
    options: _mergeOptions(options, query: {'site_id': siteId}),
  );
}

class DomainsApi {
  const DomainsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> search(String query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/domains/search',
        options: _mergeOptions(options, query: {'query': query}),
      );

  Future<JsonMap> purchase(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/domains/purchase',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class MetafieldsApi {
  const MetafieldsApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> listDefinitions({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/metafields/definitions',
    options: _mergeOptions(options, query: query),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createDefinition(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/metafields/definitions',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> updateDefinition(
    String definitionId,
    JsonMap input, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/metafields/definitions/${_encodePathSegment(definitionId)}',
    options: _mergeOptions(
      options,
      method: HttpMethod.patch,
      query: query,
      body: input,
    ),
  );

  Future<JsonMap> deleteDefinition(
    String definitionId, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/metafields/definitions/${_encodePathSegment(definitionId)}',
    options: _mergeOptions(options, method: HttpMethod.delete, query: query),
  );

  Future<JsonMap> listValues({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/metafields/values',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> upsertValue(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/metafields/values',
        options: _mergeOptions(options, method: HttpMethod.put, body: input),
      );

  Future<JsonMap> deleteValue(
    String valueId, {
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/metafields/values/${_encodePathSegment(valueId)}',
    options: _mergeOptions(options, method: HttpMethod.delete, query: query),
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

  Future<JsonMap> sample(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/products/sample',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    required int version,
    required String idempotencyKey,
    ApiRequestOptions? options,
  }) {
    if (version <= 0 ||
        !RegExp(
          r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
        ).hasMatch(idempotencyKey)) {
      throw ArgumentError(
        'A current product version and stable save UUID are required.',
      );
    }
    return _client.requestJson(
      '/products/${_encodePathSegment(id)}',
      options: _mergeOptions(
        options,
        method: HttpMethod.patch,
        body: {...input, 'version': version, 'idempotency_key': idempotencyKey},
        idempotencyKey: idempotencyKey,
      ),
    );
  }

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

  Future<JsonMap> lookupBarcode({
    required String storeId,
    required String barcode,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/products/barcode/lookup',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'barcode': barcode},
    ),
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

  Future<PaginatedResponse<JsonMap>> categoryPage(
    String storeId, {
    int page = 1,
    int limit = 20,
    String search = '',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/categories',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      },
    ),
  );

  Future<JsonMap> category(
    String storeId,
    String id, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/categories/${_encodePathSegment(id)}',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {'store_id': storeId},
    ),
  );

  Future<JsonMap> categoryCommand(
    String operation,
    String? id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) {
    if (!const ['create', 'update', 'delete'].contains(operation) ||
        (operation == 'create') != (id == null))
      throw const FormatException('Choose a valid category operation.');
    return _client.requestJson(
      '/categories${id == null ? '' : '/${_encodePathSegment(id)}'}',
      options: _mergeOptions(
        options,
        method: operation == 'create'
            ? HttpMethod.post
            : operation == 'update'
            ? HttpMethod.patch
            : HttpMethod.delete,
        storeId: input['store_id'] as String?,
        body: input,
        idempotencyKey: input['idempotency_key'] as String?,
      ),
    );
  }

  Future<PaginatedResponse<JsonMap>> collectionPage({
    required String storeId,
    int page = 1,
    int limit = 20,
    String search = '',
    String status = 'all',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/products/collections',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (search.trim().isNotEmpty) 'search': search.trim(),
        if (status != 'all') 'status': status,
      },
    ),
  );

  Future<JsonMap> collectionMembership(
    String storeId,
    String id, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/products/collections/${_encodePathSegment(id)}/products',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {'store_id': storeId},
    ),
  );

  Future<JsonMap> replaceCollectionMembership(
    String storeId,
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/products/collections/${_encodePathSegment(id)}/products',
    options: _mergeOptions(
      options,
      method: HttpMethod.put,
      storeId: storeId,
      query: {'store_id': storeId},
      body: input,
      idempotencyKey: input['idempotency_key'] as String?,
    ),
  );

  Future<JsonMap> collectionMetadata(
    String storeId,
    String id, {
    bool smart = false,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '${smart ? '/smart-collections' : '/products/collections'}/${_encodePathSegment(id)}',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {'store_id': storeId},
    ),
  );
  Future<PaginatedResponse<JsonMap>> smartCollectionPage(
    String storeId, {
    int page = 1,
    int limit = 20,
    String search = '',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/smart-collections',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (search.isNotEmpty) 'search': search,
      },
    ),
  );
  Future<JsonMap> smartCollectionPreview(
    String storeId,
    String id, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/smart-collections/${_encodePathSegment(id)}/preview',
    options: _mergeOptions(
      options,
      storeId: storeId,
      query: {'store_id': storeId},
    ),
  );
  Future<JsonMap> collectionMetadataCommand(
    String operation,
    String? id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) {
    if (!const ['create', 'update', 'delete'].contains(operation) ||
        (operation == 'create') != (id == null))
      throw const FormatException('Choose a valid collection operation.');
    final smart = input['collection_type'] == 'smart',
        store = input['store_id'] as String?,
        key = input['idempotency_key'] as String?;
    final JsonMap body;
    if (smart) {
      body = {
        for (final e in input.entries)
          if (!const [
            'collection_type',
            'idempotency_key',
            'image_url',
            'store_id',
          ].contains(e.key))
            e.key == 'title' ? 'name' : e.key: e.value,
        if (operation == 'create') 'store_id': store,
      };
      if (input.containsKey('image_url'))
        throw const FormatException(
          'The smart editor does not own collection media.',
        );
    } else {
      body = Map<String, dynamic>.from(input);
    }
    return _client.requestJson(
      '${smart ? '/smart-collections' : '/products/collections'}${id == null ? '' : '/${_encodePathSegment(id)}'}',
      options: _mergeOptions(
        options,
        storeId: store,
        idempotencyKey: key,
        method: operation == 'create'
            ? HttpMethod.post
            : operation == 'update'
            ? HttpMethod.patch
            : HttpMethod.delete,
        body: body,
      ),
    );
  }

  Future<JsonMap> createCollection(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => collectionMetadataCommand('create', null, input, options: options);
  Future<JsonMap> updateCollection(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => collectionMetadataCommand('update', id, input, options: options);
  Future<JsonMap> removeCollection(
    String id, {
    JsonMap? input,
    ApiRequestOptions? options,
  }) {
    if (input == null)
      throw const FormatException(
        'Keep the observed collection version and original save key.',
      );
    return collectionMetadataCommand('delete', id, input, options: options);
  }

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

  Future<JsonMap> importCsv(JsonMap input, {ApiRequestOptions? options}) {
    final body = validateProductImportRequest(input);
    return _client.requestData<JsonMap>(
      '/export/imports/register',
      options: _mergeOptions(
        options,
        method: HttpMethod.post,
        body: body,
        storeId: body['store_id'] as String,
        idempotencyKey: body['idempotency_key'] as String,
      ),
      decoder: asJsonMap,
    );
  }

  Future<JsonMap> importCapabilities(
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/imports/capabilities',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId},
      storeId: storeId,
    ),
    decoder: asJsonMap,
  );

  Future<JsonMap> stopImportRegistration(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/imports/stop-registration',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      body: input,
      storeId: input['store_id'] as String?,
      idempotencyKey: input['idempotency_key'] as String?,
    ),
    decoder: asJsonMap,
  );
  Future<JsonMap> importByKey(
    String storeId,
    String key, {
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/imports/by-key/${_encodePathSegment(key)}',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId},
      storeId: storeId,
    ),
    decoder: asJsonMap,
  );
  Future<JsonMap> importJob(
    String storeId,
    String id, {
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/imports/${_encodePathSegment(id)}',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId},
      storeId: storeId,
    ),
    decoder: asJsonMap,
  );
  Future<JsonMap> importHistory(
    String storeId, {
    int page = 1,
    int limit = 20,
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/imports',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'page': page, 'limit': limit},
      storeId: storeId,
    ),
    decoder: asJsonMap,
  );
  Future<JsonMap> importRows(
    String storeId,
    String id, {
    int page = 1,
    int limit = 20,
    String status = 'all',
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/jobs/${_encodePathSegment(id)}/rows',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        'status': status,
      },
      storeId: storeId,
    ),
    decoder: asJsonMap,
  );
  Future<JsonMap> recoverImport(
    JsonMap input, {
    required bool stop,
    ApiRequestOptions? options,
  }) => _client.requestData<JsonMap>(
    '/export/jobs/${_encodePathSegment(input['job_id'] as String)}/${stop ? 'stop' : 'retry'}',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      body: input,
      storeId: input['store_id'] as String?,
      idempotencyKey: input['idempotency_key'] as String?,
    ),
    decoder: asJsonMap,
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

  Future<PaginatedResponse<JsonMap>> listDrafts({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/orders/drafts',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> createDraft(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/orders/drafts',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> convertDraft(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/orders/drafts/${_encodePathSegment(id)}/convert',
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

  Future<JsonMap> updateLineItems(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/orders/${_encodePathSegment(id)}/line-items',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> packingSlip(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/orders/${_encodePathSegment(id)}/packing-slip',
        options: options,
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

class ReturnsApi {
  const ReturnsApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/returns',
    options: _mergeOptions(options, query: query),
  );

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/returns/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/returns',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/returns/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> completeRefund(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/returns/${_encodePathSegment(id)}/refund/complete',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class ShippingLabelsApi {
  const ShippingLabelsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> rates(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping/labels/rates',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> buy(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping/labels',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> voidLabel(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping/labels/${_encodePathSegment(id)}/void',
        options: _mergeOptions(options, method: HttpMethod.post),
      );
}

class PayoutsApi {
  const PayoutsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> list({QueryParams? query, ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payouts',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> summary({QueryParams? query, ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payouts/summary',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> get(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/payouts/${_encodePathSegment(id)}', options: options);

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payouts',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> settle(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/payouts/${_encodePathSegment(id)}/settle',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class WalletApi {
  const WalletApi(this._client);

  final ApiClient _client;

  Future<JsonMap> get({QueryParams? query, ApiRequestOptions? options}) =>
      _client.requestJson(
        '/wallet',
        options: _mergeOptions(options, query: query),
      );
}

class CommissionApi {
  const CommissionApi(this._client);

  final ApiClient _client;

  Future<JsonMap> overview({QueryParams? query, ApiRequestOptions? options}) =>
      _client.requestJson(
        '/commission',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> reconcile(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/commission/reconcile',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class CodApi {
  const CodApi(this._client);

  final ApiClient _client;

  Future<JsonMap> overview({QueryParams? query, ApiRequestOptions? options}) =>
      _client.requestJson(
        '/cod/reconciliation',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> collect(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/cod/reconciliation',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> reconcile(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/cod/reconciliation/${_encodePathSegment(id)}/reconcile',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class KycApi {
  const KycApi(this._client);

  final ApiClient _client;

  Future<JsonMap> overview({QueryParams? query, ApiRequestOptions? options}) =>
      _client.requestJson(
        '/kyc',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> submitDocument(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/kyc/documents',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> indiaUploadIntent(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/kyc/documents/upload-intent',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> indiaUploadComplete(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/kyc/documents/upload-complete',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> uploadDocument({
    required String storeId,
    required String documentType,
    required String documentNumberLast4,
    required File file,
    ApiRequestOptions? options,
  }) async {
    const maximumBytes = 5 * 1024 * 1024;
    final handle = await file.open();
    late final List<int> bytes;
    try {
      // Bound the read itself; a file may change after a metadata length check.
      bytes = await handle.read(maximumBytes + 1);
    } finally {
      await handle.close();
    }
    if (bytes.length > maximumBytes) {
      throw const ApiException(
        message: 'Choose a document under 5 MB.',
        statusCode: 413,
        code: 'KYC_FILE_TOO_LARGE',
      );
    }
    final png =
        bytes.length >= 8 &&
        [
          137,
          80,
          78,
          71,
          13,
          10,
          26,
          10,
        ].indexed.every((entry) => bytes[entry.$1] == entry.$2);
    final jpeg =
        bytes.length >= 3 &&
        bytes[0] == 255 &&
        bytes[1] == 216 &&
        bytes[2] == 255;
    final pdf =
        bytes.length >= 5 &&
        [
          37,
          80,
          68,
          70,
          45,
        ].indexed.every((entry) => bytes[entry.$1] == entry.$2);
    final contentType = png
        ? 'image/png'
        : jpeg
        ? 'image/jpeg'
        : pdf
        ? 'application/pdf'
        : null;
    if (contentType == null) {
      throw const ApiException(
        message: 'Choose a PDF, JPEG, or PNG document.',
        statusCode: 415,
        code: 'KYC_UNSUPPORTED_FILE',
      );
    }
    final name = file.path.split(Platform.pathSeparator).last;
    final form = FormData.fromMap({
      'store_id': storeId,
      'document_type': documentType,
      'document_number_last4': documentNumberLast4,
      // Native pickers can transform an image while retaining its old suffix.
      // Declare the exact bytes sent, never a MIME inferred from that suffix.
      'file': MultipartFile.fromBytes(
        bytes,
        filename: name,
        contentType: DioMediaType.parse(contentType),
      ),
    });
    return _client.requestJson(
      '/kyc/documents/upload',
      options: _mergeOptions(options, method: HttpMethod.post, body: form),
    );
  }

  Future<JsonMap> refreshDocument(
    String id,
    String storeId, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/kyc/documents/${_encodePathSegment(id)}/refresh',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      query: {'store_id': storeId},
    ),
  );
}

class TwoFactorApi {
  const TwoFactorApi(this._client);

  final ApiClient _client;

  Future<JsonMap> overview({ApiRequestOptions? options}) =>
      _client.requestJson('/2fa', options: options);

  Future<JsonMap> sessions({ApiRequestOptions? options}) =>
      _client.requestJson('/2fa/sessions', options: options);

  Future<JsonMap> enrollTotp({ApiRequestOptions? options}) =>
      _client.requestJson(
        '/2fa/totp/enroll',
        options: _mergeOptions(options, method: HttpMethod.post),
      );

  Future<JsonMap> verifyTotp(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/2fa/totp/verify',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> disable(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/2fa/disable',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class MerchantSecurityApi {
  const MerchantSecurityApi(this._client);
  final ApiClient _client;
  Future<JsonMap> challenge(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/security/step-up/challenges',
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

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/customers',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> getByEmail(
    String email, {
    String? storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}',
    options: _mergeOptions(
      options,
      query: {if (storeId != null) 'store_id': storeId},
    ),
  );

  Future<JsonMap> update(
    String email,
    JsonMap input, {
    String? storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}',
    options: _mergeOptions(
      options,
      method: HttpMethod.patch,
      query: {if (storeId != null) 'store_id': storeId},
      body: input,
    ),
  );

  Future<List<JsonMap>> listNotes(
    String email, {
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/customers/${_encodePathSegment(email)}/notes',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> createNote(
    String email,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/notes',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> updateTags(
    String email,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/tags',
    options: _mergeOptions(options, method: HttpMethod.put, body: input),
  );

  Future<JsonMap> sendEmail(
    String email,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/email',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> merge(
    String email,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}/merge',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> remove(
    String email, {
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/${_encodePathSegment(email)}',
    options: _mergeOptions(
      options,
      method: HttpMethod.delete,
      query: {'store_id': storeId},
    ),
  );

  CustomerSegmentsApi get segments => CustomerSegmentsApi(_client);

  CustomerAddressApi get addresses => CustomerAddressApi(_client);
}

class WhatsAppApi {
  const WhatsAppApi(this._client);

  final ApiClient _client;

  Future<JsonMap> status({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/whatsapp/status',
    options: _mergeOptions(options, query: {'store_id': storeId}),
  );

  Future<List<JsonMap>> templates({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/whatsapp/templates',
    options: _mergeOptions(options, query: {'store_id': storeId}),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<List<JsonMap>> timeline({
    required String storeId,
    String? customerEmail,
    String? customerPhone,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/whatsapp/timeline',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        if (customerEmail != null && customerEmail.trim().isNotEmpty)
          'customer_email': customerEmail.trim(),
        if (customerPhone != null && customerPhone.trim().isNotEmpty)
          'customer_phone': customerPhone.trim(),
      },
    ),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> send(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/whatsapp/send',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
}

class MarketingApi {
  const MarketingApi(this._client);

  final ApiClient _client;

  EmailCampaignsApi get emailCampaigns => EmailCampaignsApi(_client);
}

class EmailCampaignsApi {
  const EmailCampaignsApi(this._client);

  final ApiClient _client;

  Future<PaginatedResponse<JsonMap>> list({
    required String storeId,
    int page = 1,
    int limit = 20,
    String? status,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/marketing/email-campaigns',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        if (status != null && status.trim().isNotEmpty) 'status': status,
      },
    ),
  );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/marketing/email-campaigns',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> get(
    String id, {
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/marketing/email-campaigns/${_encodePathSegment(id)}',
    options: _mergeOptions(options, query: {'store_id': storeId}),
  );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/marketing/email-campaigns/${_encodePathSegment(id)}',
    options: _mergeOptions(
      options,
      method: HttpMethod.patch,
      query: {'store_id': storeId},
      body: input,
    ),
  );

  Future<JsonMap> previewAudience(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/marketing/email-campaigns/audience-preview',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> send(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/marketing/email-campaigns/${_encodePathSegment(id)}/send',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class CustomerSegmentsApi {
  const CustomerSegmentsApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list({
    required String storeId,
    String? search,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/customers/segments',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      },
    ),
    decoder: (value) =>
        asJsonList(value).map(asJsonMap).toList(growable: false),
  );

  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/customers/segments',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/customers/segments/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );

  Future<JsonMap> preview(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/customers/segments/preview',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<PaginatedResponse<JsonMap>> customers(
    String id, {
    required String storeId,
    int page = 1,
    int limit = 30,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/customers/segments/${_encodePathSegment(id)}/customers',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'page': page, 'limit': limit},
    ),
  );
}

class ExportsApi {
  const ExportsApi(this._client);

  final ApiClient _client;

  Future<JsonMap> products({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/export/products',
    options: _mergeOptions(options, query: {'store_id': storeId}),
  );

  Future<JsonMap> orders({
    required String storeId,
    String? status,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/export/orders',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        if (status != null && status.trim().isNotEmpty) 'status': status,
      },
    ),
  );

  Future<JsonMap> customers({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/export/customers',
    options: _mergeOptions(options, query: {'store_id': storeId}),
  );

  Future<String> download(
    String id, {
    required String token,
    ApiRequestOptions? options,
  }) async {
    final data = await _client.request(
      '/export/jobs/${_encodePathSegment(id)}/download',
      options: _mergeOptions(options, query: {'token': token}),
    );
    if (data is! String) {
      throw const ApiException(
        message: 'Export download is unavailable.',
        statusCode: 502,
        code: 'INVALID_EXPORT_DOWNLOAD',
      );
    }
    return data;
  }

  Future<JsonMap> job(String id, {ApiRequestOptions? options}) => _client
      .requestJson('/export/jobs/${_encodePathSegment(id)}', options: options);
}

class CustomerAddressApi {
  const CustomerAddressApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list(
    String email, {
    String? storeId,
    ApiRequestOptions? options,
  }) => _client.requestData(
    '/customers/${_encodePathSegment(email)}/addresses',
    options: _mergeOptions(
      options,
      query: {if (storeId != null) 'store_id': storeId},
    ),
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

  /// The owned installed library, independent of catalog filters and pagination.
  Future<JsonMap> library(String storeId, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/themes/library',
        options: _mergeOptions(options, query: {'store_id': storeId}),
      );

  Future<JsonMap> get(String slug, {ApiRequestOptions? options}) => _client
      .requestJson('/themes/${_encodePathSegment(slug)}', options: options);

  Future<JsonMap> schema(String slug, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/themes/${_encodePathSegment(slug)}/schema',
        options: options,
      );

  Future<JsonMap> resourceSearchPayload({
    required String storeId,
    required String type,
    String query = '',
    int page = 1,
    int limit = 20,
    ApiRequestOptions? options,
  }) async {
    final body = await _client.request(
      '/themes/resource-search',
      options: _mergeOptions(
        options,
        query: {
          'store_id': storeId,
          'type': type,
          'q': query,
          'page': page,
          'limit': limit,
        },
      ),
    );
    return asJsonMap(body);
  }

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
    String templateKey = 'index',
  }) => _client.requestJson(
    '/themes/${_encodePathSegment(slug)}/editor',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        if (templateKey != 'index') 'template_key': templateKey,
      },
    ),
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
      query: {...?options?.query, 'store_id': storeId},
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

  Future<JsonMap> recover(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/payments/subscription/recover',
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

  /// Creates or refreshes a seller-bound marketplace cart using server prices and listing state.
  Future<JsonMap> createMarketplaceCart(
    String subdomain,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/marketplace-cart',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  /// Creates the signed handoff for the server cart. The returned URL contains bearer-like
  /// signature material and callers must keep it in memory only.
  Future<JsonMap> createCheckoutHandoff(
    String subdomain,
    String cartToken, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/cart/${_encodePathSegment(cartToken)}/checkout-url',
    options: _mergeOptions(options, method: HttpMethod.post),
  );

  /// Returns the minimal completion receipt for a cart token, used to recover a confirmed COD
  /// order if the app closed after the server committed but before local cart cleanup.
  Future<JsonMap> checkoutStatus(
    String subdomain,
    String cartToken, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/cart/${_encodePathSegment(cartToken)}/checkout-status',
    options: options,
  );

  /// Lists seller-configured rates that cover the signed checkout destination.
  Future<JsonMap> checkoutDeliveryOptions(
    String cartId,
    QueryParams handoff,
    QueryParams address, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/checkout/${_encodePathSegment(cartId)}/delivery-options',
    options: _mergeOptions(options, query: {...handoff, ...address}),
  );

  /// Executes one signed hosted-checkout state-machine step through the canonical Gateway.
  Future<JsonMap> checkoutStep(
    String cartId,
    String step,
    QueryParams handoff,
    JsonMap input, {
    ApiRequestOptions? options,
  }) {
    const allowedSteps = {'contact', 'delivery', 'payment-intent', 'confirm'};
    if (!allowedSteps.contains(step)) {
      throw ArgumentError.value(
        step,
        'step',
        'Unsupported hosted checkout step',
      );
    }
    return _client.requestJson(
      '/checkout/${_encodePathSegment(cartId)}/$step',
      options: _mergeOptions(
        options,
        method: HttpMethod.post,
        query: handoff,
        body: input,
      ),
    );
  }

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

  Future<JsonMap> analyticsBeacon(
    String subdomain,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/storefront/${_encodePathSegment(subdomain)}/analytics/beacon',
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

  Future<JsonMap> revenue(QueryParams query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/analytics/revenue',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> orders(QueryParams query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/analytics/orders',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> live(QueryParams query, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/analytics/live',
        options: _mergeOptions(options, query: query),
      );

  Future<JsonMap> trafficSources(
    QueryParams query, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/analytics/traffic-sources',
    options: _mergeOptions(options, query: query),
  );
}

class AiApi {
  const AiApi(this._client);

  final ApiClient _client;

  Future<JsonMap> credits(String storeId, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/ai/credits',
        options: _mergeOptions(options, query: {'store_id': storeId}),
      );

  Future<PaginatedResponse<JsonMap>> usage({
    required String storeId,
    String? feature,
    int limit = 20,
    int page = 1,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/ai/usage',
    options: _mergeOptions(
      options,
      query: {
        'store_id': storeId,
        'limit': limit,
        'page': page,
        if (feature != null && feature.isNotEmpty) 'feature': feature,
      },
    ),
  );

  Future<JsonMap> generate(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/ai/generate',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> operator(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/ai/operator',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> homepage(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/ai/homepage',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> rateUsage(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/ai/usage/${_encodePathSegment(id)}/rate',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> purchaseCredits(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/ai/credits/purchase',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
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

class CommerceAnalyticsApi {
  const CommerceAnalyticsApi(this._client);
  final ApiClient _client;
  Future<JsonMap> supplierMetrics({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/commerce-analytics/supplier-metrics',
    options: _mergeOptions(options, query: query),
  );
  Future<JsonMap> warehouseMetrics({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/commerce-analytics/warehouse-metrics',
    options: _mergeOptions(options, query: query),
  );
  Future<JsonMap> transferMetrics({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/commerce-analytics/transfer-metrics',
    options: _mergeOptions(options, query: query),
  );
  Future<JsonMap> operationsSummary({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/commerce-analytics/operations-summary',
    options: _mergeOptions(options, query: query),
  );
}

class InventoryApi {
  const InventoryApi(this._client);

  final ApiClient _client;

  Future<JsonMap> commandCapabilities({
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/command-capabilities',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(
        storeId: storeId,
        headers: {...?options?.headers, 'Cache-Control': 'no-cache'},
      ),
      query: {'store_id': storeId},
    ),
  );

  Future<JsonMap> stopWarehouseCommand(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/commands/stop',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<PaginatedResponse<JsonMap>> locations({
    required String storeId,
    int page = 1,
    int limit = 20,
    String? search,
    String status = 'all',
    String sort = 'name_asc',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/locations',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(storeId: storeId),
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        'status': status,
        'sort': sort,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      },
    ),
  );

  Future<JsonMap> createLocation(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/inventory/locations',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<PaginatedResponse<JsonMap>> suppliers({
    required String storeId,
    int page = 1,
    int limit = 20,
    String? search,
    String status = 'all',
    String sort = 'name_asc',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/suppliers',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(storeId: storeId),
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        'status': status,
        'sort': sort,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      },
    ),
  );

  Future<JsonMap> createSupplier(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/inventory/suppliers',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<PaginatedResponse<JsonMap>> purchaseOrders({
    required String storeId,
    int page = 1,
    int limit = 20,
    String? status,
    String? search,
    String sort = 'newest',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/purchase-orders',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(storeId: storeId),
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        'sort': sort,
        if (status != null) 'status': status,
        if (search != null) 'search': search,
      },
    ),
  );

  Future<JsonMap> purchaseOrder(
    String id, {
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/purchase-orders/${_encodePathSegment(id)}',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(storeId: storeId),
      method: HttpMethod.get,
      query: {'store_id': storeId},
    ),
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

  Future<PaginatedResponse<JsonMap>> transfers({
    required String storeId,
    int page = 1,
    int limit = 20,
    String? status,
    String? search,
    String sort = 'newest',
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/transfers',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(storeId: storeId),
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        'sort': sort,
        if (status != null) 'status': status,
        if (search != null) 'search': search,
      },
    ),
  );

  Future<JsonMap> transfer(
    String id, {
    required String storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/inventory/transfers/${_encodePathSegment(id)}',
    options: _mergeOptions(
      (options ?? const ApiRequestOptions()).copyWith(storeId: storeId),
      method: HttpMethod.get,
      query: {'store_id': storeId},
    ),
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

  Future<PaginatedResponse<JsonMap>> history({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/history',
    options: _mergeOptions(options, query: query),
  );

  Future<PaginatedResponse<JsonMap>> reservations({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/reservations',
    options: _mergeOptions(options, query: query),
  );
  Future<PaginatedResponse<JsonMap>> receipts({
    QueryParams? query,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/inventory/receipts',
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
    String? storeId,
    String? sha256Hex,
    String? filename,
    ApiRequestOptions? options,
  }) async {
    final fileName = filename ?? file.path.split(Platform.pathSeparator).last;
    final formData = FormData.fromMap({
      'folder': folder,
      if (sha256Hex != null) 'sha256_hex': sha256Hex,
      if (storeId != null && storeId.trim().isNotEmpty)
        'store_id': storeId.trim(),
      'file': await MultipartFile.fromFile(file.path, filename: fileName),
    });
    return _client.requestJson(
      '/upload',
      options: _mergeOptions(options, method: HttpMethod.post, body: formData),
    );
  }

  /// Read a completed original upload receipt without sending file bytes again.
  Future<JsonMap> recover(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/upload/recover',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );

  Future<JsonMap> remove(
    String key, {
    String? storeId,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/upload/${_encodePathSegment(key)}',
    options: _mergeOptions(
      options,
      method: HttpMethod.delete,
      query: {
        if (storeId != null && storeId.trim().isNotEmpty)
          'store_id': storeId.trim(),
      },
    ),
  );
}

class ShippingApi {
  ShippingApi(ApiClient client)
    : zones = ShippingZonesApi(client),
      rates = ShippingRatesApi(client),
      profiles = ShippingProfilesApi(client);

  final ShippingZonesApi zones;
  final ShippingRatesApi rates;
  final ShippingProfilesApi profiles;
}

class ShippingProfilesApi {
  const ShippingProfilesApi(this._client);
  final ApiClient _client;
  Future<List<JsonMap>> list(String storeId, {ApiRequestOptions? options}) =>
      _client._settingsList(
        '/shipping-tax/shipping/profiles',
        storeId,
        options: options,
      );
  Future<PaginatedResponse<JsonMap>> listPage(
    String storeId, {
    int page = 1,
    int limit = 100,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/shipping-tax/shipping/profiles',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'page': page, 'limit': limit},
    ).copyWith(storeId: storeId),
  );
  Future<JsonMap> create(JsonMap input, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/shipping-tax/shipping/profiles',
        options: _mergeOptions(options, method: HttpMethod.post, body: input),
      );
  Future<JsonMap> update(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/shipping-tax/shipping/profiles/${_encodePathSegment(id)}',
    options: _mergeOptions(options, method: HttpMethod.patch, body: input),
  );
}

class ShippingZonesApi {
  const ShippingZonesApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list(String storeId, {ApiRequestOptions? options}) =>
      _client._settingsList(
        '/shipping-tax/shipping/zones',
        storeId,
        options: options,
      );

  Future<PaginatedResponse<JsonMap>> listPage(
    String storeId, {
    int page = 1,
    int limit = 100,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/shipping-tax/shipping/zones',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'page': page, 'limit': limit},
    ).copyWith(storeId: storeId),
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
      _client._settingsList(
        '/shipping-tax/shipping',
        storeId,
        options: options,
      );

  Future<PaginatedResponse<JsonMap>> listPage(
    String storeId, {
    int page = 1,
    int limit = 100,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/shipping-tax/shipping',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'page': page, 'limit': limit},
    ).copyWith(storeId: storeId),
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
      _client._settingsList('/shipping-tax/taxes', storeId, options: options);

  Future<PaginatedResponse<JsonMap>> listPage(
    String storeId, {
    int page = 1,
    int limit = 100,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/shipping-tax/taxes',
    options: _mergeOptions(
      options,
      query: {'store_id': storeId, 'page': page, 'limit': limit},
    ).copyWith(storeId: storeId),
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

/// Merchant-only configuration of the canonical per-store loyalty programme.
/// JSON integer/version strings are kept exact; no local balance is computed.
class MerchantLoyaltyApi {
  MerchantLoyaltyApi(this._client);
  final ApiClient _client;
  static final _uuid = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );
  static final _integer = RegExp(r'^-?(0|[1-9][0-9]*)$');
  static final _positive = RegExp(r'^[1-9][0-9]{0,18}$');
  static bool _bps(Object? value) =>
      value is int && value >= 0 && value <= 10000;
  static bool _minor(Object? value) =>
      value is String &&
      _positive.hasMatch(value) &&
      BigInt.parse(value) <= BigInt.parse('9223372036854775807');
  static bool _version(Object? value) =>
      value is String &&
      value.contains('T') &&
      DateTime.tryParse(value) != null;
  static ApiException _invalid() => const ApiException(
    message: 'Loyalty settings returned an incomplete response. Retry loading.',
    statusCode: 502,
    code: 'INVALID_RESPONSE',
  );
  static void _site(String site) {
    if (!_uuid.hasMatch(site))
      throw ArgumentError.value(site, 'storeId', 'must be a store UUID');
  }

  static JsonMap _program(Object? value, String site) {
    if (value is! Map ||
        value['site_id'] != site ||
        value['is_active'] is! bool ||
        !_bps(value['earn_rate_bps']) ||
        !_bps(value['redeem_cap_bps']) ||
        !_minor(value['point_value_minor']) ||
        !_version(value['updated_at']))
      throw _invalid();
    return Map<String, dynamic>.unmodifiable(asJsonMap(value));
  }

  static void _aggregate(JsonMap value) {
    if (value['outstanding_points'] is! String ||
        !_integer.hasMatch(value['outstanding_points'] as String) ||
        value['valuation_policy'] != 'block_decrease_while_outstanding' ||
        value['value_decrease_allowed'] is! bool)
      throw _invalid();
  }

  Future<JsonMap> program(String storeId, {ApiRequestOptions? options}) async {
    _site(storeId);
    final value = await _client.requestJson(
      '/loyalty/program',
      options: _mergeOptions(
        options,
        method: HttpMethod.get,
        query: {'store_id': storeId},
      ).copyWith(storeId: storeId),
    );
    _aggregate(value);
    if (value['store_id'] != storeId ||
        value['enrolled'] is! bool ||
        (value['enrolled'] == false && value['program'] != null))
      throw _invalid();
    return Map<String, dynamic>.unmodifiable({
      ...value,
      'program': value['enrolled'] == true
          ? _program(value['program'], storeId)
          : null,
    });
  }

  Future<JsonMap> setProgram(
    JsonMap input, {
    required String idempotencyKey,
    ApiRequestOptions? options,
  }) async {
    final storeId = input['store_id'];
    if (storeId is! String) throw ArgumentError('store_id is required');
    _site(storeId);
    const fields = [
      'is_active',
      'earn_rate_bps',
      'redeem_cap_bps',
      'point_value_minor',
    ];
    if (!input.containsKey('expected_updated_at') ||
        (input['expected_updated_at'] != null &&
            !_version(input['expected_updated_at'])) ||
        input.keys.any(
          (key) =>
              key != 'store_id' &&
              key != 'expected_updated_at' &&
              !fields.contains(key),
        ) ||
        !fields.any(input.containsKey) ||
        (input.containsKey('is_active') && input['is_active'] is! bool) ||
        (input.containsKey('earn_rate_bps') && !_bps(input['earn_rate_bps'])) ||
        (input.containsKey('redeem_cap_bps') &&
            !_bps(input['redeem_cap_bps'])) ||
        (input.containsKey('point_value_minor') &&
            !_minor(input['point_value_minor'])) ||
        idempotencyKey.length < 8 ||
        idempotencyKey.length > 200 ||
        idempotencyKey.trim() != idempotencyKey ||
        RegExp(r'[\x00-\x1f\x7f]').hasMatch(idempotencyKey))
      throw ArgumentError('Invalid loyalty save intent or retry key');
    final value = await _client.requestJson(
      '/loyalty/program',
      options: _mergeOptions(
        options,
        method: HttpMethod.put,
        body: Map<String, dynamic>.unmodifiable(input),
        idempotencyKey: idempotencyKey,
      ).copyWith(storeId: storeId),
    );
    _aggregate(value);
    _program(value, storeId);
    if (value['created'] is! bool ||
        (value['liability_delta_minor'] != null &&
            (value['liability_delta_minor'] is! String ||
                !_integer.hasMatch(value['liability_delta_minor'] as String))))
      throw _invalid();
    return Map<String, dynamic>.unmodifiable(value);
  }
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

  Future<PaginatedResponse<JsonMap>> list({
    bool? isRead,
    String? type,
    int page = 1,
    int limit = 20,
    ApiRequestOptions? options,
  }) => _client.requestPaginatedJson(
    '/notifications',
    options: _mergeOptions(
      options,
      query: {
        'page': page,
        'limit': limit,
        if (isRead != null) 'is_read': isRead,
        if (type != null && type.trim().isNotEmpty) 'type': type.trim(),
      },
    ),
  );

  Future<int> unreadCount({ApiRequestOptions? options}) async {
    final response = await _client.requestJson(
      '/notifications/count',
      options: options,
    );
    return intValue(response['count']);
  }

  Future<JsonMap> markRead(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/notifications/${_encodePathSegment(id)}/read',
        options: _mergeOptions(options, method: HttpMethod.patch),
      );

  Future<JsonMap> markAllRead({ApiRequestOptions? options}) =>
      _client.requestJson(
        '/notifications/read-all',
        options: _mergeOptions(options, method: HttpMethod.post),
      );

  Future<JsonMap> remove(String id, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/notifications/${_encodePathSegment(id)}',
        options: _mergeOptions(options, method: HttpMethod.delete),
      );

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

  Future<JsonMap> registerDeviceToken(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/notifications/device-tokens',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );

  Future<JsonMap> unregisterDeviceToken(
    String token, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/notifications/device-tokens',
    options: _mergeOptions(
      options,
      method: HttpMethod.delete,
      body: {'token': token},
    ),
  );
}

class OnboardingApi {
  const OnboardingApi(this._client);

  final ApiClient _client;

  Future<JsonMap> saveMobileProgress(
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/onboarding/mobile-progress',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
  );
}

class EmployeesApi {
  const EmployeesApi(this._client);

  final ApiClient _client;

  Future<List<JsonMap>> list({
    required String storeId,
    ApiRequestOptions? options,
  }) async {
    final frame =
        options?.expectedContextVersion ?? _client.captureRequestContext();
    final bound = (options ?? const ApiRequestOptions()).copyWith(
      expectedContextVersion: frame,
    );
    final rows = <JsonMap>[], ids = <String>{};
    int? observedTotal;
    const unavailable = ApiException(
      statusCode: 503,
      code: 'STAFF_LIST_UNVERIFIED',
      message: 'The complete staff list could not be confirmed. Refresh staff.',
    );
    for (var number = 1; number <= 10000; number++) {
      final page = await _client.requestPaginatedJson(
        '/employees',
        options: _mergeOptions(
          bound,
          query: {'store_id': storeId, 'page': number, 'limit': 50},
        ),
      );
      final meta = page.meta, total = meta['total'];
      if (total is! int ||
          total < 0 ||
          meta['page'] != number ||
          meta['per_page'] != 50 ||
          meta['total_pages'] != (total / 50).ceil() ||
          meta['has_prev'] != (number > 1) ||
          meta['has_next'] != (number * 50 < total) ||
          observedTotal != null && observedTotal != total ||
          page.data.length != (total - (number - 1) * 50).clamp(0, 50))
        throw unavailable;
      observedTotal = total;
      for (final row in page.data) {
        final id = row['id'];
        if (id is! String ||
            id.isEmpty ||
            row['store_id'] != storeId ||
            !ids.add(id))
          throw unavailable;
        rows.add(row);
      }
      if (meta['has_next'] == false) return rows;
    }
    throw unavailable;
  }

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

  // Invitation consent is account-scoped. An unrelated selected store is not
  // the destination; the server validates the invitation's store and account.
  Future<JsonMap> previewInvite(String token, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/employees/invitations/preview',
        options: _mergeOptions(
          options,
          method: HttpMethod.post,
          body: {'token': token},
        ).copyWith(storeId: ''),
      );

  Future<JsonMap> acceptInvite(String token, {ApiRequestOptions? options}) =>
      _client.requestJson(
        '/employees/auth/accept-invite',
        options: _mergeOptions(
          options,
          method: HttpMethod.post,
          body: {'token': token},
        ).copyWith(storeId: ''),
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

  Future<JsonMap> reply(
    String id,
    JsonMap input, {
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/reviews/${_encodePathSegment(id)}/reply',
    options: _mergeOptions(options, method: HttpMethod.post, body: input),
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

  Future<JsonMap> bridgeFetch(
    JsonMap input, {
    required String accessToken,
    ApiRequestOptions? options,
  }) => _client.requestJson(
    '/app-store/bridge/fetch',
    options: _mergeOptions(
      options,
      method: HttpMethod.post,
      body: input,
    ).copyWith(token: accessToken, storeId: null),
  );
}

ApiRequestOptions _mergeOptions(
  ApiRequestOptions? options, {
  HttpMethod? method,
  QueryParams? query,
  Object? body,
  String? idempotencyKey,
  String? storeId,
}) {
  return (options ?? const ApiRequestOptions()).copyWith(
    method: method,
    query: query,
    body: body,
    idempotencyKey: idempotencyKey,
    storeId: storeId,
  );
}

final _idempotencyRandom = Random();

ApiRequestOptions _withAutomaticIdempotency(
  String path,
  ApiRequestOptions options,
) {
  final method = options.method ?? HttpMethod.get;
  if (method == HttpMethod.get || options.idempotencyKey != null) {
    return options;
  }

  final bodyKey = _idempotencyKeyFromBody(options.body);
  return options.copyWith(
    idempotencyKey: bodyKey ?? _automaticIdempotencyKey(method, path),
  );
}

String? _idempotencyKeyFromBody(Object? body) {
  if (body is Map) {
    final value = body['idempotency_key'] ?? body['idempotencyKey'];
    if (value is String && value.trim().isNotEmpty) return value.trim();
  }
  return null;
}

String _automaticIdempotencyKey(HttpMethod method, String path) {
  final normalizedPath = path
      .replaceAll(RegExp(r'[^A-Za-z0-9._:-]+'), '-')
      .replaceAll(RegExp(r'-+'), '-');
  final scope = normalizedPath.length > 80
      ? normalizedPath.substring(0, 80)
      : normalizedPath;
  final timestamp = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  final random = _idempotencyRandom.nextInt(1 << 32).toRadixString(36);
  return 'auto:${method.value}:$scope:$timestamp:$random';
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
    required this.sessionCookieName,
    required this.contextVersionProvider,
  });

  final String? defaultToken;
  final String? defaultStoreId;
  final ApiTokenProvider? tokenProvider;
  final ApiStoreIdProvider? storeIdProvider;
  final Map<String, String> defaultHeaders;
  final RequestIdFactory? requestIdFactory;
  final bool attachSessionCookie;
  final String sessionCookieName;
  final Object? Function()? contextVersionProvider;

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
          sessionCookieName,
          token,
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

    // Token/store lookup can await. Refuse before Dio dispatches bytes, not
    // merely after a response whose mutation may already have committed.
    if (contextVersionProvider != null &&
        contextVersionProvider!() != options.extra[_extraContextVersion]) {
      handler.reject(
        DioException(
          requestOptions: options,
          type: DioExceptionType.cancel,
          error: const ApiException(
            message:
                'The signed-in context changed. Retry from the current account.',
            statusCode: 409,
            code: 'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      return;
    }
    handler.next(options);
  }
}

String _appendCookieHeader(String? existing, String name, String token) {
  final parts = (existing ?? '')
      .split(';')
      .map((value) => value.trim())
      .where(
        (value) =>
            value.isNotEmpty &&
            !const {
              'lb_session',
              'lb_session_staging',
            }.contains(value.split('=').first),
      );
  return [...parts, '$name=$token'].join('; ');
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
const _extraContextVersion = 'letbuyy.contextVersion';
