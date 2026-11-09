// Composed presentation fixtures; no publication, clipboard or native share effect.
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/subscription_catalog.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/dashboard/hero_store_card.dart';
import 'staff_scope_boundary_test.dart' as fixture;

StoreModel heroStore() => StoreModel.fromJson({
  'id': fixture.siteA,
  'name': 'A long merchant store name that must remain readable',
  'subdomain': 'synthetic',
  'status': 'draft',
});

Future<void> mountHero(
  WidgetTester tester,
  StoreContext stores, {
  MerchantBillingState? billing,
  double scale = 1,
  bool pauseParent = false,
}) => tester.pumpWidget(
  ChangeNotifierProvider<StoreContext>.value(
    value: stores,
    child: MaterialApp(
      theme: StoreTheme.dark(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          disableAnimations: true,
          textScaler: TextScaler.linear(scale),
        ),
        child: child!,
      ),
      home: Scaffold(
        body: SingleChildScrollView(
          child: TickerMode(
            enabled: !pauseParent,
            child: HeroStoreCard(
              store: heroStore(),
              storefrontUrl: 'https://shop.example.invalid/long-store-address',
              billing: billing,
              onPublishToggle: () {},
            ),
          ),
        ),
      ),
    ),
  ),
);

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'a clipboard acknowledgement after the hero is disposed cannot reopen feedback',
    (tester) async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      final acknowledgement = Completer<void>();
      var calls = 0;
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') {
          calls++;
          await acknowledgement.future;
        }
        return null;
      });
      await stores.ensureSelectedStore();
      try {
        await mountHero(tester, stores);
        final copy = find.text('shop.example.invalid/long-store-address');
        await tester.ensureVisible(copy);
        await tester.tap(copy);
        await tester.pump();
        expect(calls, 1);
        await tester.pumpWidget(const SizedBox.shrink());
        acknowledgement.complete();
        await tester.pumpAndSettle();
        expect(find.text('URL copied!'), findsNothing);
        expect(tester.takeException(), isNull);
      } finally {
        if (!acknowledgement.isCompleted) acknowledgement.complete();
        messenger.setMockMethodCallHandler(SystemChannels.platform, null);
        await tester.pumpWidget(const SizedBox.shrink());
        stores.dispose();
        api.close();
      }
    },
  );
  testWidgets('an open QR view retires after the selected store changes', (
    tester,
  ) async {
    final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
    final stores = StoreContext(storeService: fixture.FixedStores(api));
    await stores.ensureSelectedStore();
    try {
      await mountHero(tester, stores);
      await tester.ensureVisible(find.byTooltip('Store QR code'));
      await tester.tap(find.byTooltip('Store QR code'));
      await tester.pumpAndSettle();
      expect(find.text('Share QR'), findsOneWidget);
      await stores.selectStoreById(fixture.siteB);
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.text('Share QR'), findsNothing);
      expect(find.text(heroStore().name), findsNothing);
      expect(tester.takeException(), isNull);
    } finally {
      await tester.pumpWidget(const SizedBox.shrink());
      stores.dispose();
      api.close();
    }
  });

  testWidgets(
    'QR export creates real PNG bytes and preserves the existing native share payload',
    (tester) async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      final directory = Directory.systemTemp.createTempSync('letbuyy-qr-ui-');
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      const pathChannel = MethodChannel('plugins.flutter.io/path_provider');
      const shareChannel = MethodChannel('dev.fluttercommunity.plus/share');
      final arrival = Completer<void>(), acknowledgement = Completer<String>();
      final payloads = <Map<String, dynamic>>[];
      messenger.setMockMethodCallHandler(pathChannel, (call) async {
        expect(call.method, 'getTemporaryDirectory');
        return directory.path;
      });
      messenger.setMockMethodCallHandler(shareChannel, (call) async {
        expect(call.method, 'share');
        payloads.add(Map<String, dynamic>.from(call.arguments as Map));
        arrival.complete();
        return acknowledgement.future;
      });
      await stores.ensureSelectedStore();
      try {
        await mountHero(tester, stores);
        await tester.ensureVisible(find.byTooltip('Store QR code'));
        await tester.tap(find.byTooltip('Store QR code'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Share QR'));
        await tester.tap(find.text('Share QR'));
        await tester.pump();
        final budget = Stopwatch()..start();
        while (!arrival.isCompleted &&
            budget.elapsed < const Duration(seconds: 5)) {
          await tester.pump(const Duration(milliseconds: 16));
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 10)),
          );
        }
        expect(
          arrival.isCompleted,
          isTrue,
          reason:
              'Actual PNG encoding, file write and native handoff must settle within the finite host/frame budget. Visible error: ${find.textContaining('The share result could not be confirmed.').evaluate().isNotEmpty}',
        );
        expect(payloads, hasLength(1));
        final payload = payloads.single;
        expect(
          payload['text'],
          '🏪 Scan to visit ${heroStore().name}!\nhttps://shop.example.invalid/long-store-address',
        );
        expect(payload['subject'], '${heroStore().name} - QR Code');
        expect(payload['mimeTypes'], ['image/png']);
        expect(payload['paths'], ['${directory.path}/synthetic_qr.png']);
        final bytes = File(
          '${directory.path}/synthetic_qr.png',
        ).readAsBytesSync();
        expect(bytes.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);
        expect(bytes.length, greaterThan(1000));
        expect(
          tester
              .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'Sharing…'),
              )
              .onPressed,
          isNull,
        );
        await Navigator.maybePop(tester.element(find.byType(LetbuyyFormSheet)));
        await tester.pump();
        expect(find.text('Sharing…'), findsOneWidget);
        acknowledgement.complete(
          '',
        ); // Native sheet dismissed; no delivery claim.
        await tester.pumpAndSettle();
        expect(find.text('Share QR'), findsOneWidget);
        expect(find.textContaining('successfully'), findsNothing);
        expect(tester.takeException(), isNull);
      } finally {
        if (!acknowledgement.isCompleted) acknowledgement.complete('');
        await tester.pumpWidget(const SizedBox.shrink());
        messenger.setMockMethodCallHandler(pathChannel, null);
        messenger.setMockMethodCallHandler(shareChannel, null);
        stores.dispose();
        api.close();
        directory.deleteSync(recursive: true);
      }
    },
  );
  for (final unlimited in [false, true]) {
    testWidgets(
      'hero has no fabricated meter for ${unlimited ? 'unlimited' : 'unavailable'} billing',
      (tester) async {
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          maxRetries: 0,
        );
        final stores = StoreContext(storeService: fixture.FixedStores(api));
        await stores.ensureSelectedStore();
        final billing = unlimited
            ? MerchantBillingState.fromJson({
                'store': {'id': fixture.siteA},
                'product_usage': {
                  'count': 3,
                  'limit_known': true,
                  'limit': null,
                },
              })
            : null;
        try {
          await mountHero(tester, stores, billing: billing);
          await tester.pump(const Duration(milliseconds: 500));
          expect(find.byType(LinearProgressIndicator), findsNothing);
          expect(
            find.text(
              unlimited
                  ? '3 products (Unlimited)'
                  : 'Product usage unavailable',
            ),
            findsOneWidget,
          );
          expect(tester.takeException(), isNull);
        } finally {
          await tester.pumpWidget(const SizedBox.shrink());
          stores.dispose();
          api.close();
        }
      },
    );
  }
  testWidgets('hero has a static reduced-motion composition', (tester) async {
    final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
    final stores = StoreContext(storeService: fixture.FixedStores(api));
    await stores.ensureSelectedStore();
    try {
      await mountHero(tester, stores);
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.binding.transientCallbackCount, 0);
      expect(find.byType(BackdropFilter), findsNothing);
      expect(tester.takeException(), isNull);
    } finally {
      await tester.pumpWidget(const SizedBox.shrink());
      stores.dispose();
      api.close();
    }
  });
  testWidgets(
    'store QR sheet keeps long identity and native share action reachable at scale2.4',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final semantics = tester.ensureSemantics();
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      await stores.ensureSelectedStore();
      try {
        await mountHero(tester, stores, scale: 2.4, pauseParent: true);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.byTooltip('Store QR code'));
        await tester.pumpAndSettle();
        final action = find.byTooltip('Store QR code');
        final data = tester.getSemantics(action).getSemanticsData();
        expect(data.tooltip, 'Store QR code');
        await tester.tap(action);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Share QR'));
        await tester.pumpAndSettle();
        expect(find.text('Share QR').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        stores.dispose();
        api.close();
        semantics.dispose();
      }
    },
  );
}
