// Canonical Dart media contracts shared by Merchant consumers.
import 'shared_contracts.dart';

/// Client admission for the existing Gateway public-upload contract. Private
/// documents use their own workflow; retained legacy media remain readable.
class PublicMediaUpload {
  static const imageLimitBytes = 10 * 1024 * 1024;
  static const videoLimitBytes = 100 * 1024 * 1024;
  static const modelLimitBytes = 50 * 1024 * 1024;
  static const modelExtensions = ['glb', 'gltf'];
  static const _mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'glb': 'model/gltf-binary',
    'gltf': 'model/gltf+json',
  };

  static String? mimeForFilename(String filename) =>
      _mimeTypes[filename.split('.').last.toLowerCase()];

  static int? limitForMime(String mime) {
    if (!_mimeTypes.containsValue(mime)) return null;
    if (mime.startsWith('video/')) return videoLimitBytes;
    if (mime.startsWith('model/')) return modelLimitBytes;
    return imageLimitBytes;
  }
}

class MediaAssetContract extends SharedTypeContract {
  MediaAssetContract(super.json);

  factory MediaAssetContract.fromJson(JsonMap json) => MediaAssetContract(json);

  String get id => _string('id');
  String get storeId => _string('store_id');
  String get filename => _string('filename');
  String get originalName => _string('original_name', fallback: filename);
  String get displayName => filename.isEmpty ? originalName : filename;
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

  /// Validate a retained wire payload without adding omitted fields or changing
  /// the original command's meaning. Bounds mirror MediaMetadataUpdateSchema.
  static void validateJson(Map<String, dynamic> value) {
    const allowed = {'filename', 'alt_text', 'caption', 'folder', 'tags'};
    if (value.isEmpty || value.keys.any((key) => !allowed.contains(key))) {
      throw const FormatException(
        'Review the original media metadata request.',
      );
    }
    void text(String key, int max, {bool nullable = false, int min = 0}) {
      if (!value.containsKey(key)) return;
      final field = value[key];
      if (field == null && nullable) return;
      if (field is! String || field.length < min || field.length > max) {
        throw const FormatException(
          'Review the original media metadata request.',
        );
      }
    }

    text('filename', 500, min: 1);
    text('alt_text', 500, nullable: true);
    text('caption', 1000, nullable: true);
    text('folder', 200);
    if (value.containsKey('tags')) {
      final tags = value['tags'];
      if (tags is! List ||
          tags.length > 20 ||
          tags.any((tag) => tag is! String || tag.length > 50)) {
        throw const FormatException(
          'Review the original media metadata request.',
        );
      }
    }
  }

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
