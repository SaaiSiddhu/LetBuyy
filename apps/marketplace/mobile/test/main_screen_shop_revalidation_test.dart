import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/data/marketplace_repository.dart';
import 'package:letbuyy_marketplace/providers/search_provider.dart';
import 'package:letbuyy_marketplace/screens/main_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _NoopBrowser implements BuyerSignInBrowser {
  @override
  Future<Uri?> authorize(Uri url) async => null;

  @override
  Future<void> cancelWaiting() async {}

  @override
  Future<Uri?> takeLaunchCallback() async => null;
}

class _NoopSessionStore implements BuyerSessionStore {
  @override
  Future<void> deletePending() async {}

  @override
  Future<void> deleteSession() async {}

  @override
  Future<PendingBuyerSignIn?> readPending() async => null;

  @override
  Future<StoredBuyerSession?> readSession() async => null;

  @override
  Future<void> writePending(PendingBuyerSignIn pending) async {}

  @override
  Future<void> writeSession(StoredBuyerSession session) async {}
}

class _EmptyMarketplaceRepository implements MarketplaceRepository {
  @override
  Future<MarketplaceFeedPage> feed({
    String? category,
    String? search,
    int? limit,
    MarketplaceFeedCursor? cursor,
  }) async => throw UnimplementedError();

  @override
  Future<List<MarketplaceCategory>> categories() async => const [];

  @override
  Future<MarketplaceListingDetail?> listing(String listingId) async => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('returning to Shop through MainScreen revalidates its feed', (
    tester,
  ) async {
    // The VM test host reports Linux to PlatformResponsive, so use its desktop
    // layout width while still exercising MainScreen's native (non-web) tabs.
    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();

    var currentListingId = 'previous-listing';
    var feedRequests = 0;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/storefront/marketplace/feed')) {
            feedRequests++;
            final isPrevious = currentListingId == 'previous-listing';
            final listing = {
              'listing_id': currentListingId,
              'product_id': '$currentListingId-product',
              'site_id': 'site-1',
              'name': 'Listing $currentListingId',
              'category_slug': 'bags',
              'price': isPrevious ? 100 : 120,
              'approved_at': isPrevious
                  ? '2026-10-01T00:00:00Z'
                  : '2026-10-02T00:00:00Z',
            };
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': [listing],
                  'meta': {'limit': 100, 'next_cursor': null},
                },
              ),
            );
            return;
          }

          // Other eager IndexedStack screens may ask for categories or buyer data;
          // they are deliberately empty and have no bearing on the feed assertion.
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {'data': []},
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
    final signIn = BuyerSignInController(
      client: BuyerSignInClient(identityBaseUrl: 'https://identity.test'),
      accounts: BuyerAccountApi(client),
      browser: _NoopBrowser(),
      store: _NoopSessionStore(),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<ApiClient>.value(value: client),
          ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
          ChangeNotifierProvider<ProductProvider>.value(value: products),
          ChangeNotifierProvider<CategoryProvider>.value(value: categories),
          ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
          ChangeNotifierProvider<WishlistProvider>(
            create: (_) => WishlistProvider(),
          ),
          ChangeNotifierProvider<SearchProvider>(
            create: (_) => SearchProvider(),
          ),
          Provider<MarketplaceRepository>.value(
            value: _EmptyMarketplaceRepository(),
          ),
          ChangeNotifierProvider<BuyerSignInController>.value(value: signIn),
          Provider<BuyerAccountApi>.value(value: BuyerAccountApi(client)),
          Provider<BuyerAddressApi>.value(value: BuyerAddressApi(client)),
        ],
        child: const MaterialApp(home: MainScreen()),
      ),
    );
    // MainScreen keeps several animated destinations alive in its IndexedStack;
    // pump a bounded window rather than waiting for every ticker to go idle.
    for (var frame = 0; frame < 12; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(feedRequests, greaterThan(0));
    expect(products.products.single.id, 'previous-listing');
    final requestsBeforeReturn = feedRequests;

    // Select Shop once, leave for Home, then return. The first Shop selection
    // has its own initState read; the return path is the MainScreen behavior
    // this integration test is meant to exercise.
    await tester.tap(find.byIcon(Icons.shopping_bag_outlined).last);
    for (var frame = 0; frame < 5; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.tap(find.byIcon(Icons.home_outlined).last);
    for (var frame = 0; frame < 5; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    currentListingId = 'current-listing';
    await tester.tap(find.byIcon(Icons.shopping_bag_outlined).last);
    for (var frame = 0; frame < 8; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(find.byIcon(Icons.shopping_bag_rounded), findsOneWidget);
    expect(feedRequests, greaterThan(requestsBeforeReturn));
    expect(products.products.single.id, 'current-listing');

    final requestsBeforeResume = feedRequests;
    currentListingId = 'after-resume-listing';
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    for (var frame = 0; frame < 8; frame++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(feedRequests, greaterThan(requestsBeforeResume));
    expect(products.products.single.id, 'after-resume-listing');

    await tester.pumpWidget(const SizedBox.shrink());
    products.dispose();
    signIn.dispose();
  });
}
