class ThemeCatalogItem {
  final String id;
  final String slug;
  final String name;
  final String? category;
  final String? description;
  final String? thumbnailUrl;
  final String? previewUrl;
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

  const ThemeCatalogResponse({
    required this.themes,
    this.currentTheme,
    this.storeStatus,
  });

  factory ThemeCatalogResponse.fromJson(Map<String, dynamic> json) {
    final rawThemes = json['data'] as List? ?? const [];
    return ThemeCatalogResponse(
      themes: rawThemes
          .map((item) => ThemeCatalogItem.fromJson(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
      currentTheme: json['current_theme']?.toString(),
      storeStatus: json['store_status']?.toString(),
    );
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
    final schemas = Map<String, dynamic>.from(data['schemas'] as Map? ?? const {});
    final release = data['release'] is Map
        ? ThemeReleaseSummary.fromJson(
            Map<String, dynamic>.from(data['release'] as Map),
          )
        : null;
    final updatedAt = draft['updated_at']?.toString();

    return ThemeEditorPayload(
      store: Map<String, dynamic>.from(data['store'] as Map? ?? const {}),
      theme: Map<String, dynamic>.from(data['theme'] as Map? ?? const {}),
      templateConfig:
          Map<String, dynamic>.from(data['template_config'] as Map? ?? const {}),
      sectionSchemas:
          Map<String, dynamic>.from(schemas['sections'] as Map? ?? const {}),
      settingsSchema:
          Map<String, dynamic>.from(schemas['settings'] as Map? ?? const {}),
      release: release,
      hasDraft: draft['exists'] == true,
      version: (data['version'] as num?)?.toInt() ??
          (draft['version'] as num?)?.toInt() ??
          1,
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
      version: (json['version'] as num?)?.toInt() ??
          (json['release_version'] as num?)?.toInt() ??
          0,
      publishedAt: publishedAt != null ? DateTime.tryParse(publishedAt) : null,
    );
  }
}

class ThemeDraftSaveResult {
  final int version;
  final DateTime? savedAt;

  const ThemeDraftSaveResult({
    required this.version,
    this.savedAt,
  });

  factory ThemeDraftSaveResult.fromJson(Map<String, dynamic> json) {
    final data = Map<String, dynamic>.from(json['data'] as Map? ?? const {});
    final savedAt = data['saved_at']?.toString();
    return ThemeDraftSaveResult(
      version: (data['version'] as num?)?.toInt() ?? 1,
      savedAt: savedAt != null ? DateTime.tryParse(savedAt) : null,
    );
  }
}
