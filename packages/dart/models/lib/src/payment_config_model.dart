// lib/models/payment_config_model.dart

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

/// Payment mode for store payments
enum PaymentMode {
  shared, // Legacy unresolved setting; never grants payment readiness.
  notConnected,
  ownAccount, // Merchant-owned account; capabilities remain server-authoritative.
  managedSandbox, // Explicit LetBuyy test connection; never live settlement.
}

/// Model for store payment configuration
/// Primarily used by Professional plan users who connect their own Razorpay
class PaymentConfigModel {
  final String storeId;
  final PaymentMode mode;

  // Razorpay key metadata. The backend returns only a masked key id; secrets never
  // come back to Flutter once saved.
  final String? razorpayKeyId;
  final String? razorpayKeySecret;

  // Validation status
  final bool verified;
  final DateTime? verifiedAt;
  final String? verificationError;

  // Sandbox flag; API compatibility keeps the persisted field named test_mode.
  final bool testMode;
  final String? providerEnvironment;
  final String? revision;
  final bool canEnableOnline;
  final bool managedSandboxAvailable;
  final bool onlineCheckoutAvailable;
  final bool onlineRequested;
  final bool codEnabled;

  // Webhook configuration
  final String? webhookSecret;
  final bool webhookConfigured;

  // Connection metadata
  final DateTime? connectedAt;
  final DateTime? lastUsedAt;
  final String? razorpayAccountId; // Razorpay account identifier
  final String? businessName; // Business name from Razorpay

  const PaymentConfigModel({
    required this.storeId,
    this.mode = PaymentMode.notConnected,
    this.razorpayKeyId,
    this.razorpayKeySecret,
    this.verified = false,
    this.verifiedAt,
    this.verificationError,
    this.testMode = false,
    this.providerEnvironment,
    this.revision,
    this.canEnableOnline = false,
    this.managedSandboxAvailable = false,
    this.onlineCheckoutAvailable = false,
    this.onlineRequested = false,
    this.codEnabled = false,
    this.webhookSecret,
    this.webhookConfigured = false,
    this.connectedAt,
    this.lastUsedAt,
    this.razorpayAccountId,
    this.businessName,
  });

  // ============================================================
  // FACTORY: From backend response
  // ============================================================
  factory PaymentConfigModel.fromMap(Map<String, dynamic> map, String storeId) {
    final paymentSettings = map['payment_settings'];
    final settings = paymentSettings is Map
        ? Map<String, dynamic>.from(paymentSettings)
        : map;
    final razorpayValue = settings['razorpay'];
    final razorpay = razorpayValue is Map
        ? Map<String, dynamic>.from(razorpayValue)
        : <String, dynamic>{};

    final setup = map['setup'] is Map
        ? Map<String, dynamic>.from(map['setup'])
        : <String, dynamic>{};
    final environment = setup['environment'];
    final managed = setup['managed_payments'];
    final managedAvailable = managed is Map && managed['available'] == true && managed['reason'] == 'sandbox_only';
    final validTestSetup =
        ((settings['mode'] == 'ownAccount' && setup['connection'] == 'own_account') ||
          (settings['mode'] == 'managedSandbox' && setup['connection'] == 'managed_sandbox' && managedAvailable)) &&
        environment == 'sandbox' &&
        map['schema_ready'] == true &&
        razorpay['verified'] == true &&
        razorpay['test_mode'] == true &&
        setup['can_enable_online'] == true;
    return PaymentConfigModel(
      storeId: storeId,
      providerEnvironment: environment == 'sandbox' || environment == 'live'
          ? environment as String
          : null,
      revision: map['revision'] is String ? map['revision'] as String : null,
      canEnableOnline: validTestSetup,
      managedSandboxAvailable: managedAvailable,
      onlineCheckoutAvailable:
          validTestSetup &&
          setup['online_checkout_available'] == true &&
          map['online_payment_enabled'] == true,
      onlineRequested: map['online_payment_enabled'] == true,
      codEnabled: map['cod_enabled'] == true,
      mode: _parseMode(settings['mode'] as String?),
      razorpayKeyId:
          razorpay['key_id'] as String? ?? map['razorpayKeyId'] as String?,
      // Never deserialize credentials from a public configuration response.
      verified:
          razorpay['verified'] as bool? ?? map['verified'] as bool? ?? false,
      verifiedAt: _parseTimestamp(razorpay['verified_at'] ?? map['verifiedAt']),
      verificationError: map['verificationError'] as String?,
      testMode:
          razorpay['test_mode'] as bool? ?? map['testMode'] as bool? ?? false,

      webhookConfigured: map['webhookConfigured'] as bool? ?? false,
      connectedAt: _parseTimestamp(
        razorpay['connected_at'] ?? map['connectedAt'],
      ),
      lastUsedAt: _parseTimestamp(map['lastUsedAt']),
      razorpayAccountId: map['razorpayAccountId'] as String?,
      businessName: map['businessName'] as String?,
    );
  }

