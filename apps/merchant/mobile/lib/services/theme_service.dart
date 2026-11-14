import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
    this.makeStoreLive, {
    this.journalActor,
  });
  final Object? context;
  final String key, signature;
  final String? journalActor;
  final int initialVersion;
  final bool makeStoreLive;
  final Map<String, dynamic>? config;
  int? savedVersion;
  Future<Map<String, dynamic>>? inFlight;
}

class _PendingThemeRollback {
  _PendingThemeRollback(
    this.context,
    this.key,
    this.releaseId,
    this.signature,
    this.body, {
    this.journalActor,
  });
  final Object? context;
  final String key, releaseId, signature;
  final String? journalActor;
  final Map<String, dynamic> body;
  Future<Map<String, dynamic>>? inFlight;
}

/// Store-scoped theme API client.
///
/// This service intentionally mirrors the Admin Web theme flow:
/// catalog -> install -> load editor -> save draft -> publish.
class ThemeService extends ChangeNotifier {
  final ApiClient _api;

  ThemeService({
    required ApiClient api,
    String? Function()? actorIdProvider,
    Future<SharedPreferences> Function()? recoveryPreferences,
  }) : _api = api,
       _actorIdProvider = actorIdProvider,
       _recoveryPreferences =
           recoveryPreferences ?? SharedPreferences.getInstance;

  final String? Function()? _actorIdProvider;
  final Future<SharedPreferences> Function() _recoveryPreferences;

  final Map<String, _PendingThemeSave> _pendingSaves = {};
  final Map<String, _PendingThemePublish> _pendingPublishes = {};
  final Map<Object, String> _discardKeys = {};
  final Map<Object, _PendingThemeRollback> _pendingRollbacks = {};
  Object? captureContext() => _api.captureRequestContext();
  void _requireContext(Object? expected) {
    if (captureContext() != expected)
      throw StateError(
        'The active account or store changed. Reload this theme.',
      );
  }

  static final Map<String, Future<void>> _journalTasks = {};

  String? _captureJournalActor() {
    final actor = _actorIdProvider?.call()?.trim();
    if (_actorIdProvider != null && (actor == null || actor.isEmpty)) {
      throw StateError('Sign in before recovering a theme request.');
    }
    return actor;
  }

  void _requireJournalBinding(Object? context, String? actor) {
    _requireContext(context);
    if (_actorIdProvider != null && _captureJournalActor() != actor) {
      throw StateError('The active account changed. Reload this theme.');
    }
  }

  Future<T> _serializeJournal<T>(
    String key,
    Future<T> Function() action,
  ) async {
    final previous = _journalTasks[key] ?? Future<void>.value();
    final release = Completer<void>();
    _journalTasks[key] = release.future;
    await previous;
    try {
      return await action();
    } finally {
      release.complete();
      if (identical(_journalTasks[key], release.future))
        _journalTasks.remove(key);
    }
  }

  String _journalKey(String kind, String actor, String store, String slug) =>
      'letbuyy:theme-intent:v1:${Uri.encodeComponent(actor)}:${Uri.encodeComponent(store)}:${Uri.encodeComponent(slug)}:$kind';

  bool _journalIdentifier(Object? value) =>
      value is String &&
      value.trim() == value &&
      value.isNotEmpty &&
      value.length <= 200 &&
      !value.runes.any((code) => code < 32 || code == 127);

