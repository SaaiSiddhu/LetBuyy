import 'dart:io';

import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  test('lists real storefront products from the local gateway', () async {
    if (Platform.environment['LETBUYY_API_CLIENT_E2E'] != '1') {
      markTestSkipped(
        'Set LETBUYY_API_CLIENT_E2E=1 to run local gateway proof.',
      );
      return;
    }

    final baseUrl =
        Platform.environment['LETBUYY_API_BASE_URL'] ??
        'http://127.0.0.1:8787/v1';
    final subdomain =
        Platform.environment['LETBUYY_API_CLIENT_SUBDOMAIN'] ??
        'urban-kicks-demo';
    final client = ApiClient(
      baseUrl: baseUrl,
      headers: const {'X-Client': 'flutter-builder-test'},
      requestIdFactory: () => 'flutter-builder-test-local-products',
    );

    addTearDown(client.close);

    final page = await client.storefront.listProducts(
      subdomain,
      query: const {'limit': 5},
    );

    expect(page.data, isNotEmpty);
    expect(page.data.first, containsPair('id', isA<String>()));
  });
}
