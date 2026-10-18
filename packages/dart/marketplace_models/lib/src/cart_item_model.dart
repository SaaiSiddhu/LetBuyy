// lib/models/cart_item_model.dart

class CartItemModel {
  final String id;
  final String productId;
  // The marketplace listing and underlying catalog product are separate canonical IDs.
  // productId remains the legacy route/display identity for existing local-cart consumers.
  final String? marketplaceListingId;
  final String? catalogProductId;
  final String? variantId;
  final String productName;
  final String productImage;
  final double price;
  final int quantity;
  final String userId;
  final DateTime addedAt;

  // ✅ SELLER FIELDS - For multi-seller support
  final String? sellerId; // Seller ID who owns this product
  final String? sellerName; // Seller/Store name for display

  // Additional fields for enhanced cart
  final String? variant; // Product variant (size, color, etc)
  final double? originalPrice; // Original price before discount
  final double discountPercentage; // Discount percentage

  // BOGO fields
  final bool isFreeItem; // Is this a BOGO free item?
  final String?
  freeItemLabel; // Label for free item (e.g., "BOGO Free", "Free Gift")
  final String?
  linkedBuyItemId; // ID of the buy item this free item is linked to

  CartItemModel({
    required this.id,
    required this.productId,
    this.marketplaceListingId,
    this.catalogProductId,
    this.variantId,
    required this.productName,
    required this.productImage,
    required this.price,
    required this.quantity,
    required this.userId,
    required this.addedAt,
    this.sellerId, // ✅ ADDED
    this.sellerName, // ✅ ADDED
    this.variant,
    this.originalPrice,
    this.discountPercentage = 0.0,
    this.isFreeItem = false,
    this.freeItemLabel,
    this.linkedBuyItemId,
  });

  // Calculate subtotal for this item
  double get subtotal => price * quantity;

  // Calculate total discount for this item
  double get totalDiscount {
    if (originalPrice == null) return 0.0;
    return (originalPrice! - price) * quantity;
  }

  // Check if item has discount
  bool get hasDiscount => originalPrice != null && originalPrice! > price;

  // Cart rows do not retain ProductModel.priceKnown, so fail closed when the
  // stored amount is zero (the same inert value used for an unknown price).
  bool get hasDisplayableReferencePrice => price > 0 && hasDiscount;

  bool get hasPriorThirtyDayLow =>
      marketplaceListingId != null && hasDisplayableReferencePrice;

  String get referencePriceLabel =>
      hasPriorThirtyDayLow ? 'Lowest price in prior 30 days' : 'M.R.P.';

  // Get the image URL (alias for backward compatibility)
  String get imageUrl => productImage;

  // ✅ NEW: Generate unique key for cart item (productId + variant)
  String get uniqueKey => variant != null && variant!.isNotEmpty
      ? '${productId}_$variant'
      : productId;

  // ✅ NEW: Check if item belongs to a specific seller
  bool belongsToSeller(String checkSellerId) => sellerId == checkSellerId;

  // C3 (Firebase SDK removal): fromFirestore(DocumentSnapshot) removed -- CartProvider is now a
  // local-only (SharedPreferences-backed) cart, never a Firestore collection, so nothing
  // constructs this from a snapshot any more. fromMap/toMap below no longer touch Timestamp;
  // addedAt round-trips as milliseconds-since-epoch, the same convention CacheService already
  // uses for ProductModel/CategoryModel's own local-cache serialization.
  factory CartItemModel.fromMap(Map<String, dynamic> map, [String? docId]) {
    return CartItemModel(
      id: docId ?? map['id'] ?? '',
      productId: map['productId'] ?? '',
      marketplaceListingId: map['marketplaceListingId'] as String?,
      catalogProductId: map['catalogProductId'] as String?,
      variantId: map['variantId'] as String?,
      productName: map['productName'] ?? '',
      productImage: map['productImage'] ?? '',
      price: (map['price'] ?? 0).toDouble(),
      quantity: map['quantity'] ?? 1,
      userId: map['userId'] ?? '',
      addedAt: map['addedAt'] is int
          ? DateTime.fromMillisecondsSinceEpoch(map['addedAt'] as int)
          : (map['addedAt'] is DateTime ? map['addedAt'] : DateTime.now()),
      sellerId: map['sellerId'] as String?, // ✅ ADDED
      sellerName: map['sellerName'] as String?, // ✅ ADDED
      variant: map['variant'],
      originalPrice: map['originalPrice']?.toDouble(),
      discountPercentage: (map['discountPercentage'] ?? 0).toDouble(),
      isFreeItem: map['isFreeItem'] ?? false,
      freeItemLabel: map['freeItemLabel'],
      linkedBuyItemId: map['linkedBuyItemId'],
    );
  }

