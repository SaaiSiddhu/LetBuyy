import 'collection_metadata_service.dart';
import 'dart:io';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;

import 'api_client.dart';
import 'cache_service.dart';
import 'security_command_store.dart';
export 'package:letbuyy_models/letbuyy_models.dart'
    show ProductCollectionContract, ProductCollectionInput;

/// Merchant catalog transport and context-scoped presentation state.
class ProductService extends ChangeNotifier {
  final ApiClient _api;
  final CacheService? _cache;

  ProductService({
    required ApiClient api,
    CacheService? cache,
    String? Function()? actorIdProvider,
    String? Function()? storeIdProvider,
    SecurityCommandStore? commands,
  }) : _api = api,
       _cache = cache,
       _actor = actorIdProvider ?? (() => null),
       _store = storeIdProvider ?? (() => null),
       _commands = commands ?? SecurityCommandStore();
  final String? Function() _actor, _store;
  final SecurityCommandStore _commands;
  late final collectionMetadata = CollectionMetadataService(
    api: _api,
    actorIdProvider: _actor,
    storeIdProvider: _store,
    commands: _commands,
  );
  static const _csvCommand = 'product-csv-import';

  MerchantSecurityContext _importContext(String store) {
    final actor = _actor();
    if (actor == null || actor.isEmpty || _store() != store)
      throw const ApiException(
        message: 'Reload the selected account and store.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    return (
      actorId: actor,
      storeId: store,
      version: _api.captureRequestContext(),
    );
  }

  void _checkImport(MerchantSecurityContext c) {
    _checkContext(c.version, _actor() == c.actorId && _store() == c.storeId);
  }

  ApiRequestOptions _importOptions(MerchantSecurityContext c) =>
      ApiRequestOptions(
        storeId: c.storeId,
        expectedContextVersion: c.version,
        maxRetries: 0,
      );
  Future<T> _productCommandContext<T>(
    String store,
    Future<T> Function(MerchantSecurityContext) action,
  ) {
    // Identity belongs to the invocation, including time waiting behind another
    // durable command. A queued old-account action can never adopt its successor.
    late final MerchantSecurityContext captured;
    try {
      captured = _importContext(store);
    } catch (error, stack) {
      return Future.error(error, stack);
    }
    return _commands.serialized(() async {
      _checkImport(captured);
      return action(captured);
    });
  }

  ProductImportJob _importJob(
    Object? value,
    MerchantSecurityContext c, {
    String? key,
    String? hash,
    String? id,
  }) {
    final job = ProductImportJob.fromJson(asJsonMap(value));
    if (job.actorId != c.actorId ||
        job.storeId != c.storeId ||
        (key != null && job.key != key) ||
        (hash != null && job.sourceSha256 != hash) ||
        (id != null && job.id != id)) {
      throw const ApiException(
        message: 'The original import acknowledgement could not be confirmed.',
        statusCode: 502,
        code: 'PRODUCT_IMPORT_UNCONFIRMED',
      );
    }
    return job;
  }

  Future<ProductImportCapabilities> verifyCsvImport(String store) async {
    final c = _importContext(store);
    final raw = await _api.products.importCapabilities(
      store,
      options: _importOptions(c),
    );
    _checkImport(c);
    final caps = ProductImportCapabilities.fromJson(raw);
    if (caps.actorId != c.actorId || caps.storeId != c.storeId)
      throw const FormatException('Import support context changed.');
    return caps;
  }

  Future<PendingSecurityCommand?> pendingCsvImport(String store) =>
      _productCommandContext(store, (c) {
        return _commands.read(c, _csvCommand, check: () => _checkImport(c));
      });
  Future<ProductImportJob?> recoverCsvRegistration(String store) =>
      _productCommandContext(store, (c) async {
        final pending = await _commands.read(
          c,
          _csvCommand,
          check: () => _checkImport(c),
        );
        if (pending == null) return null;
        final raw = await _api.products.importByKey(
          store,
          pending.key,
          options: _importOptions(c),
        );
        _checkImport(c);
        if (raw['job'] == null) return null;
        final job = _importJob(
          raw['job'],
          c,
          key: pending.key,
          hash: pending.intent['source_sha256'] as String,
        );
        await _commands.complete(c, pending, check: () => _checkImport(c));
        return job;
      });
  Future<ProductImportJob> importProductCsv(
    String store,
    String csv,
  ) => _productCommandContext(store, (c) async {
    if (csv.trim().isEmpty || utf8.encode(csv).length > productImportMaxBytes)
      throw const FormatException('Use a CSV of at most one MiB.');
    validateProductImportRequest({
      'store_id': store,
      'csv': csv,
      'contract_version': productImportContractVersion,
      'idempotency_key': '00000000-0000-4000-8000-000000000000',
    });
    await verifyCsvImport(store);
    _checkImport(c);
    final hash = productImportSourceSha256(csv),
        pending = await _commands.prepare(c, _csvCommand, {
          'contract_version': productImportContractVersion,
          'source_sha256': hash,
        }, check: () => _checkImport(c));
    final known = await _api.products.importByKey(
      store,
      pending.key,
      options: _importOptions(c),
    );
    _checkImport(c);
    if (known['job'] != null) {
      final job = _importJob(known['job'], c, key: pending.key, hash: hash);
      await _commands.complete(c, pending, check: () => _checkImport(c));
      return job;
    }
    try {
      final raw = await _api.products.importCsv({
        'store_id': store,
        'csv': csv,
        'idempotency_key': pending.key,
        'contract_version': productImportContractVersion,
      }, options: _importOptions(c));
      _checkImport(c);
      final job = _importJob(raw['job'], c, key: pending.key, hash: hash);
      await _commands.complete(c, pending, check: () => _checkImport(c));
      return job;
    } on ApiException catch (error) {
      _checkImport(c);
      // These parser refusals occur before registration or any product write.
      if ((error.statusCode == 400 && error.code == 'INVALID_CSV') ||
          (error.statusCode == 413 && error.code == 'IMPORT_TOO_LARGE')) {
        await _commands.complete(c, pending, check: () => _checkImport(c));
      }
      rethrow;
    }
  });

