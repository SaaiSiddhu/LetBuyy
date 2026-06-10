// lib/models/subscription_model.dart

// Helper to safely parse timestamps from gateway maps and legacy timestamp objects.
DateTime? _parseTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is String) {
    try {
      return DateTime.parse(value);
    } catch (_) {
      return null;
    }
  }
  if (value is DateTime) return value;
  if (value.runtimeType.toString().contains('Timestamp')) {
    try {
      return value.toDate() as DateTime;
    } catch (_) {
      return null;
    }
  }
  return null;
}

/// Subscription plan types for store subscriptions
enum SubscriptionPlan {
  trial, // 30-day free trial, 50 products, 0% transaction fee
  starter, // ₹99/month, 5 products, 0% transaction fee
  business, // ₹399/month, 30 products, 0% transaction fee
  professional, // ₹799/month, unlimited products, 0% transaction fee
}

/// Subscription status
enum SubscriptionStatus {
  active, // Currently active subscription
  expired, // Subscription period ended (not renewed)
  canceled, // User canceled subscription
  frozen, // Store frozen due to non-payment or trial expiry
  pastDue, // Payment failed, in grace period
}

/// Plan configuration constants
class PlanConfig {
  static const Map<SubscriptionPlan, int> productLimits = {
    SubscriptionPlan.trial: 50,
    SubscriptionPlan.starter: 5,
    SubscriptionPlan.business: 30,
    SubscriptionPlan.professional: -1, // Unlimited
  };

  static const Map<SubscriptionPlan, double> commissionPercents = {
    SubscriptionPlan.trial: 0.0,
    SubscriptionPlan.starter: 0.0,
    SubscriptionPlan.business: 0.0,
    SubscriptionPlan.professional: 0.0,
  };

  static const Map<SubscriptionPlan, int> pricesInPaise = {
    SubscriptionPlan.trial: 0,
    SubscriptionPlan.starter: 9900, // ₹99
    SubscriptionPlan.business: 39900, // ₹399
    SubscriptionPlan.professional: 79900, // ₹799
  };

  static const Map<SubscriptionPlan, String> displayNames = {
    SubscriptionPlan.trial: 'Free Trial',
    SubscriptionPlan.starter: 'Starter',
    SubscriptionPlan.business: 'Business',
    SubscriptionPlan.professional: 'Professional',
  };

  /// Features enabled for each plan
  static Map<String, bool> getFeaturesForPlan(SubscriptionPlan plan) {
    return {
      'customDomain':
          plan == SubscriptionPlan.business ||
          plan == SubscriptionPlan.professional,
      'inventory': plan != SubscriptionPlan.starter,
      'coupons': plan != SubscriptionPlan.starter,
      'analytics': plan != SubscriptionPlan.starter,
      'advancedAnalytics': plan == SubscriptionPlan.professional,
      'teamAccess': plan == SubscriptionPlan.professional,
      'ownRazorpay': plan == SubscriptionPlan.professional,
      'apiAccess': plan == SubscriptionPlan.professional,
      'removeBadge':
          plan == SubscriptionPlan.business ||
          plan == SubscriptionPlan.professional,
      'bulkUpload': plan != SubscriptionPlan.starter,
      'productVariants': plan != SubscriptionPlan.starter,
      'customerReviews': plan != SubscriptionPlan.starter,
    };
  }
}

/// Model for store subscription management
class SubscriptionModel {
  final String id;
  final String storeId;
  final SubscriptionPlan plan;
  final SubscriptionStatus status;

  // Timing
  final DateTime startDate;
  final DateTime? endDate;
  final DateTime? trialEndsAt;
  final DateTime? nextBillingDate;
  final DateTime createdAt;
  final DateTime? updatedAt;

  // Limits based on plan
  final int productLimit;
  final double commissionPercent;

  // Razorpay subscription tracking
  final String? razorpaySubscriptionId;
  final String? razorpayPlanId;
  final DateTime? lastPaymentDate;
  final double lastPaymentAmount;

  // Upgrade/downgrade tracking
  final String? previousPlan;
  final DateTime? planChangedAt;

