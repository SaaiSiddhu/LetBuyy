import 'dart:io';
import 'package:crypto/crypto.dart';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

export 'package:letbuyy_models/letbuyy_models.dart'
    show
        MediaAssetContract,
        FileUploadResultContract,
        PublicMediaUpload,
        MediaCreateInput,
        MediaUpdateInput;

import 'api_client.dart' hide JsonMap;
import 'security_command_store.dart';

typedef _MediaContext = ({String store, String? actor, Object? version});

class MediaService extends ChangeNotifier {
  MediaService({
    required ApiClient api,
    String? Function()? storeIdProvider,
    String? Function()? actorIdProvider,
    SecurityCommandStore? commands,
  }) : _api = api,
       _storeIdProvider = storeIdProvider,
       _actorIdProvider = actorIdProvider,
       _commands = commands ?? SecurityCommandStore();
  final ApiClient _api;
  final String? Function()? _storeIdProvider, _actorIdProvider;
  final SecurityCommandStore _commands;
  PendingSecurityCommand? _pendingUpload;
  PendingSecurityCommand? _pendingChange;
  static const _uploadCommand = 'media-upload';
  static const _changeCommand = 'media-change';
  bool get hasPendingChange {
    final pending = _pendingChange;
    if (_disposed ||
        pending != null &&
            (pending.actor != _actorIdProvider?.call() ||
                (_storeIdProvider != null &&
                    pending.store != _storeIdProvider()))) {
      _pendingChange = null;
    }
    return _pendingChange != null;
  }

  String? get changeRecoveryMessage {
    if (!hasPendingChange) return null;
    return _pendingChange!.intent['operation'] == 'delete'
        ? 'The original removal may already be complete. Confirm its saved request before making another media change.'
        : 'The original metadata change may already be saved. Confirm its saved request before making another media change.';
  }

  bool get hasPendingUpload {
    final pending = _pendingUpload;
    if (pending != null &&
        (pending.actor != _actorIdProvider?.call() ||
            (_storeIdProvider != null && pending.store != _storeIdProvider())))
      _pendingUpload = null;
    return _pendingUpload != null;
  }

  bool get canResumeUpload => hasPendingUpload;
  String? get pendingUploadKey => hasPendingUpload ? _pendingUpload?.key : null;
  Map<String, dynamic> get _savedUploadInput {
    final input = _pendingUpload?.intent['input'];
    return input is Map ? asJsonMap(input) : const {};
  }

  bool get canReselectOriginal {
    if (!hasPendingUpload ||
        _pendingUpload!.intent['stage'] != 'upload_pending')
      return false;
    final input = _savedUploadInput, type = _savedUploadInput['content_type'];
    return type is String &&
        PublicMediaUpload.limitForMime(type) != null &&
        input['filename'] is String &&
        input['sha256'] is String &&
        input['size_bytes'] is int;
  }

  bool get pendingUploadIsVideo {
    if (!hasPendingUpload) return false;
    final type = _savedUploadInput['content_type'];
    return type is String && type.startsWith('video/');
  }

  bool get pendingUploadIsModel {
    if (!hasPendingUpload) return false;
    final type = _savedUploadInput['content_type'];
    return type is String && type.startsWith('model/');
  }

  bool get isUploadStored =>
      hasPendingUpload && _pendingUpload!.intent['stage'] == 'create';
  String? get uploadRecoveryMessage {
    if (!hasPendingUpload) return null;
    return isUploadStored
        ? 'Your file reached storage. Confirm its library entry without uploading it again.'
        : 'Storage may have received your file, but its acknowledgement was interrupted. Check its saved receipt before sending another file. The original request is retained.';
  }

  MerchantSecurityContext _commandContext(_MediaContext c) {
    _check(c);
    if (c.actor == null || c.actor!.trim().isEmpty) throw _changed();
    return (actorId: c.actor!, storeId: c.store, version: c.version);
  }

