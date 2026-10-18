// UI state/ownership-generation tests. Actual normal Android journey is recorded separately.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/settings/loyalty_screen.dart';
import 'package:letbuyy_store/services/loyalty_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

import 'support/loyalty_fixture.dart';

import 'package:letbuyy_store/services/api_client.dart';

class Harness {
  String actor = 'actor-a';
  final storage = MemoryStorage();
  late final LoyaltyTransport api;
  late final StoreContext stores;
  late final LoyaltyService service;
  Future<void> init() async {
    api = LoyaltyTransport(context: () => stores.requestContextKey);
    stores = StoreContext(storeService: StoreService(api: api));
    await stores.bindActor(actor);
    await stores.ensureSelectedStore();
    service = LoyaltyService(
      api: api,
      actorIdProvider: () => actor,
      storeIdProvider: () => stores.selectedStoreId,
      storage: storage,
    );
  }

  Widget app({Brightness brightness = Brightness.light}) => MultiProvider(
    providers: [
      ChangeNotifierProvider<StoreContext>.value(value: stores),
      Provider<LoyaltyService>.value(value: service),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: brightness),
      home: const LoyaltyScreen(),
    ),
  );
}

Future<void> loaded(WidgetTester t) async {
  for (var i = 0; i < 8; i++) {
    await t.pump(const Duration(milliseconds: 60));
  }
}

