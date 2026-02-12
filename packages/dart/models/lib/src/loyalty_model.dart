// Loyalty Points System - Models
import 'package:cloud_firestore/cloud_firestore.dart';

/// Loyalty tier levels based on purchase history
enum LoyaltyTier {
  bronze,   // Default tier = 1% cashback
  silver,   // ≥₹5,000 in 6 months OR ≥10 orders = 1.5% cashback
  gold,     // ≥₹15,000 in 6 months OR ≥20 orders = 2.5% cashback
  platinum, // ≥₹35,000 in 6 months OR ≥30 orders = 3% cashback
  diamond,  // ≥₹75,000 in 3 months OR ≥₹1,00,000 in 6 months = 5% cashback
}

/// Extension for tier utilities
extension LoyaltyTierExtension on LoyaltyTier {
  /// Cashback percentage for this tier
  double get cashbackPercentage {
    switch (this) {
      case LoyaltyTier.bronze:
        return 1.0;
      case LoyaltyTier.silver:
        return 1.5;
      case LoyaltyTier.gold:
        return 2.5;
      case LoyaltyTier.platinum:
        return 3.0;
      case LoyaltyTier.diamond:
        return 5.0;
    }
  }

  /// Human-readable tier name
  String get displayName {
    switch (this) {
      case LoyaltyTier.bronze:
        return 'Bronze';
      case LoyaltyTier.silver:
        return 'Silver';
      case LoyaltyTier.gold:
        return 'Gold';
      case LoyaltyTier.platinum:
        return 'Platinum';
      case LoyaltyTier.diamond:
        return 'Diamond';
    }
  }

  /// Minimum orders required for this tier (alternative path)
  int get minOrders {
    switch (this) {
      case LoyaltyTier.bronze:
        return 0;
      case LoyaltyTier.silver:
        return 10;
      case LoyaltyTier.gold:
        return 20;
      case LoyaltyTier.platinum:
        return 30;
      case LoyaltyTier.diamond:
        return 0; // Diamond is spend-based only
    }
  }

  /// Minimum spend (INR) required for this tier
  double get minSpend {
    switch (this) {
      case LoyaltyTier.bronze:
        return 0;
      case LoyaltyTier.silver:
        return 5000;
      case LoyaltyTier.gold:
        return 15000;
      case LoyaltyTier.platinum:
        return 35000;
      case LoyaltyTier.diamond:
        return 75000;
    }
  }

  /// Max spend for tier (0 = unlimited)
  double get maxSpend {
    switch (this) {
      case LoyaltyTier.bronze:
        return 10000;
      case LoyaltyTier.silver:
        return 25000;
      case LoyaltyTier.gold:
        return 50000;
      case LoyaltyTier.platinum:
        return 100000;
      case LoyaltyTier.diamond:
        return 0; // unlimited
    }
  }

  /// Period in months for tier calculation
  int get periodMonths {
    switch (this) {
      case LoyaltyTier.bronze:
        return 12; // Calendar year
      case LoyaltyTier.silver:
      case LoyaltyTier.gold:
      case LoyaltyTier.platinum:
        return 6; // 6 months
      case LoyaltyTier.diamond:
        return 3; // 3 months
    }
  }

  /// Icon name for UI
  String get iconName {
    switch (this) {
      case LoyaltyTier.bronze:
        return 'shield';
      case LoyaltyTier.silver:
        return 'shield_moon';
      case LoyaltyTier.gold:
        return 'workspace_premium';
      case LoyaltyTier.platinum:
        return 'diamond';
      case LoyaltyTier.diamond:
        return 'stars';
    }
  }

  /// Tier color hex
  int get colorValue {
    switch (this) {
      case LoyaltyTier.bronze:
        return 0xFFCD7F32; // Bronze
      case LoyaltyTier.silver:
        return 0xFFC0C0C0; // Silver
      case LoyaltyTier.gold:
        return 0xFFFFD700; // Gold
      case LoyaltyTier.platinum:
        return 0xFFE5E4E2; // Platinum
      case LoyaltyTier.diamond:
        return 0xFFB9F2FF; // Diamond blue
    }
  }
}

/// User's loyalty status and points balance
class LoyaltyModel {
  final String userId;
  final LoyaltyTier currentTier;
  final int points; // 1 point = ₹1
  final int totalOrderCount; // Orders in current period
  final double totalSpentAmount; // Total spent in current period
  final DateTime periodStartDate; // When current period started
  final DateTime tierExpiresAt; // When tier needs re-evaluation
  final DateTime updatedAt;

  LoyaltyModel({
    required this.userId,
    this.currentTier = LoyaltyTier.bronze,
    this.points = 0,
    this.totalOrderCount = 0,
    this.totalSpentAmount = 0.0,
    required this.periodStartDate,
    required this.tierExpiresAt,
    required this.updatedAt,
  });

  /// Points as INR value
  double get pointsAsInr => points.toDouble();

