import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../config/app_config.dart';
import '../models/theme_editor_models.dart';
import 'api_client.dart';

class ThemeDraftConflictException implements Exception {
  const ThemeDraftConflictException();

  static const message =
      'This theme draft changed in another session. Refresh the editor before saving again.';

  @override
  String toString() => message;
}

class ThemeDraftRetryRequiredException implements Exception {
  const ThemeDraftRetryRequiredException();
  @override
  String toString() =>
      'Recover the previous save request before saving newer edits.';
}

class _PendingThemeSave {
  _PendingThemeSave(this.context, this.key, this.body, this.signature);
  final Object? context;
  final String key, signature;
  final Map<String, dynamic> body;
  Future<ThemeDraftSaveResult>? inFlight;
}

class _PendingThemePublish {
  _PendingThemePublish(
    this.context,
    this.key,
    this.signature,
    this.initialVersion,
    this.config,
    this.makeStoreLive,
  );
  final Object? context;
  final String key, signature;
  final int initialVersion;
  final bool makeStoreLive;
  final Map<String, dynamic>? config;
  int? savedVersion;
}

/// Store-scoped theme API client.
///
/// This service intentionally mirrors the Admin Web theme flow:
/// catalog -> install -> load editor -> save draft -> publish.
class ThemeService extends ChangeNotifier {
  final ApiClient _api;

  ThemeService({required ApiClient api}) : _api = api;

  final Map<String, _PendingThemeSave> _pendingSaves = {};
  final Map<String, _PendingThemePublish> _pendingPublishes = {};
  final Map<Object, String> _discardKeys = {};
  Object? captureContext() => _api.captureRequestContext();
  void _requireContext(Object? expected) {
    if (captureContext() != expected)
      throw StateError(
        'The active account or store changed. Reload this theme.',
      );
  }

  String _scope(String store, String slug) => '$store:$slug';
  String _signature(Map<String, dynamic> body) {
    final copy = Map<String, dynamic>.from(body);
    final config = copy['template_config'];
    if (config is Map)
      copy['template_config'] = Map<String, dynamic>.from(config)
        ..remove('updatedAt')
        ..remove('duplicatedAt');
    return jsonEncode(copy);
  }

  bool hasPendingSave(String store, String slug) {
    final pending = _pendingSaves[_scope(store, slug)];
    return pending != null && pending.context == captureContext();
  }

  Future<ThemeDraftSaveResult> retryPendingSave({
    required String storeId,
    required String themeSlug,
  }) {
    final pending = _pendingSaves[_scope(storeId, themeSlug)];
    if (pending == null)
      throw StateError('No previous theme save needs recovery.');
    _requireContext(pending.context);
    return _sendPendingSave(_scope(storeId, themeSlug), themeSlug, pending);
  }

