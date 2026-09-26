import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/src/product_model.dart';
import '../cache_service.dart';

class ProductProvider with ChangeNotifier {
  ProductProvider({required ApiClient client}) : _client = client;

  final ApiClient _client;
  final CacheService _cacheService = CacheService();

  List<ProductModel> _products = [];
  List<ProductModel> _recentlyViewedProducts = [];
  ProductModel? _selectedProduct;
  bool _isLoading = false;
  String? _error;
  bool _initializedFromCache = false;

  // ✅ NEW: State variables for variant management
  ProductVariant? _selectedVariant;
  Map<String, String> _selectedOptions = {};

  // --- Getters ---
  List<ProductModel> get products => _products;
  List<ProductModel> get recentlyViewedProducts => _recentlyViewedProducts;
  ProductModel? get selectedProduct => _selectedProduct;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int get productCount => _products.length;
  bool get hasProducts => _products.isNotEmpty;

  // ✅ NEW: Getters for variants
  ProductVariant? get selectedVariant => _selectedVariant;
  Map<String, String> get selectedOptions => _selectedOptions;

  // 🚀 PERFORMANCE: Initialize from cache for instant startup
  Future<void> initializeFromCache() async {
    if (_initializedFromCache) return;
    _initializedFromCache = true;

    final cachedProducts = await _cacheService.getCachedProducts();
    if (cachedProducts != null && cachedProducts.isNotEmpty) {
      _products = cachedProducts;
      debugPrint('📦 ProductProvider: Loaded ${_products.length} from cache');
      _notifySafely();

      // Refresh in background (don't await)
      loadProducts();
    }
  }

  // ✅ FIXED: Added this alias method for backward compatibility
  Future<void> fetchProducts({String? categoryId}) async {
    return loadProducts(categoryId: categoryId);
  }

  Future<void> loadProducts({String? categoryId, bool forceReload = false}) async {
    // 🚀 PERFORMANCE: Prevent simultaneous fetches (race condition fix)
    if (_isLoading) {
      debugPrint('📦 Products load already in progress, skipping...');
      return;
    }

    // 🚀 PERFORMANCE: Skip if already loaded (unless force reload or category change)
    if (!forceReload && _products.isNotEmpty && categoryId == null) {
      debugPrint('📦 Products already loaded (${_products.length}), skipping fetch');
      return;
    }

    try {
      _isLoading = true;
      _error = null;
      _notifySafely();

      debugPrint('🔍 Loading ${categoryId != null ? "category" : "all"} products...');

      // C2 (canonical rewire): categoryId here is the value CategoryProvider hands out, which is
      // itself a canonical category slug (see category_provider.dart) -- exactly what
      // marketplaceFeed's `category` param filters by, so no translation is needed. 'all' and
      // 'uncategorized' are legacy sentinel values from the old Firestore catalog with no
      // canonical meaning; treated the same as "no filter."
      final categorySlug =
          (categoryId == null || categoryId == 'all' || categoryId == 'uncategorized' || categoryId == 'All')
              ? null
              : categoryId;

      final page = await _client.marketplaceFeed(category: categorySlug, limit: 100);
      _products = page.items.map(_productFromFeedItem).toList();

      if (categorySlug == null) {
        // 💾 Save to cache for instant loading next time
        await _cacheService.cacheProducts(_products);
      }

      debugPrint('📦 Found ${_products.length} products');

      _isLoading = false;
      _notifySafely();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      _notifySafely();
      debugPrint('❌ Error loading products: $e');
    }
  }

  Future<void> loadProductById(String productId) async {
    try {
      _isLoading = true;
      _notifySafely();

      clearSelectedProduct();

      final detail = await _client.marketplaceListing(productId);
      _selectedProduct = detail == null ? null : _productFromListingDetail(detail);

      if (_selectedProduct != null) {
        if (_selectedProduct!.variants.isNotEmpty) {
          _selectedVariant = _selectedProduct!.variants.first;
          _selectedOptions = Map.from(_selectedVariant!.options);
        } else {
          _selectedVariant = null;
          _selectedOptions = {};
        }

        await addToRecentlyViewed(_selectedProduct!);
      }

      _isLoading = false;
      _notifySafely();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      _notifySafely();
    }
  }

  void selectVariantOption(String optionName, String optionValue) {
    if (_selectedProduct == null) return;

    _selectedOptions[optionName] = optionValue;

    _selectedVariant = _findVariantForSelectedOptions();

    _notifySafely();
  }

