import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/screens/chat/widgets/product_card_horizontal.dart';
import 'package:letbuyy_marketplace/screens/chat/widgets/product_card_widget.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
  });

  testWidgets('AI marketplace search does not infer inventory from price', (
    tester,
  ) async {
    final dio = Dio()
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [
                    {
                      'listing_id': 'listing-1',
                      'product_id': 'product-1',
                      'site_id': 'store-1',
                      'name': 'AI marketplace item',
                      'approved_at': '2026-10-01T00:00:00Z',
                      'price': 120,
                    },
                  ],
                  'meta': {'limit': 8, 'next_cursor': null},
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
    final service = AIChatService.instance
      ..configure(client: client, accounts: BuyerAccountApi(client));

    final result = await tester.runAsync(
      () => service.handleProductSearch('AI marketplace item'),
    );
    final product =
        (result!['products'] as List).single as Map<String, dynamic>;

    expect(product['priceKnown'], isTrue);
    expect(product['stockKnown'], isFalse);
    expect(product.containsKey('inStock'), isFalse);
  });

  testWidgets('vertical AI product card does not claim or sell unknown stock', (
    tester,
  ) async {
    final cart = CartProvider();
    final wishlist = WishlistProvider();
    await cart.ready;
    await wishlist.ready;

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<CartProvider>.value(value: cart),
          ChangeNotifierProvider<WishlistProvider>.value(value: wishlist),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 240,
              height: 440,
              child: ProductCardWidget(
                product: {
                  'id': 'listing-1',
                  'marketplaceListingId': 'listing-1',
                  'name': 'AI marketplace item',
                  'price': 120.0,
                  'priceKnown': true,
                  'stock': 0,
                  'stockKnown': false,
                  'images': <String>[],
                },
                onTap: () {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('OUT OF STOCK'), findsNothing);
    expect(find.text('Stock unknown'), findsOneWidget);
    final buttons = tester.widgetList<ElevatedButton>(
      find.byType(ElevatedButton),
    );
    expect(buttons, hasLength(2));
    expect(buttons.every((button) => button.onPressed == null), isTrue);
  });

  testWidgets(
    'horizontal AI product card leaves unknown-stock items navigable',
    (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 220,
              height: 340,
              child: ProductCardHorizontal(
                product: {
                  'id': 'listing-1',
                  'marketplaceListingId': 'listing-1',
                  'name': 'AI marketplace item',
                  'price': 120.0,
                  'priceKnown': true,
                  'stock': 0,
                  'stockKnown': false,
                  'images': <String>[],
                },
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Out of Stock'), findsNothing);
      expect(find.text('In Stock'), findsNothing);
      await tester.tap(find.byType(InkWell).first);
      expect(tapped, isTrue);
    },
  );
}
