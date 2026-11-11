class ThemeCatalogItem {
  final String id;
  final String slug;
  final String name;
  final String? category;
  final String? description;
  final String? thumbnailUrl;
  final String? previewUrl;

  /// Catalog version is distinct from an already installed package version.
  final String? version;
  final String? pricingType;
  final num? priceInr;
  final List<String> features;
  final bool installed;
  final bool active;
  final bool isPremium;

  const ThemeCatalogItem({
    required this.id,
    required this.slug,
    required this.name,
    this.category,
    this.description,
    this.thumbnailUrl,
    this.previewUrl,
    this.version,
    this.pricingType,
    this.priceInr,
    this.features = const [],
    this.installed = false,
    this.active = false,
    this.isPremium = false,
  });

  factory ThemeCatalogItem.fromJson(Map<String, dynamic> json) {
    return ThemeCatalogItem(
      id: json['id']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: json['category']?.toString(),
      description: json['description']?.toString(),
      thumbnailUrl: json['thumbnail_url']?.toString(),
      previewUrl: json['preview_url']?.toString(),
      version: json['version']?.toString(),
      pricingType: (json['pricing_type'] ?? json['letbuyy_pricing_type'])
          ?.toString(),
      priceInr:
          (json['price_inr'] ?? json['letbuyy_price_inr'] ?? json['price'])
              is num
          ? (json['price_inr'] ?? json['letbuyy_price_inr'] ?? json['price'])
                as num
          : null,
      features: (json['features'] as List? ?? const [])
          .whereType<String>()
          .toList(growable: false),
      installed: json['installed'] == true,
      active: json['active'] == true,
      isPremium: json['is_premium'] == true,
    );
  }
}

class ThemeCatalogResponse {
  final List<ThemeCatalogItem> themes;
  final String? currentTheme;
  final String? storeStatus;
  final ThemeCatalogItem? currentThemeRecord;

  const ThemeCatalogResponse({
    required this.themes,
    this.currentTheme,
    this.storeStatus,
    this.currentThemeRecord,
  });

  factory ThemeCatalogResponse.fromJson(Map<String, dynamic> json) {
    final rawThemes = json['data'] as List? ?? const [];
    return ThemeCatalogResponse(
      themes: rawThemes
          .map(
            (item) => ThemeCatalogItem.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      currentTheme: json['current_theme']?.toString(),
      storeStatus: json['store_status']?.toString(),
      currentThemeRecord: json['current_theme_record'] is Map
          ? ThemeCatalogItem.fromJson(
              Map<String, dynamic>.from(json['current_theme_record'] as Map),
            )
          : null,
    );
  }
}

/// Captured installed identity; never substituted with the latest catalog row.
class ThemeLibraryItem {
  final String instanceId, slug, name, status;
  final String? version, packageVersionId, thumbnailUrl;
  final bool hasDraft, isCurrentlyPublished;
  const ThemeLibraryItem({
    required this.instanceId,
    required this.slug,
    required this.name,
    required this.status,
    this.version,
    this.packageVersionId,
    this.thumbnailUrl,
    this.hasDraft = false,
    this.isCurrentlyPublished = false,
  });
  bool get available => status == 'installed' || status == 'active';
  factory ThemeLibraryItem.fromJson(Map<String, dynamic> json) =>
      ThemeLibraryItem(
        instanceId: json['instance_id']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        status: json['instance_status']?.toString() ?? '',
        version: json['version']?.toString(),
        packageVersionId: json['theme_package_version_id']?.toString(),
        thumbnailUrl: json['thumbnail_url']?.toString(),
        hasDraft: json['hasDraft'] == true,
        isCurrentlyPublished: json['isCurrentlyPublished'] == true,
      );
}

/// Dart transport projection of theme-engine's canonical install receipt.
class ThemeInstallReceipt {
  final String instanceId, packageId, packageVersionId, slug, version;
  final bool alreadyInstalled;
  const ThemeInstallReceipt({
    required this.instanceId,
    required this.packageId,
    required this.packageVersionId,
    required this.slug,
    required this.version,
    required this.alreadyInstalled,
  });
  static final _uuid = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  );
  factory ThemeInstallReceipt.fromJson(
    Map<String, dynamic> value, {
    required String expectedSlug,
    String? expectedVersion,
  }) {
    final theme = value['theme'] is Map
        ? Map<String, dynamic>.from(value['theme'] as Map)
        : const <String, dynamic>{};
    final instance = value['theme_instance_id'],
        package = value['theme_package_id'],
        packageVersion = value['theme_package_version_id'],
        version = value['installed_version'];
    if (instance is! String ||
        !_uuid.hasMatch(instance) ||
        package is! String ||
        !_uuid.hasMatch(package) ||
        packageVersion is! String ||
        !_uuid.hasMatch(packageVersion) ||
        version is! String ||
        version.isEmpty ||
        version.trim() != version ||
        RegExp(r'[\x00-\x1f\x7f]').hasMatch(version) ||
        value['already_installed'] is! bool ||
        theme['slug'] != expectedSlug ||
        theme['id'] is! String ||
        !_uuid.hasMatch(theme['id'] as String) ||
        theme['name'] is! String ||
        (theme['name'] as String).isEmpty ||
        theme['version'] != version ||
        (expectedVersion != null && expectedVersion != version)) {
      throw const FormatException(
        'The selected theme instance and package version were not confirmed. Check your library and retry.',
      );
    }
    return ThemeInstallReceipt(
      instanceId: instance,
      packageId: package,
      packageVersionId: packageVersion,
      slug: expectedSlug,
      version: version,
      alreadyInstalled: value['already_installed'] as bool,
    );
  }
  void confirmLibrary(List<ThemeLibraryItem> items) {
    if (!items.any(
      (item) =>
          item.available &&
          item.slug == slug &&
          item.instanceId.toLowerCase() == instanceId.toLowerCase() &&
          item.packageVersionId?.toLowerCase() ==
              packageVersionId.toLowerCase(),
    )) {
      throw const FormatException(
        'The added theme version could not be confirmed in this store’s library. Retry to confirm the same installation.',
      );
    }
  }
}

