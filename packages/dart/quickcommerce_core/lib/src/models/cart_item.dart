import 'json_helpers.dart';

class CartItem {
  const CartItem({
    required this.cartId,
    required this.variantId,
    required this.quantity,
    this.productId,
    this.productName,
    this.imageUrl,
    this.unitPrice = 0,
    this.mrp = 0,
    this.addedAt,
    this.updatedAt,
  });

  final String cartId;
  final String variantId;
  final String? productId;
  final String? productName;
  final String? imageUrl;
  final int quantity;
  final double unitPrice;
  final double mrp;
  final DateTime? addedAt;
  final DateTime? updatedAt;

  factory CartItem.fromJson(Map<String, dynamic> json) {
    return CartItem(
      cartId: json['cart_id']?.toString() ?? json['cartId']?.toString() ?? '',
      variantId: json['variant_id']?.toString() ?? json['variantId']?.toString() ?? '',
      productId: json['product_id']?.toString() ?? json['productId']?.toString(),
      productName: json['product_name']?.toString() ?? json['productName']?.toString(),
      imageUrl: json['image_url']?.toString() ?? json['imageUrl']?.toString(),
      quantity: parseInt(json['quantity'], 1),
      unitPrice: parseDouble(json['unit_price'] ?? json['unitPrice']),
      mrp: parseDouble(json['mrp']),
      addedAt: parseDateTime(json['added_at'] ?? json['addedAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'cart_id': cartId,
      'variant_id': variantId,
      'product_id': productId,
      'product_name': productName,
      'image_url': imageUrl,
      'quantity': quantity,
      'unit_price': unitPrice,
      'mrp': mrp,
      'added_at': addedAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  CartItem copyWith({
    String? cartId,
    String? variantId,
    String? productId,
    String? productName,
    String? imageUrl,
    int? quantity,
    double? unitPrice,
    double? mrp,
    DateTime? addedAt,
    DateTime? updatedAt,
  }) {
    return CartItem(
      cartId: cartId ?? this.cartId,
      variantId: variantId ?? this.variantId,
      productId: productId ?? this.productId,
      productName: productName ?? this.productName,
      imageUrl: imageUrl ?? this.imageUrl,
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      mrp: mrp ?? this.mrp,
      addedAt: addedAt ?? this.addedAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is CartItem &&
        other.cartId == cartId &&
        other.variantId == variantId &&
        other.productId == productId &&
        other.productName == productName &&
        other.imageUrl == imageUrl &&
        other.quantity == quantity &&
        other.unitPrice == unitPrice &&
        other.mrp == mrp &&
        other.addedAt == addedAt &&
        other.updatedAt == updatedAt;
  }

  @override
  int get hashCode => Object.hash(
        cartId,
        variantId,
        productId,
        productName,
        imageUrl,
        quantity,
        unitPrice,
        mrp,
        addedAt,
        updatedAt,
      );

  @override
  String toString() => 'CartItem(${toJson()})';
}
