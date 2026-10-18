// CUS-1 — the marketplace surface of the shared client.
//
// Each test drives the real ApiClient with a Dio interceptor standing in for the gateway, so what is
// asserted is the wire contract the gateway actually publishes: the paths, the query parameters, the
// keyset cursor's two halves travelling together, and the response envelope's shape. The models are
// checked for what they must NOT carry as much as for what they must — SEC-1 and SEC-2 removed cost
// price, sku and barcode from every public product and variant shape, and a client that parsed them
// would be an argument for putting them back.

import 'dart:io';

import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

/// An ApiClient whose transport answers with [body] (or [statusCode]) and records the request.
({ApiClient client, List<RequestOptions> requests}) harness({
  Object? body,
  int statusCode = 200,
}) {
  final dio = Dio();
  final requests = <RequestOptions>[];
  final client = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
  );
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
          Response<Object?>(
            requestOptions: options,
            statusCode: statusCode,
            data: body,
          ),
        );
      },
    ),
  );
  return (client: client, requests: requests);
}

void main() {
  test(
    'seller feed retains its scope and filters on a cursor continuation',
    () async {
      final h = harness(
        body: const {
          'data': [],
          'meta': {'limit': 20, 'next_cursor': null},
        },
      );
      const cursor = MarketplaceFeedCursor(
        afterApprovedAt: '2026-10-01T00:00:00Z',
        afterId: '22222222-2222-4222-8222-222222222222',
      );
      await h.client.marketplaceFeed(
        sellerSiteId: '11111111-1111-4111-8111-111111111111',
        category: 'clothing',
        search: 'shirt',
        countryOfOrigin: 'India',
        limit: 20,
        cursor: cursor,
      );
      expect(h.requests.single.queryParameters, {
        'site_id': '11111111-1111-4111-8111-111111111111',
        'category': 'clothing',
        'search': 'shirt',
        'country_of_origin': 'India',
        'limit': 20,
        'after_approved_at': cursor.afterApprovedAt,
        'after_id': cursor.afterId,
      });
    },
  );

  test('marketplace checkout client carries seller cart, signed handoff, and retry-safe step data', () async {
    final cartHarness = harness(body: const {
      'success': true,
      'data': {'id': 'cart-1', 'cart_token': 'token-1'},
    });
    await cartHarness.client.storefront.createMarketplaceCart(
      'seller-one',
      const {
        'cart_token': 'token-1',
        'channel': 'api',
        'lines': [{'product_id': 'product-1', 'marketplace_listing_id': 'listing-1', 'quantity': 1}],
      },
      options: ApiRequestOptions(headers: const {'X-LetBuyy-Storefront-Session': 'buyer-session'}),
    );
    expect(cartHarness.requests.single.method, 'POST');
    expect(cartHarness.requests.single.path, contains('/storefront/seller-one/marketplace-cart'));
    expect(cartHarness.requests.single.data['cart_token'], 'token-1');
    expect(cartHarness.requests.single.headers['X-LetBuyy-Storefront-Session'], 'buyer-session');

    final statusHarness = harness(body: const {
      'success': true,
      'data': {'checkout_state': 'completed'},
    });
    await statusHarness.client.storefront.checkoutStatus('seller-one', 'token-1');
    expect(statusHarness.requests.single.method, 'GET');
    expect(statusHarness.requests.single.path, contains('/cart/token-1/checkout-status'));

    final ratesHarness = harness(body: const {
      'success': true,
      'data': {'serviceable': true, 'rates': []},
    });
    await ratesHarness.client.storefront.checkoutDeliveryOptions(
      'cart-1',
      const {'cart_id': 'cart-1', 'signature': 'signed'},
      const {'country': 'IN', 'state': 'Karnataka', 'pincode': '560001'},
    );
    expect(ratesHarness.requests.single.method, 'GET');
    expect(ratesHarness.requests.single.path, contains('/checkout/cart-1/delivery-options'));
    expect(ratesHarness.requests.single.queryParameters['signature'], 'signed');
    expect(ratesHarness.requests.single.queryParameters['pincode'], '560001');

    final stepHarness = harness(body: const {'success': true, 'data': {'ok': true}});
    await stepHarness.client.storefront.checkoutStep(
      'cart-1',
      'confirm',
      const {'cart_id': 'cart-1', 'signature': 'signed'},
      const {'idempotency_key': 'confirm-cart-1'},
    );
    expect(stepHarness.requests.single.path, contains('/checkout/cart-1/confirm'));
    expect(stepHarness.requests.single.queryParameters['signature'], 'signed');
    expect(stepHarness.requests.single.data['idempotency_key'], 'confirm-cart-1');
    expect(
      () => stepHarness.client.storefront.checkoutStep(
        'cart-1',
        'delete',
        const {},
        const {},
      ),
      throwsArgumentError,
    );
  });

  test(
    'the feed requests the documented path and forwards only the filters it was given',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': [],
          'meta': {'limit': 20, 'next_cursor': null},
        },
      );
      await h.client.marketplaceFeed(
        category: 'gadgets',
        countryOfOrigin: 'India',
        limit: 5,
      );

      expect(h.requests.single.path, contains('/storefront/marketplace/feed'));
      expect(h.requests.single.queryParameters['category'], 'gadgets');
      expect(h.requests.single.queryParameters['limit'], 5);
      expect(h.requests.single.queryParameters['country_of_origin'], 'India');
      // An unset filter must be absent, not sent empty: the gateway treats a present-but-empty search
      // differently from no search at all.
      expect(h.requests.single.queryParameters.containsKey('search'), isFalse);
      expect(
        h.requests.single.queryParameters.containsKey('after_id'),
        isFalse,
      );
    },
  );

  test(
    'origin facets are read from the canonical marketplace endpoint',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': [
            {'country_of_origin': 'India'},
            {'country_of_origin': 'Japan'},
          ],
        },
      );
      expect(await h.client.marketplaceOrigins(), ['India', 'Japan']);
      expect(
        h.requests.single.path,
        contains('/storefront/marketplace/origins'),
      );
    },
  );

  test(
    'a cursor is sent as both halves, and a page reports whether more remain',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': [
            {
              'listing_id': 'l1',
              'product_id': 'p1',
              'site_id': 's1',
              'store_name': 'Snaz',
              'subdomain': 'snaz',
              'name': 'Canvas Tote',
              'slug': 'canvas-tote',
              'images': ['https://cdn.test/a.jpg'],
              'price': 999,
              'compare_price': null,
              'category_slug': 'bags',
              'approved_at': '2026-09-05T00:00:00.000Z',
              'country_of_origin': 'India',
            },
          ],
          'meta': {
            'limit': 1,
            'next_cursor': {
              'after_approved_at': '2026-09-05T00:00:00.000Z',
              'after_id': 'l1',
            },
          },
        },
      );

      final first = await h.client.marketplaceFeed(limit: 1);
      expect(first.items.single.name, 'Canvas Tote');
      expect(first.items.single.countryOfOrigin, 'India');
      expect(
        first.items.single.subdomain,
        'snaz',
        reason: 'the merchant handle is how a shopper reaches checkout',
      );
      expect(first.hasMore, isTrue);

      await h.client.marketplaceFeed(limit: 1, cursor: first.nextCursor);
      final paged = h.requests.last.queryParameters;
      expect(paged['after_approved_at'], '2026-09-05T00:00:00.000Z');
      expect(
        paged['after_id'],
        'l1',
        reason:
            'both halves travel together — the gateway rejects a half cursor',
      );
    },
  );

  test(
    'an empty last page reports no cursor, which is the end signal rather than an empty list',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': [],
          'meta': {'limit': 20, 'next_cursor': null},
        },
      );
      final page = await h.client.marketplaceFeed();
      expect(page.items, isEmpty);
      expect(page.hasMore, isFalse);
      expect(page.nextCursor, isNull);
    },
  );

  test(
    'a null-heavy row parses without throwing, because the gateway may return nulls for most columns',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': [
            {
              'listing_id': 'l2',
              'product_id': 'p2',
              'site_id': 's2',
              'name': 'Bare Product',
              'approved_at': '2026-09-05T00:00:00.000Z',
              'store_name': null,
              'subdomain': null,
              'slug': null,
              'images': null,
              'price': null,
              'compare_price': null,
              'category_slug': null,
            },
          ],
          'meta': {'limit': 20, 'next_cursor': null},
        },
      );
      final page = await h.client.marketplaceFeed();
      final item = page.items.single;
      expect(item.name, 'Bare Product');
      expect(item.images, isEmpty);
      expect(item.price, isNull);
      expect(item.storeName, isNull);
    },
  );

  test(
    'the detail parses its variants and exposes no stock-keeping identifier',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': {
            'listing_id': 'l1',
            'product_id': 'p1',
            'site_id': 's1',
            'store_name': 'Snaz',
            'subdomain': 'snaz',
            'name': 'Canvas Tote',
            'description': 'Roomy.',
            'images': ['https://cdn.test/a.jpg'],
            'price': 999,
            'stock': 5,
            'track_inventory': true,
            'category_slug': 'bags',
            'country_of_origin': 'Japan',
            'importer_details': 'Example Imports, Mumbai',
            'approved_at': '2026-09-05T00:00:00.000Z',
            'variants': [
              {
                'id': 'v1',
                'title': 'Small',
                'price': 999,
                'stock': 7,
                'option1': 'Small',
                'position': 1,
              },
              {
                'id': 'v2',
                'title': 'Large',
                'price': 1099,
                'stock': 2,
                'option1': 'Large',
                'position': 2,
              },
            ],
          },
        },
      );

      final listing = await h.client.marketplaceListing('l1');
      expect(listing, isNotNull);
      expect(listing!.description, 'Roomy.');
      expect(listing.countryOfOrigin, 'Japan');
      expect(listing.importerDetails, 'Example Imports, Mumbai');
      expect(listing.trackInventory, isTrue);
      expect(listing.variants.map((v) => v.title), ['Small', 'Large']);
      expect(listing.variants.first.stock, 7);

      // A variant carrying the forbidden fields must parse without surfacing them: the model is the
      // last line, after the gateway's select list and its projection.
      final smuggled = MarketplaceVariant.fromJson(const {
        'id': 'v9',
        'title': 'Smuggler',
        'sku': 'VAR-SKU-777',
        'barcode': '4006381333931',
        'cost_price': 400,
      });
      expect(smuggled.title, 'Smuggler');
      expect(smuggled.toString(), isNot(contains('VAR-SKU-777')));
    },
  );

  test(
    'a detail with no variants yields an empty list, not a null a screen must guard',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': {
            'listing_id': 'l1',
            'product_id': 'p1',
            'site_id': 's1',
            'name': 'Simple',
            'variants': [],
          },
        },
      );
      final listing = await h.client.marketplaceListing('l1');
      expect(listing!.variants, isEmpty);
    },
  );

  test('a listing the fence excludes returns null rather than throwing', () async {
    // Rejected, taken down, hidden, or on an unpublished store — all ordinary outcomes between
    // opening the grid and tapping a card. A screen should say "no longer available", not crash.
    final h = harness(
      statusCode: 404,
      body: const {
        'success': false,
        'error': {'code': 'NOT_FOUND', 'message': 'Listing not found'},
      },
    );
    expect(await h.client.marketplaceListing('gone'), isNull);
  });

  test(
    'categories parse, and a non-list payload degrades to empty rather than throwing',
    () async {
      final h = harness(
        body: const {
          'success': true,
          'data': [
            {
              'id': 'c1',
              'slug': 'bags',
              'name': 'Bags',
              'parent_id': null,
              'position': 1,
            },
          ],
        },
      );
      final categories = await h.client.marketplaceCategories();
      expect(categories.single.slug, 'bags');

      final broken = harness(body: const {'success': true, 'data': null});
      expect(await broken.client.marketplaceCategories(), isEmpty);
    },
  );

  test('no public marketplace model declares a field a shopper may not see', () {
    // SEC-1 removed cost_price, sku and barcode from the public product read; SEC-2 removed the
    // variant-level ones after they survived nested inside `variants`. A Dart model that parsed any
    // of them would be a standing argument for widening the endpoint to match the client, so the
    // model source is asserted directly — the same shape as the gateway's own contract guards.
    final source = File('lib/src/marketplace.dart').readAsStringSync();
    final code = source
        .split('\n')
        .where((line) => !line.trimLeft().startsWith('//'))
        .join('\n');
    for (final forbidden in [
      'cost_price',
      'cost_per_item',
      "'sku'",
      "'barcode'",
    ]) {
      expect(
        code.contains(forbidden),
        isFalse,
        reason: '$forbidden must not be parsed by a public model',
      );
    }
  });
}
