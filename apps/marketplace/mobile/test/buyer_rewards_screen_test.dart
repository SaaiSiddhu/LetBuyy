// Widget state/fault tests only. Fake reads cannot certify real ownership/device acceptance.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/profile/buyer_rewards_screen.dart';
import 'package:provider/provider.dart';

import 'support/buyer_session_fixture.dart';

const site = '22222222-2222-4222-8222-222222222222';
JsonMap _summary(String points, {bool active = true}) => {
  'site_id': site,
  'enrolled': true,
  'balance': points,
  'is_active': active,
};
JsonMap entry(String id) => {
  'id': id,
  'entry_type': 'earned',
  'points': '17',
  'balance_after': '17',
  'order_id': null,
  'created_at': '2026-10-16T00:00:00Z',
};

class _Rewards extends BuyerLoyaltyApi {
  _Rewards() : super(ApiClient(baseUrl: 'https://gateway.example.invalid'));
  int summaryCalls = 0;
  Future<JsonMap> Function(String, String) read = (token, site) async =>
      _summary(token == 'A' ? '17' : '29');
  Future<List<JsonMap>> Function(String, String) activity = (
    token,
    site,
  ) async => [entry('entry-$token')];
  @override
  Future<JsonMap> summary(String token, String site) {
    summaryCalls++;
    return read(token, site);
  }

  @override
  Future<List<JsonMap>> history(String token, String site, {int limit = 25}) =>
      activity(token, site);
}

Widget wrap(BuyerSignInController auth, _Rewards api, {String seller = site}) =>
    MultiProvider(
      providers: [
        ChangeNotifierProvider<BuyerSignInController>.value(value: auth),
        Provider<BuyerLoyaltyApi>.value(value: api),
      ],
      child: MaterialApp(
        home: BuyerRewardsScreen(siteId: seller, storeName: 'Synthetic seller'),
      ),
    );
void main() {
  testWidgets(
    'the seller balance and recent activity render from the canonical transport result',
    (tester) async {
      final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
      addTearDown(auth.dispose);
      final api = _Rewards();
      api.read = (_, _) async => _summary('9007199254740993');
      await tester.pumpWidget(wrap(auth, api));
      await tester.pumpAndSettle();
      expect(find.text('9007199254740993 points'), findsOneWidget);
      expect(find.text('Points earned'), findsOneWidget);
      expect(find.text('Recent activity (up to 25)'), findsOneWidget);
    },
  );
  testWidgets(
    'a buyer switch hides visible points immediately and ignores late previous-buyer activity',
    (tester) async {
      final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
      addTearDown(auth.dispose);
      final api = _Rewards();
      final late = Completer<List<JsonMap>>();
      api.activity = (token, _) =>
          token == 'A' ? late.future : Future.value([entry('entry-B')]);
      await tester.pumpWidget(wrap(auth, api));
      await tester.pump();
      await tester.runAsync(auth.signOut);
      await tester.pump();
      expect(find.text('Sign in to view your rewards'), findsOneWidget);
      await tester.runAsync(auth.signIn);
      await tester.pumpAndSettle();
      expect(find.text('29 points'), findsOneWidget);
      late.complete([entry('PRIVATE-A')]);
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('buyer-reward-PRIVATE-A')),
        findsNothing,
      );
      expect(find.text('29 points'), findsOneWidget);
      await tester.runAsync(auth.signOut);
      await tester.pump();
      expect(find.text('29 points'), findsNothing);
    },
  );
  testWidgets(
    'an outage is not zero and retry recovers without exposing old private state',
    (tester) async {
      final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
      addTearDown(auth.dispose);
      final api = _Rewards();
      api.read = (_, _) => Future.error(
        const ApiException(
          message: 'Unavailable',
          statusCode: 503,
          code: 'DB_ERROR',
        ),
      );
      await tester.pumpWidget(wrap(auth, api));
      await tester.pumpAndSettle();
      expect(
        find.text('We couldn’t load your rewards. Please try again.'),
        findsOneWidget,
      );
      expect(find.text('0 points'), findsNothing);
      api.read = (_, _) async => _summary('17');
      await tester.tap(find.text('Try Again'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<Text>(find.byKey(const ValueKey('buyer-rewards-balance')))
            .data,
        '17 points',
      );
      expect(api.summaryCalls, 2);
    },
  );
  testWidgets(
    'a new buyer denial cannot receive a late successful response from the old buyer',
    (tester) async {
      final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
      addTearDown(auth.dispose);
      final api = _Rewards();
      final late = Completer<JsonMap>();
      api.read = (token, _) => token == 'A'
          ? late.future
          : Future.error(
              const ApiException(
                message: 'Ended',
                statusCode: 401,
                code: 'UNAUTHORIZED',
              ),
            );
      await tester.pumpWidget(wrap(auth, api));
      await tester.pump();
      await tester.runAsync(auth.signOut);
      await tester.runAsync(auth.signIn);
      await tester.pumpAndSettle();
      late.complete(_summary('777'));
      await tester.pumpAndSettle();
      expect(find.text('777 points'), findsNothing);
      expect(
        find.text(
          'Your LetBuyy sign-in has ended. Sign in again from Profile.',
        ),
        findsOneWidget,
      );
    },
  );
  testWidgets('not enrolled, zero and paused have different honest states', (
    tester,
  ) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
    addTearDown(auth.dispose);
    final api = _Rewards();
    api.read = (_, _) async => {
      'site_id': site,
      'enrolled': false,
      'balance': null,
    };
    await tester.pumpWidget(wrap(auth, api));
    await tester.pumpAndSettle();
    expect(find.text('No rewards programme'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.read = (_, _) async => _summary('0', active: false);
    api.activity = (_, _) async => [];
    await tester.pumpWidget(wrap(auth, api));
    await tester.pumpAndSettle();
    expect(find.text('0 points'), findsOneWidget);
    expect(find.textContaining('programme is paused'), findsOneWidget);
    expect(find.text('No rewards activity yet.'), findsOneWidget);
  });
  testWidgets(
    'duplicate retry taps send one read pair and an unmounted screen ignores completion',
    (tester) async {
      final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
      addTearDown(auth.dispose);
      final api = _Rewards();
      api.read = (_, _) => Future.error(
        const ApiException(
          message: 'Unavailable',
          statusCode: 503,
          code: 'DB_ERROR',
        ),
      );
      await tester.pumpWidget(wrap(auth, api));
      await tester.pumpAndSettle();
      final pending = Completer<JsonMap>();
      api.read = (_, _) => pending.future;
      await tester.tap(find.text('Try Again'));
      await tester.tap(find.text('Try Again'));
      await tester.pump();
      expect(api.summaryCalls, 2);
      await tester.pumpWidget(const SizedBox());
      pending.complete(_summary('17'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a changed seller discards the previous seller response even for the same buyer',
    (tester) async {
      final auth = (await tester.runAsync(createSyntheticBuyerSession))!;
      addTearDown(auth.dispose);
      final api = _Rewards();
      final pending = Completer<JsonMap>();
      api.read = (_, seller) =>
          seller == site ? pending.future : Future.value(_summary('29'));
      await tester.pumpWidget(wrap(auth, api));
      await tester.pump();
      await tester.pumpWidget(
        wrap(auth, api, seller: '11111111-1111-4111-8111-111111111111'),
      );
      await tester.pumpAndSettle();
      pending.complete(_summary('777'));
      await tester.pumpAndSettle();
      expect(find.text('777 points'), findsNothing);
      expect(find.text('29 points'), findsOneWidget);
    },
  );
}
