import 'json_helpers.dart';
import 'order_item.dart';
import 'order_status.dart';

class Order {
  const Order({
    required this.id,
    required this.publicOrderNumber,
    required this.userId,
    required this.darkStoreId,
    required this.addressSnapshot,
    required this.status,
    this.paymentStatus = 'pending',
    this.subtotal = 0,
    this.discountTotal = 0,
    this.deliveryFee = 0,
    this.walletApplied = 0,
    this.payableTotal = 0,
    this.etaSeconds,
    this.promisedEtaAt,
    this.pickedUpAt,
    this.dispatchedAt,
    this.deliveredAt,
    this.quoteId,
    this.items = const [],
    this.createdAt,
    this.updatedAt,
    this.version = 1,
  });

  final String id;
  final String publicOrderNumber;
  final String userId;
  final String darkStoreId;
  final Map<String, dynamic> addressSnapshot;
  final OrderStatus status;
  final String paymentStatus;
  final double subtotal;
  final double discountTotal;
  final double deliveryFee;
  final double walletApplied;
  final double payableTotal;
  final int? etaSeconds;
  final DateTime? promisedEtaAt;
  final DateTime? pickedUpAt;
  final DateTime? dispatchedAt;
  final DateTime? deliveredAt;
  final String? quoteId;
  final List<OrderItem> items;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int version;

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'].toString(),
      publicOrderNumber: json['public_order_number']?.toString() ?? json['publicOrderNumber']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      darkStoreId: json['dark_store_id']?.toString() ?? json['store_id']?.toString() ?? json['darkStoreId']?.toString() ?? '',
      addressSnapshot: parseMap(json['address_snapshot'] ?? json['addressSnapshot']),
      status: OrderStatus.fromJson(json['status']),
      paymentStatus: json['payment_status']?.toString() ?? json['paymentStatus']?.toString() ?? 'pending',
      subtotal: parseDouble(json['subtotal']),
      discountTotal: parseDouble(json['discount_total'] ?? json['discountTotal']),
      deliveryFee: parseDouble(json['delivery_fee'] ?? json['deliveryFee']),
      walletApplied: parseDouble(json['wallet_applied'] ?? json['walletApplied']),
      payableTotal: parseDouble(json['payable_total'] ?? json['payableTotal']),
      etaSeconds: json['eta_seconds'] == null && json['etaSeconds'] == null
          ? null
          : parseInt(json['eta_seconds'] ?? json['etaSeconds']),
      promisedEtaAt: parseDateTime(json['promised_eta_at'] ?? json['promisedEtaAt']),
      pickedUpAt: parseDateTime(json['picked_up_at'] ?? json['pickedUpAt']),
      dispatchedAt: parseDateTime(json['dispatched_at'] ?? json['dispatchedAt']),
      deliveredAt: parseDateTime(json['delivered_at'] ?? json['deliveredAt']),
      quoteId: json['quote_id']?.toString() ?? json['quoteId']?.toString(),
      items: (json['items'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => OrderItem.fromJson(parseMap(item)))
          .toList(growable: false),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'public_order_number': publicOrderNumber,
      'user_id': userId,
      'dark_store_id': darkStoreId,
      'address_snapshot': addressSnapshot,
      'status': status.toJson(),
      'payment_status': paymentStatus,
      'subtotal': subtotal,
      'discount_total': discountTotal,
      'delivery_fee': deliveryFee,
      'wallet_applied': walletApplied,
      'payable_total': payableTotal,
      'eta_seconds': etaSeconds,
      'promised_eta_at': promisedEtaAt?.toIso8601String(),
      'picked_up_at': pickedUpAt?.toIso8601String(),
      'dispatched_at': dispatchedAt?.toIso8601String(),
      'delivered_at': deliveredAt?.toIso8601String(),
      'quote_id': quoteId,
      'items': items.map((item) => item.toJson()).toList(growable: false),
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  Order copyWith({
    String? id,
    String? publicOrderNumber,
    String? userId,
    String? darkStoreId,
    Map<String, dynamic>? addressSnapshot,
    OrderStatus? status,
    String? paymentStatus,
    double? subtotal,
    double? discountTotal,
    double? deliveryFee,
    double? walletApplied,
    double? payableTotal,
    int? etaSeconds,
    DateTime? promisedEtaAt,
    DateTime? pickedUpAt,
    DateTime? dispatchedAt,
    DateTime? deliveredAt,
    String? quoteId,
    List<OrderItem>? items,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
  }) {
    return Order(
      id: id ?? this.id,
      publicOrderNumber: publicOrderNumber ?? this.publicOrderNumber,
      userId: userId ?? this.userId,
      darkStoreId: darkStoreId ?? this.darkStoreId,
      addressSnapshot: addressSnapshot ?? this.addressSnapshot,
      status: status ?? this.status,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      subtotal: subtotal ?? this.subtotal,
      discountTotal: discountTotal ?? this.discountTotal,
      deliveryFee: deliveryFee ?? this.deliveryFee,
      walletApplied: walletApplied ?? this.walletApplied,
      payableTotal: payableTotal ?? this.payableTotal,
      etaSeconds: etaSeconds ?? this.etaSeconds,
      promisedEtaAt: promisedEtaAt ?? this.promisedEtaAt,
      pickedUpAt: pickedUpAt ?? this.pickedUpAt,
      dispatchedAt: dispatchedAt ?? this.dispatchedAt,
      deliveredAt: deliveredAt ?? this.deliveredAt,
      quoteId: quoteId ?? this.quoteId,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is Order &&
        other.id == id &&
        other.publicOrderNumber == publicOrderNumber &&
        other.userId == userId &&
        other.darkStoreId == darkStoreId &&
        mapEquals(other.addressSnapshot, addressSnapshot) &&
        other.status == status &&
        other.paymentStatus == paymentStatus &&
        other.subtotal == subtotal &&
        other.discountTotal == discountTotal &&
        other.deliveryFee == deliveryFee &&
        other.walletApplied == walletApplied &&
        other.payableTotal == payableTotal &&
        other.etaSeconds == etaSeconds &&
        other.promisedEtaAt == promisedEtaAt &&
        other.pickedUpAt == pickedUpAt &&
        other.dispatchedAt == dispatchedAt &&
        other.deliveredAt == deliveredAt &&
        other.quoteId == quoteId &&
        listEquals(other.items, items) &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hashAll([
        id,
        publicOrderNumber,
        userId,
        darkStoreId,
        mapHash(addressSnapshot),
        status,
        paymentStatus,
        subtotal,
        discountTotal,
        deliveryFee,
        walletApplied,
        payableTotal,
        etaSeconds,
        promisedEtaAt,
        pickedUpAt,
        dispatchedAt,
        deliveredAt,
        quoteId,
        listHash(items),
        createdAt,
        updatedAt,
        version,
      ]);

  @override
  String toString() => 'Order(${toJson()})';
}