  // ============================================================
  // TO MAP
  // ============================================================
  Map<String, dynamic> toMap() {
    return {
      'mode': mode.name,
      'razorpayKeyId': razorpayKeyId,
      'verified': verified,
      'verifiedAt': verifiedAt?.toIso8601String(),
      'verificationError': verificationError,
      'testMode': testMode,
      'providerEnvironment': providerEnvironment,
      'revision': revision,
      'canEnableOnline': canEnableOnline,
      'managedSandboxAvailable': managedSandboxAvailable,
      'onlineCheckoutAvailable': onlineCheckoutAvailable,
      'onlineRequested': onlineRequested,
      'codEnabled': codEnabled,
      'webhookConfigured': webhookConfigured,
      'connectedAt': connectedAt?.toIso8601String(),
      'lastUsedAt': lastUsedAt?.toIso8601String(),
      'razorpayAccountId': razorpayAccountId,
      'businessName': businessName,
    };
  }

  // ============================================================
  // COMPUTED PROPERTIES
  // ============================================================

  /// Check if using own Razorpay account
  bool get isOwnAccount => mode == PaymentMode.ownAccount;

  /// Check if payment config is ready to use
  bool get isReady =>
      (mode == PaymentMode.ownAccount || mode == PaymentMode.managedSandbox) &&
      verified &&
      testMode &&
      providerEnvironment == 'sandbox' &&
      onlineRequested &&
      onlineCheckoutAvailable;

  /// Get status display text
  String get statusText {
    if (mode == PaymentMode.shared) {
      return 'Payment connection needs review';
    }
    if (canEnableOnline)
      return onlineCheckoutAvailable
          ? 'Test checkout enabled'
          : 'Test credentials saved; online checkout off';
    if (providerEnvironment == 'live')
      return 'Live payments require provider qualification';
    if (verified) return 'Credentials saved; readiness not confirmed';
    if (verificationError != null) {
      return 'Connection Failed: $verificationError';
    }
    return 'Not Connected';
  }

  /// Get commission message
  String getCommissionMessage(double commissionPercent) {
    return '0% LetBuyy transaction fee. Contracted provider fees may apply.';
  }

  // ============================================================
  // HELPER: Parse Mode
  // ============================================================

  static PaymentMode _parseMode(String? mode) {
    switch (mode?.toLowerCase()) {
      case 'ownaccount':
      case 'own_account':
        return PaymentMode.ownAccount;
      case 'shared':
        return PaymentMode.shared;
      case 'managedsandbox':
      case 'managed_sandbox':
        return PaymentMode.managedSandbox;
      default:
        return PaymentMode.notConnected;
    }
  }

  // ============================================================
  // COPY WITH
  // ============================================================

  PaymentConfigModel copyWith({
    PaymentMode? mode,
    String? razorpayKeyId,
    String? razorpayKeySecret,
    bool? verified,
    DateTime? verifiedAt,
    String? verificationError,
    bool? testMode,
    String? webhookSecret,
    bool? webhookConfigured,
    DateTime? connectedAt,
    DateTime? lastUsedAt,
    String? razorpayAccountId,
    String? businessName,
  }) {
    return PaymentConfigModel(
      storeId: storeId,
      mode: mode ?? this.mode,
      providerEnvironment: providerEnvironment,
      revision: revision,
      canEnableOnline: canEnableOnline,
      managedSandboxAvailable: managedSandboxAvailable,
      onlineCheckoutAvailable: onlineCheckoutAvailable,
      onlineRequested: onlineRequested,
      codEnabled: codEnabled,
      razorpayKeyId: razorpayKeyId ?? this.razorpayKeyId,
      razorpayKeySecret: razorpayKeySecret ?? this.razorpayKeySecret,
      verified: verified ?? this.verified,
      verifiedAt: verifiedAt ?? this.verifiedAt,
      verificationError: verificationError ?? this.verificationError,
      testMode: testMode ?? this.testMode,
      webhookSecret: webhookSecret ?? this.webhookSecret,
      webhookConfigured: webhookConfigured ?? this.webhookConfigured,
      connectedAt: connectedAt ?? this.connectedAt,
      lastUsedAt: lastUsedAt ?? this.lastUsedAt,
      razorpayAccountId: razorpayAccountId ?? this.razorpayAccountId,
      businessName: businessName ?? this.businessName,
    );
  }

  // ============================================================
  // FACTORY: Default Shared Config
  // ============================================================

  factory PaymentConfigModel.unavailable(String storeId) {
    return PaymentConfigModel(
      storeId: storeId,
      mode: PaymentMode.notConnected,
      verified: false,
    );
  }

  // ============================================================
  // DEBUG INFO
  // ============================================================

  @override
  String toString() =>
      '''
PaymentConfigModel(
  storeId: $storeId,
  mode: ${mode.name},
  verified: $verified,
  testMode: $testMode,
  businessName: $businessName,
)''';
}