  /// Progress to next tier (0.0 - 1.0)
  double get progressToNextTier {
    if (currentTier == LoyaltyTier.diamond) return 1.0;
    final nextTier = LoyaltyTier.values[currentTier.index + 1];
    final progress = totalSpentAmount / nextTier.minSpend;
    return progress.clamp(0.0, 1.0);
  }

  /// Amount needed for next tier
  double get amountToNextTier {
    if (currentTier == LoyaltyTier.diamond) return 0;
    final nextTier = LoyaltyTier.values[currentTier.index + 1];
    return (nextTier.minSpend - totalSpentAmount).clamp(0, double.infinity);
  }

  /// Factory from Firestore
  factory LoyaltyModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return LoyaltyModel.fromMap(data, doc.id);
  }

  factory LoyaltyModel.fromMap(Map<String, dynamic> map, String id) {
    return LoyaltyModel(
      userId: id,
      currentTier: _parseTier(map['currentTier']),
      points: (map['points'] as num?)?.toInt() ?? 0,
      totalOrderCount: (map['totalOrderCount'] as num?)?.toInt() ?? 0,
      totalSpentAmount: (map['totalSpentAmount'] as num?)?.toDouble() ?? 0.0,
      periodStartDate: _parseDateTime(map['periodStartDate']) ?? DateTime.now(),
      tierExpiresAt: _parseDateTime(map['tierExpiresAt']) ?? DateTime.now(),
      updatedAt: _parseDateTime(map['updatedAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'currentTier': currentTier.name,
      'points': points,
      'totalOrderCount': totalOrderCount,
      'totalSpentAmount': totalSpentAmount,
      'periodStartDate': Timestamp.fromDate(periodStartDate),
      'tierExpiresAt': Timestamp.fromDate(tierExpiresAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  LoyaltyModel copyWith({
    LoyaltyTier? currentTier,
    int? points,
    int? totalOrderCount,
    double? totalSpentAmount,
    DateTime? periodStartDate,
    DateTime? tierExpiresAt,
    DateTime? updatedAt,
  }) {
    return LoyaltyModel(
      userId: userId,
      currentTier: currentTier ?? this.currentTier,
      points: points ?? this.points,
      totalOrderCount: totalOrderCount ?? this.totalOrderCount,
      totalSpentAmount: totalSpentAmount ?? this.totalSpentAmount,
      periodStartDate: periodStartDate ?? this.periodStartDate,
      tierExpiresAt: tierExpiresAt ?? this.tierExpiresAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Create initial loyalty for new user
  factory LoyaltyModel.initial(String userId) {
    final now = DateTime.now();
    final yearStart = DateTime(now.year, 1, 1);
    final yearEnd = DateTime(now.year, 12, 31);
    
    return LoyaltyModel(
      userId: userId,
      currentTier: LoyaltyTier.bronze,
      points: 0,
      totalOrderCount: 0,
      totalSpentAmount: 0,
      periodStartDate: yearStart,
      tierExpiresAt: yearEnd,
      updatedAt: now,
    );
  }

  static LoyaltyTier _parseTier(dynamic value) {
    if (value == null) return LoyaltyTier.bronze;
    if (value is LoyaltyTier) return value;
    final str = value.toString().toLowerCase();
    return LoyaltyTier.values.firstWhere(
      (t) => t.name.toLowerCase() == str,
      orElse: () => LoyaltyTier.bronze,
    );
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}

/// Transaction type for loyalty points
enum LoyaltyTransactionType {
  earned,   // Points earned from order
  redeemed, // Points used at checkout
  expired,  // Points expired
  bonus,    // Bonus/promotional points
  refund,   // Points refunded (order cancelled/returned)
}

/// Individual loyalty transaction record
class LoyaltyTransaction {
  final String id;
  final String userId;
  final LoyaltyTransactionType type;
  final int points; // Positive for earned, negative for redeemed
  final int balanceAfter; // Balance after this transaction
  final String? orderId; // Related order if applicable
  final String description;
  final DateTime createdAt;

  LoyaltyTransaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.points,
    required this.balanceAfter,
    this.orderId,
    required this.description,
    required this.createdAt,
  });

  factory LoyaltyTransaction.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return LoyaltyTransaction(
      id: doc.id,
      userId: data['userId'] ?? '',
      type: _parseType(data['type']),
      points: (data['points'] as num?)?.toInt() ?? 0,
      balanceAfter: (data['balanceAfter'] as num?)?.toInt() ?? 0,
      orderId: data['orderId'] as String?,
      description: data['description'] ?? '',
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'type': type.name,
      'points': points,
      'balanceAfter': balanceAfter,
      'orderId': orderId,
      'description': description,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }

  static LoyaltyTransactionType _parseType(dynamic value) {
    if (value == null) return LoyaltyTransactionType.earned;
    final str = value.toString().toLowerCase();
    return LoyaltyTransactionType.values.firstWhere(
      (t) => t.name.toLowerCase() == str,
      orElse: () => LoyaltyTransactionType.earned,
    );
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}
