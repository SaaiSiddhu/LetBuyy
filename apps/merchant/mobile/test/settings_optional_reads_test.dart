// Real Settings/StoreContext owners; optional service reads are controlled here.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show PaymentConfigModel;
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/screens/settings/settings_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/settings/store_info_card.dart';
import 'package:letbuyy_store/widgets/settings/settings_tile.dart';
import 'package:letbuyy_store/widgets/store/store_switcher_button.dart';
import 'store_switcher_presentation_test.dart' as fixture;

MerchantBillingState billing(String id, {String? name}) =>
    MerchantBillingState.fromJson({
      'store': {'id': id},
      'subscription': {
        'id': 'synthetic-subscription-$id',
        'plan': 'launch',
        'plan_name': name ?? 'Synthetic plan $id',
        'status': 'active',
      },
      'product_usage': {'count': 3, 'limit_known': true, 'limit': 10},
    });

class Reads extends SubscriptionService {
  Reads(ApiClient api) : super(api: api);
  final billingCalls = <String>[], paymentCalls = <String>[];
  final billingErrors = <String, Object>{}, paymentErrors = <String, Object>{};
  final billingHeld = <String, Completer<MerchantBillingState>>{};
  final paymentHeld = <String, Completer<PaymentConfigModel>>{};
  @override
  Future<MerchantBillingState> fetchBillingState(String id) async {
    billingCalls.add(id);
    if (billingHeld[id] case final Completer<MerchantBillingState> held)
      return held.future;
    if (billingErrors[id] case final Object error) throw error;
    return billing(id);
  }

  @override
  Future<PaymentConfigModel> getPaymentConfigModel(String id) async {
    paymentCalls.add(id);
    if (paymentHeld[id] case final Completer<PaymentConfigModel> held)
      return held.future;
    if (paymentErrors[id] case final Object error) throw error;
    return PaymentConfigModel(storeId: id, codEnabled: id == fixture.a);
  }
}

Future<(fixture.Harness, Reads)> mount(
  WidgetTester tester, {
  int? denial,
  bool holdBilling = false,
  bool holdPayment = false,
}) async {
  final h = fixture.Harness();
  await h.mount(tester);
  final reads = Reads(h.api);
  if (denial != null) {
    reads.billingErrors[fixture.a] = ApiException(
      message: 'Private billing diagnostic',
      statusCode: denial == 404 ? 403 : denial,
      code: 'SYNTHETIC_OPTIONAL_UNAVAILABLE',
    );
    reads.paymentErrors[fixture.a] = Exception(
      'Private payment diagnostic $denial',
    );
  }
  if (holdBilling)
    reads.billingHeld[fixture.a] = Completer<MerchantBillingState>();
  if (holdPayment)
    reads.paymentHeld[fixture.a] = Completer<PaymentConfigModel>();
  await showSettings(tester, h, reads);
  return (h, reads);
}

