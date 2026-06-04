import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import '../models/theme_editor_models.dart';
import 'api_client.dart';

/// Store-scoped theme API client.
///
/// This service intentionally mirrors the Admin Web theme flow:
/// catalog -> install -> load editor -> save draft -> publish.
class ThemeService extends ChangeNotifier {
  final ApiClient _api;

  ThemeService({required ApiClient api}) : _api = api;

  ThemeCatalogResponse? _catalog;
  ThemeCatalogResponse? get catalog => _catalog;

  ThemeEditorPayload? _editorPayload;
  ThemeEditorPayload? get editorPayload => _editorPayload;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<ThemeCatalogResponse> fetchThemes(String storeId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.themes.catalogPayload(
        query: {'store_id': storeId, 'limit': 50},
      );
      _catalog = ThemeCatalogResponse.fromJson(Map<String, dynamic>.from(res));
      return _catalog!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> installTheme({
    required String storeId,
    required String themeSlug,
    Map<String, dynamic> configOverrides = const {},
  }) async {
    await _api.themes.install(themeSlug, {
      'store_id': storeId,
      'config_overrides': configOverrides,
    });
    await fetchThemes(storeId);
  }

  Future<ThemeEditorPayload> loadEditor({
    required String storeId,
    required String themeSlug,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.themes.editor(themeSlug, storeId);
      _editorPayload = ThemeEditorPayload.fromJson({
        'data': Map<String, dynamic>.from(res),
      });
      return _editorPayload!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<ThemeDraftSaveResult> saveDraft({
    required String storeId,
    required String themeSlug,
    required Map<String, dynamic> templateConfig,
    int? baseVersion,
  }) async {
    final res = await _api.themes.saveDraft(themeSlug, {
      'store_id': storeId,
      'template_config': templateConfig,
      if (baseVersion != null) 'base_version': baseVersion,
      'client': 'flutter-builder',
    });

    return ThemeDraftSaveResult.fromJson({
      'data': Map<String, dynamic>.from(res),
    });
  }

  Future<ThemeDraftSaveResult> duplicateDraft({
    required String storeId,
    required String themeSlug,
    required Map<String, dynamic> templateConfig,
    int? baseVersion,
  }) {
    return saveDraft(
      storeId: storeId,
      themeSlug: themeSlug,
      templateConfig: {
        ...templateConfig,
        'duplicatedAt': DateTime.now().toIso8601String(),
      },
      baseVersion: baseVersion,
    );
  }

  Future<void> discardDraft({
    required String storeId,
    required String themeSlug,
  }) async {
    await _api.themes.deleteDraft(themeSlug, storeId);
  }

  Future<List<Map<String, dynamic>>> fetchReleases({
    required String storeId,
    required String themeSlug,
  }) async {
    return _api.themes.releases(themeSlug, storeId);
  }

  Future<Map<String, dynamic>> createPreviewSession({
    required String storeId,
    required String themeSlug,
    int ttlSeconds = 900,
  }) async {
    return _api.themes.previewSession(themeSlug, {
      'store_id': storeId,
      'ttl_seconds': ttlSeconds,
    });
  }

  Future<void> rollbackRelease({
    required String storeId,
    required String themeSlug,
    required String releaseId,
    String? rollbackMessage,
    bool makeStoreLive = true,
  }) async {
    await _api.themes.rollbackRelease(themeSlug, releaseId, {
      'store_id': storeId,
      'make_store_live': makeStoreLive,
      if (rollbackMessage != null) 'rollback_message': rollbackMessage,
    });
    await fetchThemes(storeId);
  }

  Future<void> publish({
    required String storeId,
    required String themeSlug,
    int? baseVersion,
    bool makeStoreLive = true,
  }) async {
    await _api.themes.publish(themeSlug, {
      'store_id': storeId,
      if (baseVersion != null) 'base_version': baseVersion,
      'make_store_live': makeStoreLive,
    });
    await fetchThemes(storeId);
  }

  static String buildStorefrontPreviewUrl({
    required String subdomain,
    String? previewToken,
    String viewport = 'phone',
    Map<String, dynamic>? settingsData,
  }) {
    final base = Uri.parse(AppConfig.storefrontBaseUrl);
    final basePath = base.path.endsWith('/')
        ? base.path.substring(0, base.path.length - 1)
        : base.path;
    final query = <String, String>{
      'subdomain': subdomain,
      'viewport': _normalizeViewport(viewport),
      'editor': '1',
      if (previewToken != null && previewToken.isNotEmpty)
        'theme_preview_token': previewToken,
      if (settingsData != null && settingsData.isNotEmpty)
        'settings_data_b64': base64UrlEncode(
          utf8.encode(jsonEncode({'current': settingsData})),
        ),
    };

    return base
        .replace(path: '$basePath/preview', queryParameters: query)
        .toString();
  }

  static String _normalizeViewport(String viewport) {
    switch (viewport) {
      case 'laptop':
        return 'desktop';
      case 'tablet':
        return 'tablet';
      default:
        return 'mobile';
    }
  }
}
