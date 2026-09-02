// lib/models/commission_settings_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';

/// Tier configuration for seller tiers
class TierConfig {
  final double maxRevenue;    // null for unlimited (premium tier)
  final double modifier;      // Commission modifier (e.g., +2, 0, -1, -2)

  const TierConfig({
    required this.maxRevenue,
    required this.modifier,
  });

  factory TierConfig.fromMap(Map<String, dynamic> map) {
    return TierConfig(
      maxRevenue: (map['maxRevenue'] as num?)?.toDouble() ?? double.infinity,
      modifier: (map['modifier'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'maxRevenue': maxRevenue.isFinite ? maxRevenue : null,
      'modifier': modifier,
    };
  }

  TierConfig copyWith({
    double? maxRevenue,
    double? modifier,
  }) {
    return TierConfig(
      maxRevenue: maxRevenue ?? this.maxRevenue,
      modifier: modifier ?? this.modifier,
    );
  }
}

/// Global commission settings stored in Firestore (settings/commission)
class CommissionSettingsModel {
  // Tier configurations
  final TierConfig newSellerTier;
  final TierConfig standardTier;
  final TierConfig verifiedTier;
  final TierConfig premiumTier;

  // Global settings
  final int holdDays;             // Days to hold payment after delivery (default: 7)
  final double defaultAdDiscount; // Default ad order discount if not set per category
  final double minCommission;     // Minimum commission (floor)
  final double maxCommission;     // Maximum commission (ceiling)
  final double defaultPercent;    // Default category commission if not set

  final DateTime? updatedAt;
  final String? updatedBy;

  const CommissionSettingsModel({
    this.newSellerTier = const TierConfig(maxRevenue: 50000, modifier: 2.0),
    this.standardTier = const TierConfig(maxRevenue: 200000, modifier: 0.0),
    this.verifiedTier = const TierConfig(maxRevenue: 1000000, modifier: -1.0),
    this.premiumTier = const TierConfig(maxRevenue: double.infinity, modifier: -2.0),
    this.holdDays = 7,
    this.defaultAdDiscount = 4.0,
    this.minCommission = 0.0,
    this.maxCommission = 10.0,
    this.defaultPercent = 5.0,
    this.updatedAt,
    this.updatedBy,
  });

  factory CommissionSettingsModel.fromMap(Map<String, dynamic> map) {
    return CommissionSettingsModel(
      newSellerTier: TierConfig.fromMap(map['tiers']?['newSeller'] ?? {}),
      standardTier: TierConfig.fromMap(map['tiers']?['standard'] ?? {}),
      verifiedTier: TierConfig.fromMap(map['tiers']?['verified'] ?? {}),
      premiumTier: TierConfig.fromMap(map['tiers']?['premium'] ?? {}),
      holdDays: map['holdDays'] ?? 7,
      defaultAdDiscount: (map['defaultAdDiscount'] as num?)?.toDouble() ?? 4.0,
      minCommission: (map['minCommission'] as num?)?.toDouble() ?? 0.0,
      maxCommission: (map['maxCommission'] as num?)?.toDouble() ?? 10.0,
      defaultPercent: (map['defaultPercent'] as num?)?.toDouble() ?? 5.0,
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate(),
      updatedBy: map['updatedBy'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'tiers': {
        'newSeller': newSellerTier.toMap(),
        'standard': standardTier.toMap(),
        'verified': verifiedTier.toMap(),
        'premium': premiumTier.toMap(),
      },
      'holdDays': holdDays,
      'defaultAdDiscount': defaultAdDiscount,
      'minCommission': minCommission,
      'maxCommission': maxCommission,
      'defaultPercent': defaultPercent,
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : FieldValue.serverTimestamp(),
      'updatedBy': updatedBy,
    };
  }

  CommissionSettingsModel copyWith({
    TierConfig? newSellerTier,
    TierConfig? standardTier,
    TierConfig? verifiedTier,
    TierConfig? premiumTier,
    int? holdDays,
    double? defaultAdDiscount,
    double? minCommission,
    double? maxCommission,
    double? defaultPercent,
    DateTime? updatedAt,
    String? updatedBy,
  }) {
    return CommissionSettingsModel(
      newSellerTier: newSellerTier ?? this.newSellerTier,
      standardTier: standardTier ?? this.standardTier,
      verifiedTier: verifiedTier ?? this.verifiedTier,
      premiumTier: premiumTier ?? this.premiumTier,
      holdDays: holdDays ?? this.holdDays,
      defaultAdDiscount: defaultAdDiscount ?? this.defaultAdDiscount,
      minCommission: minCommission ?? this.minCommission,
      maxCommission: maxCommission ?? this.maxCommission,
      defaultPercent: defaultPercent ?? this.defaultPercent,
      updatedAt: updatedAt ?? this.updatedAt,
      updatedBy: updatedBy ?? this.updatedBy,
    );
  }

  /// Get tier modifier based on seller's total revenue
  double getTierModifierForRevenue(double totalRevenue) {
    if (totalRevenue < newSellerTier.maxRevenue) {
      return newSellerTier.modifier;
    } else if (totalRevenue < standardTier.maxRevenue) {
      return standardTier.modifier;
    } else if (totalRevenue < verifiedTier.maxRevenue) {
      return verifiedTier.modifier;
    } else {
      return premiumTier.modifier;
    }
  }

  /// Get tier name based on seller's total revenue
  String getTierNameForRevenue(double totalRevenue) {
    if (totalRevenue < newSellerTier.maxRevenue) {
      return 'New Seller';
    } else if (totalRevenue < standardTier.maxRevenue) {
      return 'Standard';
    } else if (totalRevenue < verifiedTier.maxRevenue) {
      return 'Verified';
    } else {
      return 'Premium';
    }
  }
}
