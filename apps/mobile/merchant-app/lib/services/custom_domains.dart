import 'package:flutter/foundation.dart';

import '../models/store_model.dart';
import 'api_client.dart';

class DomainService extends ChangeNotifier {
  DomainService({required ApiClient api}) : _api = api;

  static const cnameTarget = String.fromEnvironment(
    'NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET',
  );

  final ApiClient _api;

  StoreModel? _latestStore;
  StoreModel? get latestStore => _latestStore;

  DomainSettingsSnapshot snapshotForStore(StoreModel store) {
    return DomainSettingsSnapshot.fromStore(store);
  }

  Future<StoreModel> saveCustomDomain(StoreModel store, String? domain) async {
    final normalized = normalizeDomain(domain);
    if (normalized == null) return clearCustomDomain(store);
    final payload = _asMap(
      await _api.post(
        '/custom/domains',
        body: {'site_id': store.id, 'domain': normalized},
      ),
    );
    final data = _asMap(payload['data']);
    final updated = store.copyWith(
      customDomain: normalized,
      customDomainStatus: '${data['status'] ?? 'pending'}',
      dnsConfig: {
        ...Map<String, dynamic>.from(data['records'] as Map? ?? {}),
        'apex_mx_warning': data['apex_mx_warning'] == true,
      },
    );
    _latestStore = updated;
    notifyListeners();
    return updated;
  }

  Future<StoreModel> clearCustomDomain(StoreModel store) async {
    final domain = normalizeDomain(store.customDomain);
    if (domain == null) return store;
    await _api.delete(
      '/custom/domains/$domain?site_id=${Uri.encodeComponent(store.id)}',
    );
    final updated = store.copyWith(
      customDomain: '',
      customDomainStatus: 'none',
      dnsConfig: const {},
    );
    _latestStore = updated;
    notifyListeners();
    return updated;
  }

  Future<DomainAvailability> checkAvailability(String domain) async {
    final normalized = normalizeDomain(domain);
    if (normalized == null) {
      throw ArgumentError.value(domain, 'domain', 'Domain is required');
    }
    return DomainAvailability(
      domain: normalized,
      available: true,
      message:
          'Domain format is valid. Tap Save domain to create the LetBuyy ownership challenge.',
    );
  }

  Future<DomainPurchaseQuote> searchDomainToBuy(String domain) async {
    final normalized = normalizeDomain(domain);
    if (normalized == null) {
      throw ArgumentError.value(domain, 'domain', 'Domain is required');
    }
    final payload = _asMap(await _api.domains.search(normalized));
    final data = _asMap(payload['data'] ?? payload);
    return DomainPurchaseQuote.fromMap(data, fallbackDomain: normalized);
  }

  Future<DomainPurchaseResult> purchaseDomain(
    StoreModel store, {
    required DomainPurchaseQuote quote,
    required String ownerName,
    required String ownerEmail,
    String? paymentReference,
    int years = 1,
  }) async {
    final checkoutMode = quote.provider == 'mock'
        ? 'sandbox'
        : 'external_reference';
    final reference = paymentReference?.trim().isNotEmpty == true
        ? paymentReference!.trim()
        : '$checkoutMode:domain_checkout:${store.id}:${quote.domain}';
    final payload = _asMap(
      await _api.domains.purchase({
        'site_id': store.id,
        'domain': quote.domain,
        'years': years,
        'checkout_mode': checkoutMode,
        'payment_reference': reference,
        'owner': {'name': ownerName, 'email': ownerEmail},
      }),
    );
    final data = _asMap(payload['data'] ?? payload);
    return DomainPurchaseResult.fromMap(data, fallbackDomain: quote.domain);
  }

  Future<StoreModel> verifyDomain(StoreModel store) async {
    final domain = normalizeDomain(store.customDomain);
    if (domain == null) return store;
    final payload = _asMap(
      await _api.post(
        '/custom/domains/verify',
        body: {'site_id': store.id, 'domain': domain},
      ),
    );
    final data = _asMap(payload['data']);
    final updated = store.copyWith(
      customDomainStatus: '${data['status'] ?? payload['status'] ?? 'pending'}',
      sslActive:
          data['ssl_active'] == true ||
          (data['status'] == 'active' && data['cname_verified'] == true),
    );
    _latestStore = updated;
    notifyListeners();
    return updated;
  }

