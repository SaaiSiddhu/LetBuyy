import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';
import 'cache_service.dart';

/// Service for managing products via the LetBuyy API.
///
/// Replaces direct database/storage access with REST calls.
class ProductService extends ChangeNotifier {
  final ApiClient _api;
  final CacheService? _cache;

  ProductService({required ApiClient api, CacheService? cache})
    : _api = api,
      _cache = cache;

  // ── Cached state ─────────────────────────────────────────

  List<ProductContract> _productContracts = [];
  String? _productsStoreId;
  Object? _productsContext;
  List<ProductContract> get productContracts =>
      List.unmodifiable(_productContracts);

  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> get products => List.unmodifiable(_products);

  List<GiftCardContract> _giftCards = [];
  List<GiftCardContract> get giftCards => List.unmodifiable(_giftCards);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _productsNextCursor;
  String? get productsNextCursor => _productsNextCursor;

  // ── Read ─────────────────────────────────────────────────

  /// Fetch products for a store (paginated).
  Future<List<Map<String, dynamic>>> fetchProducts(
    String storeId, {
    int page = 1,
    int limit = 20,
    String? cursor,
  }) async {
    final capturedContext = _api.captureRequestContext();
    if (_productsStoreId != storeId || _productsContext != capturedContext) {
      _products = [];
      _productContracts = [];
      _productsNextCursor = null;
    }
    _productsStoreId = storeId;
    _productsContext = capturedContext;
    bool current() =>
        _api.captureRequestContext() == capturedContext &&
        _productsContext == capturedContext &&
        _productsStoreId == storeId;
    _isLoading = true;
    final normalizedCursor = cursor?.trim();
    final cacheKey = CacheService.productsKey(
      storeId,
      page,
      limit,
      cursor: normalizedCursor,
    );
    final cachedRows = _cache?.readJsonList(cacheKey) ?? [];
    if (cachedRows.isNotEmpty) {
      _productContracts = cachedRows
          .map(ProductContract.fromJson)
          .toList(growable: false);
      _products = _productContracts
          .map((product) => product.toJson())
          .toList(growable: false);
    }
    notifyListeners();

    try {
      final pageResult = await _api.products.list(
        query: {
          'store_id': storeId,
          'page': page,
          'limit': limit,
          if (normalizedCursor != null && normalizedCursor.isNotEmpty)
            'cursor': normalizedCursor,
        },
      );
      if (!current())
        throw const ApiException(
          message: 'Store access changed. Reload products.',
          statusCode: 409,
          code: 'SESSION_CONTEXT_CHANGED',
        );
      _productsNextCursor = pageResult.nextCursor;
      _productContracts = pageResult.data
          .map(ProductContract.fromJson)
          .toList(growable: false);
      _products = _productContracts
          .map((product) => product.toJson())
          .toList(growable: false);
      await _cache?.writeJson(cacheKey, _products);
      if (!current()) throw const ApiException(message: 'Store access changed. Reload products.', statusCode: 409, code: 'SESSION_CONTEXT_CHANGED');
      for (final product in _products) {
        if (!current()) throw const ApiException(message: 'Store access changed. Reload products.', statusCode: 409, code: 'SESSION_CONTEXT_CHANGED');
        final id = product['id']?.toString();
        if (id != null && id.isNotEmpty) {
          await _cache?.writeJson(CacheService.productDetailKey(id), product);
        }
      }
      return _products;
    } catch (e) {
      debugPrint('❌ fetchProducts error: $e');
      if (current() &&
          !(e is ApiException && e.statusCode >= 400 && e.statusCode < 500) &&
          _products.isNotEmpty)
        return _products;
      rethrow;
    } finally {
      if (current()) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  /// Get a single product by ID.
  Future<Map<String, dynamic>> fetchProduct(String id) async {
    final capturedContext = _api.captureRequestContext();
    try {
      final product = ProductContract.fromJson(await _api.products.get(id));
      final payload = product.toJson();
      await _cache?.writeJson(CacheService.productDetailKey(id), payload);
      return payload;
    } catch (e) {
      debugPrint('❌ fetchProduct error: $e');
      if (_api.captureRequestContext() != capturedContext ||
          (e is ApiException && e.statusCode >= 400 && e.statusCode < 500)) rethrow;
      final cached = _cache?.readJsonMap(CacheService.productDetailKey(id));
      if (cached != null) return cached;
      rethrow;
    }
  }

  /// Edit/reload must use a fresh version and complete relational option/variant identity.
  /// A cached detail remains useful for viewing, but cannot confirm conflict recovery.
  Future<ProductContract> fetchProductForEdit(String id, String storeId) async {
    final product = ProductContract.fromJson(
      await _api.products.get(id, options: ApiRequestOptions(storeId: storeId)),
    );
    if (product.id != id ||
        product.storeId != storeId ||
        product.version == null) {
      throw const ApiException(
        message:
            'The current product could not be loaded. Keep your draft and retry.',
        statusCode: 502,
        code: 'PRODUCT_EDIT_INVALID_RESPONSE',
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
    final product = created.toJson();
    _productContracts = [..._productContracts, created];
    _products.add(product);
    await _cache?.writeJson(CacheService.productDetailKey(created.id), product);
    notifyListeners();
    return product;
  }

  /// Add one clearly labeled inactive sample product to an empty store.
  Future<Map<String, dynamic>> seedSampleProduct(String storeId) async {
    final created = ProductContract.fromJson(
      await _api.products.sample({'store_id': storeId}),
    );
    final product = created.toJson();
    _productContracts = [
      created,
      ..._productContracts.where((item) => item.id != created.id),
    ];
    _products = [
      product,
      ..._products.where((item) => item['id'] != created.id),
    ];
    await _cache?.writeJson(CacheService.productDetailKey(created.id), product);
    await _cache?.writeJson(
      CacheService.productsKey(storeId, 1, 20),
      _products,
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
    final contract = ProductContract.fromJson(
      await _api.products.update(
        id,
        fields,
        version: version,
        idempotencyKey: idempotencyKey,
        options: ApiRequestOptions(storeId: storeId),
      ),
    );
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
    await _cache?.writeJson(CacheService.productDetailKey(id), updated);
    notifyListeners();
    return updated;
  }

  // ── Delete ───────────────────────────────────────────────

  /// Soft-delete a product.
  Future<void> deleteProduct(String id) async {
    await _api.products.remove(id);
    _productContracts = _productContracts
        .where((product) => product.id != id)
        .toList(growable: false);
    _products = _products.where((p) => p['id'] != id).toList(growable: false);
    await _cache?.remove(CacheService.productDetailKey(id));
    notifyListeners();
  }

  // ── Bulk operations ──────────────────────────────────────

  /// Bulk activate / deactivate / delete products.
  Future<int> bulkAction({
    required String action, // 'activate' | 'deactivate' | 'delete'
    required List<String> productIds,
    String? storeId,
  }) async {
    final res = await _api.products.bulk({
      'action': action,
      'product_ids': productIds,
      if (storeId != null) 'store_id': storeId,
    });
    final affected = res['data']?['affected'] as int? ?? 0;

    // Refresh the local list
    if (storeId != null) {
      await fetchProducts(storeId);
    }
    return affected;
  }

  // ── Image upload ─────────────────────────────────────────

  /// Upload a product image and return the CDN URL.
  Future<String> uploadProductImage(File file) async {
    return _api.uploadFile(file, folder: 'products');
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
