// Deal Model - For seller promotional deals

/// Status of a deal in the approval/lifecycle process
enum DealStatus {
  pending,    // Awaiting admin approval
  approved,   // Approved but not yet started
  rejected,   // Admin rejected
  active,     // Currently running
  expired,    // Time ended
  cancelled,  // Seller cancelled
  soldOut,    // Stock limit reached
}

/// Type of discount applied
enum DealDiscountType {
  percentage, // e.g., 20% OFF
  fixed,      // e.g., ₹100 OFF
}

/// Model for seller-created promotional deals
class DealModel {
  final String id;
  final String sellerId;
  final String productId;
  
  // Deal Details
  final String title;
  final String? description;
  final DealDiscountType discountType;
  final double discountValue;
  final double? maxDiscountAmount; // Cap for percentage discounts
  
  // Pricing
  final double originalPrice;
  final double dealPrice;
  
  // Duration
  final DateTime startDate;
  final DateTime endDate;
  
  // Stock Limit (optional)
  final int? stockLimit;
  final int stockSold;
  
  // Status & Approval
  final DealStatus status;
  final String? rejectionReason;
  final DateTime? approvedAt;
  final String? approvedBy;
  
  // Denormalized Product Info (for quick display)
  final String productName;
  final String productImage;
  final String sellerName;
  
  // Timestamps
  final DateTime createdAt;
  final DateTime? updatedAt;

  DealModel({
    required this.id,
    required this.sellerId,
    required this.productId,
    required this.title,
    this.description,
    required this.discountType,
    required this.discountValue,
    this.maxDiscountAmount,
    required this.originalPrice,
    required this.dealPrice,
    required this.startDate,
    required this.endDate,
    this.stockLimit,
    this.stockSold = 0,
    required this.status,
    this.rejectionReason,
    this.approvedAt,
    this.approvedBy,
    required this.productName,
    required this.productImage,
    required this.sellerName,
    required this.createdAt,
    this.updatedAt,
  });

  // ============ Computed Properties ============

  /// Check if deal is currently active and running
  bool get isActive {
    if (status != DealStatus.active) return false;
    final now = DateTime.now();
    return now.isAfter(startDate) && now.isBefore(endDate);
  }

  /// Check if deal has expired
  bool get isExpired {
    return DateTime.now().isAfter(endDate);
  }

  /// Check if deal has started
  bool get hasStarted {
    return DateTime.now().isAfter(startDate);
  }

  /// Check if stock is available (if limit set)
  bool get hasStock {
    if (stockLimit == null) return true;
    return stockSold < stockLimit!;
  }

  /// Remaining stock count
  int? get remainingStock {
    if (stockLimit == null) return null;
    return stockLimit! - stockSold;
  }

  /// Time remaining until deal ends
  Duration get timeRemaining {
    final now = DateTime.now();
    if (now.isAfter(endDate)) return Duration.zero;
    return endDate.difference(now);
  }

  /// Discount percentage (computed for display)
  int get discountPercentage {
    if (discountType == DealDiscountType.percentage) {
      return discountValue.round();
    }
    // Calculate percentage from fixed discount
    if (originalPrice > 0) {
      return ((discountValue / originalPrice) * 100).round();
    }
    return 0;
  }

  /// Formatted discount label (e.g., "20% OFF" or "₹100 OFF")
  String get discountLabel {
    if (discountType == DealDiscountType.percentage) {
      return '${discountValue.round()}% OFF';
    }
    return '₹${discountValue.toStringAsFixed(0)} OFF';
  }

  /// Savings amount
  double get savings {
    return originalPrice - dealPrice;
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): fromFirestore(doc)/
  // fromMap(data, id)/toMap() all deleted -- zero callers. deal_service.dart (their only reason to
  // exist) was already gutted to a single honest `Future<DealModel?> getActiveDealForProduct(...)
  // async => null;` stub in an earlier C3 pass; no canonical deals backend exists yet.

  // ============ Copy With ============

  DealModel copyWith({
    String? id,
    String? sellerId,
    String? productId,
    String? title,
    String? description,
    DealDiscountType? discountType,
    double? discountValue,
    double? maxDiscountAmount,
    double? originalPrice,
    double? dealPrice,
    DateTime? startDate,
    DateTime? endDate,
    int? stockLimit,
    int? stockSold,
    DealStatus? status,
    String? rejectionReason,
    DateTime? approvedAt,
    String? approvedBy,
    String? productName,
    String? productImage,
    String? sellerName,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DealModel(
      id: id ?? this.id,
      sellerId: sellerId ?? this.sellerId,
      productId: productId ?? this.productId,
      title: title ?? this.title,
      description: description ?? this.description,
      discountType: discountType ?? this.discountType,
      discountValue: discountValue ?? this.discountValue,
      maxDiscountAmount: maxDiscountAmount ?? this.maxDiscountAmount,
      originalPrice: originalPrice ?? this.originalPrice,
      dealPrice: dealPrice ?? this.dealPrice,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      stockLimit: stockLimit ?? this.stockLimit,
      stockSold: stockSold ?? this.stockSold,
      status: status ?? this.status,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      approvedAt: approvedAt ?? this.approvedAt,
      approvedBy: approvedBy ?? this.approvedBy,
      productName: productName ?? this.productName,
      productImage: productImage ?? this.productImage,
      sellerName: sellerName ?? this.sellerName,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() {
    return 'DealModel(id: $id, title: $title, status: $status, discountLabel: $discountLabel)';
  }
}