  Future<ProductImportJob?> stopCsvRegistration(
    String store,
  ) => _productCommandContext(store, (c) async {
    final pending = await _commands.read(
      c,
      _csvCommand,
      check: () => _checkImport(c),
    );
    if (pending == null) return null;
    final raw = await _api.products.stopImportRegistration({
      'store_id': store,
      'idempotency_key': pending.key,
      'source_sha256': pending.intent['source_sha256'],
      'contract_version': productImportContractVersion,
    }, options: _importOptions(c));
    _checkImport(c);
    final job = _importJob(
      raw['job'],
      c,
      key: pending.key,
      hash: pending.intent['source_sha256'] as String,
    );
    if (!['stopped', 'completed', 'blocked'].contains(job.status))
      throw const ApiException(
        message:
            'The original stop could not be confirmed. Keep the request for recovery.',
        statusCode: 502,
        code: 'PRODUCT_IMPORT_UNCONFIRMED',
      );
    await _commands.complete(c, pending, check: () => _checkImport(c));
    return job;
  });
  Future<ProductImportJob> fetchCsvImport(String store, String id) async {
    final c = _importContext(store),
        raw = await _api.products.importJob(
          store,
          id,
          options: _importOptions(c),
        );
    _checkImport(c);
    return _importJob(raw['job'], c, id: id);
  }

  Future<ProductImportPage<ProductImportJob>> fetchCsvImports(
    String store, {
    int page = 1,
  }) async {
    final c = _importContext(store),
        raw = await _api.products.importHistory(
          store,
          page: page,
          options: _importOptions(c),
        );
    _checkImport(c);
    final result = ProductImportPage.history(raw);
    if (result.storeId != c.storeId ||
        result.actorId != c.actorId ||
        result.page != page ||
        result.perPage != 20)
      throw const FormatException('Import history scope changed.');
    return result;
  }

  Future<ProductImportPage<ProductImportRow>> fetchCsvRows(
    String store,
    String id, {
    int page = 1,
    String status = 'all',
  }) async {
    final c = _importContext(store),
        raw = await _api.products.importRows(
          store,
          id,
          page: page,
          status: status,
          options: _importOptions(c),
        );
    _checkImport(c);
    final result = ProductImportPage.rows(raw);
    if (result.storeId != c.storeId ||
        result.actorId != c.actorId ||
        result.jobId != id ||
        result.page != page ||
        result.perPage != 20 ||
        (status != 'all' && result.items.any((row) => row.status != status)))
      throw const FormatException('Import rows scope changed.');
    return result;
  }

  Future<ProductImportJob> recoverCsvImport(
    ProductImportJob original, {
    bool stop = false,
  }) async {
    final c = _importContext(original.storeId);
    if (original.actorId != c.actorId)
      throw const FormatException('Import account changed.');
    final raw = await _api.products.recoverImport(
      {
        'store_id': c.storeId,
        'job_id': original.id,
        'idempotency_key': original.key,
        'contract_version': productImportContractVersion,
      },
      stop: stop,
      options: _importOptions(c),
    );
    _checkImport(c);
    return _importJob(
      raw['job'],
      c,
      id: original.id,
      key: original.key,
      hash: original.sourceSha256,
    );
  }

  final Set<String> _cacheDeniedStores = {};
  List<ProductContract> _productContracts = [];
  String? _productsStoreId;
  Object? _productsContext;
  int _productsGeneration = 0;
  bool get _contextCurrent => _productsContext == _api.captureRequestContext();
  List<ProductContract> get productContracts => List.unmodifiable(
    _contextCurrent ? _productContracts : const <ProductContract>[],
  );
  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> get products => List.unmodifiable(
    _contextCurrent ? _products : const <Map<String, dynamic>>[],
  );
  List<GiftCardContract> _giftCards = [];
  List<GiftCardContract> get giftCards => List.unmodifiable(_giftCards);
  bool _isLoading = false;
  bool get isLoading => _contextCurrent && _isLoading;
  String? _productsNextCursor;
  String? get productsNextCursor =>
      _contextCurrent ? _productsNextCursor : null;
  bool _productsHasMore = false, _productsOffline = false;
  bool get productsHasMore => _contextCurrent && _productsHasMore;
  bool get productsOffline => _contextCurrent && _productsOffline;

