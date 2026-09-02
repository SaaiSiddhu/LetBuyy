import 'json_helpers.dart';

class DeliveryInfo {
  const DeliveryInfo({
    required this.id,
    required this.orderId,
    required this.darkStoreId,
    required this.status,
    required this.pickupLatitude,
    required this.pickupLongitude,
    required this.dropLatitude,
    required this.dropLongitude,
    this.riderId,
    this.promisedEtaAt,
    this.assignedAt,
    this.acceptedAt,
    this.pickedUpAt,
    this.deliveredAt,
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String id;
  final String orderId;
  final String darkStoreId;
  final String? riderId;
  final String status;
  final double pickupLatitude;
  final double pickupLongitude;
  final double dropLatitude;
  final double dropLongitude;
  final DateTime? promisedEtaAt;
  final DateTime? assignedAt;
  final DateTime? acceptedAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory DeliveryInfo.fromJson(Map<String, dynamic> json) {
    return DeliveryInfo(
      id: json['id'].toString(),
      orderId: json['order_id']?.toString() ?? json['orderId']?.toString() ?? '',
      darkStoreId: json['dark_store_id']?.toString() ?? json['store_id']?.toString() ?? json['darkStoreId']?.toString() ?? '',
      riderId: json['rider_id']?.toString() ?? json['riderId']?.toString(),
      status: json['status']?.toString() ?? 'pending_assignment',
      pickupLatitude: parseDouble(json['pickup_latitude'] ?? json['pickupLatitude']),
      pickupLongitude: parseDouble(json['pickup_longitude'] ?? json['pickupLongitude']),
      dropLatitude: parseDouble(json['drop_latitude'] ?? json['dropLatitude']),
      dropLongitude: parseDouble(json['drop_longitude'] ?? json['dropLongitude']),
      promisedEtaAt: parseDateTime(json['promised_eta_at'] ?? json['promisedEtaAt']),
      assignedAt: parseDateTime(json['assigned_at'] ?? json['assignedAt']),
      acceptedAt: parseDateTime(json['accepted_at'] ?? json['acceptedAt']),
      pickedUpAt: parseDateTime(json['picked_up_at'] ?? json['pickedUpAt']),
      deliveredAt: parseDateTime(json['delivered_at'] ?? json['deliveredAt']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_id': orderId,
      'dark_store_id': darkStoreId,
      'rider_id': riderId,
      'status': status,
      'pickup_latitude': pickupLatitude,
      'pickup_longitude': pickupLongitude,
      'drop_latitude': dropLatitude,
      'drop_longitude': dropLongitude,
      'promised_eta_at': promisedEtaAt?.toIso8601String(),
      'assigned_at': assignedAt?.toIso8601String(),
      'accepted_at': acceptedAt?.toIso8601String(),
      'picked_up_at': pickedUpAt?.toIso8601String(),
      'delivered_at': deliveredAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  DeliveryInfo copyWith({
    String? id,
    String? orderId,
    String? darkStoreId,
    String? riderId,
    String? status,
    double? pickupLatitude,
    double? pickupLongitude,
    double? dropLatitude,
    double? dropLongitude,
    DateTime? promisedEtaAt,
    DateTime? assignedAt,
    DateTime? acceptedAt,
    DateTime? pickedUpAt,
    DateTime? deliveredAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return DeliveryInfo(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      darkStoreId: darkStoreId ?? this.darkStoreId,
      riderId: riderId ?? this.riderId,
      status: status ?? this.status,
      pickupLatitude: pickupLatitude ?? this.pickupLatitude,
      pickupLongitude: pickupLongitude ?? this.pickupLongitude,
      dropLatitude: dropLatitude ?? this.dropLatitude,
      dropLongitude: dropLongitude ?? this.dropLongitude,
      promisedEtaAt: promisedEtaAt ?? this.promisedEtaAt,
      assignedAt: assignedAt ?? this.assignedAt,
      acceptedAt: acceptedAt ?? this.acceptedAt,
      pickedUpAt: pickedUpAt ?? this.pickedUpAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is DeliveryInfo &&
        other.id == id &&
        other.orderId == orderId &&
        other.darkStoreId == darkStoreId &&
        other.riderId == riderId &&
        other.status == status &&
        other.pickupLatitude == pickupLatitude &&
        other.pickupLongitude == pickupLongitude &&
        other.dropLatitude == dropLatitude &&
        other.dropLongitude == dropLongitude &&
        other.promisedEtaAt == promisedEtaAt &&
        other.assignedAt == assignedAt &&
        other.acceptedAt == acceptedAt &&
        other.pickedUpAt == pickedUpAt &&
        other.deliveredAt == deliveredAt &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hashAll([
        id,
        orderId,
        darkStoreId,
        riderId,
        status,
        pickupLatitude,
        pickupLongitude,
        dropLatitude,
        dropLongitude,
        promisedEtaAt,
        assignedAt,
        acceptedAt,
        pickedUpAt,
        deliveredAt,
        createdAt,
        updatedAt,
        version,
      ]);

  @override
  String toString() => 'DeliveryInfo(${toJson()})';
}
