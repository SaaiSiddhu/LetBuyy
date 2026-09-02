import 'json_helpers.dart';

class Address {
  const Address({
    required this.id,
    required this.userId,
    required this.label,
    required this.line1,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.latitude,
    required this.longitude,
    this.line2,
    this.isDefault = false,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String label;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String postalCode;
  final double latitude;
  final double longitude;
  final bool isDefault;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory Address.fromJson(Map<String, dynamic> json) {
    return Address(
      id: json['id'].toString(),
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      line1: json['line1']?.toString() ?? '',
      line2: json['line2']?.toString(),
      city: json['city']?.toString() ?? '',
      state: json['state']?.toString() ?? '',
      postalCode: json['postal_code']?.toString() ?? json['postalCode']?.toString() ?? '',
      latitude: parseDouble(json['latitude'] ?? json['lat']),
      longitude: parseDouble(json['longitude'] ?? json['lng']),
      isDefault: parseBool(json['is_default'] ?? json['isDefault']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'label': label,
      'line1': line1,
      'line2': line2,
      'city': city,
      'state': state,
      'postal_code': postalCode,
      'latitude': latitude,
      'longitude': longitude,
      'is_default': isDefault,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  Address copyWith({
    String? id,
    String? userId,
    String? label,
    String? line1,
    String? line2,
    String? city,
    String? state,
    String? postalCode,
    double? latitude,
    double? longitude,
    bool? isDefault,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Address(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      label: label ?? this.label,
      line1: line1 ?? this.line1,
      line2: line2 ?? this.line2,
      city: city ?? this.city,
      state: state ?? this.state,
      postalCode: postalCode ?? this.postalCode,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      isDefault: isDefault ?? this.isDefault,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is Address &&
        other.id == id &&
        other.userId == userId &&
        other.label == label &&
        other.line1 == line1 &&
        other.line2 == line2 &&
        other.city == city &&
        other.state == state &&
        other.postalCode == postalCode &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.isDefault == isDefault &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt;
  }

  @override
  int get hashCode => Object.hash(
        id,
        userId,
        label,
        line1,
        line2,
        city,
        state,
        postalCode,
        latitude,
        longitude,
        isDefault,
        createdAt,
        updatedAt,
      );

  @override
  String toString() => 'Address(${toJson()})';
}
