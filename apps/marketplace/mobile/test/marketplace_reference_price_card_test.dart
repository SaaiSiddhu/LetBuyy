import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/product_card.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/product_info_section.dart';
import 'package:letbuyy_marketplace/screens/cart/widgets/cart_item_card.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/recently_viewed_widget.dart';
import 'package:letbuyy_marketplace/screens/chat/widgets/product_card_widget.dart';
import 'package:letbuyy_marketplace/screens/chat/widgets/product_card_horizontal.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/compact_product_card.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/related_products_section.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/suggested_for_you_section.dart';
import 'package:letbuyy_marketplace/screens/wishlist/widgets/wishlist_item_card.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

ProductModel _product({
  required String id,
  required String? listingId,
  required double price,
  required bool priceKnown,
  double? referencePrice,
}) => ProductModel(
  id: id,
  marketplaceListingId: listingId,
  sellerId: 'seller-1',
  name: 'Everyday item',
  description: '',
  salePrice: price,
  priceKnown: priceKnown,
  originalPrice: referencePrice,
  categoryId: 'General',
  images: const [],
  stock: 0,
  stockKnown: false,
  createdAt: DateTime.utc(2026, 10, 1),
  updatedAt: DateTime.utc(2026, 10, 1),
);

Widget _host(ProductModel product, {Widget? surface}) => MultiProvider(
  providers: [
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ChangeNotifierProvider<WishlistProvider>(create: (_) => WishlistProvider()),
  ],
  child: MaterialApp(
    home: Scaffold(body: surface ?? ProductCard(product: product)),
  ),
);

Widget _wishlistHost(ProductModel product) => MultiProvider(
  providers: [
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: SizedBox(
        width: 280,
        height: 360,
        child: WishlistItemCard(product: product, onRemove: () {}),
      ),
    ),
  ),
);

