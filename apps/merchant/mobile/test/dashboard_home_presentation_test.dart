// Dashboard controller/presentation regressions. Held services are fixtures,
// not evidence of real publication, provider settlement or hosted readback.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/dashboard/home_screen.dart';
import 'package:letbuyy_store/services/analytics_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/app_badge_service.dart';
import 'package:letbuyy_store/services/home_widget_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/dashboard/hero_store_card.dart';
import 'staff_scope_boundary_test.dart' as fixture;

class HeldPublishStores extends fixture.FixedStores {
  HeldPublishStores(super.api);
  final published = <String>[];
  final acknowledgement = Completer<StoreModel>();
  final freshReads = <String>[];
  StoreModel? fresh;
  int? discoveryDenial;
  int discoveries = 0;
  @override
  Future<List<StoreModel>> fetchStores() async {
    discoveries++;
    if (discoveryDenial != null) {
      throw ApiException(
        message: 'Fixture access denied',
        statusCode: discoveryDenial!,
        code: 'FORBIDDEN',
      );
    }
    return super.fetchStores();
  }

  @override
  Future<StoreModel> fetchStoreFresh(String storeId) async {
    freshReads.add(storeId);
    return fresh!;
  }

  @override
  Future<StoreModel> publishStore(String storeId) {
    published.add(storeId);
    return acknowledgement.future;
  }
}

class DashboardReads extends AnalyticsService {
  DashboardReads(ApiClient api) : super(api: api);
  final reads = <(String, String)>[];
  final held = <(String, String), Completer<MobileDashboardSnapshot>>{};
  StoreAnalytics value = StoreAnalytics(
    totalRevenue: 1234567.89,
    totalOrders: 12345,
    totalProducts: 678,
    totalViews: 24690,
    averageOrderValue: 100.0055,
    viewsAvailable: true,
  );
  @override
  Future<MobileDashboardSnapshot> getMobileDashboardSnapshot(
    String storeId, {
    String period = '30d',
  }) async {
    reads.add((storeId, period));
    return held[(storeId, period)]?.future ?? snapshot;
  }

  MobileDashboardSnapshot get snapshot => MobileDashboardSnapshot(
    analytics: value,
    payoutSummary: {
      'next_payout': {
        'net_amount_minor': 123456789,
        'status': 'pending',
        'available_on': '2026-11-05',
      },
    },
    providerMode: 'sandbox',
  );
}

class DashboardBilling extends SubscriptionService {
  DashboardBilling(ApiClient api) : super(api: api);
  final reads = <String>[];
  final held = <String, Completer<MerchantBillingState>>{};
  @override
  Future<MerchantBillingState> fetchBillingState(String storeId) async {
    reads.add(storeId);
    final pending = held[storeId];
    if (pending != null) return pending.future;
    return MerchantBillingState.fromJson({
      'store': {'id': storeId},
    });
  }
}

