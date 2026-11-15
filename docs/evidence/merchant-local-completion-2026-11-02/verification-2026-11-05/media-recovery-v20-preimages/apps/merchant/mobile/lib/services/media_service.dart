import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart' hide JsonMap;

typedef _MediaContext = ({String store, Object? version});

class MediaService extends ChangeNotifier {
  MediaService({required ApiClient api, String? Function()? storeIdProvider})
    : _api = api,
      _storeIdProvider = storeIdProvider;
  final ApiClient _api;
  final String? Function()? _storeIdProvider;
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
    return (store: store, version: captureRequestContext());
  }

  void _check(_MediaContext c) {
    if (_disposed ||
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
  }) async {
    final c = _capture(storeId);
    final raw = await _api.upload.file(
      file,
      folder: folder,
      storeId: c.store,
      options: _options(c),
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
  }) async {
    final c = _capture(storeId);
    final upload = await uploadFile(file, folder: folder, storeId: storeId);
    _check(c);
    return _createMedia(
      MediaCreateInput(
        storeId: storeId,
        filename: _fileName(file),
        originalName: _fileName(file),
        url: upload.url,
        mimeType: upload.contentType ?? _mimeTypeFor(_fileName(file)),
        sizeBytes: upload.size,
        folder: folder,
        altText: altText,
        caption: caption,
        tags: tags,
        storageKey: upload.key,
      ),
      c,
    );
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
    final updated = _asset(
      await _api.media.update(id, input.toJson(), options: _options(c)),
      c,
    );
    if (updated.id != id) throw _changed();
    ++_readVersion;
    _accept(c, _assets.map((a) => a.id == id ? updated : a).toList());
    return updated;
  }

  Future<void> deleteMedia(
    MediaAssetContract asset, {
    bool deleteObject = false,
  }) async {
    final c = _capture(asset.storeId);
    if (deleteObject) {
      final key = asset.storageKey;
      if (key == null)
        throw StateError('The original upload could not be identified.');
      try {
        await _api.upload.remove(key, storeId: c.store, options: _options(c));
      } on ApiException catch (e) {
        if (e.statusCode != 404) rethrow;
      }
      _check(c);
    }
    final result = await _api.media.remove(asset.id, options: _options(c));
    _check(c);
    if (result['deleted'] != true)
      throw const ApiException(
        message: 'Media removal was not confirmed. Refresh media.',
        statusCode: 503,
        code: 'MEDIA_DELETE_UNCONFIRMED',
      );
    ++_readVersion;
    _accept(c, _assets.where((a) => a.id != asset.id).toList());
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

  static String _mimeTypeFor(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.m4v')) return 'video/x-m4v';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.glb')) return 'model/gltf-binary';
    if (lower.endsWith('.gltf')) return 'model/gltf+json';
    if (lower.endsWith('.usdz')) return 'model/vnd.usdz+zip';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.txt')) return 'text/plain';
    return 'application/octet-stream';
  }
}

class MediaAssetContract extends SharedTypeContract {
  MediaAssetContract(super.json);

  factory MediaAssetContract.fromJson(JsonMap json) => MediaAssetContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get filename => _string('filename');
  String get originalName => _string('original_name', fallback: filename);
  String get displayName => originalName.isEmpty ? filename : originalName;
  String get url => _string('url');
  String? get thumbnailUrl => _optionalString('thumbnail_url');
  String get mimeType => _string('mime_type', fallback: 'application/octet');
  int get sizeBytes => _int('size_bytes');
  int? get width => _optionalInt('width');
  int? get height => _optionalInt('height');
  String? get altText => _optionalString('alt_text');
  String? get caption => _optionalString('caption');
  String get folder => _string('folder', fallback: '/');
  String get mediaType => _string('media_type', fallback: 'other');
  int get usageCount => _int('usage_count');
  String? get storageKey =>
      _optionalString('storage_key') ?? _optionalString('key');
  String? get createdAt => _optionalString('created_at');
  String? get updatedAt => _optionalString('updated_at');
  bool get isImage => mediaType == 'image' || mimeType.startsWith('image/');
  bool get isVideo => mediaType == 'video' || mimeType.startsWith('video/');
  bool get isThreeDModel {
    final lowerName = filename.toLowerCase();
    final lowerUrl = url.toLowerCase();
    return mimeType.startsWith('model/') ||
        lowerName.endsWith('.glb') ||
        lowerName.endsWith('.gltf') ||
        lowerName.endsWith('.usdz') ||
        lowerUrl.endsWith('.glb') ||
        lowerUrl.endsWith('.gltf') ||
        lowerUrl.endsWith('.usdz');
  }