  Future<DomainHealthSnapshot?> fetchDomainHealth(StoreModel store) async {
    final domain = normalizeDomain(store.customDomain);
    if (domain == null) return null;
    final payload = await _api.customDomains.health(domain, siteId: store.id);
    final data = _asMap(payload['data'] ?? payload);
    return DomainHealthSnapshot.fromMap(
      data,
      fallbackDomain: domain,
      fallbackStatus: store.customDomainStatus ?? 'pending',
      fallbackSslActive: store.sslActive,
    );
  }

  Future<StoreModel> refreshSslStatus(StoreModel store) async {
    final health = await fetchDomainHealth(store);
    if (health == null) return store;
    final updated = store.copyWith(
      customDomainStatus: health.status,
      sslActive: health.sslActive,
      dnsConfig: health.toDnsConfig(),
    );
    _latestStore = updated;
    notifyListeners();
    return updated;
  }

  Future<StoreModel> updateStoreAccess(
    StoreModel store, {
    required String accessMode,
    String? password,
    String? message,
  }) async {
    await _api.put(
      '/store-access',
      body: {
        'site_id': store.id,
        'access_mode': accessMode,
        if (password != null && password.isNotEmpty) 'password': password,
        'access_message': message,
      },
    );
    final updated = store.copyWith(
      accessMode: accessMode,
      accessMessage: message,
    );
    _latestStore = updated;
    notifyListeners();
    return updated;
  }

  Future<PreviewLinkResult> createPreviewLink(
    StoreModel store, {
    required String host,
    String scope = 'share-link',
    String? themeId,
  }) async {
    final payload = _asMap(
      await _api.post(
        '/store-access/preview-links',
        body: {
          'site_id': store.id,
          'scope': scope,
          'host': host,
          if (themeId != null) 'theme_id': themeId,
        },
      ),
    );
    final data = _asMap(payload['data']);
    return PreviewLinkResult(
      token: '${data['token'] ?? ''}',
      jti: '${data['jti'] ?? ''}',
      host: '${data['host'] ?? host}',
      expiresAt: '${data['expires_at'] ?? ''}',
    );
  }

  static String? normalizeDomain(String? domain) {
    final raw = domain?.trim();
    if (raw == null || raw.isEmpty) return null;
    var value = raw.toLowerCase();
    value = value.replaceFirst(RegExp(r'^https?://'), '');
    value = value.split('/').first;
    value = value.split('?').first;
    value = value.split('#').first;
    value = value.replaceAll(RegExp(r'\s+'), '');
    while (value.endsWith('.')) {
      value = value.substring(0, value.length - 1);
    }
    return value.isEmpty ? null : value;
  }
}

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

List<String> _asStringList(Object? value) {
  if (value is List) {
    return value.map((item) => '$item').toList(growable: false);
  }
  return const [];
}

