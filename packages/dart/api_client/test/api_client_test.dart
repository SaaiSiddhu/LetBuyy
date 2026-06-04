import 'package:dio/dio.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:test/test.dart';

void main() {
  test(
    'adds auth headers, normalizes /v1 paths, and unwraps pagination',
    () async {
      final dio = Dio();
      late RequestOptions captured;
      final client = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        token: 'session-token',
        storeId: 'store-1',
        headers: const {'X-Client': 'flutter-builder'},
        requestIdFactory: () => 'req-test-1',
        dio: dio,
        maxRetries: 0,
      );

      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            captured = options;
            handler.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                headers: Headers.fromMap({
                  'X-Request-ID': ['req-test-1'],
                }),
                data: const {
                  'success': true,
                  'data': [
                    {'id': 'product-1', 'name': 'Sneaker'},
                  ],
                  'meta': {
                    'page': 1,
                    'per_page': 20,
                    'total': 1,
                    'total_pages': 1,
                    'has_next': false,
                    'has_prev': false,
                  },
                },
              ),
            );
          },
        ),
      );

      final page = await client.products.list(
        query: const {
          'store_id': 'store-1',
          'ids': ['product-1', 'product-2'],
        },
      );

      expect(page.data, hasLength(1));
      expect(page.data.first['id'], 'product-1');
      expect(page.total, 1);
      expect(
        captured.uri.toString(),
        startsWith('https://gateway.test/v1/products'),
      );
      expect(captured.uri.query, contains('store_id=store-1'));
      expect(captured.headers['Authorization'], 'Bearer session-token');
      expect(captured.headers['X-Store-ID'], 'store-1');
      expect(captured.headers['X-Client'], 'flutter-builder');
      expect(captured.headers['X-Request-ID'], 'req-test-1');
    },
  );

  test('attaches lb_session transport headers when enabled', () async {
    final dio = Dio();
    late RequestOptions captured;
    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      token: 'opaque-lb-session',
      attachSessionCookie: true,
      dio: dio,
      maxRetries: 0,
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          captured = options;
          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: const {
                'success': true,
                'data': {'authenticated': true},
              },
            ),
          );
        },
      ),
    );

    await client.auth.session();

    expect(captured.headers['Authorization'], 'Bearer opaque-lb-session');
    expect(captured.headers['X-LetBuyy-Session-Token'], 'opaque-lb-session');
    expect(captured.headers['Cookie'], 'lb_session=opaque-lb-session');
  });

  test('maps gateway failure payloads to ApiException', () async {
    final dio = Dio();
    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 409,
              data: const {
                'success': false,
                'error': {
                  'code': 'DUPLICATE_PRODUCT',
                  'message': 'Product already exists',
                  'status': 409,
                },
              },
            ),
          );
        },
      ),
    );

    await expectLater(
      client.products.create(const {'store_id': 'store-1', 'name': 'Sneaker'}),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 409)
            .having((error) => error.code, 'code', 'DUPLICATE_PRODUCT')
            .having(
              (error) => error.message,
              'message',
              'Product already exists',
            ),
      ),
    );
  });

  test('retries retryable read responses', () async {
    final dio = Dio();
    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 1,
    );
    var attempts = 0;

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          attempts += 1;
          if (attempts == 1) {
            handler.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 503,
                data: const {
                  'success': false,
                  'error': {
                    'code': 'SERVICE_UNAVAILABLE',
                    'message': 'Retry later',
                  },
                },
              ),
            );
            return;
          }

          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: const {
                'success': true,
                'data': <Object?>[],
                'meta': {
                  'page': 1,
                  'per_page': 20,
                  'total': 0,
                  'has_next': false,
                },
              },
            ),
          );
        },
      ),
    );

    final page = await client.products.list();
    expect(page.data, isEmpty);
    expect(attempts, 2);
  });
}
