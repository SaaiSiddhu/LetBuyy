import 'package:letbuyy_models/letbuyy_models.dart';

/// Store status enum
enum StoreStatus { draft, published, suspended }

/// Store plan enum (legacy - use SubscriptionPlan for new stores)
enum StorePlan { free, premium }

/// Current subscription plan type for SaaS stores
typedef CurrentPlan = SubscriptionPlan;

/// Store model for custom online stores
class StoreModel {
  final String id;
  final String sellerId;
  final String name;
  final String tagline;
  final String subdomain; // Unique: myshop
  final String storeUrl; // https://myshop-letbuy-y.web.app
  final String? logoUrl;
  final String? bannerUrl;

  // Theme
  final String themeId;
  final Map<String, dynamic> themeCustomization;

  // Products
  final List<String> selectedProductIds;

  // Template Configuration (Section-based builder)
  final StoreTemplateModel? templateConfig;

  // Status
  final StoreStatus status;
  final StorePlan plan;

  // Subscription System (SaaS)
  final SubscriptionPlan? subscriptionPlan;
  final SubscriptionStatus? subscriptionStatus;
  final DateTime? trialEndsAt;
  final DateTime? subscriptionEndsAt;
  final int productLimit;
  final int currentProductCount;
  final double commissionPercent;

  // Frozen State
  final bool isFrozen;
  final DateTime? frozenAt;
  final String? freezeReason;

  // Payment Configuration
  final PaymentMode paymentMode;

  // Team Access (Professional only)
  final int teamMemberCount;

  // SEO
  final String? seoTitle;
  final String? seoDescription;

  // Stats
  final int totalVisitors;
  final int totalOrders;

  // Domain Management
  final String domainStatus; // "pending" | "active" | "rejected"
  final DateTime? domainConnectedAt;
  final String? domainConnectedBy;
  final String? customDomain; // e.g., "www.myfashion.com"
  final String? customDomainStatus; // "pending" | "review" | "active" | "error"
  final Map<String, dynamic>
  dnsConfig; // e.g., { "txtRecord": "...", "cname": "..." }
  final bool sslActive;
  final String? customDomainHeader; // For debugging/tracking
  final String accessMode;
  final String? accessMessage;
  final bool published;

  // Payment Settings
  final bool codEnabled;
  final bool onlinePaymentEnabled;
  final bool taxInclusive;
  final String? legalName;
  final String? gstin;
  final String? gstStateCode;
  final String? invoicePrefix;
  final Map<String, dynamic> businessProfile;
  final Map<String, dynamic> invoiceAddress;
  final String? invoiceFooter;
  final int invoiceNumberNext;

  // Timestamps
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? publishedAt;

  const StoreModel({
    required this.id,
    required this.sellerId,
    required this.name,
    required this.tagline,
    required this.subdomain,
    required this.storeUrl,
    this.logoUrl,
    this.bannerUrl,
    required this.themeId,
    this.themeCustomization = const {},
    this.selectedProductIds = const [],
    this.templateConfig,
    this.status = StoreStatus.draft,
    this.plan = StorePlan.free,
    this.subscriptionPlan,
    this.subscriptionStatus,
    this.trialEndsAt,
    this.subscriptionEndsAt,
    this.productLimit = 50,
    this.currentProductCount = 0,
    this.commissionPercent = 3.0,
    this.isFrozen = false,
    this.frozenAt,
    this.freezeReason,
    this.paymentMode = PaymentMode.shared,
    this.teamMemberCount = 0,
    this.seoTitle,
    this.seoDescription,
    this.totalVisitors = 0,
    this.totalOrders = 0,
    this.domainStatus = 'pending',
    this.domainConnectedAt,
    this.domainConnectedBy,
    this.customDomain,
    this.customDomainStatus,
    this.dnsConfig = const {},
    this.sslActive = false,
    this.customDomainHeader,
    this.accessMode = 'public',
    this.accessMessage,
    this.published = false,
    this.codEnabled = true,
    this.onlinePaymentEnabled = true,
    this.taxInclusive = false,
    this.legalName,
    this.gstin,
    this.gstStateCode,
    this.invoicePrefix,
    this.businessProfile = const {},
    this.invoiceAddress = const {},
    this.invoiceFooter,
    this.invoiceNumberNext = 1,
    required this.createdAt,
    required this.updatedAt,
    this.publishedAt,
  });

  /// Generate store URL from subdomain (new format: subdomain.letbuyy.com)
  static String generateStoreUrl(String subdomain) {
    return 'https://$subdomain.letbuyy.com';
  }

