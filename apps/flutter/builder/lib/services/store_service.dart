import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/store_model.dart';
import 'api_client.dart';

/// Service for managing stores via the LetBuyy API.
///
/// Replaces direct Firestore access with REST calls to the Hono backend.
class StoreService extends ChangeNotifier {
  final ApiClient _api;

  StoreService({required ApiClient api}) : _api = api;

  // ── Cached state ─────────────────────────────────────────

  StoreModel? _currentStore;
  StoreModel? get currentStore => _currentStore;

  List<StoreModel> _stores = [];
  List<StoreModel> get stores => List.unmodifiable(_stores);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  // ── Read ─────────────────────────────────────────────────

  /// Fetch all stores for the current user.
  Future<List<StoreModel>> fetchStores() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get('stores');
      final items = res['data'] as List? ?? [];
      _stores = items
          .map((e) => StoreModel.fromJson(e as Map<String, dynamic>))
          .toList();
      if (_stores.isNotEmpty && _currentStore == null) {
        _currentStore = _stores.first;
      }
      return _stores;
    } catch (e) {
      debugPrint('❌ fetchStores error: $e');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get a single store by ID.
  Future<StoreModel> fetchStore(String id) async {
    final res = await _api.get('stores/$id');
    final store = StoreModel.fromJson(res['data'] as Map<String, dynamic>);
    _currentStore = store;
    notifyListeners();
    return store;
  }

  /// Get the first store for the current user (used after login).
  Future<StoreModel?> getFirstStore() async {
    try {
      final res = await _api.get('stores', query: {'limit': '1'});
      final items = res['data'] as List? ?? [];
      if (items.isEmpty) return null;
      final store = StoreModel.fromJson(items.first as Map<String, dynamic>);
      _currentStore = store;
      notifyListeners();
      return store;
    } catch (e) {
      debugPrint('❌ getFirstStore error: $e');
      return null;
    }
  }

  // ── Create ───────────────────────────────────────────────

  /// Create a new store.
  Future<StoreModel> createStore({
    required String name,
    required String subdomain,
    String siteType = 'store',
    String? tagline,
    String? themeId,
    Map<String, dynamic>? templateConfig,
  }) async {
    final res = await _api.post('stores', body: {
      'name': name,
      'subdomain': subdomain.toLowerCase().replaceAll(RegExp(r'[^a-z0-9-]'), ''),
      'site_type': siteType,
      if (tagline != null) 'tagline': tagline,
      'theme_id': themeId ?? 'modern',
      if (templateConfig != null) 'template_config': templateConfig,
    });
    final store = StoreModel.fromJson(res['data'] as Map<String, dynamic>);
    _stores.add(store);
    _currentStore = store;
    notifyListeners();
    return store;
  }

  // ── Update ───────────────────────────────────────────────

  /// Update store fields.
  Future<StoreModel> updateStore(String id, Map<String, dynamic> fields) async {
    final res = await _api.patch('stores/$id', body: fields);
    final store = StoreModel.fromJson(res['data'] as Map<String, dynamic>);
    final idx = _stores.indexWhere((s) => s.id == id);
    if (idx != -1) _stores[idx] = store;
    if (_currentStore?.id == id) _currentStore = store;
    notifyListeners();
    return store;
  }

  // ── Publish ──────────────────────────────────────────────

  /// Publish the store (sets status to 'published').
  Future<StoreModel> publishStore(String id) async {
    final res = await _api.post('stores/$id/publish');
    final store = StoreModel.fromJson(res['data'] as Map<String, dynamic>);
    final idx = _stores.indexWhere((s) => s.id == id);
    if (idx != -1) _stores[idx] = store;
    if (_currentStore?.id == id) _currentStore = store;
    notifyListeners();
    return store;
  }

  // ── Delete ───────────────────────────────────────────────

  /// Soft-delete the store.
  Future<void> deleteStore(String id) async {
    await _api.delete('stores/$id');
    _stores.removeWhere((s) => s.id == id);
    if (_currentStore?.id == id) {
      _currentStore = _stores.isNotEmpty ? _stores.first : null;
    }
    notifyListeners();
  }

  // ── Logo / Banner upload ─────────────────────────────────

  /// Upload an image and return the CDN URL.
  Future<String> uploadImage(File file, {String folder = 'stores'}) async {
    return _api.uploadFile(file, folder: folder);
  }

  // ── Subdomain check ──────────────────────────────────────

  /// Check if a subdomain is available (public endpoint, doesn't need auth).
  Future<bool> isSubdomainAvailable(String subdomain) async {
    try {
      await _api.get('stores/public/$subdomain');
      return false; // store found → not available
    } on ApiException catch (e) {
      if (e.statusCode == 404) return true; // not found → available
      rethrow;
    }
  }

  // ── Helpers ──────────────────────────────────────────────

  void setCurrentStore(StoreModel store) {
    _currentStore = store;
    notifyListeners();
  }

  // ── Convenience methods ──────────────────────────────────

  /// Unpublish the store (sets status to 'draft').
  Future<StoreModel> unpublishStore(String id) async {
    return updateStore(id, {'status': 'draft'});
  }

  /// Get a store by ID (alias for fetchStore).
  Future<StoreModel> getStoreById(String id) => fetchStore(id);

  /// Update the store's header settings.
  Future<StoreModel> updateHeaderSettings(
    String id,
    Map<String, dynamic> headerSettings,
  ) async {
    return updateStore(id, {'header_settings': headerSettings});
  }

  /// Update the selected product IDs for the store.
  Future<StoreModel> updateSelectedProducts(
    String id,
    List<String> productIds,
  ) async {
    return updateStore(id, {'selected_product_ids': productIds});
  }

  /// Update payment settings for the store.
  Future<StoreModel> updatePaymentSettings(
    String id,
    Map<String, dynamic> paymentSettings,
  ) async {
    return updateStore(id, {'payment_settings': paymentSettings});
  }
}