  // Convert to Map for local storage (see fromMap's own doc comment on addedAt).
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'productId': productId,
      'marketplaceListingId': marketplaceListingId,
      'catalogProductId': catalogProductId,
      'variantId': variantId,
      'productName': productName,
      'productImage': productImage,
      'price': price,
      'quantity': quantity,
      'userId': userId,
      'addedAt': addedAt.millisecondsSinceEpoch,
      'sellerId': sellerId, // ✅ ADDED
      'sellerName': sellerName, // ✅ ADDED
      'variant': variant,
      'originalPrice': originalPrice,
      'discountPercentage': discountPercentage,
      'isFreeItem': isFreeItem,
      'freeItemLabel': freeItemLabel,
      'linkedBuyItemId': linkedBuyItemId,
    };
  }

  // Copy with method for immutability
  CartItemModel copyWith({
    String? id,
    String? productId,
    String? marketplaceListingId,
    String? catalogProductId,
    String? variantId,
    String? productName,
    String? productImage,
    double? price,
    int? quantity,
    String? userId,
    DateTime? addedAt,
    String? sellerId, // ✅ ADDED
    String? sellerName, // ✅ ADDED
    String? variant,
    double? originalPrice,
    double? discountPercentage,
    bool? isFreeItem,
    String? freeItemLabel,
    String? linkedBuyItemId,
  }) {
    return CartItemModel(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      marketplaceListingId: marketplaceListingId ?? this.marketplaceListingId,
      catalogProductId: catalogProductId ?? this.catalogProductId,
      variantId: variantId ?? this.variantId,
      productName: productName ?? this.productName,
      productImage: productImage ?? this.productImage,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      userId: userId ?? this.userId,
      addedAt: addedAt ?? this.addedAt,
      sellerId: sellerId ?? this.sellerId, // ✅ ADDED
      sellerName: sellerName ?? this.sellerName, // ✅ ADDED
      variant: variant ?? this.variant,
      originalPrice: originalPrice ?? this.originalPrice,
      discountPercentage: discountPercentage ?? this.discountPercentage,
      isFreeItem: isFreeItem ?? this.isFreeItem,
      freeItemLabel: freeItemLabel ?? this.freeItemLabel,
      linkedBuyItemId: linkedBuyItemId ?? this.linkedBuyItemId,
    );
  }

  @override
  String toString() {
    return 'CartItemModel(id: $id, productName: $productName, sellerId: $sellerId, variant: $variant, quantity: $quantity, price: $price, isFreeItem: $isFreeItem)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CartItemModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}

// ============================================
// ✅ EXTENSION: Group cart items by seller
// ============================================
extension CartItemListExtension on List<CartItemModel> {
  /// Group cart items by seller ID
  Map<String, List<CartItemModel>> groupBySeller() {
    final Map<String, List<CartItemModel>> grouped = {};

    for (final item in this) {
      final sellerId = item.sellerId ?? 'unknown';
      if (!grouped.containsKey(sellerId)) {
        grouped[sellerId] = [];
      }
      grouped[sellerId]!.add(item);
    }

    return grouped;
  }

  /// Get total for items from a specific seller
  double totalForSeller(String sellerId) {
    return where(
      (item) => item.sellerId == sellerId,
    ).fold(0.0, (sum, item) => sum + item.subtotal);
  }

  /// Get item count for a specific seller
  int countForSeller(String sellerId) {
    return where(
      (item) => item.sellerId == sellerId,
    ).fold(0, (sum, item) => sum + item.quantity);
  }

  /// Get unique seller IDs from cart
  List<String> get uniqueSellerIds {
    return map((item) => item.sellerId ?? 'unknown').toSet().toList();
  }

  /// Check if cart has items from multiple sellers
  bool get hasMultipleSellers => uniqueSellerIds.length > 1;
}
