import 'json_helpers.dart';

class DarkStore {
  const DarkStore({
    required this.id,
    required this.code,
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    this.cityId,
    this.serviceRadiusM = 3000,
    this.targetSlaSeconds = 900,
    this.isActive = true,
    this.acceptsOrders = true,
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String id;
  final String? cityId;
  final String code;
  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final int serviceRadiusM;
  final int targetSlaSeconds;
  final bool isActive;
  final bool acceptsOrders;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory DarkStore.fromJson(Map<String, dynamic> json) {
    return DarkStore(
      id: json['id'].toString(),
      cityId: json['city_id']?.toString() ?? json['cityId']?.toString(),
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      latitude: parseDouble(json['latitude'] ?? json['lat']),
      longitude: parseDouble(json['longitude'] ?? json['lng']),
      serviceRadiusM: parseInt(json['service_radius_m'] ?? json['serviceRadiusM'], 3000),
      targetSlaSeconds: parseInt(json['target_sla_seconds'] ?? json['targetSlaSeconds'], 900),
      isActive: parseBool(json['is_active'] ?? json['isActive'], true),
      acceptsOrders: parseBool(json['accepts_orders'] ?? json['acceptsOrders'], true),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'city_id': cityId,
      'code': code,
      'name': name,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'service_radius_m': serviceRadiusM,
      'target_sla_seconds': targetSlaSeconds,
      'is_active': isActive,
      'accepts_orders': acceptsOrders,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  DarkStore copyWith({
    String? id,
    String? cityId,
    String? code,
    String? name,
    String? address,
    double? latitude,
    double? longitude,
    int? serviceRadiusM,
    int? targetSlaSeconds,
    bool? isActive,
    bool? acceptsOrders,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return DarkStore(
      id: id ?? this.id,
      cityId: cityId ?? this.cityId,
      code: code ?? this.code,
      name: name ?? this.name,
      address: address ?? this.address,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      serviceRadiusM: serviceRadiusM ?? this.serviceRadiusM,
      targetSlaSeconds: targetSlaSeconds ?? this.targetSlaSeconds,
      isActive: isActive ?? this.isActive,
      acceptsOrders: acceptsOrders ?? this.acceptsOrders,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is DarkStore &&
        other.id == id &&
        other.cityId == cityId &&
        other.code == code &&
        other.name == name &&
        other.address == address &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.serviceRadiusM == serviceRadiusM &&
        other.targetSlaSeconds == targetSlaSeconds &&
        other.isActive == isActive &&
        other.acceptsOrders == acceptsOrders &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hash(
        id,
        cityId,
        code,
        name,
        address,
        latitude,
        longitude,
        serviceRadiusM,
        targetSlaSeconds,
        isActive,
        acceptsOrders,
        createdAt,
        updatedAt,
        version,
      );

  @override
  String toString() => 'DarkStore(${toJson()})';
}
