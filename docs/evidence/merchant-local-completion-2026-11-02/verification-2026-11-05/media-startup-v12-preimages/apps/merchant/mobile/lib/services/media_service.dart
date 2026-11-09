import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart' hide JsonMap;

class MediaService extends ChangeNotifier {
  MediaService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  List<MediaAssetContract> _assets = [];
  List<MediaAssetContract> get assets => List.unmodifiable(_assets);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<MediaAssetContract>> fetchMedia(
    String storeId, {
    String type = 'all',
    String? folder,
    String? search,
    int page = 1,
    int limit = 60,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final pageResult = await _api.media.list(
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
      );
      _assets = pageResult.data
          .map(MediaAssetContract.fromJson)
          .toList(growable: false);
      return _assets;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<FileUploadResultContract> uploadFile(
    File file, {
    String folder = 'media',
    String? storeId,
  }) async {
    return FileUploadResultContract.fromJson(
      await _api.upload.file(file, folder: folder, storeId: storeId),
    );
  }

  Future<MediaAssetContract> uploadAndCreate({
    required String storeId,
    required File file,
    String folder = 'media',
    String? altText,
    String? caption,
    List<String> tags = const [],
  }) async {
    final upload = await uploadFile(file, folder: folder, storeId: storeId);
    return createMedia(
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
    );
  }

  Future<MediaAssetContract> createMedia(MediaCreateInput input) async {
    final created = MediaAssetContract.fromJson(
      await _api.media.create(input.toJson()),
    );
    _assets = [created, ..._assets];
    notifyListeners();
    return created;
  }

  Future<MediaAssetContract> updateMedia(
    String id,
    MediaUpdateInput input,
  ) async {
    final updated = MediaAssetContract.fromJson(
      await _api.media.update(id, input.toJson()),
    );
    final index = _assets.indexWhere((asset) => asset.id == id);
    if (index == -1) {
      _assets = [updated, ..._assets];
    } else {
      final next = List<MediaAssetContract>.from(_assets);
      next[index] = updated;
      _assets = next;
    }
    notifyListeners();
    return updated;
  }

  Future<void> deleteMedia(
    MediaAssetContract asset, {
    bool deleteObject = false,
  }) async {
    final key = asset.storageKey;
    if (deleteObject) {
      if (key == null) throw StateError('The original upload could not be identified.');
      try {
        await deleteUpload(key, storeId: asset.storeId);
      } on ApiException catch (error) {
        if (error.statusCode != 404) rethrow;
      }
    }
    await _api.media.remove(asset.id);
    _assets = _assets.where((item) => item.id != asset.id).toList();
    notifyListeners();
  }

  Future<void> deleteUpload(String key, {String? storeId}) async {
    if (key.trim().isEmpty) return;
    await _api.upload.remove(key.trim(), storeId: storeId);
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