  /// Generate the public storefront URL.
  static String generateLegacyStoreUrl(String subdomain) {
    return 'https://$subdomain-letbuy-y.web.app';
  }

  /// Create from JSON (API response).
  factory StoreModel.fromJson(Map<String, dynamic> data) {
    final id = data['id']?.toString() ?? '';
    return StoreModel(
      id: id,
      sellerId: data['sellerId'] ?? data['seller_id'] ?? data['owner_id'] ?? '',
      name: data['name'] ?? '',
      tagline: data['tagline'] ?? '',
      subdomain: data['subdomain'] ?? '',
      storeUrl: data['storeUrl'] ?? data['store_url'] ?? '',
      logoUrl: data['logoUrl'] ?? data['logo_url'],
      bannerUrl: data['bannerUrl'] ?? data['banner_url'],
      themeId: data['themeId'] ?? data['theme_id'] ?? 'minimal_modern',
      themeCustomization: Map<String, dynamic>.from(
        data['themeCustomization'] ?? data['theme_customization'] ?? {},
      ),
      selectedProductIds: List<String>.from(
        data['selectedProductIds'] ?? data['selected_product_ids'] ?? [],
      ),
      status: StoreStatus.values.firstWhere(
        (e) => e.name == (data['status'] ?? 'draft'),
        orElse: () => StoreStatus.draft,
      ),
      plan: StorePlan.values.firstWhere(
        (e) => e.name == (data['plan'] ?? 'free'),
        orElse: () => StorePlan.free,
      ),
      subscriptionPlan:
          data['subscriptionPlan'] != null || data['subscription_plan'] != null
          ? _parseSubscriptionPlan(
              data['subscriptionPlan'] ?? data['subscription_plan'],
            )
          : null,
      subscriptionStatus:
          data['subscriptionStatus'] != null ||
              data['subscription_status'] != null
          ? _parseSubscriptionStatus(
              data['subscriptionStatus'] ?? data['subscription_status'],
            )
          : null,
      trialEndsAt: _parseTimestamp(
        data['trialEndsAt'] ?? data['trial_ends_at'],
      ),
      subscriptionEndsAt: _parseTimestamp(
        data['subscriptionEndsAt'] ?? data['subscription_ends_at'],
      ),
      productLimit: data['productLimit'] ?? data['product_limit'] ?? 50,
      currentProductCount:
          data['currentProductCount'] ?? data['current_product_count'] ?? 0,
      commissionPercent:
          (data['commissionPercent'] ?? data['commission_percent'] as num?)
              ?.toDouble() ??
          3.0,
      isFrozen: data['isFrozen'] ?? data['is_frozen'] ?? false,
      frozenAt: _parseTimestamp(data['frozenAt'] ?? data['frozen_at']),
      freezeReason: data['freezeReason'] ?? data['freeze_reason'],
      paymentMode: _parsePaymentMode(
        data['paymentMode'] ?? data['payment_mode'],
      ),
      teamMemberCount:
          data['teamMemberCount'] ?? data['team_member_count'] ?? 0,
      seoTitle: data['seoTitle'] ?? data['seo_title'],
      seoDescription: data['seoDescription'] ?? data['seo_description'],
      totalVisitors: data['totalVisitors'] ?? data['total_visitors'] ?? 0,
      totalOrders: data['totalOrders'] ?? data['total_orders'] ?? 0,
      domainStatus: data['domainStatus'] ?? data['domain_status'] ?? 'pending',
      domainConnectedAt: _parseTimestamp(
        data['domainConnectedAt'] ?? data['domain_connected_at'],
      ),
      domainConnectedBy:
          data['domainConnectedBy'] ?? data['domain_connected_by'],
      customDomain: data['customDomain'] ?? data['custom_domain'],
      customDomainStatus:
          data['customDomainStatus'] ?? data['custom_domain_status'],
      dnsConfig: Map<String, dynamic>.from(
        data['dnsConfig'] ?? data['dns_config'] ?? {},
      ),
      sslActive: data['sslActive'] ?? data['ssl_active'] ?? false,
      customDomainHeader:
          data['customDomainHeader'] ?? data['custom_domain_header'],
      accessMode: data['accessMode'] ?? data['access_mode'] ?? 'public',
      accessMessage: data['accessMessage'] ?? data['access_message'],
      published: data['published'] == true || data['status'] == 'published',
      codEnabled: data['codEnabled'] ?? data['cod_enabled'] ?? true,
      onlinePaymentEnabled:
          data['onlinePaymentEnabled'] ??
          data['online_payment_enabled'] ??
          true,
      taxInclusive: data['taxInclusive'] ?? data['tax_inclusive'] ?? false,
      legalName: data['legalName'] ?? data['legal_name'],
      gstin: data['gstin'],
      gstStateCode: data['gstStateCode'] ?? data['gst_state_code'],
      invoicePrefix: data['invoicePrefix'] ?? data['invoice_prefix'],
      businessProfile: Map<String, dynamic>.from(
        data['businessProfile'] ?? data['business_profile'] ?? {},
      ),
      invoiceAddress: Map<String, dynamic>.from(
        data['invoiceAddress'] ?? data['invoice_address'] ?? {},
      ),
      invoiceFooter: data['invoiceFooter'] ?? data['invoice_footer'],
      invoiceNumberNext:
          data['invoiceNumberNext'] ?? data['invoice_number_next'] ?? 1,
      createdAt:
          _parseTimestamp(data['createdAt'] ?? data['created_at']) ??
          DateTime.now(),
      updatedAt:
          _parseTimestamp(data['updatedAt'] ?? data['updated_at']) ??
          DateTime.now(),
      publishedAt: _parseTimestamp(data['publishedAt'] ?? data['published_at']),
      templateConfig:
          (data['templateConfig'] ?? data['template_config']) != null
          ? StoreTemplateModel.fromMap(
              Map<String, dynamic>.from(
                (data['templateConfig'] ?? data['template_config']) as Map,
              ),
            )
          : null,
    );
  }

