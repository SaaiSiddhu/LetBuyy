import 'package:cloud_firestore/cloud_firestore.dart';

/// Keyword match type for search ads
enum KeywordMatchType {
  exact,  // Match exactly this keyword
  broad,  // Match related/similar keywords
}

/// Keyword Bid Model - Individual keyword bids within a campaign
/// Used for Phase 1 Keyword Search Ads
class KeywordBidModel {
  final String id;
  final String campaignId;
  final String sellerId;
  final String keyword;
  final KeywordMatchType matchType;
  final double bidAmount;       // CPC for this keyword
  final bool isActive;
  
  // Stats (denormalized for quick reads)
  final int impressions;
  final int clicks;
  final double spend;
  final DateTime createdAt;
  final DateTime? updatedAt;

  KeywordBidModel({
    required this.id,
    required this.campaignId,
    required this.sellerId,
    required this.keyword,
    this.matchType = KeywordMatchType.broad,
    required this.bidAmount,
    this.isActive = true,
    this.impressions = 0,
    this.clicks = 0,
    this.spend = 0.0,
    required this.createdAt,
    this.updatedAt,
  });

  /// Minimum bid for keywords
  static const double minBid = 3.0;

  /// Get CPC range based on keyword type
  static Map<String, double> getCpcRange(String keyword) {
    // Simple heuristic: longer keywords = lower competition
    final wordCount = keyword.split(' ').length;
    if (wordCount >= 3) {
      return {'min': 3.0, 'max': 5.0}; // Long-tail
    } else if (wordCount == 2) {
      return {'min': 6.0, 'max': 10.0}; // Medium
    } else {
      return {'min': 12.0, 'max': 25.0}; // High demand
    }
  }

  /// Calculate CTR
  double get ctr => impressions > 0 ? (clicks / impressions) * 100 : 0.0;

  factory KeywordBidModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return KeywordBidModel.fromMap(data, doc.id);
  }

  factory KeywordBidModel.fromMap(Map<String, dynamic> data, String id) {
    return KeywordBidModel(
      id: id,
      campaignId: (data['campaignId'] ?? '').toString(),
      sellerId: (data['sellerId'] ?? '').toString(),
      keyword: (data['keyword'] ?? '').toString(),
      matchType: _parseMatchType(data['matchType']),
      bidAmount: _parseDouble(data['bidAmount'], defaultValue: minBid),
      isActive: data['isActive'] as bool? ?? true,
      impressions: _parseInt(data['impressions']),
      clicks: _parseInt(data['clicks']),
      spend: _parseDouble(data['spend']),
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDateTime(data['updatedAt']),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'campaignId': campaignId,
      'sellerId': sellerId,
      'keyword': keyword,
      'matchType': matchType.name,
      'bidAmount': bidAmount,
      'isActive': isActive,
      'impressions': impressions,
      'clicks': clicks,
      'spend': spend,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  KeywordBidModel copyWith({
    String? id,
    String? campaignId,
    String? sellerId,
    String? keyword,
    KeywordMatchType? matchType,
    double? bidAmount,
    bool? isActive,
    int? impressions,
    int? clicks,
    double? spend,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return KeywordBidModel(
      id: id ?? this.id,
      campaignId: campaignId ?? this.campaignId,
      sellerId: sellerId ?? this.sellerId,
      keyword: keyword ?? this.keyword,
      matchType: matchType ?? this.matchType,
      bidAmount: bidAmount ?? this.bidAmount,
      isActive: isActive ?? this.isActive,
      impressions: impressions ?? this.impressions,
      clicks: clicks ?? this.clicks,
      spend: spend ?? this.spend,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  // ============ Parsing Helpers ============

  static KeywordMatchType _parseMatchType(dynamic value) {
    if (value == null) return KeywordMatchType.broad;
    final str = value.toString().toLowerCase();
    return KeywordMatchType.values.firstWhere(
      (t) => t.name.toLowerCase() == str,
      orElse: () => KeywordMatchType.broad,
    );
  }

  static double _parseDouble(dynamic value, {double defaultValue = 0.0}) {
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
