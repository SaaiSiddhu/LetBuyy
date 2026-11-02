import 'checkout_domain_model.dart';

/// Mirrors DomainCustomerVerificationSchema; no auth authority is inferred.
class DomainCustomerVerification {
  const DomainCustomerVerification._(this.status);
  factory DomainCustomerVerification.fromJson(Map<String, dynamic> value) {
    if (!{
      'ready',
      'pending',
      'unavailable',
      'capacity_reached',
      'configuration_required',
    }.contains(value['status'])) {
      throw const FormatException('Invalid customer verification status');
    }
    return DomainCustomerVerification._(value['status'] as String);
  }
  final String status;
}

class DomainVerificationEvent {
  DomainVerificationEvent._(
    this.checkType,
    this.status,
    this.createdAt,
    this.txtVerified,
    this.cnameVerified,
    this.sslActive,
  );
  factory DomainVerificationEvent.fromJson(Map<String, dynamic> value) {
    if (value['check_type'] is! String ||
        value['status'] is! String ||
        value['txt_verified'] is! bool ||
        value['cname_verified'] is! bool ||
        value['ssl_active'] is! bool) {
      throw const FormatException('Invalid domain history event');
    }
    return DomainVerificationEvent._(
      value['check_type'] as String,
      value['status'] as String,
      value['created_at'] as String?,
      value['txt_verified'] as bool,
      value['cname_verified'] as bool,
      value['ssl_active'] as bool,
    );
  }
  final String checkType, status;
  final String? createdAt;
  final bool txtVerified, cnameVerified, sslActive;
}

/// Mirrors the existing API-client DomainListResult / SiteDomainRecord contract.
class SiteDomainRecord {
  SiteDomainRecord._(
    this.siteId,
    this.domain,
    this.role,
    this.status,
    this.sslStatus,
    this.provider,
    this.redirectTo,
  );
  factory SiteDomainRecord.fromJson(Map<String, dynamic> value) {
    if (value['site_id'] is! String ||
        value['domain'] is! String ||
        !{'primary', 'redirect'}.contains(value['role']) ||
        !{
          'none',
          'pending',
          'review',
          'verifying',
          'active',
          'error',
        }.contains(value['status']) ||
        value['ssl_status'] is! String)
      throw const FormatException('Invalid connected domain');
    return SiteDomainRecord._(
      value['site_id'] as String,
      value['domain'] as String,
      value['role'] as String,
      value['status'] as String,
      value['ssl_status'] as String,
      value['provider'] as String?,
      value['redirect_to'] as String?,
    );
  }
  final String siteId, domain, role, status, sslStatus;
  final String? provider, redirectTo;
  bool get isPrimary => role == 'primary';
  bool get isReady => status == 'active' && sslStatus == 'active';
}

class DomainConnectionResult {
  DomainConnectionResult._(
    this.domain,
    this.status,
    this.role,
    this.records,
    this.checkout,
  );
  factory DomainConnectionResult.fromJson(Map<String, dynamic> value) {
    if (value['domain'] is! String ||
        value['status'] is! String ||
        value['records'] is! Map) {
      throw const FormatException('Invalid domain connection');
    }
    final records = <CheckoutDnsRecord>[];
    final hints = Map<String, dynamic>.from(value['records'] as Map);
    for (final entry in hints.entries) {
      if (!{'txt', 'cname', 'apex_alias'}.contains(entry.key) ||
          entry.value is! Map)
        continue;
      final record = entry.value as Map;
      if (record['name'] is! String || record['value'] is! String)
        throw const FormatException('Invalid DNS instructions');
      records.add(
        CheckoutDnsRecord(
          type: entry.key == 'apex_alias' ? 'ALIAS' : entry.key.toUpperCase(),
          name: record['name'] as String,
          value: record['value'] as String,
        ),
      );
    }
    return DomainConnectionResult._(
      value['domain'] as String,
      value['status'] as String,
      value['role'] as String?,
      List.unmodifiable(records),
      value['checkout'] is Map
          ? CheckoutDomainSetup.fromJson(
              Map<String, dynamic>.from(value['checkout'] as Map),
            )
          : null,
    );
  }
  final String domain, status;
  final String? role;
  final List<CheckoutDnsRecord> records;
  final CheckoutDomainSetup? checkout;
}
