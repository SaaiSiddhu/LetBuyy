import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/screens/home/web_home_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('opening web home revalidates a previously loaded feed', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
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
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: const MaterialApp(home: WebHomeScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(feedRequests, hasLength(2));
    expect(products.products.single.id, 'current-listing');
  });
}
