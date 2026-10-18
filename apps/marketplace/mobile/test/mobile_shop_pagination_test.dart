import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/screens/shop/mobile_shop_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'opening the marketplace shop revalidates an already-loaded feed',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      final feedRequests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.path.endsWith('/storefront/marketplace/feed')) {
              feedRequests.add(options);
              final listingId = feedRequests.length == 1
                  ? 'revoked-listing'
                  : 'current-listing';
              final name = feedRequests.length == 1
                  ? 'Previously approved item'
                  : 'Currently approved item';
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'data': [
                      {
                        'listing_id': listingId,
                        'product_id': 'product-$listingId',
                        'site_id': 'site-1',
                        'name': name,
                        'approved_at': '2026-10-01T00:00:00Z',
                        'price': 250,
                      },
                    ],
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

      final categories = CategoryProvider(client: client);
      final cart = CartProvider();
      final wishlist = WishlistProvider();
      await cart.ready;
      await wishlist.ready;

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ProductProvider>.value(value: products),
            ChangeNotifierProvider<CategoryProvider>.value(value: categories),
            ChangeNotifierProvider<CartProvider>.value(value: cart),
            ChangeNotifierProvider<WishlistProvider>.value(value: wishlist),
            ChangeNotifierProvider<ThemeProvider>(
              create: (_) => ThemeProvider(),
            ),
          ],
          child: const MaterialApp(home: MobileShopScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(feedRequests, hasLength(2));
      expect(products.products.single.id, 'current-listing');
      expect(find.text('Previously approved item'), findsNothing);
      expect(find.text('Currently approved item'), findsOneWidget);
    },
  );

  testWidgets(
    'pull-to-refresh revalidates an already-loaded marketplace feed',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      final feedRequests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.path.endsWith('/storefront/marketplace/feed')) {
              feedRequests.add(options);
              final current = feedRequests.length > 1;
              final listingId = current ? 'current-listing' : 'revoked-listing';
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'data': [
                      {
                        'listing_id': listingId,
                        'product_id': 'product-$listingId',
                        'site_id': 'site-1',
                        'name': current
                            ? 'Currently approved item'
                            : 'Previously approved item',
                        'approved_at': '2026-10-01T00:00:00Z',
                        'price': 250,
                      },
                    ],
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
      final categories = CategoryProvider(client: client);
      final cart = CartProvider();
      final wishlist = WishlistProvider();
      await cart.ready;
      await wishlist.ready;

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ProductProvider>.value(value: products),
            ChangeNotifierProvider<CategoryProvider>.value(value: categories),
            ChangeNotifierProvider<CartProvider>.value(value: cart),
            ChangeNotifierProvider<WishlistProvider>.value(value: wishlist),
            ChangeNotifierProvider<ThemeProvider>(
              create: (_) => ThemeProvider(),
            ),
          ],
          child: const MaterialApp(home: MobileShopScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(feedRequests, hasLength(1));
      expect(products.products.single.id, 'revoked-listing');

      final indicator = tester.widget<RefreshIndicator>(
        find.byType(RefreshIndicator).first,
      );
      await tester.runAsync(indicator.onRefresh);
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      expect(feedRequests, hasLength(2));
      expect(products.products.single.id, 'current-listing');
      expect(find.text('Previously approved item'), findsNothing);
      expect(find.text('Currently approved item'), findsOneWidget);
    },
  );

  testWidgets('scrolling the marketplace grid loads the next feed page', (
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
            final firstPage = feedRequests.length == 1;
            if (feedRequests.length == 2) {
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
            final items = firstPage
                ? List.generate(
                    24,
                    (index) => {
                      'listing_id': 'listing-$index',
                      'product_id': 'product-$index',
                      'site_id': 'site-$index',
                      'name': 'Marketplace item $index',
                      'approved_at': '2026-10-01T00:00:00Z',
                      'price': 100 + index,
                      'country_of_origin': 'Japan',
                    },
                  )
                : [
                    {
                      'listing_id': 'listing-next',
                      'product_id': 'product-next',
                      'site_id': 'site-next',
                      'name': 'Marketplace item from page two',
                      'approved_at': '2026-09-30T00:00:00Z',
                      'price': 200,
                      'country_of_origin': 'Japan',
                    },
                  ];
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': items,
                  'meta': {
                    'limit': 100,
                    'next_cursor': firstPage
                        ? {
                            'after_approved_at': '2026-10-01T00:00:00Z',
                            'after_id': 'listing-23',
                          }
                        : null,
                  },
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
    final categories = CategoryProvider(client: client);
    final cart = CartProvider();
    final wishlist = WishlistProvider();
    await cart.ready;
    await wishlist.ready;

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ProductProvider>.value(value: products),
          ChangeNotifierProvider<CategoryProvider>.value(value: categories),
          ChangeNotifierProvider<CartProvider>.value(value: cart),
          ChangeNotifierProvider<WishlistProvider>.value(value: wishlist),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: const MaterialApp(home: MobileShopScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(feedRequests, hasLength(1));
    expect(products.products, hasLength(24));
    expect(products.hasMore, isTrue);

    final shopScroll = find.descendant(
      of: find.byType(CustomScrollView).first,
      matching: find.byType(Scrollable),
    );
    final scrollState = tester.state<ScrollableState>(shopScroll.first);
    await tester.fling(shopScroll.first, const Offset(0, -5000), 10000);
    await tester.pumpAndSettle();

    expect(feedRequests, hasLength(2));
    expect(products.loadMoreFailed, isTrue);
    expect(products.products, hasLength(24));
    await tester.pump(const Duration(milliseconds: 100));
    expect(feedRequests, hasLength(2));
    final retry = find.text('Could not load more products. Retry');
    await tester.ensureVisible(retry);
    await tester.tap(retry);
    await tester.pumpAndSettle();

    expect(feedRequests, hasLength(3));
    expect(
      feedRequests
          .skip(1)
          .map((request) => request.queryParameters['after_id']),
      ['listing-23', 'listing-23'],
    );
    expect(products.products, hasLength(25));
    expect(products.loadMoreFailed, isFalse);
    expect(find.text('Marketplace item from page two'), findsOneWidget);
  });
}
