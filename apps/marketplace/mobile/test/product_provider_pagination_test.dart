import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

const _cursor = {
  'after_approved_at': '2026-10-01T00:00:00Z',
  'after_id': 'listing-1',
};

Map<String, Object?> _item(String id, String name) => {
  'listing_id': id,
  'product_id': 'product-$id',
  'site_id': 'site-$id',
  'name': name,
  'approved_at': '2026-10-01T00:00:00Z',
  'country_of_origin': 'Japan',
};

Response<Map<String, Object?>> _page(
  RequestOptions request,
  List<Map<String, Object?>> items, {
  Map<String, String>? nextCursor,
}) => Response(
  requestOptions: request,
  statusCode: 200,
  data: {
    'data': items,
    'meta': {'limit': 100, 'next_cursor': nextCursor},
  },
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('appends the next page with the same category and origin filters', () async {
    final requests = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          final response = options.queryParameters['after_id'] == null
              ? _page(options, [_item('listing-1', 'First')], nextCursor: _cursor)
              : _page(options, [
                  _item('listing-1', 'Duplicate'),
                  _item('listing-2', 'Second'),
                ]);
          handler.resolve(response);
        },
      ),
    );
    final provider = ProductProvider(
      client: ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      ),
    );

    await provider.loadProducts(categoryId: 'bags', countryOfOrigin: 'Japan');
    expect(provider.hasMore, isTrue);
    await provider.loadMoreProducts();

    expect(requests, hasLength(2));
    for (final request in requests) {
      expect(request.queryParameters['category'], 'bags');
      expect(request.queryParameters['country_of_origin'], 'Japan');
    }
    expect(requests.last.queryParameters['after_approved_at'], _cursor['after_approved_at']);
    expect(requests.last.queryParameters['after_id'], 'listing-1');
    expect(provider.products.map((product) => product.id), [
      'listing-1',
      'listing-2',
    ]);
    expect(provider.hasMore, isFalse);
  });

  test('appends search results with the same search and origin filters', () async {
    final requests = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          handler.resolve(
            _page(
              options,
              [_item('listing-${requests.length}', 'Canvas bag ${requests.length}')],
              nextCursor: requests.length == 1 ? _cursor : null,
            ),
          );
        },
      ),
    );
    final provider = ProductProvider(
      client: ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      ),
    );

    await provider.searchProducts('canvas', countryOfOrigin: 'Japan');
    await provider.loadMoreProducts();

    expect(requests, hasLength(2));
    for (final request in requests) {
      expect(request.queryParameters['search'], 'canvas');
      expect(request.queryParameters['country_of_origin'], 'Japan');
    }
    expect(provider.products, hasLength(2));
  });

  test('a failed continuation keeps the same cursor available for retry', () async {
    final requests = <RequestOptions>[];
    var continuationAttempts = 0;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          if (options.queryParameters['after_id'] == null) {
            handler.resolve(
              _page(options, [_item('listing-1', 'First')], nextCursor: _cursor),
            );
            return;
          }
          continuationAttempts++;
          if (continuationAttempts == 1) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 503,
                  data: {'error': 'synthetic unavailable'},
                ),
              ),
            );
            return;
          }
          handler.resolve(_page(options, [_item('listing-2', 'Second')]));
        },
      ),
    );
    final provider = ProductProvider(
      client: ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      ),
    );

    await provider.loadProducts(categoryId: 'bags', countryOfOrigin: 'Japan');
    await provider.loadMoreProducts();
    expect(provider.loadMoreFailed, isTrue);
    expect(provider.hasMore, isTrue);
    expect(provider.products, hasLength(1));

    await provider.retryLoadMoreProducts();
    expect(provider.loadMoreFailed, isFalse);
    expect(provider.products, hasLength(2));
    expect(
      requests.skip(1).map((request) => request.queryParameters['after_id']),
      ['listing-1', 'listing-1'],
    );
  });

  test('a filter change discards a late page from the prior feed', () async {
    final requests = <RequestOptions>[];
    final oldPage = Completer<Response<Map<String, Object?>>>();
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          requests.add(options);
          if (options.queryParameters['after_id'] == 'listing-1') {
            handler.resolve(await oldPage.future);
            return;
          }
          final category = options.queryParameters['category'];
          if (category == 'shoes') {
            handler.resolve(_page(options, [_item('listing-shoes', 'Shoes')]));
          } else {
            handler.resolve(
              _page(options, [_item('listing-1', 'First')], nextCursor: _cursor),
            );
          }
        },
      ),
    );
    final provider = ProductProvider(
      client: ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      ),
    );

    await provider.loadProducts(categoryId: 'bags', countryOfOrigin: 'Japan');
    final staleContinuation = provider.loadMoreProducts();
    await provider.loadProducts(
      categoryId: 'shoes',
      countryOfOrigin: 'India',
      forceReload: true,
    );
    oldPage.complete(_page(requests.lastWhere((request) => request.queryParameters['after_id'] != null), [
      _item('listing-stale', 'Stale bag'),
    ]));
    await staleContinuation;

    expect(provider.products.map((product) => product.id), ['listing-shoes']);
    expect(provider.hasMore, isFalse);
  });
}