Future<void> showSettings(
  WidgetTester tester,
  fixture.Harness h,
  Reads reads, {
  StoreContext? owner,
}) async {
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: owner ?? h.stores),
        ChangeNotifierProvider<StoreService>.value(value: h.service),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        Provider<SubscriptionService>.value(value: reads),
      ],
      child: MaterialApp(
        theme: StoreTheme.light(),
        home: const SettingsScreen(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final denial in [403, 404, 503]) {
    testWidgets(
      'optional payment failure $denial preserves current settings and store switching',
      (tester) async {
        final (h, reads) = await mount(tester, denial: denial);
        await tester.pumpAndSettle();
        expect(find.byType(StoreSwitcherButton), findsOneWidget);
        expect(find.byType(StoreInfoCard), findsOneWidget);
        expect(find.textContaining('Private payment'), findsNothing);
        expect(
          find.text('Store details could not load. Try again.'),
          findsNothing,
        );
        await h.open(tester);
        await tester.tap(fixture.choice(fixture.beta));
        await tester.pumpAndSettle();
        expect(h.stores.selectedStoreId, fixture.b);
        expect(
          tester.widget<StoreInfoCard>(find.byType(StoreInfoCard)).storeName,
          fixture.beta,
        );
        expect(reads.paymentCalls, containsAll([fixture.a, fixture.b]));
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'held billing does not delay the primary page or independent payment read',
    (tester) async {
      final (_, reads) = await mount(tester, holdBilling: true);
      try {
        expect(find.byType(StoreSwitcherButton), findsOneWidget);
        expect(find.byType(StoreInfoCard), findsOneWidget);
        expect(reads.paymentCalls, [fixture.a]);
      } finally {
        reads.billingHeld[fixture.a]!.complete(billing(fixture.a));
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets('held payment does not delay the primary settings page', (
    tester,
  ) async {
    final (_, reads) = await mount(tester, holdPayment: true);
    try {
      expect(find.byType(StoreSwitcherButton), findsOneWidget);
      expect(find.byType(StoreInfoCard), findsOneWidget);
      expect(reads.billingCalls, [fixture.a]);
    } finally {
      reads.paymentHeld[fixture.a]!.complete(
        const PaymentConfigModel(storeId: fixture.a),
      );
      await tester.pumpAndSettle();
    }
  });
  testWidgets(
    'late old-store optional results cannot replace the new selected store',
    (tester) async {
      final (h, reads) = await mount(tester, holdPayment: true);
      final old = reads.paymentHeld.remove(fixture.a)!;
      await h.stores.selectStoreById(fixture.b);
      await tester.pumpAndSettle();
      expect(
        tester.widget<StoreInfoCard>(find.byType(StoreInfoCard)).storeName,
        fixture.beta,
      );
      old.complete(
        const PaymentConfigModel(storeId: fixture.a, codEnabled: true),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Cash on Delivery (COD)'), 300);
      final tile = find.ancestor(
        of: find.text('Cash on Delivery (COD)'),
        matching: find.byType(SettingsTile),
      );
      expect(
        tester
            .widget<Switch>(
              find.descendant(of: tile, matching: find.byType(Switch)),
            )
            .value,
        isFalse,
      );
      expect(h.stores.selectedStoreId, fixture.b);
    },
  );
  testWidgets('a retired old-store 401 cannot clear the new store', (
    tester,
  ) async {
    final (h, reads) = await mount(tester, holdPayment: true);
    final old = reads.paymentHeld.remove(fixture.a)!;
    await h.stores.selectStoreById(fixture.b);
    await tester.pumpAndSettle();
    old.completeError(
      const ApiException(
        message: 'Private retired auth error',
        statusCode: 401,
        code: 'UNAUTHORIZED',
      ),
    );
    await tester.pumpAndSettle();
    expect(h.stores.selectedStoreId, fixture.b);
    expect(
      tester.widget<StoreInfoCard>(find.byType(StoreInfoCard)).storeName,
      fixture.beta,
    );
    expect(find.text('Sign in again to load these settings.'), findsNothing);
  });
  testWidgets('equal-key provider replacement retires old optional results', (
    tester,
  ) async {
    final (h, reads) = await mount(tester, holdPayment: true);
    final old = reads.paymentHeld.remove(fixture.a)!;
    final replacement = StoreContext(
      storeService: h.service,
      prefs: h.prefs,
      environment: 'local',
    );
    addTearDown(replacement.dispose);
    await replacement.bindActor('synthetic-owner-a');
    await replacement.ensureSelectedStore();
    expect(replacement.requestContextKey, h.stores.requestContextKey);
    await showSettings(tester, h, reads, owner: replacement);
    await tester.pumpAndSettle();
    old.completeError(
      const ApiException(
        message: 'Private old-provider failure',
        statusCode: 401,
        code: 'UNAUTHORIZED',
      ),
    );
    await tester.pumpAndSettle();
    expect(replacement.selectedStoreId, fixture.a);
    expect(reads.paymentCalls.where((id) => id == fixture.a).length, 2);
    expect(find.byType(StoreInfoCard), findsOneWidget);
  });
  testWidgets(
    'provider replacement during primary discovery recovers without a stuck spinner',
    (tester) async {
      final (h, reads) = await mount(tester);
      await tester.pumpAndSettle();
      await h.stores.clearSelection();
      h.service.hold = Completer<void>();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      final held = h.service.hold!;
      h.service.hold = null;
      final replacement = StoreContext(
        storeService: h.service,
        prefs: fixture.Preferences(),
        environment: 'local',
      );
      addTearDown(replacement.dispose);
      await replacement.bindActor('synthetic-owner-a');
      await replacement.ensureSelectedStore();
      await showSettings(tester, h, reads, owner: replacement);
      held.complete();
      await tester.pumpAndSettle();
      expect(find.byType(StoreInfoCard), findsOneWidget);
      expect(find.byType(StoreSwitcherButton), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'primary store outage keeps an explicit current switcher and retry without a read loop',
    (tester) async {
      final (h, reads) = await mount(tester);
      await tester.pumpAndSettle();
      await h.stores.clearSelection();
      h.service.failure = const ApiException(
        message: 'Private store diagnostic',
        statusCode: 503,
        code: 'UNAVAILABLE',
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Store details could not load. Try again.'),
        findsOneWidget,
      );
      expect(find.byType(StoreSwitcherButton), findsOneWidget);
      final attempts = h.service.reads;
      await tester.pump(const Duration(seconds: 10));
      expect(h.service.reads, attempts);
      h.service.failure = null;
      await tester.tap(find.text('Retry store details'));
      await tester.pumpAndSettle();
      expect(find.byType(StoreInfoCard), findsOneWidget);
      expect(reads.paymentCalls, isNotEmpty);
    },
  );
  testWidgets(
    'current optional 401 retires private settings and does not auto-retry forever',
    (tester) async {
      final (h, reads) = await mount(tester, denial: 401);
      await tester.pumpAndSettle();
      expect(
        find.text('Sign in again to load these settings.'),
        findsOneWidget,
      );
      expect(find.byType(StoreInfoCard), findsNothing);
      expect(h.stores.selectedStoreId, isNull);
      final calls = reads.paymentCalls.length + reads.billingCalls.length;
      await tester.pump(const Duration(seconds: 10));
      expect(reads.paymentCalls.length + reads.billingCalls.length, calls);
    },
  );
}
