// lib/providers/category_provider.dart

import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../database_service.dart';
import '../cache_service.dart';

class CategoryProvider with ChangeNotifier {
  final DatabaseService _databaseService = DatabaseService();
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
  Future<void> initializeFromCache() async {
    if (_initializedFromCache) return;
    _initializedFromCache = true;
    
    final cachedCategories = await _cacheService.getCachedCategories();
    if (cachedCategories != null && cachedCategories.isNotEmpty) {
      _allCategories = cachedCategories;
      debugPrint('📂 CategoryProvider: Loaded ${_allCategories.length} from cache');
      _notifySafely();
      
      // Refresh in background (don't await)
      loadCategories();
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
      
      _allCategories = await _databaseService.getAllCategories();

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

  Future<void> refreshCategories() async {
    await loadCategories();
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