  /// Convert to JSON map for API requests.
  Map<String, dynamic> toJson() {
    return {
      'seller_id': sellerId,
      'name': name,
      'tagline': tagline,
      'subdomain': subdomain,
      'store_url': storeUrl,
      'logo_url': logoUrl,
      'banner_url': bannerUrl,
      'theme_id': themeId,
      'theme_customization': themeCustomization,
      'selected_product_ids': selectedProductIds,
      'status': status.name,
      'plan': plan.name,
      'subscription_plan': subscriptionPlan?.name,
      'subscription_status': subscriptionStatus?.name,
      'trial_ends_at': trialEndsAt?.toIso8601String(),
      'subscription_ends_at': subscriptionEndsAt?.toIso8601String(),
      'product_limit': productLimit,
      'current_product_count': currentProductCount,
      'commission_percent': commissionPercent,
      'is_frozen': isFrozen,
      'frozen_at': frozenAt?.toIso8601String(),
      'freeze_reason': freezeReason,
      'payment_mode': paymentMode.name,
      'team_member_count': teamMemberCount,
      'seo_title': seoTitle,
      'seo_description': seoDescription,
      'total_visitors': totalVisitors,
      'total_orders': totalOrders,
      'domain_status': domainStatus,
      'domain_connected_at': domainConnectedAt?.toIso8601String(),
      'domain_connected_by': domainConnectedBy,
      'custom_domain': customDomain,
      'custom_domain_status': customDomainStatus,
      'dns_config': dnsConfig,
      'ssl_active': sslActive,
      'custom_domain_header': customDomainHeader,
      'access_mode': accessMode,
      'access_message': accessMessage,
      'published': published,
      'cod_enabled': codEnabled,
      'online_payment_enabled': onlinePaymentEnabled,
      'tax_inclusive': taxInclusive,
      'legal_name': legalName,
      'gstin': gstin,
      'gst_state_code': gstStateCode,
      'invoice_prefix': invoicePrefix,
      'business_profile': businessProfile,
      'invoice_address': invoiceAddress,
      'invoice_footer': invoiceFooter,
      'invoice_number_next': invoiceNumberNext,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'published_at': publishedAt?.toIso8601String(),
      'template_config': templateConfig?.toMap(),
    };
  }

