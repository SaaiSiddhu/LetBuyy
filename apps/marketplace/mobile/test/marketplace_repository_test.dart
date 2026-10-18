// CUS-1 — the marketplace seam, exercised end to end through a fake transport.
//
// The repository is driven by a real ApiClient whose Dio is intercepted, so these tests cover the
// whole path a screen will one day take: repository → client → HTTP shape → parsed model. No
// Firebase is imported anywhere in this file or in the code it exercises, which is the point of the
// seam existing at all.

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/data/marketplace_repository.dart';

({MarketplaceRepository repository, List<RequestOptions> requests}) harness({
  Object? body,
  int statusCode = 200,
}) {
  final dio = Dio();
  final requests = <RequestOptions>[];
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        requests.add(options);
        if (statusCode >= 400) {
          handler.reject(
            DioException(
              requestOptions: options,
              response: Response<Object?>(
                requestOptions: options,
                statusCode: statusCode,
                data: body,
              ),
              type: DioExceptionType.badResponse,
            ),
          );
          return;
        }
        handler.resolve(
          Response<Object?>(requestOptions: options, statusCode: statusCode, data: body),
        );
      },
    ),
  );
  final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: dio, maxRetries: 0);
  return (repository: ApiMarketplaceRepository(client), requests: requests);
}

void main() {
  test('the feed reaches the canonical endpoint and returns parsed cards', () async {
    final h = harness(body: const {
      'success': true,
      'data': [
        {
          'listing_id': 'l1',
          'product_id': 'p1',
          'site_id': 's1',
          'store_name': 'Snaz',
          'subdomain': 'snaz',
          'name': 'Canvas Tote',
          'images': <String>[],
          'price': 999,
          'approved_at': '2026-09-05T00:00:00.000Z',
        },
      ],
      'meta': {'limit': 20, 'next_cursor': null},
    });

    final page = await h.repository.feed(category: 'bags', limit: 20);
    expect(page.items.single.name, 'Canvas Tote');
    // The merchant handle is what lets a shopper reach that store's cart and checkout, so it must
    // survive the whole path rather than being dropped as decoration.
    expect(page.items.single.subdomain, 'snaz');
    expect(page.hasMore, isFalse);
    expect(h.requests.single.path, contains('/storefront/marketplace/feed'));
    expect(h.requests.single.queryParameters['category'], 'bags');
  });

  test('a listing that is no longer visible surfaces as null, not an exception', () async {
    // A screen must be able to say "no longer available" without a try/catch around every open.
    final h = harness(
      statusCode: 404,
      body: const {
        'success': false,
        'error': {'code': 'NOT_FOUND', 'message': 'Listing not found'},
      },
    );
    expect(await h.repository.listing('gone'), isNull);
  });

  test('a listing returns its variants, so a product page can offer a choice', () async {
    final h = harness(body: const {
      'success': true,
      'data': {
        'listing_id': 'l1',
        'product_id': 'p1',
        'site_id': 's1',
        'name': 'Canvas Tote',
        'country_of_origin': 'Japan',
        'importer_details': 'Example Imports, Mumbai',
        'variants': [
          {'id': 'v1', 'title': 'Small', 'price': 999, 'stock': 7, 'position': 1},
          {'id': 'v2', 'title': 'Large', 'price': 1099, 'stock': 2, 'position': 2},
        ],
      },
    });
    final listing = await h.repository.listing('l1');
    expect(listing!.countryOfOrigin, 'Japan');
    expect(listing.importerDetails, 'Example Imports, Mumbai');
    expect(listing.variants.map((v) => v.title), ['Small', 'Large']);
    expect(h.requests.single.path, contains('/storefront/marketplace/listings/l1'));
  });

  test('categories reach the canonical taxonomy endpoint', () async {
    final h = harness(body: const {
      'success': true,
      'data': [
        {'id': 'c1', 'slug': 'bags', 'name': 'Bags', 'position': 1},
      ],
    });
    final categories = await h.repository.categories();
    expect(categories.single.slug, 'bags');
    expect(h.requests.single.path, contains('/storefront/marketplace/categories'));
  });
}
