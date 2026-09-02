import 'package:cloud_firestore/cloud_firestore.dart';

/// Supported app types for APK updates
enum AppType {
  admin,
  marketplace,
  seller,
  store;

  String get displayName {
    switch (this) {
      case AppType.admin:
        return 'Admin';
      case AppType.marketplace:
        return 'Marketplace';
      case AppType.seller:
        return 'Seller';
      case AppType.store:
        return 'Store Builder';
    }
  }

  static AppType fromString(String? value) {
    switch (value?.toLowerCase()) {
      case 'admin':
        return AppType.admin;
      case 'seller':
        return AppType.seller;
      case 'store':
        return AppType.store;
      case 'marketplace':
      default:
        return AppType.marketplace;
    }
  }
}

class AppUpdateModel {
  final String id;
  final AppType appType; // Which app this update belongs to
  final int versionCode;
  final String versionName; // Semantic version: "1.0.5"
  final int versionMajor;
  final int versionMinor;
  final int versionPatch;
  final String apkUrl;
  final String updateMessage;
  final String releaseNotes; // Markdown changelog
  final int fileSize; // APK size in bytes
  final bool mandatory;
  final bool isActive;
  final DateTime createdAt;

  AppUpdateModel({
    required this.id,
    this.appType = AppType.marketplace,
    required this.versionCode,
    this.versionName = '',
    this.versionMajor = 1,
    this.versionMinor = 0,
    this.versionPatch = 0,
    required this.apkUrl,
    required this.updateMessage,
    this.releaseNotes = '',
    this.fileSize = 0,
    this.mandatory = false,
    this.isActive = true,
    required this.createdAt,
  });

  /// Get formatted version name from components
  String get formattedVersionName {
    if (versionName.isNotEmpty) return versionName;
    return '$versionMajor.$versionMinor.$versionPatch';
  }

  /// Get formatted file size (e.g., "57.2 MB")
  String get formattedFileSize {
    if (fileSize <= 0) return '';
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    return '${(fileSize / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  factory AppUpdateModel.fromMap(String id, Map<String, dynamic> map) {
    return AppUpdateModel(
      id: id,
      appType: AppType.fromString(map['appType']),
      versionCode: map['versionCode'] ?? 0,
      versionName: map['versionName'] ?? '',
      versionMajor: map['versionMajor'] ?? 1,
      versionMinor: map['versionMinor'] ?? 0,
      versionPatch: map['versionPatch'] ?? 0,
      apkUrl: map['apkUrl'] ?? '',
      updateMessage: map['updateMessage'] ?? '',
      releaseNotes: map['releaseNotes'] ?? '',
      fileSize: map['fileSize'] ?? 0,
      mandatory: map['mandatory'] ?? false,
      isActive: map['isActive'] ?? true,
      createdAt: map['createdAt'] is Timestamp 
          ? (map['createdAt'] as Timestamp).toDate() 
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'appType': appType.name,
      'versionCode': versionCode,
      'versionName': formattedVersionName,
      'versionMajor': versionMajor,
      'versionMinor': versionMinor,
      'versionPatch': versionPatch,
      'apkUrl': apkUrl,
      'updateMessage': updateMessage,
      'releaseNotes': releaseNotes,
      'fileSize': fileSize,
      'mandatory': mandatory,
      'isActive': isActive,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }

  /// Create a copy with updated fields
  AppUpdateModel copyWith({
    String? id,
    AppType? appType,
    int? versionCode,
    String? versionName,
    int? versionMajor,
    int? versionMinor,
    int? versionPatch,
    String? apkUrl,
    String? updateMessage,
    String? releaseNotes,
    int? fileSize,
    bool? mandatory,
    bool? isActive,
    DateTime? createdAt,
  }) {
    return AppUpdateModel(
      id: id ?? this.id,
      appType: appType ?? this.appType,
      versionCode: versionCode ?? this.versionCode,
      versionName: versionName ?? this.versionName,
      versionMajor: versionMajor ?? this.versionMajor,
      versionMinor: versionMinor ?? this.versionMinor,
      versionPatch: versionPatch ?? this.versionPatch,
      apkUrl: apkUrl ?? this.apkUrl,
      updateMessage: updateMessage ?? this.updateMessage,
      releaseNotes: releaseNotes ?? this.releaseNotes,
      fileSize: fileSize ?? this.fileSize,
      mandatory: mandatory ?? this.mandatory,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}