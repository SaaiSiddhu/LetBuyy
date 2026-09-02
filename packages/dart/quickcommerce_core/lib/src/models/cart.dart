import 'cart_item.dart';
import 'json_helpers.dart';

class Cart {
  const Cart({
    required this.id,
    required this.userId,
    this.storeId,
    this.status = 'active',
    this.items = const [],
    this.subtotal = 0,
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String id;
  final String userId;
  final String? storeId;
  final String status;
  final List<CartItem> items;
  final double subtotal;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory Cart.fromJson(Map<String, dynamic> json) {
    return Cart(
      id: json['id'].toString(),
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      storeId: json['store_id']?.toString() ?? json['storeId']?.toString(),
      status: json['status']?.toString() ?? 'active',
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => CartItem.fromJson(parseMap(item)))
          .toList(growable: false),
      subtotal: parseDouble(json['subtotal']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'store_id': storeId,
      'status': status,
      'items': items.map((item) => item.toJson()).toList(growable: false),
      'subtotal': subtotal,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  Cart copyWith({
    String? id,
    String? userId,
    String? storeId,
    String? status,
    List<CartItem>? items,
    double? subtotal,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return Cart(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      storeId: storeId ?? this.storeId,
      status: status ?? this.status,
      items: items ?? this.items,
      subtotal: subtotal ?? this.subtotal,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is Cart &&
        other.id == id &&
        other.userId == userId &&
        other.storeId == storeId &&
        other.status == status &&
        listEquals(other.items, items) &&
        other.subtotal == subtotal &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hash(
        id,
        userId,
        storeId,
        status,
        listHash(items),
        subtotal,
        createdAt,
        updatedAt,
        version,
      );

  @override
  String toString() => 'Cart(${toJson()})';
}