  static ApiException _heldUpload() => const ApiException(
    message: 'This upload needs review before another file can be sent.',
    statusCode: 409,
    code: 'MEDIA_UPLOAD_NEEDS_REVIEW',
  );
  Future<void> _loadPending(_MediaContext c) async {
    if (_actorIdProvider == null) return;
    final owner = _commandContext(c);
    final saved = await _commands.serialized(() async {
      final upload = await _commands.read(
        owner,
        _uploadCommand,
        check: () => _check(c),
      );
      final change = await _commands.read(
        owner,
        _changeCommand,
        check: () => _check(c),
      );
      if (change != null) _validateChange(change);
      return (upload, change);
    });
    _check(c);
    _pendingUpload = saved.$1;
    _pendingChange = saved.$2;
  }

  List<MediaAssetContract> _assets = [];
  Object? _assetsContext;
  String? _assetsStore;
  bool _isLoading = false, _disposed = false, _hasMore = false;
  int _readVersion = 0;
  Object? captureRequestContext() => _api.captureRequestContext();
  void _sync() {
    if (_assetsContext != captureRequestContext() ||
        (_storeIdProvider != null && _assetsStore != _storeIdProvider())) {
      _assets = [];
      _hasMore = false;
    }
  }

  List<MediaAssetContract> get assets {
    _sync();
    return List.unmodifiable(_assets);
  }

  bool get hasMore {
    _sync();
    return _hasMore;
  }

