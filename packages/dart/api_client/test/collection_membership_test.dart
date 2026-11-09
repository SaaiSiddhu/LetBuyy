// Real request construction with controlled response bytes. No database proof.
import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  test(
    'collection filters and ordered replacement share selected context and exact replay identity',
    () async {
      final dio = Dio(), calls = <RequestOptions>[];
      var epoch = 1;
      final api = ApiClient(
        baseUrl: 'https://gateway.synthetic.invalid/v1',
        tokenProvider: () => 'synthetic-owner-session',
        contextVersionProvider: () => epoch,
        dio: dio,
        maxRetries: 0,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            calls.add(request);
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: 200,
                data: {
                  'success': true,
                  'data': request.method == 'GET' ? [] : {'saved': true},
                  'meta': {
                    'page': 2,
                    'per_page': 10,
                    'total': 11,
                    'total_pages': 2,
                    'has_prev': true,
                    'has_next': false,
                  },
                },
              ),
            );
          },
        ),
      );
      const options = ApiRequestOptions(
        expectedContextVersion: 1,
        maxRetries: 0,
      );
      await api.products.collectionPage(
        storeId: 'site-a',
        page: 2,
        limit: 10,
        search: '  %_ cotton  ',
        status: 'inactive',
        options: options,
      );
      expect(calls.single.queryParameters, {
        'store_id': 'site-a',
        'page': 2,
        'limit': 10,
        'search': '%_ cotton',
        'status': 'inactive',
      });
      expect(calls.single.headers['X-Store-ID'], 'site-a');
      final body = {
        'product_ids': ['product-b', 'product-a'],
        'expected_version': 3,
        'idempotency_key': 'synthetic-membership-key',
      };
      for (var i = 0; i < 2; i++)
        await api.products.replaceCollectionMembership(
          'site-a',
          'collection-a',
          body,
          options: options,
        );
      expect(calls.last.method, 'PUT');
      expect(
        calls.last.path,
        endsWith('/v1/products/collections/collection-a/products'),
      );
      expect(calls.last.data, body);
      expect(
        calls.last.headers['X-Idempotency-Key'],
        'synthetic-membership-key',
      );
      expect(calls.last.headers['X-Store-ID'], 'site-a');
      expect(
        calls.last.headers['Authorization'],
        'Bearer synthetic-owner-session',
      );
      expect(calls.last.data, calls[1].data);
      epoch = 2;
      await expectLater(
        api.products.replaceCollectionMembership(
          'site-a',
          'collection-a',
          body,
          options: options,
        ),
        throwsA(isA<ApiException>()),
      );
      expect(calls.length, 3);
    },
  );
}