  /// Copy with new values
  StoreModel copyWith({
    String? id,
    String? sellerId,
    String? name,
    String? tagline,
    String? subdomain,
    String? storeUrl,
    String? logoUrl,
    String? bannerUrl,
    String? themeId,
    Map<String, dynamic>? themeCustomization,
    List<String>? selectedProductIds,
    StoreStatus? status,
    StorePlan? plan,
    SubscriptionPlan? subscriptionPlan,
    SubscriptionStatus? subscriptionStatus,
    DateTime? trialEndsAt,
    DateTime? subscriptionEndsAt,
    int? productLimit,
    int? currentProductCount,
    double? commissionPercent,
    bool? isFrozen,
    DateTime? frozenAt,
    String? freezeReason,
    PaymentMode? paymentMode,
    int? teamMemberCount,
    String? seoTitle,
    String? seoDescription,
    int? totalVisitors,
    int? totalOrders,
    String? domainStatus,
    DateTime? domainConnectedAt,
    String? domainConnectedBy,
    String? customDomain,
    String? customDomainStatus,
    Map<String, dynamic>? dnsConfig,
    bool? sslActive,
    String? customDomainHeader,
    String? accessMode,
    String? accessMessage,
    bool? published,
    bool? codEnabled,
    bool? onlinePaymentEnabled,
    bool? taxInclusive,
    String? legalName,
    String? gstin,
    String? gstStateCode,
    String? invoicePrefix,
    Map<String, dynamic>? businessProfile,
    Map<String, dynamic>? invoiceAddress,
    String? invoiceFooter,
    int? invoiceNumberNext,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? publishedAt,
    StoreTemplateModel? templateConfig,
  }) {
    return StoreModel(
      id: id ?? this.id,
      sellerId: sellerId ?? this.sellerId,
      name: name ?? this.name,
      tagline: tagline ?? this.tagline,
      subdomain: subdomain ?? this.subdomain,
      storeUrl: storeUrl ?? this.storeUrl,
      logoUrl: logoUrl ?? this.logoUrl,
      bannerUrl: bannerUrl ?? this.bannerUrl,
      themeId: themeId ?? this.themeId,
      themeCustomization: themeCustomization ?? this.themeCustomization,
      selectedProductIds: selectedProductIds ?? this.selectedProductIds,
      status: status ?? this.status,
      plan: plan ?? this.plan,
      subscriptionPlan: subscriptionPlan ?? this.subscriptionPlan,
      subscriptionStatus: subscriptionStatus ?? this.subscriptionStatus,
      trialEndsAt: trialEndsAt ?? this.trialEndsAt,
      subscriptionEndsAt: subscriptionEndsAt ?? this.subscriptionEndsAt,
      productLimit: productLimit ?? this.productLimit,
      currentProductCount: currentProductCount ?? this.currentProductCount,
      commissionPercent: commissionPercent ?? this.commissionPercent,
      isFrozen: isFrozen ?? this.isFrozen,
      frozenAt: frozenAt ?? this.frozenAt,
      freezeReason: freezeReason ?? this.freezeReason,
      paymentMode: paymentMode ?? this.paymentMode,
      teamMemberCount: teamMemberCount ?? this.teamMemberCount,
      seoTitle: seoTitle ?? this.seoTitle,
      seoDescription: seoDescription ?? this.seoDescription,
      totalVisitors: totalVisitors ?? this.totalVisitors,
      totalOrders: totalOrders ?? this.totalOrders,
      domainStatus: domainStatus ?? this.domainStatus,
      domainConnectedAt: domainConnectedAt ?? this.domainConnectedAt,
      domainConnectedBy: domainConnectedBy ?? this.domainConnectedBy,
      customDomain: customDomain ?? this.customDomain,
      customDomainStatus: customDomainStatus ?? this.customDomainStatus,
      dnsConfig: dnsConfig ?? this.dnsConfig,
      sslActive: sslActive ?? this.sslActive,
      customDomainHeader: customDomainHeader ?? this.customDomainHeader,
      accessMode: accessMode ?? this.accessMode,
      accessMessage: accessMessage ?? this.accessMessage,
      published: published ?? this.published,
      codEnabled: codEnabled ?? this.codEnabled,
      onlinePaymentEnabled: onlinePaymentEnabled ?? this.onlinePaymentEnabled,
      taxInclusive: taxInclusive ?? this.taxInclusive,
      legalName: legalName ?? this.legalName,
      gstin: gstin ?? this.gstin,
      gstStateCode: gstStateCode ?? this.gstStateCode,
      invoicePrefix: invoicePrefix ?? this.invoicePrefix,
      businessProfile: businessProfile ?? this.businessProfile,
      invoiceAddress: invoiceAddress ?? this.invoiceAddress,
      invoiceFooter: invoiceFooter ?? this.invoiceFooter,
      invoiceNumberNext: invoiceNumberNext ?? this.invoiceNumberNext,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      publishedAt: publishedAt ?? this.publishedAt,
      templateConfig: templateConfig ?? this.templateConfig,
    );
  }

  /// Check if store is published
  bool get isPublished => status == StoreStatus.published;

  /// Check if store is premium
  bool get isPremium => plan == StorePlan.premium;

  /// Check if subdomain is active
  bool get isSubdomainActive => domainStatus == 'active';

  /// Check if custom domain is active
  bool get isCustomDomainActive => customDomainStatus == 'active';