  bool get isLoading => _isLoading;
  static ApiException _changed() => const ApiException(
    message: 'Store access changed. Reload media.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );
  _MediaContext _capture(String? store) {
    if (store == null ||
        store.isEmpty ||
        _disposed ||
        (_storeIdProvider != null && store != _storeIdProvider()))
      throw _changed();
    if (_assetsStore != store) {
      _assets = [];
      _hasMore = false;
    }
    return (
      store: store,
      actor: _actorIdProvider?.call(),
      version: captureRequestContext(),
    );
  }

  void _check(_MediaContext c) {
    if (_disposed ||
        c.actor != _actorIdProvider?.call() ||
        c.version != captureRequestContext() ||
        (_storeIdProvider != null && c.store != _storeIdProvider()))
      throw _changed();
  }

  ApiRequestOptions _options(_MediaContext c) =>
      ApiRequestOptions(storeId: c.store, expectedContextVersion: c.version);
  MediaAssetContract _asset(Map<String, dynamic> raw, _MediaContext c) {
    _check(c);
    if (raw['store_id'] != c.store ||
        raw['id'] is! String ||
        (raw['id'] as String).isEmpty) {
      throw const ApiException(
        message: 'Media details could not be confirmed. Reload media.',
        statusCode: 503,
        code: 'MEDIA_SCOPE_MISMATCH',
      );
    }
    return MediaAssetContract.fromJson(raw);
  }

  void _accept(_MediaContext c, List<MediaAssetContract> values) {
    _check(c);
    _assetsContext = c.version;
    _assetsStore = c.store;
    _assets = values;
    notifyListeners();
  }

  Future<List<MediaAssetContract>> fetchMedia(
    String storeId, {
    String type = 'all',
    String? folder,
    String? search,
    int page = 1,
    int limit = 60,
  }) async {
    final c = _capture(storeId), read = ++_readVersion;
    _sync();
    _isLoading = true;
    notifyListeners();
    try {
      await _loadPending(c);
      final result = await _api.media.list(
        query: {
          'store_id': storeId,
          'type': type,
          'page': page,
          'limit': limit,
          if (folder != null && folder.trim().isNotEmpty)
            'folder': folder.trim(),
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
        },
        options: _options(c),
      );
      _check(c);
      if (read != _readVersion) throw _changed();
      final values = result.data
          .map((r) => _asset(r, c))
          .toList(growable: false);
      final ids = values.map((r) => r.id).toSet();
      if (ids.length != values.length)
        throw const ApiException(
          message: 'Media list could not be confirmed. Reload media.',
          statusCode: 503,
          code: 'MEDIA_LIST_INVALID',
        );
      _hasMore = result.hasMore;
      _accept(c, values);
      return List.unmodifiable(values);
    } finally {
      if (!_disposed && read == _readVersion) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  Future<FileUploadResultContract> uploadFile(
    File file, {
    String folder = 'media',
    String? storeId,
    String? idempotencyKey,
    String? sha256Hex,
    String? filename,
  }) async {
    final c = _capture(storeId);
    final raw = await _api.upload.file(
      file,
      folder: folder,
      storeId: c.store,
      sha256Hex: sha256Hex,
      filename: filename,
      options: _options(
        c,
      ).copyWith(idempotencyKey: idempotencyKey, maxRetries: 0),
    );
    _check(c);
    return FileUploadResultContract.fromJson(raw);
  }

  Future<MediaAssetContract> uploadAndCreate({
    required String storeId,
    required File file,
    String folder = 'media',
    String? altText,
    String? caption,
    List<String> tags = const [],
    String? selectionKey,
  }) async {
    final c = _capture(storeId), owner = _commandContext(_capture(storeId));
    // Capture caller-owned lists before yielding to hashing or encrypted storage.
    final capturedTags = List<String>.unmodifiable(tags);
    return _commands.serialized(() async {
      void check() => _check(c);
      check();
      var pending = await _commands.read(owner, _uploadCommand, check: check);
      if (pending != null) {
        _pendingUpload = pending;
        // Only a known storage acknowledgement can resume library creation.
        // Unknown storage acceptance never becomes a second upload/new key.
        throw _heldUpload();
      }
      final size = await file.length();
      final contentType = PublicMediaUpload.mimeForFilename(_fileName(file));
      final limit = contentType == null
          ? null
          : PublicMediaUpload.limitForMime(contentType);
      if (limit == null || size <= 0 || size > limit) {
        check();
        throw ApiException(
          message: limit == null
              ? 'Choose JPEG, PNG, WebP, GIF, MP4, MOV, WebM, GLB, or GLTF. This file type is not supported for public media.'
              : size <= 0
              ? 'Choose a file with content before uploading.'
              : 'This file is too large. Use a file of at most ${limit ~/ (1024 * 1024)} MB.',
          statusCode: 400,
          code: 'MEDIA_UPLOAD_INPUT_INVALID',
        );
      }
      final digest = await sha256.bind(file.openRead()).first;
      check();
      final input = <String, dynamic>{
        'store_id': storeId,
        'filename': _fileName(file),
        'folder': folder,
        'alt_text': altText,
        'caption': caption,
        'tags': capturedTags,
        'size_bytes': size,
        'sha256': digest.toString(),
        'content_type': contentType,
      };
      pending = await _commands.prepare(
        owner,
        _uploadCommand,
        {'input': input, 'stage': 'upload_pending'},
        check: check,
        proposedKey: selectionKey,
      );
      _pendingUpload = pending;
      notifyListeners();
      final upload = await uploadFile(
        file,
        folder: folder,
        storeId: storeId,
        idempotencyKey: 'media-upload-${pending.key}',
        sha256Hex: digest.toString(),
      );
      check();
      pending = await _recordUpload(c, owner, pending, upload);
      return _resumeCreate(c, owner, pending);
    });
  }

  Future<MediaAssetContract> resumeUpload(String storeId) {
    final c = _capture(storeId), owner = _commandContext(_capture(storeId));
    return _commands.serialized(() async {
      var pending = await _commands.read(
        owner,
        _uploadCommand,
        check: () => _check(c),
      );
      if (pending == null) throw _heldUpload();
      _pendingUpload = pending;
      if (pending.intent['stage'] == 'upload_pending') {
        final input = asJsonMap(pending.intent['input']);
        final raw = await _api.upload.recover({
          'store_id': c.store,
          'idempotency_key': 'media-upload-${pending.key}',
          'filename': input['filename'],
          'folder': input['folder'],
          'content_type': input['content_type'],
          'byte_size': input['size_bytes'],
          'sha256_hex': input['sha256'],
        }, options: _options(c).copyWith(maxRetries: 0));
        _check(c);
        pending = await _recordUpload(
          c,
          owner,
          pending,
          FileUploadResultContract.fromJson(raw),
        );
      }
      if (pending.intent['stage'] != 'create') throw _heldUpload();
      return _resumeCreate(c, owner, pending);
    });
  }

  /// Explicit original-input retry. No new key, new metadata or new intent is
  /// allocated. The Gateway's persisted allocation and conditional write fence
  /// an earlier in-flight upload under this same key.
  Future<MediaAssetContract> retryUploadWithOriginal(
    String storeId,
    File file,
  ) {
    final c = _capture(storeId), owner = _commandContext(_capture(storeId));
    return _commands.serialized(() async {
      void check() => _check(c);
      final pending = await _commands.read(owner, _uploadCommand, check: check);
      if (pending == null || pending.intent['stage'] != 'upload_pending')
        throw _heldUpload();
      _pendingUpload = pending;
      final input = asJsonMap(pending.intent['input']);
      final filename = input['filename'],
          expected = input['sha256'],
          size = input['size_bytes'];
      if (filename is! String || expected is! String || size is! int)
        throw _heldUpload();
      final actualSize = await file.length();
      check();
      if (actualSize != size) throw _inputChanged();
      final digest = await sha256.bind(file.openRead()).first;
      check();
      if (digest.toString() != expected) throw _inputChanged();
      final upload = await uploadFile(
        file,
        storeId: c.store,
        folder: input['folder'] as String,
        idempotencyKey: 'media-upload-${pending.key}',
        sha256Hex: expected,
        filename: filename,
      );
      check();
      final recorded = await _recordUpload(c, owner, pending, upload);
      return _resumeCreate(c, owner, recorded);
    });
  }

  static ApiException _inputChanged() => const ApiException(
    message:
        'Choose the original file for this saved upload. Its contents must match.',
    statusCode: 409,
    code: 'MEDIA_UPLOAD_INPUT_CHANGED',
  );

  Future<PendingSecurityCommand> _recordUpload(
    _MediaContext c,
    MerchantSecurityContext owner,
    PendingSecurityCommand pending,
    FileUploadResultContract upload,
  ) async {
    _check(c);
    final input = asJsonMap(pending.intent['input']), receipt = upload.toJson();
    final publicUrl = Uri.tryParse(upload.url);
    if (publicUrl == null ||
        !['http', 'https'].contains(publicUrl.scheme) ||
        publicUrl.host.isEmpty ||
        publicUrl.userInfo.isNotEmpty ||
        publicUrl.hasQuery ||
        publicUrl.hasFragment)
      throw _heldUpload();
    if (receipt['store_id'] != c.store ||
        upload.url.isEmpty ||
        upload.key.isEmpty ||
        receipt['size'] is! int ||
        upload.size != input['size_bytes'] ||
        receipt['content_type'] is! String ||
        upload.contentType != input['content_type'])
      throw _heldUpload();
    final create = MediaCreateInput(
      storeId: c.store,
      filename: input['filename'] as String,
      originalName: input['filename'] as String,
      url: upload.url,
      mimeType: upload.contentType!,
      sizeBytes: upload.size,
      folder: input['folder'] as String,
      altText: input['alt_text'] as String?,
      caption: input['caption'] as String?,
      tags: (input['tags'] as List).cast<String>(),
      storageKey: upload.key,
    ).toJson();
    final updated = await _commands.replaceIntent(owner, pending, {
      ...pending.intent,
      'stage': 'create',
      'create': create,
    }, check: () => _check(c));
    _pendingUpload = updated;
    return updated;
  }

  Future<MediaAssetContract> _resumeCreate(
    _MediaContext c,
    MerchantSecurityContext owner,
    PendingSecurityCommand pending,
  ) async {
    _check(c);
    final payload = SecurityCommandStore.captureIntent(
      asJsonMap(pending.intent['create']),
    );
    if (payload['store_id'] != c.store) throw _heldUpload();
    final created = _asset(
      await _api.media.create(
        payload,
        options: _options(c).copyWith(
          idempotencyKey: 'media-create-${pending.key}',
          maxRetries: 0,
        ),
      ),
      c,
    );
    await _commands.complete(owner, pending, check: () => _check(c));
    _check(c);
    _pendingUpload = null;
    ++_readVersion;
    _sync();
    _accept(c, [created, ..._assets.where((a) => a.id != created.id)]);
    return created;
  }

  Future<MediaAssetContract> createMedia(MediaCreateInput input) =>
      _createMedia(input, _capture(input.storeId));
  Future<MediaAssetContract> _createMedia(
    MediaCreateInput input,
    _MediaContext c,
  ) async {
    _check(c);
    final created = _asset(
      await _api.media.create(input.toJson(), options: _options(c)),
      c,
    );
    ++_readVersion;
    _sync();
    _accept(c, [created, ..._assets.where((a) => a.id != created.id)]);
    return created;
  }

  Future<MediaAssetContract> updateMedia(
    String id,
    MediaUpdateInput input,
  ) async {
    final current = assets.where((a) => a.id == id).firstOrNull;
    final c = _capture(current?.storeId);
    final owner = _commandContext(c);
    final captured = SecurityCommandStore.captureIntent({
      'version': 1,
      'operation': 'update',
      'media_id': id,
      'input': input.toJson(),
    });
    MediaUpdateInput.validateJson(asJsonMap(captured['input']));
    final result = await _commands.serialized(() async {
      final pending = await _prepareChange(c, owner, captured);
      return _sendChange(c, owner, pending);
    });
    if (result == null) throw _heldChange();
    return result;
  }

  Future<void> deleteMedia(
    MediaAssetContract asset, {
    bool deleteObject = false,
  }) async {
    final c = _capture(asset.storeId);
    final owner = _commandContext(c);
    if (deleteObject && asset.storageKey == null) {
      throw StateError('The original upload could not be identified.');
    }
    final captured = SecurityCommandStore.captureIntent({
      'version': 1,
      'operation': 'delete',
      'media_id': asset.id,
      'delete_object': deleteObject,
      'storage_key': deleteObject ? asset.storageKey : null,
    });
    await _commands.serialized(() async {
      final pending = await _prepareChange(c, owner, captured);
      await _sendChange(c, owner, pending);
    });
  }

  static ApiException _heldChange() => const ApiException(
    message:
        'Confirm the original saved media change before making another change.',
    statusCode: 409,
    code: 'MEDIA_CHANGE_NEEDS_REVIEW',
  );

  void _validateChange(PendingSecurityCommand pending) {
    final intent = pending.intent, id = pending.intent['media_id'];
    if (intent['version'] != 1 ||
        id is! String ||
        id.trim().isEmpty ||
        id.length > 200) {
      throw _heldChange();
    }
    final operation = intent['operation'];
    if (operation == 'update') {
      if (intent.keys.toSet().difference({
            'version',
            'operation',
            'media_id',
            'input',
          }).isNotEmpty ||
          intent.length != 4 ||
          intent['input'] is! Map)
        throw _heldChange();
      MediaUpdateInput.validateJson(asJsonMap(intent['input']));
    } else if (operation == 'delete') {
      if (intent.keys.toSet().difference({
            'version',
            'operation',
            'media_id',
            'delete_object',
            'storage_key',
          }).isNotEmpty ||
          intent.length != 5 ||
          intent['delete_object'] is! bool)
        throw _heldChange();
      final key = intent['storage_key'];
      if (intent['delete_object'] == true
          ? key is! String || key.isEmpty || key.length > 1000
          : key != null)
        throw _heldChange();
    } else {
      throw _heldChange();
    }
  }

  Future<PendingSecurityCommand> _prepareChange(
    _MediaContext c,
    MerchantSecurityContext owner,
    JsonMap captured,
  ) async {
    _check(c);
    _pendingChange = await _commands.read(
      owner,
      _changeCommand,
      check: () => _check(c),
    );
    if (_pendingChange != null) _validateChange(_pendingChange!);
    final pending = await _commands.prepare(
      owner,
      _changeCommand,
      captured,
      check: () => _check(c),
    );
    _validateChange(pending);
    _check(c);
    _pendingChange = pending;
    notifyListeners();
    return pending;
  }

  Future<void> resumeChange(String storeId) async {
    final c = _capture(storeId), owner = _commandContext(_capture(storeId));
    await _commands.serialized(() async {
      final pending = await _commands.read(
        owner,
        _changeCommand,
        check: () => _check(c),
      );
      if (pending == null) throw _heldChange();
      _validateChange(pending);
      _pendingChange = pending;
      await _sendChange(c, owner, pending);
    });
  }

  Future<MediaAssetContract?> _sendChange(
    _MediaContext c,
    MerchantSecurityContext owner,
    PendingSecurityCommand pending,
  ) async {
    _check(c);
    _validateChange(pending);
    final id = pending.intent['media_id'] as String;
    final options = _options(
      c,
    ).copyWith(idempotencyKey: 'media-change-${pending.key}', maxRetries: 0);
    MediaAssetContract? updated;
    if (pending.intent['operation'] == 'update') {
      updated = _asset(
        await _api.media.update(
          id,
          asJsonMap(pending.intent['input']),
          options: options,
        ),
        c,
      );
      if (updated.id != id) throw _changed();
      final confirmed = updated.toJson();
      for (final entry in asJsonMap(pending.intent['input']).entries) {
        final value = confirmed[entry.key];
        if (entry.value is List
            ? value is! List || !listEquals(value, entry.value as List)
            : value != entry.value) {
          throw _heldChange();
        }
      }
    } else {
      if (pending.intent['delete_object'] == true) {
        try {
          await _api.upload.remove(
            pending.intent['storage_key'] as String,
            storeId: c.store,
            options: options.copyWith(
              idempotencyKey: 'media-object-${pending.key}',
            ),
          );
        } on ApiException catch (e) {
          if (e.statusCode != 404) rethrow;
        }
        _check(c);
      }
      final result = await _api.media.remove(id, options: options);
      _check(c);
      if (result['deleted'] != true)
        throw const ApiException(
          message: 'Media removal was not confirmed. Keep its saved request.',
          statusCode: 503,
          code: 'MEDIA_DELETE_UNCONFIRMED',
        );
    }
    _check(c);
    await _commands.complete(owner, pending, check: () => _check(c));
    if (await _commands.read(owner, _changeCommand, check: () => _check(c)) !=
        null)
      throw _heldChange();
    _check(c);
    _pendingChange = null;
    ++_readVersion;
    _sync();
    _accept(
      c,
      updated != null
          ? _assets.map((a) => a.id == id ? updated! : a).toList()
          : _assets.where((a) => a.id != id).toList(),
    );
    return updated;
  }

  Future<void> deleteUpload(String key, {String? storeId}) async {
    if (key.trim().isEmpty) return;
    final c = _capture(storeId);
    await _api.upload.remove(
      key.trim(),
      storeId: c.store,
      options: _options(c),
    );
    _check(c);
  }

  @override
  void dispose() {
    _disposed = true;
    ++_readVersion;
    _assets = [];
    super.dispose();
  }

  static String _fileName(File file) {
    return file.path.split(Platform.pathSeparator).last;
  }
}
