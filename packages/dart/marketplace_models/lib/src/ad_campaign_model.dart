import 'package:cloud_firestore/cloud_firestore.dart';

/// Campaign status enum
enum CampaignStatus {
  draft,
  pendingReview,
  active,
  paused,
  exhausted,
  rejected,
  ended,
}

/// Campaign targeting type
enum CampaignTargetType {
  keywords,
  category,
  auto,
}

/// Ad type - determines where and how ads are shown
enum AdType {
  sponsoredProduct,  // Phase 1: Product ads in search/category
  keywordSearch,     // Phase 1: Keyword targeted search ads
  categoryBoost,     // Phase 2: Category page top positions
  reelsBoost,        // Phase 2: Promoted reels in feed
  brandStore,        // Phase 3: Store/brand promotion
  homeBanner,        // Phase 3: Homepage banner ads
  retargeting,       // Phase 3: Intent-based retargeting
}

/// Billing model for the campaign
enum BillingType {
  cpc,   // Cost per click (default)
  cpv,   // Cost per view (3-sec for reels)
  cpm,   // Cost per 1000 impressions
  fixed, // Fixed daily/weekly slot pricing
}


/// Ad Campaign Model for Sponsored Products
class AdCampaignModel {
  final String id;
  final String sellerId;
  final String name;
  final CampaignStatus status;
  final CampaignTargetType targetType;
  final AdType adType;              // NEW: Type of ad campaign
  final BillingType billingType;    // NEW: CPC, CPV, CPM, or Fixed
  final double dailyBudget;
  final double totalBudget;
  final double spentToday;
  final double spentTotal;
  final double bidAmount;           // NEW: Default bid for this campaign
  final double? minBid;
  final double? maxBid;
  final List<String> keywords;
  final String? categoryId;
  final DateTime startDate;
  final DateTime? endDate;
  final String? rejectionReason;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final DateTime? reviewedAt;
  final String? reviewedBy;
  
  // Phase 3: Banner-specific fields
  final String? bannerImageUrl;
  final String? bannerLinkUrl;
  final int? bannerPosition;

  // Computed stats
  final int impressions;
  final int clicks;
  final int conversions;

  AdCampaignModel({
    required this.id,
    required this.sellerId,
    required this.name,
    required this.status,
    required this.targetType,
    this.adType = AdType.sponsoredProduct,
    this.billingType = BillingType.cpc,
    required this.dailyBudget,
    required this.totalBudget,
    this.spentToday = 0.0,
    this.spentTotal = 0.0,
    this.bidAmount = 2.0,
    this.minBid,
    this.maxBid,
    this.keywords = const [],
    this.categoryId,
    required this.startDate,
    this.endDate,
    this.rejectionReason,
    required this.createdAt,
    this.updatedAt,
    this.reviewedAt,
    this.reviewedBy,
    this.bannerImageUrl,
    this.bannerLinkUrl,
    this.bannerPosition,
    this.impressions = 0,
    this.clicks = 0,
    this.conversions = 0,
  });

  /// Minimum CPC allowed (platform-wide default)
  static const double minCPC = 0.5;

  /// Get recommended CPC range based on ad type
  static Map<String, double> getCpcRange(AdType type) {
    switch (type) {
      case AdType.sponsoredProduct:
        return {'min': 2.0, 'max': 15.0};
      case AdType.keywordSearch:
        return {'min': 3.0, 'max': 25.0};
      case AdType.categoryBoost:
        return {'min': 4.0, 'max': 25.0};
      case AdType.reelsBoost:
        return {'min': 0.2, 'max': 10.0}; // CPV range
      case AdType.brandStore:
        return {'min': 8.0, 'max': 60.0};
      case AdType.homeBanner:
        return {'min': 150.0, 'max': 25000.0}; // CPM/Fixed range
      case AdType.retargeting:
        return {'min': 4.0, 'max': 15.0};
    }
  }

  /// Check if campaign can serve ads
  bool get canServeAds =>
      status == CampaignStatus.active &&
      spentToday < dailyBudget &&
      spentTotal < totalBudget &&
      (endDate == null || DateTime.now().isBefore(endDate!));

