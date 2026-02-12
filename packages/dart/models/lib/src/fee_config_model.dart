import 'package:cloud_firestore/cloud_firestore.dart';

/// Admin-controlled fee configuration for the platform
/// Stored in Firestore: delivery_settings/fees
class FeeConfigModel {
  // ============================================
  // ORDER FEES
  // ============================================
  
  /// Fixed platform fee per order (₹)
  final double platformFee;
  
  /// Markup percentage on courier delivery rate
  final double deliveryFeeMarkup;
  
  /// COD handling fee (₹)
  final double codFee;
  
  /// Payment gateway fee percentage
  final double paymentGatewayFeePercent;

  // ============================================
  // RTO & PENALTY FEES
  // ============================================
  
  /// RTO fee for refused delivery (% of forward shipping)
  /// Default 200 = 2× forward shipping
  final double rtoRefusedPercent;
  
  /// RTO fee for customer return (% of forward shipping)
  /// Default 100 = 1× forward shipping  
  final double rtoReturnPercent;
  
  /// Quality penalty for defective product returns (₹)
  final double qualityPenalty;

  // ============================================
  // DELIVERY SETTINGS
  // ============================================
  
  /// Enable free delivery for all orders
  final bool freeDeliveryEnabled;
  
  /// Minimum order value for free delivery (₹)
  final double freeDeliveryThreshold;
  
  /// Maximum delivery days promise
  final int maxDeliveryDays;
  
  /// Seller pickup SLA in hours
  final int sellerPickupSLA;
  
  /// Enable COD orders
  final bool codEnabled;
  
  /// Blocked pincodes (non-serviceable)
  final List<String> blockedPincodes;

  // ============================================
  // SETTLEMENT SETTINGS
  // ============================================
  
  /// Days to hold payment after delivery
  final int settlementHoldDays;
  
  /// Payout day of week (1=Monday, 7=Sunday)
  final int payoutDayOfWeek;

  final DateTime? updatedAt;
  final String? updatedBy;

  FeeConfigModel({
    this.platformFee = 20.0,
    this.deliveryFeeMarkup = 0.0,
    this.codFee = 40.0,
    this.paymentGatewayFeePercent = 2.0,
    this.rtoRefusedPercent = 200.0,
    this.rtoReturnPercent = 100.0,
    this.qualityPenalty = 50.0,
    this.freeDeliveryEnabled = true,
    this.freeDeliveryThreshold = 0.0,
    this.maxDeliveryDays = 7,
    this.sellerPickupSLA = 24,
    this.codEnabled = true,
    this.blockedPincodes = const [],
    this.settlementHoldDays = 7,
    this.payoutDayOfWeek = 1,
    this.updatedAt,
    this.updatedBy,
  });

  // ============================================
  // FROM MAP
  // ============================================
  factory FeeConfigModel.fromMap(Map<String, dynamic> map) {
    return FeeConfigModel(
      platformFee: (map['platformFee'] as num?)?.toDouble() ?? 20.0,
      deliveryFeeMarkup: (map['deliveryFeeMarkup'] as num?)?.toDouble() ?? 0.0,
      codFee: (map['codFee'] as num?)?.toDouble() ?? 40.0,
      paymentGatewayFeePercent: (map['paymentGatewayFeePercent'] as num?)?.toDouble() ?? 2.0,
      rtoRefusedPercent: (map['rtoRefusedPercent'] as num?)?.toDouble() ?? 200.0,
      rtoReturnPercent: (map['rtoReturnPercent'] as num?)?.toDouble() ?? 100.0,
      qualityPenalty: (map['qualityPenalty'] as num?)?.toDouble() ?? 50.0,
      freeDeliveryEnabled: map['freeDeliveryEnabled'] ?? true,
      freeDeliveryThreshold: (map['freeDeliveryThreshold'] as num?)?.toDouble() ?? 0.0,
      maxDeliveryDays: (map['maxDeliveryDays'] as num?)?.toInt() ?? 7,
      sellerPickupSLA: (map['sellerPickupSLA'] as num?)?.toInt() ?? 24,
      codEnabled: map['codEnabled'] ?? true,
      blockedPincodes: List<String>.from(map['blockedPincodes'] ?? []),
      settlementHoldDays: (map['settlementHoldDays'] as num?)?.toInt() ?? 7,
      payoutDayOfWeek: (map['payoutDayOfWeek'] as num?)?.toInt() ?? 1,
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate(),
      updatedBy: map['updatedBy'],
    );
  }

