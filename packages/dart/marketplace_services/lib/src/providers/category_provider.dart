// lib/providers/category_provider.dart

import 'package:flutter/material.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../cache_service.dart';

class CategoryProvider with ChangeNotifier {
  CategoryProvider({required ApiClient client}) : _client = client;

  final ApiClient _client;
  final CacheService _cacheService = CacheService();

  List<CategoryModel> _allCategories = [];
  String? _selectedCategoryId;
  bool _isLoading = false;
  String? _error;
  bool _disposed = false;
  bool _initializedFromCache = false;

  // --- Core State ---
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get mounted => !_disposed;
  List<CategoryModel> get allCategories => _allCategories; // ✅ RENAMED
  int get categoryCount => _allCategories.length;
  bool get hasCategories => _allCategories.isNotEmpty;

  // --- Hierarchy Getters ---

  CategoryModel? get selectedCategory {
    if (_selectedCategoryId == null) return null;
    try {
      return _allCategories.firstWhere((c) => c.id == _selectedCategoryId);
    } catch (e) {
      return null;
    }
  }

  /// ✅ NEW: Returns a sorted list of all main (top-level) categories.
  List<CategoryModel> get mainCategories {
    var mains = _allCategories
        .where((c) => c.level == 0 && c.isActive)
        .toList();
    mains.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    return mains;
  }

  /// ✅ NEW: Returns a sorted list of all active child categories for a given parentId.
  List<CategoryModel> getSubCategories(String parentId) {
    var children = _allCategories
        .where((c) => c.parentId == parentId && c.isActive)
        .toList();
    children.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
    return children;
  }

  /// ✅ NEW: Convenience getter for children of the *currently selected* category.
  List<CategoryModel> get currentSubCategories {
    if (_selectedCategoryId == null) return [];
    return getSubCategories(_selectedCategoryId!);
  }

  /// ✅ NEW: Gets the full path to a category (e.g., [Home, Furniture, Sofas])
  List<CategoryModel> getCategoryBreadcrumb(String? leafCategoryId) {
    if (leafCategoryId == null) return [];
    final List<CategoryModel> breadcrumb = [];
    String? currentId = leafCategoryId;

    while (currentId != null) {
      try {
        final category = _allCategories.firstWhere((c) => c.id == currentId);
        breadcrumb.insert(0, category);
        currentId = category.parentId;
      } catch (e) {
        currentId = null;
      }
    }
    return breadcrumb;
  }

  // --- Core Methods ---

  Future<void> fetchCategories() async {
    return loadCategories();
  }

  void _notifySafely() {
    if (mounted) {
      Future.microtask(() {
        if (mounted) {
          notifyListeners();
        }
      });
    }
  }

  // 🚀 PERFORMANCE: Initialize from cache for instant startup
  //
  // C2 corrective (27 September 2026 review, finding 2): this called loadCategories() (no
  // forceReload) intending a background revalidation, but loadCategories's own dedup guard
  // (`if (!forceReload && _allCategories.isNotEmpty) return;`) made that a no-op the instant the
  // cache populated _allCategories -- the real canonical fetch never actually ran. Same bug and
  // same fix as ProductProvider.initializeFromCache.
  Future<void> initializeFromCache() async {
    if (_initializedFromCache) return;
    _initializedFromCache = true;

    final cachedCategories = await _cacheService.getCachedCategories();
    if (cachedCategories != null && cachedCategories.isNotEmpty) {
      _allCategories = cachedCategories;
      debugPrint('📂 CategoryProvider: Loaded ${_allCategories.length} from cache');
      _notifySafely();

      // Refresh in background (don't await)
      loadCategories(forceReload: true);
    }
  }

  Future<void> loadCategories({bool forceReload = false}) async {
    // 🚀 PERFORMANCE: Prevent simultaneous fetches (race condition fix)
    if (_isLoading) {
      debugPrint('📂 Categories load already in progress, skipping...');
      return;
    }

    // 🚀 PERFORMANCE: Skip if already loaded (unless force reload)
    if (!forceReload && _allCategories.isNotEmpty) {
      debugPrint('📂 Categories already loaded (${_allCategories.length}), skipping fetch');
      return;
    }

    try {
      _isLoading = true;
      _error = null;
      _notifySafely();

      debugPrint('🔍 Loading categories...');

      final raw = await _client.marketplaceCategories();
      _allCategories = _mapCategories(raw);

      // 💾 Save to cache for instant loading next time
      await _cacheService.cacheCategories(_allCategories);

      debugPrint('✅ Loaded ${_allCategories.length} categories');

      _isLoading = false;
      _notifySafely();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      _notifySafely();
      debugPrint('❌ Error loading categories: $e');
    }
  }

