/// Auth request status
enum AuthRequestStatus { pending, approved, rejected, expired }

/// Store authentication request model
/// Used for cross-app authentication with Seller App
class StoreAuthRequestModel {
  final String id;
  final String sellerId;
  final String sellerEmail;
  final String deviceInfo;
  final String? ipAddress;
  final String? location;
  
  final AuthRequestStatus status;
  final String? authToken;
  
  final DateTime requestedAt;
  final DateTime expiresAt;
  final DateTime? respondedAt;

  const StoreAuthRequestModel({
    required this.id,
    required this.sellerId,
    required this.sellerEmail,
    required this.deviceInfo,
    this.ipAddress,
    this.location,
    this.status = AuthRequestStatus.pending,
    this.authToken,
    required this.requestedAt,
    required this.expiresAt,
    this.respondedAt,
  });

  /// Check if request is expired
  bool get isExpired => DateTime.now().isAfter(expiresAt);

  /// Check if request is pending
  bool get isPending => status == AuthRequestStatus.pending && !isExpired;

  /// Check if approved
  bool get isApproved => status == AuthRequestStatus.approved;

  /// Check if rejected
  bool get isRejected => status == AuthRequestStatus.rejected;

  /// Time remaining before expiry
  Duration get timeRemaining {
    final remaining = expiresAt.difference(DateTime.now());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  /// Parse a dynamic timestamp value (ISO8601 string or null)
  static DateTime? _parseTimestamp(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  /// Create from JSON map
  factory StoreAuthRequestModel.fromJson(Map<String, dynamic> data, {String? id}) {
    return StoreAuthRequestModel(
      id: id ?? data['id'] ?? '',
      sellerId: data['sellerId'] ?? data['seller_id'] ?? '',
      sellerEmail: data['sellerEmail'] ?? data['seller_email'] ?? '',
      deviceInfo: data['deviceInfo'] ?? data['device_info'] ?? '',
      ipAddress: data['ipAddress'] ?? data['ip_address'],
      location: data['location'],
      status: AuthRequestStatus.values.firstWhere(
        (e) => e.name == data['status'],
        orElse: () => AuthRequestStatus.pending,
      ),
      authToken: data['authToken'] ?? data['auth_token'],
      requestedAt: _parseTimestamp(data['requestedAt'] ?? data['requested_at']) ?? DateTime.now(),
      expiresAt: _parseTimestamp(data['expiresAt'] ?? data['expires_at']) ?? 
          DateTime.now().add(const Duration(minutes: 5)),
      respondedAt: _parseTimestamp(data['respondedAt'] ?? data['responded_at']),
    );
  }

  /// Convert to JSON map
  Map<String, dynamic> toJson() {
    return {
      'seller_id': sellerId,
      'seller_email': sellerEmail,
      'device_info': deviceInfo,
      'ip_address': ipAddress,
      'location': location,
      'status': status.name,
      'auth_token': authToken,
      'requested_at': requestedAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
      'responded_at': respondedAt?.toIso8601String(),
    };
  }

  /// Copy with new values
  StoreAuthRequestModel copyWith({
    String? id,
    String? sellerId,
    String? sellerEmail,
    String? deviceInfo,
    String? ipAddress,
    String? location,
    AuthRequestStatus? status,
    String? authToken,
    DateTime? requestedAt,
    DateTime? expiresAt,
    DateTime? respondedAt,
  }) {
    return StoreAuthRequestModel(
      id: id ?? this.id,
      sellerId: sellerId ?? this.sellerId,
      sellerEmail: sellerEmail ?? this.sellerEmail,
      deviceInfo: deviceInfo ?? this.deviceInfo,
      ipAddress: ipAddress ?? this.ipAddress,
      location: location ?? this.location,
      status: status ?? this.status,
      authToken: authToken ?? this.authToken,
      requestedAt: requestedAt ?? this.requestedAt,
      expiresAt: expiresAt ?? this.expiresAt,
      respondedAt: respondedAt ?? this.respondedAt,
    );
  }
}
