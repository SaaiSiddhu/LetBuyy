import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/providers/search_provider.dart';
import 'package:letbuyy_marketplace/screens/search/mobile_search_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('opening marketplace search revalidates product suggestions', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
    final feedRequests = <RequestOptions>[];
    final refreshStarted = Completer<void>();
    final allowRefreshResponse = Completer<void>();
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.path.endsWith('/storefront/marketplace/feed')) {
            feedRequests.add(options);
            if (feedRequests.length == 2) {
              refreshStarted.complete();
              await allowRefreshResponse.future;
            }
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
          ChangeNotifierProvider<SearchProvider>(
            create: (_) => SearchProvider(),
          ),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: const MaterialApp(home: MobileSearchScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.pump();
    await tester.runAsync(() => refreshStarted.future);
    await tester.enterText(find.byType(TextField).first, 'currently');
    await tester.pump();
    expect(find.text('currently approved item'), findsNothing);

    final refreshedFeed = Completer<void>();
    void observeFeed() {
      if (!products.isLoading &&
          products.products.length == 1 &&
          products.products.single.id == 'current-listing' &&
          !refreshedFeed.isCompleted) {
        refreshedFeed.complete();
      }
    }

    products.addListener(observeFeed);
    allowRefreshResponse.complete();
    await tester.runAsync(() => refreshedFeed.future);
    products.removeListener(observeFeed);
    await tester.pump();

    expect(feedRequests, hasLength(2));
    expect(products.products.single.id, 'current-listing');
    expect(find.text('currently approved item'), findsOneWidget);
  });
}
