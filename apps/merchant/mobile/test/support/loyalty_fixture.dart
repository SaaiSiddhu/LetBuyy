// Synthetic transport/storage fixtures only. No database or device proof is claimed here.
import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_store/services/api_client.dart';

const siteA = '22222222-2222-4222-8222-222222222222',
    siteB = '33333333-3333-4333-8333-333333333333';
const initialVersion = '2026-10-16T05:00:00.123456Z';
JsonMap form({String value = '100', bool active = true}) => {
  'expected_updated_at': initialVersion,
  'is_active': active,
  'earn_rate_bps': 1234,
  'redeem_cap_bps': 5000,
  'point_value_minor': value,
};
JsonMap program(String site, {bool active = true, String value = '100'}) => {
  'site_id': site,
  'is_active': active,
  'earn_rate_bps': 1234,
  'redeem_cap_bps': 5000,
  'point_value_minor': value,
  'updated_at': initialVersion,
};
JsonMap snapshot(
  String site, {
  bool enrolled = true,
  bool active = true,
  String points = '41',
  bool decrease = false,
  String value = '100',
}) => {
  'store_id': site,
  'enrolled': enrolled,
  'program': enrolled ? program(site, active: active, value: value) : null,
  'outstanding_points': points,
  'valuation_policy': 'block_decrease_while_outstanding',
  'value_decrease_allowed': decrease,
};

class MemoryStorage extends FlutterSecureStorage {
  final data = <String, String>{};
  bool failWrite = false;
  Completer<void>? holdWrite, writeEntered;
  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => data[key];
  @override
  Future<void> write({
    required String key,
    required String? value,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    writeEntered?.complete();
    await holdWrite?.future;
    if (failWrite) throw StateError('Synthetic encrypted storage unavailable');
    if (value != null) data[key] = value;
  }

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    data.remove(key);
  }
}

class LoyaltyTransport extends ApiClient {
  LoyaltyTransport({Object? Function()? context})
    : super(
        baseUrl: 'https://gateway.example.invalid/v1',
        maxRetries: 0,
        contextVersionProvider: context,
      );
  final reads = <ApiRequestOptions>[], writes = <ApiRequestOptions>[];
  final snapshots = <String, JsonMap>{
    siteA: snapshot(siteA),
    siteB: snapshot(siteB, points: '0', value: '200'),
  };
  ApiException? readFailure, writeFailure;
  bool malformedReply = false;
  Completer<void>? holdRead, holdSave, readEntered, saveEntered;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    final o = options!;
    if (o.method == HttpMethod.put) {
      writes.add(o);
      saveEntered?.complete();
      await holdSave?.future;
      if (writeFailure != null) throw writeFailure!;
      if (malformedReply) return {};
      final input = asJsonMap(o.body);
      final site = input['store_id'] as String;
      final p =
          {
              ...program(site),
              ...input,
              'updated_at': '2026-10-16T05:00:01.654321Z',
            }
            ..remove('store_id')
            ..remove('expected_updated_at');
      snapshots[site] = {...snapshots[site]!, 'enrolled': true, 'program': p};
      return {
        ...p,
        'created': false,
        'outstanding_points': snapshots[site]!['outstanding_points'],
        'valuation_policy': 'block_decrease_while_outstanding',
        'value_decrease_allowed': false,
        'liability_delta_minor': '0',
      };
    }
    reads.add(o);
    final captured = Map<String, dynamic>.from(snapshots[o.storeId]!);
    readEntered?.complete();
    await holdRead?.future;
    if (readFailure != null) throw readFailure!;
    return captured;
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async => PaginatedResponse(
    data: [
      {'id': siteA, 'name': 'Synthetic A', 'subdomain': 'synthetic-a'},
      {'id': siteB, 'name': 'Synthetic B', 'subdomain': 'synthetic-b'},
    ],
    page: 1,
    limit: 50,
    total: 2,
    hasMore: false,
  );
}

const unavailable = ApiException(
  message: 'Synthetic service unavailable',
  statusCode: 503,
  code: 'UNAVAILABLE',
);
