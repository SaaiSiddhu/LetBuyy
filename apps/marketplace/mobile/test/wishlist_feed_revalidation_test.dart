import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/screens/wishlist/mobile_wishlist_screen.dart';
import 'package:letbuyy_marketplace/screens/wishlist/web_wishlist_screen.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

ProductModel _product() {
  final now = DateTime.utc(2026, 10, 10);
  return ProductModel(
    id: 'revoked-listing',
    sellerId: 'seller-1',
    name: 'Previously approved item',
    description: '',
    salePrice: 250,
    categoryId: 'category-1',
    images: const [],
    stock: 1,
    createdAt: now,
    updatedAt: now,
  );
}

Future<void> _expectWishlistRevalidated(
  WidgetTester tester,
  Widget screen, {
  bool failRefresh = false,
}) async {
  tester.view.physicalSize = const Size(1440, 1200);
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
          if (feedRequests.length > 1 && failRefresh) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                message: 'offline',
              ),
            );
            return;
          }
          final listings = feedRequests.length == 1
              ? [
                  {
                    'listing_id': 'revoked-listing',
                    'product_id': 'product-1',
                    'site_id': 'seller-1',
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
  final wishlist = WishlistProvider();
  final cart = CartProvider();
  await tester.runAsync(() => products.loadProducts());
  await wishlist.ready;
  await wishlist.addItem(_product());
  await cart.ready;
  expect(products.products.single.name, 'Previously approved item');
  expect(wishlist.productIds, contains('revoked-listing'));
  expect(feedRequests, hasLength(1));

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<ProductProvider>.value(value: products),
        ChangeNotifierProvider<WishlistProvider>.value(value: wishlist),
        ChangeNotifierProvider<CartProvider>.value(value: cart),
        ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(seconds: 2));

  expect(feedRequests, hasLength(2));
  if (failRefresh) {
    expect(products.products.single.name, 'Previously approved item');
    expect(products.error, isNotNull);
    expect(find.text('Previously approved item'), findsWidgets);
  } else {
    expect(products.products, isEmpty);
    expect(find.text('Previously approved item'), findsNothing);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('mobile wishlist revalidates the eligible product feed', (
    tester,
  ) async {
    await _expectWishlistRevalidated(tester, const MobileWishlistScreen());
  });

  testWidgets('web wishlist revalidates the eligible product feed', (
    tester,
  ) async {
    await _expectWishlistRevalidated(tester, const WebWishlistScreen());
  });

  testWidgets(
    'mobile wishlist retains cached items when revalidation is offline',
    (tester) async {
      await _expectWishlistRevalidated(
        tester,
        const MobileWishlistScreen(),
        failRefresh: true,
      );
    },
  );
}
