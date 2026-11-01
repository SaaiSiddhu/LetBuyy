import 'dart:io';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;

import 'api_client.dart';
import 'cache_service.dart';
import 'security_command_store.dart';

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
      _commands.serialized(() {
        final c = _importContext(store);
        return _commands.read(c, _csvCommand, check: () => _checkImport(c));
      });
  Future<ProductImportJob?> recoverCsvRegistration(String store) =>
      _commands.serialized(() async {
        final c = _importContext(store),
            pending = await _commands.read(
              _importContext(store),
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
  ) => _commands.serialized(() async {
    final c = _importContext(store);
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
  ) => _commands.serialized(() async {
    final c = _importContext(store),
        pending = await _commands.read(
          _importContext(store),
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
  }) async {
    final captured = _api.captureRequestContext();
    final created = ProductContract.fromJson(
      await _api.products.create({
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
      }),
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
    _productContracts = [..._productContracts, created];
    _products.add(product);
    await _cache?.writeJson(
      CacheService.productDetailKey(created.id, storeId: storeId),
      product,
    );
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
        options: ApiRequestOptions(storeId: storeId),
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
    final affected = (res['affected'] ?? res['data']?['affected']) as int? ?? 0;

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

  Future<List<ProductCollectionContract>> fetchCollections(
    String storeId,
  ) async {
    final rows = await _api.products.collections(storeId: storeId);
    return rows.map(ProductCollectionContract.fromJson).toList(growable: false);
  }

  Future<ProductCollectionContract> createCollection(
    ProductCollectionInput input,
  ) async {
    final row = await _api.products.createCollection(input.toJson());
    return ProductCollectionContract.fromJson(row);
  }

  Future<ProductCollectionContract> updateCollection(
    String id,
    ProductCollectionInput input,
  ) async {
    final row = await _api.products.updateCollection(id, input.toUpdateJson());
    return ProductCollectionContract.fromJson(row);
  }

  Future<void> deleteCollection(String id) async {
    await _api.products.removeCollection(id);
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

class ProductCollectionContract {
  const ProductCollectionContract({
    required this.id,
    required this.storeId,
    required this.title,
    this.description,
    this.imageUrl,
    this.handle,
    this.isActive = true,
    this.productCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  factory ProductCollectionContract.fromJson(Map<String, dynamic> data) {
    final name = data['title'] ?? data['name'];
    return ProductCollectionContract(
      id: '${data['id'] ?? ''}',
      storeId: '${data['store_id'] ?? data['storeId'] ?? ''}',
      title: name == null ? '' : '$name',
      description: data['description'] as String?,
      imageUrl: data['image_url'] as String? ?? data['imageUrl'] as String?,
      handle: data['handle'] as String? ?? data['slug'] as String?,
      isActive: data['is_active'] as bool? ?? data['isActive'] as bool? ?? true,
      productCount:
          ((data['product_count'] ?? data['products_count'] ?? 0) as num)
              .toInt(),
      createdAt: data['created_at'] as String? ?? data['createdAt'] as String?,
      updatedAt: data['updated_at'] as String? ?? data['updatedAt'] as String?,
    );
  }

  final String id;
  final String storeId;
  final String title;
  final String? description;
  final String? imageUrl;
  final String? handle;
  final bool isActive;
  final int productCount;
  final String? createdAt;
  final String? updatedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'store_id': storeId,
    'title': title,
    'description': description,
    'image_url': imageUrl,
    'handle': handle,
    'is_active': isActive,
    'product_count': productCount,
    'created_at': createdAt,
    'updated_at': updatedAt,
  };
}

class ProductCollectionInput {
  const ProductCollectionInput({
    required this.storeId,
    required this.title,
    this.description,
    this.imageUrl,
  });

  factory ProductCollectionInput.fromContract(
    ProductCollectionContract collection,
  ) {
    return ProductCollectionInput(
      storeId: collection.storeId,
      title: collection.title,
      description: collection.description,
      imageUrl: collection.imageUrl,
    );
  }

  final String storeId;
  final String title;
  final String? description;
  final String? imageUrl;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'title': title,
    if (description != null && description!.trim().isNotEmpty)
      'description': description,
    if (imageUrl != null && imageUrl!.trim().isNotEmpty) 'image_url': imageUrl,
  };

  Map<String, dynamic> toUpdateJson() => {
    'title': title,
    if (description != null) 'description': description,
    if (imageUrl != null) 'image_url': imageUrl,
  };
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