  /// Calculate CTR (Click Through Rate)
  double get ctr => impressions > 0 ? (clicks / impressions) * 100 : 0.0;

  /// Calculate ACOS (Advertising Cost of Sales)
  double calculateAcos(double salesFromAds) =>
      salesFromAds > 0 ? (spentTotal / salesFromAds) * 100 : 0.0;

  /// Remaining daily budget
  double get remainingDailyBudget => (dailyBudget - spentToday).clamp(0, dailyBudget);

  /// Remaining total budget
  double get remainingTotalBudget => (totalBudget - spentTotal).clamp(0, totalBudget);

  factory AdCampaignModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return AdCampaignModel.fromMap(data, doc.id);
  }

  factory AdCampaignModel.fromMap(Map<String, dynamic> data, String id) {
    return AdCampaignModel(
      id: id,
      sellerId: (data['sellerId'] ?? '').toString(),
      name: (data['name'] ?? 'Untitled Campaign').toString(),
      status: _parseStatus(data['status']),
      targetType: _parseTargetType(data['targetType']),
      adType: _parseAdType(data['adType']),
      billingType: _parseBillingType(data['billingType']),
      dailyBudget: _parseDouble(data['dailyBudget']),
      totalBudget: _parseDouble(data['totalBudget']),
      spentToday: _parseDouble(data['spentToday']),
      spentTotal: _parseDouble(data['spentTotal']),
      bidAmount: _parseDouble(data['bidAmount'], defaultValue: 2.0),
      minBid: data['minBid'] != null ? _parseDouble(data['minBid']) : null,
      maxBid: data['maxBid'] != null ? _parseDouble(data['maxBid']) : null,
      keywords: _parseStringList(data['keywords']),
      categoryId: data['categoryId']?.toString(),
      startDate: _parseDateTime(data['startDate']) ?? DateTime.now(),
      endDate: _parseDateTime(data['endDate']),
      rejectionReason: data['rejectionReason']?.toString(),
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDateTime(data['updatedAt']),
      reviewedAt: _parseDateTime(data['reviewedAt']),
      reviewedBy: data['reviewedBy']?.toString(),
      bannerImageUrl: data['bannerImageUrl']?.toString(),
      bannerLinkUrl: data['bannerLinkUrl']?.toString(),
      bannerPosition: data['bannerPosition'] as int?,
      impressions: _parseInt(data['impressions']),
      clicks: _parseInt(data['clicks']),
      conversions: _parseInt(data['conversions']),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'sellerId': sellerId,
      'name': name,
      'status': status.name,
      'targetType': targetType.name,
      'adType': adType.name,
      'billingType': billingType.name,
      'dailyBudget': dailyBudget,
      'totalBudget': totalBudget,
      'spentToday': spentToday,
      'spentTotal': spentTotal,
      'bidAmount': bidAmount,
      'minBid': minBid,
      'maxBid': maxBid,
      'keywords': keywords,
      'categoryId': categoryId,
      'startDate': Timestamp.fromDate(startDate),
      'endDate': endDate != null ? Timestamp.fromDate(endDate!) : null,
      'rejectionReason': rejectionReason,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : FieldValue.serverTimestamp(),
      'reviewedAt': reviewedAt != null ? Timestamp.fromDate(reviewedAt!) : null,
      'reviewedBy': reviewedBy,
    };
  }

  AdCampaignModel copyWith({
    String? id,
    String? sellerId,
    String? name,
    CampaignStatus? status,
    CampaignTargetType? targetType,
    AdType? adType,
    BillingType? billingType,
    double? dailyBudget,
    double? totalBudget,
    double? spentToday,
    double? spentTotal,
    double? bidAmount,
    double? minBid,
    double? maxBid,
    List<String>? keywords,
    String? categoryId,
    DateTime? startDate,
    DateTime? endDate,
    String? rejectionReason,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? reviewedAt,
    String? reviewedBy,
    int? impressions,
    int? clicks,
    int? conversions,
  }) {
    return AdCampaignModel(
      id: id ?? this.id,
      sellerId: sellerId ?? this.sellerId,
      name: name ?? this.name,
      status: status ?? this.status,
      targetType: targetType ?? this.targetType,
      adType: adType ?? this.adType,
      billingType: billingType ?? this.billingType,
      dailyBudget: dailyBudget ?? this.dailyBudget,
      totalBudget: totalBudget ?? this.totalBudget,
      spentToday: spentToday ?? this.spentToday,
      spentTotal: spentTotal ?? this.spentTotal,
      bidAmount: bidAmount ?? this.bidAmount,
      minBid: minBid ?? this.minBid,
      maxBid: maxBid ?? this.maxBid,
      keywords: keywords ?? this.keywords,
      categoryId: categoryId ?? this.categoryId,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      reviewedAt: reviewedAt ?? this.reviewedAt,
      reviewedBy: reviewedBy ?? this.reviewedBy,
      impressions: impressions ?? this.impressions,
      clicks: clicks ?? this.clicks,
      conversions: conversions ?? this.conversions,
    );
  }

  // ============ Parsing Helpers ============

  static CampaignStatus _parseStatus(dynamic value) {
    if (value == null) return CampaignStatus.draft;
    final str = value.toString().toLowerCase();
    return CampaignStatus.values.firstWhere(
      (s) => s.name.toLowerCase() == str,
      orElse: () => CampaignStatus.draft,
    );
  }

  static CampaignTargetType _parseTargetType(dynamic value) {
    if (value == null) return CampaignTargetType.auto;
    final str = value.toString().toLowerCase();
    return CampaignTargetType.values.firstWhere(
      (t) => t.name.toLowerCase() == str,
      orElse: () => CampaignTargetType.auto,
    );
  }

  static double _parseDouble(dynamic value, {double defaultValue = 0.0}) {
    if (value == null) return defaultValue;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? defaultValue;
  }

  static AdType _parseAdType(dynamic value) {
    if (value == null) return AdType.sponsoredProduct;
    final str = value.toString();
    return AdType.values.firstWhere(
      (t) => t.name.toLowerCase() == str.toLowerCase(),
      orElse: () => AdType.sponsoredProduct,
    );
  }

  static BillingType _parseBillingType(dynamic value) {
    if (value == null) return BillingType.cpc;
    final str = value.toString();
    return BillingType.values.firstWhere(
      (t) => t.name.toLowerCase() == str.toLowerCase(),
      orElse: () => BillingType.cpc,
    );
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

  static List<String> _parseStringList(dynamic value) {
    if (value == null) return [];
    if (value is List) return value.map((e) => e.toString()).toList();
    return [];
  }
}