Widget _compactHost(ProductModel product) => MultiProvider(
  providers: [
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ChangeNotifierProvider<WishlistProvider>(create: (_) => WishlistProvider()),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: SizedBox(
        width: 180,
        height: 280,
        child: CompactProductCard(
          product: product,
          showAddToCart: false,
        ),
      ),
    ),
  ),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
  });

  testWidgets('marketplace card labels a supported reference as a prior low', (
    tester,
  ) async {
    final product = _product(
      id: 'listing-1',
      listingId: 'listing-1',
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );

    await tester.pumpWidget(_host(product));
    await tester.pump();

    expect(find.text('₹120'), findsOneWidget);
    expect(find.text('30-day low ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
    expect(find.text('Lowest price in prior 30 days'), findsNothing);
  });

  testWidgets(
    'Gateway feed mapping reaches the card with the reference meaning',
    (tester) async {
      final dio = Dio()
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              if (options.path.endsWith('/storefront/marketplace/feed')) {
                handler.resolve(
                  Response(
                    requestOptions: options,
                    statusCode: 200,
                    data: {
                      'data': [
                        {
                          'listing_id': 'gateway-listing-1',
                          'product_id': 'catalog-product-1',
                          'site_id': 'store-1',
                          'name': 'Gateway item',
                          'approved_at': '2026-10-01T00:00:00Z',
                          'price': 120,
                          'compare_price': 150,
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
                  statusCode: 404,
                  data: {'error': 'unmapped test request'},
                ),
              );
            },
          ),
        );
      final provider = ProductProvider(
        client: ApiClient(
          baseUrl: 'https://gateway.test/v1',
          dio: dio,
          maxRetries: 0,
        ),
      );
      final mappedProducts = await tester.runAsync(() async {
        await provider.loadProducts(countryOfOrigin: 'Japan');
        return provider.products;
      });

      expect(mappedProducts, hasLength(1));
      expect(mappedProducts!.single.marketplaceListingId, 'gateway-listing-1');
      expect(mappedProducts.single.priceKnown, isTrue);
      expect(mappedProducts.single.hasPriorThirtyDayLow, isTrue);

      await tester.pumpWidget(_host(mappedProducts.single));
      await tester.pump();

      expect(find.text('Gateway item'), findsOneWidget);
      expect(find.text('₹120'), findsOneWidget);
      expect(find.text('30-day low ₹150'), findsOneWidget);
      expect(find.text('M.R.P. ₹150'), findsNothing);
    },
  );

  testWidgets('unknown marketplace price cannot display the reference', (
    tester,
  ) async {
    final product = _product(
      id: 'listing-2',
      listingId: 'listing-2',
      price: 0,
      priceKnown: false,
      referencePrice: 150,
    );

    await tester.pumpWidget(_host(product));
    await tester.pump();

    expect(find.text('30-day low ₹150'), findsNothing);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('non-marketplace catalog card retains its MRP label', (
    tester,
  ) async {
    final product = _product(
      id: 'catalog-1',
      listingId: null,
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );

    await tester.pumpWidget(_host(product));
    await tester.pump();

    expect(find.text('M.R.P. ₹150'), findsOneWidget);
    expect(find.text('30-day low ₹150'), findsNothing);
  });

  testWidgets('wishlist card labels marketplace reference as a prior low', (
    tester,
  ) async {
    final product = _product(
      id: 'wishlist-listing-1',
      listingId: 'wishlist-listing-1',
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );

    await tester.pumpWidget(_wishlistHost(product));
    await tester.pump();

    expect(find.text('₹120'), findsOneWidget);
    expect(find.text('30-day low ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('wishlist card hides a reference for an unknown current price', (
    tester,
  ) async {
    final product = _product(
      id: 'wishlist-listing-unknown',
      listingId: 'wishlist-listing-unknown',
      price: 0,
      priceKnown: false,
      referencePrice: 150,
    );

    await tester.pumpWidget(_wishlistHost(product));
    await tester.pump();

    expect(find.text('30-day low ₹150'), findsNothing);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('wishlist catalog card retains its MRP wording', (tester) async {
    final product = _product(
      id: 'wishlist-catalog-1',
      listingId: null,
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );

    await tester.pumpWidget(_wishlistHost(product));
    await tester.pump();

    expect(find.text('M.R.P. ₹150'), findsOneWidget);
    expect(find.text('30-day low ₹150'), findsNothing);
  });

  testWidgets('compact card labels marketplace reference as a prior low', (
    tester,
  ) async {
    final product = _product(
      id: 'compact-listing-1',
      listingId: 'compact-listing-1',
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );

    await tester.pumpWidget(_compactHost(product));
    await tester.pump();

    expect(find.text('₹120'), findsOneWidget);
    expect(find.text('30d low ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('compact card hides reference when current price is unknown', (
    tester,
  ) async {
    final product = _product(
      id: 'compact-listing-unknown',
      listingId: 'compact-listing-unknown',
      price: 0,
      priceKnown: false,
      referencePrice: 150,
    );

    await tester.pumpWidget(_compactHost(product));
    await tester.pump();

    expect(find.text('30d low ₹150'), findsNothing);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('recently viewed card preserves marketplace reference meaning', (
    tester,
  ) async {
    final product = _product(
      id: 'recent-listing-1',
      listingId: 'recent-listing-1',
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );
    final provider = ProductProvider(
      client: ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: Dio(),
        maxRetries: 0,
      ),
    );
    await tester.runAsync(() => provider.addToRecentlyViewed(product));

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
          ChangeNotifierProvider<ProductProvider>.value(value: provider),
        ],
        child: const MaterialApp(
          home: Scaffold(body: RecentlyViewedWidget()),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('30-day low ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('product detail identifies the canonical prior-period low', (
    tester,
  ) async {
    final product = _product(
      id: 'listing-detail-1',
      listingId: 'listing-detail-1',
      price: 120,
      priceKnown: true,
      referencePrice: 150,
    );

    await tester.pumpWidget(
      _host(product, surface: ProductInfoSection(product: product)),
    );
    await tester.pump();

    expect(find.text('Lowest price in prior 30 days: ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('marketplace cart keeps the reference meaning in its savings', (
    tester,
  ) async {
    final item = CartItemModel(
      id: 'cart-item-1',
      productId: 'catalog-product-1',
      marketplaceListingId: 'listing-1',
      productName: 'Everyday item',
      productImage: '',
      price: 120,
      originalPrice: 150,
      discountPercentage: 20,
      quantity: 1,
      userId: 'local-device-cart',
      addedAt: DateTime.utc(2026, 10, 1),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: CartItemCard(
              item: item,
              onRemove: () {},
              onQuantityChanged: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('30d low ₹150'), findsOneWidget);
    expect(find.text('20% below prior 30-day low'), findsOneWidget);
    expect(find.text('₹30 below prior 30-day low'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
  });

  testWidgets('unknown-price cart row suppresses reference and savings claims', (
    tester,
  ) async {
    final item = CartItemModel(
      id: 'cart-item-unknown',
      productId: 'catalog-product-unknown',
      marketplaceListingId: 'listing-unknown',
      productName: 'Unpriced item',
      productImage: '',
      price: 0,
      originalPrice: 150,
      discountPercentage: 100,
      quantity: 1,
      userId: 'local-device-cart',
      addedAt: DateTime.utc(2026, 10, 1),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: CartItemCard(
              item: item,
              onRemove: () {},
              onQuantityChanged: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('30d low ₹150'), findsNothing);
    expect(find.text('M.R.P. ₹150'), findsNothing);
    expect(find.text('100% below prior 30-day low'), findsNothing);
    expect(find.text('₹150 below prior 30-day low'), findsNothing);
  });

  testWidgets('AI chat search preserves marketplace reference identity', (
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
                      'listing_id': 'chat-listing-1',
                      'product_id': 'chat-product-1',
                      'site_id': 'store-1',
                      'name': 'Chat item',
                      'approved_at': '2026-10-01T00:00:00Z',
                      'price': 120,
                      'compare_price': 150,
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
      () => service.handleProductSearch('Chat item'),
    );
    final product = (result!['products'] as List).single as Map<String, dynamic>;

    expect(product['marketplaceListingId'], 'chat-listing-1');
    expect(product['priceKnown'], isTrue);
    expect(product['originalPrice'], 150.0);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
          ChangeNotifierProvider<WishlistProvider>(
            create: (_) => WishlistProvider(),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 220,
              height: 280,
              child: ProductCardWidget(product: product, onTap: () {}),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('30d low'), findsOneWidget);
    expect(find.text('₹150'), findsOneWidget);
    expect(find.text('-20%'), findsNothing);
  });

  testWidgets('horizontal AI chat card labels a known prior-30-day low', (
    tester,
  ) async {
    final product = <String, dynamic>{
      'id': 'horizontal-listing-1',
      'marketplaceListingId': 'horizontal-listing-1',
      'name': 'Horizontal item',
      'price': 120.0,
      'originalPrice': 150.0,
      'priceKnown': true,
      'imageUrl': '',
      'images': <String>[],
      'stock': 1,
    };

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 180,
            height: 240,
            child: ProductCardHorizontal(product: product),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('30d low'), findsOneWidget);
    expect(find.text('₹150'), findsOneWidget);
    expect(find.textContaining('% OFF'), findsNothing);
  });

  testWidgets('horizontal AI card hides a comparison without price coverage', (
    tester,
  ) async {
    final product = <String, dynamic>{
      'id': 'horizontal-listing-unknown',
      'marketplaceListingId': 'horizontal-listing-unknown',
      'name': 'Unpriced horizontal item',
      'price': 0.0,
      'originalPrice': 150.0,
      'priceKnown': false,
      'imageUrl': '',
      'images': <String>[],
      'stock': 0,
    };

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 180,
            height: 240,
            child: ProductCardHorizontal(product: product),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('30d low'), findsNothing);
    expect(find.text('₹150'), findsNothing);
    expect(find.textContaining('% OFF'), findsNothing);
  });

  testWidgets('suggested marketplace products disclose the prior 30-day low', (
    tester,
  ) async {
    final provider = ProductProvider(
      client: _marketplaceFeedClient(categorySlug: 'general'),
    );
    await tester.runAsync(() => provider.loadProducts());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ProductProvider>.value(value: provider),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: const MaterialApp(
          home: Scaffold(body: SuggestedForYouSection()),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Gateway item'), findsOneWidget);
    expect(find.text('30d low ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
    expect(find.textContaining('% Off'), findsNothing);
  });

  testWidgets('related marketplace products disclose the prior 30-day low', (
    tester,
  ) async {
    final provider = ProductProvider(
      client: _marketplaceFeedClient(categorySlug: 'general'),
    );
    await tester.runAsync(() => provider.loadProducts());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ProductProvider>.value(value: provider),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: RelatedProductsSection(
              currentProductId: 'another-listing',
              categoryId: 'general',
              isDark: false,
              onProductTap: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Gateway item'), findsOneWidget);
    expect(find.text('30d low ₹150'), findsOneWidget);
    expect(find.text('M.R.P. ₹150'), findsNothing);
    expect(find.textContaining('% OFF'), findsNothing);
  });
}

ApiClient _marketplaceFeedClient({required String categorySlug}) {
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
                    'listing_id': 'gateway-listing-1',
                    'product_id': 'catalog-product-1',
                    'site_id': 'store-1',
                    'name': 'Gateway item',
                    'category_slug': categorySlug,
                    'approved_at': '2026-10-01T00:00:00Z',
                    'price': 120,
                    'compare_price': 150,
                  },
                ],
                'meta': {'limit': 100, 'next_cursor': null},
              },
            ),
          );
        },
      ),
    );
  return ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
  );
}
