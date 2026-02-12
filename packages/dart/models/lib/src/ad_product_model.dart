import 'package:cloud_firestore/cloud_firestore.dart';

/// Status for individual ad products within a campaign
enum AdProductStatus {
  active,
  paused,
  outOfStock,
}

/// Ad Product Model - Links a product to a campaign with bid amount
class AdProductModel {
  final String id;
  final String campaignId;
  final String sellerId;
  final String productId;
  final double bidAmount; // ₹ per click (CPC)
  final AdProductStatus status;
  
  // Stats (denormalized for quick reads)
  final int impressions;
  final int clicks;
  final int conversions;
  final double spend;
  final double revenue; // Sales generated from ad clicks
  
  final DateTime createdAt;
  final DateTime? updatedAt;

  // Product info (denormalized for display)
  final String? productName;
  final String? productImage;
  final double? productPrice;

  AdProductModel({
    required this.id,
    required this.campaignId,
    required this.sellerId,
    required this.productId,
    required this.bidAmount,
    this.status = AdProductStatus.active,
    this.impressions = 0,
    this.clicks = 0,
    this.conversions = 0,
    this.spend = 0.0,
    this.revenue = 0.0,
    required this.createdAt,
    this.updatedAt,
    this.productName,
    this.productImage,
    this.productPrice,
  });

  /// Minimum bid amount
  static const double minBid = 0.5;

  /// Calculate CTR (Click Through Rate)
  double get ctr => impressions > 0 ? (clicks / impressions) * 100 : 0.0;

  /// Calculate conversion rate
  double get conversionRate => clicks > 0 ? (conversions / clicks) * 100 : 0.0;

  /// Calculate ROAS (Return on Ad Spend)
  double get roas => spend > 0 ? revenue / spend : 0.0;

  /// Calculate ACOS (Advertising Cost of Sales)
  double get acos => revenue > 0 ? (spend / revenue) * 100 : 0.0;

  factory AdProductModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return AdProductModel.fromMap(data, doc.id);
  }

  factory AdProductModel.fromMap(Map<String, dynamic> data, String id) {
    return AdProductModel(
      id: id,
      campaignId: (data['campaignId'] ?? '').toString(),
      sellerId: (data['sellerId'] ?? '').toString(),
      productId: (data['productId'] ?? '').toString(),
      bidAmount: _parseDouble(data['bidAmount'], minBid),
      status: _parseStatus(data['status']),
      impressions: _parseInt(data['impressions']),
      clicks: _parseInt(data['clicks']),
      conversions: _parseInt(data['conversions']),
      spend: _parseDouble(data['spend']),
      revenue: _parseDouble(data['revenue']),
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDateTime(data['updatedAt']),
      productName: data['productName']?.toString(),
      productImage: data['productImage']?.toString(),
      productPrice: data['productPrice'] != null ? _parseDouble(data['productPrice']) : null,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'campaignId': campaignId,
      'sellerId': sellerId,
      'productId': productId,
      'bidAmount': bidAmount,
      'status': status.name,
      'impressions': impressions,
      'clicks': clicks,
      'conversions': conversions,
      'spend': spend,
      'revenue': revenue,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': FieldValue.serverTimestamp(),
      'productName': productName,
      'productImage': productImage,
      'productPrice': productPrice,
    };
  }

  AdProductModel copyWith({
    String? id,
    String? campaignId,
    String? sellerId,
    String? productId,
    double? bidAmount,
    AdProductStatus? status,
    int? impressions,
    int? clicks,
    int? conversions,
    double? spend,
    double? revenue,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? productName,
    String? productImage,
    double? productPrice,
  }) {
    return AdProductModel(
      id: id ?? this.id,
      campaignId: campaignId ?? this.campaignId,
      sellerId: sellerId ?? this.sellerId,
      productId: productId ?? this.productId,
      bidAmount: bidAmount ?? this.bidAmount,
      status: status ?? this.status,
      impressions: impressions ?? this.impressions,
      clicks: clicks ?? this.clicks,
      conversions: conversions ?? this.conversions,
      spend: spend ?? this.spend,
      revenue: revenue ?? this.revenue,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      productName: productName ?? this.productName,
      productImage: productImage ?? this.productImage,
      productPrice: productPrice ?? this.productPrice,
    );
  }

  // ============ Parsing Helpers ============

  static AdProductStatus _parseStatus(dynamic value) {
    if (value == null) return AdProductStatus.active;
    final str = value.toString().toLowerCase();
    return AdProductStatus.values.firstWhere(
      (s) => s.name.toLowerCase() == str,
      orElse: () => AdProductStatus.active,
    );
  }

  static double _parseDouble(dynamic value, [double defaultValue = 0.0]) {
    if (value == null) return defaultValue;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? defaultValue;
  }

  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    return int.tryParse(value.toString()) ?? 0;
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}