/// Data class for boosted reel information (Phase 2: Reels Boost)
class BoostedReelData {
  final String reelId;
  final String campaignId;
  final String adProductId;
  final String sellerId;
  final double bidAmount;
  final BillingType billingType;

  BoostedReelData({
    required this.reelId,
    required this.campaignId,
    required this.adProductId,
    required this.sellerId,
    required this.bidAmount,
    required this.billingType,
  });

  /// Get cost per view for CPV billing
  double get costPerView => billingType == BillingType.cpv ? bidAmount : 0.0;
}

/// Phase 3: Banner ad data for homepage placement
class BannerAdData {
  final String campaignId;
  final String sellerId;
  final String imageUrl;
  final String? linkUrl;
  final int position;
  final BillingType billingType;
  final double bidAmount;

  BannerAdData({
    required this.campaignId,
    required this.sellerId,
    required this.imageUrl,
    this.linkUrl,
    required this.position,
    required this.billingType,
    required this.bidAmount,
  });
}

/// Phase 3: Brand store spotlight data
class BrandStoreAdData {
  final String campaignId;
  final String sellerId;
  final String storeName;
  final String? logoUrl;
  final double bidAmount;

  BrandStoreAdData({
    required this.campaignId,
    required this.sellerId,
    required this.storeName,
    this.logoUrl,
    required this.bidAmount,
  });
}

/// Phase 3: User intent types for retargeting
enum UserIntentType {
  view,      // Viewed product
  wishlist,  // Added to wishlist
  cart,      // Added to cart
  purchase,  // Purchased (for similar recommendations)
}