  // C2 (canonical rewire): the live taxonomy comes back flat, keyed by its own row id, with
  // `parent_id` in that same id-space and `slug` as the value marketplace_feed's `category` param
  // filters by -- two different keyspaces for one hierarchy. `id`/`parentId` below carry the slug
  // end to end, since that is the only identifier every screen already threads through selection,
  // filtering and `ProductProvider.loadProducts(categoryId:)`, and the feed filter needs a slug.
  // `level` is computed here by walking the real parent_id chain in id-space (not fabricated) --
  // a root category is level 0, each level one hop further from a root. `isActive` is always true:
  // `listMarketplaceCategoriesFromDatabase` (services/api-gateway) already filters to
  // `is_active = true` server-side, so claiming true for everything the endpoint hands back
  // reflects what it already guarantees, not an assumed default. `description`, the icon/banner
  // image fields and `productCount` have no canonical equivalent yet -- left at their honest
  // "nothing to show" defaults (empty string / null / zero), which every current consumer already
  // treats as "don't render this" (categories_grid.dart's `if (category.productCount > 0)`,
  // `_getCategoryIcon`'s null fallback to a generic icon, `CachedNetworkImage`'s errorWidget for a
  // blank banner URL) rather than as a false claim.
  List<CategoryModel> _mapCategories(List<MarketplaceCategory> raw) {
    final byId = {for (final c in raw) c.id: c};
    final slugById = {for (final c in raw) c.id: c.slug};

    final levelCache = <String, int>{};
    int levelOf(String id, [Set<String> visiting = const {}]) {
      final cached = levelCache[id];
      if (cached != null) return cached;
      if (visiting.contains(id)) return 0; // defensive: a cycle should never occur
      final parentId = byId[id]?.parentId;
      final level = (parentId == null || !byId.containsKey(parentId))
          ? 0
          : 1 + levelOf(parentId, {...visiting, id});
      levelCache[id] = level;
      return level;
    }

    final now = DateTime.now();
    return raw.map((c) {
      final parentSlug = c.parentId != null ? slugById[c.parentId] : null;
      return CategoryModel(
        id: c.slug,
        slug: c.slug,
        name: c.name,
        description: '',
        parentId: parentSlug,
        level: levelOf(c.id),
        displayOrder: c.position,
        isActive: true,
        createdAt: now,
      );
    }).toList(growable: false);
  }

  // C2 corrective (27 September 2026 review, finding 2): was loadCategories() with no forceReload,
  // making an explicit refresh a no-op once _allCategories was already non-empty -- the same
  // dedup-guard interaction as initializeFromCache above. (An earlier pass through this file had
  // briefly made this exact change, then reverted it to avoid an unrelated behavior change outside
  // that commit's own scope; the review confirms it was a real bug all along, not just an
  // incidental one worth leaving alone.)
  Future<void> refreshCategories() async {
    await loadCategories(forceReload: true);
  }

  void selectCategory(String categoryId) {
    _selectedCategoryId = categoryId;
    _notifySafely();
  }

  void clearSelectedCategory() {
    _selectedCategoryId = null;
    _notifySafely();
  }

  // --- Utility Methods ---

  CategoryModel? getCategoryById(String categoryId) {
    try {
      return _allCategories.firstWhere((cat) => cat.id == categoryId);
    } catch (e) {
      return null;
    }
  }

  CategoryModel? getCategoryByName(String name) {
    try {
      return _allCategories.firstWhere(
        (cat) => cat.name.toLowerCase() == name.toLowerCase(),
      );
    } catch (e) {
      return null;
    }
  }

  List<CategoryModel> searchCategories(String query) {
    if (query.isEmpty) return _allCategories;

    final lowerQuery = query.toLowerCase();
    return _allCategories.where((category) {
      return category.name.toLowerCase().contains(lowerQuery) ||
          category.description.toLowerCase().contains(lowerQuery);
    }).toList();
  }

  void clearError() {
    _error = null;
    _notifySafely();
  }

  void clearAll() {
    _allCategories.clear();
    _selectedCategoryId = null;
    _error = null;
    _isLoading = false;
    _notifySafely();
  }

  @override
  void dispose() {
    _disposed = true;
    _allCategories.clear();
    _selectedCategoryId = null;
    super.dispose();
  }
}