  ProductVariant? _findVariantForSelectedOptions() {
    if (_selectedProduct == null || _selectedProduct!.variants.isEmpty) {
      return null;
    }

    for (final variant in _selectedProduct!.variants) {
      bool match = true;
      for (final key in variant.options.keys) {
        if (variant.options[key] != _selectedOptions[key]) {
          match = false;
          break;
        }
      }
      if (match) {
        return variant;
      }
    }

    for (final variant in _selectedProduct!.variants) {
       for (final key in _selectedOptions.keys) {
         if (variant.options[key] == _selectedOptions[key]) {
           return variant;
         }
       }
    }

    return _selectedProduct!.variants.first;
  }

  Future<void> loadRecentlyViewed() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final recentlyViewedIds = prefs.getStringList('recently_viewed') ?? [];

      _recentlyViewedProducts = [];
      for (final productId in recentlyViewedIds.take(20)) {
        try {
          final detail = await _client.marketplaceListing(productId);
          if (detail != null) {
            _recentlyViewedProducts.add(_productFromListingDetail(detail));
          }
        } catch (e) {
          debugPrint('Error loading recently viewed product $productId: $e');
        }
      }

      _notifySafely();
    } catch (e) {
      debugPrint('❌ Error loading recently viewed: $e');
    }
  }

  Future<void> addToRecentlyViewed(ProductModel product) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final recentlyViewedIds = prefs.getStringList('recently_viewed') ?? [];

      recentlyViewedIds.remove(product.id);
      recentlyViewedIds.insert(0, product.id);

      if (recentlyViewedIds.length > 20) {
        recentlyViewedIds.removeRange(20, recentlyViewedIds.length);
      }

      await prefs.setStringList('recently_viewed', recentlyViewedIds);

      _recentlyViewedProducts.remove(product);
      _recentlyViewedProducts.insert(0, product);

      if (_recentlyViewedProducts.length > 20) {
        _recentlyViewedProducts.removeRange(20, _recentlyViewedProducts.length);
      }

      _notifySafely();
    } catch (e) {
      debugPrint('❌ Error adding to recently viewed: $e');
    }
  }

  Future<void> clearRecentlyViewed() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('recently_viewed');
      _recentlyViewedProducts.clear();
      _notifySafely();
    } catch (e) {
      debugPrint('❌ Error clearing recently viewed: $e');
    }
  }

  Future<void> searchProducts(String query) async {
    try {
      _isLoading = true;
      _notifySafely();
      final page = await _client.marketplaceFeed(search: query, limit: 100);
      _products = page.items.map(_productFromFeedItem).toList();
      _isLoading = false;
      _notifySafely();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      _notifySafely();
    }
  }

  void sortProducts(String sortBy) {
    switch (sortBy) {
      case 'price_low':
        _products.sort((a, b) => a.salePrice.compareTo(b.salePrice));
        break;
      case 'price_high':
        _products.sort((a, b) => b.salePrice.compareTo(a.salePrice));
        break;
      case 'name_asc':
        _products.sort((a, b) => a.name.compareTo(b.name));
        break;
      case 'name_desc':
        _products.sort((a, b) => b.name.compareTo(a.name));
        break;
      case 'rating':
        _products.sort((a, b) => b.rating.compareTo(a.rating));
        break;
      case 'popular':
        _products.sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
        break;
      case 'newest':
      default:
        _products.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        break;
    }
    _notifySafely();
  }

  Future<void> refreshProducts() async {
    await loadProducts();
  }

  void clearSelectedProduct() {
    _selectedProduct = null;
    _selectedVariant = null;
    _selectedOptions.clear();
    _notifySafely();
  }

  void clearError() {
    _error = null;
    _notifySafely();
  }

  void clearAll() {
    _products.clear();
    _recentlyViewedProducts.clear();
    _selectedProduct = null;
    _selectedVariant = null;
    _selectedOptions.clear();
    _error = null;
    _isLoading = false;
    _notifySafely();
  }

  // C2 (canonical rewire): the marketplace feed/listing endpoints are the deliberately minimal
  // buyer-safe view documented in packages/dart/api_client/lib/src/marketplace.dart -- no rating,
  // review count, specifications, category attributes, shipping estimates, featured/new/trending/
  // verified flags, keywords or related-product ids. Every one of those fields is left at
  // ProductModel's own constructor default (0 / false / null / empty) below -- not a value invented
  // for this adapter. Checked every current reader of these fields: product_card.dart and
  // compact_product_card.dart already guard rating/reviewCount/isVerified behind `> 0`/`if` checks,
  // so they hide cleanly; product_details_screen.dart's rating/review badge did not and was fixed
  // alongside this rewire; filter_drawer.dart's "Rating" filter section was fixed the same way.
  //
  // `stock` has no equivalent on a feed row (only a single listing's detail carries one) -- a grid
  // card's "in stock" is therefore an honest "approved and currently listed, not a real-time count"
  // signal, same as any product list has always been a moment-in-time snapshot. It changes nothing
  // about correctness: every money/inventory decision is still recomputed server-side at checkout
  // (the Constitution's server-authoritative-amounts invariant), independent of what a grid card
  // shows. The detail screen gets the real figure from MarketplaceListingDetail.stock.
  ProductModel _productFromFeedItem(MarketplaceFeedItem item) {
    final now = DateTime.now();
    return ProductModel(
      id: item.listingId,
      sellerId: item.siteId,
      storeName: item.storeName,
      name: item.name,
      description: '',
      salePrice: (item.price ?? 0).toDouble(),
      originalPrice: item.comparePrice?.toDouble(),
      categoryId: item.categorySlug ?? '',
      images: item.images,
      stock: 1,
      createdAt: now,
      updatedAt: now,
    );
  }

  ProductModel _productFromListingDetail(MarketplaceListingDetail detail) {
    final now = DateTime.now();
    return ProductModel(
      id: detail.listingId,
      sellerId: detail.siteId,
      storeName: detail.storeName,
      name: detail.name,
      description: detail.description ?? '',
      salePrice: (detail.price ?? 0).toDouble(),
      originalPrice: detail.comparePrice?.toDouble(),
      categoryId: detail.categorySlug ?? '',
      images: detail.images,
      stock: detail.stock ?? 0,
      createdAt: now,
      updatedAt: now,
      variantOptions: _variantOptionsFromCanonical(detail.variants),
      variants: detail.variants.map(_variantFromCanonical).toList(),
    );
  }

  // Canonical variants carry three positional option VALUES (option1/2/3) with no option-type
  // label ("Color", "Size", ...) -- SEC-2 removed sku/barcode from this shape and the label never
  // existed on it either. Generic "Option 1/2/3" keys are the honest choice here: a real label
  // invented from nothing would be a guess presented as fact, exactly what this corrective phase
  // exists to stop. variant_selector.dart already hides itself entirely when variantOptions is
  // empty, so a single-variant listing (the common case) shows no picker at all rather than a
  // confusing one.
  List<VariantOption> _variantOptionsFromCanonical(List<MarketplaceVariant> variants) {
    final slots = <String, List<String>>{};
    for (final v in variants) {
      final values = [v.option1, v.option2, v.option3];
      for (var i = 0; i < values.length; i++) {
        final value = values[i];
        if (value == null || value.isEmpty) continue;
        final key = 'Option ${i + 1}';
        final list = slots.putIfAbsent(key, () => []);
        if (!list.contains(value)) list.add(value);
      }
    }
    return slots.entries.map((e) => VariantOption(name: e.key, values: e.value)).toList();
  }

  ProductVariant _variantFromCanonical(MarketplaceVariant v) {
    final options = <String, String>{
      if (v.option1 != null && v.option1!.isNotEmpty) 'Option 1': v.option1!,
      if (v.option2 != null && v.option2!.isNotEmpty) 'Option 2': v.option2!,
      if (v.option3 != null && v.option3!.isNotEmpty) 'Option 3': v.option3!,
    };
    return ProductVariant(
      id: v.id,
      name: v.title,
      salePrice: (v.price ?? 0).toDouble(),
      originalPrice: v.comparePrice?.toDouble(),
      stock: v.stock ?? 0,
      images: v.imageUrl != null && v.imageUrl!.isNotEmpty ? [v.imageUrl!] : const [],
      options: options,
    );
  }

  bool _disposed = false;
  bool get mounted => !_disposed;

  void _notifySafely() {
    if (mounted) {
      Future.microtask(() {
        if (mounted) {
          notifyListeners();
        }
      });
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _products.clear();
    _recentlyViewedProducts.clear();
    _selectedProduct = null;
    super.dispose();
  }
}