  void _checkContext(Object? captured, [bool generationCurrent = true]) {
    if (!generationCurrent || captured != _api.captureRequestContext()) {
      throw const ApiException(
        message: 'Catalog context changed. Reload the selected store.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    }
  }

  ProductContract _product(Map<String, dynamic> row, String storeId) {
    final product = ProductContract.fromJson(row);
    if (product.storeId != storeId) {
      throw const ApiException(
        message: 'Product store could not be confirmed.',
        statusCode: 502,
        code: 'PRODUCT_SCOPE_MISMATCH',
      );
    }
    return product;
  }

  bool _offlineAllowed(Object error, String storeId) =>
      !_cacheDeniedStores.contains(storeId) &&
      (error is! ApiException ||
          (error.code != 'PRODUCT_SCOPE_MISMATCH' &&
              error.code != 'PRODUCT_FILTER_UNSUPPORTED' &&
              (error.statusCode == 0 || error.statusCode >= 500)));

  /// Search, ordering and page membership are determined by the Gateway.
  Future<List<Map<String, dynamic>>> fetchProducts(
    String storeId, {
    int page = 1,
    int limit = 20,
    String? cursor,
    String? search,
    String status = 'all',
    String sort = 'display_order',
    String order = 'asc',
    String? stockFilter,
  }) async {
    final captured = _api.captureRequestContext(),
        generation = ++_productsGeneration;
    _productsContext = captured;
    _productsStoreId = storeId;
    _products = [];
    _productContracts = [];
    _productsNextCursor = null;
    _productsHasMore = false;
    _productsOffline = false;
    _isLoading = true;
    final cacheKey = CacheService.productsKey(
      storeId,
      page,
      limit,
      cursor: cursor,
      search: search,
      status: status,
      sort: sort,
      order: order,
      stockFilter: stockFilter,
    );
    final cached = _cacheDeniedStores.contains(storeId)
        ? <Map<String, dynamic>>[]
        : (_cache?.readJsonList(cacheKey) ?? [])
              .where((row) => row['store_id'] == storeId)
              .toList();
    // Do not reveal private snapshots before a fresh access check. Offline data
    // is used only for this exact request after a transport/server failure.
    notifyListeners();
    try {
      final result = await _api.products.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          'status': status,
          'sort': sort,
          'order': order,
          if (cursor != null && cursor.trim().isNotEmpty)
            'cursor': cursor.trim(),
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
          if (stockFilter != null) 'stock_filter': stockFilter,
        },
        options: ApiRequestOptions(storeId: storeId),
      );
      _checkContext(captured, generation == _productsGeneration);
      if (stockFilter != null && result.meta['stock_filter'] != stockFilter) {
        throw const ApiException(
          message:
              'Stock filters are unavailable on this server. Select All products.',
          statusCode: 502,
          code: 'PRODUCT_FILTER_UNSUPPORTED',
        );
      }
      final contracts = result.data
          .map((row) => _product(row, storeId))
          .toList();
      final rows = contracts.map((p) => p.toJson()).toList();
      _productContracts = contracts;
      _products = rows;
      _productsNextCursor = result.nextCursor;
      _productsHasMore = result.hasMore;
      _cacheDeniedStores.remove(storeId);
      await _cache?.writeJson(cacheKey, rows);
      _checkContext(captured, generation == _productsGeneration);
      // List projections never replace a full edit/detail snapshot.
      return rows;
    } catch (error) {
      _checkContext(captured, generation == _productsGeneration);
      if (_offlineAllowed(error, storeId) && cached.isNotEmpty) {
        _productContracts = cached
            .map((row) => _product(row, storeId))
            .toList();
        _products = _productContracts.map((p) => p.toJson()).toList();
        _productsOffline = true;
        _productsNextCursor = null;
        _productsHasMore = false;
        return _products;
      }
      _products = [];
      _productContracts = [];
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        _cacheDeniedStores.add(storeId);
      }
      await _cache?.remove(cacheKey);
      _checkContext(captured, generation == _productsGeneration);
      rethrow;
    } finally {
      if (captured == _api.captureRequestContext() &&
          generation == _productsGeneration) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<Map<String, dynamic>> fetchProduct(
    String id, {
    required String storeId,
  }) async {
    final captured = _api.captureRequestContext();
    final key = CacheService.productDetailKey(id, storeId: storeId);
    try {
      final product = _product(
        await _api.products.get(
          id,
          options: ApiRequestOptions(storeId: storeId),
        ),
        storeId,
      );
      _checkContext(captured);
      if (product.id != id)
        throw const ApiException(
          message: 'Product response could not be confirmed.',
          statusCode: 502,
          code: 'PRODUCT_SCOPE_MISMATCH',
        );
      final payload = product.toJson();
      await _cache?.writeJson(key, payload);
      _checkContext(captured);
      _cacheDeniedStores.remove(storeId);
      return payload;
    } catch (error) {
      _checkContext(captured);
      final cached = _cache?.readJsonMap(key);
      if (_offlineAllowed(error, storeId) && cached != null) {
        return _product(cached, storeId).toJson();
      }
      if (error is ApiException &&
          (error.statusCode == 401 || error.statusCode == 403)) {
        _cacheDeniedStores.add(storeId);
      }
      await _cache?.remove(key);
      rethrow;
    }
  }

  /// Editing always obtains current version and complete relational identity.
  Future<ProductContract> fetchProductForEdit(String id, String storeId) async {
    final captured = _api.captureRequestContext();
    final product = _product(
      await _api.products.get(id, options: ApiRequestOptions(storeId: storeId)),
      storeId,
    );
    _checkContext(captured);
    if (product.id != id || product.version == null) {
      throw const ApiException(
        message:
            'The current product could not be loaded. Keep your draft and retry.',
        statusCode: 502,
        code: 'PRODUCT_EDIT_INVALID_RESPONSE',
      );
    }
    return product;
  }

  /// Online option reads never replace the main catalog or consult its cache.
  Future<PaginatedResponse<ProductContract>> readWarehouseProducts(
    String storeId, {
    int page = 1,
    int limit = 20,
    String search = '',
  }) async {
    final captured = _api.captureRequestContext();
    final result = await _api.products.list(
      query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
        'search': search.trim(),
        'status': 'all',
        'sort': 'name',
        'order': 'asc',
      },
      options: ApiRequestOptions(
        storeId: storeId,
        expectedContextVersion: captured,
        headers: const {'Cache-Control': 'no-store'},
      ),
    );
    _checkContext(captured);
    if (page < 1 ||
        page > 1000000 ||
        limit < 1 ||
        limit > 100 ||
        result.meta['page'] != page ||
        result.meta['per_page'] != limit ||
        result.meta['has_next'] is! bool ||
        result.data.length > limit ||
        (result.meta['has_next'] == true && result.data.length != limit)) {
      throw const ApiException(
        message: 'Product choices could not be confirmed.',
        statusCode: 503,
        code: 'WAREHOUSE_PRODUCTS_UNVERIFIED',
      );
    }
    final rows = result.data
        .map((row) => _warehouseProduct(_product(row, storeId)))
        .toList(growable: false);
    if (rows.map((row) => row.id).toSet().length != rows.length) {
      throw const ApiException(
        message: 'Product choices changed. Search again.',
        statusCode: 503,
        code: 'WAREHOUSE_PRODUCTS_UNVERIFIED',
      );
    }
    return PaginatedResponse(
      data: rows,
      total: result.total,
      page: page,
      limit: limit,
      hasMore: result.meta['has_next'] == true,
      hasNext: result.meta['has_next'] == true,
      meta: Map.unmodifiable(result.meta),
    );
  }

  ProductContract _warehouseProduct(ProductContract product) {
    if (!RegExp(
          r'^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$',
        ).hasMatch(product.id) ||
        product['name'] is! String ||
        product.name.trim().isEmpty ||
        product['deleted_at'] != null ||
        (product['site_id'] != null && product['site_id'] != product.storeId)) {
      throw const ApiException(
        message: 'Product choices could not be confirmed.',
        statusCode: 503,
        code: 'WAREHOUSE_PRODUCTS_UNVERIFIED',
      );
    }
    return product;
  }

  /// Selecting a product obtains its fresh version and complete variant owner.
  Future<ProductContract> readWarehouseProduct(
    String id,
    String storeId,
  ) async {
    final product = _warehouseProduct(await fetchProductForEdit(id, storeId));
    final raw = product['variants'];
    final ids = <String>{};
    if (raw is! List ||
        raw.any(
          (row) =>
              row is! Map ||
              row['product_id'] != id ||
              row['title'] is! String ||
              (row['title'] as String).trim().isEmpty ||
              row['id'] is! String ||
              !RegExp(
                r'^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$',
              ).hasMatch(row['id'] as String) ||
              !ids.add(row['id'] as String) ||
              row['deleted_at'] != null ||
              (row['store_id'] != null && row['store_id'] != storeId) ||
              (row['site_id'] != null && row['site_id'] != storeId),
        )) {
      throw const ApiException(
        message:
            'Current product variants could not be confirmed. Select the product again.',
        statusCode: 503,
        code: 'WAREHOUSE_PRODUCTS_UNVERIFIED',
      );
    }
    return product;
  }

  // ── Create ───────────────────────────────────────────────

