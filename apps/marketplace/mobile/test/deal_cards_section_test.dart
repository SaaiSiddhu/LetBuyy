// FB-2 — the first customer_app screen to read the canonical marketplace instead of Firestore.
//
// What these tests exist to catch, in order of how much a shopper would care:
//
//  1. A failed read rendering as "No deals available". That is the dangerous bug here, because it
//     is invisible: the screen looks calm and truthful while telling a shopper that a merchant's
//     discounted stock does not exist. Error and empty must never collapse into one state.
//  2. Navigation carrying a PRODUCT id where the canonical detail route takes a LISTING id. Both
//     are non-empty strings, so nothing would crash — the tap would just open the wrong thing, or
//     404 for a listing that is fine.
//  3. The discount being trusted rather than computed. It is derived from the gateway's price and
//     compare_price here; a stored percentage is a number nobody recomputed.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/data/marketplace_repository.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/deal_cards_section.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';

class _FakeRepository implements MarketplaceRepository {
  _FakeRepository({this.items = const <MarketplaceFeedItem>[], this.error, this.delay});

  final List<MarketplaceFeedItem> items;
  final Object? error;
  final Duration? delay;
  int feedCalls = 0;
  int? lastLimit;

  @override
  Future<MarketplaceFeedPage> feed({
    String? category,
    String? search,
    int? limit,
    MarketplaceFeedCursor? cursor,
  }) async {
    feedCalls++;
    lastLimit = limit;
    if (delay != null) await Future<void>.delayed(delay!);
    if (error != null) throw error!;
    return MarketplaceFeedPage(items: items);
  }

  @override
  Future<List<MarketplaceCategory>> categories() async => const <MarketplaceCategory>[];

  @override
  Future<MarketplaceListingDetail?> listing(String listingId) async => null;
}

MarketplaceFeedItem _item({
  required String listingId,
  String productId = 'prod-should-never-be-used',
  String name = 'Thing',
  num? price,
  num? comparePrice,
}) {
  return MarketplaceFeedItem(
    listingId: listingId,
    productId: productId,
    siteId: 'site-1',
    name: name,
    approvedAt: '2026-09-05T00:00:00Z',
    images: const <String>['https://example.invalid/a.png'],
    price: price,
    comparePrice: comparePrice,
  );
}

Widget _host(MarketplaceRepository repo, {RouteFactory? onGenerateRoute}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
      Provider<MarketplaceRepository>.value(value: repo),
    ],
    child: MaterialApp(
      onGenerateRoute: onGenerateRoute,
      home: const Scaffold(body: DealCardsSection()),
    ),
  );
}

void main() {
  group('discountPercent', () {
    test('derives percent off from the canonical pair', () {
      expect(discountPercent(price: 750, comparePrice: 1000), 25);
      expect(discountPercent(price: 1, comparePrice: 3), 66); // floored, not rounded
    });

    test('returns 0 when no discount can be established', () {
      expect(discountPercent(price: null, comparePrice: 1000), 0);
      expect(discountPercent(price: 750, comparePrice: null), 0);
      expect(discountPercent(price: 1000, comparePrice: 1000), 0, reason: 'equal is not a discount');
      expect(discountPercent(price: 1200, comparePrice: 1000), 0, reason: 'never negative');
      expect(discountPercent(price: 750, comparePrice: 0), 0);
      expect(discountPercent(price: 750, comparePrice: -5), 0);
    });

    test('a free item is 100% off, never more', () {
      expect(discountPercent(price: 0, comparePrice: 1000), 100);
    });

    // These two isolate guards that the other cases cannot reach. Without them the earlier
    // assertions all still pass while the function is broken for these inputs — checked by
    // planting each guard's removal individually, not assumed.
    test('a zero compare price never divides', () {
      // (0 - -5) / 0 is Infinity, and Infinity.floor() throws rather than returning a number.
      expect(discountPercent(price: -5, comparePrice: 0), 0);
    });

    test('a negative price is not a discount over 100%', () {
      // Without the price guard this is (100 - -5) / 100 = 105%, clamped down to a confident
      // "100% off" on a price that should not exist at all.
      expect(discountPercent(price: -5, comparePrice: 100), 0);
    });
  });

  group('DealCardsSection', () {
    testWidgets('shows a spinner while the feed is in flight', (tester) async {
      final repo = _FakeRepository(delay: const Duration(milliseconds: 50));
      await tester.pumpWidget(_host(repo));
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
    });

    testWidgets('renders only eligible listings with a prior-low comparison', (tester) async {
      final repo = _FakeRepository(items: [
        _item(listingId: 'l-discounted', name: 'Half price', price: 500, comparePrice: 1000),
        _item(listingId: 'l-full-price', name: 'Full price', price: 1000, comparePrice: 1000),
        _item(listingId: 'l-no-compare', name: 'No compare', price: 900),
      ]);
      await tester.pumpWidget(_host(repo));
      await tester.pumpAndSettle();

      expect(find.text('Half price'), findsOneWidget);
      expect(find.text('50% below prior 30-day low'), findsOneWidget);
      expect(find.text('Up to 50% Off'), findsNothing);
      expect(find.text('Full price'), findsNothing);
      expect(find.text('No compare'), findsNothing);
    });

    testWidgets('empty means empty', (tester) async {
      final repo = _FakeRepository(items: [
        _item(listingId: 'l1', name: 'Full price', price: 1000, comparePrice: 1000),
      ]);
      await tester.pumpWidget(_host(repo));
      await tester.pumpAndSettle();

      expect(find.text('No deals available'), findsOneWidget);
      expect(find.text("Couldn't load deals"), findsNothing);
    });

    testWidgets('a failed read says so and does NOT claim there are no deals', (tester) async {
      final repo = _FakeRepository(error: StateError('gateway unreachable'));
      await tester.pumpWidget(_host(repo));
      await tester.pumpAndSettle();

      expect(find.text("Couldn't load deals"), findsOneWidget);
      expect(
        find.text('No deals available'),
        findsNothing,
        reason: 'an unreachable gateway must never render as an empty catalogue',
      );
    });

    testWidgets('tapping a deal navigates with the LISTING id, not the product id', (tester) async {
      final repo = _FakeRepository(items: [
        _item(
          listingId: 'listing-abc',
          productId: 'product-xyz',
          name: 'Half price',
          price: 500,
          comparePrice: 1000,
        ),
      ]);
      Object? passedArgument;
      await tester.pumpWidget(_host(
        repo,
        onGenerateRoute: (settings) {
          passedArgument = settings.arguments;
          return MaterialPageRoute<void>(builder: (_) => const SizedBox.shrink());
        },
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Half price'));
      await tester.pumpAndSettle();

      expect(passedArgument, 'listing-abc');
      expect(passedArgument, isNot('product-xyz'));
    });

    testWidgets('over-fetches so the client-side discount filter has candidates', (tester) async {
      final repo = _FakeRepository();
      await tester.pumpWidget(_host(repo));
      await tester.pumpAndSettle();

      expect(repo.feedCalls, 1);
      expect(
        repo.lastLimit,
        greaterThan(10),
        reason: 'the gateway has no on-sale predicate, so a page of 10 could yield 0 deals',
      );
    });
  });
}
