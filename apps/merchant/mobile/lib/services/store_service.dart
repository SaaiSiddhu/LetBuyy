import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/store_model.dart';
import 'api_client.dart';
import 'cache_service.dart';

/// Service for managing stores via the LetBuyy API.
///
/// Replaces direct database access with REST calls to the Hono backend.
class StoreService extends ChangeNotifier {
  final ApiClient _api;
  final CacheService? _cache;

  StoreService({required ApiClient api, CacheService? cache})
    : _api = api,
      _cache = cache;

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
      final page = await _api.stores.list();
      _stores = page.data.map(StoreModel.fromJson).toList();
      if (_stores.isNotEmpty && _currentStore == null) {
        _currentStore = _stores.first;
      }
      await _cache?.writeJson(
        CacheService.storesKey,
        _stores.map((store) => store.toJson()).toList(growable: false),
      );
      for (final store in _stores) {
        await _cache?.writeJson(
          CacheService.storeDetailKey(store.id),
          _storeCachePayload(store),
        );
      }
      return _stores;
    } catch (e) {
      debugPrint('❌ fetchStores error: $e');
      final cachedRows = _cache?.readJsonList(CacheService.storesKey) ?? [];
      if (cachedRows.isNotEmpty) {
        _stores = cachedRows.map(StoreModel.fromJson).toList(growable: false);
        _currentStore ??= _stores.first;
        return _stores;
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get a single store by ID.
  Future<StoreModel> fetchStore(String id) async {
    try {
      final store = StoreModel.fromJson(await _api.stores.get(id));
      _currentStore = store;
      await _cache?.writeJson(
        CacheService.storeDetailKey(id),
        _storeCachePayload(store),
      );
      notifyListeners();
      return store;
    } catch (e) {
      debugPrint('❌ fetchStore error: $e');
      final cached = _cache?.readJsonMap(CacheService.storeDetailKey(id));
      if (cached != null) {
        final store = StoreModel.fromJson(cached);
        _currentStore = store;
        notifyListeners();
        return store;
      }
      rethrow;
    }
  }

  Map<String, dynamic> _storeCachePayload(StoreModel store) => {
    'id': store.id,
    ...store.toJson(),
  };

  Future<Map<String, dynamic>> fetchStoreHealth(String id) async {
    return _api.stores.health(id);
  }

  Future<StoreLocalizationSummary> fetchLocalization(String id) async {
    return StoreLocalizationSummary.fromJson(
      await _api.stores.localization(id),
    );
  }

  Future<StoreLocalizationSummary> updateLocalization(
    String id,
    Map<String, dynamic> fields,
  ) async {
    return StoreLocalizationSummary.fromJson(
      await _api.stores.updateLocalization(id, fields),
    );
  }

  Future<StoreMarket> createMarket(
    String storeId,
    Map<String, dynamic> input,
  ) async {
    return StoreMarket.fromJson(await _api.stores.createMarket(storeId, input));
  }

  Future<StoreMarket> updateMarket(
    String storeId,
    String marketId,
    Map<String, dynamic> input,
  ) async {
    return StoreMarket.fromJson(
      await _api.stores.updateMarket(storeId, marketId, input),
    );
  }

  Future<void> deleteMarket(String storeId, String marketId) async {
    await _api.stores.deleteMarket(storeId, marketId);
  }

  Future<StorefrontLocale> createLocale(
    String storeId,
    Map<String, dynamic> input,
  ) async {
    return StorefrontLocale.fromJson(
      await _api.stores.createLocale(storeId, input),
    );
  }

  Future<StorefrontLocale> updateLocale(
    String storeId,
    String localeId,
    Map<String, dynamic> input,
  ) async {
    return StorefrontLocale.fromJson(
      await _api.stores.updateLocale(storeId, localeId, input),
    );
  }

  Future<void> deleteLocale(String storeId, String localeId) async {
    await _api.stores.deleteLocale(storeId, localeId);
  }

  Future<StorefrontTranslation> createTranslation(
    String storeId,
    Map<String, dynamic> input,
  ) async {
    return StorefrontTranslation.fromJson(
      await _api.stores.createTranslation(storeId, input),
    );
  }

  Future<StorefrontTranslation> updateTranslation(
    String storeId,
    String translationId,
    Map<String, dynamic> input,
  ) async {
    return StorefrontTranslation.fromJson(
      await _api.stores.updateTranslation(storeId, translationId, input),
    );
  }

  Future<void> deleteTranslation(String storeId, String translationId) async {
    await _api.stores.deleteTranslation(storeId, translationId);
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
    final store = StoreModel.fromJson(
      await _api.stores.create({
        'name': name,
        'subdomain': subdomain.toLowerCase().replaceAll(
          RegExp(r'[^a-z0-9-]'),
          '',
        ),
        'site_type': siteType,
        if (tagline != null) 'tagline': tagline,
        'theme_id': themeId ?? 'modern',
        if (templateConfig != null) 'template_config': templateConfig,
      }),
    );
    _stores.add(store);
    _currentStore = store;
    notifyListeners();
    return store;
  }

  Future<Map<String, dynamic>> saveMobileOnboardingProgress({
    required String businessType,
    required Iterable<String> channels,
    required String productType,
    required String category,
    String siteType = 'store',
  }) async {
    return _api.onboarding.saveMobileProgress({
      'site_type': siteType,
      'business_type': businessType,
      'channels': channels.toList(growable: false),
      'product_type': productType,
      'category': category,
    });
  }

  // ── Update ───────────────────────────────────────────────

  Future<String> uploadStoreAsset(File file, {String folder = 'stores'}) {
    return _api.uploadFile(file, folder: folder);
  }

  /// Update store fields.
  Future<StoreModel> updateStore(String id, Map<String, dynamic> fields) async {
    final store = StoreModel.fromJson(await _api.stores.update(id, fields));
    final idx = _stores.indexWhere((s) => s.id == id);
    if (idx != -1) _stores[idx] = store;
    if (_currentStore?.id == id) _currentStore = store;
    notifyListeners();
    return store;
  }

  // ── Publish ──────────────────────────────────────────────

  /// Publish the store (sets status to 'published').
  Future<StoreModel> publishStore(String id) async {
    final store = StoreModel.fromJson(await _api.stores.publish(id));
    final idx = _stores.indexWhere((s) => s.id == id);
    if (idx != -1) _stores[idx] = store;
    if (_currentStore?.id == id) _currentStore = store;
    notifyListeners();
    return store;
  }

  // ── Delete ───────────────────────────────────────────────

  /// Soft-delete the store.
  Future<void> deleteStore(String id) async {
    await _api.stores.remove(id);
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

class StoreLocalizationSummary {
  const StoreLocalizationSummary({
    required this.storeId,
    required this.defaultLocale,
    required this.currency,
    required this.timezone,
    required this.markets,
    required this.locales,
    required this.translations,
    required this.schemaReady,
  });

  factory StoreLocalizationSummary.fromJson(Map<String, dynamic> json) {
    return StoreLocalizationSummary(
      storeId: json['store_id']?.toString() ?? '',
      defaultLocale: json['default_locale']?.toString() ?? 'en-IN',
      currency: json['currency']?.toString() ?? 'INR',
      timezone: json['timezone']?.toString() ?? 'Asia/Kolkata',
      markets: _jsonList(
        json['markets'],
      ).map(StoreMarket.fromJson).toList(growable: false),
      locales: _jsonList(
        json['locales'],
      ).map(StorefrontLocale.fromJson).toList(growable: false),
      translations: _jsonList(
        json['translations'],
      ).map(StorefrontTranslation.fromJson).toList(growable: false),
      schemaReady: json['schema_ready'] != false,
    );
  }

  final String storeId;
  final String defaultLocale;
  final String currency;
  final String timezone;
  final List<StoreMarket> markets;
  final List<StorefrontLocale> locales;
  final List<StorefrontTranslation> translations;
  final bool schemaReady;
}

class StoreMarket {
  const StoreMarket({
    required this.id,
    required this.name,
    required this.countryCode,
    required this.currency,
    required this.locale,
    required this.isPrimary,
    required this.isActive,
    required this.priceAdjustmentBps,
    required this.roundingMode,
  });

  factory StoreMarket.fromJson(Map<String, dynamic> json) {
    return StoreMarket(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Market',
      countryCode: json['country_code']?.toString() ?? 'IN',
      currency: json['currency']?.toString() ?? 'INR',
      locale: json['locale']?.toString() ?? 'en-IN',
      isPrimary: json['is_primary'] == true,
      isActive: json['is_active'] != false,
      priceAdjustmentBps: _intValue(json['price_adjustment_bps']),
      roundingMode: json['rounding_mode']?.toString() ?? 'standard',
    );
  }

  final String id;
  final String name;
  final String countryCode;
  final String currency;
  final String locale;
  final bool isPrimary;
  final bool isActive;
  final int priceAdjustmentBps;
  final String roundingMode;
}

class StorefrontLocale {
  const StorefrontLocale({
    required this.id,
    required this.locale,
    required this.name,
    required this.status,
    required this.isDefault,
    this.publishedAt,
  });

  factory StorefrontLocale.fromJson(Map<String, dynamic> json) {
    return StorefrontLocale(
      id: json['id']?.toString() ?? '',
      locale: json['locale']?.toString() ?? 'en-IN',
      name: json['name']?.toString() ?? json['locale']?.toString() ?? 'Locale',
      status: json['status']?.toString() ?? 'draft',
      isDefault: json['is_default'] == true,
      publishedAt: json['published_at']?.toString(),
    );
  }

  final String id;
  final String locale;
  final String name;
  final String status;
  final bool isDefault;
  final String? publishedAt;
}

class StorefrontTranslation {
  const StorefrontTranslation({
    required this.id,
    required this.locale,
    required this.resourceType,
    required this.resourceId,
    required this.field,
    required this.translatedText,
    required this.status,
    this.sourceText,
  });

  factory StorefrontTranslation.fromJson(Map<String, dynamic> json) {
    return StorefrontTranslation(
      id: json['id']?.toString() ?? '',
      locale: json['locale']?.toString() ?? 'en-IN',
      resourceType: json['resource_type']?.toString() ?? 'store',
      resourceId: json['resource_id']?.toString() ?? 'storefront',
      field: json['field']?.toString() ?? 'title',
      sourceText: json['source_text']?.toString(),
      translatedText: json['translated_text']?.toString() ?? '',
      status: json['status']?.toString() ?? 'draft',
    );
  }

  final String id;
  final String locale;
  final String resourceType;
  final String resourceId;
  final String field;
  final String? sourceText;
  final String translatedText;
  final String status;
}

List<Map<String, dynamic>> _jsonList(Object? value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((row) => Map<String, dynamic>.from(row))
      .toList(growable: false);
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