  List<String> get tags {
    final value = toJson()['tags'];
    if (value is List) {
      return value.map((item) => '$item').toList(growable: false);
    }
    return const [];
  }

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }

  String? _optionalString(String key) {
    final value = toJson()[key]?.toString();
    return value == null || value.isEmpty ? null : value;
  }

  int _int(String key) {
    final value = toJson()[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  int? _optionalInt(String key) {
    final value = toJson()[key];
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }
}

class FileUploadResultContract extends SharedTypeContract {
  FileUploadResultContract(super.json);

  factory FileUploadResultContract.fromJson(JsonMap json) =>
      FileUploadResultContract(json);

  String get url => _string('url');
  String get key => _string('key');
  int get size => _int('size');
  String? get contentType => _optionalString('content_type');
  String? get mediaType => _optionalString('media_type');
  String? get storage => _optionalString('storage');

  String _string(String key, {String fallback = ''}) {
    return toJson()[key]?.toString() ?? fallback;
  }

  String? _optionalString(String key) {
    final value = toJson()[key]?.toString();
    return value == null || value.isEmpty ? null : value;
  }

  int _int(String key) {
    final value = toJson()[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class MediaCreateInput {
  const MediaCreateInput({
    required this.storeId,
    required this.filename,
    required this.url,
    required this.mimeType,
    this.originalName,
    this.thumbnailUrl,
    this.sizeBytes = 0,
    this.width,
    this.height,
    this.altText,
    this.caption,
    this.folder = '/',
    this.tags = const [],
    this.storageKey,
  });

  final String storeId;
  final String filename;
  final String? originalName;
  final String url;
  final String? thumbnailUrl;
  final String mimeType;
  final int sizeBytes;
  final int? width;
  final int? height;
  final String? altText;
  final String? caption;
  final String folder;
  final List<String> tags;
  final String? storageKey;

  Map<String, dynamic> toJson() {
    return {
      'store_id': storeId,
      'filename': filename.trim(),
      'original_name': _nullableTrim(originalName) ?? filename.trim(),
      'url': url.trim(),
      if (thumbnailUrl != null && thumbnailUrl!.trim().isNotEmpty)
        'thumbnail_url': thumbnailUrl!.trim(),
      'mime_type': mimeType.trim(),
      'size_bytes': sizeBytes,
      if (width != null) 'width': width,
      if (height != null) 'height': height,
      'alt_text': _nullableTrim(altText),
      'caption': _nullableTrim(caption),
      'folder': folder.trim().isEmpty ? '/' : folder.trim(),
      'tags': tags
          .map((tag) => tag.trim())
          .where((tag) => tag.isNotEmpty)
          .toList(growable: false),
      if (storageKey != null && storageKey!.trim().isNotEmpty)
        'storage_key': storageKey!.trim(),
    };
  }
}

class MediaUpdateInput {
  const MediaUpdateInput({
    this.filename,
    this.altText,
    this.caption,
    this.folder,
    this.tags,
  });

  final String? filename;
  final String? altText;
  final String? caption;
  final String? folder;
  final List<String>? tags;

  Map<String, dynamic> toJson() {
    return {
      if (filename != null) 'filename': filename!.trim(),
      'alt_text': _nullableTrim(altText),
      'caption': _nullableTrim(caption),
      if (folder != null)
        'folder': folder!.trim().isEmpty ? '/' : folder!.trim(),
      if (tags != null)
        'tags': tags!
            .map((tag) => tag.trim())
            .where((tag) => tag.isNotEmpty)
            .toList(growable: false),
    };
  }
}

String? _nullableTrim(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}
