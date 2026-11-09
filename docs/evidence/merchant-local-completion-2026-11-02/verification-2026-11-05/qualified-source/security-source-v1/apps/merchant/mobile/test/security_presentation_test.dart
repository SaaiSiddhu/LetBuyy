// Presentation lifetimes only; synthetic factor transport, no real account changes.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'two_factor_screen_test.dart' as f;

Future<f.SecurityHarness> mount(
  WidgetTester tester, {
  String action = 'refund.approve',
  bool dark = false,
  double scale = 1,
  Size size = const Size(440, 1200),
}) async {
  SharedPreferences.setMockInitialValues({});
  final h = f.SecurityHarness();
  await h.init();
  addTearDown(h.service.dispose);
  addTearDown(h.stores.dispose);
  addTearDown(h.api.close);
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    h.app(
      action: action,
      scale: scale,
      theme: dark ? StoreTheme.dark() : StoreTheme.light(),
    ),
  );
  await f.press(tester, 'Open security');
  return h;
}

Future<void> cover(WidgetTester tester) async {
  tester
      .state<NavigatorState>(find.byType(Navigator))
      .push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('Cover destination')),
        ),
      );
  await f.settle(tester);
}

Finder verify() => find.widgetWithText(FilledButton, 'Verify approval');
void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets('payout step-up identifies the actual approval action', (
    tester,
  ) async {
    await mount(tester, action: 'payout.release');
    expect(find.text('Verify payout release'), findsOneWidget);
    expect(find.text('Verify refund approval'), findsNothing);
  });
  testWidgets(
    'a captured approval callback cannot dispatch from a covered route',
    (tester) async {
      final h = await mount(tester);
      await tester.enterText(find.byType(TextField), '123456');
      final callback = tester.widget<FilledButton>(verify()).onPressed!;
      await cover(tester);
      callback();
      await f.settle(tester);
      expect(
        h.api.calls.where((c) => c.path == '/security/step-up/challenges'),
        isEmpty,
      );
      expect(h.proof, isNull);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a covered overview completion leaves loading and publishes current status on return',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final h = f.SecurityHarness();
      await h.init();
      addTearDown(h.service.dispose);
      addTearDown(h.stores.dispose);
      addTearDown(h.api.close);
      h.api.heldOverview = Completer<Map<String, dynamic>>();
      await tester.pumpWidget(h.app(action: 'refund.approve'));
      await f.press(tester, 'Open security');
      await cover(tester);
      h.api.heldOverview!.complete({
        'custom_user_id': 'actor-a',
        'mfa_enabled': true,
        'factors': [
          {'id': 'factor-a', 'status': 'active', 'factor_type': 'totp'},
        ],
        'sessions': [],
      });
      await f.settle(tester);
      tester.state<NavigatorState>(find.byType(Navigator)).pop();
      await f.settle(tester);
      expect(verify(), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a covered approval reply requires readback without delivering its proof',
    (tester) async {
      final h = await mount(tester);
      h.api.holdMutation = Completer<void>();
      h.api.mutationEntered = Completer<void>();
      await tester.enterText(find.byType(TextField), '123456');
      await tester.tap(verify());
      await f.settle(tester);
      expect(h.api.mutationEntered!.isCompleted, isTrue);
      await cover(tester);
      h.api.holdMutation!.complete();
      await f.settle(tester);
      expect(find.text('Cover destination'), findsOneWidget);
      expect(h.proof, isNull);
      tester.state<NavigatorState>(find.byType(Navigator)).pop();
      await f.settle(tester);
      expect(find.text('Review current security status'), findsOneWidget);
      expect(
        h.api.calls
            .where((c) => c.path == '/security/step-up/challenges')
            .length,
        1,
      );
      expect(h.proof, isNull);
      await tester.tap(find.text('Review current security status'));
      await f.settle(tester);
      expect(verify(), findsOneWidget);
      expect(
        h.api.calls
            .where((c) => c.path == '/security/step-up/challenges')
            .length,
        1,
      );
      expect(h.proof, isNull);
      expect(tester.takeException(), isNull);
    },
  );
  for (final action in ['refund.approve', 'payout.release']) {
    testWidgets('current $action returns only its original bound proof', (
      tester,
    ) async {
      final h = await mount(tester, action: action);
      await tester.enterText(find.byType(TextField), '123456');
      await tester.tap(verify());
      await f.settle(tester);
      expect(h.proof?.action, action);
      expect(h.proof?.context.storeId, h.stores.selectedStoreId);
      final call = h.api.calls.singleWhere(
        (c) => c.path == '/security/step-up/challenges',
      );
      final body = call.options!.body as Map;
      expect(body['action'], action);
      expect(body['idempotency_key'], call.options!.idempotencyKey);
      expect(body['factor_id'], 'factor-a');
      expect(find.text('Open security'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  for (final dark in [false, true]) {
    testWidgets(
      'payout approval scales with keyboard and readable busy state dark=$dark',
      (tester) async {
        final h = await mount(
          tester,
          action: 'payout.release',
          dark: dark,
          scale: 2.4,
          size: const Size(320, 640),
        );
        tester.view.viewInsets = const FakeViewPadding(bottom: 220);
        addTearDown(tester.view.resetViewInsets);
        await tester.pump();
        await tester.scrollUntilVisible(
          find.byType(TextField),
          100,
          scrollable: find
              .byWidgetPredicate(
                (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
              )
              .first,
        );
        await tester.enterText(find.byType(TextField), '123456999');
        expect(
          tester.widget<TextField>(find.byType(TextField)).controller!.text,
          '123456',
        );
        await tester.scrollUntilVisible(
          verify(),
          100,
          scrollable: find
              .byWidgetPredicate(
                (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
              )
              .first,
        );
        await tester.pumpAndSettle();
        h.api.holdMutation = Completer<void>();
        h.api.mutationEntered = Completer<void>();
        await tester.tap(verify());
        await f.settle(tester);
        expect(h.api.mutationEntered!.isCompleted, isTrue);
        await tester.drag(
          find
              .byWidgetPredicate(
                (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
              )
              .first,
          const Offset(0, 10000),
        );
        await tester.pump();
        expect(
          find.textContaining('Completing security request'),
          findsOneWidget,
        );
        expect(
          tester.getRect(find.byType(LinearProgressIndicator)).top,
          greaterThanOrEqualTo(0),
        );
        expect(tester.takeException(), isNull);
        h.api.holdMutation!.complete();
        await f.settle(tester);
        expect(h.proof?.action, 'payout.release');
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('disposed approval callback is inert', (tester) async {
    final h = await mount(tester);
    final callback = tester.widget<FilledButton>(verify()).onPressed!;
    await tester.pumpWidget(
      const MaterialApp(home: Text('Unrelated destination')),
    );
    callback();
    await f.settle(tester);
    expect(
      h.api.calls.where((c) => c.path == '/security/step-up/challenges'),
      isEmpty,
    );
    expect(h.proof, isNull);
    expect(tester.takeException(), isNull);
  });
}
