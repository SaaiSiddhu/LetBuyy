// Widget concurrency/error-state checks only. Fake transport is explicit here;
// Gateway/database ownership and real device acceptance are separate verdicts.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/orders/orders_screen.dart';
import 'package:letbuyy_marketplace/screens/orders/order_details_screen.dart';
import 'package:provider/provider.dart';
import 'support/buyer_session_fixture.dart';

class _Orders extends BuyerOrdersApi {
  _Orders() : super(ApiClient(baseUrl: 'https://gateway.example.invalid'));
  final cursors = <String?>[];
  Future<BuyerOrdersPage> Function(String, String?) page = (token, _) async => _page('ORDER-$token');
  Future<JsonMap> Function(String, String) detail = (token, id) async => _detail(id, 'ITEM-$token');
  @override Future<BuyerOrdersPage> list(String token, {int limit = 20, String? cursor}) {
    cursors.add(cursor);
    return page(token, cursor);
  }
  @override Future<JsonMap> get(String token, String orderId) => detail(token, orderId);
}

JsonMap _summary(String id) => {'id': id, 'site_id': 'site', 'store_name': 'Synthetic store', 'order_number': id, 'status': 'confirmed', 'total': 25, 'currency': 'INR', 'created_at': null};
BuyerOrdersPage _page(String id, {bool more = false}) => BuyerOrdersPage(orders: [_summary(id)], hasMore: more, nextCursor: more ? 'cursor-1' : null);
JsonMap _detail(String id, String item) => {'id': id, 'site_id': 'site', 'order_number': id, 'status': 'confirmed', 'total': 25, 'currency': 'INR', 'items': [{'name': item, 'quantity': 1, 'total': 25}], 'shipping_address': {'name': 'Synthetic recipient', 'line1': '123 Synthetic Street', 'city': 'Chennai'}};

Future<({BuyerSignInController auth, _Orders orders})> harness() async =>
    (auth: await createSyntheticBuyerSession(), orders: _Orders());

Widget wrap(BuyerSignInController auth, BuyerOrdersApi orders, Widget screen) => MultiProvider(providers: [
  ChangeNotifierProvider<BuyerSignInController>.value(value: auth),
  Provider<BuyerOrdersApi>.value(value: orders),
], child: MaterialApp(home: screen));

void main() {
  testWidgets('history reads a real page state and opens the session-owned detail screen', (tester) async {
    final h = (await tester.runAsync(harness))!; addTearDown(h.auth.dispose);
    await tester.pumpWidget(wrap(h.auth, h.orders, const OrdersScreen()));
    await tester.pumpAndSettle();
    expect(find.text('ORDER-A'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('buyer-order-ORDER-A'))); await tester.pumpAndSettle();
    expect(find.text('ITEM-A'), findsOneWidget);
    expect(find.textContaining('123 Synthetic Street'), findsOneWidget);
    expect(find.textContaining('Date unavailable'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('an old buyer list response cannot replace the new buyer after switching', (tester) async {
    final h = (await tester.runAsync(harness))!; addTearDown(h.auth.dispose);
    final lateA = Completer<BuyerOrdersPage>();
    h.orders.page = (token, _) => token == 'A' ? lateA.future : Future.value(_page('ORDER-B'));
    await tester.pumpWidget(wrap(h.auth, h.orders, const OrdersScreen())); await tester.pump();
    await tester.runAsync(h.auth.signOut); await tester.pump();
    expect(find.text('Sign in to view your orders'), findsOneWidget);
    await tester.runAsync(h.auth.signIn); await tester.pumpAndSettle();
    expect(find.text('ORDER-B'), findsOneWidget);
    lateA.complete(_page('PRIVATE-ORDER-A')); await tester.pumpAndSettle();
    expect(find.text('PRIVATE-ORDER-A'), findsNothing);
    expect(find.text('ORDER-B'), findsOneWidget);
  });

  testWidgets('late private detail is discarded when the new buyer receives a denial', (tester) async {
    final h = (await tester.runAsync(harness))!; addTearDown(h.auth.dispose);
    final lateA = Completer<JsonMap>();
    h.orders.detail = (token, id) => token == 'A' ? lateA.future : Future.error(const ApiException(message: 'Not found', statusCode: 404, code: 'NOT_FOUND'));
    await tester.pumpWidget(wrap(h.auth, h.orders, const OrderDetailsScreen(orderId: 'ORDER-A'))); await tester.pump();
    await tester.runAsync(h.auth.signOut); await tester.runAsync(h.auth.signIn); await tester.pumpAndSettle();
    expect(find.text('We couldn’t find this order.'), findsOneWidget);
    lateA.complete(_detail('ORDER-A', 'PRIVATE-ITEM-A')); await tester.pumpAndSettle();
    expect(find.text('PRIVATE-ITEM-A'), findsNothing);
  });

  testWidgets('more-page double taps send once and recovery retries the same cursor without duplicate rows', (tester) async {
    final h = (await tester.runAsync(harness))!; addTearDown(h.auth.dispose);
    final delayed = Completer<BuyerOrdersPage>();
    h.orders.page = (_, cursor) => cursor == null ? Future.value(_page('ORDER-1', more: true)) : delayed.future;
    await tester.pumpWidget(wrap(h.auth, h.orders, const OrdersScreen())); await tester.pumpAndSettle();
    await tester.tap(find.text('Load more')); await tester.tap(find.text('Load more')); await tester.pump();
    expect(h.orders.cursors, [null, 'cursor-1']);
    delayed.completeError(const ApiException(message: 'Unavailable', statusCode: 500, code: 'DB_ERROR')); await tester.pumpAndSettle();
    expect(find.text('ORDER-1'), findsOneWidget);
    h.orders.page = (_, cursor) async => BuyerOrdersPage(orders: [_summary('ORDER-1'), _summary('ORDER-2')], hasMore: false);
    await tester.tap(find.text('Try loading more again')); await tester.pumpAndSettle();
    expect(h.orders.cursors, [null, 'cursor-1', 'cursor-1']);
    expect(find.text('ORDER-1'), findsOneWidget); expect(find.text('ORDER-2'), findsOneWidget);
  });

  testWidgets('ended sessions remove already-visible records when a later page is denied', (tester) async {
    final h = (await tester.runAsync(harness))!; addTearDown(h.auth.dispose);
    h.orders.page = (_, cursor) => cursor == null ? Future.value(_page('PRIVATE-ORDER-A', more: true)) : Future.error(const ApiException(message: 'Ended', statusCode: 401, code: 'UNAUTHORIZED'));
    await tester.pumpWidget(wrap(h.auth, h.orders, const OrdersScreen())); await tester.pumpAndSettle();
    await tester.tap(find.text('Load more')); await tester.pumpAndSettle();
    expect(find.text('PRIVATE-ORDER-A'), findsNothing);
    expect(find.text('Your LetBuyy sign-in has ended. Sign in again from Profile.'), findsOneWidget);
  });
}
