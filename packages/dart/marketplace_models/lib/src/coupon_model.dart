import 'cart_item_model.dart';

/// Coupon types supported in the system
enum CouponType { flat, percentage, buyOneGetOne }

class CouponModel {
  final String id;
  final String code;
  final String title;
  final String description;
  final CouponType type;
  final double discount;
  final String? buyProductId; // for BOGO
  final String? getProductId; // for BOGO
  final DateTime validFrom;
  final DateTime validTo;
  final double minOrderAmount;
  final double? maxDiscountAmount;
  final int usageLimit;
  final int usedCount;
  final bool isActive;
  final List<String>? applicableCategories;
  final List<String>? applicableProducts;
  final bool isFirstOrderOnly;
  final DateTime createdAt;

  CouponModel({
    required this.id,
    required this.code,
    required this.title,
    required this.description,
    required this.type,
    required this.discount,
    this.buyProductId,
    this.getProductId,
    required this.validFrom,
    required this.validTo,
    required this.minOrderAmount,
    this.maxDiscountAmount,
    required this.usageLimit,
    required this.usedCount,
    required this.isActive,
    this.applicableCategories,
    this.applicableProducts,
    this.isFirstOrderOnly = false,
    required this.createdAt,
  });

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): fromMap(map, id)/toMap()
  // (Firestore document <-> model) deleted -- zero callers. CouponProvider (their only reason to
  // exist) was already fully retired in C2 as entirely Firestore-backed with no canonical
  // successor; the two remaining CouponModel references (product_details_screen.dart,
  // mobile_cart_screen.dart) only use the type/calculateDiscount below on an always-null value.

  /// Determines whether coupon is currently valid
  bool get isValid {
    final now = DateTime.now();
    return isActive &&
        now.isAfter(validFrom) &&
        now.isBefore(validTo) &&
        (usageLimit == 0 || usedCount < usageLimit);
  }

  /// Calculates discount amount.
  ///
  /// - For flat and percentage coupons: behaves as before.
  /// - For BOGO (buyOneGetOne):
  ///    * If `cartItems` is provided: looks for the buy product in cart; if present,
  ///      tries to find the get product in cart and uses its price for discount (one unit).
  ///    * If `getProductId` is null (same product free): uses buy-product price (one unit).
  ///    * If required product not found in cart, returns 0 (no automatic lookup to DB here).
  double calculateDiscount(double orderAmount, {List<CartItemModel>? cartItems}) {
    if (!isValid || orderAmount < minOrderAmount) return 0;

    double discountAmount = 0;

    switch (type) {
      case CouponType.flat:
        discountAmount = discount;
        break;
      case CouponType.percentage:
        discountAmount = (orderAmount * discount) / 100;
        break;
      case CouponType.buyOneGetOne:
        // BOGO: need cart items to compute actual discount
        if (cartItems == null || cartItems.isEmpty) {
          discountAmount = 0;
        } else {
          // find buy item
          final buyId = buyProductId;
          final getId = getProductId;
          CartItemModel? buyItem;
          CartItemModel? getItem;

          if (buyId != null) {
            try {
              buyItem = cartItems.firstWhere((c) => c.productId == buyId);
            } catch (_) {
              buyItem = null;
            }
          } else {
            // No buyId set — nothing to match
            buyItem = null;
          }

          if (getId != null) {
            try {
              getItem = cartItems.firstWhere((c) => c.productId == getId);
            } catch (_) {
              getItem = null;
            }
          } else {
            // If getId is null, assume same product free (buyItem -> free same)
            getItem = null;
          }

          if (buyItem != null) {
            // if get product exists in cart, discount equals one unit of get product price
            if (getItem != null) {
              discountAmount = getItem.price;
            } else if (getId == null) {
              // same product free: discount equals price of one unit of buyItem
              discountAmount = buyItem.price;
            } else {
              // get product not present to compute discount — fallback to 0
              discountAmount = 0;
            }
          } else {
            // buy item not present in cart -> cannot apply BOGO
            discountAmount = 0;
          }
        }
        break;
    }

    // Apply max discount cap if provided
    if (maxDiscountAmount != null && discountAmount > maxDiscountAmount!) {
      discountAmount = maxDiscountAmount!;
    }

    return discountAmount;
  }

  /// Human-friendly description text
  String get displayText {
    switch (type) {
      case CouponType.flat:
        return 'Get ₹$discount OFF';
      case CouponType.percentage:
        return 'Get ${discount.toInt()}% OFF';
      case CouponType.buyOneGetOne:
        return 'Buy 1 Get 1 FREE';
    }
  }

  /// Clone with new values
  CouponModel copyWith({
    String? id,
    String? code,
    String? title,
    String? description,
    CouponType? type,
    double? discount,
    String? buyProductId,
    String? getProductId,
    DateTime? validFrom,
    DateTime? validTo,
    double? minOrderAmount,
    double? maxDiscountAmount,
    int? usageLimit,
    int? usedCount,
    bool? isActive,
    List<String>? applicableCategories,
    List<String>? applicableProducts,
    bool? isFirstOrderOnly,
    DateTime? createdAt,
  }) {
    return CouponModel(
      id: id ?? this.id,
      code: code ?? this.code,
      title: title ?? this.title,
      description: description ?? this.description,
      type: type ?? this.type,
      discount: discount ?? this.discount,
      buyProductId: buyProductId ?? this.buyProductId,
      getProductId: getProductId ?? this.getProductId,
      validFrom: validFrom ?? this.validFrom,
      validTo: validTo ?? this.validTo,
      minOrderAmount: minOrderAmount ?? this.minOrderAmount,
      maxDiscountAmount: maxDiscountAmount ?? this.maxDiscountAmount,
      usageLimit: usageLimit ?? this.usageLimit,
      usedCount: usedCount ?? this.usedCount,
      isActive: isActive ?? this.isActive,
      applicableCategories: applicableCategories ?? this.applicableCategories,
      applicableProducts: applicableProducts ?? this.applicableProducts,
      isFirstOrderOnly: isFirstOrderOnly ?? this.isFirstOrderOnly,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'CouponModel(id: $id, code: $code, type: $type, discount: $discount, active: $isActive)';
}