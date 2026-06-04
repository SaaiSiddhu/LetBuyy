import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart';

/// Service for managing products via the LetBuyy API.
///
/// Replaces Firestore + Firebase Storage with REST calls.
class ProductService extends ChangeNotifier {
  final ApiClient _api;

  ProductService({required ApiClient api}) : _api = api;

  // ── Cached state ─────────────────────────────────────────

  List<ProductContract> _productContracts = [];
  List<ProductContract> get productContracts =>
      List.unmodifiable(_productContracts);

  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> get products => List.unmodifiable(_products);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  // ── Read ─────────────────────────────────────────────────

  /// Fetch products for a store (paginated).
  Future<List<Map<String, dynamic>>> fetchProducts(
    String storeId, {
    int page = 1,
    int limit = 20,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.products.list(
        query: {'store_id': storeId, 'page': page, 'limit': limit},
      );
      _productContracts = pageResult.data
          .map(ProductContract.fromJson)
          .toList(growable: false);
      _products = _productContracts
          .map(_toLegacyProductMap)
          .toList(growable: false);
      return _products;
    } catch (e) {
      debugPrint('❌ fetchProducts error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get a single product by ID.
  Future<Map<String, dynamic>> fetchProduct(String id) async {
    final product = ProductContract.fromJson(await _api.products.get(id));
    return _toLegacyProductMap(product);
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
    int stock = 0,
    bool isActive = true,
    bool isFeatured = false,
    List<String>? tags,
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
        'stock': stock,
        'is_active': isActive,
        'is_featured': isFeatured,
        'tags': tags ?? [],
        if (variants != null) 'variants': variants,
      }),
    );
    final product = _toLegacyProductMap(created);
    _productContracts = [..._productContracts, created];
    _products.add(product);
    notifyListeners();
    return product;
  }

  // ── Update ───────────────────────────────────────────────

  /// Update product fields.
  Future<Map<String, dynamic>> updateProduct(
    String id,
    Map<String, dynamic> fields,
  ) async {
    final contract = ProductContract.fromJson(
      await _api.products.update(id, fields),
    );
    final updated = _toLegacyProductMap(contract);
    final contractIdx = _productContracts.indexWhere((p) => p.id == id);
    if (contractIdx != -1) _productContracts[contractIdx] = contract;
    final idx = _products.indexWhere((p) => p['id'] == id);
    if (idx != -1) _products[idx] = updated;
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
    _products.removeWhere((p) => p['id'] == id);
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

  Map<String, dynamic> _toLegacyProductMap(ProductContract product) {
    final json = product.toJson();
    final comparePrice = product.comparePrice;
    final metadata = product.metadata;
    final specifications = metadata['specifications'];

    return {
      ...json,
      'id': product.id,
      'storeId': product.storeId,
      'name': product.name,
      'slug': product.slug,
      'description': product.description,
      'salePrice': product.price,
      'price': product.price,
      'originalPrice': comparePrice,
      'comparePrice': comparePrice,
      'currency': product.currency,
      'sku': product.sku ?? '',
      'stock': product.stock,
      'category': product.category,
      'categoryId': product.category ?? '',
      'images': product.images,
      'tags': product.tags,
      'isActive': product.isActive,
      'isFeatured': product.isFeatured,
      'isTrending': product.boolValue('is_trending'),
      'isNew': product.boolValue('is_new', fallback: true),
      'createdAt': product.optionalString('created_at'),
      'updatedAt': product.optionalString('updated_at'),
      'specifications': specifications is Map
          ? Map<String, dynamic>.from(specifications)
          : const <String, dynamic>{},
    };
  }
}
