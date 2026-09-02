import 'json_helpers.dart';

class OrderItem {
  const OrderItem({
    required this.orderId,
    required this.variantId,
    required this.productSnapshot,
    required this.quantity,
    required this.unitPrice,
    required this.mrp,
    this.discount = 0,
  });

  final String orderId;
  final String variantId;
  final Map<String, dynamic> productSnapshot;
  final int quantity;
  final double unitPrice;
  final double mrp;
  final double discount;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      orderId: json['order_id']?.toString() ?? json['orderId']?.toString() ?? '',
      variantId: json['variant_id']?.toString() ?? json['variantId']?.toString() ?? '',
      productSnapshot: parseMap(json['product_snapshot'] ?? json['productSnapshot']),
      quantity: parseInt(json['quantity'], 1),
      unitPrice: parseDouble(json['unit_price'] ?? json['unitPrice']),
      mrp: parseDouble(json['mrp']),
      discount: parseDouble(json['discount']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'order_id': orderId,
      'variant_id': variantId,
      'product_snapshot': productSnapshot,
      'quantity': quantity,
      'unit_price': unitPrice,
      'mrp': mrp,
      'discount': discount,
    };
  }

  OrderItem copyWith({
    String? orderId,
    String? variantId,
    Map<String, dynamic>? productSnapshot,
    int? quantity,
    double? unitPrice,
    double? mrp,
    double? discount,
  }) {
    return OrderItem(
      orderId: orderId ?? this.orderId,
      variantId: variantId ?? this.variantId,
      productSnapshot: productSnapshot ?? this.productSnapshot,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      mrp: mrp ?? this.mrp,
      discount: discount ?? this.discount,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is OrderItem &&
        other.orderId == orderId &&
        other.variantId == variantId &&
        mapEquals(other.productSnapshot, productSnapshot) &&
        other.quantity == quantity &&
        other.unitPrice == unitPrice &&
        other.mrp == mrp &&
        other.discount == discount;
  }

  @override
  int get hashCode => Object.hash(
        orderId,
        variantId,
        mapHash(productSnapshot),
        quantity,
        unitPrice,
        mrp,
        discount,
      );

  @override
  String toString() => 'OrderItem(${toJson()})';
}