  /// Get the public URL for the store
  String get publicUrl {
    // Priority: custom domain > subdomain
    if (customDomain != null && customDomainStatus == 'active') {
      return 'https://$customDomain';
    }
    // With Load Balancer + wildcard SSL, subdomain always works instantly!
    return 'https://$subdomain.letbuyy.com';
  }

  /// Get the preview URL (same as public URL with Load Balancer)
  String get previewUrl => 'https://$subdomain.letbuyy.com';

  /// Get the number of products (from selectedProductIds)
  int get productCount => selectedProductIds.length;

  /// Get the view count (alias for totalVisitors)
  int get viewCount => totalVisitors;

  // ============================================================
  // SUBSCRIPTION HELPERS
  // ============================================================

  /// Check if store is currently frozen
  bool get isStoreFrozen => isFrozen;

  /// Get effective product limit based on subscription plan
  /// Falls back to stored productLimit if plan-based limit not applicable
  int get effectiveProductLimit {
    final plan = subscriptionPlan ?? SubscriptionPlan.trial;
    return PlanConfig.productLimits[plan] ?? productLimit;
  }

  /// Get effective commission based on subscription plan and Razorpay connection
  /// Professional: 0% if own Razorpay connected, 2% if using shared
  double get effectiveCommission {
    final plan = subscriptionPlan ?? SubscriptionPlan.trial;

    // Professional plan special case
    if (plan == SubscriptionPlan.professional) {
      return isUsingOwnRazorpay ? 0.0 : 2.0;
    }

    return PlanConfig.commissionPercents[plan] ?? commissionPercent;
  }

  /// Check if using own Razorpay account
  bool get isUsingOwnRazorpay => paymentMode == PaymentMode.ownAccount;

  /// Check if trial is active
  bool get isTrialActive {
    if (subscriptionPlan != SubscriptionPlan.trial) return false;
    if (trialEndsAt == null) return false;
    return DateTime.now().isBefore(trialEndsAt!);
  }

  /// Days remaining in trial
  int get daysLeftInTrial {
    if (!isTrialActive || trialEndsAt == null) return 0;
    final diff = trialEndsAt!.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }

  /// Check if user can add more products
  bool get canAddProducts {
    if (isFrozen) return false;
    if (productLimit == -1) return true; // Unlimited
    return currentProductCount < productLimit;
  }

  /// Products remaining before limit
  int get productsRemaining {
    if (productLimit == -1) return -1; // Unlimited
    return productLimit - currentProductCount;
  }

  /// Product usage percentage (0-100)
  double get productUsagePercent {
    if (productLimit == -1) return 0; // Unlimited
    if (productLimit == 0) return 100;
    return (currentProductCount / productLimit * 100).clamp(0, 100);
  }

  /// Get current plan display name
  String get currentPlanDisplayName {
    if (subscriptionPlan != null) {
      return PlanConfig.displayNames[subscriptionPlan!] ?? 'Unknown';
    }
    return plan == StorePlan.premium ? 'Premium' : 'Free';
  }

  /// Check if feature is enabled based on plan
  bool isFeatureEnabled(String feature) {
    if (subscriptionPlan == null) return false;
    final features = PlanConfig.getFeaturesForPlan(subscriptionPlan!);
    return features[feature] ?? false;
  }

  /// Check specific features
  bool get hasCustomDomainFeature => isFeatureEnabled('customDomain');
  bool get hasInventoryFeature => isFeatureEnabled('inventory');
  bool get hasCouponsFeature => isFeatureEnabled('coupons');
  bool get hasAnalyticsFeature => isFeatureEnabled('analytics');
  bool get hasAdvancedAnalyticsFeature => isFeatureEnabled('advancedAnalytics');
  bool get hasTeamAccessFeature => isFeatureEnabled('teamAccess');
  bool get hasOwnRazorpayFeature => isFeatureEnabled('ownRazorpay');
  bool get hasApiAccessFeature => isFeatureEnabled('apiAccess');
  bool get canRemoveBadge => isFeatureEnabled('removeBadge');

  // ============================================================
  // STATIC PARSE HELPERS
  // ============================================================

  static SubscriptionPlan _parseSubscriptionPlan(String? plan) {
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

  static SubscriptionStatus _parseSubscriptionStatus(String? status) {
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

  static PaymentMode _parsePaymentMode(String? mode) {
    switch (mode?.toLowerCase()) {
      case 'ownaccount':
      case 'own_account':
        return PaymentMode.ownAccount;
      default:
        return PaymentMode.shared;
    }
  }

  /// Parse timestamp from ISO string or DateTime.
  static DateTime? _parseTimestamp(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) {
      try {
        return DateTime.parse(value);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}
