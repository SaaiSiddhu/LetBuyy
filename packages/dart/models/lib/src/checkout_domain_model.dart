/// Native projection of @letbuyy/shared-types CheckoutDomainSetupSchema.
/// Addresses and readiness come from the server; clients never derive a host.
class CheckoutDomainSetup {
  CheckoutDomainSetup._({
    required this.siteId,
    required this.hostname,
    required this.parentHostname,
    required this.source,
    required this.status,
    required this.sslStatus,
    required this.checkoutOrigin,
    required this.fallbackOrigin,
    required this.reason,
    required this.dnsRecords,
  });

  factory CheckoutDomainSetup.fromJson(Map<String, dynamic> json) {
    String text(String key, {int max = 253}) {
      final value = json[key];
      if (value is! String || value.isEmpty || value.length > max) {
        throw const FormatException('Invalid checkout address response');
      }
      return value;
    }

    String? optional(String key, int max) {
      if (json[key] == null) return null;
      return text(key, max: max);
    }

    String choice(String key, Set<String> values) {
      final value = text(key);
      if (!values.contains(value))
        throw const FormatException('Invalid checkout address state');
      return value;
    }

    String origin(String key) {
      final value = text(key, max: 2048),
          uri = Uri.tryParse(text(key, max: 2048));
      final local =
          uri?.host == 'localhost' ||
          (uri?.host.endsWith('.localhost') ?? false);
      if (uri == null ||
          !uri.hasAuthority ||
          uri.userInfo.isNotEmpty ||
          uri.hasQuery ||
          uri.hasFragment ||
          uri.path.isNotEmpty ||
          (uri.scheme != 'https' && !(local && uri.scheme == 'http'))) {
        throw const FormatException('Invalid checkout origin');
      }
      return value;
    }

    final siteId = text('site_id', max: 36);
    if (!RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(siteId)) {
      throw const FormatException('Invalid checkout site');
    }
    final hostname = optional('hostname', 253);
    final source = optional('source', 8);
    if (source != null && source != 'platform' && source != 'custom') {
      throw const FormatException('Invalid checkout address source');
    }
    final status = choice('status', {
      'pending',
      'verifying',
      'active',
      'error',
      'unavailable',
    });
    final ssl = choice('ssl_status', {
      'unknown',
      'pending',
      'active',
      'error',
      'unavailable',
    });
    final checkout = origin('checkout_origin'),
        fallback = origin('fallback_origin');
    if (status == 'active' &&
        (hostname == null ||
            ssl != 'active' ||
            checkout != 'https://$hostname')) {
      throw const FormatException('Inconsistent checkout readiness');
    }
    final records = json['dns_records'];
    if (records is! List || records.length > 4)
      throw const FormatException('Invalid checkout DNS records');
    return CheckoutDomainSetup._(
      siteId: siteId,
      hostname: hostname,
      parentHostname: optional('parent_hostname', 253),
      source: source,
      status: status,
      sslStatus: ssl,
      checkoutOrigin: checkout,
      fallbackOrigin: fallback,
      reason: optional('reason', 100),
      dnsRecords: List.unmodifiable(
        records.map((record) {
          if (record is! Map ||
              !{'CNAME', 'TXT'}.contains(record['type']) ||
              record['name'] is! String ||
              (record['name'] as String).length > 300 ||
              record['value'] is! String ||
              (record['value'] as String).length > 1000) {
            throw const FormatException('Invalid checkout DNS record');
          }
          return CheckoutDnsRecord(
            type: record['type'] as String,
            name: record['name'] as String,
            value: record['value'] as String,
          );
        }),
      ),
    );
  }

  final String siteId;
  final String? hostname, parentHostname, source, reason;
  final String status, sslStatus, checkoutOrigin, fallbackOrigin;
  final List<CheckoutDnsRecord> dnsRecords;
  bool get isReady => status == 'active' && sslStatus == 'active';
}

class CheckoutDnsRecord {
  const CheckoutDnsRecord({
    required this.type,
    required this.name,
    required this.value,
  });
  final String type, name, value;
}
