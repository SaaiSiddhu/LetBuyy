import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/screens/shop/seller_store_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
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
    expect(products.products, isEmpty);
    expect(find.text('Seller not found'), findsOneWidget);
    expect(find.text('Previously approved item'), findsNothing);
  });
}
