import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'skip_needs_backend_exception.dart';

class MarketplaceAppContract {
  const MarketplaceAppContract({
    required this.id,
    required this.slug,
    required this.name,
    required this.tagline,
    required this.description,
    required this.developerName,
    required this.categoryName,
    required this.categorySlug,
    required this.iconUrl,
    required this.pricingModel,
    required this.priceInr,
    required this.installCount,
    required this.reviewCount,
    required this.rating,
    required this.scopes,
    required this.appUrl,
  });

  factory MarketplaceAppContract.fromJson(Map<String, dynamic> json) {
    final developer = _mapValue(json['app_developers']);
    final category = _mapValue(json['app_categories']);
    return MarketplaceAppContract(
      id: _stringValue(json['id']),
      slug: _stringValue(json['slug']),
      name: _stringValue(json['name'], fallback: 'Marketplace app'),
      tagline: _stringValue(json['tagline']),
      description: _stringValue(json['description']),
      developerName: _stringValue(
        json['developer_name'] ?? developer['company_name'],
      ),
      categoryName: _stringValue(
        json['category_name'] ?? category['name'],
        fallback: 'Apps',
      ),
      categorySlug: _stringValue(json['category'] ?? category['slug']),
      iconUrl: _stringValue(json['icon_url']),
      pricingModel: _stringValue(json['pricing_model'], fallback: 'free'),
      priceInr: _numValue(json['price_inr']),
      installCount: _intValue(json['install_count']),
      reviewCount: _intValue(json['review_count']),
      rating: _numValue(json['rating_avg'] ?? json['avg_rating']),
      scopes: _stringList(json['api_scopes'] ?? json['scopes']),
      appUrl: _stringValue(json['app_url']),
    );
  }

  final String id;
  final String slug;
  final String name;
  final String tagline;
  final String description;
  final String developerName;
  final String categoryName;
  final String categorySlug;
  final String iconUrl;
  final String pricingModel;
  final num priceInr;
  final int installCount;
  final int reviewCount;
  final num rating;
  final List<String> scopes;
  final String appUrl;

  String get summary => tagline.isNotEmpty ? tagline : description;
  String get pricingLabel {
    if (pricingModel == 'free') return 'Free';
    if (priceInr > 0) return 'INR ${priceInr.toStringAsFixed(0)}';
    return _titleCase(pricingModel);
  }
}

class AppCategoryContract {
  const AppCategoryContract({
    required this.slug,
    required this.name,
    required this.count,
  });

  factory AppCategoryContract.fromJson(Map<String, dynamic> json) {
    return AppCategoryContract(
      slug: _stringValue(json['slug']),
      name: _stringValue(json['name'], fallback: 'Apps'),
      count: _intValue(json['count']),
    );
  }

  final String slug;
  final String name;
  final int count;
}

class InstalledAppContract {
  const InstalledAppContract({
    required this.id,
    required this.appId,
    required this.storeId,
    required this.status,
    required this.scopes,
    required this.installedAt,
    required this.app,
  });