  /// Create a new product.
  Future<Map<String, dynamic>> createProduct({
    required String storeId,
    required String name,
    String? description,
    double price = 0,
    double? comparePrice,
    List<String>? images,
    String? category,
    String? sku,
    String? barcode,
    String? urlHandle,
    String? seoTitle,
    String? seoDescription,
    int stock = 0,
    bool isActive = true,
    bool isFeatured = false,
    String? productType,
    String? vendor,
    String? countryOfOrigin,
    String? importerDetails,
    List<String>? tags,
    Map<String, dynamic>? metadata,
    List<Map<String, dynamic>>? variants,
    List<Map<String, dynamic>>? productOptions,
    String? idempotencyKey,
  }) async {
    return createProductCommand(
      storeId: storeId,
      idempotencyKey: idempotencyKey ?? const Uuid().v4(),
      input: {
        'store_id': storeId,
        'name': name,
        if (description != null) 'description': description,
        'price': price,
        if (comparePrice != null) 'compare_price': comparePrice,
        'images': images ?? [],
        if (category != null) 'category': category,
        if (sku != null && sku.trim().isNotEmpty) 'sku': sku.trim(),
        if (barcode != null && barcode.trim().isNotEmpty)
          'barcode': barcode.trim(),
        if (urlHandle != null && urlHandle.trim().isNotEmpty)
          'url_handle': urlHandle.trim(),
        if (seoTitle != null && seoTitle.trim().isNotEmpty)
          'seo_title': seoTitle.trim(),
        if (seoDescription != null && seoDescription.trim().isNotEmpty)
          'seo_description': seoDescription.trim(),
        if (productType != null && productType.trim().isNotEmpty)
          'product_type': productType.trim(),
        if (vendor != null && vendor.trim().isNotEmpty) 'vendor': vendor.trim(),
        if (countryOfOrigin != null && countryOfOrigin.trim().isNotEmpty)
          'country_of_origin': countryOfOrigin.trim(),
        if (importerDetails != null && importerDetails.trim().isNotEmpty)
          'importer_details': importerDetails.trim(),
        'stock': stock,
        'is_active': isActive,
        'is_featured': isFeatured,
        'tags': tags ?? [],
        if (metadata != null) 'metadata': metadata,
        if (variants != null) 'variants': variants,
        if (productOptions != null) 'product_options': productOptions,
      },
    );
  }

  static JsonMap _captureProductInput(JsonMap input) {
    // Catalog schemas own attribute names, including an option named "Code".
    // Capture a sorted, immutable JSON value for stable original-key retries.
    Object? freeze(Object? value) => value is Map
        ? Map<String, dynamic>.unmodifiable({
            for (final key in value.keys.cast<String>().toList()..sort())
              key: freeze(value[key]),
          })
        : value is List
        ? List<Object?>.unmodifiable(value.map(freeze))
        : value;
    return freeze(jsonDecode(jsonEncode(input))) as JsonMap;
  }

