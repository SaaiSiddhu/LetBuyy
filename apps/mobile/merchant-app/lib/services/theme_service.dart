import 'package:flutter/foundation.dart';

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
      final res = await _api.get('themes', query: {'store_id': storeId});
      _catalog = ThemeCatalogResponse.fromJson(
        Map<String, dynamic>.from(res as Map),
      );
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
    await _api.post(
      'themes/$themeSlug/install',
      body: {
        'store_id': storeId,
        'config_overrides': configOverrides,
      },
    );
    await fetchThemes(storeId);
  }

  Future<ThemeEditorPayload> loadEditor({
    required String storeId,
    required String themeSlug,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get(
        'themes/$themeSlug/editor',
        query: {'store_id': storeId},
      );
      _editorPayload = ThemeEditorPayload.fromJson(
        Map<String, dynamic>.from(res as Map),
      );
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
    final res = await _api.put(
      'themes/$themeSlug/editor/draft',
      body: {
        'store_id': storeId,
        'template_config': templateConfig,
        if (baseVersion != null) 'base_version': baseVersion,
        'client': 'flutter-builder',
      },
    );

    return ThemeDraftSaveResult.fromJson(
      Map<String, dynamic>.from(res as Map),
    );
  }

  Future<void> discardDraft({
    required String storeId,
    required String themeSlug,
  }) async {
    await _api.delete('themes/$themeSlug/editor/draft?store_id=$storeId');
  }

  Future<List<Map<String, dynamic>>> fetchReleases({
    required String storeId,
    required String themeSlug,
  }) async {
    final res = await _api.get(
      'themes/$themeSlug/releases',
      query: {'store_id': storeId},
    );
    final json = Map<String, dynamic>.from(res as Map);
    final rows = json['data'] as List? ?? const [];
    return rows
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> createPreviewSession({
    required String storeId,
    required String themeSlug,
    int ttlSeconds = 900,
  }) async {
    final res = await _api.post(
      'themes/$themeSlug/preview-session',
      body: {
        'store_id': storeId,
        'ttl_seconds': ttlSeconds,
      },
    );
    final json = Map<String, dynamic>.from(res as Map);
    return Map<String, dynamic>.from(json['data'] as Map? ?? const {});
  }

  Future<void> rollbackRelease({
    required String storeId,
    required String themeSlug,
    required String releaseId,
    String? rollbackMessage,
    bool makeStoreLive = true,
  }) async {
    await _api.post(
      'themes/$themeSlug/releases/$releaseId/rollback',
      body: {
        'store_id': storeId,
        'make_store_live': makeStoreLive,
        if (rollbackMessage != null) 'rollback_message': rollbackMessage,
      },
    );
    await fetchThemes(storeId);
  }

  Future<void> publish({
    required String storeId,
    required String themeSlug,
    int? baseVersion,
    bool makeStoreLive = true,
  }) async {
    await _api.post(
      'themes/$themeSlug/publish',
      body: {
        'store_id': storeId,
        if (baseVersion != null) 'base_version': baseVersion,
        'make_store_live': makeStoreLive,
      },
    );
    await fetchThemes(storeId);
  }
}
