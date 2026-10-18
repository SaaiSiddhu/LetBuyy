import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/screens/shop/product_filter_request.dart';

void main() {
  test(
    'category search keeps category and origin on the canonical feed request',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [],
                  'meta': {'limit': 100, 'next_cursor': null},
                },
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

      await reloadShopProductsForFilters(
        provider: provider,
        categoryId: 'bags',
        searchQuery: 'canvas',
        countryOfOrigin: 'Japan',
      );

      expect(requests, hasLength(1));
      expect(requests.single.path, contains('/storefront/marketplace/feed'));
      expect(requests.single.queryParameters['category'], 'bags');
      expect(requests.single.queryParameters['country_of_origin'], 'Japan');
      expect(requests.single.queryParameters, isNot(contains('search')));
    },
  );

  test(
    'unscoped search keeps its server-side search and origin filters',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [],
                  'meta': {'limit': 100, 'next_cursor': null},
                },
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

      await reloadShopProductsForFilters(
        provider: provider,
        categoryId: null,
        searchQuery: 'canvas',
        countryOfOrigin: 'Japan',
      );

      expect(requests, hasLength(1));
      expect(requests.single.queryParameters['search'], 'canvas');
      expect(requests.single.queryParameters['country_of_origin'], 'Japan');
    },
  );
}