  // ============================================
  // TO MAP
  // ============================================
  Map<String, dynamic> toMap() {
    return {
      'platformFee': platformFee,
      'deliveryFeeMarkup': deliveryFeeMarkup,
      'codFee': codFee,
      'paymentGatewayFeePercent': paymentGatewayFeePercent,
      'rtoRefusedPercent': rtoRefusedPercent,
      'rtoReturnPercent': rtoReturnPercent,
      'qualityPenalty': qualityPenalty,
      'freeDeliveryEnabled': freeDeliveryEnabled,
      'freeDeliveryThreshold': freeDeliveryThreshold,
      'maxDeliveryDays': maxDeliveryDays,
      'sellerPickupSLA': sellerPickupSLA,
      'codEnabled': codEnabled,
      'blockedPincodes': blockedPincodes,
      'settlementHoldDays': settlementHoldDays,
      'payoutDayOfWeek': payoutDayOfWeek,
      'updatedAt': FieldValue.serverTimestamp(),
      'updatedBy': updatedBy,
    };
  }

  // ============================================
  // FEE CALCULATIONS
  // ============================================
  
  /// Calculate delivery fee with markup
  double calculateDeliveryFee(double courierRate) {
    return courierRate * (1 + deliveryFeeMarkup / 100);
  }
  
  /// Calculate payment gateway fee
  double calculatePGFee(double paymentAmount) {
    return paymentAmount * (paymentGatewayFeePercent / 100);
  }
  
  /// Calculate RTO fee for refused delivery
  double calculateRTORefusedFee(double forwardShipping) {
    return forwardShipping * (rtoRefusedPercent / 100);
  }
  
  /// Calculate RTO fee for customer return
  double calculateRTOReturnFee(double forwardShipping) {
    return forwardShipping * (rtoReturnPercent / 100);
  }
  
  /// Calculate total defective return fee (return shipping + penalty)
  double calculateDefectiveReturnFee(double forwardShipping) {
    return forwardShipping + qualityPenalty;
  }

  /// Check if pincode is blocked
  bool isPincodeBlocked(String pincode) {
    return blockedPincodes.contains(pincode);
  }

  /// Check if order qualifies for free delivery
  bool qualifiesForFreeDelivery(double orderTotal) {
    if (!freeDeliveryEnabled) return false;
    return orderTotal >= freeDeliveryThreshold;
  }

  // ============================================
  // COPY WITH
  // ============================================
  FeeConfigModel copyWith({
    double? platformFee,
    double? deliveryFeeMarkup,
    double? codFee,
    double? paymentGatewayFeePercent,
    double? rtoRefusedPercent,
    double? rtoReturnPercent,
    double? qualityPenalty,
    bool? freeDeliveryEnabled,
    double? freeDeliveryThreshold,
    int? maxDeliveryDays,
    int? sellerPickupSLA,
    bool? codEnabled,
    List<String>? blockedPincodes,
    int? settlementHoldDays,
    int? payoutDayOfWeek,
    DateTime? updatedAt,
    String? updatedBy,
  }) {
    return FeeConfigModel(
      platformFee: platformFee ?? this.platformFee,
      deliveryFeeMarkup: deliveryFeeMarkup ?? this.deliveryFeeMarkup,
      codFee: codFee ?? this.codFee,
      paymentGatewayFeePercent: paymentGatewayFeePercent ?? this.paymentGatewayFeePercent,
      rtoRefusedPercent: rtoRefusedPercent ?? this.rtoRefusedPercent,
      rtoReturnPercent: rtoReturnPercent ?? this.rtoReturnPercent,
      qualityPenalty: qualityPenalty ?? this.qualityPenalty,
      freeDeliveryEnabled: freeDeliveryEnabled ?? this.freeDeliveryEnabled,
      freeDeliveryThreshold: freeDeliveryThreshold ?? this.freeDeliveryThreshold,
      maxDeliveryDays: maxDeliveryDays ?? this.maxDeliveryDays,
      sellerPickupSLA: sellerPickupSLA ?? this.sellerPickupSLA,
      codEnabled: codEnabled ?? this.codEnabled,
      blockedPincodes: blockedPincodes ?? this.blockedPincodes,
      settlementHoldDays: settlementHoldDays ?? this.settlementHoldDays,
      payoutDayOfWeek: payoutDayOfWeek ?? this.payoutDayOfWeek,
      updatedAt: updatedAt ?? this.updatedAt,
      updatedBy: updatedBy ?? this.updatedBy,
    );
  }

  /// Create default configuration
  static FeeConfigModel get defaults => FeeConfigModel();
}