  Future<ThemeDraftSaveResult> _sendPendingSave(
    String scope,
    String slug,
    _PendingThemeSave pending,
  ) {
    if (pending.inFlight != null) return pending.inFlight!;
    final future = () async {
      try {
        _requireContext(pending.context);
        final result = await _api.themes.saveDraft(
          slug,
          pending.body,
          options: ApiRequestOptions(
            expectedContextVersion: pending.context,
            idempotencyKey: pending.key,
          ),
        );
        _requireContext(pending.context);
        if (result['version'] is! int ||
            result['version'] != (pending.body['base_version'] as int) + 1 ||
            result['current_version'] is! int ||
            result['replayed'] is! bool ||
            result['saved_at'] is! String ||
            DateTime.tryParse(result['saved_at'] as String) == null) {
          throw const FormatException(
            'No confirmed theme save receipt was returned. Retry the saved request.',
          );
        }
        final saved = ThemeDraftSaveResult.fromJson({
          'data': Map<String, dynamic>.from(result),
        });
        if (result['current_version'] is num &&
            result['current_version'] != saved.version) {
          if (identical(_pendingSaves[scope], pending))
            _pendingSaves.remove(scope);
          throw const ThemeDraftConflictException();
        }
        if (identical(_pendingSaves[scope], pending))
          _pendingSaves.remove(scope);
        return saved;
      } on ApiException catch (error) {
        _requireContext(pending.context);
        if (error.statusCode == 400 &&
            identical(_pendingSaves[scope], pending)) {
          _pendingSaves.remove(scope);
        }
        if (_isThemeConflict(error)) {
          if (identical(_pendingSaves[scope], pending))
            _pendingSaves.remove(scope);
          throw const ThemeDraftConflictException();
        }
        rethrow;
      } finally {
        pending.inFlight = null;
      }
    }();
    pending.inFlight = future;
    return future;
  }

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
    final context = captureContext();
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.themes.editor(
        themeSlug,
        storeId,
        options: ApiRequestOptions(expectedContextVersion: context),
      );
      _requireContext(context);
      if (res['version'] is! int || (res['version'] as int) < 0)
        throw const FormatException('The current theme revision is missing.');
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
    String? idempotencyKey,
  }) async {
    if (baseVersion == null || baseVersion < 0)
      throw ArgumentError('Load the current owned draft before saving.');
    final context = captureContext(), scope = _scope(storeId, themeSlug);
    final body = <String, dynamic>{
      'store_id': storeId,
      'template_key': 'index',
      'template_config': jsonDecode(jsonEncode(templateConfig)),
      'base_version': baseVersion,
      'client': 'flutter-builder',
    };
    final signature = _signature(body);
    var pending = _pendingSaves[scope];
    if (pending != null && pending.context != context) {
      _pendingSaves.remove(scope);
      pending = null;
    }
    if (pending != null &&
        (pending.signature != signature ||
            (idempotencyKey != null && pending.key != idempotencyKey)))
      throw const ThemeDraftRetryRequiredException();
    pending ??= _PendingThemeSave(
      context,
      idempotencyKey ?? const Uuid().v4(),
      body,
      signature,
    );
    pending.body['idempotency_key'] = pending.key;
    _pendingSaves[scope] = pending;
    return _sendPendingSave(scope, themeSlug, pending);
  }

  Future<ThemeDraftSaveResult> saveLiquidDraft({
    required String storeId,
    required String themeSlug,
    required Map<String, dynamic> templateConfig,
    required Map<String, dynamic> liquidBundle,
    bool liquidRenderingCanary = true,
    int? baseVersion,
  }) {
    return saveDraft(
      storeId: storeId,
      themeSlug: themeSlug,
      templateConfig: {
        ...templateConfig,
        'liquidBundle': liquidBundle,
        'liquidRenderingCanary': liquidRenderingCanary,
      },
      baseVersion: baseVersion,
    );
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
    int? baseVersion,
  }) async {
    final editor = _editorPayload;
    if (editor == null ||
        editor.store['id'] != storeId ||
        editor.theme['slug'] != themeSlug) {
      throw StateError('Load this theme before discarding its draft.');
    }
    final version = baseVersion ?? editor.version;
    if (version < 0) throw ArgumentError('Load the current theme version.');
    final context = captureContext();
    final scope = (context, storeId, themeSlug, version);
    final key = _discardKeys.putIfAbsent(scope, () => const Uuid().v4());
    final discarded = await _api.themes.deleteDraft(
      themeSlug,
      storeId,
      options: ApiRequestOptions(
        expectedContextVersion: context,
        idempotencyKey: key,
        query: {'base_version': version, 'idempotency_key': key},
      ),
    );
    _requireContext(context);
    if (discarded['deleted'] != true ||
        discarded['version'] != version + 1 ||
        discarded['current_version'] is! int ||
        discarded['replayed'] is! bool) {
      throw const FormatException(
        'No confirmed discard receipt was returned. Retry the same request.',
      );
    }
    if (discarded['current_version'] != discarded['version']) {
      throw const ThemeDraftConflictException();
    }
    if (identical(_editorPayload, editor)) _editorPayload = null;
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

  bool hasPendingPublication(String storeId, String themeSlug) {
    final pending = _pendingPublishes[_scope(storeId, themeSlug)];
    return pending != null && pending.context == captureContext();
  }

  Future<void> recoverPublication({
    required String storeId,
    required String themeSlug,
  }) async {
    final pending = _pendingPublishes[_scope(storeId, themeSlug)];
    if (pending == null)
      throw StateError('No publication request needs recovery.');
    _requireContext(pending.context);
    return publish(
      storeId: storeId,
      themeSlug: themeSlug,
      templateConfig: pending.config,
      baseVersion: pending.initialVersion,
      makeStoreLive: pending.makeStoreLive,
    );
  }

  Future<void> publish({
    required String storeId,
    required String themeSlug,
    Map<String, dynamic>? templateConfig,
    Map<String, dynamic>? liquidBundle,
    bool? liquidRenderingCanary,
    int? baseVersion,
    bool makeStoreLive = true,
  }) async {
    if (baseVersion == null || baseVersion < 0)
      throw ArgumentError('Load the current owned draft before publishing.');
    final context = captureContext(), scope = _scope(storeId, themeSlug);
    final config = templateConfig == null
        ? null
        : <String, dynamic>{
            ...templateConfig,
            if (liquidBundle != null) 'liquidBundle': liquidBundle,
            if (liquidRenderingCanary != null)
              'liquidRenderingCanary': liquidRenderingCanary,
          };
    final signature = jsonEncode({
      'version': baseVersion,
      'config': config,
      'make_store_live': makeStoreLive,
    });
    var pending = _pendingPublishes[scope];
    if (pending != null && pending.context != context) {
      _pendingPublishes.remove(scope);
      pending = null;
    }
    if (pending != null && pending.signature != signature)
      throw const ThemeDraftRetryRequiredException();
    pending ??= _PendingThemePublish(
      context,
      const Uuid().v4(),
      signature,
      baseVersion,
      config == null
          ? null
          : Map<String, dynamic>.from(jsonDecode(jsonEncode(config)) as Map),
      makeStoreLive,
    );
    _pendingPublishes[scope] = pending;
    try {
      pending.savedVersion ??= config == null
          ? baseVersion
          : (await saveDraft(
              storeId: storeId,
              themeSlug: themeSlug,
              templateConfig: pending.config!,
              baseVersion: pending.initialVersion,
            )).version;
      _requireContext(context);
      final published = await _api.themes.publish(
        themeSlug,
        {
          'store_id': storeId,
          'template_key': 'index',
          'base_version': pending.savedVersion,
          'idempotency_key': pending.key,
          'make_store_live': makeStoreLive,
        },
        options: ApiRequestOptions(
          expectedContextVersion: context,
          idempotencyKey: pending.key,
        ),
      );
      _requireContext(context);
      final release = published['release'];
      if (published['version'] is! int ||
          published['version'] != pending.savedVersion! + 1 ||
          published['current_version'] is! int ||
          published['replayed'] is! bool ||
          release is! Map ||
          release['release_id'] is! String ||
          (release['release_id'] as String).isEmpty) {
        throw const FormatException(
          'No confirmed publication receipt was returned. Retry the same request.',
        );
      }
      if (published['current_version'] != published['version']) {
        if (identical(_pendingPublishes[scope], pending))
          _pendingPublishes.remove(scope);
        throw const ThemeDraftConflictException();
      }
      if (identical(_pendingPublishes[scope], pending))
        _pendingPublishes.remove(scope);
    } on ApiException catch (error) {
      _requireContext(context);
      if (error.statusCode == 400 &&
          identical(_pendingPublishes[scope], pending)) {
        _pendingPublishes.remove(scope);
      }
      if (_isThemeConflict(error)) {
        if (identical(_pendingPublishes[scope], pending))
          _pendingPublishes.remove(scope);
        throw const ThemeDraftConflictException();
      }
      rethrow;
    }
    // Confirmed publication must not become a false failed mutation because a
    // subsequent catalog refresh is unavailable; the normal catalog can retry.
    try {
      await fetchThemes(storeId);
    } catch (_) {}
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

bool _isThemeConflict(ApiException error) {
  return error.statusCode == 409 || error.code == 'CONFLICT';
}