DateTime? _parseDate(Object? value) {
  if (value is DateTime) return value;
  if (value is String && value.trim().isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

class DomainSettingsSnapshot {
  const DomainSettingsSnapshot({
    required this.storeId,
    required this.subdomain,
    required this.defaultDomain,
    required this.customDomain,
    required this.customDomainStatus,
    required this.accessMode,
    required this.accessMessage,
    required this.published,
    required this.sslActive,
    required this.records,
    required this.apexMxWarning,
    required this.health,
  });

  factory DomainSettingsSnapshot.fromStore(StoreModel store) {
    final customDomain = DomainService.normalizeDomain(store.customDomain);
    final health = DomainHealthSnapshot.fromDnsConfigOrNull(
      store.dnsConfig,
      customDomain: customDomain,
      fallbackStatus: store.customDomainStatus ?? 'none',
      fallbackSslActive: store.sslActive,
    );
    return DomainSettingsSnapshot(
      storeId: store.id,
      subdomain: store.subdomain,
      defaultDomain: '${store.subdomain}.letbuyy.store',
      customDomain: customDomain,
      customDomainStatus: store.customDomainStatus ?? 'none',
      accessMode: store.accessMode,
      accessMessage: store.accessMessage,
      published: store.published,
      sslActive: health?.sslActive ?? store.sslActive,
      records:
          health?.records ??
          DomainDnsRecord.fromDnsConfig(
            store.dnsConfig,
            customDomain: customDomain,
          ),
      apexMxWarning:
          health?.apexMxWarning ?? store.dnsConfig['apex_mx_warning'] == true,
      health: health,
    );
  }

  final String storeId;
  final String subdomain;
  final String defaultDomain;
  final String? customDomain;
  final String customDomainStatus;
  final String accessMode;
  final String? accessMessage;
  final bool published;
  final bool sslActive;
  final List<DomainDnsRecord> records;
  final bool apexMxWarning;
  final DomainHealthSnapshot? health;

  bool get hasCustomDomain => customDomain != null && customDomain!.isNotEmpty;

  String get statusLabel {
    if (!hasCustomDomain) return 'Not connected';
    if (customDomainStatus == 'active') return 'Verified';
    if (customDomainStatus == 'rejected') return 'Rejected';
    return 'Pending verification';
  }

  bool get dnsVerified => health?.dnsVerified ?? customDomainStatus == 'active';

  String get dnsLabel {
    if (!hasCustomDomain) return 'DNS not connected';
    return health?.dnsLabel ??
        (customDomainStatus == 'active' ? 'DNS verified' : 'DNS pending');
  }

  String get sslLabel =>
      health?.sslLabel ?? (sslActive ? 'SSL active' : 'SSL pending');

  String get renewalLabel =>
      health?.renewalLabel ??
      (hasCustomDomain ? 'Renewal status unavailable' : 'No custom domain');

  String? get checkedAtLabel => health?.checkedAtLabel;
}

class DomainDnsRecord {
  const DomainDnsRecord({
    required this.type,
    required this.host,
    required this.value,
    required this.status,
    this.actual = const [],
    this.message,
  });

  factory DomainDnsRecord.fromMap(
    Map<String, dynamic> data, {
    required String? customDomain,
  }) {
    return DomainDnsRecord(
      type: '${data['type'] ?? data['record_type'] ?? data['kind'] ?? 'CNAME'}'
          .toUpperCase(),
      host:
          '${data['host'] ?? data['name'] ?? data['record_name'] ?? customDomain ?? '@'}',
      value:
          '${data['value'] ?? data['target'] ?? data['record_value'] ?? DomainService.cnameTarget}',
      status: '${data['status'] ?? 'pending'}',
      actual: _asStringList(data['actual']),
      message: data['message']?.toString(),
    );
  }

  static List<DomainDnsRecord> fromDnsConfig(
    Map<String, dynamic> dnsConfig, {
    required String? customDomain,
  }) {
    final records = <DomainDnsRecord>[];
    final rawRecords = dnsConfig['records'];
    if (rawRecords is List) {
      for (final record in rawRecords) {
        if (record is Map) {
          records.add(
            DomainDnsRecord.fromMap(
              Map<String, dynamic>.from(record),
              customDomain: customDomain,
            ),
          );
        }
      }
    }

    if (records.isEmpty) {
      for (final entry in dnsConfig.entries) {
        if (entry.key == 'records') continue;
        if (entry.key == 'apex_mx_warning') continue;
        if (entry.key == 'domain_health') continue;
        final value = entry.value;
        if (value is Map) {
          records.add(
            DomainDnsRecord.fromMap({
              'type': entry.key,
              ...Map<String, dynamic>.from(value),
            }, customDomain: customDomain),
          );
        } else if (value != null && '$value'.trim().isNotEmpty) {
          records.add(
            DomainDnsRecord(
              type: entry.key.toUpperCase(),
              host: customDomain ?? '@',
              value: '$value',
              status: 'pending',
            ),
          );
        }
      }
    }

    final fallbackTarget = DomainService.cnameTarget.isNotEmpty
        ? DomainService.cnameTarget
        : 'Generated by gateway after Save domain';
    if (records.isEmpty && customDomain != null) {
      records.add(
        DomainDnsRecord(
          type: 'CNAME',
          host: customDomain,
          value: fallbackTarget,
          status: 'pending',
        ),
      );
    }
    return records;
  }

  final String type;
  final String host;
  final String value;
  final String status;
  final List<String> actual;
  final String? message;

  Map<String, dynamic> toMap() => {
    'type': type,
    'host': host,
    'value': value,
    'status': status,
    if (actual.isNotEmpty) 'actual': actual,
    if (message != null && message!.isNotEmpty) 'message': message,
  };
}

class DomainHealthSnapshot {
  const DomainHealthSnapshot({
    required this.domain,
    required this.status,
    required this.txtVerified,
    required this.cnameVerified,
    required this.sslActive,
    required this.providerStatus,
    required this.misconfigured,
    required this.apexMxWarning,
    required this.renewalStatus,
    required this.renewalDate,
    required this.checkedAt,
    required this.records,
  });

  factory DomainHealthSnapshot.fromMap(
    Map<String, dynamic> data, {
    required String fallbackDomain,
    required String fallbackStatus,
    required bool fallbackSslActive,
  }) {
    final records = (data['records'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (record) => DomainDnsRecord.fromMap(
            Map<String, dynamic>.from(record),
            customDomain: fallbackDomain,
          ),
        )
        .toList(growable: false);

    return DomainHealthSnapshot(
      domain: '${data['domain'] ?? fallbackDomain}',
      status: '${data['status'] ?? fallbackStatus}',
      txtVerified: data['txt_verified'] == true,
      cnameVerified: data['cname_verified'] == true,
      sslActive: data.containsKey('ssl_active')
          ? data['ssl_active'] == true
          : fallbackSslActive,
      providerStatus: '${data['provider_status'] ?? 'configured'}',
      misconfigured: data['misconfigured'] == true,
      apexMxWarning: data['apex_mx_warning'] == true,
      renewalStatus: '${data['renewal_status'] ?? 'unknown'}',
      renewalDate: _parseDate(data['renewal_date']),
      checkedAt: _parseDate(data['checked_at']),
      records: records.isEmpty
          ? DomainDnsRecord.fromDnsConfig(
              const {},
              customDomain: fallbackDomain,
            )
          : records,
    );
  }

  factory DomainHealthSnapshot.fromDnsConfig(
    Map<String, dynamic> dnsConfig, {
    required String? customDomain,
    required String fallbackStatus,
    required bool fallbackSslActive,
  }) {
    final raw = dnsConfig['domain_health'];
    if (raw is Map && customDomain != null) {
      return DomainHealthSnapshot.fromMap(
        Map<String, dynamic>.from(raw),
        fallbackDomain: customDomain,
        fallbackStatus: fallbackStatus,
        fallbackSslActive: fallbackSslActive,
      );
    }
    throw StateError('No cached domain health');
  }

  static DomainHealthSnapshot? fromDnsConfigOrNull(
    Map<String, dynamic> dnsConfig, {
    required String? customDomain,
    required String fallbackStatus,
    required bool fallbackSslActive,
  }) {
    try {
      return DomainHealthSnapshot.fromDnsConfig(
        dnsConfig,
        customDomain: customDomain,
        fallbackStatus: fallbackStatus,
        fallbackSslActive: fallbackSslActive,
      );
    } catch (_) {
      return null;
    }
  }

  final String domain;
  final String status;
  final bool txtVerified;
  final bool cnameVerified;
  final bool sslActive;
  final String providerStatus;
  final bool misconfigured;
  final bool apexMxWarning;
  final String renewalStatus;
  final DateTime? renewalDate;
  final DateTime? checkedAt;
  final List<DomainDnsRecord> records;

  bool get dnsVerified => txtVerified && cnameVerified;
  bool get providerUnavailable => providerStatus == 'unavailable';

  String get dnsLabel {
    if (dnsVerified) return 'DNS verified';
    if (txtVerified || cnameVerified) return 'DNS partially verified';
    return 'DNS pending';
  }

  String get sslLabel {
    if (providerUnavailable) return 'SSL status unavailable';
    if (sslActive) return 'SSL active';
    if (misconfigured) return 'SSL needs attention';
    return 'SSL pending';
  }

  String get renewalLabel {
    if (renewalStatus == 'managed') {
      final date = renewalDate;
      return date == null
          ? 'Managed renewal'
          : 'Renews ${date.toIso8601String().split('T').first}';
    }
    if (renewalStatus == 'action_required') return 'Renewal needs attention';
    return 'Renewal status unavailable';
  }

  String? get checkedAtLabel {
    final date = checkedAt;
    if (date == null) return null;
    return 'Checked ${date.toIso8601String().split('T').first}';
  }

  Map<String, dynamic> toMap() => {
    'domain': domain,
    'status': status,
    'txt_verified': txtVerified,
    'cname_verified': cnameVerified,
    'ssl_active': sslActive,
    'provider_status': providerStatus,
    'misconfigured': misconfigured,
    'apex_mx_warning': apexMxWarning,
    'renewal_status': renewalStatus,
    'renewal_date': renewalDate?.toIso8601String(),
    'checked_at': checkedAt?.toIso8601String(),
    'records': records.map((record) => record.toMap()).toList(growable: false),
  };

  Map<String, dynamic> toDnsConfig() => {
    'records': records.map((record) => record.toMap()).toList(growable: false),
    'apex_mx_warning': apexMxWarning,
    'domain_health': toMap(),
  };
}

class DomainAvailability {
  const DomainAvailability({
    required this.domain,
    required this.available,
    required this.message,
  });

  final String domain;
  final bool available;
  final String message;
}

class PreviewLinkResult {
  const PreviewLinkResult({
    required this.token,
    required this.jti,
    required this.host,
    required this.expiresAt,
  });

  final String token;
  final String jti;
  final String host;
  final String expiresAt;

  String get url => 'https://$host/?lb_preview=$token';
}

class DomainPurchaseQuote {
  const DomainPurchaseQuote({
    required this.domain,
    required this.available,
    required this.currency,
    required this.amountMinor,
    required this.provider,
    required this.premium,
  });

  factory DomainPurchaseQuote.fromMap(
    Map<String, dynamic> data, {
    required String fallbackDomain,
  }) {
    return DomainPurchaseQuote(
      domain: '${data['domain'] ?? fallbackDomain}',
      available: data['available'] == true,
      currency: '${data['currency'] ?? 'INR'}',
      amountMinor: _intValue(data['amountMinor'] ?? data['amount_minor']),
      provider: '${data['provider'] ?? ''}',
      premium: data['premium'] == true,
    );
  }

  final String domain;
  final bool available;
  final String currency;
  final int amountMinor;
  final String provider;
  final bool premium;

  String get priceLabel =>
      '$currency ${(amountMinor / 100).toStringAsFixed(2)}';
}

class DomainPurchaseResult {
  const DomainPurchaseResult({
    required this.orderId,
    required this.domain,
    required this.status,
    required this.provider,
    required this.checkoutMode,
    required this.checkoutStatus,
    required this.paymentReference,
    required this.amountMinor,
    required this.currency,
    required this.dnsConfigured,
  });

  factory DomainPurchaseResult.fromMap(
    Map<String, dynamic> data, {
    required String fallbackDomain,
  }) {
    final checkout = _asMap(data['checkout']);
    return DomainPurchaseResult(
      orderId: '${data['order_id'] ?? ''}',
      domain: '${data['domain'] ?? fallbackDomain}',
      status: '${data['status'] ?? 'provisioning'}',
      provider: '${data['provider'] ?? ''}',
      checkoutMode: '${checkout['mode'] ?? ''}',
      checkoutStatus: '${checkout['status'] ?? ''}',
      paymentReference: '${checkout['payment_reference'] ?? ''}',
      amountMinor: _intValue(checkout['amount_minor']),
      currency: '${checkout['currency'] ?? 'INR'}',
      dnsConfigured: data['dns_configured'] == true,
    );
  }

  final String orderId;
  final String domain;
  final String status;
  final String provider;
  final String checkoutMode;
  final String checkoutStatus;
  final String paymentReference;
  final int amountMinor;
  final String currency;
  final bool dnsConfigured;

  bool get checkoutVerified => checkoutStatus == 'verified';

  String get merchantMessage {
    if (checkoutVerified) {
      return 'Domain order verified and connection is running.';
    }
    return 'Domain order submitted and connection is running.';
  }
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? 0;
}
