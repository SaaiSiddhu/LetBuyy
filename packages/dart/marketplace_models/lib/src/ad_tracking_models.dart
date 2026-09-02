import 'package:cloud_firestore/cloud_firestore.dart';

/// Placement where ad was shown/clicked
enum AdPlacement {
  search,
  category,
  productPage,
  home,
  cart,
  reels,  // Phase 2: Reels Boost placement
}

/// Ad Impression Model - Tracks when an ad is shown
class AdImpressionModel {
  final String id;
  final String adProductId;
  final String campaignId;
  final String sellerId;
  final String? userId; // Can be null for guest users
  final AdPlacement placement;
  final String? searchQuery; // If placement is search
  final String? categoryId; // If placement is category
  final DateTime timestamp;

  AdImpressionModel({
    required this.id,
    required this.adProductId,
    required this.campaignId,
    required this.sellerId,
    this.userId,
    required this.placement,
    this.searchQuery,
    this.categoryId,
    required this.timestamp,
  });

  factory AdImpressionModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return AdImpressionModel.fromMap(data, doc.id);
  }

  factory AdImpressionModel.fromMap(Map<String, dynamic> data, String id) {
    return AdImpressionModel(
      id: id,
      adProductId: (data['adProductId'] ?? '').toString(),
      campaignId: (data['campaignId'] ?? '').toString(),
      sellerId: (data['sellerId'] ?? '').toString(),
      userId: data['userId']?.toString(),
      placement: _parsePlacement(data['placement']),
      searchQuery: data['searchQuery']?.toString(),
      categoryId: data['categoryId']?.toString(),
      timestamp: _parseDateTime(data['timestamp']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'adProductId': adProductId,
      'campaignId': campaignId,
      'sellerId': sellerId,
      'userId': userId,
      'placement': placement.name,
      'searchQuery': searchQuery,
      'categoryId': categoryId,
      'timestamp': FieldValue.serverTimestamp(),
    };
  }

  static AdPlacement _parsePlacement(dynamic value) {
    if (value == null) return AdPlacement.search;
    final str = value.toString().toLowerCase();
    return AdPlacement.values.firstWhere(
      (p) => p.name.toLowerCase() == str,
      orElse: () => AdPlacement.search,
    );
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}

/// Ad Click Model - Tracks when a user clicks an ad (billable event)
class AdClickModel {
  final String id;
  final String adProductId;
  final String campaignId;
  final String sellerId;
  final String productId;
  final String? userId;
  final double costPerClick; // Actual CPC charged
  final AdPlacement placement;
  final String? searchQuery;
  final bool converted; // Did user purchase?
  final double? conversionValue; // Order value if converted
  final DateTime timestamp;
  final DateTime? conversionAt;

  AdClickModel({
    required this.id,
    required this.adProductId,
    required this.campaignId,
    required this.sellerId,
    required this.productId,
    this.userId,
    required this.costPerClick,
    required this.placement,
    this.searchQuery,
    this.converted = false,
    this.conversionValue,
    required this.timestamp,
    this.conversionAt,
  });

  factory AdClickModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return AdClickModel.fromMap(data, doc.id);
  }

  factory AdClickModel.fromMap(Map<String, dynamic> data, String id) {
    return AdClickModel(
      id: id,
      adProductId: (data['adProductId'] ?? '').toString(),
      campaignId: (data['campaignId'] ?? '').toString(),
      sellerId: (data['sellerId'] ?? '').toString(),
      productId: (data['productId'] ?? '').toString(),
      userId: data['userId']?.toString(),
      costPerClick: _parseDouble(data['costPerClick']),
      placement: _parsePlacement(data['placement']),
      searchQuery: data['searchQuery']?.toString(),
      converted: data['converted'] as bool? ?? false,
      conversionValue: data['conversionValue'] != null 
          ? _parseDouble(data['conversionValue']) 
          : null,
      timestamp: _parseDateTime(data['timestamp']) ?? DateTime.now(),
      conversionAt: _parseDateTime(data['conversionAt']),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'adProductId': adProductId,
      'campaignId': campaignId,
      'sellerId': sellerId,
      'productId': productId,
      'userId': userId,
      'costPerClick': costPerClick,
      'placement': placement.name,
      'searchQuery': searchQuery,
      'converted': converted,
      'conversionValue': conversionValue,
      'timestamp': FieldValue.serverTimestamp(),
      'conversionAt': conversionAt != null 
          ? Timestamp.fromDate(conversionAt!) 
          : null,
    };
  }

  AdClickModel copyWith({
    bool? converted,
    double? conversionValue,
    DateTime? conversionAt,
  }) {
    return AdClickModel(
      id: id,
      adProductId: adProductId,
      campaignId: campaignId,
      sellerId: sellerId,
      productId: productId,
      userId: userId,
      costPerClick: costPerClick,
      placement: placement,
      searchQuery: searchQuery,
      converted: converted ?? this.converted,
      conversionValue: conversionValue ?? this.conversionValue,
      timestamp: timestamp,
      conversionAt: conversionAt ?? this.conversionAt,
    );
  }

  static AdPlacement _parsePlacement(dynamic value) {
    if (value == null) return AdPlacement.search;
    final str = value.toString().toLowerCase();
    return AdPlacement.values.firstWhere(
      (p) => p.name.toLowerCase() == str,
      orElse: () => AdPlacement.search,
    );
  }

  static double _parseDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}
