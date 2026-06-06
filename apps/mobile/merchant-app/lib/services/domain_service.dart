import 'package:flutter/foundation.dart';

import '../models/store_model.dart';
import 'api_client.dart';
import 'skip_needs_backend_exception.dart';

class DomainService extends ChangeNotifier {
  DomainService({required ApiClient api}) : _api = api;

  static const missingLifecycleRouteId = 'MOBILE_DOMAIN_LIFECYCLE';
  static const cnameTarget = 'stores.letbuyy.store';

  final ApiClient _api;

  StoreModel? _latestStore;
  StoreModel? get latestStore => _latestStore;

  DomainSettingsSnapshot snapshotForStore(StoreModel store) {
    return DomainSettingsSnapshot.fromStore(store);
  }

  Future<StoreModel> saveCustomDomain(StoreModel store, String? domain) async {
    final normalized = normalizeDomain(domain);
    final updated = StoreModel.fromJson(
      await _api.stores.update(store.id, {'custom_domain': normalized}),
    );
    _latestStore = updated;
    notifyListeners();
    return updated;
  }

  Future<StoreModel> clearCustomDomain(StoreModel store) {
    return saveCustomDomain(store, null);
  }

  Future<DomainAvailability> checkAvailability(String domain) async {
    final normalized = normalizeDomain(domain);
    if (normalized == null) {
      throw ArgumentError.value(domain, 'domain', 'Domain is required');
    }
    // [SKIP-NEEDS-BACKEND: MOBILE_DOMAIN_LIFECYCLE]
    throw const SkipNeedsBackendException(
      missingLifecycleRouteId,
      'Gateway does not expose /v1/domains/check for mobile-safe custom-domain availability checks.',
    );
  }

  Future<StoreModel> verifyDomain(StoreModel store) async {
    // [SKIP-NEEDS-BACKEND: MOBILE_DOMAIN_LIFECYCLE]
    throw const SkipNeedsBackendException(
      missingLifecycleRouteId,
      'Gateway does not expose a tenant-safe /v1/stores/:id/domain verification lifecycle route.',
    );
  }

  Future<StoreModel> refreshSslStatus(StoreModel store) async {
    // [SKIP-NEEDS-BACKEND: MOBILE_DOMAIN_LIFECYCLE]
    throw const SkipNeedsBackendException(
      missingLifecycleRouteId,
      'Gateway does not expose domain SSL status polling for mobile custom domains.',
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

class DomainSettingsSnapshot {
  const DomainSettingsSnapshot({
    required this.storeId,
    required this.subdomain,
    required this.defaultDomain,
    required this.customDomain,
    required this.customDomainStatus,
    required this.sslActive,
    required this.records,
  });

  factory DomainSettingsSnapshot.fromStore(StoreModel store) {
    final customDomain = DomainService.normalizeDomain(store.customDomain);
    return DomainSettingsSnapshot(
      storeId: store.id,
      subdomain: store.subdomain,
      defaultDomain: '${store.subdomain}.letbuyy.store',
      customDomain: customDomain,
      customDomainStatus: store.customDomainStatus ?? 'pending',
      sslActive: store.sslActive,
      records: DomainDnsRecord.fromDnsConfig(
        store.dnsConfig,
        customDomain: customDomain,
      ),
    );
  }

  final String storeId;
  final String subdomain;
  final String defaultDomain;
  final String? customDomain;
  final String customDomainStatus;
  final bool sslActive;
  final List<DomainDnsRecord> records;

  bool get hasCustomDomain => customDomain != null && customDomain!.isNotEmpty;

  String get statusLabel {
    if (!hasCustomDomain) return 'Not connected';
    if (customDomainStatus == 'active') return 'Verified';
    if (customDomainStatus == 'rejected') return 'Rejected';
    return 'Pending verification';
  }

  String get sslLabel => sslActive ? 'SSL active' : 'SSL pending';
}

class DomainDnsRecord {
  const DomainDnsRecord({
    required this.type,
    required this.host,
    required this.value,
    required this.status,
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

    if (records.isEmpty && customDomain != null) {
      records.add(
        DomainDnsRecord(
          type: 'CNAME',
          host: customDomain,
          value: DomainService.cnameTarget,
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
