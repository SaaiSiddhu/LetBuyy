// Explicit owned lane only, outside ordinary test discovery. Actual HTTP ->
// production worker -> PostgREST -> PostgreSQL; no Dio interceptors or API stubs.
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  final raw = Platform.environment['LETBUYY_BUYER_ORDERS_FIXTURE'];
  final url = Uri.tryParse(Platform.environment['LETBUYY_API_URL'] ?? '');
  if (raw == null || Platform.environment['LETBUYY_OWNED_CLIENT_RUNTIME'] != '1' || url == null
      || url.scheme != 'http' || !['localhost', '127.0.0.1', '::1'].contains(url.host) || url.userInfo.isNotEmpty) {
    throw StateError('An explicit owned loopback Gateway fixture is required.');
  }
  final fixture = jsonDecode(raw) as Map<String, dynamic>;
  if (fixture['run_id'] != Platform.environment['LETBUYY_EXECUTABLE_RUN_ID']) throw StateError('Fixture owner mismatch.');

  test('actual Dart order reads isolate buyers, paginate, revoke and recover from a real database outage', () async {
    final dio = Dio(); addTearDown(() => dio.close(force: true));
    final api = BuyerOrdersApi(ApiClient(baseUrl: url.toString(), dio: dio, maxRetries: 0));
    final a = fixture['token_a'] as String, b = fixture['token_b'] as String;
    final expected = List<String>.from(fixture['orders_a'] as List);
    final seen = <String>[];
    String? cursor;
    var pages = 0;
    do {
      final page = await api.list(a, limit: 1, cursor: cursor);
      expect(page.orders.length, 1);
      seen.add(page.orders.single['id'] as String);
      cursor = page.nextCursor;
      expect(++pages, lessThanOrEqualTo(3));
      if (!page.hasMore) break;
      expect(cursor, isNotNull);
    } while (true);
    expect(seen.toSet(), expected.toSet()); expect(seen.length, expected.length);
    for (final id in expected) {
      final detail = await api.get(a, id);
      expect(detail['id'], id); expect(detail['items'], isNotEmpty);
      expect(detail.containsKey('customer_email'), isFalse); expect(detail.containsKey('store_id'), isFalse);
    }
    final bPage = await api.list(b);
    expect(bPage.orders.map((row) => row['id']).toList(), [fixture['order_b']]);
    // Concurrent callers share the SDK/Dio instance. Per-request credentials
    // must not overwrite another buyer's authorization headers.
    final concurrent = await Future.wait([
      api.get(a, expected.first),
      api.get(b, fixture['order_b'] as String),
    ]);
    expect(concurrent.map((row) => row['id']).toList(), [expected.first, fixture['order_b']]);
    await expectLater(api.get(b, expected.first), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 404)));
    for (final token in [fixture['expired_token'], fixture['wrong_realm_token']]) {
      await expectLater(api.list(token as String), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    }
    Future<void> control(String action) async {
      final http = HttpClient();
      try {
        final request = await http.postUrl(url.resolve('/_owned/buyer-orders/control'));
        request.headers.set('X-Owned-Test-Nonce', fixture['control_nonce'] as String);
        request.write(jsonEncode({'action': action}));
        final response = await request.close(); expect(response.statusCode, 204); await response.drain();
      } finally { http.close(force: true); }
    }
    await control('revoke_a');
    await expectLater(api.get(a, expected.first), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 401)));
    expect((await api.list(b)).orders.single['id'], fixture['order_b']);
    await control('interrupt_order_reads');
    try {
      await expectLater(api.get(b, fixture['order_b'] as String), throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 500)));
    } finally { await control('restore_order_reads'); }
    expect((await api.get(b, fixture['order_b'] as String))['id'], fixture['order_b']);
  });
}
