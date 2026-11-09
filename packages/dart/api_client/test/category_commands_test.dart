import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  test(
    'category requests bind explicit store, page, version and exact original key',
    () async {
      final dio = Dio(), calls = <RequestOptions>[];
      var epoch = 1;
      final api = ApiClient(
        baseUrl: 'https://gateway.synthetic.invalid/v1',
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
      await api.products.categoryPage(
        'synthetic-site',
        page: 2,
        limit: 10,
        search: '  %_ cotton  ',
        options: options,
      );
      expect(calls.single.queryParameters, {
        'store_id': 'synthetic-site',
        'page': 2,
        'limit': 10,
        'search': '%_ cotton',
      });
      expect(calls.single.headers['X-Store-ID'], 'synthetic-site');
      final body = {
        'store_id': 'synthetic-site',
        'version': 3,
        'idempotency_key': 'synthetic-original-key',
        'description': null,
      };
      for (var i = 0; i < 2; i++) {
        await api.products.categoryCommand(
          'update',
          'synthetic-category',
          body,
          options: options,
        );
      }
      expect(calls.last.method, 'PATCH');
      expect(calls.last.path, endsWith('/v1/categories/synthetic-category'));
      expect(calls.last.data, calls[1].data);
      expect(calls.last.headers['X-Idempotency-Key'], 'synthetic-original-key');
      epoch = 2;
      await expectLater(
        api.products.categoryCommand(
          'delete',
          'synthetic-category',
          body,
          options: options,
        ),
        throwsA(isA<ApiException>()),
      );
      expect(calls.length, 3);
    },
  );
}
