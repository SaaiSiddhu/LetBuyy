import 'json_helpers.dart';

class RiderProfile {
  const RiderProfile({
    required this.userId,
    required this.cityId,
    required this.vehicleType,
    this.licenseNumber,
    this.status = 'offline',
    this.isVerified = false,
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String userId;
  final String cityId;
  final String vehicleType;
  final String? licenseNumber;
  final String status;
  final bool isVerified;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory RiderProfile.fromJson(Map<String, dynamic> json) {
    return RiderProfile(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      cityId: json['city_id']?.toString() ?? json['cityId']?.toString() ?? '',
      vehicleType: json['vehicle_type']?.toString() ?? json['vehicleType']?.toString() ?? '',
      licenseNumber: json['license_number']?.toString() ?? json['licenseNumber']?.toString(),
      status: json['status']?.toString() ?? 'offline',
      isVerified: parseBool(json['is_verified'] ?? json['isVerified']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'city_id': cityId,
      'vehicle_type': vehicleType,
      'license_number': licenseNumber,
      'status': status,
      'is_verified': isVerified,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  RiderProfile copyWith({
    String? userId,
    String? cityId,
    String? vehicleType,
    String? licenseNumber,
    String? status,
    bool? isVerified,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return RiderProfile(
      userId: userId ?? this.userId,
      cityId: cityId ?? this.cityId,
      vehicleType: vehicleType ?? this.vehicleType,
      licenseNumber: licenseNumber ?? this.licenseNumber,
      status: status ?? this.status,
      isVerified: isVerified ?? this.isVerified,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is RiderProfile &&
        other.userId == userId &&
        other.cityId == cityId &&
        other.vehicleType == vehicleType &&
        other.licenseNumber == licenseNumber &&
        other.status == status &&
        other.isVerified == isVerified &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hash(
        userId,
        cityId,
        vehicleType,
        licenseNumber,
        status,
        isVerified,
        createdAt,
        updatedAt,
        version,
      );

  @override
  String toString() => 'RiderProfile(${toJson()})';
}