  // Current usage
  final int currentProductCount;

  const SubscriptionModel({
    required this.id,
    required this.storeId,
    required this.plan,
    this.status = SubscriptionStatus.active,
    required this.startDate,
    this.endDate,
    this.trialEndsAt,
    this.nextBillingDate,
    required this.createdAt,
    this.updatedAt,
    required this.productLimit,
    required this.commissionPercent,
    this.razorpaySubscriptionId,
    this.razorpayPlanId,
    this.lastPaymentDate,
    this.lastPaymentAmount = 0.0,
    this.previousPlan,
    this.planChangedAt,
    this.currentProductCount = 0,
  });

  // ============================================================
  // FACTORY: From gateway response
  // ============================================================
  factory SubscriptionModel.fromMap(Map<String, dynamic> map, String id) {
    return SubscriptionModel(
      id: id,
      storeId: map['storeId'] ?? '',
      plan: _parsePlan(map['plan']),
      status: _parseStatus(map['status']),
      startDate: _parseTimestamp(map['startDate']) ?? DateTime.now(),
      endDate: _parseTimestamp(map['endDate']),
      trialEndsAt: _parseTimestamp(map['trialEndsAt']),
      nextBillingDate: _parseTimestamp(map['nextBillingDate']),
      createdAt: _parseTimestamp(map['createdAt']) ?? DateTime.now(),
      updatedAt: _parseTimestamp(map['updatedAt']),
      productLimit: map['productLimit'] ?? 5,
      commissionPercent: (map['commissionPercent'] as num?)?.toDouble() ?? 0.0,
      razorpaySubscriptionId: map['razorpaySubscriptionId'],
      razorpayPlanId: map['razorpayPlanId'],
      lastPaymentDate: _parseTimestamp(map['lastPaymentDate']),
      lastPaymentAmount: (map['lastPaymentAmount'] as num?)?.toDouble() ?? 0.0,
      previousPlan: map['previousPlan'],
      planChangedAt: _parseTimestamp(map['planChangedAt']),
      currentProductCount: map['currentProductCount'] ?? 0,
    );
  }

  // ============================================================
  // TO MAP
  // ============================================================
  Map<String, dynamic> toMap() {
    return {
      'storeId': storeId,
      'plan': plan.name,
      'status': status.name,
      'startDate': startDate.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'trialEndsAt': trialEndsAt?.toIso8601String(),
      'nextBillingDate': nextBillingDate?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'productLimit': productLimit,
      'commissionPercent': commissionPercent,
      'razorpaySubscriptionId': razorpaySubscriptionId,
      'razorpayPlanId': razorpayPlanId,
      'lastPaymentDate': lastPaymentDate?.toIso8601String(),
      'lastPaymentAmount': lastPaymentAmount,
      'previousPlan': previousPlan,
      'planChangedAt': planChangedAt?.toIso8601String(),
      'currentProductCount': currentProductCount,
    };
  }

  // ============================================================
  // COMPUTED PROPERTIES
  // ============================================================

  /// Check if trial is still active
  bool get isTrialActive =>
      plan == SubscriptionPlan.trial &&
      trialEndsAt != null &&
      DateTime.now().isBefore(trialEndsAt!);

  /// Days remaining in trial
  int get daysLeftInTrial {
    if (plan != SubscriptionPlan.trial || trialEndsAt == null) return 0;
    final diff = trialEndsAt!.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }

  /// Check if user can add more products
  bool get canAddProducts =>
      productLimit == -1 || currentProductCount < productLimit;

  /// Products remaining before limit
  int get productsRemaining {
    if (productLimit == -1) return -1; // Unlimited
    return productLimit - currentProductCount;
  }

  /// Usage percentage (0-100)
  double get usagePercent {
    if (productLimit == -1) return 0; // Unlimited
    if (productLimit == 0) return 100;
    return (currentProductCount / productLimit * 100).clamp(0, 100);
  }

  /// Check if store is in grace period
  bool get isInGracePeriod => status == SubscriptionStatus.pastDue;

  /// Check if store is frozen
  bool get isFrozen => status == SubscriptionStatus.frozen;