Future<void> press(WidgetTester t, String label) async {
  await t.pump();
  final f = find.text(label);
  await t.ensureVisible(f);
  await t.pump();
  await t.tap(f);
  await loaded(t);
}

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<Harness> harness(WidgetTester t) async {
    t.view.physicalSize = const Size(440, 1100);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final h = Harness();
    await h.init();
    addTearDown(h.api.close);
    return h;
  }

  testWidgets(
    'loading is visible and a failed read remains an error until retry succeeds',
    (t) async {
      final h = await harness(t);
      h.api.holdRead = Completer<void>();
      h.api.readFailure = unavailable;
      await t.pumpWidget(h.app());
      await t.pump();
      await loaded(t);
      expect(find.bySemanticsLabel('Loading loyalty settings'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      h.api.holdRead!.complete();
      await loaded(t);
      expect(find.text('Synthetic service unavailable'), findsOneWidget);
      expect(find.text('Loyalty is not set up'), findsNothing);
      h.api.holdRead = null;
      h.api.readFailure = null;
      await press(t, 'Retry loading loyalty');
      expect(find.text('Programme active'), findsOneWidget);
    },
  );
  for (final brightness in Brightness.values) {
    testWidgets(
      'precise form, decrease policy and paused state render in $brightness',
      (t) async {
        final h = await harness(t);
        h.api.snapshots[siteA] = snapshot(
          siteA,
          active: false,
          points: '9007199254740993',
        );
        await t.pumpWidget(h.app(brightness: brightness));
        await loaded(t);
        expect(find.text('Programme paused'), findsOneWidget);
        final earn = t.widget<TextField>(
          find.byKey(const ValueKey('loyalty-earn')),
        );
        expect(earn.controller!.text, '12.34');
        expect(
          find.text('Current reward value: ₹9,00,71,99,25,47,40,993.00'),
          findsOneWidget,
        );
        final value = find.byKey(const ValueKey('loyalty-value'));
        await t.ensureVisible(value);
        await t.enterText(value, '50');
        await t.pump();
        expect(
          find.text('Point value cannot decrease while customers hold points.'),
          findsOneWidget,
        );
        expect(
          t
              .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'Save loyalty'),
              )
              .onPressed,
          isNull,
        );
        await t.enterText(value, '150');
        await t.pump();
        expect(
          t
              .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'Save loyalty'),
              )
              .onPressed,
          isNotNull,
        );
      },
    );
  }
  testWidgets(
    'not-enrolled settings require explicit save and double taps dispatch once',
    (t) async {
      final h = await harness(t);
      h.api.snapshots[siteA] = snapshot(
        siteA,
        enrolled: false,
        points: '0',
        decrease: true,
      );
      h.api.holdSave = Completer<void>();
      await t.pumpWidget(h.app());
      await loaded(t);
      expect(find.text('Loyalty is not set up'), findsOneWidget);
      expect(h.api.writes, isEmpty);
      await press(t, 'Save loyalty');
      expect(h.api.writes, hasLength(1));
      expect(find.text('Saving loyalty…'), findsOneWidget);
      final value = t.widget<TextField>(
        find.byKey(const ValueKey('loyalty-value')),
      );
      expect(value.enabled, false);
      await t.tap(find.text('Saving loyalty…'));
      await t.pump();
      expect(h.api.writes, hasLength(1));
      h.api.holdSave!.complete();
      await loaded(t);
      expect(find.text('Loyalty settings saved.'), findsOneWidget);
      expect(h.storage.data, isEmpty);
    },
  );
  testWidgets(
    'app remount exposes the same uncertain save and retries its original intent',
    (t) async {
      final h = await harness(t);
      h.api.writeFailure = unavailable;
      await t.pumpWidget(h.app());
      await loaded(t);
      final value = find.byKey(const ValueKey('loyalty-value'));
      await t.ensureVisible(value);
      await t.enterText(value, '150');
      await press(t, 'Save loyalty');
      expect(find.text('Retry same save'), findsOneWidget);
      final first = h.api.writes.single;
      await t.pumpWidget(const SizedBox());
      await t.pumpWidget(h.app());
      await loaded(t);
      expect(find.text('A previous save needs confirmation'), findsOneWidget);
      h.api.writeFailure = null;
      await press(t, 'Retry same save');
      expect(h.api.writes.last.idempotencyKey, first.idempotencyKey);
      expect(h.api.writes.last.body, first.body);
      expect(h.storage.data, isEmpty);
    },
  );
  testWidgets(
    'a real refusal clears retry controls and requires reload before a revised save',
    (t) async {
      final h = await harness(t);
      h.api.writeFailure = const ApiException(
        message: 'Synthetic stale version',
        statusCode: 409,
        code: 'VERSION_CONFLICT',
      );
      await t.pumpWidget(h.app());
      await loaded(t);
      final value = find.byKey(const ValueKey('loyalty-value'));
      await t.ensureVisible(value);
      await t.enterText(value, '150');
      await press(t, 'Save loyalty');
      expect(find.text('Synthetic stale version'), findsOneWidget);
      expect(
        t
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Save loyalty'),
            )
            .onPressed,
        isNull,
      );
      expect(h.storage.data, isEmpty);
      h.api.writeFailure = null;
      await press(t, 'Reload current saved settings');
      expect(t.widget<TextField>(value).controller!.text, '100');
    },
  );
  testWidgets(
    'late prior-store reads are discarded and old fields disappear on selection change',
    (t) async {
      final h = await harness(t);
      h.api.holdRead = Completer<void>();
      h.api.readEntered = Completer<void>();
      await t.pumpWidget(h.app());
      await loaded(t);
      await h.api.readEntered!.future;
      final delayed = h.api.holdRead!;
      h.api.holdRead = null;
      h.api.readEntered = null;
      await h.stores.selectStoreById(siteB);
      await t.pump();
      expect(find.text('Outstanding points: 41'), findsNothing);
      delayed.complete();
      await loaded(t);
      expect(find.text('Outstanding points: 0'), findsOneWidget);
      expect(find.text('Outstanding points: 41'), findsNothing);
      expect(
        t
            .widget<TextField>(find.byKey(const ValueKey('loyalty-value')))
            .controller!
            .text,
        '200',
      );
    },
  );
  testWidgets(
    'late prior-account save cannot display success or release its pending command into the new account',
    (t) async {
      final h = await harness(t);
      h.api.holdSave = Completer<void>();
      await t.pumpWidget(h.app());
      await loaded(t);
      final value = find.byKey(const ValueKey('loyalty-value'));
      await t.ensureVisible(value);
      await t.enterText(value, '150');
      await press(t, 'Save loyalty');
      expect(h.api.writes, hasLength(1));
      h.actor = 'actor-b';
      await h.stores.bindActor(h.actor);
      await h.stores.ensureSelectedStore();
      await h.stores.selectStoreById(siteB);
      final delayed = h.api.holdSave!;
      h.api.holdSave = null;
      delayed.complete();
      await loaded(t);
      expect(find.text('Loyalty settings saved.'), findsNothing);
      expect(find.text('Retry same save'), findsNothing);
      expect(h.storage.data.keys.single, contains('actor-a:$siteA'));
      expect(t.widget<TextField>(value).controller!.text, '200');
    },
  );
  testWidgets(
    'disposing a route during a save produces no late widget update',
    (t) async {
      final h = await harness(t);
      h.api.holdSave = Completer<void>();
      await t.pumpWidget(h.app());
      await loaded(t);
      final value = find.byKey(const ValueKey('loyalty-value'));
      await t.ensureVisible(value);
      await t.enterText(value, '150');
      await press(t, 'Save loyalty');
      await t.pumpWidget(const SizedBox());
      h.api.holdSave!.complete();
      await loaded(t);
      expect(t.takeException(), isNull);
    },
  );
}
