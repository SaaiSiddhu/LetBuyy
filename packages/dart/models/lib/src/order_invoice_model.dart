import 'package:cloud_firestore/cloud_firestore.dart';

/// Invoice status for order settlements
enum InvoiceStatus {
  pending,    // Order delivered, waiting for hold period
  processing, // Hold period ended, processing payout
  paid,       // Seller has been paid
  onHold,     // Manually held by admin
}

/// Individual item commission breakdown
class ItemCommission {
  final String productId;
  final String productName;
  final double salePrice;
  final int quantity;
  final double categoryPercent;  // Base category commission %
  final double tierModifier;     // Seller tier adjustment (can be negative)
  final double finalPercent;     // Applied commission %
  final double commissionAmount; // Actual ₹ deducted

  ItemCommission({
    required this.productId,
    required this.productName,
    required this.salePrice,
    required this.quantity,
    required this.categoryPercent,
    required this.tierModifier,
    required this.finalPercent,
    required this.commissionAmount,
  });

  /// Calculate subtotal for this item
  double get subtotal => salePrice * quantity;

  factory ItemCommission.fromMap(Map<String, dynamic> map) {
    return ItemCommission(
      productId: map['productId'] ?? '',
      productName: map['productName'] ?? '',
      salePrice: (map['salePrice'] as num?)?.toDouble() ?? 0.0,
      quantity: (map['quantity'] as num?)?.toInt() ?? 1,
      categoryPercent: (map['categoryPercent'] as num?)?.toDouble() ?? 0.0,
      tierModifier: (map['tierModifier'] as num?)?.toDouble() ?? 0.0,
      finalPercent: (map['finalPercent'] as num?)?.toDouble() ?? 0.0,
      commissionAmount: (map['commissionAmount'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'productId': productId,
      'productName': productName,
      'salePrice': salePrice,
      'quantity': quantity,
      'categoryPercent': categoryPercent,
      'tierModifier': tierModifier,
      'finalPercent': finalPercent,
      'commissionAmount': commissionAmount,
    };
  }
}


/// Complete order invoice with all fee breakdowns
/// Stored in: orders/{orderId}/invoice
class OrderInvoiceModel {
  final String orderId;
  final String sellerId;
  
  // ============================================
  // ORDER AMOUNTS
  // ============================================
  
  /// Total order value (what customer paid)
  final double orderTotal;
  
  /// Subtotal of items (before discounts)
  final double itemsSubtotal;
  
  /// Discount amount applied
  final double discountAmount;

  // ============================================
  // DEDUCTIONS
  // ============================================
  
  /// Fixed platform fee per order
  final double platformFee;
  
  /// Per-item commission breakdown
  final List<ItemCommission> itemCommissions;
  
  /// Total commission from all items
  final double totalCommission;
  
  /// Delivery fee (actual courier cost)
  final double deliveryFee;
  
  /// COD fee (if COD order)
  final double codFee;
  
  /// Payment gateway fee (if online payment)
  final double paymentGatewayFee;

  // ============================================
  // RTO DEDUCTIONS (if applicable)
  // ============================================
  
  /// RTO fee if order was returned/refused
  final double rtoFee;
  
  /// Quality penalty if defective return
  final double qualityPenalty;
  
  /// Reason for RTO charge
  final String? rtoReason;

  // ============================================
  // SETTLEMENT
  // ============================================
  
  /// Total deductions
  double get totalDeductions => 
      platformFee + 
      totalCommission + 
      deliveryFee + 
      codFee + 
      paymentGatewayFee + 
      rtoFee + 
      qualityPenalty;

  /// Net amount seller receives
  double get netPayout => orderTotal - totalDeductions;
  
  /// Invoice status
  final InvoiceStatus status;
  
  /// When payout will be released
  final DateTime? releaseDate;
  
  /// When payout was made
  final DateTime? paidAt;
  
  /// Payout transaction reference
  final String? payoutReference;

  final DateTime createdAt;
  final DateTime updatedAt;

  OrderInvoiceModel({
    required this.orderId,
    required this.sellerId,
    required this.orderTotal,
    required this.itemsSubtotal,
    this.discountAmount = 0.0,
    required this.platformFee,
    required this.itemCommissions,
    required this.totalCommission,
    required this.deliveryFee,
    this.codFee = 0.0,
    this.paymentGatewayFee = 0.0,
    this.rtoFee = 0.0,
    this.qualityPenalty = 0.0,
    this.rtoReason,
    this.status = InvoiceStatus.pending,
    this.releaseDate,
    this.paidAt,
    this.payoutReference,
    required this.createdAt,
    required this.updatedAt,
  });

  // ============================================
  // HELPERS
  // ============================================
  
  /// Check if this invoice has RTO charges
  bool get hasRTOCharges => rtoFee > 0 || qualityPenalty > 0;
  
  /// Check if COD order
  bool get isCOD => codFee > 0;
  
  /// Check if payout is ready
  bool get isPayoutReady => 
      status == InvoiceStatus.pending && 
      releaseDate != null && 
      DateTime.now().isAfter(releaseDate!);

  /// Get status display text
  String get statusDisplay {
    switch (status) {
      case InvoiceStatus.pending:
        return 'Hold';
      case InvoiceStatus.processing:
        return 'Processing';
      case InvoiceStatus.paid:
        return 'Paid';
      case InvoiceStatus.onHold:
        return 'On Hold';
    }
  }

  // ============================================
  // FROM MAP
  // ============================================
  factory OrderInvoiceModel.fromMap(Map<String, dynamic> map, String orderId) {
    return OrderInvoiceModel(
      orderId: orderId,
      sellerId: map['sellerId'] ?? '',
      orderTotal: (map['orderTotal'] as num?)?.toDouble() ?? 0.0,
      itemsSubtotal: (map['itemsSubtotal'] as num?)?.toDouble() ?? 0.0,
      discountAmount: (map['discountAmount'] as num?)?.toDouble() ?? 0.0,
      platformFee: (map['platformFee'] as num?)?.toDouble() ?? 0.0,
      itemCommissions: (map['itemCommissions'] as List? ?? [])
          .map((e) => ItemCommission.fromMap(e))
          .toList(),
      totalCommission: (map['totalCommission'] as num?)?.toDouble() ?? 0.0,
      deliveryFee: (map['deliveryFee'] as num?)?.toDouble() ?? 0.0,
      codFee: (map['codFee'] as num?)?.toDouble() ?? 0.0,
      paymentGatewayFee: (map['paymentGatewayFee'] as num?)?.toDouble() ?? 0.0,
      rtoFee: (map['rtoFee'] as num?)?.toDouble() ?? 0.0,
      qualityPenalty: (map['qualityPenalty'] as num?)?.toDouble() ?? 0.0,
      rtoReason: map['rtoReason'],
      status: _parseStatus(map['status']),
      releaseDate: (map['releaseDate'] as Timestamp?)?.toDate(),
      paidAt: (map['paidAt'] as Timestamp?)?.toDate(),
      payoutReference: map['payoutReference'],
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  static InvoiceStatus _parseStatus(dynamic value) {
    if (value == null) return InvoiceStatus.pending;
    final str = value.toString().toLowerCase();
    return InvoiceStatus.values.firstWhere(
      (s) => s.name.toLowerCase() == str,
      orElse: () => InvoiceStatus.pending,
    );
  }

  // ============================================
  // TO MAP
  // ============================================
  Map<String, dynamic> toMap() {
    return {
      'sellerId': sellerId,
      'orderTotal': orderTotal,
      'itemsSubtotal': itemsSubtotal,
      'discountAmount': discountAmount,
      'platformFee': platformFee,
      'itemCommissions': itemCommissions.map((e) => e.toMap()).toList(),
      'totalCommission': totalCommission,
      'deliveryFee': deliveryFee,
      'codFee': codFee,
      'paymentGatewayFee': paymentGatewayFee,
      'rtoFee': rtoFee,
      'qualityPenalty': qualityPenalty,
      'rtoReason': rtoReason,
      'netPayout': netPayout,
      'totalDeductions': totalDeductions,
      'status': status.name,
      'releaseDate': releaseDate != null ? Timestamp.fromDate(releaseDate!) : null,
      'paidAt': paidAt != null ? Timestamp.fromDate(paidAt!) : null,
      'payoutReference': payoutReference,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  // ============================================
  // COPY WITH
  // ============================================
  OrderInvoiceModel copyWith({
    double? rtoFee,
    double? qualityPenalty,
    String? rtoReason,
    InvoiceStatus? status,
    DateTime? releaseDate,
    DateTime? paidAt,
    String? payoutReference,
    DateTime? updatedAt,
  }) {
    return OrderInvoiceModel(
      orderId: orderId,
      sellerId: sellerId,
      orderTotal: orderTotal,
      itemsSubtotal: itemsSubtotal,
      discountAmount: discountAmount,
      platformFee: platformFee,
      itemCommissions: itemCommissions,
      totalCommission: totalCommission,
      deliveryFee: deliveryFee,
      codFee: codFee,
      paymentGatewayFee: paymentGatewayFee,
      rtoFee: rtoFee ?? this.rtoFee,
      qualityPenalty: qualityPenalty ?? this.qualityPenalty,
      rtoReason: rtoReason ?? this.rtoReason,
      status: status ?? this.status,
      releaseDate: releaseDate ?? this.releaseDate,
      paidAt: paidAt ?? this.paidAt,
      payoutReference: payoutReference ?? this.payoutReference,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
