import 'json_helpers.dart';

class UserProfile {
  const UserProfile({
    required this.id,
    required this.fullName,
    this.phone,
    this.email,
    this.avatarUrl,
    this.defaultRole = 'customer',
    this.isActive = true,
    this.isBlocked = false,
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String id;
  final String? phone;
  final String? email;
  final String fullName;
  final String? avatarUrl;
  final String defaultRole;
  final bool isActive;
  final bool isBlocked;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'].toString(),
      phone: json['phone']?.toString(),
      email: json['email']?.toString(),
      fullName: json['full_name']?.toString() ?? json['fullName']?.toString() ?? '',
      avatarUrl: json['avatar_url']?.toString() ?? json['avatarUrl']?.toString(),
      defaultRole: json['default_role']?.toString() ?? json['defaultRole']?.toString() ?? 'customer',
      isActive: parseBool(json['is_active'] ?? json['isActive'], true),
      isBlocked: parseBool(json['is_blocked'] ?? json['isBlocked']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'phone': phone,
      'email': email,
      'full_name': fullName,
      'avatar_url': avatarUrl,
      'default_role': defaultRole,
      'is_active': isActive,
      'is_blocked': isBlocked,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  UserProfile copyWith({
    String? id,
    String? phone,
    String? email,
    String? fullName,
    String? avatarUrl,
    String? defaultRole,
    bool? isActive,
    bool? isBlocked,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return UserProfile(
      id: id ?? this.id,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      defaultRole: defaultRole ?? this.defaultRole,
      isActive: isActive ?? this.isActive,
      isBlocked: isBlocked ?? this.isBlocked,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is UserProfile &&
        other.id == id &&
        other.phone == phone &&
        other.email == email &&
        other.fullName == fullName &&
        other.avatarUrl == avatarUrl &&
        other.defaultRole == defaultRole &&
        other.isActive == isActive &&
        other.isBlocked == isBlocked &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hash(
        id,
        phone,
        email,
        fullName,
        avatarUrl,
        defaultRole,
        isActive,
        isBlocked,
        createdAt,
        updatedAt,
        version,
      );

  @override
  String toString() => 'UserProfile(${toJson()})';
}