  /// Get enabled features for current plan
  Map<String, bool> get enabledFeatures => PlanConfig.getFeaturesForPlan(plan);

  /// Display name for current plan
  String get planDisplayName => PlanConfig.displayNames[plan] ?? 'Unknown';

  /// Monthly price in rupees
  int get priceInRupees => (PlanConfig.pricesInPaise[plan] ?? 0) ~/ 100;

  // ============================================================
  // HELPER: Parse Enums
  // ============================================================

  static SubscriptionPlan _parsePlan(String? plan) {
    switch (plan?.toLowerCase()) {
      case 'trial':
        return SubscriptionPlan.trial;
      case 'starter':
        return SubscriptionPlan.starter;
      case 'business':
        return SubscriptionPlan.business;
      case 'professional':
        return SubscriptionPlan.professional;
      default:
        return SubscriptionPlan.trial;
    }
  }

  static SubscriptionStatus _parseStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'active':
        return SubscriptionStatus.active;
      case 'expired':
        return SubscriptionStatus.expired;
      case 'canceled':
        return SubscriptionStatus.canceled;
      case 'frozen':
        return SubscriptionStatus.frozen;
      case 'pastdue':
        return SubscriptionStatus.pastDue;
      default:
        return SubscriptionStatus.active;
    }
  }

  // ============================================================
  // COPY WITH
  // ============================================================

  SubscriptionModel copyWith({
    SubscriptionPlan? plan,
    SubscriptionStatus? status,
    DateTime? endDate,
    DateTime? trialEndsAt,
    DateTime? nextBillingDate,
    DateTime? updatedAt,
    int? productLimit,
    double? commissionPercent,
    String? razorpaySubscriptionId,
    String? razorpayPlanId,
    DateTime? lastPaymentDate,
    double? lastPaymentAmount,
    String? previousPlan,
    DateTime? planChangedAt,
    int? currentProductCount,
  }) {
    return SubscriptionModel(
      id: id,
      storeId: storeId,
      plan: plan ?? this.plan,
      status: status ?? this.status,
      startDate: startDate,
      endDate: endDate ?? this.endDate,
      trialEndsAt: trialEndsAt ?? this.trialEndsAt,
      nextBillingDate: nextBillingDate ?? this.nextBillingDate,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      productLimit: productLimit ?? this.productLimit,
      commissionPercent: commissionPercent ?? this.commissionPercent,
      razorpaySubscriptionId:
          razorpaySubscriptionId ?? this.razorpaySubscriptionId,
      razorpayPlanId: razorpayPlanId ?? this.razorpayPlanId,
      lastPaymentDate: lastPaymentDate ?? this.lastPaymentDate,
      lastPaymentAmount: lastPaymentAmount ?? this.lastPaymentAmount,
      previousPlan: previousPlan ?? this.previousPlan,
      planChangedAt: planChangedAt ?? this.planChangedAt,
      currentProductCount: currentProductCount ?? this.currentProductCount,
    );
  }

  // ============================================================
  // FACTORY: Create New Trial
  // ============================================================

  factory SubscriptionModel.createTrial({required String storeId}) {
    final now = DateTime.now();
    return SubscriptionModel(
      id: 'sub_${storeId}_${now.millisecondsSinceEpoch}',
      storeId: storeId,
      plan: SubscriptionPlan.trial,
      status: SubscriptionStatus.active,
      startDate: now,
      trialEndsAt: now.add(const Duration(days: 30)),
      createdAt: now,
      productLimit: PlanConfig.productLimits[SubscriptionPlan.trial]!,
      commissionPercent: PlanConfig.commissionPercents[SubscriptionPlan.trial]!,
    );
  }

  // ============================================================
  // DEBUG INFO
  // ============================================================

  @override
  String toString() =>
      '''
SubscriptionModel(
  id: $id,
  storeId: $storeId,
  plan: ${plan.name},
  status: ${status.name},
  productLimit: $productLimit (used: $currentProductCount),
  commissionPercent: $commissionPercent%,
  trialEndsAt: $trialEndsAt,
  daysLeftInTrial: $daysLeftInTrial,
)''';
}
