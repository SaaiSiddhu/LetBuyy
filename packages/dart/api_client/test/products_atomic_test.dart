import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

const key = '11111111-1111-4111-8111-111111111111';

void main() {
  test(
    'product edit sends the exact loaded version and retained key on every retry',
    () async {
      final dio = Dio();
      final requests = <RequestOptions>[];
      final client = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 1,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            requests.add(request);
            handler.resolve(
              Response<Object?>(
                requestOptions: request,
                statusCode: requests.length == 1 ? 503 : 200,
                data: requests.length == 1
                    ? {
                        'error': {
                          'code': 'UNAVAILABLE',
                          'message': 'Synthetic response unavailable',
                        },
                      }
                    : {
                        'data': {'id': 'product', 'version': 12},
                      },
              ),
            );
          },
        ),
      );
      final result = await client.products.update(
        'product',
        {'name': 'New title', 'version': 999, 'idempotency_key': 'wrong'},
        version: 7,
        idempotencyKey: key,
        options: const ApiRequestOptions(storeId: 'verified-store'),
      );
      expect(result['version'], 12);
      expect(requests, hasLength(2));
      for (final request in requests) {
        expect(request.method, 'PATCH');
        expect(request.uri.path, '/v1/products/product');
        expect(request.headers['X-Store-ID'], 'verified-store');
        expect(request.headers['X-Idempotency-Key'], key);
        expect(request.data, {
          'name': 'New title',
          'version': 7,
          'idempotency_key': key,
        });
      }
    },
  );

  test(
    'product conflict stays actionable and does not retry a different intent',
    () async {
      final dio = Dio();
      final requests = <RequestOptions>[];
      final client = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 2,
      );
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            requests.add(request);
            handler.resolve(
              Response<Object?>(
                requestOptions: request,
                statusCode: 409,
                data: {
                  'error': {
                    'code': 'PRODUCT_VERSION_CONFLICT',
                    'message': 'Product changed; keep your draft and reload.',
                  },
                },
              ),
            );
          },
        ),
      );
      await expectLater(
        client.products.update(
          'product',
          {'name': 'Unsaved draft'},
          version: 7,
          idempotencyKey: key,
        ),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 409)
              .having((e) => e.code, 'code', 'PRODUCT_VERSION_CONFLICT'),
        ),
      );
      expect(requests, hasLength(1));
      expect((requests.single.data as Map)['name'], 'Unsaved draft');
    },
  );

  test('no editable version or save UUID is fabricated by the SDK', () {
    final requests = <RequestOptions>[];
    final dio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            requests.add(request);
            handler.resolve(
              Response<Object?>(
                requestOptions: request,
                statusCode: 200,
                data: {'data': {}},
              ),
            );
          },
        ),
      );
    final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: dio);
    for (final version in [0, -1]) {
      expect(
        () => client.products.update(
          'product',
          {},
          version: version,
          idempotencyKey: key,
        ),
        throwsArgumentError,
      );
    }
    for (final invalid in ['', 'generated-on-every-attempt', '$key ']) {
      expect(
        () => client.products.update(
          'product',
          {},
          version: 7,
          idempotencyKey: invalid,
        ),
        throwsArgumentError,
      );
    }
    expect(requests, isEmpty);
  });
}
