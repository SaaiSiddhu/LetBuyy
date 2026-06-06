import 'package:flutter/foundation.dart';

import 'api_client.dart';

/// Domain verification status
enum DomainStatus { pending, verifying, verified, failed, expired }

/// Domain configuration model
class DomainConfig {
  final String storeId;
  final String subdomain;
  final String? customDomain;
  final DomainStatus status;
  final String? verificationToken;
  final DateTime? verifiedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<DnsRecord> requiredRecords;
  final String? errorMessage;

  DomainConfig({
    required this.storeId,
    required this.subdomain,
    this.customDomain,
    this.status = DomainStatus.pending,
    this.verificationToken,
    this.verifiedAt,
    required this.createdAt,
    required this.updatedAt,
    this.requiredRecords = const [],
    this.errorMessage,
  });

  /// Get the active domain (custom if verified, otherwise subdomain)
  String get activeDomain {
    if (customDomain != null && status == DomainStatus.verified) {
      return customDomain!;
    }
    return '$subdomain.letbuyy.store';
  }

  /// Get the full store URL
  String get storeUrl => 'https://$activeDomain';

  /// Check if custom domain is configured
  bool get hasCustomDomain => customDomain != null && customDomain!.isNotEmpty;

  /// Parse a dynamic timestamp value (ISO8601 string or DateTime)
  static DateTime? _parseTimestamp(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  factory DomainConfig.fromJson(Map<String, dynamic> map) {
    return DomainConfig(
      storeId: map['storeId'] ?? map['store_id'] ?? '',
      subdomain: map['subdomain'] ?? '',
      customDomain: map['customDomain'] ?? map['custom_domain'],
      status: DomainStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => DomainStatus.pending,
      ),
      verificationToken: map['verificationToken'] ?? map['verification_token'],
      verifiedAt: _parseTimestamp(map['verifiedAt'] ?? map['verified_at']),
      createdAt:
          _parseTimestamp(map['createdAt'] ?? map['created_at']) ??
          DateTime.now(),
      updatedAt:
          _parseTimestamp(map['updatedAt'] ?? map['updated_at']) ??
          DateTime.now(),
      requiredRecords:
          (map['requiredRecords'] ?? map['required_records'] as List?)
              ?.map((e) => DnsRecord.fromMap(e as Map<String, dynamic>))
              .toList() ??
          [],
      errorMessage: map['errorMessage'] ?? map['error_message'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'store_id': storeId,
      'subdomain': subdomain,
      'custom_domain': customDomain,
      'status': status.name,
      'verification_token': verificationToken,
      'verified_at': verifiedAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'required_records': requiredRecords.map((e) => e.toMap()).toList(),
      'error_message': errorMessage,
    };
  }

  DomainConfig copyWith({
    String? storeId,
    String? subdomain,
    String? customDomain,
    DomainStatus? status,
    String? verificationToken,
    DateTime? verifiedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<DnsRecord>? requiredRecords,
    String? errorMessage,
  }) {
    return DomainConfig(
      storeId: storeId ?? this.storeId,
      subdomain: subdomain ?? this.subdomain,
      customDomain: customDomain ?? this.customDomain,
      status: status ?? this.status,
      verificationToken: verificationToken ?? this.verificationToken,
      verifiedAt: verifiedAt ?? this.verifiedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
      requiredRecords: requiredRecords ?? this.requiredRecords,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

/// DNS record requirement for domain verification
class DnsRecord {
  final String type; // CNAME, A, TXT
  final String name;
  final String value;
  final bool isVerified;

  DnsRecord({
    required this.type,
    required this.name,
    required this.value,
    this.isVerified = false,
  });

  factory DnsRecord.fromMap(Map<String, dynamic> map) {
    return DnsRecord(
      type: map['type'] ?? '',
      name: map['name'] ?? '',
      value: map['value'] ?? '',
      isVerified: map['isVerified'] ?? map['is_verified'] ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'type': type,
      'name': name,
      'value': value,
      'is_verified': isVerified,
    };
  }
}

/// Service for managing store domains via the API.
///
/// Replaces direct database access with REST calls to the Hono backend.
class DomainService {
  final ApiClient _api;

  DomainService({required ApiClient api}) : _api = api;

  /// Get domain configuration for a store
  Future<DomainConfig?> getDomainConfig(String storeId) async {
    try {
      final res = await _api.get('stores/$storeId/domain');
      if (res['data'] == null) return null;
      return DomainConfig.fromJson(res['data'] as Map<String, dynamic>);
    } catch (e) {
      debugPrint('Error fetching domain config: $e');
      return null;
    }
  }

  /// Check if a subdomain is available
  Future<bool> isSubdomainAvailable(String subdomain) async {
    try {
      // Validate subdomain format
      if (!_isValidSubdomain(subdomain)) {
        return false;
      }

      final res = await _api.get(
        'domains/check',
        query: {'subdomain': subdomain.toLowerCase()},
      );
      return res['available'] == true;
    } on ApiException catch (e) {
      if (e.statusCode == 404) return true; // not found → available
      debugPrint('Error checking subdomain: $e');
      return false;
    } catch (e) {
      debugPrint('Error checking subdomain: $e');
      return false;
    }
  }

  /// Validate subdomain format
  bool _isValidSubdomain(String subdomain) {
    // Must be 3-63 characters, lowercase alphanumeric with hyphens
    // Cannot start or end with hyphen
    final regex = RegExp(r'^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$');
    return regex.hasMatch(subdomain.toLowerCase());
  }

  /// Update subdomain for a store
  Future<bool> updateSubdomain({
    required String storeId,
    required String newSubdomain,
  }) async {
    try {
      await _api.patch(
        'stores/$storeId',
        body: {'subdomain': newSubdomain.toLowerCase()},
      );
      return true;
    } catch (e) {
      debugPrint('Error updating subdomain: $e');
      return false;
    }
  }

  /// Set up custom domain for a store
  Future<DomainConfig?> setupCustomDomain({
    required String storeId,
    required String customDomain,
  }) async {
    try {
      final res = await _api.post(
        'stores/$storeId/domain',
        body: {'custom_domain': customDomain.toLowerCase()},
      );

      if (res['data'] == null) return null;
      return DomainConfig.fromJson(res['data'] as Map<String, dynamic>);
    } catch (e) {
      debugPrint('Error setting up custom domain: $e');
      return null;
    }
  }

  /// Verify domain DNS configuration
  Future<DomainConfig?> verifyDomain(String storeId) async {
    try {
      final res = await _api.post('stores/$storeId/domain/verify');
      if (res['data'] == null) return null;
      return DomainConfig.fromJson(res['data'] as Map<String, dynamic>);
    } catch (e) {
      debugPrint('Error verifying domain: $e');
      return null;
    }
  }

  /// Remove custom domain
  Future<bool> removeCustomDomain(String storeId) async {
    try {
      await _api.delete('stores/$storeId/domain');
      return true;
    } catch (e) {
      debugPrint('Error removing custom domain: $e');
      return false;
    }
  }
}
