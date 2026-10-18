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
  bool _isLoadingMore = false;
  String? _error;
  String? _loadMoreError;
  bool _initializedFromCache = false;
  int _feedRequestGeneration = 0;

  // The feed is keyset-paged. Keep the server-issued cursor and the exact filters that produced it
  // together so a continuation cannot drift into another category/search/origin result set.
  bool _hasMore = false;
  MarketplaceFeedCursor? _nextCursor;
  String? _activeCategorySlug;
  String? _activeSearch;
  String? _activeCountryOfOrigin;
  List<String> _countryOrigins = const <String>[];
  bool _countryOriginsLoading = false;
  String? _countryOriginsError;

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

  /// True when the last feed/search page fetched was not the last page -- see this field's own
  /// doc comment on _hasMore.
  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;
  bool get loadMoreFailed => _loadMoreError != null;
  List<String> get countryOrigins => _countryOrigins;
  bool get countryOriginsLoading => _countryOriginsLoading;
  String? get countryOriginsError => _countryOriginsError;

  // ✅ NEW: Getters for variants
  ProductVariant? get selectedVariant => _selectedVariant;
  Map<String, String> get selectedOptions => _selectedOptions;

  // 🚀 PERFORMANCE: Initialize from cache for instant startup
  //
  // C2 corrective (27 September 2026 review, finding 2): this called loadProducts() (no
  // forceReload) intending a background revalidation, but loadProducts's own dedup guard
  // (`if (!forceReload && _products.isNotEmpty ...) return;`) made that a no-op the instant the
  // cache populated _products -- so the real canonical fetch never actually ran, and whatever was
  // cached (including, on an in-place app update, data cached before this rewire) could persist
  // indefinitely with no automatic path back to the live source. forceReload: true makes this a
  // genuine revalidation, not just a cache hit.
  Future<void> initializeFromCache() async {
    if (_initializedFromCache) return;
    _initializedFromCache = true;

    final cachedProducts = await _cacheService.getCachedProducts();
    if (cachedProducts != null && cachedProducts.isNotEmpty) {
      _products = cachedProducts;
      debugPrint('📦 ProductProvider: Loaded ${_products.length} from cache');
      _notifySafely();

      // Refresh in background (don't await)
      loadProducts(forceReload: true);
    }
  }

  // ✅ FIXED: Added this alias method for backward compatibility
  Future<void> fetchProducts({String? categoryId}) async {
    return loadProducts(categoryId: categoryId);
  }

  Future<void> loadProducts({
    String? categoryId,
    String? countryOfOrigin,
    bool forceReload = false,
  }) async {
    // 🚀 PERFORMANCE: Prevent simultaneous fetches (race condition fix)
    if (_isLoading &&
        !forceReload &&
        countryOfOrigin == null &&
        categoryId == null) {
      debugPrint('📦 Products load already in progress, skipping...');
      return;
    }

    // 🚀 PERFORMANCE: Skip if already loaded (unless force reload or category change)
    if (!forceReload &&
        _products.isNotEmpty &&
        categoryId == null &&
        countryOfOrigin == null) {
      debugPrint(
        '📦 Products already loaded (${_products.length}), skipping fetch',
      );
      return;
    }

    final requestGeneration = ++_feedRequestGeneration;
    try {
      _isLoading = true;
      _error = null;
      _notifySafely();

      debugPrint(
        '🔍 Loading ${categoryId != null ? "category" : "all"} products...',
      );

      // C2 (canonical rewire): categoryId here is the value CategoryProvider hands out, which is
      // itself a canonical category slug (see category_provider.dart) -- exactly what
      // marketplaceFeed's `category` param filters by, so no translation is needed. 'all' and
      // 'uncategorized' are legacy sentinel values from the old Firestore catalog with no
      // canonical meaning; treated the same as "no filter."
      final categorySlug =
          (categoryId == null ||
              categoryId == 'all' ||
              categoryId == 'uncategorized' ||
              categoryId == 'All')
          ? null
          : categoryId;

      _activeCategorySlug = categorySlug;
      _activeSearch = null;
      _activeCountryOfOrigin = countryOfOrigin;
      _nextCursor = null;
      _hasMore = false;
      _isLoadingMore = false;
      _loadMoreError = null;

      final page = await _client.marketplaceFeed(
        category: categorySlug,
        countryOfOrigin: countryOfOrigin,
        limit: 100,
      );
      if (requestGeneration != _feedRequestGeneration) return;
      _products = page.items.map(_productFromFeedItem).toList();
      _hasMore = page.hasMore;
      _nextCursor = page.nextCursor;

      if (categorySlug == null && countryOfOrigin == null) {
        // 💾 Save to cache for instant loading next time
        await _cacheService.cacheProducts(_products);
      }

      debugPrint('📦 Found ${_products.length} products');

      _isLoading = false;
      _notifySafely();
    } catch (e) {
      if (requestGeneration != _feedRequestGeneration) return;
      _error = e.toString();
      _isLoading = false;
      _notifySafely();
      debugPrint('❌ Error loading products: $e');
    }
  }

  Future<void> loadCountryOrigins() async {
    _countryOriginsLoading = true;
    _countryOriginsError = null;
    _notifySafely();
    try {
      _countryOrigins = await _client.marketplaceOrigins();
    } catch (e) {
      _countryOriginsError = e.toString();
      debugPrint('❌ Error loading marketplace origin filters: $e');
    } finally {
      _countryOriginsLoading = false;
      _notifySafely();
    }
  }

  Future<void> loadProductById(String productId) async {
    try {
      _isLoading = true;
      _notifySafely();

      clearSelectedProduct();

      final detail = await _client.marketplaceListing(productId);
      _selectedProduct = detail == null
          ? null
          : _productFromListingDetail(detail);

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

  /// Fetches a single product by id from the canonical gateway without touching
  /// `selectedProduct`/`selectedVariant`/recently-viewed or emitting `notifyListeners()`.
  ///
  /// C3 (Firebase retirement continuation): the cart screen and BOGO-coupon resolution used to
  /// call `FirebaseFirestore.instance.collection('products').doc(id).get()` directly for a
  /// look-aside fetch of one or more products already in the cart. `loadProductById` is not a
  /// substitute for that -- it mutates shared selection/recently-viewed state meant for the
  /// product-details screen, which a cart-screen background loop over N items must not disturb.
  /// Returns null on a genuine not-found or transport failure; callers must treat that as "unknown
  /// right now", not as a zero-stock/zero-price product.
  Future<ProductModel?> fetchProductById(String productId) async {
    try {
      final detail = await _client.marketplaceListing(productId);
      return detail == null ? null : _productFromListingDetail(detail);
    } catch (_) {
      return null;
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

  Future<void> searchProducts(String query, {String? countryOfOrigin}) async {
    final requestGeneration = ++_feedRequestGeneration;
    _activeCategorySlug = null;
    _activeSearch = query;
    _activeCountryOfOrigin = countryOfOrigin;
    _nextCursor = null;
    _hasMore = false;
    _isLoadingMore = false;
    _loadMoreError = null;
    try {
      _isLoading = true;
      _notifySafely();
      final page = await _client.marketplaceFeed(
        search: query,
        countryOfOrigin: countryOfOrigin,
        limit: 100,
      );
      if (requestGeneration != _feedRequestGeneration) return;
      _products = page.items.map(_productFromFeedItem).toList();
      _hasMore = page.hasMore;
      _nextCursor = page.nextCursor;
      _isLoading = false;
      _notifySafely();
    } catch (e) {
      if (requestGeneration != _feedRequestGeneration) return;
      _error = e.toString();
      _isLoading = false;
      _notifySafely();
    }
  }

  /// Appends the next canonical keyset page for the exact active feed filters.
  ///
  /// The cursor is only advanced after a successful response. A failed request therefore leaves
  /// the current page retryable, while a newer filter request invalidates any late page response.
  Future<void> loadMoreProducts() => _loadMoreProducts(retryAfterFailure: false);

  /// Retries the same cursor after an explicit user action following a failed page load.
  Future<void> retryLoadMoreProducts() => _loadMoreProducts(retryAfterFailure: true);

  Future<void> _loadMoreProducts({required bool retryAfterFailure}) async {
    final cursor = _nextCursor;
    if (_isLoading ||
        _isLoadingMore ||
        (!_hasMore || cursor == null) ||
        (_loadMoreError != null && !retryAfterFailure)) {
      return;
    }

    final requestGeneration = ++_feedRequestGeneration;
    _isLoadingMore = true;
    _loadMoreError = null;
    _notifySafely();

    try {
      final page = await _client.marketplaceFeed(
        category: _activeCategorySlug,
        search: _activeSearch,
        countryOfOrigin: _activeCountryOfOrigin,
        limit: 100,
        cursor: cursor,
      );
      if (requestGeneration != _feedRequestGeneration) return;

      final seen = _products.map((product) => product.id).toSet();
      _products = [
        ..._products,
        ...page.items
            .map(_productFromFeedItem)
            .where((product) => seen.add(product.id)),
      ];
      _nextCursor = page.nextCursor;
      _hasMore = page.hasMore;
    } catch (error) {
      if (requestGeneration != _feedRequestGeneration) return;
      _loadMoreError = error.toString();
    } finally {
      if (requestGeneration == _feedRequestGeneration) {
        _isLoadingMore = false;
        _notifySafely();
      }
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

  // C2 corrective (27 September 2026 review, finding 2): was loadProducts() with no forceReload,
  // making an explicit pull-to-refresh a no-op once _products was already non-empty -- exactly the
  // same dedup-guard interaction as initializeFromCache above.
  Future<void> refreshProducts() async {
    await loadProducts(forceReload: true);
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
    _feedRequestGeneration++;
    _products.clear();
    _recentlyViewedProducts.clear();
    _selectedProduct = null;
    _selectedVariant = null;
    _selectedOptions.clear();
    _error = null;
    _isLoading = false;
    _isLoadingMore = false;
    _loadMoreError = null;
    _hasMore = false;
    _nextCursor = null;
    _activeCategorySlug = null;
    _activeSearch = null;
    _activeCountryOfOrigin = null;
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
  // C2 corrective (27 September 2026 review, finding 1): `stock: 1` here used to be an outright
  // fabrication, not an honest default -- "listing approval is not evidence of stock quantity," and
  // product_card.dart's own "Add to Cart" button is gated directly on `stock == 0`, so this
  // previously left every canonical grid card's quick-add enabled regardless of real availability.
  // A feed row has no stock field at all (only a single listing's own detail does), so `stockKnown`
  // is unconditionally false here; `stock` itself stays 0, a safe, inert value that is never read
  // as a positive claim once callers check stockKnown/isPurchasable first (see that getter, and the
  // grid-card fixes in the same commit as this one). Likewise `salePrice: (item.price ?? 0)` used
  // to collapse "the source never sent a price" into the same value as "this item is free" --
  // `priceKnown` distinguishes them the same way. `createdAt`/`updatedAt` used to be
  // DateTime.now(), corrupting sortProducts's "newest" ordering into an unpredictable near-tie
  // between whatever happened to be mapped microseconds apart in the same request -- approvedAt is
  // a real, meaningful timestamp the feed already returns (when the gateway approved this listing),
  // used for both since the feed carries no separate "last updated" signal.
  ProductModel _productFromFeedItem(MarketplaceFeedItem item) {
    final approvedAt = DateTime.tryParse(item.approvedAt) ?? DateTime.now();
    return ProductModel(
      id: item.listingId,
      marketplaceListingId: item.listingId,
      catalogProductId: item.productId,
      sellerId: item.siteId,
      storeName: item.storeName,
      countryOfOrigin: item.countryOfOrigin,
      name: item.name,
      description: '',
      salePrice: (item.price ?? 0).toDouble(),
      priceKnown: item.price != null,
      originalPrice: item.comparePrice?.toDouble(),
      categoryId: item.categorySlug ?? '',
      images: item.images,
      stock: 0,
      stockKnown: false,
      createdAt: approvedAt,
      updatedAt: approvedAt,
    );
  }

  ProductModel _productFromListingDetail(MarketplaceListingDetail detail) {
    final approvedAt = detail.approvedAt == null
        ? null
        : DateTime.tryParse(detail.approvedAt!);
    final timestamp = approvedAt ?? DateTime.now();
    return ProductModel(
      id: detail.listingId,
      marketplaceListingId: detail.listingId,
      catalogProductId: detail.productId,
      sellerId: detail.siteId,
      storeName: detail.storeName,
      importerDetails: detail.importerDetails,
      name: detail.name,
      description: detail.description ?? '',
      salePrice: (detail.price ?? 0).toDouble(),
      priceKnown: detail.price != null,
      originalPrice: detail.comparePrice?.toDouble(),
      categoryId: detail.categorySlug ?? '',
      images: detail.images,
      stock: detail.stock ?? 0,
      stockKnown: detail.stock != null,
      createdAt: timestamp,
      updatedAt: timestamp,
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
  List<VariantOption> _variantOptionsFromCanonical(
    List<MarketplaceVariant> variants,
  ) {
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
    return slots.entries
        .map((e) => VariantOption(name: e.key, values: e.value))
        .toList();
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
      images: v.imageUrl != null && v.imageUrl!.isNotEmpty
          ? [v.imageUrl!]
          : const [],
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
