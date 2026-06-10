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
  shared, // Uses Letbuyy's shared Razorpay account
  ownAccount, // Uses seller's own Razorpay account (Professional only)
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

  // Test mode for sandbox testing
  final bool testMode;

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
    this.mode = PaymentMode.shared,
    this.razorpayKeyId,
    this.razorpayKeySecret,
    this.verified = false,
    this.verifiedAt,
    this.verificationError,
    this.testMode = false,
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

    return PaymentConfigModel(
      storeId: storeId,
      mode: _parseMode(settings['mode'] as String?),
      razorpayKeyId:
          razorpay['key_id'] as String? ?? map['razorpayKeyId'] as String?,
      razorpayKeySecret: map['razorpayKeySecret'] as String?,
      verified:
          razorpay['verified'] as bool? ?? map['verified'] as bool? ?? false,
      verifiedAt: _parseTimestamp(razorpay['verified_at'] ?? map['verifiedAt']),
      verificationError: map['verificationError'] as String?,
      testMode:
          razorpay['test_mode'] as bool? ?? map['testMode'] as bool? ?? false,
      webhookSecret: map['webhookSecret'] as String?,
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
      'razorpayKeySecret': razorpayKeySecret,
      'verified': verified,
      'verifiedAt': verifiedAt?.toIso8601String(),
      'verificationError': verificationError,
      'testMode': testMode,
      'webhookSecret': webhookSecret,
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
      mode == PaymentMode.shared ||
      (mode == PaymentMode.ownAccount && verified);

  /// Get status display text
  String get statusText {
    if (mode == PaymentMode.shared) {
      return 'Using Letbuyy Payment Gateway';
    }
    if (verified) {
      return 'Connected to ${businessName ?? 'Your Razorpay Account'}';
    }
    if (verificationError != null) {
      return 'Connection Failed: $verificationError';
    }
    return 'Not Connected';
  }

  /// Get commission message
  String getCommissionMessage(double commissionPercent) {
    if (mode == PaymentMode.ownAccount && verified) {
      return '0% platform fee - All payments go directly to your Razorpay account';
    }
    if (commissionPercent == 0) {
      return '0% platform fee - Letbuyy does not charge a transaction fee';
    }
    return '${commissionPercent.toStringAsFixed(0)}% platform fee on each transaction';
  }

  // ============================================================
  // HELPER: Parse Mode
  // ============================================================

  static PaymentMode _parseMode(String? mode) {
    switch (mode?.toLowerCase()) {
      case 'ownaccount':
      case 'own_account':
        return PaymentMode.ownAccount;
      default:
        return PaymentMode.shared;
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

  factory PaymentConfigModel.defaultShared(String storeId) {
    return PaymentConfigModel(
      storeId: storeId,
      mode: PaymentMode.shared,
      verified: true, // Shared is always verified
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
