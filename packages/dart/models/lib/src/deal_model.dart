// Deal Model - For seller promotional deals
import 'package:cloud_firestore/cloud_firestore.dart';

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

  // ============ Factory Methods ============

  factory DealModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DealModel.fromMap(data, doc.id);
  }

  factory DealModel.fromMap(Map<String, dynamic> data, String id) {
    return DealModel(
      id: id,
      sellerId: data['sellerId'] ?? '',
      productId: data['productId'] ?? '',
      title: data['title'] ?? 'Special Deal',
      description: data['description'],
      discountType: _parseDiscountType(data['discountType']),
      discountValue: _parseDouble(data['discountValue']),
      maxDiscountAmount: data['maxDiscountAmount'] != null 
          ? _parseDouble(data['maxDiscountAmount']) 
          : null,
      originalPrice: _parseDouble(data['originalPrice']),
      dealPrice: _parseDouble(data['dealPrice']),
      startDate: _parseDateTime(data['startDate']) ?? DateTime.now(),
      endDate: _parseDateTime(data['endDate']) ?? DateTime.now().add(const Duration(days: 1)),
      stockLimit: data['stockLimit'] as int?,
      stockSold: data['stockSold'] as int? ?? 0,
      status: _parseStatus(data['status']),
      rejectionReason: data['rejectionReason'],
      approvedAt: _parseDateTime(data['approvedAt']),
      approvedBy: data['approvedBy'],
      productName: data['productName'] ?? '',
      productImage: data['productImage'] ?? '',
      sellerName: data['sellerName'] ?? '',
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDateTime(data['updatedAt']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'sellerId': sellerId,
      'productId': productId,
      'title': title,
      'description': description,
      'discountType': discountType.name,
      'discountValue': discountValue,
      'maxDiscountAmount': maxDiscountAmount,
      'originalPrice': originalPrice,
      'dealPrice': dealPrice,
      'startDate': Timestamp.fromDate(startDate),
      'endDate': Timestamp.fromDate(endDate),
      'stockLimit': stockLimit,
      'stockSold': stockSold,
      'status': status.name,
      'rejectionReason': rejectionReason,
      'approvedAt': approvedAt != null ? Timestamp.fromDate(approvedAt!) : null,
      'approvedBy': approvedBy,
      'productName': productName,
      'productImage': productImage,
      'sellerName': sellerName,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : null,
    };
  }

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

  // ============ Parsing Helpers ============

  static DealStatus _parseStatus(dynamic value) {
    if (value == null) return DealStatus.pending;
    final str = value.toString().toLowerCase();
    return DealStatus.values.firstWhere(
      (s) => s.name.toLowerCase() == str,
      orElse: () => DealStatus.pending,
    );
  }

  static DealDiscountType _parseDiscountType(dynamic value) {
    if (value == null) return DealDiscountType.percentage;
    final str = value.toString().toLowerCase();
    return DealDiscountType.values.firstWhere(
      (s) => s.name.toLowerCase() == str,
      orElse: () => DealDiscountType.percentage,
    );
  }

  static double _parseDouble(dynamic value, [double defaultValue = 0.0]) {
    if (value == null) return defaultValue;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? defaultValue;
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }

  @override
  String toString() {
    return 'DealModel(id: $id, title: $title, status: $status, discountLabel: $discountLabel)';
  }
}