class ThemeEditorPayload {
  final Map<String, dynamic> store;
  final Map<String, dynamic> theme;
  final Map<String, dynamic> templateConfig;
  final Map<String, dynamic> sectionSchemas;
  final Map<String, dynamic> settingsSchema;
  final ThemeReleaseSummary? release;
  final bool hasDraft;
  final int version;
  final DateTime? draftUpdatedAt;

  const ThemeEditorPayload({
    required this.store,
    required this.theme,
    required this.templateConfig,
    required this.sectionSchemas,
    required this.settingsSchema,
    this.release,
    required this.hasDraft,
    required this.version,
    this.draftUpdatedAt,
  });

  factory ThemeEditorPayload.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? const {});
    final draft = Map<String, dynamic>.from(data['draft'] as Map? ?? const {});
    final schemas = Map<String, dynamic>.from(
      data['schemas'] as Map? ?? const {},
    );
    final release = data['release'] is Map
        ? ThemeReleaseSummary.fromJson(
            Map<String, dynamic>.from(data['release'] as Map),
          )
        : null;
    final updatedAt = draft['updated_at']?.toString();
    final revision = data['version'];
    if (revision is! int || revision < 0)
      throw const FormatException('The current theme revision is missing.');

    return ThemeEditorPayload(
      store: Map<String, dynamic>.from(data['store'] as Map? ?? const {}),
      theme: Map<String, dynamic>.from(data['theme'] as Map? ?? const {}),
      templateConfig: Map<String, dynamic>.from(
        data['template_config'] as Map? ?? const {},
      ),
      sectionSchemas: Map<String, dynamic>.from(
        schemas['sections'] as Map? ?? const {},
      ),
      settingsSchema: Map<String, dynamic>.from(
        schemas['settings'] as Map? ?? const {},
      ),
      release: release,
      hasDraft: draft['exists'] == true,
      version: revision,
      draftUpdatedAt: updatedAt != null ? DateTime.tryParse(updatedAt) : null,
    );
  }
}

class ThemeReleaseSummary {
  final String id;
  final int version;
  final DateTime? publishedAt;

  const ThemeReleaseSummary({
    required this.id,
    required this.version,
    this.publishedAt,
  });

  factory ThemeReleaseSummary.fromJson(Map<String, dynamic> json) {
    final publishedAt = json['published_at']?.toString();
    return ThemeReleaseSummary(
      id: json['id']?.toString() ?? '',
      version:
          (json['version'] as num?)?.toInt() ??
          (json['release_version'] as num?)?.toInt() ??
          0,
      publishedAt: publishedAt != null ? DateTime.tryParse(publishedAt) : null,
    );
  }
}

class ThemeDraftSaveResult {
  final int version;
  final DateTime? savedAt;

  const ThemeDraftSaveResult({required this.version, this.savedAt});

  factory ThemeDraftSaveResult.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? const {});
    final savedAt = data['saved_at']?.toString();
    final revision = data['version'];
    if (revision is! int ||
        revision <= 0 ||
        savedAt == null ||
        DateTime.tryParse(savedAt) == null) {
      throw const FormatException(
        'A confirmed theme save receipt is required.',
      );
    }
    return ThemeDraftSaveResult(
      version: revision,
      savedAt: DateTime.parse(savedAt),
    );
  }
}
