import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/data/marketplace_repository.dart';
import 'package:letbuyy_marketplace/screens/shop/product_details_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

class _EmptyMarketplaceRepository implements MarketplaceRepository {
  @override
  Future<MarketplaceFeedPage> feed({
    String? category,
    String? search,
    int? limit,
    MarketplaceFeedCursor? cursor,
  }) async => throw UnimplementedError();

  @override
  Future<List<MarketplaceCategory>> categories() async =>
      throw UnimplementedError();

  @override
  Future<MarketplaceListingDetail?> listing(String listingId) async => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<
    ({
      ProductProvider provider,
      int Function() requestCount,
      int Function() feedRequestCount,
    })
  >
  openDetail(
    WidgetTester tester, {
    required int Function() responseStatus,
    Map<String, Object?>? listingBody,
    List<Map<String, Object?>>? initialFeed,
    List<Map<String, Object?>>? refreshedFeed,
    WishlistProvider? wishlist,
  }) async {
    if (wishlist == null) SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();

    var requests = 0;
    var feedRequests = 0;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/storefront/marketplace/feed')) {
            final pages = [initialFeed, refreshedFeed];
            final items = pages[feedRequests++] ?? const [];
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': items,
                  'meta': {'limit': 100, 'next_cursor': null},
                },
              ),
            );
            return;
          }
          if (options.path.contains('/storefront/marketplace/listings/')) {
            requests++;
            final status = responseStatus();
            if (status >= 400) {
              handler.reject(
                DioException(
                  requestOptions: options,
                  response: Response(
                    requestOptions: options,
                    statusCode: status,
                    data: {'error': 'synthetic gateway failure'},
                  ),
                ),
              );
              return;
            }
          }
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'data': listingBody},
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
    final provider = ProductProvider(client: client);
    if (initialFeed != null) {
      await tester.runAsync(() => provider.loadProducts());
    }

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ProductProvider>.value(value: provider),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
          if (wishlist != null)
            ChangeNotifierProvider<WishlistProvider>.value(value: wishlist)
          else
            ChangeNotifierProvider<WishlistProvider>(
              create: (_) => WishlistProvider(),
            ),
          Provider<MarketplaceRepository>.value(
            value: _EmptyMarketplaceRepository(),
          ),
        ],
        child: const MaterialApp(
          home: ProductDetailsScreen(productId: 'revoked-listing'),
        ),
      ),
    );
    await tester.pump();
    await tester.pumpAndSettle();
    return (
      provider: provider,
      requestCount: () => requests,
      feedRequestCount: () => feedRequests,
    );
  }

  testWidgets(
    'a denied direct listing link shows unavailable, not endless loading',
    (tester) async {
      final result = await openDetail(tester, responseStatus: () => 404);

      expect(result.requestCount(), 1);
      expect(result.provider.selectedProduct, isNull);
      expect(result.provider.isLoading, isFalse);
      expect(find.text('This product is no longer available'), findsOneWidget);
      expect(find.text('Loading product...'), findsNothing);
      expect(find.text('Browse products'), findsOneWidget);
    },
  );

  testWidgets(
    'a detail transport failure is retryable and never claims removal',
    (tester) async {
      var responseNumber = 0;
      final result = await openDetail(
        tester,
        responseStatus: () => responseNumber++ == 0 ? 503 : 404,
      );

      expect(result.requestCount(), 1);
      expect(find.text('Could not load this product'), findsOneWidget);
      expect(find.text('This product is no longer available'), findsNothing);

      await tester.tap(find.text('Try again'));
      await tester.pump();
      await tester.pumpAndSettle();

      expect(result.requestCount(), 2);
      expect(find.text('This product is no longer available'), findsOneWidget);
      expect(find.text('Loading product...'), findsNothing);
    },
  );

  testWidgets(
    'a confirmed detail refreshes similar-product cards from the canonical feed',
    (tester) async {
      final result = await openDetail(
        tester,
        responseStatus: () => 200,
        listingBody: {
          'listing_id': 'target-listing',
          'product_id': 'target-product',
          'site_id': 'site-1',
          'name': 'Target product',
          'category_slug': 'bags',
          'price': 250,
          'approved_at': '2026-10-01T00:00:00Z',
        },
        initialFeed: [
          {
            'listing_id': 'revoked-similar',
            'product_id': 'old-product',
            'site_id': 'site-1',
            'name': 'Previously approved similar product',
            'category_slug': 'bags',
            'price': 100,
            'approved_at': '2026-10-01T00:00:00Z',
          },
        ],
        refreshedFeed: [
          {
            'listing_id': 'current-similar',
            'product_id': 'current-product',
            'site_id': 'site-1',
            'name': 'Currently approved similar product',
            'category_slug': 'bags',
            'price': 120,
            'approved_at': '2026-10-02T00:00:00Z',
          },
        ],
      );

      expect(result.provider.products.single.id, 'current-similar');
      expect(find.text('Previously approved similar product'), findsNothing);
      expect(find.text('Currently approved similar product'), findsOneWidget);
      expect(result.requestCount(), 1);
      expect(result.feedRequestCount(), 2);
    },
  );
  final listing = <String, Object?>{
    'listing_id': 'revoked-listing',
    'product_id': 'target-product',
    'site_id': 'site-1',
    'name': 'Synthetic saved product',
    'category_slug': 'bags',
    'price': 250,
    'approved_at': '2026-10-01T00:00:00Z',
  };
  ProductModel savedProduct() {
    final now = DateTime.now();
    return ProductModel(
      id: 'revoked-listing',
      sellerId: 'site-1',
      name: 'Synthetic saved product',
      description: '',
      salePrice: 250,
      categoryId: 'bags',
      images: const [],
      stock: 5,
      createdAt: now,
      updatedAt: now,
    );
  }

  testWidgets('a canonical product exposes seller rewards from its seller information', (tester) async {
    await openDetail(tester,responseStatus:()=>200,listingBody:{...listing,'site_id':'22222222-2222-4222-8222-222222222222'});
    expect(find.text('Seller rewards'),findsOneWidget);
  });

  testWidgets(
    'mounted product detail reads live wishlist membership after the canonical buyer switches',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await SharedPreferencesService.init();
      final wish = WishlistProvider();
      addTearDown(wish.dispose);
      await tester.runAsync(() => wish.ready);
      wish.updateUserId('buyer-a');
      await tester.runAsync(() => wish.ready);
      await tester.runAsync(() => wish.addItem(savedProduct()));
      await openDetail(
        tester,
        responseStatus: () => 200,
        listingBody: listing,
        wishlist: wish,
      );
      expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
      wish.updateUserId('buyer-b');
      await tester.pump();
      expect(
        find.byIcon(Icons.favorite_rounded),
        findsNothing,
        reason: 'A membership must disappear while B loads',
      );
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.favorite_border_rounded), findsOneWidget);
    },
  );
  testWidgets(
    'failed product detail wishlist storage does not display a successful saved heart',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final store = _FailedWishlistStore();
      SharedPreferencesStorePlatform.instance = store;
      await SharedPreferencesService.init();
      final wish = WishlistProvider();
      addTearDown(wish.dispose);
      await tester.runAsync(() => wish.ready);
      await openDetail(
        tester,
        responseStatus: () => 200,
        listingBody: listing,
        wishlist: wish,
      );
      store.failNext = true;
      await tester.tap(find.byIcon(Icons.favorite_border_rounded));
      await tester.pumpAndSettle();
      expect(wish.productIds, isEmpty);
      expect(
        find.byIcon(Icons.favorite_rounded),
        findsNothing,
        reason: 'Storage refusal cannot produce a saved membership icon',
      );
      expect(find.text('Could not save your wishlist'), findsOneWidget);
    },
  );
}

class _FailedWishlistStore extends InMemorySharedPreferencesStore {
  _FailedWishlistStore() : super.empty();
  bool failNext = false;
  @override
  Future<bool> setValue(String type, String key, Object value) async {
    if (failNext) {
      failNext = false;
      return false;
    }
    return super.setValue(type, key, value);
  }
}