  factory InstalledAppContract.fromJson(Map<String, dynamic> json) {
    final appJson = _mapValue(json['marketplace_apps']);
    return InstalledAppContract(
      id: _stringValue(json['id']),
      appId: _stringValue(json['app_id'] ?? appJson['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      status: _stringValue(json['status'], fallback: 'active'),
      scopes: _stringList(json['scopes_granted']),
      installedAt: _stringValue(json['installed_at']),
      app: MarketplaceAppContract.fromJson({
        ...appJson,
        'id': appJson['id'] ?? json['app_id'],
        'name': appJson['name'] ?? json['app_name'],
      }),
    );
  }

  final String id;
  final String appId;
  final String storeId;
  final String status;
  final List<String> scopes;
  final String installedAt;
  final MarketplaceAppContract app;
}

class AppBridgeHandoffContract {
  const AppBridgeHandoffContract({
    required this.title,
    required this.url,
    required this.expiresAt,
  });

  factory AppBridgeHandoffContract.fromJson(Map<String, dynamic> json) {
    final embed = _mapValue(json['embed']);
    final bridge = _mapValue(json['bridge']);
    return AppBridgeHandoffContract(
      title: _stringValue(embed['title'], fallback: 'Installed app'),
      url: _stringValue(embed['url']),
      expiresAt: _stringValue(bridge['expires_at']),
    );
  }

  final String title;
  final String url;
  final String expiresAt;
}

class AppMarketplaceService extends ChangeNotifier {
  AppMarketplaceService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<MarketplaceAppContract> _apps = [];
  List<MarketplaceAppContract> get apps => List.unmodifiable(_apps);

  List<AppCategoryContract> _categories = [];
  List<AppCategoryContract> get categories => List.unmodifiable(_categories);

  List<InstalledAppContract> _installations = [];
  List<InstalledAppContract> get installations =>
      List.unmodifiable(_installations);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<AppCategoryContract>> fetchCategories() async {
    final rows = await _api.appStore.categories();
    _categories = rows
        .map(AppCategoryContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _categories;
  }

  Future<List<MarketplaceAppContract>> fetchApps({
    String? search,
    String? category,
    String? pricing,
    String sort = 'popular',
    int limit = 50,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final page = await _api.appStore.apps(
        query: {
          'limit': limit,
          'sort': sort,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
          if (category != null && category != 'all') 'category': category,
          if (pricing != null && pricing != 'all') 'pricing': pricing,
        },
      );
      _apps = page.data
          .map(MarketplaceAppContract.fromJson)
          .toList(growable: false);
      return _apps;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<InstalledAppContract>> fetchInstallations(String storeId) async {
    final rows = await _api.appStore.installations(
      query: {'store_id': storeId},
    );
    _installations = rows
        .map(InstalledAppContract.fromJson)
        .toList(growable: false);
    notifyListeners();
    return _installations;
  }

  Future<void> refresh({
    required String storeId,
    String? search,
    String? category,
    String? pricing,
  }) async {
    await Future.wait([
      fetchCategories(),
      fetchApps(search: search, category: category, pricing: pricing),
      fetchInstallations(storeId),
    ]);
  }

  Future<InstalledAppContract> installApp({
    required MarketplaceAppContract app,
    required String storeId,
  }) async {
    final response = await _api.appStore.install(app.id, {
      'store_id': storeId,
      'scopes': app.scopes,
      'idempotency_key': 'mobile-app-install:$storeId:${app.id}',
    });
    final installation = InstalledAppContract.fromJson(
      _mapValue(response['installation']).isEmpty
          ? response
          : _mapValue(response['installation']),
    );
    _installations = [
      installation,
      ..._installations.where((item) => item.appId != installation.appId),
    ];
    notifyListeners();
    return installation;
  }

  Future<void> uninstallApp({
    required MarketplaceAppContract app,
    required String storeId,
  }) async {
    await _api.appStore.uninstall(
      app.id,
      query: {'store_id': storeId},
      options: ApiRequestOptions(
        idempotencyKey: 'mobile-app-uninstall:$storeId:${app.id}',
      ),
    );
    _installations = _installations
        .where((item) => item.appId != app.id)
        .toList(growable: false);
    notifyListeners();
  }

  Future<AppBridgeHandoffContract> createDesktopBridgeHandoff({
    required InstalledAppContract installation,
  }) async {
    final response = await _api.appStore.embedSession(
      installation.id,
      query: {'store_id': installation.storeId},
    );
    return AppBridgeHandoffContract.fromJson(response);
  }

  Future<void> openEmbeddedAppBridgeRuntime(
    InstalledAppContract installation,
  ) async {
    // [SKIP-NEEDS-BACKEND: MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME]
    throw const SkipNeedsBackendException(
      'MOBILE_EMBEDDED_APP_BRIDGE_RUNTIME',
      'Native mobile App Bridge runtime is platform-blocked; use the web handoff until a mobile-safe extension host contract exists.',
    );
  }

  bool isInstalled(String appId) {
    return _installations.any(
      (item) => item.appId == appId && item.status != 'uninstalled',
    );
  }

  InstalledAppContract? installationFor(String appId) {
    for (final installation in _installations) {
      if (installation.appId == appId && installation.status != 'uninstalled') {
        return installation;
      }
    }
    return null;
  }
}

Map<String, dynamic> _mapValue(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((key, item) => MapEntry('$key', item));
  return const {};
}

List<String> _stringList(Object? value) {
  if (value is List) {
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }
  return const [];
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

num _numValue(Object? value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value) ?? 0;
  return 0;
}

String _titleCase(String value) {
  if (value.isEmpty) return value;
  return value
      .split(RegExp(r'[_\-\s]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}
