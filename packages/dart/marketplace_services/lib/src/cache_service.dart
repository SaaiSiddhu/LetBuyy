// lib/src/cache_service.dart
// 🚀 Offline-First Cache Service for instant data loading
// Saves products and categories to local storage as JSON

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  SharedPreferences? _prefs;

  // Cache keys
  //
  // C2 corrective (27 September 2026 review, finding 2): bumped v2 -> v3. ProductProvider/
  // CategoryProvider's canonical rewire changed what these keys hold -- a listing id instead of a
  // Firestore document id, a category slug instead of its Firestore doc id, no rating/review/
  // specification data -- without changing the key itself, so a device that had already cached
  // real v2 data from before that rewire would silently keep reading it forever: getCachedProducts
  // has no way to tell "old-shaped data under this key" from "new-shaped data," and
  // initializeFromCache populating a non-empty list is exactly what made loadProducts's own
  // dedup guard skip the real canonical fetch (see that fix, same commit). The version bump is a
  // clean, unambiguous cutover -- old data is simply never read under the new key -- rather than
  // an attempt to detect or migrate an old shape in place.
  static const String _productsKey = 'cache_products_v3';
  static const String _categoriesKey = 'cache_categories_v3';
  static const String _cacheTimestampKey = 'cache_timestamp';

  // Cache expiry: 24 hours
  static const Duration _cacheExpiry = Duration(hours: 24);

  // ============================================
  // INITIALIZATION
  // ============================================

  Future<void> initialize() async {
    _prefs ??= await SharedPreferences.getInstance();
    debugPrint('💾 CacheService initialized');
  }

  bool get isExpired {
    final timestamp = _prefs?.getInt(_cacheTimestampKey) ?? 0;
    final cacheTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
    return DateTime.now().difference(cacheTime) > _cacheExpiry;
  }

  // ============================================
  // PRODUCTS CACHE
  // ============================================

  Future<void> cacheProducts(List<ProductModel> products) async {
    try {
      await initialize();

      // Convert products to cache-friendly JSON (with ID included in map)
      final jsonList = products.map((p) {
        final map = _productToCache(p);
        return map;
      }).toList();

      await _prefs?.setString(_productsKey, jsonEncode(jsonList));
      await _updateTimestamp();
      debugPrint('💾 Cached ${products.length} products');
    } catch (e) {
      debugPrint('❌ Error caching products: $e');
    }
  }

  Future<List<ProductModel>?> getCachedProducts() async {
    try {
      await initialize();
      final jsonString = _prefs?.getString(_productsKey);
      if (jsonString == null) return null;

      final jsonList = jsonDecode(jsonString) as List;
      final products = jsonList
          .map((json) => _productFromCache(json as Map<String, dynamic>))
          .toList();
      debugPrint('📦 Loaded ${products.length} products from cache');
      return products;
    } catch (e) {
      debugPrint('❌ Error loading cached products: $e');
      return null;
    }
  }

  // Convert ProductModel to cache-friendly map (no Timestamps)
  Map<String, dynamic> _productToCache(ProductModel p) {
    return {
      'id': p.id,
      'marketplaceListingId': p.marketplaceListingId,
      'catalogProductId': p.catalogProductId,
      'sellerId': p.sellerId,
      'storeName': p.storeName,
      'countryOfOrigin': p.countryOfOrigin,
      'importerDetails': p.importerDetails,
      'name': p.name,
      'description': p.description,
      'salePrice': p.salePrice,
      'originalPrice': p.originalPrice,
      'categoryId': p.categoryId,
      'subCategoryId': p.subCategoryId,
      'images': p.images,
      'stock': p.stock,
      'stockKnown': p.stockKnown,
      'priceKnown': p.priceKnown,
      'rating': p.rating,
      'reviewCount': p.reviewCount,
      'isFeatured': p.isFeatured,
      'isActive': p.isActive,
      'createdAt': p.createdAt.millisecondsSinceEpoch,
      'updatedAt': p.updatedAt.millisecondsSinceEpoch,
      'unit': p.unit,
      'isNew': p.isNew,
      'isVerified': p.isVerified,
      'isTrending': p.isTrending,
    };
  }

  // Convert cache map back to ProductModel
  ProductModel _productFromCache(Map<String, dynamic> map) {
    return ProductModel(
      id: map['id'] ?? '',
      marketplaceListingId: map['marketplaceListingId'] as String?,
      catalogProductId: map['catalogProductId'] as String?,
      sellerId: map['sellerId'] ?? '',
      storeName: map['storeName'],
      countryOfOrigin: map['countryOfOrigin'] as String?,
      importerDetails: map['importerDetails'] as String?,
      name: map['name'] ?? '',
      description: map['description'] ?? '',
      salePrice: (map['salePrice'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (map['originalPrice'] as num?)?.toDouble(),
      categoryId: map['categoryId'] ?? '',
      subCategoryId: map['subCategoryId'],
      images: List<String>.from(map['images'] ?? []),
      stock: (map['stock'] as num?)?.toInt() ?? 0,
      // Defaults to false (unknown), not true -- a cache entry written before this exact fix
      // landed (already under the v3 key from the version bump) would lack these keys, and
      // "unknown" is the honest assumption for a value we can't actually confirm, never "true."
      stockKnown: map['stockKnown'] as bool? ?? false,
      priceKnown: map['priceKnown'] as bool? ?? false,
      rating: (map['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: (map['reviewCount'] as num?)?.toInt() ?? 0,
      isFeatured: map['isFeatured'] ?? false,
      isActive: map['isActive'] ?? true,
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt'] ?? 0),
      updatedAt: DateTime.fromMillisecondsSinceEpoch(map['updatedAt'] ?? 0),
      unit: map['unit'],
      isNew: map['isNew'] ?? false,
      isVerified: map['isVerified'] ?? false,
      isTrending: map['isTrending'] ?? false,
    );
  }

  // ============================================
  // CATEGORIES CACHE
  // ============================================

  Future<void> cacheCategories(List<CategoryModel> categories) async {
    try {
      await initialize();

      final jsonList = categories.map((c) => _categoryToCache(c)).toList();
      await _prefs?.setString(_categoriesKey, jsonEncode(jsonList));
      await _updateTimestamp();
      debugPrint('💾 Cached ${categories.length} categories');
    } catch (e) {
      debugPrint('❌ Error caching categories: $e');
    }
  }

  Future<List<CategoryModel>?> getCachedCategories() async {
    try {
      await initialize();
      final jsonString = _prefs?.getString(_categoriesKey);
      if (jsonString == null) return null;

      final jsonList = jsonDecode(jsonString) as List;
      final categories = jsonList
          .map((json) => _categoryFromCache(json as Map<String, dynamic>))
          .toList();
      debugPrint('📂 Loaded ${categories.length} categories from cache');
      return categories;
    } catch (e) {
      debugPrint('❌ Error loading cached categories: $e');
      return null;
    }
  }

  // Convert CategoryModel to cache-friendly map
  Map<String, dynamic> _categoryToCache(CategoryModel c) {
    return {
      'id': c.id,
      'slug': c.slug,
      'name': c.name,
      'description': c.description,
      'parentId': c.parentId,
      'level': c.level,
      'iconImageUrl': c.iconImageUrl,
      'bannerImageUrl': c.bannerImageUrl,
      'iconName': c.iconName,
      'displayOrder': c.displayOrder,
      'isActive': c.isActive,
      'createdAt': c.createdAt.millisecondsSinceEpoch,
      'productCount': c.productCount,
    };
  }

  // Convert cache map back to CategoryModel
  CategoryModel _categoryFromCache(Map<String, dynamic> map) {
    return CategoryModel(
      id: map['id'] ?? '',
      slug: map['slug'],
      name: map['name'] ?? '',
      description: map['description'] ?? '',
      parentId: map['parentId'],
      level: (map['level'] as num?)?.toInt() ?? 0,
      iconImageUrl: map['iconImageUrl'],
      bannerImageUrl: map['bannerImageUrl'],
      iconName: map['iconName'],
      displayOrder: (map['displayOrder'] as num?)?.toInt() ?? 0,
      isActive: map['isActive'] ?? true,
      createdAt: DateTime.fromMillisecondsSinceEpoch(map['createdAt'] ?? 0),
      productCount: (map['productCount'] as num?)?.toInt() ?? 0,
    );
  }

  // ============================================
  // UTILITIES
  // ============================================

  Future<void> _updateTimestamp() async {
    await _prefs?.setInt(
      _cacheTimestampKey,
      DateTime.now().millisecondsSinceEpoch,
    );
  }

  Future<void> clearCache() async {
    await initialize();
    await _prefs?.remove(_productsKey);
    await _prefs?.remove(_categoriesKey);
    await _prefs?.remove(_cacheTimestampKey);
    debugPrint('🧹 Cache cleared');
  }
}