  Map<String, dynamic>? _readJournal(
    SharedPreferences preferences,
    String key,
    String kind,
    String actor,
    String store,
    String slug,
  ) {
    final raw = preferences.getString(key);
    if (raw == null) return null;
    final Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      throw const FormatException(
        'Pending theme request metadata could not be confirmed. Keep it for recovery.',
      );
    }
    final fields = <String>{
      'version',
      'kind',
      'actorId',
      'storeId',
      'themeSlug',
      'key',
      'makeStoreLive',
      if (kind == 'publish')
        'baseVersion'
      else ...[
        'targetReleaseId',
        'expectedCurrentReleaseId',
        'rollbackMessage',
      ],
    };
    if (decoded is! Map<String, dynamic> ||
        decoded.length != fields.length ||
        !fields.every(decoded.containsKey) ||
        decoded['version'] != 1 ||
        decoded['kind'] != kind ||
        decoded['actorId'] != actor ||
        decoded['storeId'] != store ||
        decoded['themeSlug'] != slug ||
        !_journalIdentifier(decoded['key']) ||
        (decoded['key'] as String).length < 8 ||
        decoded['makeStoreLive'] is! bool ||
        (kind == 'publish' &&
            (decoded['baseVersion'] is! int ||
                (decoded['baseVersion'] as int) < 1)) ||
        (kind == 'rollback' &&
            (!_journalIdentifier(decoded['targetReleaseId']) ||
                !_journalIdentifier(decoded['expectedCurrentReleaseId']) ||
                decoded['targetReleaseId'] ==
                    decoded['expectedCurrentReleaseId'] ||
                (decoded['rollbackMessage'] != null &&
                    (decoded['rollbackMessage'] is! String ||
                        (decoded['rollbackMessage'] as String).length >
                            500))))) {
      throw const FormatException(
        'Pending theme request metadata could not be confirmed. Keep it for recovery before starting another request.',
      );
    }
    return Map<String, dynamic>.unmodifiable(decoded);
  }

  Future<T> _withJournal<T>({
    required String kind,
    required String actor,
    required String store,
    required String slug,
    required Object? context,
    required Future<T> Function(
      SharedPreferences,
      String,
      Map<String, dynamic>?,
    )
    action,
  }) {
    final key = _journalKey(kind, actor, store, slug);
    return _serializeJournal(key, () async {
      _requireJournalBinding(context, actor);
      final preferences = await _recoveryPreferences();
      _requireJournalBinding(context, actor);
      final metadata = _readJournal(preferences, key, kind, actor, store, slug);
      final result = await action(preferences, key, metadata);
      _requireJournalBinding(context, actor);
      return result;
    });
  }

  _PendingThemePublish _publicationFromJournal(
    Map<String, dynamic> value,
    Object? context,
    String actor,
  ) {
    final version = value['baseVersion'] as int,
        live = value['makeStoreLive'] as bool;
    return _PendingThemePublish(
      context,
      value['key'] as String,
      jsonEncode({'version': version, 'config': null, 'make_store_live': live}),
      version,
      null,
      live,
      journalActor: actor,
    )..savedVersion = version;
  }

  _PendingThemeRollback _rollbackFromJournal(
    Map<String, dynamic> value,
    Object? context,
    String actor,
  ) {
    final body = <String, dynamic>{
      'store_id': value['storeId'],
      'target_release_id': value['targetReleaseId'],
      'expected_current_release_id': value['expectedCurrentReleaseId'],
      'make_store_live': value['makeStoreLive'],
      if (value['rollbackMessage'] != null)
        'rollback_message': value['rollbackMessage'],
    };
    return _PendingThemeRollback(
      context,
      value['key'] as String,
      value['targetReleaseId'] as String,
      _signature(body),
      Map.unmodifiable(
        {...body, 'theme_slug': value['themeSlug']}
          ..remove('target_release_id'),
      ),
      journalActor: actor,
    );
  }

  Future<void> _restorePublication(
    String store,
    String slug,
    Object? context,
    String? actor,
  ) async {
    if (actor == null) return;
    await _withJournal<void>(
      kind: 'publish',
      actor: actor,
      store: store,
      slug: slug,
      context: context,
      action: (_, __, value) async {
        if (value == null) return;
        final scope = _scope(store, slug),
            pending = _pendingPublishes[_scope(store, slug)];
        if (pending?.context == context && pending?.key == value['key']) return;
        _pendingPublishes[scope] = _publicationFromJournal(
          value,
          context,
          actor,
        );
      },
    );
  }

  Future<void> _restoreRollback(
    String store,
    String slug,
    Object? context,
    String? actor,
  ) async {
    if (actor == null) return;
    await _withJournal<void>(
      kind: 'rollback',
      actor: actor,
      store: store,
      slug: slug,
      context: context,
      action: (_, __, value) async {
        if (value == null) return;
        final scope = (context, store, slug),
            pending = _pendingRollbacks[(context, store, slug)];
        if (pending?.key == value['key']) return;
        _pendingRollbacks[scope] = _rollbackFromJournal(value, context, actor);
      },
    );
  }

  bool _sameJournal(Map<String, dynamic> a, Map<String, dynamic> b) =>
      a.length == b.length &&
      a.entries.every((entry) => b[entry.key] == entry.value);

  Future<void> _persistPublication(
    String store,
    String slug,
    _PendingThemePublish pending,
  ) async {
    final actor = pending.journalActor;
    if (actor == null) return;
    final metadata = <String, dynamic>{
      'version': 1,
      'kind': 'publish',
      'actorId': actor,
      'storeId': store,
      'themeSlug': slug,
      'key': pending.key,
      'baseVersion': pending.savedVersion,
      'makeStoreLive': pending.makeStoreLive,
    };
    if (pending.savedVersion == null || pending.savedVersion! < 1)
      throw StateError('Save a draft before publishing.');
    await _withJournal<void>(
      kind: 'publish',
      actor: actor,
      store: store,
      slug: slug,
      context: pending.context,
      action: (preferences, key, value) async {
        if (value != null) {
          if (value['key'] != pending.key) {
            _pendingPublishes[_scope(store, slug)] = _publicationFromJournal(
              value,
              pending.context,
              actor,
            );
            throw const ThemeDraftRetryRequiredException();
          }
          if (!_sameJournal(value, metadata))
            throw const FormatException(
              'Publication retry metadata changed. Keep the original request for review.',
            );
          return;
        }
        // Persist only opaque identities, revision/key and protocol options.
        // Theme documents, tokens and the transient request context never enter preferences.
        if (!await preferences.setString(key, jsonEncode(metadata)))
          throw StateError(
            'Publication recovery storage is unavailable. Retry before publishing.',
          );
      },
    );
  }

  Future<void> _persistRollback(
    String store,
    String slug,
    _PendingThemeRollback pending,
  ) async {
    final actor = pending.journalActor;
    if (actor == null) return;
    final metadata = <String, dynamic>{
      'version': 1,
      'kind': 'rollback',
      'actorId': actor,
      'storeId': store,
      'themeSlug': slug,
      'key': pending.key,
      'targetReleaseId': pending.releaseId,
      'expectedCurrentReleaseId': pending.body['expected_current_release_id'],
      'makeStoreLive': pending.body['make_store_live'],
      'rollbackMessage': pending.body['rollback_message'],
    };
    await _withJournal<void>(
      kind: 'rollback',
      actor: actor,
      store: store,
      slug: slug,
      context: pending.context,
      action: (preferences, key, value) async {
        if (value != null) {
          if (value['key'] != pending.key) {
            _pendingRollbacks[(pending.context, store, slug)] =
                _rollbackFromJournal(value, pending.context, actor);
            throw StateError(
              'Recover the previous rollback before restoring another release.',
            );
          }
          if (!_sameJournal(value, metadata))
            throw const FormatException(
              'Rollback retry metadata changed. Keep the original request for review.',
            );
          return;
        }
        if (!await preferences.setString(key, jsonEncode(metadata)))
          throw StateError(
            'Rollback recovery storage is unavailable. Retry before restoring.',
          );
      },
    );
  }

  Future<bool> _retireJournal(
    String kind,
    String store,
    String slug,
    Object? context,
    String? actor,
    String intentKey,
  ) async {
    if (actor == null) return true;
    try {
      return await _withJournal<bool>(
        kind: kind,
        actor: actor,
        store: store,
        slug: slug,
        context: context,
        action: (preferences, key, value) async {
          // Another completed request may already have retired this key. Never
          // remove a newer intent captured by a different service instance.
          if (value == null || value['key'] != intentKey) return true;
          return preferences.remove(key);
        },
      );
    } catch (_) {
      _requireJournalBinding(context, actor);
      return false;
    }
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
    final captured = captureContext();
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.themes.catalogPayload(
        query: {'store_id': storeId, 'limit': 50},
        options: ApiRequestOptions(expectedContextVersion: captured),
      );
      _requireContext(captured);
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
      final payload = ThemeEditorPayload.fromJson({
        'data': Map<String, dynamic>.from(res),
      });
      final actor = _captureJournalActor();
      await _restorePublication(storeId, themeSlug, context, actor);
      _requireJournalBinding(context, actor);
      _editorPayload = payload;
      return payload;
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
    final captured = captureContext(), actor = _captureJournalActor();
    final releases = await _api.themes.releases(
      themeSlug,
      storeId,
      options: ApiRequestOptions(expectedContextVersion: captured),
    );
    _requireJournalBinding(captured, actor);
    await _restoreRollback(storeId, themeSlug, captured, actor);
    _requireJournalBinding(captured, actor);
    return releases;
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

  String? pendingRollbackTarget(String storeId, String themeSlug) {
    final pending = _pendingRollbacks[(captureContext(), storeId, themeSlug)];
    if (_actorIdProvider != null &&
        pending?.journalActor != _actorIdProvider?.call()?.trim())
      return null;
    return pending?.releaseId;
  }

  Future<Map<String, dynamic>> recoverRollback({
    required String storeId,
    required String themeSlug,
  }) async {
    final captured = captureContext(), actor = _captureJournalActor();
    await _restoreRollback(storeId, themeSlug, captured, actor);
    _requireJournalBinding(captured, actor);
    final scope = (captured, storeId, themeSlug);
    final pending = _pendingRollbacks[scope];
    if (pending == null ||
        (_actorIdProvider != null && pending.journalActor != actor))
      throw StateError('No rollback request needs recovery for this account.');
    return _sendRollback(scope, pending);
  }

  Future<Map<String, dynamic>> rollbackRelease({
    required String storeId,
    required String themeSlug,
    required String releaseId,
    required String expectedCurrentReleaseId,
    Object? expectedContext,
    String? rollbackMessage,
    bool makeStoreLive = true,
  }) async {
    final captured = expectedContext ?? captureContext(),
        actor = _captureJournalActor();
    _requireJournalBinding(captured, actor);
    if (releaseId.isEmpty ||
        expectedCurrentReleaseId.isEmpty ||
        releaseId == expectedCurrentReleaseId) {
      throw ArgumentError(
        'Review a previous release and the current live release before restoring.',
      );
    }
    final scope = (captured, storeId, themeSlug);
    final semantic = {
      'store_id': storeId,
      'target_release_id': releaseId,
      'expected_current_release_id': expectedCurrentReleaseId,
      'make_store_live': makeStoreLive,
      if (rollbackMessage != null) 'rollback_message': rollbackMessage,
    };
    final signature = _signature(semantic);
    await _restoreRollback(storeId, themeSlug, captured, actor);
    _requireJournalBinding(captured, actor);
    var pending = _pendingRollbacks[scope];
    if (pending != null &&
        _actorIdProvider != null &&
        pending.journalActor != actor) {
      _pendingRollbacks.remove(scope);
      pending = null;
    }
    if (pending != null && pending.signature != signature) {
      throw StateError(
        'Recover the previous rollback before restoring another release.',
      );
    }
    pending ??= _PendingThemeRollback(
      captured,
      const Uuid().v4(),
      releaseId,
      signature,
      Map.unmodifiable(
        {...semantic, 'theme_slug': themeSlug}..remove('target_release_id'),
      ),
      journalActor: actor,
    );
    _pendingRollbacks[scope] = pending;
    return _sendRollback(scope, pending);
  }

  Future<Map<String, dynamic>> _sendRollback(
    Object scope,
    _PendingThemeRollback pending,
  ) async {
    _requireJournalBinding(pending.context, pending.journalActor);
    if (pending.inFlight != null) return pending.inFlight!;
    final task = () async {
      try {
        await _persistRollback(
          pending.body['store_id'] as String,
          pending.body['theme_slug'] as String,
          pending,
        );
        _requireJournalBinding(pending.context, pending.journalActor);
        final result = await _api.themes.rollbackRelease(
          pending.body['theme_slug'] as String,
          pending.releaseId,
          {
            ...(Map<String, dynamic>.from(pending.body)..remove('theme_slug')),
            'idempotency_key': pending.key,
          },
          options: ApiRequestOptions(
            expectedContextVersion: pending.context,
            idempotencyKey: pending.key,
          ),
        );
        _requireJournalBinding(pending.context, pending.journalActor);
        final release = result['rollback'], target = result['restored_release'];
        if (result['replayed'] is! bool ||
            result['current_release_id'] is! String ||
            (result['current_release_id'] as String).isEmpty ||
            result['current_release_version'] is! int ||
            (result['current_release_version'] as int) < 1 ||
            release is! Map ||
            release['release_id'] is! String ||
            (release['release_id'] as String).isEmpty ||
            release['release_version'] is! int ||
            (release['release_version'] as int) < 1 ||
            target is! Map ||
            target['id'] != pending.releaseId) {
          throw const FormatException(
            'No confirmed rollback receipt was returned. Recover the same request.',
          );
        }
        final retired = await _retireJournal(
          'rollback',
          pending.body['store_id'] as String,
          pending.body['theme_slug'] as String,
          pending.context,
          pending.journalActor,
          pending.key,
        );
        if (retired && identical(_pendingRollbacks[scope], pending))
          _pendingRollbacks.remove(scope);
        try {
          await fetchThemes(pending.body['store_id'] as String);
        } catch (_) {}
        _requireJournalBinding(pending.context, pending.journalActor);
        return result;
      } on ApiException catch (error) {
        _requireJournalBinding(pending.context, pending.journalActor);
        if (error.statusCode == 400 || _isThemeConflict(error)) {
          final retired = await _retireJournal(
            'rollback',
            pending.body['store_id'] as String,
            pending.body['theme_slug'] as String,
            pending.context,
            pending.journalActor,
            pending.key,
          );
          if (retired && identical(_pendingRollbacks[scope], pending))
            _pendingRollbacks.remove(scope);
        }
        rethrow;
      }
    }();
    pending.inFlight = task;
    try {
      return await task;
    } finally {
      pending.inFlight = null;
    }
  }

  bool hasPendingPublication(String storeId, String themeSlug) {
    final pending = _pendingPublishes[_scope(storeId, themeSlug)];
    return pending != null &&
        pending.context == captureContext() &&
        (_actorIdProvider == null ||
            pending.journalActor == _actorIdProvider?.call()?.trim());
  }

  Future<Map<String, dynamic>> recoverPublication({
    required String storeId,
    required String themeSlug,
  }) async {
    final captured = captureContext(), actor = _captureJournalActor();
    await _restorePublication(storeId, themeSlug, captured, actor);
    _requireJournalBinding(captured, actor);
    final pending = _pendingPublishes[_scope(storeId, themeSlug)];
    if (pending == null ||
        (_actorIdProvider != null && pending.journalActor != actor))
      throw StateError(
        'No publication request needs recovery for this account.',
      );
    _requireContext(pending.context);
    return publish(
      storeId: storeId,
      themeSlug: themeSlug,
      templateConfig: pending.config,
      baseVersion: pending.initialVersion,
      makeStoreLive: pending.makeStoreLive,
    );
  }

  Future<Map<String, dynamic>> publish({
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
    final context = captureContext(),
        scope = _scope(storeId, themeSlug),
        actor = _captureJournalActor();
    final config = templateConfig == null
        ? null
        : Map<String, dynamic>.from(
            jsonDecode(
                  jsonEncode(<String, dynamic>{
                    ...templateConfig,
                    if (liquidBundle != null) 'liquidBundle': liquidBundle,
                    if (liquidRenderingCanary != null)
                      'liquidRenderingCanary': liquidRenderingCanary,
                  }),
                )
                as Map,
          );
    final signature = jsonEncode({
      'version': baseVersion,
      'config': config,
      'make_store_live': makeStoreLive,
    });
    await _restorePublication(storeId, themeSlug, context, actor);
    _requireJournalBinding(context, actor);
    var pending = _pendingPublishes[scope];
    if (pending != null &&
        (pending.context != context ||
            (_actorIdProvider != null && pending.journalActor != actor))) {
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
      journalActor: actor,
    );
    _pendingPublishes[scope] = pending;
    if (pending.inFlight != null) return pending.inFlight!;
    final _PendingThemePublish intent = pending;
    final task = () async {
      final pending = intent;
      late final Map<String, dynamic> confirmation;
      try {
        pending.savedVersion ??= config == null
            ? baseVersion
            : (await saveDraft(
                storeId: storeId,
                themeSlug: themeSlug,
                templateConfig: pending.config!,
                baseVersion: pending.initialVersion,
              )).version;
        _requireJournalBinding(context, actor);
        await _persistPublication(storeId, themeSlug, pending);
        _requireJournalBinding(context, actor);
        final published = await _api.themes.publish(
          themeSlug,
          {
            'store_id': storeId,
            'template_key': 'index',
            'base_version': pending.savedVersion,
            'idempotency_key': pending.key,
            'make_store_live': pending.makeStoreLive,
          },
          options: ApiRequestOptions(
            expectedContextVersion: context,
            idempotencyKey: pending.key,
          ),
        );
        _requireJournalBinding(context, actor);
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
        if ((published['current_version'] as int) <
                (published['version'] as int) ||
            (published['current_version'] != published['version'] &&
                published['replayed'] != true)) {
          throw const FormatException(
            'No confirmed publication receipt was returned. Retry the same request.',
          );
        }
        // A replay confirms this historical publication; it cannot consume or
        // replace a newer editor payload that is already loaded in this service.
        confirmation = Map<String, dynamic>.unmodifiable(published);
        final retired = await _retireJournal(
          'publish',
          storeId,
          themeSlug,
          context,
          actor,
          pending.key,
        );
        if (retired && identical(_pendingPublishes[scope], pending))
          _pendingPublishes.remove(scope);
      } on ApiException catch (error) {
        _requireJournalBinding(context, actor);
        if (error.statusCode == 400 || _isThemeConflict(error)) {
          final retired = await _retireJournal(
            'publish',
            storeId,
            themeSlug,
            context,
            actor,
            pending.key,
          );
          if (retired && identical(_pendingPublishes[scope], pending))
            _pendingPublishes.remove(scope);
        }
        if (_isThemeConflict(error)) throw const ThemeDraftConflictException();
        rethrow;
      }
      // Confirmed publication must not become a false failed mutation because a
      // subsequent catalog refresh is unavailable; the normal catalog can retry.
      try {
        await fetchThemes(storeId);
      } catch (_) {}
      _requireJournalBinding(context, actor);
      return confirmation;
    }();
    pending.inFlight = task;
    try {
      return await task;
    } finally {
      pending.inFlight = null;
    }
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