  /// Dispatch the captured canonical create request with its original retry key.
  /// The existing Gateway receipt and live permission checks own every effect.
  Future<Map<String, dynamic>> createProductCommand({
    required String storeId,
    required Map<String, dynamic> input,
    required String idempotencyKey,
    int? maxRetries,
  }) async {
    if (input['store_id'] != storeId) {
      throw const ApiException(
        message: 'The product store changed. Reopen the form.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    }
    final captured = _api.captureRequestContext();
    final created = ProductContract.fromJson(
      await _api.products.create(
        _captureProductInput(input),
        options: ApiRequestOptions(
          storeId: storeId,
          expectedContextVersion: captured,
          idempotencyKey: idempotencyKey,
          maxRetries: maxRetries,
        ),
      ),
    );
    _checkContext(captured);
    if (created.storeId != storeId ||
        created.id.isEmpty ||
        created.name.trim().isEmpty ||
        created.version == null ||
        created.version! <= 0) {
      throw const ApiException(
        message:
            'Product creation could not be confirmed. Retry the original request.',
        statusCode: 502,
        code: 'PRODUCT_CREATE_INVALID_RESPONSE',
      );
    }
    final product = created.toJson();
    await _cache?.writeJson(
      CacheService.productDetailKey(created.id, storeId: storeId),
      product,
    );
    _checkContext(captured);
    if (_productsStoreId != storeId || !_contextCurrent) {
      _products = [];
      _productContracts = [];
    }
    _productsStoreId = storeId;
    _productsContext = captured;
    _productContracts = [
      ..._productContracts.where((p) => p.id != created.id),
      created,
    ];
    _products = [..._products.where((p) => p['id'] != created.id), product];
    notifyListeners();
    return product;
  }

  /// Add one clearly labeled inactive sample product to an empty store.
  Future<Map<String, dynamic>> seedSampleProduct(String storeId) async {
    final captured = _api.captureRequestContext();
    final created = ProductContract.fromJson(
      await _api.products.sample({'store_id': storeId}),
    );
    _checkContext(captured);
    if (created.storeId != storeId)
      throw const ApiException(
        message: 'Product store could not be confirmed.',
        statusCode: 502,
        code: 'PRODUCT_SCOPE_MISMATCH',
      );
    if (_productsStoreId != storeId || !_contextCurrent) {
      _products = [];
      _productContracts = [];
    }
    _productsStoreId = storeId;
    _productsContext = captured;
    final product = created.toJson();
    _productContracts = [
      created,
      ..._productContracts.where((item) => item.id != created.id),
    ];
    _products = [
      product,
      ..._products.where((item) => item['id'] != created.id),
    ];
    await _cache?.writeJson(
      CacheService.productDetailKey(created.id, storeId: storeId),
      product,
    );
    notifyListeners();
    return product;
  }

  // ── Update ───────────────────────────────────────────────

  /// Update product fields.
  Future<Map<String, dynamic>> updateProduct(
    String id,
    Map<String, dynamic> fields, {
    required String storeId,
    required int version,
    required String idempotencyKey,
  }) async {
    final captured = _api.captureRequestContext();
    final contract = ProductContract.fromJson(
      await _api.products.update(
        id,
        fields,
        version: version,
        idempotencyKey: idempotencyKey,
        options: ApiRequestOptions(
          storeId: storeId,
          expectedContextVersion: captured,
          maxRetries: 0,
        ),
      ),
    );
    _checkContext(captured);
    if (contract.id != id ||
        contract.storeId != storeId ||
        contract.version == null) {
      throw const ApiException(
        message:
            'The save response could not be confirmed. Retry the same save.',
        statusCode: 502,
        code: 'PRODUCT_EDIT_INVALID_RESPONSE',
      );
    }
    final updated = contract.toJson();
    final contractIdx = _productContracts.indexWhere((p) => p.id == id);
    if (contractIdx != -1) _productContracts[contractIdx] = contract;
    final idx = _products.indexWhere((p) => p['id'] == id);
    if (idx != -1) _products[idx] = updated;
    await _cache?.writeJson(
      CacheService.productDetailKey(id, storeId: storeId),
      updated,
    );
    notifyListeners();
    return updated;
  }

  // ── Delete ───────────────────────────────────────────────

  Future<PendingSecurityCommand?>? _statusInFlight;
  String? _statusInFlightIntent;
  Object? _statusInFlightContext;
  static const _statusCommand = 'product-status-selection';

  List<JsonMap> _statusItems(PendingSecurityCommand command) {
    final value = command.intent;
    final rows = value['items'];
    if (!const ['active', 'draft', 'archived'].contains(value['target']) ||
        rows is! List ||
        rows.isEmpty ||
        rows.length > 500) {
      throw const FormatException('The saved product changes need review.');
    }
    final ids = <String>{};
    return rows.map((row) {
      final item = asJsonMap(row);
      if (item['id'] is! String ||
          (item['id'] as String).isEmpty ||
          !ids.add(item['id']) ||
          item['name'] is! String ||
          item['version'] is! int ||
          (item['version'] as int) < 1 ||
          item['request_key'] is! String ||
          !RegExp(r'^[a-zA-Z0-9-]{8,200}$').hasMatch(item['request_key']) ||
          !const [
            'pending',
            'confirmed',
            'conflict',
          ].contains(item['outcome'])) {
        throw const FormatException('The saved product changes need review.');
      }
      return Map<String, dynamic>.from(item);
    }).toList();
  }

  Future<PendingSecurityCommand?> pendingProductStatus(String store) async {
    if (_actor() == null) return null;
    final c = _importContext(store);
    final pending = await _commands.read(
      c,
      _statusCommand,
      check: () => _checkImport(c),
    );
    if (pending != null) _statusItems(pending);
    return pending;
  }

  Future<PendingSecurityCommand?> changeProductStatuses(
    String store,
    List<ProductContract> products,
    String target,
  ) {
    // Snapshot the selected versions before queuing any asynchronous work.
    final capturedProducts = products
        .map(
          (p) => ProductContract.fromJson(
            jsonDecode(jsonEncode(p.toJson())) as JsonMap,
          ),
        )
        .toList(growable: false);
    final signature = jsonEncode({
      'actor': _actor(),
      'store': store,
      'target': target,
      'products': capturedProducts.map((p) => p.toJson()).toList(),
    });
    final scope = _api.captureRequestContext();
    if (_statusInFlight != null) {
      if (_statusInFlightIntent == signature &&
          _statusInFlightContext == scope) {
        return _statusInFlight!;
      }
      return Future.error(
        const ApiException(
          message: 'Recover the current product changes first.',
          statusCode: 409,
          code: 'PENDING_SECURITY_COMMAND',
        ),
      );
    }
    _statusInFlightIntent = signature;
    _statusInFlightContext = scope;
    late final Future<PendingSecurityCommand?> operation;
    operation = _startProductStatuses(store, capturedProducts, target)
        .whenComplete(() {
          if (identical(_statusInFlight, operation)) {
            _statusInFlight = null;
            _statusInFlightIntent = null;
            _statusInFlightContext = null;
          }
        });
    _statusInFlight = operation;
    return operation;
  }

  Future<PendingSecurityCommand?> _startProductStatuses(
    String store,
    List<ProductContract> products,
    String target,
  ) => _productCommandContext(store, (c) async {
    if (await _commands.read(c, _statusCommand, check: () => _checkImport(c)) !=
        null) {
      throw const ApiException(
        message: 'Recover the saved product changes first.',
        statusCode: 409,
        code: 'PENDING_SECURITY_COMMAND',
      );
    }
    final command = PendingSecurityCommand(
      c.actorId,
      store,
      _statusCommand,
      const Uuid().v4(),
      {
        'target': target,
        'items': products
            .map(
              (p) => {
                'id': p.id,
                'name': p.name,
                'version': p.version,
                'request_key': const Uuid().v4(),
                'outcome': 'pending',
              },
            )
            .toList(),
      },
    );
    _statusItems(command);
    if (products.any((p) => p.storeId != store)) {
      throw const FormatException('Reload products from the selected store.');
    }
    final saved = await _commands.prepare(
      c,
      _statusCommand,
      command.intent,
      proposedKey: command.key,
      check: () => _checkImport(c),
    );
    return _runProductStatuses(c, saved);
  });

  Future<PendingSecurityCommand?> retryProductStatuses(String store) =>
      _productCommandContext(store, (c) async {
        final saved = await _commands.read(
          c,
          _statusCommand,
          check: () => _checkImport(c),
        );
        return saved == null ? null : _runProductStatuses(c, saved);
      });

  Future<PendingSecurityCommand?> _runProductStatuses(
    MerchantSecurityContext c,
    PendingSecurityCommand saved,
  ) async {
    var current = saved;
    final items = _statusItems(saved),
        target = saved.intent['target'] as String;
    for (var i = 0; i < items.length; i++) {
      final item = items[i];
      if (item['outcome'] != 'pending') continue;
      _checkImport(c);
      try {
        final result = await updateProduct(
          item['id'],
          {'status': target, 'is_active': target == 'active'},
          storeId: c.storeId,
          version: item['version'],
          idempotencyKey: item['request_key'],
        );
        _checkImport(c);
        if (result['status'] != target ||
            result['is_active'] != (target == 'active') ||
            result['version'] is! int ||
            (result['version'] as int) <= (item['version'] as int)) {
          throw const ApiException(
            message:
                'The product status was not confirmed. Retry the saved request.',
            statusCode: 502,
            code: 'PRODUCT_STATUS_UNCONFIRMED',
          );
        }
        items[i] = {...item, 'outcome': 'confirmed'};
      } on ApiException catch (error) {
        _checkImport(c);
        if (error.statusCode != 409 || error.code != 'PRODUCT_VERSION_CONFLICT')
          rethrow;
        items[i] = {...item, 'outcome': 'conflict'};
      }
      current = await _commands.replaceIntent(c, current, {
        'target': target,
        'items': items,
      }, check: () => _checkImport(c));
    }
    if (items.any((item) => item['outcome'] != 'confirmed')) return current;
    await _commands.complete(c, current, check: () => _checkImport(c));
    return null;
  }

  Future<List<ProductContract>> reviewProductStatuses(String store) async {
    final c = _importContext(store),
        pending = await pendingProductStatus(store);
    if (pending == null) return const [];
    final result = <ProductContract>[];
    for (final row in _statusItems(
      pending,
    ).where((row) => row['outcome'] == 'conflict')) {
      result.add(await fetchProductForEdit(row['id'], store));
      _checkImport(c);
    }
    return result;
  }

  Future<PendingSecurityCommand?> applyReviewedProductStatuses(
    String store,
    PendingSecurityCommand original,
    List<ProductContract> reviewed,
  ) => _productCommandContext(store, (c) async {
    final items = _statusItems(original);
    final conflicts = items
        .where((item) => item['outcome'] == 'conflict')
        .toList();
    if (reviewed.length != conflicts.length ||
        reviewed.isEmpty ||
        reviewed.map((p) => p.id).toSet().length != reviewed.length) {
      throw const FormatException(
        'Review every conflicting product before applying.',
      );
    }
    final rows = {for (final p in reviewed) p.id: p};
    for (final item in conflicts) {
      final p = rows[item['id']];
      if (p == null || p.storeId != store || p.version == null) {
        throw const FormatException(
          'The reviewed product belongs to another context.',
        );
      }
      item.addAll({
        'name': p.name,
        'version': p.version,
        'request_key': const Uuid().v4(),
        'outcome': 'pending',
      });
    }
    final next = await _commands.replaceIntent(c, original, {
      'target': original.intent['target'],
      'items': items,
    }, check: () => _checkImport(c));
    return _runProductStatuses(c, next);
  });

  /// Soft-delete a product.
  Future<void> deleteProduct(String id, {String? storeId}) async {
    storeId ??= _productsStoreId;
    if (storeId == null)
      throw ArgumentError('A selected product store is required.');
    final captured = _api.captureRequestContext();
    await _api.products.remove(
      id,
      options: ApiRequestOptions(storeId: storeId),
    );
    _checkContext(captured);
    _productContracts = _productContracts
        .where((product) => product.id != id)
        .toList(growable: false);
    _products = _products.where((p) => p['id'] != id).toList(growable: false);
    await _cache?.remove(CacheService.productDetailKey(id, storeId: storeId));
    notifyListeners();
  }

  // ── Bulk operations ──────────────────────────────────────

  /// Bulk activate / deactivate / delete products.
  Future<int> bulkAction({
    required String action, // 'activate' | 'deactivate' | 'delete'
    required List<String> productIds,
    String? storeId,
  }) async {
    if (storeId == null)
      throw ArgumentError('A selected product store is required.');
    final captured = _api.captureRequestContext();
    final res = await _api.products.bulk({
      'action': action,
      'product_ids': productIds,
      'store_id': storeId,
    });
    _checkContext(captured);
    final affected = res['affected'];
    if (affected is! int ||
        affected < 0 ||
        affected > productIds.toSet().length) {
      throw const ApiException(
        message: 'The affected product count was not confirmed.',
        statusCode: 502,
        code: 'PRODUCT_BULK_UNCONFIRMED',
      );
    }

    // Refresh the local list
    await fetchProducts(storeId);
    return affected;
  }

  // ── Image upload ─────────────────────────────────────────

  /// Upload a product image and return the CDN URL.
  Future<String> uploadProductImage(
    File file, {
    required String storeId,
  }) async {
    final captured = _api.captureRequestContext();
    final url = await _api.uploadFile(
      file,
      folder: 'products',
      storeId: storeId,
      options: ApiRequestOptions(
        storeId: storeId,
        expectedContextVersion: captured,
      ),
    );
    _checkContext(captured);
    return url;
  }

  Future<Map<String, dynamic>> exportProducts(String storeId) {
    return _api.exports.products(storeId: storeId);
  }

  Future<Map<String, dynamic>> fetchExportJob(String id) {
    return _api.exports.job(id);
  }

  // ── Collections ──────────────────────────────────────────

  Future<CollectionListPage> readCollectionPage(
    String store, {
    int page = 1,
    int limit = 20,
    String search = '',
    String status = 'all',
  }) async {
    final c = _importContext(store);
    final result = await _api.products.collectionPage(
      storeId: store,
      page: page,
      limit: limit,
      search: search,
      status: status,
      options: _importOptions(c),
    );
    _checkImport(c);
    final parsed = CollectionListPage.fromParts(result.data, result.meta);
    if (parsed.page != page ||
        parsed.limit != limit ||
        parsed.rows.any((row) => row.storeId != store)) {
      throw const FormatException(
        'The selected collection page could not be confirmed.',
      );
    }
    return parsed;
  }

  CollectionMembershipSnapshot _membership(
    Object? value,
    MerchantSecurityContext c,
    String collection,
  ) {
    final result = CollectionMembershipSnapshot.fromJson(value);
    if (result.storeId != c.storeId || result.collectionId != collection) {
      throw const FormatException(
        'The collection response belongs to another store or collection.',
      );
    }
    return result;
  }

  Future<CollectionMembershipSnapshot> readCollectionMembership(
    String store,
    String collection,
  ) async {
    final c = _importContext(store);
    final result = await _api.products.collectionMembership(
      store,
      collection,
      options: _importOptions(c),
    );
    _checkImport(c);
    return _membership(result, c, collection);
  }

  String _membershipCommand(String collection) =>
      'collection-membership:$collection';
  static const _categoryCommand = 'product-category-metadata';

  Future<ProductCategoryPage> readCategoryPage(
    String store, {
    int page = 1,
    int limit = 20,
    String search = '',
  }) async {
    final c = _importContext(store);
    final raw = await _api.products.categoryPage(
      store,
      page: page,
      limit: limit,
      search: search,
      options: _importOptions(c),
    );
    _checkImport(c);
    final result = ProductCategoryPage.fromParts(raw.data, raw.meta);
    if (result.page != page ||
        result.limit != limit ||
        result.rows.any((row) => row.storeId != store))
      throw const FormatException('Category page scope changed.');
    return result;
  }

  Future<ProductCategoryContract> readCategory(String store, String id) async {
    final c = _importContext(store),
        raw = await _api.products.category(
          store,
          id,
          options: _importOptions(c),
        );
    _checkImport(c);
    final row = ProductCategoryContract.fromJson(raw);
    if (row.id != id || row.storeId != store || row.isDeleted)
      throw const FormatException('Category scope changed.');
    return row;
  }

  Future<PendingSecurityCommand?> pendingCategoryCommand(String store) =>
      _productCommandContext(
        store,
        (c) =>
            _commands.read(c, _categoryCommand, check: () => _checkImport(c)),
      );

  Future<ProductCategoryReceipt> saveCategory(
    String store,
    String operation,
    JsonMap fields, {
    String? id,
  }) {
    // Capture form contents before the global queue can wait across a store or actor switch.
    final captured = SecurityCommandStore.captureIntent(fields);
    return _productCommandContext(store, (c) async {
      if ((operation == 'create') != (id == null) ||
          id != null && !categoryUuid(id))
        throw const FormatException('Choose a valid category operation.');
      final body =
          Map<String, dynamic>.of(
              validateProductCategoryCommand(operation, {
                ...captured,
                'store_id': store,
                'idempotency_key': '00000000-0000-4000-8000-000000000000',
              }),
            )
            ..remove('store_id')
            ..remove('idempotency_key');
      if (await _commands.read(
            c,
            _categoryCommand,
            check: () => _checkImport(c),
          ) !=
          null)
        throw const FormatException(
          'Recover the saved category request before making another change.',
        );
      final pending = await _commands.prepare(c, _categoryCommand, {
        'operation': operation,
        'category_id': id,
        'fields': body,
        'outcome': 'pending',
      }, check: () => _checkImport(c));
      return _sendCategory(c, pending, firstAttempt: true);
    });
  }

  Future<ProductCategoryReceipt> retryCategory(String store) =>
      _productCommandContext(store, (c) async {
        final pending = await _commands.read(
          c,
          _categoryCommand,
          check: () => _checkImport(c),
        );
        if (pending == null)
          throw const FormatException(
            'No original category request was found.',
          );
        return _sendCategory(c, pending);
      });
  Future<ProductCategoryContract?> reviewRejectedCategory(
    String store,
  ) => _productCommandContext(store, (c) async {
    final pending = await _commands.read(
      c,
      _categoryCommand,
      check: () => _checkImport(c),
    );
    if (pending == null || pending.intent['outcome'] != 'rejected')
      throw const FormatException(
        'An unconfirmed category request cannot be discarded. Retry it first.',
      );
    final id = pending.intent['category_id'];
    ProductCategoryContract? row;
    if (id != null) {
      if (!categoryUuid(id))
        throw const FormatException(
          'The original category identity is unavailable.',
        );
      row = await readCategory(store, id);
    }
    _checkImport(c);
    await _commands.complete(c, pending, check: () => _checkImport(c));
    return row;
  });
  Future<ProductCategoryReceipt> _sendCategory(
    MerchantSecurityContext c,
    PendingSecurityCommand pending, {
    bool firstAttempt = false,
  }) async {
    final intent = pending.intent,
        operation = intent['operation'],
        id = intent['category_id'];
    if (intent.length != 4 ||
        !const ['create', 'update', 'delete'].contains(operation) ||
        (operation == 'create') != (id == null) ||
        id != null && !categoryUuid(id) ||
        !const ['pending', 'rejected'].contains(intent['outcome']))
      throw const FormatException('The saved category request needs review.');
    final body = validateProductCategoryCommand(operation, {
      ...asJsonMap(intent['fields']),
      'store_id': c.storeId,
      'idempotency_key': pending.key,
    });
    try {
      final raw = await _api.products.categoryCommand(
        operation,
        id,
        body,
        options: _importOptions(c),
      );
      _checkImport(c);
      final receipt = ProductCategoryReceipt.fromJson(raw),
          row = receipt.category;
      if (row.storeId != c.storeId ||
          id != null && row.id != id ||
          receipt.operation != operation ||
          receipt.key != pending.key ||
          body.containsKey('version') &&
              row.version <= (body['version'] as num))
        throw const FormatException(
          'The original category acknowledgement could not be confirmed.',
        );
      final confirmed = row.toJson();
      for (final field in body.entries) {
        if (!const [
              'store_id',
              'idempotency_key',
              'version',
            ].contains(field.key) &&
            confirmed[field.key] != field.value)
          throw const FormatException(
            'The category acknowledgement differs from the original fields.',
          );
      }
      await _commands.complete(c, pending, check: () => _checkImport(c));
      return receipt;
    } on ApiException catch (error) {
      _checkImport(c);
      if (error.statusCode == 409 &&
              const [
                'PRODUCT_CATEGORY_VERSION_CONFLICT',
                'PRODUCT_CATEGORY_IN_USE',
                'PRODUCT_CATEGORY_CONFLICT',
              ].contains(error.code) ||
          firstAttempt &&
              error.statusCode == 400 &&
              error.code == 'VALIDATION_ERROR') {
        await _commands.replaceIntent(c, pending, {
          ...intent,
          'outcome': 'rejected',
        }, check: () => _checkImport(c));
      }
      rethrow;
    }
  }

  Future<PendingSecurityCommand?> pendingCollectionMembership(
    String store,
    String collection,
  ) async {
    final c = _importContext(store);
    return _commands.read(
      c,
      _membershipCommand(collection),
      check: () => _checkImport(c),
    );
  }

  Future<List<PendingSecurityCommand>> pendingCollectionMemberships(
    String store,
  ) => _productCommandContext(store, (c) async {
    final records = await _commands.readPrefix(
      c,
      'collection-membership:',
      check: () => _checkImport(c),
    );
    for (final record in records) {
      final id = record.intent['collection_id'];
      if (!categoryUuid(id) ||
          record.command != _membershipCommand(id) ||
          record.intent.length != 5 ||
          record.intent['expected_version'] is! int ||
          (record.intent['expected_version'] as int) < 1 ||
          !categoryUuid(record.intent['request_key']) ||
          !const [
            'pending',
            'conflict',
            'rejected',
            'missing',
          ].contains(record.intent['outcome'])) {
        throw const FormatException(
          'A saved product selection needs recovery.',
        );
      }
      collectionProductIds(record.intent['product_ids']);
    }
    _checkImport(c);
    return records;
  });

  /// Explicit dismissal only after retrying the original owner-bound command.
  Future<CollectionMembershipSnapshot?> discardMissingCollectionMembership(
    String store,
    String collection,
  ) => _productCommandContext(store, (c) async {
    final pending = await _commands.read(
      c,
      _membershipCommand(collection),
      check: () => _checkImport(c),
    );
    if (pending == null || pending.intent['outcome'] != 'missing')
      throw const FormatException(
        'Retry the saved product selection before discarding it.',
      );
    try {
      return await _sendCollectionMembership(c, pending, collection);
    } on ApiException catch (error) {
      _checkImport(c);
      if (error.statusCode != 404 ||
          error.code != 'COLLECTION_MEMBERSHIP_NOT_FOUND')
        rethrow;
      await _commands.complete(c, pending, check: () => _checkImport(c));
      return null;
    }
  });

  Future<CollectionMembershipSnapshot> replaceCollectionMembership(
    String store,
    CollectionMembershipSnapshot original,
    List<String> ids,
  ) {
    final capturedIds = List<String>.unmodifiable(ids);
    return _productCommandContext(store, (c) async {
      if (original.storeId != store)
        throw const FormatException(
          'Select a collection from the current store.',
        );
      final selection = collectionProductIds(capturedIds);
      final pending = await _commands
          .prepare(c, _membershipCommand(original.collectionId), {
            'collection_id': original.collectionId,
            'expected_version': original.version,
            'product_ids': selection,
            'request_key': const Uuid().v4(),
            'outcome': 'pending',
          }, check: () => _checkImport(c));
      return _sendCollectionMembership(
        c,
        pending,
        original.collectionId,
        firstAttempt: true,
      );
    });
  }

  Future<CollectionMembershipSnapshot> retryCollectionMembership(
    String store,
    String collection,
  ) => _productCommandContext(store, (c) async {
    final pending = await _commands.read(
      c,
      _membershipCommand(collection),
      check: () => _checkImport(c),
    );
    if (pending == null)
      throw const FormatException('There is no saved collection request.');
    return _sendCollectionMembership(c, pending, collection);
  });
  Future<CollectionMembershipSnapshot> rebaseCollectionMembership(
    String store,
    PendingSecurityCommand original,
    CollectionMembershipSnapshot reviewed,
  ) => _productCommandContext(store, (c) async {
    if (original.intent['outcome'] != 'conflict' ||
        reviewed.storeId != store ||
        original.intent['collection_id'] != reviewed.collectionId) {
      throw const FormatException(
        'Read and review the current conflicting collection first.',
      );
    }
    final pending = await _commands.replaceIntent(c, original, {
      ...original.intent,
      'expected_version': reviewed.version,
      'request_key': const Uuid().v4(),
      'outcome': 'pending',
    }, check: () => _checkImport(c));
    return _sendCollectionMembership(
      c,
      pending,
      reviewed.collectionId,
      firstAttempt: true,
    );
  });
  Future<void> discardRejectedCollectionMembership(
    String store,
    String collection,
  ) => _productCommandContext(store, (c) async {
    final pending = await _commands.read(
      c,
      _membershipCommand(collection),
      check: () => _checkImport(c),
    );
    if (pending == null ||
        !const ['conflict', 'rejected'].contains(pending.intent['outcome'])) {
      throw const FormatException(
        'An unconfirmed collection request cannot be discarded.',
      );
    }
    await _commands.complete(c, pending, check: () => _checkImport(c));
  });
  Future<CollectionMembershipSnapshot> _sendCollectionMembership(
    MerchantSecurityContext c,
    PendingSecurityCommand command,
    String collection, {
    bool firstAttempt = false,
  }) async {
    final intent = command.intent,
        ids = collectionProductIds(intent['product_ids']),
        version = intent['expected_version'];
    if (intent['collection_id'] != collection ||
        version is! int ||
        version < 1 ||
        intent['request_key'] is! String ||
        !RegExp(
          r'^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$',
        ).hasMatch(intent['request_key'])) {
      throw const FormatException('The saved collection request needs review.');
    }
    _checkImport(c);
    try {
      final raw = await _api.products
          .replaceCollectionMembership(c.storeId, collection, {
            'product_ids': ids,
            'expected_version': version,
            'idempotency_key': intent['request_key'],
          }, options: _importOptions(c));
      _checkImport(c);
      final result = _membership(raw, c, collection);
      if (result.version <= version || !listEquals(result.productIds, ids)) {
        throw const ApiException(
          message:
              'The collection save was not confirmed. Retry its saved request.',
          statusCode: 502,
          code: 'COLLECTION_MEMBERSHIP_UNCONFIRMED',
        );
      }
      await _commands.complete(c, command, check: () => _checkImport(c));
      return result;
    } on ApiException catch (error) {
      _checkImport(c);
      if (error.statusCode == 404 &&
          error.code == 'COLLECTION_MEMBERSHIP_NOT_FOUND') {
        await _commands.replaceIntent(c, command, {
          ...intent,
          'outcome': 'missing',
        }, check: () => _checkImport(c));
      } else if (error.statusCode == 409 &&
          error.code == 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT') {
        await _commands.replaceIntent(c, command, {
          ...intent,
          'outcome': 'conflict',
        }, check: () => _checkImport(c));
      } else if (firstAttempt &&
          error.statusCode == 400 &&
          error.code == 'VALIDATION_ERROR') {
        // A retry can follow a committed reply loss. Only a known first-attempt
        // rejection can release the selection for editing with a fresh key.
        await _commands.replaceIntent(c, command, {
          ...intent,
          'outcome': 'rejected',
        }, check: () => _checkImport(c));
      }
      rethrow;
    }
  }

  // ── Gift cards ───────────────────────────────────────────

  Future<List<GiftCardContract>> fetchGiftCards(String storeId) async {
    final rows = await _api.products.giftCards(storeId: storeId);
    _giftCards = rows.map(GiftCardContract.fromJson).toList(growable: false);
    notifyListeners();
    return _giftCards;
  }

  Future<GiftCardContract> issueGiftCard(GiftCardInput input) async {
    final card = GiftCardContract.fromJson(
      await _api.products.createGiftCard(input.toJson()),
    );
    _giftCards = [card, ..._giftCards];
    notifyListeners();
    return card;
  }
}

class GiftCardContract {
  const GiftCardContract({
    required this.id,
    required this.storeId,
    required this.code,
    required this.initialValue,
    required this.balance,
    required this.status,
    required this.expiresAt,
    required this.createdAt,
  });

  factory GiftCardContract.fromJson(Map<String, dynamic> data) {
    return GiftCardContract(
      id: _stringValue(data['id']),
      storeId: _stringValue(data['store_id'] ?? data['site_id']),
      code: _stringValue(data['code']),
      initialValue: _doubleValue(
        data['initial_value'] ?? data['initialValue'] ?? data['amount'],
      ),
      balance: _doubleValue(data['balance']),
      status: _stringValue(data['status'], fallback: 'active'),
      expiresAt: _stringValue(data['expires_at'] ?? data['expiresAt']),
      createdAt: _stringValue(data['created_at'] ?? data['createdAt']),
    );
  }

  final String id;
  final String storeId;
  final String code;
  final double initialValue;
  final double balance;
  final String status;
  final String expiresAt;
  final String createdAt;

  bool get isActive => status == 'active';
  String get balanceLabel => 'INR ${balance.toStringAsFixed(2)}';
  String get initialValueLabel => 'INR ${initialValue.toStringAsFixed(2)}';
}

class GiftCardInput {
  const GiftCardInput({
    required this.storeId,
    required this.initialValue,
    this.expiresAt,
  });

  final String storeId;
  final double initialValue;
  final String? expiresAt;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'initial_value': initialValue,
    if (expiresAt != null && expiresAt!.trim().isNotEmpty)
      'expires_at': expiresAt,
  };
}

double _doubleValue(Object? value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}
