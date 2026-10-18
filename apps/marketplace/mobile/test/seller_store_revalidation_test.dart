import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/screens/shop/seller_store_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  sellerPaginationTests();
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('seller store revalidates listings before showing the store', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
    final feedRequests = <RequestOptions>[];
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/storefront/marketplace/feed')) {
            feedRequests.add(options);
            final listings = feedRequests.length == 1
                ? [
                    {
                      'listing_id': 'revoked-listing',
                      'product_id': 'product-1',
                      'site_id': 'seller-1',
                      'store_name': 'Old store',
                      'name': 'Previously approved item',
                      'approved_at': '2026-10-01T00:00:00Z',
                      'price': 250,
                    },
                  ]
                : <Map<String, Object>>[];
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': listings,
                  'meta': {'limit': 100, 'next_cursor': null},
                },
              ),
            );
            return;
          }

          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': [],
                'meta': {'next_cursor': null},
              },
            ),
          );
        },
      ),
    );
    final client = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      dio: dio,
      maxRetries: 0,
    );
    final products = ProductProvider(client: client);
    await tester.runAsync(() => products.loadProducts());
    expect(products.products.single.name, 'Previously approved item');
    expect(feedRequests, hasLength(1));

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ProductProvider>.value(value: products),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: const MaterialApp(home: SellerStoreScreen(sellerId: 'seller-1')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(feedRequests, hasLength(2));
    expect(
      products.products.single.name,
      'Previously approved item',
      reason: 'seller browsing must not replace the home feed',
    );
    expect(feedRequests.last.queryParameters['site_id'], 'seller-1');
    expect(
      find.text('No products available from this seller.'),
      findsOneWidget,
    );
    expect(find.text('Previously approved item'), findsNothing);
  });
}

// These widget checks use the real SDK/provider with a fake transport. The owned database
// seller-feed suite separately verifies eligibility; neither substitutes for device evidence.
Map<String, Object> sellerItem(String seller, String id, String name) => {
  'listing_id': id,
  'product_id': 'catalog-$id',
  'site_id': seller,
  'store_name': 'Synthetic $seller',
  'name': name,
  'approved_at': '2026-10-01T00:00:00Z',
  'price': 100,
};

Future<void> mountSeller(
  WidgetTester tester,
  ProductProvider provider, {
  String seller = 'seller-a',
}) async {
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<ProductProvider>.value(value: provider),
        ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ChangeNotifierProvider<WishlistProvider>(
          create: (_) => WishlistProvider(),
        ),
        ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
      ],
      child: MaterialApp(home: SellerStoreScreen(sellerId: seller)),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 200));
}

void sellerPaginationTests() {
  test(
    'seller fetch rejects a foreign seller response without changing the shared feed',
    () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [
                    sellerItem('seller-b', 'foreign', 'Foreign seller product'),
                  ],
                  'meta': {'next_cursor': null},
                },
              ),
            );
          },
        ),
      );
      final products = ProductProvider(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await expectLater(
        products.loadSellerProducts('seller-a'),
        throwsStateError,
      );
      expect(products.products, isEmpty);
    },
  );

  testWidgets(
    'resume refresh discards prior seller cards and offers retry on an offline response',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      var calls = 0;
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            calls++;
            if (calls > 1) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  type: DioExceptionType.connectionError,
                ),
              );
              return;
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [
                    sellerItem('seller-a', 'old', 'Earlier seller card'),
                  ],
                  'meta': {'next_cursor': null},
                },
              ),
            );
          },
        ),
      );
      final products = ProductProvider(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await mountSeller(tester, products);
      expect(find.text('Earlier seller card'), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Earlier seller card'), findsNothing);
      expect(find.text('Retry seller products'), findsOneWidget);
      expect(calls, 2);
    },
  );

  testWidgets(
    'seller pages append/dedupe with their own cursor and leave the home feed untouched',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final more = options.queryParameters.containsKey('after_id');
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': more
                      ? [
                          sellerItem('seller-a', 'one', 'First seller product'),
                          sellerItem('seller-a', 'two', 'Later seller product'),
                        ]
                      : [sellerItem('seller-a', 'one', 'First seller product')],
                  'meta': {
                    'next_cursor': more
                        ? null
                        : {
                            'after_approved_at': '2026-10-01T00:00:00Z',
                            'after_id': 'one',
                          },
                  },
                },
              ),
            );
          },
        ),
      );
      final products = ProductProvider(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await mountSeller(tester, products);
      expect(find.text('First seller product'), findsOneWidget);
      await tester.tap(find.text('Load more products'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('First seller product'), findsOneWidget);
      expect(find.text('Later seller product'), findsOneWidget);
      expect(find.text('Products (2)'), findsOneWidget);
      expect(requests, hasLength(2));
      expect(
        requests.every(
          (request) => request.queryParameters['site_id'] == 'seller-a',
        ),
        isTrue,
      );
      expect(requests.last.queryParameters['after_id'], 'one');
      expect(
        requests.last.queryParameters['after_approved_at'],
        '2026-10-01T00:00:00Z',
      );
      expect(products.products, isEmpty);
      expect(products.hasMore, isFalse);
    },
  );

  testWidgets(
    'seller outage shows retry; page retry preserves the cursor and does not auto-loop',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            if (requests.length == 1 || requests.length == 3) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  type: DioExceptionType.connectionError,
                ),
              );
              return;
            }
            final more = options.queryParameters.containsKey('after_id');
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [
                    sellerItem(
                      'seller-a',
                      more ? 'two' : 'one',
                      more ? 'Recovered page' : 'First product',
                    ),
                  ],
                  'meta': {
                    'next_cursor': more
                        ? null
                        : {
                            'after_approved_at': '2026-10-01T00:00:00Z',
                            'after_id': 'one',
                          },
                  },
                },
              ),
            );
          },
        ),
      );
      final products = ProductProvider(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await mountSeller(tester, products);
      expect(find.text('Retry seller products'), findsOneWidget);
      expect(
        find.text('No products available from this seller.'),
        findsNothing,
      );
      await tester.tap(find.text('Retry seller products'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      await tester.tap(find.text('Load more products'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Retry more products'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(requests, hasLength(3));
      await tester.tap(find.text('Retry more products'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Recovered page'), findsOneWidget);
      expect(requests[2].queryParameters, requests[3].queryParameters);
    },
  );

  testWidgets(
    'late response from an earlier seller cannot replace the current seller',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      RequestOptions? oldRequest;
      RequestInterceptorHandler? oldHandler;
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.queryParameters['site_id'] == 'seller-a') {
              oldRequest = options;
              oldHandler = handler;
            } else {
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'data': [
                      sellerItem(
                        'seller-b',
                        'current',
                        'Current seller product',
                      ),
                    ],
                    'meta': {'next_cursor': null},
                  },
                ),
              );
            }
          },
        ),
      );
      final products = ProductProvider(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
      );
      await mountSeller(tester, products);
      expect(oldHandler, isNotNull);
      await mountSeller(tester, products, seller: 'seller-b');
      expect(find.text('Current seller product'), findsOneWidget);
      oldHandler!.resolve(
        Response(
          requestOptions: oldRequest!,
          statusCode: 200,
          data: {
            'data': [sellerItem('seller-a', 'old', 'Old seller product')],
            'meta': {'next_cursor': null},
          },
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('Current seller product'), findsOneWidget);
      expect(find.text('Old seller product'), findsNothing);
    },
  );
}
