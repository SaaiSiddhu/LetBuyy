int _minor(Object? value) {
  if (value is! num ||
      !value.isFinite ||
      value < 0 ||
      value != value.round() ||
      value > 9007199254740991) {
    throw const FormatException(
      'Subscription pricing is unavailable. Refresh and try again.',
    );
  }
  return value.toInt();
}

String subscriptionMoney(
  int minor, {
  String symbol = '₹',
  bool decimals = false,
}) {
  final whole = minor ~/ 100, part = minor % 100;
  return '$symbol$whole${decimals || part != 0 ? '.${part.toString().padLeft(2, '0')}' : ''}';
}

String _title(String value) => value
    .split(RegExp(r'[_\s-]+'))
    .where((s) => s.isNotEmpty)
    .map((s) => s[0].toUpperCase() + s.substring(1))
    .join(' ');

class MerchantBillingPlan {
  MerchantBillingPlan.fromJson(Map<String, dynamic> row)
    : id = row['id'] as String,
      slug = row['slug'] as String,
      name = row['name'] as String,
      monthlyMinor = _minor(row['billing_amount_monthly_minor']),
      yearlyMinor = _minor(row['billing_amount_yearly_minor']),
      currency = row['currency'] as String,
      purchasable =
          row['is_active'] == true &&
          row['purchasable'] != false &&
          row['status'] != 'coming_soon' &&
          row['requires_contact'] != true,
      requiresContact = row['requires_contact'] == true,
      comingSoon = row['status'] == 'coming_soon',
      productLimit =
          (row['limits'] is Map &&
                      (row['limits'] as Map).containsKey('products')
                  ? (row['limits'] as Map)['products']
                  : row['products_limit'])
              as int?,
      features = _features(row) {
    if (!(row.containsKey('products_limit') ||
            (row['limits'] is Map &&
                (row['limits'] as Map).containsKey('products'))) ||
        id.isEmpty ||
        slug.isEmpty ||
        name.isEmpty ||
        currency != 'INR')
      throw const FormatException('Subscription catalog is unavailable.');
  }
  final String id, slug, name, currency;
  final int monthlyMinor, yearlyMinor;
  final int? productLimit;
  final bool purchasable, requiresContact, comingSoon;
  final List<String> features;
  int amountMinor(String period) =>
      period == 'yearly' ? yearlyMinor : monthlyMinor;
  String priceLabel(String period) => subscriptionMoney(amountMinor(period));
  static List<String> _features(Map<String, dynamic> row) {
    final result = <String>[];
    if (row['features'] is List)
      result.addAll((row['features'] as List).whereType<String>());
    final flags = row['entitlements'] is Map
        ? row['entitlements'] as Map
        : const {};
    for (final e in const {
      'custom_domain': 'Custom domain',
      'remove_branding': 'Remove LetBuyy branding',
      'advanced_promotions': 'Advanced promotions',
      'multi_location_inventory': 'Multiple inventory locations',
      'api_access': 'API access',
    }.entries) {
      if (flags[e.key] == true && !result.contains(e.value))
        result.add(e.value);
    }
    return List.unmodifiable(result);
  }
}

class MerchantBillingState {
  MerchantBillingState.fromJson(Map<String, dynamic> json) {
    final store = json['store'];
    if (store is! Map || store['id'] is! String)
      throw const FormatException('Billing details are unavailable.');
    final usage = json['product_usage'];
    if (usage is Map) {
      productCount = usage['count'] == null ? null : _minor(usage['count']);
      productLimitKnown = usage['limit_known'] == true;
      productLimit = usage['limit'] == null ? null : _minor(usage['limit']);
    }
    trialStatus = store['trial_status'] as String?;
    trialEndsAt = DateTime.tryParse(store['trial_ends_at']?.toString() ?? '');
    final row = json['subscription'];
    if (row != null && row is! Map)
      throw const FormatException('Subscription details are unavailable.');
    if (row is Map) {
      id = row['id'] as String?;
      planSlug = row['plan'] as String?;
      if (id == null || planSlug == null)
        throw const FormatException('Subscription details are unavailable.');
      planName = row['plan_name'] as String? ?? _title(planSlug!);
      status = row['status'] as String? ?? 'unknown';
      billingPeriod = row['billing_period'] as String?;
      providerMode = row['provider_mode'] is String ? row['provider_mode'] as String : null;
      amountPaidMinor = row['amount_paid'] == null
          ? null
          : _minor(row['amount_paid']);
      periodEnd = DateTime.tryParse(
        row['current_period_end']?.toString() ?? '',
      );
      if (usage is! Map && active && row.containsKey('products_limit')) {
        productLimitKnown = true;
        productLimit = row['products_limit'] == null
            ? null
            : _minor(row['products_limit']);
      }
    } else {
      planName = trialStatus == 'active' || trialStatus == 'trialing'
          ? 'Trial'
          : 'No active subscription';
      status = trialStatus ?? 'unknown';
    }
  }
  String? id, planSlug, billingPeriod, trialStatus, providerMode;
  late String planName, status;
  int? amountPaidMinor, productLimit, productCount;
  bool productLimitKnown = false;
  String get productUsageLabel {
    final count = productCount;
    if (count == null) return 'Product usage unavailable';
    if (!productLimitKnown) return '$count products • limit unavailable';
    return productLimit == null
        ? '$count products (Unlimited)'
        : '$count / $productLimit products';
  }

  String get compactProductUsageLabel {
    if (productCount == null) return 'Unavailable';
    if (!productLimitKnown) return '$productCount products';
    return productLimit == null
        ? '$productCount / ∞'
        : '$productCount / $productLimit';
  }

  double? get productUsageFraction => productCount == null || !productLimitKnown
      ? null
      : productLimit == null
      ? 0
      : productLimit == 0
      ? 1
      : (productCount! / productLimit!).clamp(0.0, 1.0);
  DateTime? trialEndsAt, periodEnd;
  bool get recoverable => status == 'past_due' || status == 'failed';
  bool get active => id != null && (status == 'active' || status == 'trialing');
}