class HomeFixture {
  HomeFixture() {
    api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
    service = HeldPublishStores(api);
    stores = StoreContext(storeService: service);
    analytics = DashboardReads(api);
    billing = DashboardBilling(api);
    auth = StoreAuthService(
      api: api,
      identityBaseUrl: 'https://accounts.example.invalid',
    );
  }
  late final ApiClient api;
  late final HeldPublishStores service;
  late final StoreContext stores;
  late final DashboardReads analytics;
  late final DashboardBilling billing;
  late final StoreAuthService auth;
  Future<void> mount(
    WidgetTester tester, {
    bool dark = false,
    double scale = 1,
    bool resolveSelection = true,
  }) async {
    if (resolveSelection) await stores.ensureSelectedStore();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: stores),
          ChangeNotifierProvider<StoreAuthService>.value(value: auth),
          ChangeNotifierProvider<StoreService>.value(value: service),
          ChangeNotifierProvider<AnalyticsService>.value(value: analytics),
          Provider<SubscriptionService>.value(value: billing),
          Provider<AppBadgeService>.value(value: const AppBadgeService()),
          Provider<HomeWidgetService>.value(value: const HomeWidgetService()),
        ],
        child: MaterialApp(
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(scale),
              disableAnimations: true,
            ),
            child: child!,
          ),
          home: const HomeScreen(),
          routes: {
            AppRoutes.products: (_) =>
                const Scaffold(body: Text('Existing Products destination')),
          },
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();
  }

  Future<void> dispose(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    stores.dispose();
    service.dispose();
    analytics.dispose();
    auth.dispose();
    api.close();
  }
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });
  testWidgets('publish acknowledgement cannot settle a disposed dashboard', (
    tester,
  ) async {
    final f = HomeFixture();
    try {
      await f.mount(tester);
      expect(find.byType(HeroStoreCard), findsOneWidget);
      tester
          .widget<HeroStoreCard>(find.byType(HeroStoreCard))
          .onPublishToggle();
      expect(f.service.published, [fixture.siteA]);
      await tester.pumpWidget(const SizedBox.shrink());
      f.service.acknowledgement.complete(f.stores.selectedStore!);
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(f.analytics.reads, [(fixture.siteA, '30d')]);
    } finally {
      await f.dispose(tester);
    }
  });

  testWidgets(
    'denied dashboard discovery waits for explicit recovery without a request loop',
    (tester) async {
      final f = HomeFixture();
      f.service.discoveryDenial = 403;
      try {
        await f.mount(tester, resolveSelection: false);
        await tester.pump(const Duration(seconds: 10));
        await tester.pump();
        expect(f.service.discoveries, 1);
        expect(
          find.text(
            'The active store context changed. Reload access to continue.',
          ),
          findsOneWidget,
        );
        expect(find.text('Create Your Store'), findsNothing);
        expect(find.byType(HeroStoreCard), findsNothing);
        f.service.discoveryDenial = null;
        await tester.tap(
          find.widgetWithText(OutlinedButton, 'Reload store access'),
        );
        await tester.pumpAndSettle();
        expect(f.service.discoveries, 2);
        expect(find.byType(HeroStoreCard), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );

  testWidgets(
    'confirmed publication refreshes through the existing metadata reader',
    (tester) async {
      final f = HomeFixture();
      try {
        await f.mount(tester);
        f.service.fresh = StoreModel.fromJson({
          'id': fixture.siteA,
          'name': fixture.siteA,
          'status': 'published',
          'subdomain': 'synthetic',
        });
        tester
            .widget<HeroStoreCard>(find.byType(HeroStoreCard))
            .onPublishToggle();
        expect(f.service.published, [fixture.siteA]);
        f.service.acknowledgement.complete(f.service.fresh!);
        await tester.pumpAndSettle();
        expect(f.service.freshReads, [fixture.siteA]);
        expect(
          tester
              .widget<HeroStoreCard>(find.byType(HeroStoreCard))
              .store
              .isPublished,
          isTrue,
        );
        expect(
          tester.widget<HeroStoreCard>(find.byType(HeroStoreCard)).isPublishing,
          isFalse,
        );
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );

  testWidgets('captured publish callback rejects a store switch before frame', (
    tester,
  ) async {
    final f = HomeFixture();
    try {
      await f.mount(tester);
      final publish = tester
          .widget<HeroStoreCard>(find.byType(HeroStoreCard))
          .onPublishToggle;
      await f.stores.selectStoreById(fixture.siteB);
      publish();
      expect(f.service.published, isEmpty);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
      expect(
        tester.widget<HeroStoreCard>(find.byType(HeroStoreCard)).store.id,
        fixture.siteB,
      );
    } finally {
      if (!f.service.acknowledgement.isCompleted) {
        f.service.acknowledgement.complete(f.stores.selectedStore!);
        await tester.pump();
      }
      await f.dispose(tester);
    }
  });

  testWidgets('late publication result cannot refresh the replacement store', (
    tester,
  ) async {
    final f = HomeFixture();
    try {
      await f.mount(tester);
      final storeA = f.stores.selectedStore!;
      tester
          .widget<HeroStoreCard>(find.byType(HeroStoreCard))
          .onPublishToggle();
      expect(f.service.published, [fixture.siteA]);
      await f.stores.selectStoreById(fixture.siteB);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      final before = List.of(f.analytics.reads);
      expect(before, contains((fixture.siteB, '30d')));
      f.service.acknowledgement.complete(storeA);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(f.analytics.reads, before);
      final hero = tester.widget<HeroStoreCard>(find.byType(HeroStoreCard));
      expect(hero.store.id, fixture.siteB);
      expect(hero.isPublishing, isFalse);
      expect(tester.takeException(), isNull);
    } finally {
      await f.dispose(tester);
    }
  });

  testWidgets('retired optional billing read cannot dispatch dashboard work', (
    tester,
  ) async {
    final f = HomeFixture();
    final oldBilling = Completer<MerchantBillingState>();
    f.billing.held[fixture.siteA] = oldBilling;
    try {
      await f.mount(tester);
      expect(f.billing.reads, [fixture.siteA]);
      expect(f.analytics.reads, isEmpty);
      expect(find.text('Loading dashboard'), findsOneWidget);
      expect(
        tester.binding.transientCallbackCount,
        0,
        reason: 'Reduced motion has a static, visible pending state',
      );
      await f.stores.selectStoreById(fixture.siteB);
      await tester.pump();
      await tester.pumpAndSettle();
      expect(f.analytics.reads, [(fixture.siteB, '30d')]);
      oldBilling.complete(
        MerchantBillingState.fromJson({
          'store': {'id': fixture.siteA},
        }),
      );
      await tester.pumpAndSettle();
      expect(f.analytics.reads, [(fixture.siteB, '30d')]);
      expect(
        tester.widget<HeroStoreCard>(find.byType(HeroStoreCard)).store.id,
        fixture.siteB,
      );
      expect(tester.takeException(), isNull);
    } finally {
      await f.dispose(tester);
    }
  });

  testWidgets('A to B to A does not adopt the first A dashboard response', (
    tester,
  ) async {
    final f = HomeFixture();
    final oldA = Completer<MobileDashboardSnapshot>();
    f.analytics.held[(fixture.siteA, '30d')] = oldA;
    try {
      await f.mount(tester);
      expect(f.analytics.reads, [(fixture.siteA, '30d')]);
      await f.stores.selectStoreById(fixture.siteB);
      await tester.pump();
      await tester.pumpAndSettle();
      f.analytics.held.remove((fixture.siteA, '30d'));
      f.analytics.value = StoreAnalytics(totalRevenue: 77, totalOrders: 1);
      await f.stores.selectStoreById(fixture.siteA);
      await tester.pump();
      await tester.pumpAndSettle();
      expect(f.analytics.reads, [
        (fixture.siteA, '30d'),
        (fixture.siteB, '30d'),
        (fixture.siteA, '30d'),
      ]);
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('dashboard-metric-Revenue')),
          matching: find.text('₹77.00'),
        ),
        findsOneWidget,
      );
      oldA.complete(
        MobileDashboardSnapshot(
          analytics: StoreAnalytics(totalRevenue: 9),
          payoutSummary: null,
          providerMode: null,
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('dashboard-metric-Revenue')),
          matching: find.text('₹77.00'),
        ),
        findsOneWidget,
      );
      expect(
        (await SharedPreferences.getInstance()).getDouble(
          HomeWidgetSnapshot.revenueKey,
        ),
        77,
      );
      expect(tester.takeException(), isNull);
    } finally {
      await f.dispose(tester);
    }
  });

  testWidgets(
    'reporting period is draft until Apply and old metrics retire during its read',
    (tester) async {
      final f = HomeFixture();
      try {
        await f.mount(tester);
        final picker = find.byKey(const ValueKey('dashboard-period-picker'));
        await tester.ensureVisible(picker);
        await tester.tap(picker);
        await tester.pumpAndSettle();
        await tester.tap(find.text('7 Days'));
        await tester.pump();
        expect(f.analytics.reads, [(fixture.siteA, '30d')]);
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        expect(
          find.descendant(of: picker, matching: find.text('30 Days')),
          findsOneWidget,
        );
        await tester.tap(picker);
        await tester.pumpAndSettle();
        await tester.tap(find.text('7 Days'));
        await tester.pump();
        final next = Completer<MobileDashboardSnapshot>();
        f.analytics.held[(fixture.siteA, '7d')] = next;
        await tester.tap(find.text('Apply'));
        await tester.pumpAndSettle();
        expect(f.analytics.reads, [
          (fixture.siteA, '30d'),
          (fixture.siteA, '7d'),
        ]);
        expect(find.text('Loading dashboard'), findsOneWidget);
        expect(
          find.byKey(const ValueKey('dashboard-metric-Revenue')),
          findsNothing,
        );
        next.complete(
          MobileDashboardSnapshot(
            analytics: StoreAnalytics(totalRevenue: 200),
            payoutSummary: null,
            providerMode: null,
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.descendant(of: picker, matching: find.text('7 Days')),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: find.byKey(const ValueKey('dashboard-metric-Revenue')),
            matching: find.text('₹200.00'),
          ),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );

  testWidgets('period sheet cannot apply after a store switch', (tester) async {
    final f = HomeFixture();
    try {
      await f.mount(tester);
      final picker = find.byKey(const ValueKey('dashboard-period-picker'));
      await tester.ensureVisible(picker);
      await tester.tap(picker);
      await tester.pumpAndSettle();
      await tester.tap(find.text('7 Days'));
      await tester.pump();
      await f.stores.selectStoreById(fixture.siteB);
      await tester.pump();
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Apply'))
            .onPressed,
        isNull,
      );
      expect(find.text('7 Days'), findsNothing);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(f.analytics.reads, [
        (fixture.siteA, '30d'),
        (fixture.siteB, '30d'),
      ]);
      expect(
        find.descendant(of: picker, matching: find.text('30 Days')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    } finally {
      await f.dispose(tester);
    }
  });

  for (final dark in [false, true]) {
    testWidgets(
      'full dashboard reflows exact metrics and actions at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final f = HomeFixture();
        final semantics = tester.ensureSemantics();
        try {
          await f.mount(tester, dark: dark, scale: 2.4);
          const expected = {
            'Orders': '12345',
            'Revenue': '₹12,34,567.89',
            'Visitors': '24690',
            'Products': '678',
            'Conversion rate': '50.0%',
            'Average order value': '₹100.01',
          };
          for (final entry in expected.entries) {
            final card = find.byKey(ValueKey('dashboard-metric-${entry.key}'));
            final value = find.descendant(
              of: card,
              matching: find.text(entry.value),
            );
            expect(value, findsOneWidget);
            await tester.ensureVisible(value);
            await tester.pump();
            expect(tester.getRect(value).left, greaterThanOrEqualTo(0));
            expect(tester.getRect(value).right, lessThanOrEqualTo(320));
            expect(tester.takeException(), isNull, reason: entry.key);
          }
          final payout = find.bySemanticsLabel(RegExp(r'^Next payout'));
          await tester.ensureVisible(payout);
          await tester.pump();
          expect(
            tester.getSemantics(payout).getSemanticsData().label,
            contains('₹12,34,567.89'),
          );
          expect(find.text('Reporting period: 30 Days'), findsNWidgets(2));
          final products = find.bySemanticsLabel('Manage Products');
          await tester.ensureVisible(products);
          await tester.pump();
          expect(products.hitTestable(), findsOneWidget);
          expect(tester.getSize(products).height, greaterThanOrEqualTo(48));
          expect(tester.binding.transientCallbackCount, 0);
          await tester.tap(products);
          await tester.pumpAndSettle();
          expect(find.text('Existing Products destination'), findsOneWidget);
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
          await f.dispose(tester);
        }
      },
    );
  }
}
