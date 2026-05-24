import 'dart:io';

import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// Service for managing products via the LetBuyy API.
///
/// Replaces Firestore + Firebase Storage with REST calls.
class ProductService extends ChangeNotifier {
  final ApiClient _api;

  ProductService({required ApiClient api}) : _api = api;

  // ── Cached state ─────────────────────────────────────────

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
      final res = await _api.get('products', query: {
        'store_id': storeId,
        'page': page,
        'limit': limit,
      });
      _products = List<Map<String, dynamic>>.from(res['data'] ?? []);
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
    final res = await _api.get('products/$id');
    return res['data'] as Map<String, dynamic>;
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
    final res = await _api.post('products', body: {
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
    });
    final product = res['data'] as Map<String, dynamic>;
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
    final res = await _api.patch('products/$id', body: fields);
    final updated = res['data'] as Map<String, dynamic>;
    final idx = _products.indexWhere((p) => p['id'] == id);
    if (idx != -1) _products[idx] = updated;
    notifyListeners();
    return updated;
  }

  // ── Delete ───────────────────────────────────────────────

  /// Soft-delete a product.
  Future<void> deleteProduct(String id) async {
    await _api.delete('products/$id');
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
    final res = await _api.post('products/bulk', body: {
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
}
