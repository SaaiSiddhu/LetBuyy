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

  test(
    'posts generated Storefront GraphQL operations through the gateway',
    () async {
      final dio = Dio();
      late RequestOptions captured;
      final client = ApiClient(
        baseUrl: 'https://gateway.test/v1',
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
                  'data': {
                    'products': {
                      'nodes': <Object?>[],
                      'pageInfo': {
                        'hasNextPage': false,
                        'hasPreviousPage': false,
                      },
                    },
                  },
                  'extensions': {
                    'cost': {'requested': 8, 'actual': 8},
                  },
                },
              ),
            );
          },
        ),
      );

      final result = await client.graphql.storefrontProducts(
        handle: 'urban-kicks',
        first: 2,
      );
      final body = captured.data! as Map;

      expect(
        captured.uri.toString(),
        'https://gateway.test/v1/storefront/graphql',
      );
      expect(body['operationName'], 'StorefrontProducts');
      expect(body['query'], contains('query StorefrontProducts'));
      expect(body['variables'], {'handle': 'urban-kicks', 'first': 2});
      expect(result.data['products'], isA<Map>());
      expect(result.extensions['cost'], isA<Map>());
    },
  );

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

  test('exposes AI operator endpoint', () async {
    final dio = Dio();
    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
    );
    final captured = <String>[];

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          captured.add(options.uri.path);
          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: const {
                'success': true,
                'data': {
                  'store_id': 'store-1',
                  'conversation_id': 'operator_1',
                  'message': 'Draft work is ready.',
                  'tool_calls': [],
                  'created_at': '2026-06-08T10:00:00.000Z',
                },
              },
            ),
          );
        },
      ),
    );

    final result = await client.ai.operator(const {
      'store_id': 'store-1',
      'message': 'Show sales this week',
    });

    expect(result['conversation_id'], 'operator_1');
    expect(captured, contains('/v1/ai/operator'));
  });

  test('exposes WhatsApp commerce endpoints', () async {
    final dio = Dio();
    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
    );
    final captured = <String>[];

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          captured.add(options.uri.path);
          final data = options.uri.path.endsWith('/timeline')
              ? const [
                  {'id': 'wa_1', 'message': 'Order update sent.'},
                ]
              : options.uri.path.endsWith('/send')
              ? const {
                  'message': {'id': 'wa_2'},
                  'status': 'queued',
                }
              : const {'available': true};
          handler.resolve(
            Response<Object?>(
              requestOptions: options,
              statusCode: 200,
              data: {'success': true, 'data': data},
            ),
          );
        },
      ),
    );

    final status = await client.whatsapp.status(storeId: 'store-1');
    final timeline = await client.whatsapp.timeline(
      storeId: 'store-1',
      customerEmail: 'meera@example.com',
    );
    final sent = await client.whatsapp.send(const {
      'store_id': 'store-1',
      'customer_email': 'meera@example.com',
      'template': 'order_update',
      'variables': {'order_number': 'order_1'},
    });

    expect(status['available'], isTrue);
    expect(timeline.single['message'], 'Order update sent.');
    expect(sent['status'], 'queued');
    expect(captured, contains('/v1/whatsapp/status'));
    expect(captured, contains('/v1/whatsapp/timeline'));
    expect(captured, contains('/v1/whatsapp/send'));
  });
}
