import 'package:letbuyy_store/screens/settings/settings_screen.dart';
import 'dart:io';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/l10n/app_localizations.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_models/merchant_contracts.dart'
    hide JsonMap, StoreModel;
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/services/analytics_service.dart';
import 'package:letbuyy_store/services/ai_studio_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/app_marketplace_service.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/crash_reporting_service.dart';
import 'package:letbuyy_store/services/cms_service.dart';
import 'package:letbuyy_store/services/coupon_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/custom_domains.dart';
import 'package:letbuyy_store/services/form_submission_service.dart';
import 'package:letbuyy_store/services/app_badge_service.dart';
import 'package:letbuyy_store/services/home_widget_service.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'package:letbuyy_store/services/language_service.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/services/marketing_service.dart';
import 'package:letbuyy_store/services/money_service.dart';
import 'package:letbuyy_store/services/metafield_service.dart';
import 'package:letbuyy_store/services/notification_settings_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/platform_blocked_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/push_service.dart';
import 'package:letbuyy_store/services/return_service.dart';
import 'package:letbuyy_store/services/review_service.dart';
import 'package:letbuyy_store/services/shipping_tax_service.dart';
import 'package:letbuyy_store/services/skip_needs_backend_exception.dart';
import 'package:letbuyy_store/services/staff_service.dart';
import 'package:letbuyy_store/services/storage_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/subscription_service.dart';
import 'package:letbuyy_store/services/telemetry_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/services/theme_service.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/whatsapp_service.dart';
import 'package:letbuyy_store/screens/content/blog_screen.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'package:letbuyy_store/screens/content/navigation_screen.dart';
import 'package:letbuyy_store/screens/content/page_editor_screen.dart';
import 'package:letbuyy_store/screens/content/pages_screen.dart';
import 'package:letbuyy_store/screens/content/post_editor_screen.dart';
import 'package:letbuyy_store/screens/customize/theme_versions_screen.dart';
import 'package:letbuyy_store/screens/customers/customer_detail_screen.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupon_form_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupons_screen.dart';
import 'package:letbuyy_store/screens/discounts/gift_cards_screen.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/screens/marketing/leads_screen.dart';
import 'package:letbuyy_store/screens/marketing/reviews_screen.dart';
import 'package:letbuyy_store/screens/main/store_main_screen.dart';
import 'package:letbuyy_store/screens/orders/order_detail_screen.dart';
import 'package:letbuyy_store/screens/orders/orders_screen.dart';
import 'package:letbuyy_store/screens/dashboard/home_screen.dart';
import 'package:letbuyy_store/screens/wizard/create_store_wizard.dart';
import 'package:letbuyy_store/screens/orders/returns_screen.dart';
import 'package:letbuyy_store/screens/products/collections_screen.dart';
import 'package:letbuyy_store/screens/products/import_products_screen.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/screens/ai/ai_screen.dart';
import 'package:letbuyy_store/screens/apps/apps_screen.dart';
import 'package:letbuyy_store/screens/settings/notifications_screen.dart';
import 'package:letbuyy_store/screens/settings/billing_screen.dart';
import 'package:letbuyy_store/screens/settings/domain_settings_screen.dart';
import 'package:letbuyy_store/screens/settings/seo_settings_screen.dart';
import 'package:letbuyy_store/screens/settings/shipping_screen.dart';
import 'package:letbuyy_store/screens/settings/staff_screen.dart';
import 'package:letbuyy_store/screens/settings/store_details_screen.dart';
import 'package:letbuyy_store/screens/settings/taxes_screen.dart';
import 'package:letbuyy_store/screens/subscription/pricing_screen.dart';
import 'package:letbuyy_store/screens/settings/localization_markets_screen.dart';
import 'package:letbuyy_store/screens/settings/custom_data_screen.dart';
import 'package:letbuyy_store/screens/store_health/store_health_screen.dart';
import 'package:letbuyy_store/screens/auth/turnstile_challenge_screen.dart';
import 'package:letbuyy_store/widgets/shared/capability_gate.dart';
import 'package:letbuyy_store/widgets/shared/accessible_tap_region.dart';
import 'package:letbuyy_store/widgets/wizard/wizard_container.dart'
    show WizardContainer, WizardOptionCard;
import 'package:letbuyy_store/widgets/dashboard/quick_actions_grid.dart'
    as dashboard_widgets;
import 'package:letbuyy_store/widgets/dashboard/premium_header.dart'
    as header_widgets;
import 'package:letbuyy_store/widgets/settings/store_info_card.dart';
import 'package:letbuyy_store/widgets/settings/settings_tile.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('mobile gateway services', () {
    test(
      'CrashReportingService records sanitized framework errors locally',
      () async {
        final sink = MemoryCrashReportingSink();
        final service = CrashReportingService(
          sink: sink,
          environment: 'development',
          release: 'test-release',
          storeIdProvider: () => 'store_1',
          userIdProvider: () => 'user_1',
          clock: () => DateTime.utc(2026, 6, 8, 13),
        );

        await service.recordError(
          StateError('SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN token=abc123 failed'),
          StackTrace.fromString('password=secret\nline two'),
          fatal: true,
          metadata: {'screen': 'orders', 'authorization': 'Bearer secret'},
        );

        final reports = await service.pendingReports();
        expect(reports, hasLength(1));
        final report = reports.single;
        expect(report.environment, 'development');
        expect(report.release, 'test-release');
        expect(report.storeId, 'store_1');
        expect(report.userId, 'user_1');
        expect(report.fatal, isTrue);
        expect(report.message, isNot(contains('SKIP_NEEDS_HUMAN')));
        expect(report.message, isNot(contains('abc123')));
        expect(report.stackTrace, isNot(contains('secret')));
        expect(report.metadata['screen'], 'orders');
        expect(report.metadata.containsKey('authorization'), isFalse);
      },
    );

    test(
      'SentryCrashReportingSink posts sanitized reports to DSN endpoint',
      () async {
        http.Request? captured;
        final sink = SentryCrashReportingSink.fromDsn(
          'https://publicKey@errors.example.com/42',
          client: MockClient((request) async {
            captured = request;
            return http.Response('', 200);
          }),
        );

        await sink.record(
          CrashReport(
            id: 'crash-123',
            occurredAt: DateTime.utc(2026, 6, 8, 13),
            errorType: 'StateError',
            message: 'bad token=value',
            stackTrace: 'authorization=secret',
            environment: 'staging',
            release: 'test-release',
            storeId: 'store_1',
            userId: 'user_1',
            metadata: {'cookie': 'private', 'route': '/orders'},
          ),
        );

        expect(
          captured?.url.toString(),
          'https://errors.example.com/api/42/store/',
        );
        expect(
          captured?.headers['X-Sentry-Auth'],
          contains('sentry_key=publicKey'),
        );
        final body = jsonDecode(captured!.body) as Map<String, dynamic>;
        expect(body['environment'], 'staging');
        expect(body['message'], isNot(contains('token=value')));
        final extra = body['extra'] as Map<String, dynamic>;
        expect(extra['route'], '/orders');
        expect(extra.containsKey('cookie'), isFalse);
        expect(extra['stack_trace'], isNot(contains('secret')));
      },
    );

    testWidgets(
      'AccessibleTapRegion exposes button semantics and mobile tap target',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          var taps = 0;

          await tester.pumpWidget(
            MaterialApp(
              home: Scaffold(
                body: Center(
                  child: AccessibleTapRegion(
                    label: 'Open orders',
                    hint: 'Shows order list',
                    onTap: () => taps += 1,
                    excludeChildSemantics: true,
                    child: const SizedBox(width: 1, height: 1),
                  ),
                ),
              ),
            ),
          );

          final finder = find.bySemanticsLabel('Open orders');
          expect(finder, findsOneWidget);
          final node = tester.getSemantics(finder);
          expect(
            node,
            matchesSemantics(
              label: 'Open orders',
              hint: 'Shows order list',
              isButton: true,
              hasEnabledState: true,
              isEnabled: true,
              hasTapAction: true,
            ),
          );
          final size = tester.getSize(finder);
          expect(size.width, greaterThanOrEqualTo(48));
          expect(size.height, greaterThanOrEqualTo(48));

          tester.binding.pipelineOwner.semanticsOwner!.performAction(
            node.id,
            SemanticsAction.tap,
          );
          expect(taps, 1);
        } finally {
          semantics.dispose();
        }
      },
    );

    testWidgets('core custom tap controls expose actionable semantics', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      try {
        var quickActionTaps = 0;
        var settingsTaps = 0;

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Column(
                children: [
                  dashboard_widgets.QuickActionPill(
                    icon: Icons.add_rounded,
                    label: 'Add product',
                    color: Colors.blue,
                    onTap: () => quickActionTaps += 1,
                  ),
                  SettingsTile(
                    icon: Icons.storefront_outlined,
                    title: 'Store profile',
                    subtitle: 'Complete',
                    onTap: () => settingsTaps += 1,
                  ),
                ],
              ),
            ),
          ),
        );

        expect(
          tester.getSemantics(find.bySemanticsLabel('Add product')),
          matchesSemantics(
            label: 'Add product',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
          ),
        );
        expect(
          tester.getSemantics(find.bySemanticsLabel('Store profile, Complete')),
          matchesSemantics(
            label: 'Store profile, Complete',
            hint: 'Open Store profile',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
          ),
        );

        final addProductLabel = find.text('Add product');
        final addProductInkWell = find.ancestor(
          of: addProductLabel,
          matching: find.byType(InkWell),
        );
        final addProductFocus = find.descendant(
          of: addProductInkWell,
          matching: find.byType(Focus),
        );
        final addProductFocusableLabel = find.descendant(
          of: addProductFocus.first,
          matching: find.text('Add product'),
        );
        Focus.of(tester.element(addProductFocusableLabel)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);

        final settingsLabel = find.text('Store profile');
        final settingsInkWell = find.ancestor(
          of: settingsLabel,
          matching: find.byType(InkWell),
        );
        final settingsFocusableLabel = find.descendant(
          of: find.descendant(
            of: settingsInkWell,
            matching: find.byType(Focus),
          ).first,
          matching: settingsLabel,
        );
        Focus.of(tester.element(settingsFocusableLabel)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();

        expect(settingsTaps, 1);
        await tester.tap(settingsLabel);

        expect(quickActionTaps, 1);
        expect(settingsTaps, 2);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('dashboard quick actions open routes with Enter', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      try {
        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: SingleChildScrollView(
                  child: dashboard_widgets.QuickActionsGrid(
                    onOrdersTap: () =>
                        Navigator.of(context).pushNamed(AppRoutes.orders),
                  ),
                ),
              ),
            ),
            routes: {
              AppRoutes.orders: (_) => const Scaffold(
                body: Center(child: Text('Orders destination')),
              ),
            },
          ),
        );

        final ordersAction = find.bySemanticsLabel('Manage Orders');
        final actionNode = tester.getSemantics(ordersAction);
        expect(
          actionNode,
          matchesSemantics(
            label: 'Manage Orders',
            hint: 'View & update orders',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
          ),
        );
        final actionSize = tester.getSize(ordersAction);
        expect(actionSize.width, greaterThanOrEqualTo(48));
        expect(actionSize.height, greaterThanOrEqualTo(48));

        final ordersLabel = find.text('Manage Orders');
        final ordersInkWell = find.ancestor(
          of: ordersLabel,
          matching: find.byType(InkWell),
        );
        final ordersFocus = find.descendant(
          of: ordersInkWell,
          matching: find.byType(Focus),
        );
        final ordersFocusableLabel = find.descendant(
          of: ordersFocus.first,
          matching: find.text('Manage Orders'),
        );
        Focus.of(tester.element(ordersFocusableLabel)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(find.text('Orders destination'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets(
      'wizard option cards expose selected state and keyboard input',
      (tester) async {
        final semantics = tester.ensureSemantics();
        var selected = false;
        try {
          await tester.pumpWidget(
            ChangeNotifierProvider<ThemeProvider>(
              create: (_) => ThemeProvider(),
              child: MaterialApp(
                home: Scaffold(
                  body: StatefulBuilder(
                    builder: (context, setState) => Center(
                      child: SizedBox(
                        width: 340,
                        child: WizardOptionCard(
                          icon: Icons.inventory_2_outlined,
                          title: 'Physical products',
                          subtitle: 'Items that customers can receive',
                          isSelected: selected,
                          onTap: () => setState(() => selected = !selected),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );

          const optionKey = ValueKey('wizard-option-Physical products');
          final option = find.byKey(optionKey);
          expect(
            tester.getSemantics(option),
            matchesSemantics(
              label: 'Physical products, Items that customers can receive',
              isButton: true,
              hasEnabledState: true,
              isEnabled: true,
              hasSelectedState: true,
              isSelected: false,
              hasTapAction: true,
            ),
          );
          expect(tester.getSize(option).height, greaterThanOrEqualTo(48));

          final optionTitle = find.text('Physical products');
          Focus.of(tester.element(optionTitle)).requestFocus();
          await tester.pump();
          await tester.sendKeyEvent(LogicalKeyboardKey.enter);
          await tester.pump();

          final selectedData = tester.getSemantics(option).getSemanticsData();
          expect(selectedData.hasFlag(SemanticsFlag.isSelected), isTrue);
          expect(selected, isTrue);

          await tester.sendKeyEvent(LogicalKeyboardKey.space);
          await tester.pump();
          expect(
            tester
                .getSemantics(option)
                .getSemanticsData()
                .hasFlag(SemanticsFlag.isSelected),
            isFalse,
          );
          expect(selected, isFalse);
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );

    testWidgets('wizard shell actions are named and keyboard accessible', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      var backTaps = 0;
      var skipTaps = 0;
      late ThemeProvider themeProvider;
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<ThemeProvider>(
                create: (_) => themeProvider = ThemeProvider(),
              ),
              ChangeNotifierProvider<LanguageService>(
                create: (_) => LanguageService(),
              ),
            ],
            child: MaterialApp(
              home: Scaffold(
                body: WizardContainer(
                  currentStep: 2,
                  totalSteps: 7,
                  onBack: () => backTaps++,
                  onSkip: () => skipTaps++,
                  skipText: 'Skip this step',
                  child: const Text('Sales channels'),
                ),
              ),
            ),
          ),
        );

        final backAction = find.bySemanticsLabel('← Back');
        final backData = tester.getSemantics(backAction).getSemanticsData();
        expect(backData.hasFlag(SemanticsFlag.isButton), isTrue);
        expect(backData.hasAction(SemanticsAction.tap), isTrue);
        expect(tester.getSize(backAction).width, greaterThanOrEqualTo(48));
        expect(tester.getSize(backAction).height, greaterThanOrEqualTo(48));

        final themeAction = find.bySemanticsLabel('Switch to light mode');
        final themeData = tester.getSemantics(themeAction).getSemanticsData();
        expect(themeData.hasFlag(SemanticsFlag.isButton), isTrue);
        expect(themeData.hasAction(SemanticsAction.tap), isTrue);
        expect(tester.getSize(themeAction).width, greaterThanOrEqualTo(48));
        expect(tester.getSize(themeAction).height, greaterThanOrEqualTo(48));

        final skipAction = find.bySemanticsLabel('Skip this step');
        expect(
          tester
              .getSemantics(skipAction)
              .getSemanticsData()
              .hasAction(SemanticsAction.tap),
          isTrue,
        );
        expect(tester.getSize(skipAction).height, greaterThanOrEqualTo(48));

        Focus.of(
          tester.element(find.byIcon(Icons.arrow_back_ios_new_rounded)),
        ).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        expect(backTaps, 1);

        await tester.ensureVisible(skipAction);
        Focus.of(tester.element(find.text('Skip this step'))).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.space);
        await tester.pump();
        expect(skipTaps, 1);

        Focus.of(
          tester.element(find.byIcon(Icons.light_mode_rounded)),
        ).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        expect(
          themeProvider.isDarkMode(tester.element(find.text('Sales channels'))),
          isFalse,
        );
        expect(find.bySemanticsLabel('Switch to dark mode'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard language selector changes language by keyboard', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      late LanguageService language;
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<ThemeProvider>(
                create: (_) => ThemeProvider(),
              ),
              ChangeNotifierProvider<LanguageService>(
                create: (_) => language = LanguageService(),
              ),
            ],
            child: const MaterialApp(
              home: Scaffold(
                body: WizardContainer(
                  currentStep: 2,
                  totalSteps: 7,
                  child: Text('Sales channels'),
                ),
              ),
            ),
          ),
        );

        final languageButton = find.byKey(
          const ValueKey('wizard-language-selector'),
        );
        final languageData = tester
            .getSemantics(languageButton)
            .getSemanticsData();
        expect(languageData.hasFlag(SemanticsFlag.isFocusable), isTrue);
        expect(languageData.hasFlag(SemanticsFlag.hasExpandedState), isTrue);
        expect(languageData.hasAction(SemanticsAction.tap), isTrue);
        expect(languageData.tooltip, 'English');
        expect(tester.getSize(languageButton).height, greaterThanOrEqualTo(48));

        Focus.of(tester.element(find.text('English'))).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.text('தமிழ்'), findsOneWidget);

        await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(language.currentLanguage, AppLanguage.tamil);
        expect(find.text('தமிழ்'), findsOneWidget);
        expect(
          tester.getSemantics(languageButton).getSemanticsData().tooltip,
          'தமிழ்',
        );

        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(language.currentLanguage, AppLanguage.english);
        expect(find.text('English'), findsOneWidget);

        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(language.currentLanguage, AppLanguage.tamil);
        expect(find.text('தமிழ்'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard exit confirmation actions support keyboard', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      final api = _FakeApiClient();
      final language = LanguageService();
      final providers = _merchantShellProviders(api)
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();

        Focus.of(
          tester.element(find.byIcon(Icons.logout_rounded)),
        ).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.text(language.logoutTitle), findsOneWidget);

        for (final key in ['wizard-logout-cancel', 'wizard-logout-confirm']) {
          final action = find.byKey(ValueKey(key));
          final data = tester.getSemantics(action).getSemanticsData();
          expect(
            data.label,
            key == 'wizard-logout-cancel' ? language.cancel : language.logout,
          );
          expect(data.hasFlag(SemanticsFlag.isButton), isTrue);
          expect(data.hasFlag(SemanticsFlag.isEnabled), isTrue);
          expect(data.hasAction(SemanticsAction.tap), isTrue);
          expect(tester.getSize(action).height, greaterThanOrEqualTo(48));
        }

        Focus.of(tester.element(find.text(language.cancel))).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.text(language.logoutTitle), findsNothing);
        expect(find.text(language.wizardNewBusiness), findsOneWidget);
        expect(api.paths, isEmpty);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard logout confirmation signs out and opens login', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      final api = _FakeApiClient();
      final language = LanguageService();
      final identityRequests = <http.Request>[];
      final auth = _TestMerchantAuthService(
        api: api,
        currentUserId: 'synthetic-owner',
        httpClient: MockClient((request) async {
          identityRequests.add(request);
          switch (request.url.path) {
            case '/login':
              return http.Response(
                '',
                200,
                headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
              );
            case '/api/auth/login':
              return http.Response(
                '{"success":true}',
                200,
                headers: {'set-cookie': 'lb_session=session_123; Path=/;'},
              );
            case '/api/auth/session':
              return http.Response(
                '{"authenticated":true,"user":{"id":"synthetic-owner","email":"owner@example.invalid"}}',
                200,
              );
            case '/api/auth/logout':
              return http.Response('{"success":true}', 200);
          }
          return http.Response('not found', 404);
        }),
      );
      final signedInUser = await auth.signInWithPassword(
        'owner@example.invalid',
        'synthetic-password',
      );
      expect(signedInUser?.id, 'synthetic-owner');
      expect(auth.isSignedIn, isTrue);
      final providers = _merchantShellProviders(
        api,
        currentUserId: 'synthetic-owner',
        authServiceOverride: auth,
      )..add(ChangeNotifierProvider<LanguageService>.value(value: language));

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: MaterialApp(
              home: const CreateStoreWizard(),
              routes: {
                AppRoutes.login: (_) => const Scaffold(
                  body: Center(child: Text('Merchant login reached')),
                ),
              },
            ),
          ),
        );
        await tester.pumpAndSettle();

        Focus.of(
          tester.element(find.byIcon(Icons.logout_rounded)),
        ).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.text(language.logoutTitle), findsOneWidget);

        final confirm = find.byKey(const ValueKey('wizard-logout-confirm'));
        expect(
          tester.getSemantics(confirm).getSemanticsData().label,
          language.logout,
        );
        Focus.of(tester.element(find.text(language.logout))).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(auth.signOutCalls, 1);
        expect(auth.isSignedIn, isFalse);
        final logoutRequests = identityRequests
            .where((request) => request.url.path == '/api/auth/logout')
            .toList();
        expect(logoutRequests, hasLength(1));
        expect(
          logoutRequests.single.headers['cookie'],
          'lb_session=session_123',
        );
        expect(logoutRequests.single.method, 'POST');
        expect(find.text('Merchant login reached'), findsOneWidget);
        expect(find.byType(CreateStoreWizard), findsNothing);
        expect(api.paths, isEmpty);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard category is selected by keyboard and saved', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      final api = _FakeApiClient();
      final language = LanguageService();
      final providers = _merchantShellProviders(api)
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
      Future<void> activateAndAdvance(Finder target) async {
        Focus.of(tester.element(target)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
      }

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();

        await activateAndAdvance(find.text(language.wizardNewBusiness));
        expect(find.text(language.wizardWhereToSell), findsOneWidget);
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        expect(find.text(language.wizardWhatToSell), findsOneWidget);
        await activateAndAdvance(find.text(language.physicalProducts));
        expect(find.text(language.wizardCategory), findsOneWidget);

        final fashion = find.byKey(const ValueKey('wizard-category-fashion'));
        final initialData = tester.getSemantics(fashion).getSemanticsData();
        expect(initialData.label, language.fashionApparel);
        expect(initialData.hasFlag(SemanticsFlag.isButton), isTrue);
        expect(initialData.hasFlag(SemanticsFlag.isEnabled), isTrue);
        expect(initialData.hasFlag(SemanticsFlag.hasSelectedState), isTrue);
        expect(initialData.hasFlag(SemanticsFlag.isSelected), isFalse);
        expect(initialData.hasAction(SemanticsAction.tap), isTrue);
        expect(tester.getSize(fashion).height, greaterThanOrEqualTo(48));

        Focus.of(
          tester.element(find.text(language.fashionApparel)),
        ).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump();
        final selectedData = tester.getSemantics(fashion).getSemanticsData();
        expect(selectedData.hasFlag(SemanticsFlag.isSelected), isTrue);

        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
        expect(find.text(language.wizardStoreName), findsOneWidget);
        expect(api.paths, contains('/onboarding/mobile-progress'));
        expect(
          api.bodies['/onboarding/mobile-progress'],
          containsPair('category', 'fashion'),
        );
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets(
      'wizard theme is selected by keyboard after availability check',
      (tester) async {
        final semantics = tester.ensureSemantics();
        const subdomain = 'my-store';
        final api = _FakeApiClient(
          errors: {
            'stores/public/$subdomain': const ApiException(
              message: 'Not found',
              statusCode: 404,
              code: 'NOT_FOUND',
            ),
          },
        );
        final language = LanguageService();
        final providers = _merchantShellProviders(api)
          ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
        Future<void> activateAndAdvance(Finder target) async {
          Focus.of(tester.element(target)).requestFocus();
          await tester.pump();
          await tester.sendKeyEvent(LogicalKeyboardKey.enter);
          await tester.pump(const Duration(milliseconds: 250));
          await tester.pumpAndSettle();
        }

        try {
          await tester.pumpWidget(
            MultiProvider(
              providers: providers,
              child: const MaterialApp(home: CreateStoreWizard()),
            ),
          );
          await tester.pumpAndSettle();

          await activateAndAdvance(find.text(language.wizardNewBusiness));
          await tester.ensureVisible(find.text(language.skipStep));
          await activateAndAdvance(find.text(language.skipStep));
          await activateAndAdvance(find.text(language.physicalProducts));
          await activateAndAdvance(find.text(language.fashionApparel));
          await tester.enterText(find.byType(TextField).first, 'Sample Shop');
          await tester.pumpAndSettle();
          await tester.tap(find.text(language.next));
          await tester.pumpAndSettle();
          expect(find.text(language.wizardSubdomain), findsOneWidget);

          await tester.enterText(find.byType(TextField).first, subdomain);
          await tester.pumpAndSettle();
          expect(api.paths, contains('stores/public/$subdomain'));
          expect(
            find.textContaining(language.subdomainAvailable),
            findsOneWidget,
          );
          await tester.tap(find.text(language.next));
          await tester.pumpAndSettle();
          expect(find.text(language.wizardTheme), findsOneWidget);

          final theme = find.byKey(
            const ValueKey('wizard-theme-minimal_modern'),
          );
          final initialData = tester.getSemantics(theme).getSemanticsData();
          expect(initialData.label, 'Minimal Modern');
          expect(initialData.hasFlag(SemanticsFlag.isButton), isTrue);
          expect(initialData.hasFlag(SemanticsFlag.isEnabled), isTrue);
          expect(initialData.hasFlag(SemanticsFlag.hasSelectedState), isTrue);
          expect(initialData.hasFlag(SemanticsFlag.isSelected), isTrue);
          expect(initialData.hasAction(SemanticsAction.tap), isTrue);
          expect(tester.getSize(theme).height, greaterThanOrEqualTo(48));

          Focus.of(tester.element(find.text('Vibrant Bold'))).requestFocus();
          await tester.pump();
          await tester.sendKeyEvent(LogicalKeyboardKey.enter);
          await tester.pump();
          final selectedTheme = find.byKey(
            const ValueKey('wizard-theme-vibrant_bold'),
          );
          expect(
            tester
                .getSemantics(selectedTheme)
                .getSemanticsData()
                .hasFlag(SemanticsFlag.isSelected),
            isTrue,
          );
          expect(find.text(language.createStore), findsOneWidget);
          final createStoreButton = find.ancestor(
            of: find.text(language.createStore),
            matching: find.byType(ElevatedButton),
          );
          final createStoreData = tester
              .getSemantics(createStoreButton)
              .getSemanticsData();
          expect(createStoreData.label, language.createStore);
          expect(createStoreData.hasFlag(SemanticsFlag.isButton), isTrue);
          expect(createStoreData.hasFlag(SemanticsFlag.isEnabled), isTrue);
          expect(createStoreData.hasAction(SemanticsAction.tap), isTrue);
          expect(
            tester.getSize(createStoreButton).height,
            greaterThanOrEqualTo(48),
          );
          expect(api.paths, isNot(contains('stores')));
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );

    testWidgets(
      'wizard retries a failed publish without creating another store',
      (tester) async {
        SharedPreferences.setMockInitialValues({});
        const subdomain = 'retry-shop';
        final draft = {
          ..._storeJson(name: 'Sample Shop', subdomain: subdomain),
          'status': 'draft',
        };
        final published = {...draft, 'status': 'published'};
        final api = _PublishRetryApiClient(
          json: {'/stores': draft, '/stores/store_1/publish': published},
          errors: {
            'stores/public/$subdomain': const ApiException(
              message: 'Not found',
              statusCode: 404,
              code: 'NOT_FOUND',
            ),
          },
        );
        final language = LanguageService();
        final providers = _merchantShellProviders(
          api,
          currentUserId: 'retry-owner',
        )..add(ChangeNotifierProvider<LanguageService>.value(value: language));
        String? destination;
        Object? destinationArguments;
        Future<void> activateAndAdvance(Finder target) async {
          Focus.of(tester.element(target)).requestFocus();
          await tester.pump();
          await tester.sendKeyEvent(LogicalKeyboardKey.enter);
          await tester.pump(const Duration(milliseconds: 250));
          await tester.pumpAndSettle();
        }

        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: MaterialApp(
              home: const CreateStoreWizard(),
              onGenerateRoute: (settings) {
                destination = settings.name;
                destinationArguments = settings.arguments;
                return MaterialPageRoute<void>(
                  settings: settings,
                  builder: (_) =>
                      const Scaffold(body: Text('Published store destination')),
                );
              },
            ),
          ),
        );
        await tester.pumpAndSettle();

        await activateAndAdvance(find.text(language.wizardNewBusiness));
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.physicalProducts));
        await activateAndAdvance(find.text(language.fashionApparel));
        await tester.enterText(find.byType(TextField).first, 'Sample Shop');
        await tester.pumpAndSettle();
        await tester.tap(find.text(language.next));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).first, subdomain);
        await tester.pumpAndSettle();
        await tester.tap(find.text(language.next));
        await tester.pumpAndSettle();

        final createButton = find.ancestor(
          of: find.text(language.createStore),
          matching: find.byType(ElevatedButton),
        );
        await tester.ensureVisible(createButton);
        await tester.pumpAndSettle();
        await tester.tap(createButton);
        await tester.pumpAndSettle();
        expect(api.createAttempts, 1);
        expect(api.publishAttempts, 0);
        expect(find.text(language.createStore), findsOneWidget);
        final pendingPreferences = await SharedPreferences.getInstance();
        expect(
          pendingPreferences.getString(
            'letbuyy.pending_mobile_store_creation.retry-owner.key',
          ),
          isNotNull,
        );
        expect(
          pendingPreferences.getString(
            'letbuyy.pending_mobile_store_creation.retry-owner.request',
          ),
          pendingPreferences.getString(
            'letbuyy.pending_mobile_store_creation.retry-owner.fingerprint',
          ),
        );

        // The first create committed on the server but its response was lost.
        // Recreate the wizard to model process death. The saved request must
        // restore the final step and let the Gateway return that draft on retry.
        await tester.pumpWidget(const SizedBox.shrink());
        final resumedProviders = _merchantShellProviders(
          api,
          currentUserId: 'retry-owner',
        )..add(ChangeNotifierProvider<LanguageService>.value(value: language));
        await tester.pumpWidget(
          MultiProvider(
            providers: resumedProviders,
            child: MaterialApp(
              home: const CreateStoreWizard(),
              onGenerateRoute: (settings) {
                destination = settings.name;
                destinationArguments = settings.arguments;
                return MaterialPageRoute<void>(
                  settings: settings,
                  builder: (_) =>
                      const Scaffold(body: Text('Published store destination')),
                );
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text(language.createStore), findsOneWidget);

        await tester.ensureVisible(createButton);
        await tester.pumpAndSettle();
        await tester.tap(createButton);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 250));
        expect(api.createAttempts, 2);
        expect(api.publishAttempts, 1);
        expect(find.text(language.retryPublishStore), findsOneWidget);
        expect(api.paths.where((path) => path == '/stores').length, 2);

        await tester.tap(find.text(language.retryPublishStore));
        await tester.pumpAndSettle();

        expect(api.publishAttempts, 2);
        expect(api.createAttempts, 2);
        expect(api.paths.where((path) => path == '/stores').length, 2);
        expect(api.createIdempotencyKeys, hasLength(2));
        expect(api.createIdempotencyKeys.toSet(), hasLength(1));
        expect(api.bodies['/stores'], containsPair('name', 'Sample Shop'));
        expect(api.bodies['/stores'], containsPair('subdomain', subdomain));
        expect(
          api.paths.where((path) => path == '/stores/store_1/publish').length,
          2,
        );
        expect(api.bodies['/stores'], containsPair('name', 'Sample Shop'));
        expect(api.bodies['/stores'], containsPair('subdomain', subdomain));
        expect(destination, AppRoutes.storePublished);
        expect(destinationArguments, containsPair('storeId', 'store_1'));
        expect(destinationArguments, containsPair('storeName', 'Sample Shop'));
        expect(destinationArguments, containsPair('subdomain', subdomain));
        expect(
          pendingPreferences.getString(
            'letbuyy.pending_mobile_store_creation.retry-owner.key',
          ),
          isNull,
        );
        expect(
          pendingPreferences.getString(
            'letbuyy.pending_mobile_store_creation.retry-owner.fingerprint',
          ),
          isNull,
        );
        expect(
          pendingPreferences.getString(
            'letbuyy.pending_mobile_store_creation.retry-owner.request',
          ),
          isNull,
        );
        final storeContext = Provider.of<StoreContext>(
          tester.element(find.text('Published store destination')),
          listen: false,
        );
        expect(storeContext.selectedStore?.id, 'store_1');
        expect(storeContext.selectedStore?.status, StoreStatus.published);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('wizard store-name and subdomain back actions support Enter', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      final language = LanguageService();
      final providers = _merchantShellProviders(_FakeApiClient())
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
      Future<void> activateAndAdvance(Finder target) async {
        Focus.of(tester.element(target)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
      }

      Future<void> activateBack(String key) async {
        final action = find.byKey(ValueKey(key));
        final data = tester.getSemantics(action).getSemanticsData();
        expect(data.label, language.back);
        expect(data.hasFlag(SemanticsFlag.isButton), isTrue);
        expect(data.hasFlag(SemanticsFlag.isEnabled), isTrue);
        expect(data.hasAction(SemanticsAction.tap), isTrue);
        expect(tester.getSize(action).height, greaterThanOrEqualTo(48));

        final label = find.descendant(
          of: action,
          matching: find.text(language.back),
        );
        Focus.of(tester.element(label)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 400));
        await tester.pumpAndSettle();
      }

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();
        await activateAndAdvance(find.text(language.wizardNewBusiness));
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.physicalProducts));
        await activateAndAdvance(find.text(language.fashionApparel));
        expect(find.text(language.wizardStoreName), findsOneWidget);

        await tester.enterText(find.byType(TextField).first, 'Sample Shop');
        await tester.pumpAndSettle();
        await tester.tap(find.text(language.next));
        await tester.pumpAndSettle();
        expect(find.text(language.wizardSubdomain), findsOneWidget);

        await activateBack('wizard-subdomain-back');
        expect(find.text(language.wizardStoreName), findsOneWidget);
        await activateBack('wizard-store-name-back');
        expect(find.text(language.wizardCategory), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard subdomain status is localized and announced', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      const availableSubdomain = 'available-shop';
      final api = _FakeApiClient(
        errors: {
          'stores/public/$availableSubdomain': const ApiException(
            message: 'Not found',
            statusCode: 404,
            code: 'NOT_FOUND',
          ),
        },
        delay: const Duration(milliseconds: 350),
      );
      final language = LanguageService();
      final providers = _merchantShellProviders(api)
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
      Future<void> activateAndAdvance(Finder target) async {
        Focus.of(tester.element(target)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
      }

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();
        await activateAndAdvance(find.text(language.wizardNewBusiness));
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.physicalProducts));
        await activateAndAdvance(find.text(language.fashionApparel));
        await tester.enterText(find.byType(TextField).first, 'Sample Shop');
        await tester.pumpAndSettle();
        await tester.tap(find.text(language.next));
        await tester.pumpAndSettle();
        expect(find.text(language.wizardSubdomain), findsOneWidget);

        await tester.enterText(
          find.byType(TextField).first,
          availableSubdomain,
        );
        await tester.pump(const Duration(milliseconds: 100));
        final checking = find.byKey(
          const ValueKey('wizard-subdomain-status-checking'),
        );
        expect(
          tester
              .getSemantics(checking)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );
        expect(find.text(language.checkingAvailability), findsOneWidget);

        await tester.pump(const Duration(milliseconds: 300));
        await tester.pumpAndSettle();
        expect(api.paths, contains('stores/public/$availableSubdomain'));
        final available = find.byKey(
          const ValueKey('wizard-subdomain-status-available'),
        );
        expect(
          find.textContaining(language.subdomainAvailable),
          findsOneWidget,
        );
        expect(
          find.textContaining('https://$availableSubdomain.letbuyy.com'),
          findsOneWidget,
        );
        expect(
          tester
              .getSemantics(available)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );

        await language.setLanguage(AppLanguage.tamil);
        await tester.pumpAndSettle();
        expect(
          find.textContaining(language.subdomainAvailable),
          findsOneWidget,
        );

        await tester.enterText(find.byType(TextField).first, 'taken-shop');
        await tester.pump(const Duration(milliseconds: 400));
        await tester.pumpAndSettle();
        final taken = find.byKey(
          const ValueKey('wizard-subdomain-status-taken'),
        );
        expect(find.textContaining(language.subdomainTaken), findsOneWidget);
        expect(
          find.textContaining(language.subdomainChooseAnother),
          findsOneWidget,
        );
        expect(
          tester
              .getSemantics(taken)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );

        await language.setLanguage(AppLanguage.hindi);
        await tester.pumpAndSettle();
        expect(find.textContaining(language.subdomainTaken), findsOneWidget);
        expect(
          find.textContaining(language.subdomainChooseAnother),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard subdomain validation fails closed with clear errors', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      const offlineSubdomain = 'offline-shop';
      final api = _FakeApiClient(
        errors: {
          'stores/public/$offlineSubdomain': const ApiException(
            message: 'Unavailable',
            statusCode: 503,
            code: 'SERVICE_UNAVAILABLE',
          ),
        },
      );
      final language = LanguageService();
      final providers = _merchantShellProviders(api)
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
      Future<void> activateAndAdvance(Finder target) async {
        Focus.of(tester.element(target)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
      }

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();
        await activateAndAdvance(find.text(language.wizardNewBusiness));
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.physicalProducts));
        await activateAndAdvance(find.text(language.fashionApparel));
        await tester.enterText(find.byType(TextField).first, 'Sample Shop');
        await tester.pumpAndSettle();
        await tester.tap(find.text(language.next));
        await tester.pumpAndSettle();
        expect(find.text(language.wizardSubdomain), findsOneWidget);

        await tester.enterText(find.byType(TextField).first, 'ab');
        await tester.pump();
        var tooShort = find.byKey(
          const ValueKey('wizard-subdomain-status-tooShort'),
        );
        expect(
          tester.getSemantics(tooShort).getSemanticsData().label,
          language.subdomainTooShort,
        );
        expect(
          tester
              .getSemantics(tooShort)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );
        expect(api.paths, isNot(contains('stores/public/ab')));

        await language.setLanguage(AppLanguage.tamil);
        await tester.pump();
        expect(
          tester.getSemantics(tooShort).getSemanticsData().label,
          language.subdomainTooShort,
        );

        await tester.enterText(find.byType(TextField).first, 'bad_name');
        await tester.pump();
        final invalid = find.byKey(
          const ValueKey('wizard-subdomain-status-invalidCharacters'),
        );
        expect(
          tester.getSemantics(invalid).getSemanticsData().label,
          language.subdomainInvalidCharacters,
        );
        expect(api.paths, isNot(contains('stores/public/bad_name')));

        await language.setLanguage(AppLanguage.hindi);
        await tester.pump();
        expect(
          tester.getSemantics(invalid).getSemanticsData().label,
          language.subdomainInvalidCharacters,
        );

        await tester.enterText(find.byType(TextField).first, offlineSubdomain);
        await tester.pumpAndSettle();
        final unavailable = find.byKey(
          const ValueKey('wizard-subdomain-status-checkFailed'),
        );
        expect(
          tester.getSemantics(unavailable).getSemanticsData().label,
          language.subdomainCheckFailed,
        );
        expect(
          tester
              .getSemantics(unavailable)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );
        expect(api.paths, contains('stores/public/$offlineSubdomain'));
        final next = find.text(language.next);
        expect(
          tester
              .getSemantics(next)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isEnabled),
          isFalse,
        );
        expect(api.paths, isNot(contains('stores')));
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('stale subdomain lookup cannot replace newer validation', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      const slowSubdomain = 'slow-shop';
      final api = _DelayedSubdomainLookupApiClient(slowSubdomain);
      final language = LanguageService();
      final providers = _merchantShellProviders(api)
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
      Future<void> activateAndAdvance(Finder target) async {
        Focus.of(tester.element(target)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
      }

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();
        await activateAndAdvance(find.text(language.wizardNewBusiness));
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.physicalProducts));
        await activateAndAdvance(find.text(language.fashionApparel));
        await tester.enterText(find.byType(TextField).first, 'Sample Shop');
        await tester.pumpAndSettle();
        await tester.tap(find.text(language.next));
        await tester.pumpAndSettle();
        expect(find.text(language.wizardSubdomain), findsOneWidget);

        await tester.enterText(find.byType(TextField).first, 'available-shop');
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('wizard-subdomain-status-available')),
          findsOneWidget,
        );

        await tester.enterText(find.byType(TextField).first, slowSubdomain);
        expect(api.delayedLookupStarted, isTrue);
        await tester.pump(const Duration(milliseconds: 50));
        expect(
          find.byKey(const ValueKey('wizard-subdomain-status-checking')),
          findsOneWidget,
        );
        expect(
          tester
              .getSemantics(find.text(language.next))
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isEnabled),
          isFalse,
        );

        await tester.enterText(find.byType(TextField).first, 'ab');
        await tester.pump();
        final tooShort = find.byKey(
          const ValueKey('wizard-subdomain-status-tooShort'),
        );
        expect(tooShort, findsOneWidget);
        await tester.pump(const Duration(milliseconds: 2200));
        await tester.pumpAndSettle();

        expect(tooShort, findsOneWidget);
        expect(
          find.byKey(const ValueKey('wizard-subdomain-status-available')),
          findsNothing,
        );
        expect(
          find.byKey(const ValueKey('wizard-subdomain-status-checking')),
          findsNothing,
        );
        expect(api.paths, contains('stores/public/$slowSubdomain'));
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('wizard store-name validation is localized and announced', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      final language = LanguageService();
      final providers = _merchantShellProviders(_FakeApiClient())
        ..add(ChangeNotifierProvider<LanguageService>.value(value: language));
      Future<void> activateAndAdvance(Finder target) async {
        Focus.of(tester.element(target)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pumpAndSettle();
      }

      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: providers,
            child: const MaterialApp(home: CreateStoreWizard()),
          ),
        );
        await tester.pumpAndSettle();
        await activateAndAdvance(find.text(language.wizardNewBusiness));
        await tester.ensureVisible(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.skipStep));
        await activateAndAdvance(find.text(language.physicalProducts));
        await activateAndAdvance(find.text(language.fashionApparel));
        expect(find.text(language.wizardStoreName), findsOneWidget);

        await tester.enterText(find.byType(TextField).first, 'Abc');
        await tester.pump();
        final tooShort = find.byKey(
          const ValueKey('wizard-store-name-too-short'),
        );
        expect(
          tester.getSemantics(tooShort).getSemanticsData().label,
          language.wizardStoreNameTooShort,
        );
        expect(
          tester
              .getSemantics(tooShort)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );

        await language.setLanguage(AppLanguage.tamil);
        await tester.pump();
        expect(
          tester.getSemantics(tooShort).getSemanticsData().label,
          language.wizardStoreNameTooShort,
        );
        expect(find.text(language.wizardStoreNameTooShort), findsOneWidget);

        await tester.enterText(find.byType(TextField).first, 'Abcd');
        await tester.pump();
        final validName = find.byKey(
          const ValueKey('wizard-store-name-meets-minimum'),
        );
        expect(
          tester.getSemantics(validName).getSemanticsData().label,
          language.wizardStoreNameMeetsMinimum,
        );
        expect(
          tester
              .getSemantics(validName)
              .getSemanticsData()
              .hasFlag(SemanticsFlag.isLiveRegion),
          isTrue,
        );

        await language.setLanguage(AppLanguage.hindi);
        await tester.pump();
        expect(
          tester.getSemantics(validName).getSemanticsData().label,
          language.wizardStoreNameMeetsMinimum,
        );
        final next = find.text(language.next);
        Focus.of(tester.element(next)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();
        expect(find.text(language.wizardSubdomain), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('dashboard notification control opens its route with Enter', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: _merchantShellProviders(_FakeApiClient()),
            child: MaterialApp(
              home: Builder(
                builder: (context) => Scaffold(
                  body: header_widgets.PremiumHeader(
                    isDark: true,
                    onNotificationTap: () => Navigator.of(
                      context,
                    ).pushNamed(AppRoutes.notifications),
                  ),
                ),
              ),
              routes: {
                AppRoutes.notifications: (_) => const Scaffold(
                  body: Center(child: Text('Notifications destination')),
                ),
              },
            ),
          ),
        );

        final notificationAction = find.bySemanticsLabel('Notifications');
        expect(
          tester.getSemantics(notificationAction),
          matchesSemantics(
            label: 'Notifications',
            hint: 'Open notifications',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
            hasFocusAction: true,
            isFocusable: true,
          ),
        );
        final actionSize = tester.getSize(notificationAction);
        expect(actionSize.width, greaterThanOrEqualTo(48));
        expect(actionSize.height, greaterThanOrEqualTo(48));

        final icon = find.byIcon(Icons.notifications_outlined);
        final notificationInkWell = find.ancestor(
          of: icon,
          matching: find.byType(InkWell),
        );
        final notificationFocus = find.descendant(
          of: notificationInkWell,
          matching: find.byType(Focus),
        );
        final focusableIcon = find.descendant(
          of: notificationFocus.first,
          matching: find.byIcon(Icons.notifications_outlined),
        );
        Focus.of(tester.element(focusableIcon)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(find.text('Notifications destination'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('dashboard profile control opens account sheet with Enter', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: _merchantShellProviders(_FakeApiClient()),
            child: MaterialApp(
              home: const Scaffold(
                body: header_widgets.PremiumHeader(isDark: true),
              ),
              routes: {
                AppRoutes.login: (_) => const Scaffold(
                  body: Center(child: Text('Login destination')),
                ),
              },
            ),
          ),
        );

        final accountAction = find.bySemanticsLabel('Account');
        expect(
          tester.getSemantics(accountAction),
          matchesSemantics(
            label: 'Account',
            hint: 'Open account menu',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
          ),
        );
        final actionSize = tester.getSize(accountAction);
        expect(actionSize.width, greaterThanOrEqualTo(48));
        expect(actionSize.height, greaterThanOrEqualTo(48));

        final initials = find.text('U');
        final accountInkWell = find.ancestor(
          of: initials,
          matching: find.byType(InkWell),
        );
        final accountFocus = find.descendant(
          of: accountInkWell,
          matching: find.byType(Focus),
        );
        final focusableInitials = find.descendant(
          of: accountFocus.first,
          matching: find.text('U'),
        );
        Focus.of(tester.element(focusableInitials)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(find.text('Merchant'), findsOneWidget);
        expect(find.text('Add account'), findsOneWidget);

        final addAccountAction = find.bySemanticsLabel('Add account');
        expect(
          tester.getSemantics(addAccountAction),
          matchesSemantics(
            label: 'Add account',
            hint: 'Open Add account',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
          ),
        );
        final addAccountSize = tester.getSize(addAccountAction);
        expect(addAccountSize.width, greaterThanOrEqualTo(48));
        expect(addAccountSize.height, greaterThanOrEqualTo(48));

        final addAccountText = find.text('Add account');
        final addAccountInkWell = find.ancestor(
          of: addAccountText,
          matching: find.byType(InkWell),
        );
        final addAccountFocus = find.descendant(
          of: addAccountInkWell,
          matching: find.byType(Focus),
        );
        final focusableAddAccount = find.descendant(
          of: addAccountFocus.first,
          matching: find.text('Add account'),
        );
        Focus.of(tester.element(focusableAddAccount)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(find.text('Login destination'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    testWidgets('dashboard store picker switches stores with Enter', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final api = _FakeApiClient(
        paginated: {
          '/stores': [
            _storeJson(),
            _storeJson(id: 'store_2', name: 'Second Store', subdomain: 'two'),
          ],
        },
      );
      final storeService = StoreService(api: api, cache: CacheService.memory());
      final storeContext = StoreContext(storeService: storeService);
      await storeContext.loadStores();
      final auth = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile-token',
      );
      var storeChanged = 0;
      final semantics = tester.ensureSemantics();
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<StoreContext>.value(value: storeContext),
              ChangeNotifierProvider<StoreAuthService>.value(value: auth),
            ],
            child: MaterialApp(
              home: Scaffold(
                body: header_widgets.PremiumHeader(
                  isDark: true,
                  onStoreChanged: () => storeChanged += 1,
                ),
              ),
            ),
          ),
        );

        expect(storeContext.selectedStore?.name, 'Demo Store');
        expect(find.text('Demo Store'), findsOneWidget);
        final storePickerAction = find.bySemanticsLabel(
          'Active store: Demo Store',
        );
        expect(
          tester.getSemantics(storePickerAction),
          matchesSemantics(
            label: 'Active store: Demo Store',
            hint: 'Choose active store',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
          ),
        );
        final pickerSize = tester.getSize(storePickerAction);
        expect(pickerSize.width, greaterThanOrEqualTo(48));
        expect(pickerSize.height, greaterThanOrEqualTo(48));

        final currentStoreText = find.text('Demo Store');
        final pickerInkWell = find.ancestor(
          of: currentStoreText,
          matching: find.byType(InkWell),
        );
        final pickerFocus = find.descendant(
          of: pickerInkWell,
          matching: find.byType(Focus),
        );
        final focusableStoreName = find.descendant(
          of: pickerFocus.first,
          matching: find.text('Demo Store'),
        );
        Focus.of(tester.element(focusableStoreName)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(find.bySemanticsLabel('Second Store'), findsOneWidget);
        expect(
          tester.getSemantics(find.bySemanticsLabel('Demo Store')),
          matchesSemantics(
            label: 'Demo Store',
            hint: 'Current store',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
            hasSelectedState: true,
            isSelected: true,
          ),
        );
        final secondStoreNode = tester.getSemantics(
          find.bySemanticsLabel('Second Store'),
        );
        final secondStoreSize = tester.getSize(
          find.bySemanticsLabel('Second Store'),
        );
        expect(secondStoreSize.width, greaterThanOrEqualTo(48));
        expect(secondStoreSize.height, greaterThanOrEqualTo(48));
        expect(
          secondStoreNode,
          matchesSemantics(
            label: 'Second Store',
            hint: 'Switch to Second Store',
            isButton: true,
            hasEnabledState: true,
            isEnabled: true,
            hasTapAction: true,
            hasSelectedState: true,
            isSelected: false,
          ),
        );

        final secondStoreText = find.text('Second Store');
        final secondStoreInkWell = find.ancestor(
          of: secondStoreText,
          matching: find.byType(InkWell),
        );
        final secondStoreFocus = find.descendant(
          of: secondStoreInkWell,
          matching: find.byType(Focus),
        );
        final focusableSecondStore = find.descendant(
          of: secondStoreFocus.first,
          matching: find.text('Second Store'),
        );
        Focus.of(tester.element(focusableSecondStore)).requestFocus();
        await tester.pump();
        await tester.sendKeyEvent(LogicalKeyboardKey.enter);
        await tester.pumpAndSettle();

        expect(storeContext.selectedStoreId, 'store_2');
        expect(storeChanged, 1);
        expect(
          find.bySemanticsLabel('Active store: Second Store'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });

    test('MerchantTelemetryEvent redacts secret-like metadata', () {
      final event = MerchantTelemetryEvent(
        id: 'event_1',
        name: MerchantTelemetryEventNames.actionTriggered,
        occurredAt: DateTime.utc(2026, 6, 8),
        metadata: {
          'product_id': 'prod_1',
          'session_token': 'do-not-record',
          'password': 'do-not-record',
          'notes': List.filled(220, 'x').join(),
        },
      );

      expect(event.metadata['product_id'], 'prod_1');
      expect(event.metadata.containsKey('session_token'), isFalse);
      expect(event.metadata.containsKey('password'), isFalse);
      expect((event.metadata['notes'] as String).length, 180);
    });

    test(
      'TelemetryService writes contextual events to its durable sink',
      () async {
        SharedPreferences.setMockInitialValues({});
        final sink = await SharedPreferencesTelemetrySink.open(capacity: 4);
        final service = TelemetryService(
          sink: sink,
          storeIdProvider: () => 'store_1',
          userIdProvider: () => 'user_1',
          clock: () => DateTime.utc(2026, 6, 8, 12),
        );

        await service.trackAction(
          'create_product',
          route: AppRoutes.products,
          metadata: {'product_id': 'prod_1', 'csrf_token': 'do-not-record'},
        );

        final events = await sink.pendingEvents();
        expect(events, hasLength(1));
        expect(events.single.name, MerchantTelemetryEventNames.actionTriggered);
        expect(events.single.storeId, 'store_1');
        expect(events.single.userId, 'user_1');
        expect(events.single.route, AppRoutes.products);
        expect(events.single.metadata['action'], 'create_product');
        expect(events.single.metadata['product_id'], 'prod_1');
        expect(events.single.metadata.containsKey('csrf_token'), isFalse);
      },
    );

    testWidgets('wizard does not restore another merchant pending store', (
      tester,
    ) async {
      const ownerId = 'merchant-a';
      const otherOwnerId = 'merchant-b';
      const prefix = 'letbuyy.pending_mobile_store_creation';
      final savedRequest = jsonEncode({
        'name': 'Private Merchant Store',
        'subdomain': 'private-merchant-store',
        'site_type': 'store',
        'tagline': '',
        'theme_id': 'minimal_modern',
        'template_config': {
          'onboarding': {
            'channels': <String>[],
            'source': 'mobile-merchant-app',
          },
        },
      });
      SharedPreferences.setMockInitialValues({
        '$prefix.$ownerId.key': 'pending-create-key-1234',
        '$prefix.$ownerId.fingerprint': savedRequest,
        '$prefix.$ownerId.request': savedRequest,
      });
      final api = _FakeApiClient();
      final language = LanguageService();
      final providers = _merchantShellProviders(
        api,
        currentUserId: otherOwnerId,
      )..add(ChangeNotifierProvider<LanguageService>.value(value: language));

      await tester.pumpWidget(
        MultiProvider(
          providers: providers,
          child: const MaterialApp(home: CreateStoreWizard()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(language.wizardNewBusiness), findsOneWidget);
      expect(
        api.paths.where((path) => path.startsWith('stores/public/')),
        isEmpty,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('TelemetryNavigatorObserver emits screen view events', (
      tester,
    ) async {
      final sink = MemoryTelemetrySink();
      final service = TelemetryService(
        sink: sink,
        clock: () => DateTime.utc(2026, 6, 8, 12),
      );

      await tester.pumpWidget(
        MaterialApp(
          navigatorObservers: [TelemetryNavigatorObserver(service)],
          routes: {
            '/': (_) => Builder(
              builder: (context) => TextButton(
                onPressed: () =>
                    Navigator.of(context).pushNamed(AppRoutes.products),
                child: const Text('Open products'),
              ),
            ),
            AppRoutes.products: (_) => const Scaffold(body: Text('Products')),
          },
        ),
      );

      await tester.tap(find.text('Open products'));
      await tester.pumpAndSettle();

      final events = await sink.pendingEvents();
      expect(
        events.where(
          (event) =>
              event.name == MerchantTelemetryEventNames.screenViewed &&
              event.route == AppRoutes.products,
        ),
        isNotEmpty,
      );
    });

    test('LanguageService persists and restores the selected locale', () async {
      SharedPreferences.setMockInitialValues({});
      final service = LanguageService();
      var notificationCount = 0;
      service.addListener(() => notificationCount += 1);

      await service.setLanguage(AppLanguage.tamil);

      expect(service.currentLanguage, AppLanguage.tamil);
      expect(service.languageCode, 'ta');
      expect(notificationCount, 1);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('app_language'), 'tamil');

      final restored = LanguageService();
      await restored.loadLanguage();

      expect(restored.currentLanguage, AppLanguage.tamil);
      expect(restored.next, isNotEmpty);
    });

    test(
      'LanguageService falls back safely for unknown stored locale',
      () async {
        SharedPreferences.setMockInitialValues({'app_language': 'unknown'});
        final service = LanguageService();

        await service.loadLanguage();

        expect(service.currentLanguage, AppLanguage.english);
        expect(service.languageCode, 'en');
        expect(service.continueBtn, 'Continue');
      },
    );

    test('LanguageService exposes seven merchant language choices', () async {
      SharedPreferences.setMockInitialValues({});
      final service = LanguageService();

      final codes = AppLanguage.values.map(service.languageCodeFor).toList();

      expect(codes, ['en', 'ta', 'hi', 'bn', 'kn', 'mr', 'te']);
      expect(service.languageNameFor(AppLanguage.marathi), 'मराठी');
      expect(service.languageNameFor(AppLanguage.telugu), 'తెలుగు');

      await service.setLanguage(AppLanguage.telugu);

      expect(service.languageCode, 'te');
      expect(service.languageName, 'తెలుగు');
      expect(service.continueBtn, 'Continue');
    });

    test(
      'StorageService uploads files and deletes extracted R2 keys',
      () async {
        final tempDir = await Directory.systemTemp.createTemp(
          'letbuyy-storage-service-',
        );
        addTearDown(() => tempDir.delete(recursive: true));
        final file = File('${tempDir.path}/logo.jpg');
        await file.writeAsBytes([1, 2, 3], flush: true);
        final api = _StorageApiClient(
          uploadUrl: 'https://cdn.letbuyy.com/uploads/logo.jpg',
        );
        final service = StorageService(api: api);

        final url = await service.uploadImage(file, path: 'store-logos');
        await service.deleteImage(
          'https://cdn.letbuyy.com/uploads/store/logo.jpg',
        );

        expect(url, 'https://cdn.letbuyy.com/uploads/logo.jpg');
        expect(api.uploadedFilePath, file.path);
        expect(api.uploadedFolder, 'store-logos');
        expect(api.deletedPaths, contains('upload/uploads/store/logo.jpg'));
      },
    );

    test('StorageService swallows cleanup delete failures', () async {
      final api = _StorageApiClient(failDeletes: true);
      final service = StorageService(api: api);

      await service.deleteImage('https://cdn.letbuyy.com/uploads/old.png');

      expect(api.deletedPaths, ['upload/uploads/old.png']);
    });

    test('StoreService fetches store list through the API client', () async {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
      );

      final stores = await StoreService(api: api).fetchStores();

      expect(stores.single.id, 'store_1');
      expect(api.paths, contains('/stores'));
    });

    test(
      'StoreService falls back to cached store detail when offline',
      () async {
        final cache = CacheService.memory();
        await StoreService(
          api: _FakeApiClient(json: {'/stores/store_1': _storeJson()}),
          cache: cache,
        ).fetchStore('store_1');

        final store = await StoreService(
          api: _ThrowingApiClient(),
          cache: cache,
        ).fetchStore('store_1');

        expect(store.id, 'store_1');
        expect(store.name, 'Demo Store');
      },
    );

    test('StoreContext restores and switches the selected store', () async {
      SharedPreferences.setMockInitialValues({
        'letbuyy.selected_store_id': 'store_2',
      });
      final api = _FakeApiClient(
        paginated: {
          '/stores': [
            _storeJson(),
            _storeJson(id: 'store_2', name: 'Second Store', subdomain: 'two'),
          ],
        },
      );
      final service = StoreService(api: api, cache: CacheService.memory());
      final storeContext = StoreContext(storeService: service);

      final stores = await storeContext.loadStores();

      expect(stores, hasLength(2));
      expect(storeContext.selectedStoreId, 'store_2');

      await storeContext.selectStore(stores.first);

      expect(storeContext.selectedStoreId, 'store_1');
      expect(service.currentStore?.id, 'store_1');
    });

    test('StoreService fetches Store Health signals', () async {
      final api = _FakeApiClient(
        json: {'/stores/store_1/health': _storeHealthJson()},
      );

      final health = await StoreService(api: api).fetchStoreHealth('store_1');

      expect(health['score'], 84);
      expect(api.paths, contains('/stores/store_1/health'));
      expect(
        (health['pillars'] as List).first['summary'],
        isNot(contains('backend contract')),
      );
    });

    test(
      'StoreService manages localization markets and translations',
      () async {
        final api = _FakeApiClient(
          json: {
            '/stores/store_1/localization': _localizationJson(),
            '/stores/store_1/localization/markets': _marketJson(),
            '/stores/store_1/localization/markets/market_1': _marketJson(
              name: 'India Plus',
            ),
            '/stores/store_1/localization/locales': _localeJson(),
            '/stores/store_1/localization/locales/locale_1': _localeJson(
              name: 'Hindi',
            ),
            '/stores/store_1/localization/translations': _translationJson(),
            '/stores/store_1/localization/translations/translation_1':
                _translationJson(translatedText: 'नया शीर्षक'),
          },
        );
        final service = StoreService(api: api);

        final summary = await service.fetchLocalization('store_1');
        final updated = await service.updateLocalization('store_1', {
          'default_locale': 'hi-IN',
          'currency': 'INR',
          'timezone': 'Asia/Kolkata',
        });
        final market = await service.createMarket('store_1', {
          'name': 'India',
          'country_code': 'IN',
          'currency': 'INR',
          'locale': 'hi-IN',
        });
        final editedMarket = await service.updateMarket('store_1', 'market_1', {
          'name': 'India Plus',
        });
        await service.deleteMarket('store_1', 'market_1');
        final locale = await service.createLocale('store_1', {
          'locale': 'hi-IN',
          'name': 'Hindi',
        });
        final editedLocale = await service.updateLocale('store_1', 'locale_1', {
          'name': 'Hindi',
          'status': 'published',
        });
        await service.deleteLocale('store_1', 'locale_1');
        final translation = await service.createTranslation('store_1', {
          'locale': 'hi-IN',
          'resource_type': 'store',
          'resource_id': 'storefront',
          'field': 'title',
          'translated_text': 'नया स्टोर',
        });
        final editedTranslation = await service.updateTranslation(
          'store_1',
          'translation_1',
          {'translated_text': 'नया शीर्षक'},
        );
        await service.deleteTranslation('store_1', 'translation_1');

        expect(summary.defaultLocale, 'en-IN');
        expect(updated.markets.single.name, 'India');
        expect(market.countryCode, 'IN');
        expect(editedMarket.name, 'India Plus');
        expect(locale.locale, 'hi-IN');
        expect(editedLocale.status, 'published');
        expect(translation.resourceType, 'store');
        expect(editedTranslation.translatedText, 'नया शीर्षक');
        expect(
          api.paths,
          containsAll([
            '/stores/store_1/localization',
            '/stores/store_1/localization/markets',
            '/stores/store_1/localization/markets/market_1',
            '/stores/store_1/localization/locales',
            '/stores/store_1/localization/locales/locale_1',
            '/stores/store_1/localization/translations',
            '/stores/store_1/localization/translations/translation_1',
          ]),
        );
        expect(api.bodies['/stores/store_1/localization'], {
          'default_locale': 'hi-IN',
          'currency': 'INR',
          'timezone': 'Asia/Kolkata',
        });
      },
    );

    test('MetafieldService manages store custom fields', () async {
      final readApi = _FakeApiClient(
        json: {
          '/metafields/definitions': [_metafieldDefinitionJson()],
          '/metafields/values': _metafieldsSummaryJson(),
        },
      );
      final readService = MetafieldService(api: readApi);

      final definitions = await readService.fetchDefinitions('store_1');
      final summary = await readService.fetchValues('store_1');

      expect(definitions.single.name, 'Care instructions');
      expect(summary.definitions.single.key, 'care');
      expect(summary.values.single.value, 'Wash cold');
      expect(readApi.queries['/metafields/definitions'], {
        'store_id': 'store_1',
        'owner_type': 'store',
      });

      final writeApi = _FakeApiClient(
        json: {
          '/metafields/definitions': _metafieldDefinitionJson(),
          '/metafields/definitions/field_1': _metafieldDefinitionJson(
            name: 'Updated care instructions',
          ),
          '/metafields/values': _metafieldValueJson(),
          '/metafields/values/value_1': {'id': 'value_1'},
        },
      );
      final writeService = MetafieldService(api: writeApi);

      final created = await writeService.createDefinition('store_1', {
        'owner_type': 'store',
        'namespace': 'custom',
        'key': 'care',
        'name': 'Care instructions',
        'value_type': 'single_line_text',
      });
      final updated = await writeService.updateDefinition(
        'store_1',
        'field_1',
        {'name': 'Updated care instructions'},
      );
      await writeService.deleteDefinition('store_1', 'field_1');
      final savedValue = await writeService.upsertValue(
        storeId: 'store_1',
        definitionId: 'field_1',
        value: 'Wash cold',
      );
      await writeService.deleteValue('store_1', 'value_1');

      expect(created.key, 'care');
      expect(updated.name, 'Updated care instructions');
      expect(savedValue.value, 'Wash cold');
      expect(
        writeApi.bodies['/metafields/definitions'],
        containsPair('store_id', 'store_1'),
      );
      expect(
        writeApi.bodies['/metafields/values'],
        containsPair('definition_id', 'field_1'),
      );
    });

    test('StoreService persists mobile onboarding progress', () async {
      final api = _FakeApiClient(
        json: {
          '/onboarding/mobile-progress': {
            'attempt_id': 'attempt_1',
            'current_step': 5,
          },
        },
      );

      final response = await StoreService(api: api)
          .saveMobileOnboardingProgress(
            businessType: 'new',
            channels: ['online', 'social'],
            productType: 'physical',
            category: 'fashion',
          );

      expect(response['attempt_id'], 'attempt_1');
      expect(api.bodies['/onboarding/mobile-progress'], {
        'site_type': 'store',
        'business_type': 'new',
        'channels': ['online', 'social'],
        'product_type': 'physical',
        'category': 'fashion',
      });
    });

    test('StoreService updates business profile and invoice address', () async {
      final api = _FakeApiClient(
        json: {
          '/stores/store_1': _storeJson(
            legalName: 'Demo Private Limited',
            gstin: '27ABCDE1234F1Z5',
            gstStateCode: '27',
            invoicePrefix: 'LBY',
            invoiceAddress: {
              'line1': 'MG Road',
              'city': 'Bengaluru',
              'state': 'Karnataka',
              'zip': '560001',
              'country': 'IN',
            },
          ),
        },
      );

      final store = await StoreService(api: api).updateStore('store_1', {
        'legal_name': 'Demo Private Limited',
        'gstin': '27ABCDE1234F1Z5',
        'gst_state_code': '27',
        'invoice_prefix': 'LBY',
        'invoice_number_next': 12,
        'business_profile': {
          'legal_name': 'Demo Private Limited',
          'gstin': '27ABCDE1234F1Z5',
          'gst_state_code': '27',
        },
        'invoice_address': {
          'line1': 'MG Road',
          'city': 'Bengaluru',
          'state': 'Karnataka',
          'zip': '560001',
          'country': 'IN',
        },
      });

      expect(store.legalName, 'Demo Private Limited');
      expect(store.gstin, '27ABCDE1234F1Z5');
      expect(store.invoicePrefix, 'LBY');
      expect(store.invoiceAddress['city'], 'Bengaluru');
      expect(
        api.bodies['/stores/store_1'],
        containsPair('invoice_prefix', 'LBY'),
      );
      expect(
        api.bodies['/stores/store_1'],
        containsPair('gstin', '27ABCDE1234F1Z5'),
      );
      expect(api.paths, contains('/stores/store_1'));
    });

    test('StoreMainScreen primary tabs are operator-first', () {
      final sourceFile = [
        File(
          'apps/mobile/merchant-app/lib/screens/main/store_main_screen.dart',
        ),
        File('lib/screens/main/store_main_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();

      expect(source, contains("label: 'Home'"));
      expect(source, contains("label: 'Orders'"));
      expect(source, contains("label: 'Products'"));
      expect(source, contains("label: 'Customers'"));
      expect(source, contains("label: 'More'"));
      expect(source, contains("tooltip: 'AI store operator'"));
      expect(source, contains('showAiOperatorSheet(context)'));
      expect(source, isNot(contains("label: 'Editor'")));
      expect(source, isNot(contains("label: 'Theme'")));
    });

    testWidgets('StoreMainScreen loads each operator tab from gateway data', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'letbuyy.selected_store_id': 'store_1',
      });
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
          '/orders': [_orderJson()],
          '/products': [_productJson()],
          '/customers': [_customerJson()],
        },
        json: {
          '/mobile/dashboard': _mobileDashboardJson(
            revenueValue: 1200,
            orderValue: 4,
            productCount: 1,
            averageOrderValue: 300,
          ),
          '/customers/segments': [_customerSegmentJson()],
        },
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: _merchantShellProviders(api),
          child: const MaterialApp(
            localizationsDelegates: [AppLocalizations.delegate],
            supportedLocales: AppLocalizations.supportedLocales,
            home: StoreMainScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Performance'), findsOneWidget);
      expect(api.paths, containsAll(['/mobile/dashboard', '/orders']));
      expect(
        api.paths.where((path) => path == '/mobile/dashboard'),
        hasLength(1),
      );
      expect(api.paths, isNot(contains('/analytics/dashboard')));
      final shellContext = tester.element(find.byType(StoreMainScreen));

      await tester.tap(find.bySemanticsLabel('Orders tab'));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Orders'), findsWidgets);
      expect(
        shellContext.read<OrderService>().orders.single.orderNumber,
        'order_1',
      );

      await tester.tap(find.bySemanticsLabel('Products tab'));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Products'), findsWidgets);
      expect(
        shellContext.read<ProductService>().products.single['name'],
        'Cotton Tee',
      );

      await tester.tap(find.bySemanticsLabel('Customers tab'));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Customers'), findsWidgets);
      expect(
        shellContext.read<CustomerService>().customers.single.displayName,
        'Meera Merchant',
      );

      await tester.tap(find.bySemanticsLabel('More tab'));
      await tester.pump(const Duration(milliseconds: 250));
      expect(find.text('Store Settings'), findsOneWidget);
      expect(find.text('Store Health'), findsOneWidget);
      expect(find.textContaining('S-0'), findsNothing);
      expect(find.textContaining('backend contract'), findsNothing);

      expect(
        api.paths,
        containsAll([
          '/stores',
          '/products',
          '/customers',
          '/customers/segments',
          '/mobile/dashboard',
        ]),
      );
    });

    testWidgets('StoreMainScreen AI operator FAB opens the command sheet', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'letbuyy.selected_store_id': 'store_1',
      });
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
        json: {
          '/mobile/dashboard': _mobileDashboardJson(
            revenueValue: 0,
            orderValue: 0,
            productCount: 0,
            averageOrderValue: 0,
            topProducts: const <Map<String, dynamic>>[],
            trafficSources: const <Map<String, dynamic>>[],
          ),
        },
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: _merchantShellProviders(api),
          child: const MaterialApp(
            localizationsDelegates: [AppLocalizations.delegate],
            supportedLocales: AppLocalizations.supportedLocales,
            home: StoreMainScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.byTooltip('AI store operator'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));

      expect(find.text('AI operator'), findsOneWidget);
      expect(
        find.text('Create product "Cotton Tee" at INR 499 stock 20'),
        findsOneWidget,
      );
      expect(find.textContaining('SKIP_NEEDS_HUMAN'), findsNothing);
      expect(find.textContaining('needs backend'), findsNothing);
    });

    test('Section editor exposes AI homepage generation through draft save', () {
      final sourceFile = [
        File(
          'apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart',
        ),
        File('lib/screens/editor/section_editor_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();
      final serviceSource = [
        File('apps/mobile/merchant-app/lib/services/theme_service.dart'),
        File('lib/services/theme_service.dart'),
      ].firstWhere((file) => file.existsSync()).readAsStringSync();

      expect(source, contains('Describe your homepage'));
      expect(source, contains('_showAiHomepageSheet'));
      expect(source, contains('generateHomepageDraft'));
      expect(source, contains('themeService.saveDraft'));
      expect(source, contains('ThemeDraftConflictException'));
      expect(serviceSource, contains('Refresh the editor before saving again'));
      expect(source, isNot(contains('needs backend contract')));
      expect(source, isNot(contains('SKIP_NEEDS_HUMAN')));
    });

    test('Section editor exposes responsive preview toggle', () {
      final editor = [
        File(
          'apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart',
        ),
        File('lib/screens/editor/section_editor_screen.dart'),
      ].firstWhere((file) => file.existsSync()).readAsStringSync();
      final frame = [
        File(
          'apps/mobile/merchant-app/lib/widgets/editor/device_frames/device_frame_preview.dart',
        ),
        File('lib/widgets/editor/device_frames/device_frame_preview.dart'),
      ].firstWhere((file) => file.existsSync()).readAsStringSync();
      final preview = [
        File(
          'apps/mobile/merchant-app/lib/widgets/editor/website_preview.dart',
        ),
        File('lib/widgets/editor/website_preview.dart'),
      ].firstWhere((file) => file.existsSync()).readAsStringSync();
      final themeService = [
        File('apps/mobile/merchant-app/lib/services/theme_service.dart'),
        File('lib/services/theme_service.dart'),
      ].firstWhere((file) => file.existsSync()).readAsStringSync();

      expect(editor, contains('viewport: _deviceMode'));
      expect(editor, contains('setState(() => _deviceMode = mode)'));
      expect(frame, contains("label: 'Mobile'"));
      expect(frame, contains("label: 'Tablet'"));
      expect(frame, contains("label: 'Desktop'"));
      expect(frame, contains("widget.onDeviceChange('laptop')"));
      expect(preview, contains('oldWidget.deviceMode != widget.deviceMode'));
      expect(preview, contains('document.body.dataset.letbuyyFlutterViewport'));
      expect(
        themeService,
        contains("'viewport': _normalizeViewport(viewport)"),
      );
      expect(themeService, contains("case 'laptop':"));
      expect(themeService, contains("return 'desktop';"));
    });

    test(
      'AnalyticsScreen renders real chart widgets instead of placeholders',
      () {
        final sourceFile = [
          File(
            'apps/mobile/merchant-app/lib/screens/analytics/analytics_screen.dart',
          ),
          File('lib/screens/analytics/analytics_screen.dart'),
        ].firstWhere((file) => file.existsSync());
        final source = sourceFile.readAsStringSync();

        expect(source, contains('LineChart('));
        expect(source, contains('dailyStats'));
        expect(source, isNot(contains('Charts coming soon')));
        expect(source, isNot(contains('needs a gateway analytics endpoint')));
      },
    );

    test('Dashboard quick actions and bell navigate to real routes', () {
      final sourceFile = [
        File('apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart'),
        File('lib/screens/dashboard/home_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();

      expect(source, contains('AppRoutes.products'));
      expect(source, contains('AppRoutes.orders'));
      expect(source, contains('AppRoutes.analytics'));
      expect(source, contains('AppRoutes.storeDetails'));
      expect(source, contains('AppRoutes.notifications'));
      expect(source, isNot(contains('_showTabHint')));
      expect(source, isNot(contains('Tap the \$tabName tab below')));
    });

    test('OrdersScreen print action loads a real packing slip', () {
      final sourceFile = [
        File('apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart'),
        File('lib/screens/orders/orders_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();

      expect(source, contains('fetchPackingSlip'));
      expect(source, contains('_showPackingSlipDialog'));
      expect(source, isNot(contains('Print coming soon')));
    });

    test('OrdersScreen creates and converts draft orders from the toolbar', () {
      final sourceFile = [
        File('apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart'),
        File('lib/screens/orders/orders_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();

      expect(source, contains('_createDraftOrder'));
      expect(source, contains('createDraftOrder'));
      expect(source, contains('convertDraftOrder'));
      expect(source, contains('Create order now'));
      expect(source, isNot(contains('Draft order coming soon')));
    });

    test('OrdersScreen cancellation requires a reason', () {
      final sourceFile = [
        File('apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart'),
        File('lib/screens/orders/orders_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();

      expect(source, contains('_showCancelReasonDialog'));
      expect(source, contains('Cancellation reason'));
      expect(source, contains('cancelOrder(order.id, reason: reason)'));
      expect(
        source,
        isNot(contains("updateOrderStatus(order.id, status: 'cancelled'")),
      );
    });

    test(
      'StoreDetailsScreen uploads logos instead of showing placeholder copy',
      () {
        final sourceFile = [
          File(
            'apps/mobile/merchant-app/lib/screens/settings/store_details_screen.dart',
          ),
          File('lib/screens/settings/store_details_screen.dart'),
        ].firstWhere((file) => file.existsSync());
        final source = sourceFile.readAsStringSync();

        expect(source, contains('uploadStoreAsset'));
        expect(source, contains('showImageSourceSheet'));
        expect(source, contains("'logo_url': logoUrl"));
        expect(source, isNot(contains('Logo upload coming soon')));
      },
    );

    test('StoreDetailsScreen exposes business profile fields', () {
      final sourceFile = [
        File(
          'apps/mobile/merchant-app/lib/screens/settings/store_details_screen.dart',
        ),
        File('lib/screens/settings/store_details_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final routesFile = [
        File('apps/mobile/merchant-app/lib/app/routes.dart'),
        File('lib/app/routes.dart'),
      ].firstWhere((file) => file.existsSync());
      final blockedFile = [
        File(
          'apps/mobile/merchant-app/lib/services/platform_blocked_service.dart',
        ),
        File('lib/services/platform_blocked_service.dart'),
      ].firstWhere((file) => file.existsSync());
      final source = sourceFile.readAsStringSync();
      final routes = routesFile.readAsStringSync();
      final blocked = blockedFile.readAsStringSync();

      expect(source, contains('Business Profile'));
      expect(source, contains("'business_profile': businessProfile"));
      expect(source, contains("'invoice_address': invoiceAddress"));
      expect(routes, contains("'/features/business-details'"));
      expect(routes, contains('StoreDetailsScreen'));
      expect(blocked, isNot(contains('S-024')));
      expect(blocked, isNot(contains('MOBILE_BUSINESS_DETAILS')));
      expect(source, isNot(contains('backend contract')));
    });

    testWidgets('StoreDetailsScreen validates and saves business fields', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
        json: {'/stores/store_1': _storeJson(name: 'Demo Store Plus')},
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: _storeProviders(api),
          child: const MaterialApp(home: StoreDetailsScreen()),
        ),
      );
      await tester.pumpAndSettle();

      Future<void> enterField(
        Key key,
        String value, {
        bool scrollUp = false,
      }) async {
        final finder = find.byKey(key);
        final listView = find.byType(ListView);
        for (var i = 0; i < 20 && finder.evaluate().isEmpty; i++) {
          await tester.drag(listView, Offset(0, scrollUp ? 260 : -260));
          await tester.pump();
        }
        expect(finder, findsOneWidget);
        await tester.ensureVisible(finder);
        await tester.enterText(finder, value);
        await tester.pump();
      }

      await enterField(const ValueKey('store-details-name-field'), 'A');
      await enterField(const ValueKey('store-details-gstin-field'), 'bad');
      await enterField(
        const ValueKey('store-details-invoice-number-field'),
        '0',
      );
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pump();

      expect(find.text('Check the highlighted fields.'), findsOneWidget);
      expect(api.bodies.containsKey('/stores/store_1'), isFalse);

      await enterField(
        const ValueKey('store-details-name-field'),
        'Demo Store Plus',
        scrollUp: true,
      );
      await enterField(
        const ValueKey('store-details-gstin-field'),
        '27ABCDE1234F1Z5',
      );
      await enterField(const ValueKey('store-details-gst-state-field'), '27');
      await enterField(
        const ValueKey('store-details-invoice-prefix-field'),
        'lby-26',
      );
      await enterField(
        const ValueKey('store-details-invoice-number-field'),
        '12',
      );
      await enterField(const ValueKey('store-details-pin-field'), '560001');
      await enterField(const ValueKey('store-details-country-field'), 'IN');
      await enterField(
        const ValueKey('store-details-phone-field'),
        '+91 98765-43210',
      );

      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      for (
        var i = 0;
        i < 10 && !api.bodies.containsKey('/stores/store_1');
        i++
      ) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      final body = Map<String, dynamic>.from(
        api.bodies['/stores/store_1']! as Map,
      );
      final businessProfile = Map<String, dynamic>.from(
        body['business_profile']! as Map,
      );
      final invoiceAddress = Map<String, dynamic>.from(
        body['invoice_address']! as Map,
      );
      expect(body['name'], 'Demo Store Plus');
      expect(body['gstin'], '27ABCDE1234F1Z5');
      expect(body['invoice_prefix'], 'LBY-26');
      expect(body['invoice_number_next'], 12);
      expect(businessProfile['gst_state_code'], '27');
      expect(invoiceAddress['zip'], '560001');
      expect(invoiceAddress['phone'], '+919876543210');
    });

    test('Taxes feature routes to the real tax settings screen', () {
      final routesFile = [
        File('apps/mobile/merchant-app/lib/app/routes.dart'),
        File('lib/app/routes.dart'),
      ].firstWhere((file) => file.existsSync());
      final blockedFile = [
        File(
          'apps/mobile/merchant-app/lib/services/platform_blocked_service.dart',
        ),
        File('lib/services/platform_blocked_service.dart'),
      ].firstWhere((file) => file.existsSync());
      final routes = routesFile.readAsStringSync();
      final blocked = blockedFile.readAsStringSync();

      expect(routes, contains("'/features/taxes'"));
      expect(routes, contains('TaxesScreen'));
      expect(routes, isNot(contains('MerchantFeatureDefinitions')));
      expect(blocked, isNot(contains('MOBILE_TAXES')));
      expect(blocked, isNot(contains("title: 'Taxes")));
      expect(
        [
          File(
            'apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart',
          ),
          File('lib/screens/parity/merchant_feature_definitions.dart'),
        ].any((file) => file.existsSync()),
        isFalse,
      );
    });

    test('AppRoutes resolves routes through typed registry', () {
      final routesFile = [
        File('apps/mobile/merchant-app/lib/app/routes.dart'),
        File('lib/app/routes.dart'),
      ].firstWhere((file) => file.existsSync());
      final routes = routesFile.readAsStringSync();

      expect(routes, contains('enum AppRouteId'));
      expect(routes, contains('class AppRouteSpec'));
      expect(routes, contains('_routesByPath'));
      expect(routes, isNot(contains('switch (settings.name)')));
      expect(routes, isNot(contains('if (settings.name ==')));
      expect(AppRoutes.pathFor(AppRouteId.orders), AppRoutes.orders);
      expect(
        AppRoutes.pathFor(AppRouteId.featurePayoutsSettlement),
        '/features/payouts-settlement',
      );
      expect(
        AppRoutes.routeFor(AppRoutes.orderDetail)?.id,
        AppRouteId.orderDetail,
      );
      expect(
        AppRoutes.routeFor('/features/custom-data')?.id,
        AppRouteId.featureCustomData,
      );
      expect(AppRoutes.isKnownRoute('/features/localization-markets'), isTrue);
      expect(AppRoutes.isKnownRoute('/not-a-route'), isFalse);
    });

    test('ProductService keeps canonical ProductContract payloads', () async {
      final api = _FakeApiClient(
        paginated: {
          '/products': [_productJson()],
        },
      );

      final products = await ProductService(api: api).fetchProducts('store_1');

      expect(products.single['store_id'], 'store_1');
      expect(products.single.containsKey('salePrice'), isFalse);
    });

    test('high-volume lists preserve cursor pagination metadata', () async {
      final api = _FakeApiClient(
        paginated: {
          '/products': [_productJson()],
          '/orders': [_orderJson()],
          '/customers': [_customerJson()],
        },
        paginatedMeta: {
          '/products': {
            'page': 1,
            'per_page': 1,
            'total': 2,
            'has_next': true,
            'next_cursor': 'products_cursor_2',
          },
          '/orders': {
            'page': 1,
            'per_page': 1,
            'total': 2,
            'has_next': true,
            'next_cursor': 'orders_cursor_2',
          },
          '/customers': {
            'page': 1,
            'per_page': 1,
            'total': 2,
            'has_next': true,
            'next_cursor': 'customers_cursor_2',
          },
        },
      );

      final products = ProductService(api: api);
      final orders = OrderService(api: api);
      final customers = CustomerService(api: api);

      await products.fetchProducts(
        'store_1',
        limit: 1,
        cursor: 'products_cursor_1',
      );
      await orders.fetchOrders('store_1', limit: 1, cursor: 'orders_cursor_1');
      await customers.fetchCustomers(
        'store_1',
        limit: 1,
        cursor: 'customers_cursor_1',
      );

      expect(
        api.queries['/products'],
        containsPair('cursor', 'products_cursor_1'),
      );
      expect(api.queries['/orders'], containsPair('cursor', 'orders_cursor_1'));
      expect(
        api.queries['/customers'],
        containsPair('cursor', 'customers_cursor_1'),
      );
      expect(products.productsNextCursor, 'products_cursor_2');
      expect(orders.ordersNextCursor, 'orders_cursor_2');
      expect(customers.customersNextCursor, 'customers_cursor_2');
    });

    test('ProductService falls back to cached products when offline', () async {
      final cache = CacheService.memory();
      await ProductService(
        api: _FakeApiClient(
          paginated: {
            '/products': [_productJson()],
          },
        ),
        cache: cache,
      ).fetchProducts('store_1');

      final products = await ProductService(
        api: _ThrowingApiClient(),
        cache: cache,
      ).fetchProducts('store_1');

      expect(products.single['id'], 'prod_1');
      expect(products.single['name'], 'Cotton Tee');
    });

    test(
      'ProductService falls back to cached product detail when offline',
      () async {
        final cache = CacheService.memory();
        await ProductService(
          api: _FakeApiClient(json: {'/products/prod_1': _productJson()}),
          cache: cache,
        ).fetchProduct('prod_1');

        final product = await ProductService(
          api: _ThrowingApiClient(),
          cache: cache,
        ).fetchProduct('prod_1');

        expect(product['id'], 'prod_1');
        expect(product['name'], 'Cotton Tee');
      },
    );

    test(
      'ProductService sends variant matrix rows in create payload',
      () async {
        final api = _FakeApiClient(
          json: {
            '/products': _productJson(variants: [_variantJson()]),
          },
        );
        final service = ProductService(api: api);

        await service.createProduct(
          storeId: 'store_1',
          name: 'Cotton Tee',
          description: 'Variant test',
          price: 499,
          sku: 'TEE-BASE',
          barcode: '8901234567890',
          urlHandle: 'cotton-tee',
          seoTitle: 'Cotton Tee India',
          seoDescription: 'Premium cotton tee for daily wear.',
          stock: 10,
          images: ['https://cdn.test/products/tee.jpg'],
          productType: 'T-shirt',
          vendor: 'LetBuyy Basics',
          countryOfOrigin: ' Japan ',
          importerDetails: ' Example Imports, Mumbai ',
          tags: const ['cotton', 'summer'],
          metadata: const {
            'specifications': {'Material': 'Cotton'},
          },
          variants: [_variantJson()],
        );

        final body = api.bodies['/products'] as Map<String, dynamic>;
        final variants = body['variants'] as List<Map<String, dynamic>>;
        expect(body['sku'], 'TEE-BASE');
        expect(body['barcode'], '8901234567890');
        expect(body['url_handle'], 'cotton-tee');
        expect(body['seo_title'], 'Cotton Tee India');
        expect(body['seo_description'], 'Premium cotton tee for daily wear.');
        expect(body['product_type'], 'T-shirt');
        expect(body['vendor'], 'LetBuyy Basics');
        expect(body['country_of_origin'], 'Japan');
        expect(body['importer_details'], 'Example Imports, Mumbai');
        expect(body['tags'], ['cotton', 'summer']);
        expect(body['metadata'], {
          'specifications': {'Material': 'Cotton'},
        });
        expect(variants.single['sku'], 'TEE-XL');
        expect(variants.single['price'], 599);
        expect(variants.single['stock'], 4);
        expect(variants.single['options'], {'Size': 'XL'});
      },
    );

    test(
      'ProductService seeds clearly labeled inactive sample product',
      () async {
        final api = _FakeApiClient(
          json: {'/products/sample': _sampleProductJson()},
        );
        final service = ProductService(api: api);

        final product = await service.seedSampleProduct('store_1');

        expect(api.bodies['/products/sample'], {'store_id': 'store_1'});
        expect(product['name'], 'Sample Product - Cotton Tote');
        expect(product['is_active'], isFalse);
        expect(product['tags'], contains('sample'));
        expect(service.products.single['sku'], 'LETBUYY-SAMPLE-PRODUCT');
      },
    );

    test(
      'InventoryService resolves barcodes and adjusts scanned stock',
      () async {
        final api = _FakeApiClient(
          json: {
            '/products/barcode/lookup': {
              'store_id': 'store_1',
              'barcode': '8901234567890',
              'matched_field': 'variant.barcode',
              'product': _productJson(),
              'variant': {
                'id': 'variant_1',
                'product_id': 'prod_1',
                'title': 'XL',
                'sku': 'TEE-XL',
                'barcode': '8901234567890',
              },
            },
            '/inventory/adjust': _inventoryJson(available: 14),
          },
        );
        final service = InventoryService(api: api);

        final lookup = await service.lookupBarcode(
          storeId: 'store_1',
          barcode: ' 8901234567890 ',
        );
        expect(lookup, isNotNull);
        expect(lookup!.productId, 'prod_1');
        expect(lookup.variantId, 'variant_1');
        expect(lookup.sku, 'TEE-XL');

        final adjusted = await service.adjustScannedStock(
          storeId: 'store_1',
          lookup: lookup,
          delta: 4,
          reason: 'recount',
          locationId: 'main',
          note: 'Cycle count',
        );

        expect(adjusted.available, 14);
        expect(api.paths, contains('/products/barcode/lookup'));
        expect(api.paths, contains('/inventory/adjust'));
        expect(
          api.bodies['/inventory/adjust'],
          containsPair('variant_id', 'variant_1'),
        );
      },
    );

    test(
      'ProductService lists, creates, updates, and deletes collections',
      () async {
        final api = _FakeApiClient(
          json: {
            '/products/collections': [_collectionJson()],
            '/products/collections/collection_1': _collectionJson(
              title: 'Updated',
            ),
            '/export/products': {
              'job': {'id': 'export_1', 'status': 'queued'},
            },
            '/export/jobs/export_1': {
              'job': {
                'id': 'export_1',
                'status': 'completed',
                'download_url':
                    'https://gateway.test/v1/export/jobs/export_1/download?token=test',
              },
            },
          },
        );
        final service = ProductService(api: api);

        final collections = await service.fetchCollections('store_1');
        final created = await service.createCollection(
          const ProductCollectionInput(
            storeId: 'store_1',
            title: 'Summer picks',
            description: 'Seasonal merchandising',
          ),
        );

        expect(collections.single.title, 'Summer picks');
        expect(created.handle, 'summer-picks');
        expect(api.paths, contains('/products/collections'));
        final updated = await service.updateCollection(
          'collection_1',
          const ProductCollectionInput(storeId: 'store_1', title: 'Updated'),
        );
        await service.deleteCollection('collection_1');
        final export = await service.exportProducts('store_1');
        final exportJob = await service.fetchExportJob('export_1');

        expect(updated.title, 'Updated');
        expect((export['job'] as Map)['id'], 'export_1');
        expect((exportJob['job'] as Map)['status'], 'completed');
        expect(api.paths, contains('/products/collections/collection_1'));
        expect(api.paths, contains('/export/products'));
        expect(api.paths, contains('/export/jobs/export_1'));
        expect(
          api.bodies['/products/collections/collection_1'],
          containsPair('title', 'Updated'),
        );
      },
    );

    test('ProductService lists and issues gift cards', () async {
      final api = _FakeApiClient(
        json: {
          '/products/gift-cards': [_giftCardJson()],
        },
      );
      final service = ProductService(api: api);

      final cards = await service.fetchGiftCards('store_1');
      final issued = await service.issueGiftCard(
        const GiftCardInput(storeId: 'store_1', initialValue: 500),
      );

      expect(cards.single.code, 'GIFT-1234');
      expect(cards.single.balanceLabel, 'INR 250.00');
      expect(issued.initialValueLabel, 'INR 500.00');
      expect(api.paths, contains('/products/gift-cards'));
      expect(
        api.bodies['/products/gift-cards'],
        containsPair('initial_value', 500),
      );
    });

    test('OrderService fetches typed orders and status counts', () async {
      final api = _FakeApiClient(
        paginated: {
          '/orders': [
            _orderJson(
              status: 'paid',
              riskScore: 68,
              riskLevel: 'high',
              fulfillmentState: 'hold',
            ),
            _orderJson(id: 'order_2', status: 'paid'),
          ],
        },
      );
      final service = OrderService(api: api);

      final orders = await service.fetchOrders('store_1');

      expect(orders, hasLength(2));
      expect(orders.first.riskScore, 68);
      expect(orders.first.riskLevel, 'high');
      expect(orders.first.fulfillmentState, 'hold');
      expect(service.statusCounts['paid'], 2);
    });

    test('OrderService starts and reads order CSV export jobs', () async {
      final api = _FakeApiClient(
        json: {
          '/export/orders': {
            'job': {
              'id': 'export_orders_1',
              'type': 'orders',
              'status': 'completed',
              'row_count': 2,
              'filename': 'orders.csv',
              'download_url': 'https://gateway.test/v1/export/jobs/1/download',
            },
          },
          '/export/jobs/export_orders_1': {
            'job': {
              'id': 'export_orders_1',
              'type': 'orders',
              'status': 'completed',
              'row_count': 2,
              'filename': 'orders.csv',
              'download_url': 'https://gateway.test/v1/export/jobs/1/download',
            },
          },
        },
      );
      final service = OrderService(api: api);

      final created = await service.exportOrders('store_1', status: 'paid');
      final latest = await service.fetchExportJob('export_orders_1');

      expect(created['job']['status'], 'completed');
      expect(latest['job']['filename'], 'orders.csv');
      expect(api.paths, contains('/export/orders'));
      expect(api.paths, contains('/export/jobs/export_orders_1'));
      expect(api.queries['/export/orders']?['store_id'], 'store_1');
      expect(api.queries['/export/orders']?['status'], 'paid');
    });

    test('OrderService syncs the app icon badge from open orders', () async {
      final channel = MethodChannel('com.letbuyy.store/app_badge_test');
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            calls.add(call);
            return null;
          });
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, null);
      });
      final api = _FakeApiClient(
        paginated: {
          '/orders': [
            _orderJson(status: 'pending'),
            _orderJson(id: 'order_2', status: 'confirmed'),
            _orderJson(id: 'order_3', status: 'delivered'),
            _orderJson(id: 'order_4', status: 'refunded'),
          ],
        },
      );
      final service = OrderService(
        api: api,
        appBadgeService: AppBadgeService(channel: channel),
      );

      await service.fetchOrders('store_1');

      expect(service.openOrderCount, 2);
      expect(calls.single.method, 'setBadgeCount');
      expect(calls.single.arguments, {'count': 2});
    });

    test('OrderService falls back to cached orders when offline', () async {
      final cache = CacheService.memory();
      await OrderService(
        api: _FakeApiClient(
          paginated: {
            '/orders': [_orderJson(status: 'paid')],
          },
        ),
        cache: cache,
      ).fetchOrders('store_1');

      final orders = await OrderService(
        api: _ThrowingApiClient(),
        cache: cache,
      ).fetchOrders('store_1');

      expect(orders.single.id, 'order_1');
      expect(orders.single.status, 'paid');
    });

    test(
      'OrderService falls back to cached order detail when offline',
      () async {
        final cache = CacheService.memory();
        await OrderService(
          api: _FakeApiClient(json: {'/orders/order_1': _orderJson()}),
          cache: cache,
        ).fetchOrder('order_1');

        final order = await OrderService(
          api: _ThrowingApiClient(),
          cache: cache,
        ).fetchOrder('order_1');

        expect(order.id, 'order_1');
        expect(order.status, 'paid');
      },
    );

    test('OrderService reads cached detail without refetching', () async {
      final cache = CacheService.memory();
      final api = _FakeApiClient(
        paginated: {
          '/orders': [_orderJson(status: 'paid')],
        },
      );
      final service = OrderService(api: api, cache: cache);

      await service.fetchOrders('store_1');
      api.paths.clear();
      final cached = service.cachedOrder('order_1');

      expect(cached?.id, 'order_1');
      expect(cached?.status, 'paid');
      expect(api.paths, isEmpty);
    });

    test('OrderService fetches detail and refund lifecycle routes', () async {
      var contextEpoch = 1;
      final storage = MemoryStorage();
      final transportErrors = <String, ApiException>{};
      final api = _FakeApiClient(
        contextVersionProvider: () => contextEpoch,
        errors: transportErrors,
        paginated: {
          '/orders/drafts': [_draftOrderJson()],
        },
        json: {
          '/orders/order_1': _orderJson(),
          '/orders/order_1/fulfill': _orderJson(status: 'shipped'),
          '/orders/order_1/line-items': _orderJson(status: 'paid'),
          '/orders/order_1/packing-slip': {
            'order_id': 'order_1',
            'order_number': 'order_1',
            'text': 'Packing slip\nOrder: order_1',
            'html': '<h1>Packing slip</h1>',
            'filename': 'packing-slip-order_1.pdf',
            'content_type': 'application/pdf',
            'pdf_base64': 'JVBERi0xLjQK',
          },
          '/shipping/labels/rates': {
            'rates': [
              {'provider': 'shiprocket', 'amount': 60, 'currency': 'INR'},
            ],
          },
          '/shipping/labels': {
            'label': {
              'id': 'label_1',
              'tracking_number': 'SRORDER1',
              'carrier': 'Shiprocket',
              'pdf_base64': 'JVBERi0xLjQK',
            },
          },
          '/orders/drafts': _draftOrderJson(),
          '/orders/drafts/draft_1/convert': {
            'draft_order': _draftOrderJson(status: 'converted'),
            'order': _orderJson(status: 'pending'),
          },
          '/orders/order_1/refund': {
            'order': _orderJson(status: 'refund_pending'),
            'status': 'pending',
            'refund_id': 'refund_1',
            'return_id': 'return_1',
            'refund_amount': 499,
          },
          '/orders/order_1/refund/complete': {
            'order': _orderJson(status: 'refunded'),
            'refund': {'id': 'refund_1', 'status': 'succeeded'},
          },
          '/security/step-up/challenges': _controlledRefundProofJson(),
        },
      );
      final service = OrderService(
        api: api,
        securityCommands: SecurityCommandStore(storage: storage),
      );

      final detail = await service.fetchOrder('order_1');
      final shipped = await service.fulfillOrder(
        'order_1',
        createShippingLabel: true,
        logisticsProvider: 'shiprocket',
        packageWeightGrams: 750,
        packageLengthCm: 12,
        packageWidthCm: 10,
        packageHeightCm: 6,
        idempotencyKey: 'test-fulfill-key',
      );
      final edited = await service.updateLineItems(
        'order_1',
        lines: const [
          {'order_item_id': 'line_1', 'quantity': 2},
        ],
        idempotencyKey: 'test-line-items-key',
      );
      final packingSlip = await service.fetchPackingSlip('order_1');
      final rates = await service.fetchShippingLabelRates(
        'order_1',
        packageWeightGrams: 750,
      );
      final label = await service.buyShippingLabel(
        'order_1',
        packageWeightGrams: 750,
        idempotencyKey: 'test-label-key',
      );
      final drafts = await service.fetchDraftOrders('store_1');
      final draft = await service.createDraftOrder(
        storeId: 'store_1',
        customerName: 'Meera Merchant',
        customerEmail: 'meera@example.com',
        items: const [
          {'product_id': 'product_1', 'quantity': 2},
        ],
        idempotencyKey: 'test-draft-key',
      );
      final converted = await service.convertDraftOrder(
        'draft_1',
        idempotencyKey: 'test-draft-convert-key',
      );
      final security = _contractTwoFactor(api, storage);
      final captured = security.capture();
      const refundLines = <JsonMap>[
        {'order_item_id': 'line_1', 'quantity': 1},
      ];
      Future<OrderContract> requestRefund() => service.refundOrder(
        'order_1',
        context: captured,
        lines: refundLines,
        reason: 'Customer requested return',
      );
      transportErrors['/orders/order_1/refund'] = const ApiException(
        message: 'Controlled reply loss', statusCode: 503,
        code: 'CONTROLLED_REPLY_LOSS',
      );
      await expectLater(requestRefund(), throwsA(isA<ApiException>()));
      final originalRequestKey =
          api.requestOptions['/orders/order_1/refund']!.single!.idempotencyKey;
      transportErrors.remove('/orders/order_1/refund');
      final requested = await requestRefund();
      expect(requested.status, 'refund_pending');
      final approval = await _contractRefundApproval(security);
      final completed = await service.completeRefund(
        'order_1',
        approval: approval,
        refundId: 'refund_1',
        providerRefundId: 'rfnd_1',
      );

      expect(detail.id, 'order_1');
      expect(shipped.status, 'shipped');
      expect(edited.id, 'order_1');
      expect(packingSlip['text'], contains('Packing slip'));
      expect(packingSlip['content_type'], 'application/pdf');
      expect((rates['rates'] as List).single['amount'], 60);
      expect((label['label'] as Map)['tracking_number'], 'SRORDER1');
      expect(drafts.single['id'], 'draft_1');
      expect(draft['id'], 'draft_1');
      expect(converted.id, 'order_1');
      expect(completed.status, 'refunded');
      expect(api.bodies['/orders/order_1/refund'], {
        'lines': refundLines,
        'reason': 'Customer requested return',
        'idempotency_key': originalRequestKey,
      });
      expect(originalRequestKey, matches(RegExp(r'^[a-zA-Z0-9-]{8,200}$')));
      expect(api.requestOptions['/orders/order_1/refund']!
          .every((o) => o!.idempotencyKey == originalRequestKey &&
              o.storeId == 'store_1' && o.expectedContextVersion == 1), isTrue);
      final completionOptions =
          api.requestOptions['/orders/order_1/refund/complete']!.single!;
      expect(api.bodies['/orders/order_1/refund/complete'], {
        'refund_id': 'refund_1', 'provider_refund_id': 'rfnd_1',
        'idempotency_key': completionOptions.idempotencyKey,
      });
      _expectContractApproval(completionOptions, approval);
      expect(storage.data.values.join(), isNot(contains(approval.token)));
      final beforeStale = api.paths.length;
      contextEpoch++;
      expect(() => service.completeRefund('order_1', approval: approval,
          refundId: 'refund_1'), throwsA(isA<ApiException>().having(
            (e) => e.code, 'code', 'SESSION_CONTEXT_CHANGED')));
      expect(api.paths.length, beforeStale);
      await expectLater(requestRefund(), throwsA(isA<ApiException>().having(
          (e) => e.code, 'code', 'SESSION_CONTEXT_CHANGED')));
      expect(api.paths.length, beforeStale);
      expect(api.paths, contains('/orders/order_1'));
      expect(api.paths, contains('/orders/order_1/fulfill'));
      expect(api.paths, contains('/orders/order_1/line-items'));
      expect(api.paths, contains('/orders/order_1/packing-slip'));
      expect(api.paths, contains('/shipping/labels/rates'));
      expect(api.paths, contains('/shipping/labels'));
      expect(api.paths, contains('/orders/drafts'));
      expect(api.paths, contains('/orders/drafts/draft_1/convert'));
      expect(api.paths, contains('/orders/order_1/refund'));
      expect(api.paths, contains('/orders/order_1/refund/complete'));
      expect(api.bodies['/orders/order_1/fulfill'], {
        'idempotency_key': 'test-fulfill-key',
        'create_shipping_label': true,
        'logistics_provider': 'shiprocket',
        'package_weight_grams': 750,
        'package_dimensions_cm': {'length': 12.0, 'width': 10.0, 'height': 6.0},
      });
      expect(api.bodies['/orders/order_1/line-items'], {
        'idempotency_key': 'test-line-items-key',
        'lines': [
          {'order_item_id': 'line_1', 'quantity': 2},
        ],
        'add_items': [],
        'remove_line_item_ids': [],
      });
      expect(
        api.bodies['/shipping/labels'],
        containsPair('idempotency_key', 'test-label-key'),
      );
      expect(
        api.bodies['/orders/drafts'],
        containsPair('idempotency_key', 'test-draft-key'),
      );
      expect(
        api.bodies['/orders/drafts/draft_1/convert'],
        containsPair('idempotency_key', 'test-draft-convert-key'),
      );
    });

    test('OrderService cancels orders with a reason payload', () async {
      final api = _FakeApiClient(
        json: {'/orders/order_1': _orderJson(status: 'cancelled')},
      );
      final service = OrderService(api: api);

      final order = await service.cancelOrder(
        'order_1',
        reason: 'Customer requested cancellation',
        idempotencyKey: 'cancel-key',
      );

      expect(order.status, 'cancelled');
      expect(api.bodies['/orders/order_1'], {
        'idempotency_key': 'cancel-key',
        'status': 'cancelled',
        'cancellation_reason': 'Customer requested cancellation',
      });
    });

    test('ReturnService manages RMA lifecycle routes', () async {
      var contextEpoch = 1;
      final storage = MemoryStorage();
      final transportErrors = <String, ApiException>{};
      final api = _FakeApiClient(
        contextVersionProvider: () => contextEpoch,
        errors: transportErrors,
        paginated: {
          '/returns': [_returnJson()],
        },
        json: {
          '/returns': _returnJson(status: 'approved'),
          '/returns/return_1': _returnJson(status: 'received'),
          '/returns/return_1/refund/complete': _returnJson(status: 'refunded'),
          '/security/step-up/challenges': _controlledRefundProofJson(),
        },
      );
      final service = ReturnService(
        api: api,
        securityCommands: SecurityCommandStore(storage: storage),
      );

      final rows = await service.fetchReturns('store_1');
      final created = await service.createReturn(
        orderId: 'order_1',
        reason: 'Wrong size',
        restock: true,
        idempotencyKey: 'return-create-123',
      );
      final received = await service.updateStatus(
        'return_1',
        status: 'received',
      );
      final security = _contractTwoFactor(api, storage);
      final approval = await _contractRefundApproval(security);
      Future<MerchantReturn> complete() => service.completeRefund(
        'return_1',
        approval: approval,
        refundId: 'refund_1',
        providerRefundId: 'rfnd_1',
      );
      transportErrors['/returns/return_1/refund/complete'] = const ApiException(
        message: 'Controlled reply loss', statusCode: 503,
        code: 'CONTROLLED_REPLY_LOSS',
      );
      await expectLater(complete(), throwsA(isA<ApiException>()));
      final originalKey = api.requestOptions[
          '/returns/return_1/refund/complete']!.single!.idempotencyKey;
      transportErrors.remove('/returns/return_1/refund/complete');
      final refunded = await complete();

      expect(rows.single.id, 'return_1');
      expect(created.status, 'approved');
      expect(received.status, 'received');
      expect(refunded.status, 'refunded');
      expect(refunded.refundAmount, 499);
      expect(api.bodies['/returns/return_1/refund/complete'], {
        'refund_id': 'refund_1', 'provider_refund_id': 'rfnd_1',
        'idempotency_key': originalKey,
      });
      expect(originalKey, matches(RegExp(r'^[a-zA-Z0-9-]{8,200}$')));
      for (final options in api.requestOptions[
          '/returns/return_1/refund/complete']!) {
        expect(options!.idempotencyKey, originalKey);
        _expectContractApproval(options, approval);
      }
      expect(storage.data.values.join(), isNot(contains(approval.token)));
      final beforeStale = api.paths.length;
      contextEpoch++;
      expect(() => service.completeRefund('return_1', approval: approval,
          refundId: 'refund_1'), throwsA(isA<ApiException>().having(
            (e) => e.code, 'code', 'SESSION_CONTEXT_CHANGED')));
      expect(api.paths.length, beforeStale);
      expect(api.paths, contains('/returns'));
      expect(api.paths, contains('/returns/return_1'));
      expect(api.paths, contains('/returns/return_1/refund/complete'));
      expect(api.bodies['/returns'], containsPair('restock', true));
      expect(
        api.bodies['/returns/return_1/refund/complete'],
        containsPair('provider_refund_id', 'rfnd_1'),
      );
    });

    test(
      'MoneyService manages payouts, wallet, commission, and COD routes',
      () async {
        final api = _FakeApiClient(
          json: {
            '/payouts': {
              'payouts': [_payoutJson()],
              'summary': _payoutSummaryJson(),
            },
            '/payouts/summary': _payoutSummaryJson(),
            '/payouts/payout_1': {
              ..._payoutJson(),
              'source_order_lineage': [
                {
                  'order_id': 'order_1',
                  'source_order_gross_minor': 10000,
                  'canonical_merchant_payable_delta_minor': 9000,
                  'lineage_status': 'linked',
                  'ledger_transactions': [
                    {
                      'source_type': 'payment_capture',
                      'merchant_payable_delta_minor': 9000,
                    },
                  ],
                },
              ],
            },
            '/wallet': _walletJson(),
            '/commission': _commissionJson(),
            '/commission/reconcile': {
              'created': 1,
              'overview': _commissionJson(),
            },
            '/cod/reconciliation': {
              ..._codJson(),
              'entry': (_codJson()['entries'] as List).single,
            },
            '/cod/reconciliation/cod_1/reconcile': {
              'entry': (_codJson()['entries'] as List).single,
            },
            '/payouts/payout_1/settle': _payoutJson(status: 'released'),
          },
        );
        final createApi = _FakeApiClient(
          json: {'/payouts': _payoutJson(), '/wallet': _walletJson()},
        );
        final service = MoneyService(api: api);
        final createService = MoneyService(api: createApi);

        final payouts = await service.fetchPayouts('store_1');
        final summary = await service.fetchPayoutSummary('store_1');
        final payoutDetail = await service.fetchPayoutStatement('payout_1');
        final wallet = await service.fetchWallet('store_1');
        final commission = await service.fetchCommission('store_1');
        final cod = await service.fetchCodReconciliation('store_1');
        final created = await createService.createPayoutStatement('store_1');
        final settled = await service.settlePayout('payout_1', 'store_1');
        final reconciled = await service.reconcileCommission('store_1');
        final collected = await service.collectCodOrder(
          'store_1',
          'order_1',
          collectedAmountMinor: 300000,
        );
        final codReconciled = await service.reconcileCodEntry(
          'store_1',
          'cod_1',
          depositedAmountMinor: 300000,
        );

        expect((payouts['payouts'] as List).single['id'], 'payout_1');
        expect(summary['next_payout']['id'], 'payout_1');
        expect(
          payoutDetail['source_order_lineage'][0]['lineage_status'],
          'linked',
        );
        expect(wallet['available_minor'], 250000);
        expect(commission['schedule']['commission_bps'], 0);
        expect(cod['summary']['expected_amount_minor'], 300000);
        expect(created['id'], 'payout_1');
        expect(settled['status'], 'released');
        expect(reconciled['created'], 1);
        expect(collected['entry']['id'], 'cod_1');
        expect(codReconciled['entry']['id'], 'cod_1');
        expect(api.paths, contains('/payouts'));
        expect(api.paths, contains('/payouts/summary'));
        expect(api.paths, contains('/payouts/payout_1'));
        expect(api.paths, contains('/wallet'));
        expect(api.paths, contains('/commission'));
        expect(api.paths, contains('/commission/reconcile'));
        expect(api.paths, contains('/cod/reconciliation'));
        expect(api.paths, contains('/cod/reconciliation/cod_1/reconcile'));
        expect(api.paths, contains('/payouts/payout_1/settle'));
        expect(
          createApi.bodies['/payouts'],
          containsPair('store_id', 'store_1'),
        );
        expect(
          api.bodies['/payouts/payout_1/settle'],
          contains('idempotency_key'),
        );
        expect(
          api.bodies['/commission/reconcile'],
          containsPair('store_id', 'store_1'),
        );
        expect(
          api.bodies['/cod/reconciliation'],
          containsPair('order_id', 'order_1'),
        );
        expect(
          api.bodies['/cod/reconciliation/cod_1/reconcile'],
          containsPair('deposited_amount_minor', 300000),
        );
      },
    );

    test('Money feature routes replace platform-blocked seams', () {
      final routesFile = [
        File('apps/mobile/merchant-app/lib/app/routes.dart'),
        File('lib/app/routes.dart'),
      ].firstWhere((file) => file.existsSync());
      final blockedFile = [
        File(
          'apps/mobile/merchant-app/lib/services/platform_blocked_service.dart',
        ),
        File('lib/services/platform_blocked_service.dart'),
      ].firstWhere((file) => file.existsSync());
      final moneyFile = [
        File('apps/mobile/merchant-app/lib/screens/money/money_screen.dart'),
        File('lib/screens/money/money_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final routes = routesFile.readAsStringSync();
      final blocked = blockedFile.readAsStringSync();
      final money = moneyFile.readAsStringSync();

      expect(routes, contains("'/features/payouts-settlement'"));
      expect(routes, contains('MoneyScreen(initialTab: 0)'));
      expect(routes, contains("'/features/wallet'"));
      expect(routes, contains('MoneyScreen(initialTab: 1)'));
      expect(routes, contains("'/features/commission'"));
      expect(routes, contains('MoneyScreen(initialTab: 2)'));
      expect(blocked, isNot(contains('S-018')));
      expect(blocked, isNot(contains('S-019')));
      expect(blocked, isNot(contains('S-020')));
      expect(money, isNot(contains('backend contract')));
      expect(money, isNot(contains('SKIP')));
    });

    test(
      'KycService manages KYC overview, document submit, and refresh',
      () async {
        final api = _FakeApiClient(
          json: {
            '/kyc': _kycOverviewJson(),
            '/kyc/documents': {
              'document': _kycDocumentJson(status: 'verified'),
              'overview': _kycOverviewJson(status: 'verified'),
            },
            '/kyc/documents/kyc_1/refresh': {
              'document': _kycDocumentJson(status: 'verified'),
              'overview': _kycOverviewJson(status: 'verified'),
            },
          },
        );
        final service = KycService(api: api);

        final overview = await service.fetchOverview('store_1');
        final pathsBeforeDeniedFile = List<String>.of(api.paths);
        await expectLater(
          service.submitDocument(
            storeId: 'store_1',
            documentType: 'business_pan',
            fileUrl: 'https://cdn.letbuyy.com/kyc/pan.jpg',
            fileName: 'pan.jpg',
          ),
          throwsA(isA<ApiException>().having(
            (error) => error.code,
            'code',
            'KYC_PRIVATE_UPLOAD_UNAVAILABLE',
          )),
        );
        expect(api.paths, pathsBeforeDeniedFile);
        final submitted = await service.submitDocument(
          storeId: 'store_1',
          documentType: 'business_pan',
          documentNumberLast4: '1234',
        );
        final refreshed = await service.refreshDocument('kyc_1', 'store_1');

        expect(overview['overall_status'], 'in_progress');
        expect(submitted['document']['status'], 'verified');
        expect(refreshed['overview']['overall_status'], 'verified');
        expect(api.paths, contains('/kyc'));
        expect(api.paths, contains('/kyc/documents'));
        expect(api.paths, contains('/kyc/documents/kyc_1/refresh'));
        expect(
          api.bodies['/kyc/documents'],
          containsPair('document_type', 'business_pan'),
        );
        expect(
          api.bodies['/kyc/documents'],
          isNot(contains('file_url')),
        );
      },
    );

    test('KYC feature route replaces platform-blocked seam', () {
      final routesFile = [
        File('apps/mobile/merchant-app/lib/app/routes.dart'),
        File('lib/app/routes.dart'),
      ].firstWhere((file) => file.existsSync());
      final blockedFile = [
        File(
          'apps/mobile/merchant-app/lib/services/platform_blocked_service.dart',
        ),
        File('lib/services/platform_blocked_service.dart'),
      ].firstWhere((file) => file.existsSync());
      final kycFile = [
        File('apps/mobile/merchant-app/lib/screens/kyc/kyc_screen.dart'),
        File('lib/screens/kyc/kyc_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final routes = routesFile.readAsStringSync();
      final blocked = blockedFile.readAsStringSync();
      final kyc = kycFile.readAsStringSync();

      expect(routes, contains("'/features/kyc'"));
      expect(routes, contains('KycScreen'));
      expect(blocked, isNot(contains('S-021')));
      expect(blocked, isNot(contains('MOBILE_KYC')));
      expect(kyc, isNot(contains('backend contract')));
      expect(kyc, isNot(contains('SKIP')));
    });

    test(
      'TwoFactorService manages overview, TOTP enrollment, verify, and disable',
      () async {
        var contextEpoch = 1;
        final api = _FakeApiClient(
          contextVersionProvider: () => contextEpoch,
          json: {
            '/2fa': _twoFactorOverviewJson(),
            '/2fa/sessions': {
              'sessions': [_twoFactorSessionJson()],
            },
            '/2fa/totp/enroll': {
              'factor': _twoFactorFactorJson(status: 'pending'),
              'secret': 'JBSWY3DPEHPK3PXP',
              'otpauth_uri':
                  'otpauth://totp/LetBuyy:test@example.com?secret=JBSWY3DPEHPK3PXP',
            },
            '/2fa/totp/verify': {
              'factor': _twoFactorFactorJson(status: 'active'),
              'recovery_codes': ['AAAAA-BBBBB'],
            },
            '/2fa/disable': {
              'factor': _twoFactorFactorJson(status: 'disabled'),
            },
          },
        );
        final service = _contractTwoFactor(api, MemoryStorage());

        final overview = await service.fetchOverview();
        final enrollment = await service.enrollTotp();
        final verified = await service.verifyTotp(
          factorId: '22222222-2222-4222-8222-222222222222',
          code: '123456',
        );
        final disabled = await service.disable(
          factorId: '22222222-2222-4222-8222-222222222222',
          code: '123456',
        );

        expect(overview['mfa_enabled'], isFalse);
        expect(enrollment['secret'], 'JBSWY3DPEHPK3PXP');
        expect(verified['recovery_codes'], contains('AAAAA-BBBBB'));
        expect(disabled['factor']['status'], 'disabled');
        expect(api.paths, contains('/2fa'));
        expect(api.paths, contains('/2fa/totp/enroll'));
        expect(api.paths, contains('/2fa/totp/verify'));
        expect(api.paths, contains('/2fa/disable'));
        expect(
          api.bodies['/2fa/totp/verify'],
          containsPair('factor_id', '22222222-2222-4222-8222-222222222222'),
        );
        expect(api.bodies['/2fa/disable'], containsPair('code', '123456'));
        for (final path in ['/2fa/totp/enroll', '/2fa/totp/verify',
            '/2fa/disable']) {
          final options = api.requestOptions[path]!.single!;
          expect(options.storeId, 'store_1');
          expect(options.expectedContextVersion, 1);
          expect(options.idempotencyKey,
              matches(RegExp(r'^[a-zA-Z0-9-]{8,200}$')));
        }
        final previousCalls = api.paths.length;
        contextEpoch++;
        expect(service.overview, isNull);
        await expectLater(service.fetchOverview(expectedContext: 1),
            throwsA(isA<ApiException>().having((e) => e.code,
                'code', 'SESSION_CONTEXT_CHANGED')));
        expect(api.paths.length, previousCalls);
      },
    );

    test('Two-factor feature route replaces platform-blocked seam', () {
      final routesFile = [
        File('apps/mobile/merchant-app/lib/app/routes.dart'),
        File('lib/app/routes.dart'),
      ].firstWhere((file) => file.existsSync());
      final blockedFile = [
        File(
          'apps/mobile/merchant-app/lib/services/platform_blocked_service.dart',
        ),
        File('lib/services/platform_blocked_service.dart'),
      ].firstWhere((file) => file.existsSync());
      final screenFile = [
        File(
          'apps/mobile/merchant-app/lib/screens/security/two_factor_screen.dart',
        ),
        File('lib/screens/security/two_factor_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final routes = routesFile.readAsStringSync();
      final blocked = blockedFile.readAsStringSync();
      final screen = screenFile.readAsStringSync();

      expect(routes, contains("'/features/two-factor'"));
      expect(routes, contains('TwoFactorScreen'));
      expect(blocked, isNot(contains('S-023')));
      expect(blocked, isNot(contains('MOBILE_TWO_FACTOR')));
      expect(screen, isNot(contains('backend contract')));
      expect(screen, isNot(contains('SKIP')));
    });

    test('CustomerService manages customers and addresses', () async {
      final api = _FakeApiClient(
        paginated: {
          '/customers': [_customerJson()],
          '/customers/segments/segment_1/customers': [_customerJson()],
        },
        json: {
          '/customers': {
            ..._customerJson(),
            'id': 'customer_2',
            'email': 'anu@example.com',
            'display_name': 'Anu Buyer',
            'first_name': 'Anu',
            'last_name': 'Buyer',
          },
          '/customers/segments': [_customerSegmentJson()],
          '/customers/segments/preview': {
            'store_id': 'store_1',
            'rules': {
              'tags_any': ['vip'],
              'min_order_count': 1,
            },
            'customer_count': 1,
            'sample_customers': [_customerJson()],
          },
          '/customers/meera%40example.com': _customerJson(),
          '/customers/meera%40example.com/notes': [_noteJson()],
          '/customers/meera%40example.com/tags': _customerJson(),
          '/customers/meera%40example.com/email': {'success': true},
          '/customers/meera%40example.com/merge': {
            'merged': true,
            'source_email': 'meera@example.com',
            'target_email': 'anu@example.com',
            'customer': {
              ..._customerJson(),
              'email': 'anu@example.com',
              'display_name': 'Anu Buyer',
            },
          },
          '/customers/anu%40example.com': {'deleted': true},
          '/customers/meera%40example.com/addresses': [_addressJson()],
          '/customers/meera%40example.com/addresses/address_1': _addressJson(),
        },
      );
      final service = CustomerService(api: api);

      final customers = await service.fetchCustomers('store_1');
      final created = await service.createCustomer(
        storeId: 'store_1',
        email: 'anu@example.com',
        firstName: 'Anu',
        lastName: 'Buyer',
        phone: '+919876543210',
        tags: ['vip'],
        acceptsMarketing: true,
      );
      expect(service.customers.first.email, 'anu@example.com');
      final detail = await service.fetchCustomerByEmail('meera@example.com');
      final updated = await service.updateCustomer('meera@example.com', {
        'first_name': 'Meera',
        'last_name': 'Merchant',
      });
      final notes = await service.fetchNotes(
        'meera@example.com',
        storeId: 'store_1',
      );
      await service.addNote(
        'meera@example.com',
        storeId: 'store_1',
        note: 'Prefers COD',
      );
      await service.updateTags(
        'meera@example.com',
        storeId: 'store_1',
        tags: ['vip'],
      );
      await service.emailCustomer(
        'meera@example.com',
        storeId: 'store_1',
        subject: 'Order update',
        message: 'Your order is ready.',
      );
      final segments = await service.fetchSegments('store_1');
      final preview = await service.previewSegment(
        storeId: 'store_1',
        rules: {
          'tags_any': ['vip'],
          'min_order_count': 1,
        },
      );
      final createdSegment = await service.createSegment(
        storeId: 'store_1',
        name: 'VIP customers',
        rules: {
          'tags_any': ['vip'],
          'min_order_count': 1,
        },
      );
      final segmentCustomers = await service.fetchSegmentCustomers(
        'segment_1',
        storeId: 'store_1',
      );
      final merged = await service.mergeCustomer(
        'meera@example.com',
        storeId: 'store_1',
        targetEmail: 'anu@example.com',
      );
      await service.deleteCustomer('anu@example.com', storeId: 'store_1');
      final addresses = await service.fetchAddresses('meera@example.com');
      await service.createAddress('meera@example.com', _addressJson());
      await service.updateAddress(
        'meera@example.com',
        'address_1',
        _addressJson(),
      );
      await service.deleteAddress('meera@example.com', 'address_1');

      expect(customers.single.email, 'meera@example.com');
      expect(created.email, 'anu@example.com');
      expect(detail.displayName, 'Meera Merchant');
      expect(updated.displayName, 'Meera Merchant');
      expect(notes.single['note'], 'Prefers COD');
      expect(segments.single.name, 'VIP customers');
      expect(preview['customer_count'], 1);
      expect(createdSegment.customerCount, 1);
      expect(segmentCustomers.single.email, 'meera@example.com');
      expect(merged.email, 'anu@example.com');
      expect(addresses.single.city, 'Bengaluru');
      expect(api.paths, contains('/customers'));
      expect(api.bodies['/customers'], {
        'store_id': 'store_1',
        'email': 'anu@example.com',
        'first_name': 'Anu',
        'last_name': 'Buyer',
        'phone': '+919876543210',
        'tags': ['vip'],
        'accepts_marketing': true,
      });
      expect(api.paths, contains('/customers/segments'));
      expect(api.paths, contains('/customers/segments/preview'));
      expect(api.paths, contains('/customers/segments/segment_1/customers'));
      expect(api.paths, contains('/customers/meera%40example.com/merge'));
      expect(api.paths, contains('/customers/anu%40example.com'));
      expect(api.paths, contains('/customers/meera%40example.com'));
      expect(api.paths, contains('/customers/meera%40example.com/notes'));
      expect(api.paths, contains('/customers/meera%40example.com/tags'));
      expect(api.paths, contains('/customers/meera%40example.com/email'));
      expect(
        api.paths,
        contains('/customers/meera%40example.com/addresses/address_1'),
      );
    });

    test(
      'CustomerService falls back to cached customers when offline',
      () async {
        final cache = CacheService.memory();
        await CustomerService(
          api: _FakeApiClient(
            paginated: {
              '/customers': [_customerJson()],
            },
            json: {'/customers/meera%40example.com': _customerJson()},
          ),
          cache: cache,
        ).fetchCustomers('store_1');
        await CustomerService(
          api: _FakeApiClient(
            json: {'/customers/meera%40example.com': _customerJson()},
          ),
          cache: cache,
        ).fetchCustomerByEmail('meera@example.com', storeId: 'store_1');

        final service = CustomerService(
          api: _ThrowingApiClient(),
          cache: cache,
        );
        final customers = await service.fetchCustomers('store_1');
        final detail = await service.fetchCustomerByEmail(
          'meera@example.com',
          storeId: 'store_1',
        );

        expect(customers.single.email, 'meera@example.com');
        expect(detail.displayName, 'Meera Merchant');
      },
    );

    test('CustomerService reads cached detail without refetching', () async {
      final cache = CacheService.memory();
      final api = _FakeApiClient(
        paginated: {
          '/customers': [_customerJson()],
        },
      );
      final service = CustomerService(api: api, cache: cache);

      await service.fetchCustomers('store_1');
      api.paths.clear();
      final cached = service.cachedCustomerByEmail(
        'meera@example.com',
        storeId: 'store_1',
      );

      expect(cached?.displayName, 'Meera Merchant');
      expect(api.paths, isEmpty);
    });

    test('CustomerService starts and reads customer CSV export jobs', () async {
      final api = _FakeApiClient(
        json: {
          '/export/customers': {
            'job': {
              'id': 'export_customers_1',
              'type': 'customers',
              'status': 'completed',
              'row_count': 1,
              'filename': 'customers.csv',
              'download_url': 'https://gateway.test/v1/export/jobs/2/download',
            },
          },
          '/export/jobs/export_customers_1': {
            'job': {
              'id': 'export_customers_1',
              'type': 'customers',
              'status': 'completed',
              'row_count': 1,
              'filename': 'customers.csv',
              'download_url': 'https://gateway.test/v1/export/jobs/2/download',
            },
          },
        },
      );
      final service = CustomerService(api: api);

      final created = await service.exportCustomers('store_1');
      final latest = await service.fetchExportJob('export_customers_1');

      expect(created['job']['status'], 'completed');
      expect(latest['job']['filename'], 'customers.csv');
      expect(api.paths, contains('/export/customers'));
      expect(api.paths, contains('/export/jobs/export_customers_1'));
      expect(api.queries['/export/customers']?['store_id'], 'store_1');
    });

    test(
      'WhatsAppService checks capability, timeline, and sends templates',
      () async {
        final api = _FakeApiClient(
          json: {
            '/whatsapp/status': _whatsAppStatusJson(),
            '/whatsapp/timeline': [_whatsAppMessageJson()],
            '/whatsapp/send': {
              'message': _whatsAppMessageJson(
                message: 'Order order_1 is paid.',
              ),
              'provider_message_id': 'wa_sandbox_1',
              'status': 'queued',
              'sandbox': true,
            },
          },
        );
        final service = WhatsAppService(api: api);

        final status = await service.fetchStatus('store_1');
        final timeline = await service.fetchTimeline(
          'store_1',
          customerEmail: 'meera@example.com',
          customerPhone: '+919999999999',
        );
        final sent = await service.sendTemplate(
          storeId: 'store_1',
          customerEmail: 'meera@example.com',
          customerPhone: '+919999999999',
          template: 'order_update',
          variables: const {'order_number': 'order_1', 'status': 'paid'},
        );

        expect(status['available'], isTrue);
        expect(timeline.single['message'], 'Order update sent.');
        expect(sent['status'], 'queued');
        expect(api.queries['/whatsapp/status']?['store_id'], 'store_1');
        expect(
          api.queries['/whatsapp/timeline']?['customer_email'],
          'meera@example.com',
        );
        expect(
          (api.bodies['/whatsapp/send'] as Map)['template'],
          'order_update',
        );
        expect(service.timeline.first['provider_message_id'], 'wa_sandbox_1');
      },
    );

    test(
      'MarketingService creates and sends email campaigns through the API',
      () async {
        final api = _FakeApiClient(
          paginated: {
            '/marketing/email-campaigns': [_marketingCampaignJson()],
          },
          json: {
            '/marketing/email-campaigns/audience-preview': {
              'store_id': 'store_1',
              'customer_count': 2,
              'sample_customers': [_customerJson()],
            },
            '/marketing/email-campaigns': _marketingCampaignJson(),
            '/marketing/email-campaigns/campaign_1/send': {
              'campaign': _marketingCampaignJson(status: 'sent', sentCount: 2),
              'recipients': [
                {
                  'id': 'recipient_1',
                  'campaign_id': 'campaign_1',
                  'store_id': 'store_1',
                  'customer_email': 'meera@example.com',
                  'status': 'sandbox_sent',
                },
              ],
              'sandbox': true,
              'sent_count': 2,
              'failed_count': 0,
            },
          },
        );
        final service = MarketingService(api: api);

        final campaigns = await service.fetchCampaigns('store_1');
        final preview = await service.previewAudience(
          storeId: 'store_1',
          audience: const {'type': 'all_marketing', 'recipients': []},
        );
        final created = await service.createCampaign(
          storeId: 'store_1',
          name: 'June update',
          subject: 'New arrivals',
          bodyText: 'Fresh catalog drops are live.',
          audience: const {'type': 'all_marketing', 'recipients': []},
        );
        final sent = await service.sendCampaign(
          storeId: 'store_1',
          campaignId: 'campaign_1',
        );

        expect(campaigns.single['subject'], 'New arrivals');
        expect(preview['customer_count'], 2);
        expect(created['id'], 'campaign_1');
        expect(sent['sandbox'], isTrue);
        expect(service.campaigns.first['status'], 'sent');
        expect(
          api.queries['/marketing/email-campaigns']?['store_id'],
          'store_1',
        );
        expect(
          api.bodies['/marketing/email-campaigns/audience-preview'],
          containsPair('store_id', 'store_1'),
        );
        expect(
          api.bodies['/marketing/email-campaigns'],
          containsPair('subject', 'New arrivals'),
        );
        expect(
          (api.bodies['/marketing/email-campaigns/campaign_1/send']
              as Map)['idempotency_key'],
          startsWith('email_campaign_campaign_1_'),
        );
      },
    );

    test('InventoryService lists and adjusts stock levels', () async {
      final api = _FakeApiClient(
        paginated: {
          '/inventory/levels': [_inventoryJson()],
        },
        json: {'/inventory/adjust': _inventoryJson(available: 15)},
      );
      final service = InventoryService(api: api);

      final levels = await service.fetchLevels('store_1');
      final adjusted = await service.adjustStock(
        storeId: 'store_1',
        level: levels.single,
        delta: 5,
        reason: 'stock_count',
      );

      expect(levels.single.sku, 'TEE-001');
      expect(adjusted.available, 15);
      expect(api.paths, contains('/inventory/levels'));
      expect(api.paths, contains('/inventory/adjust'));
      expect(api.bodies['/inventory/adjust'], containsPair('adjustment', 5));
    });

    test('InventoryService manages WMS locations and suppliers', () async {
      final api = _FakeApiClient(
        json: {
          '/inventory/locations': [_locationJson()],
          '/inventory/suppliers': [_supplierJson()],
        },
      );
      final service = InventoryService(api: api);

      final locations = await service.fetchLocations('store_1');
      final createdLocation = await service.createLocation(
        const InventoryLocationInput(
          storeId: 'store_1',
          name: 'North warehouse',
          city: 'Delhi',
          state: 'Delhi',
          isDefault: true,
        ),
      );
      final suppliers = await service.fetchSuppliers('store_1');
      final createdSupplier = await service.createSupplier(
        const InventorySupplierInput(
          storeId: 'store_1',
          name: 'Acme Textiles',
          contactName: 'Riya',
          email: 'riya@example.com',
          phone: '+911111111111',
        ),
      );

      expect(locations.single.name, 'North warehouse');
      expect(createdLocation.isDefault, isTrue);
      expect(suppliers.single.name, 'Acme Textiles');
      expect(createdSupplier.email, 'riya@example.com');
      expect(api.paths, contains('/inventory/locations'));
      expect(api.paths, contains('/inventory/suppliers'));
    });

    test('InventoryService creates and advances purchase orders', () async {
      final api = _FakeApiClient(
        json: {
          '/inventory/purchase-orders': [_purchaseOrderJson()],
          '/inventory/purchase-orders/po_1/receive': _purchaseOrderJson(
            status: 'received',
            receivedQuantity: 4,
          ),
        },
      );
      final service = InventoryService(api: api);

      final orders = await service.fetchPurchaseOrders('store_1');
      final created = await service.createPurchaseOrder(
        const PurchaseOrderInput(
          storeId: 'store_1',
          supplierId: 'supplier_1',
          locationId: 'loc_1',
          idempotencyKey: 'po-create-123',
          lines: [
            InventoryLineInput(
              productId: 'prod_1',
              variantId: 'variant_1',
              quantity: 4,
              unitCost: 299,
            ),
          ],
        ),
      );
      final received = await service.receivePurchaseOrder(
        created,
        idempotencyKey: 'po-receive-123',
      );

      expect(orders.single.totalQuantity, 4);
      expect(created.supplierName, 'Acme Textiles');
      expect(received.status, 'received');
      expect(received.remainingQuantity, 0);
      expect(api.paths, contains('/inventory/purchase-orders'));
      expect(api.paths, contains('/inventory/purchase-orders/po_1/receive'));
      expect(
        api.bodies['/inventory/purchase-orders'],
        containsPair('idempotency_key', 'po-create-123'),
      );
    });

    test('InventoryService creates, ships, and receives transfers', () async {
      final api = _FakeApiClient(
        json: {
          '/inventory/transfers': [_transferJson()],
          '/inventory/transfers/transfer_1/ship': _transferJson(
            status: 'shipped',
          ),
          '/inventory/transfers/transfer_1/receive': _transferJson(
            status: 'received',
            receivedQuantity: 3,
          ),
        },
      );
      final service = InventoryService(api: api);

      final transfers = await service.fetchTransfers('store_1');
      final created = await service.createTransfer(
        const InventoryTransferInput(
          storeId: 'store_1',
          sourceLocationId: 'loc_1',
          destinationLocationId: 'loc_2',
          idempotencyKey: 'transfer-create-123',
          lines: [InventoryLineInput(productId: 'prod_1', quantity: 3)],
        ),
      );
      final shipped = await service.shipTransfer(
        created,
        idempotencyKey: 'transfer-ship-123',
      );
      final received = await service.receiveTransfer(
        created,
        idempotencyKey: 'transfer-receive-123',
      );

      expect(transfers.single.totalQuantity, 3);
      expect(shipped.status, 'shipped');
      expect(received.status, 'received');
      expect(received.remainingQuantity, 0);
      expect(api.paths, contains('/inventory/transfers'));
      expect(api.paths, contains('/inventory/transfers/transfer_1/ship'));
      expect(api.paths, contains('/inventory/transfers/transfer_1/receive'));
    });

    test('Inventory scanner source is wired to mobile_scanner', () {
      final pubspec = _readSource(
        appRelative: 'pubspec.yaml',
        repoRelative: 'apps/mobile/merchant-app/pubspec.yaml',
      );
      final scanner = _readSource(
        appRelative: 'lib/widgets/shared/barcode_scanner_sheet.dart',
        repoRelative:
            'apps/mobile/merchant-app/lib/widgets/shared/barcode_scanner_sheet.dart',
      );
      final inventory = _readSource(
        appRelative: 'lib/services/inventory_service.dart',
        repoRelative:
            'apps/mobile/merchant-app/lib/services/inventory_service.dart',
      );

      expect(pubspec, contains('mobile_scanner:'));
      expect(scanner, contains('MobileScanner'));
      expect(scanner, contains('onDetect'));
      expect(inventory, isNot(contains('MOBILE_SCANNER_DEPENDENCY')));
      expect(inventory, isNot(contains('SkipNeedsBackendException')));
    });

    test('CouponService handles coupon CRUD and validation', () async {
      final api = _FakeApiClient(
        paginated: {
          '/coupons': [_couponJson()],
        },
        json: {
          '/coupons': _couponJson(id: 'coupon_2', code: 'WELCOME'),
          '/coupons/coupon_1': _couponJson(isActive: false),
          '/coupons/validate': {'message': 'Coupon is valid'},
        },
      );
      final service = CouponService(api: api);

      final coupons = await service.fetchCoupons('store_1');
      final created = await service.createCoupon(_couponJson(code: 'WELCOME'));
      final toggled = await service.toggleCoupon(coupons.single);
      await service.deleteCoupon('coupon_1');
      final validation = await service.validateCoupon(
        storeId: 'store_1',
        code: 'SAVE10',
        subtotal: 1000,
      );

      expect(coupons.single.code, 'SAVE10');
      expect(created.code, 'WELCOME');
      expect(toggled.isActive, isFalse);
      expect(validation['message'], 'Coupon is valid');
      expect(api.paths, contains('/coupons'));
      expect(api.paths, contains('/coupons/coupon_1'));
      expect(api.paths, contains('/coupons/validate'));
    });

    test('CmsService handles page CRUD through the gateway', () async {
      final api = _FakeApiClient(
        paginated: {
          '/pages': [_pageJson()],
        },
        json: {
          '/pages': _pageJson(id: 'page_2', title: 'About LetBuyy'),
          '/pages/page_1': _pageJson(status: 'published'),
        },
      );
      final service = CmsService(api: api);

      final pages = await service.fetchPages('store_1');
      final created = await service.createPage(
        const CmsPageInput(
          storeId: 'store_1',
          title: 'About LetBuyy',
          body: 'Built from a phone.',
          slug: 'about-letbuyy',
          status: 'draft',
        ),
      );
      final updated = await service.updatePage(
        'page_1',
        const CmsPageInput(
          storeId: 'store_1',
          title: 'About us',
          body: 'Updated from mobile.',
          slug: 'about-us',
          status: 'published',
        ),
      );
      await service.updatePageStatus(pages.single, 'published');
      await service.deletePage('page_1');

      expect(pages.single.title, 'About us');
      expect(created.id, 'page_2');
      expect(updated.status, 'published');
      expect(api.paths, contains('/pages'));
      expect(api.paths, contains('/pages/page_1'));
    });

    test('CmsService manages blog posts and comment moderation', () async {
      final api = _FakeApiClient(
        paginated: {
          '/blog/posts': [_blogPostJson()],
          '/blog/comments': [_blogCommentJson()],
        },
        json: {
          '/blog/posts': _blogPostJson(id: 'post_2', postTitle: 'Mobile tips'),
          '/blog/posts/post_1': _blogPostJson(status: 'published'),
          '/blog/comments/comment_1': _blogCommentJson(status: 'approved'),
        },
      );
      final service = CmsService(api: api);

      final posts = await service.fetchBlogPosts('store_1');
      final created = await service.createBlogPost(
        const BlogPostInput(
          storeId: 'store_1',
          title: 'Mobile tips',
          content: 'Run your store from a phone.',
          slug: 'mobile-tips',
        ),
      );
      final updated = await service.updateBlogPost(
        'post_1',
        const BlogPostInput(
          storeId: 'store_1',
          title: 'Launch update',
          content: 'Published from mobile.',
          slug: 'launch-update',
          status: 'published',
        ),
      );
      await service.updateBlogPostStatus(posts.single, 'published');
      await service.deleteBlogPost('post_1');
      final comments = await service.fetchBlogComments('store_1');
      final moderated = await service.moderateBlogComment(
        comments.single,
        'approved',
      );
      await service.deleteBlogComment('comment_1');

      expect(posts.single.title, 'Launch update');
      expect(created.id, 'post_2');
      expect(updated.status, 'published');
      expect(moderated.status, 'approved');
      expect(api.paths, contains('/blog/posts'));
      expect(api.paths, contains('/blog/posts/post_1'));
      expect(api.paths, contains('/blog/comments'));
      expect(api.paths, contains('/blog/comments/comment_1'));
    });

    test('CmsService loads and replaces storefront navigation', () async {
      final api = _FakeApiClient(
        json: {
          '/pages/navigation': {
            'menu': _navigationMenuJson(),
            'items': [_navigationItemJson()],
          },
          '/pages/navigation/main': {'replaced': true, 'count': 1},
        },
      );
      final service = CmsService(api: api);

      final navigation = await service.fetchNavigation(
        'store_1',
        location: 'main',
      );
      final saved = await service.replaceNavigation(
        storeId: 'store_1',
        location: 'main',
        name: 'Header menu',
        items: [
          NavigationItemInput.fromContract(
            navigation.items.single,
          ).copyWith(label: 'Catalog', url: '/collections/all'),
        ],
      );

      expect(navigation.menu?.location, 'main');
      expect(navigation.items.single.label, 'Home');
      expect(saved.items.single.url, '/');
      expect(api.paths, contains('/pages/navigation'));
      expect(api.paths, contains('/pages/navigation/main'));
    });

    test('MediaService lists, uploads, updates, and deletes assets', () async {
      final tempDir = Directory.systemTemp.createTempSync('letbuyy-media-test');
      addTearDown(() => tempDir.deleteSync(recursive: true));
      final file = File('${tempDir.path}/hero.png')..writeAsBytesSync([1, 2]);
      final api = _FakeApiClient(
        paginated: {
          '/media': [_mediaJson()],
        },
        json: {
          '/upload': _uploadJson(),
          '/media': _mediaJson(id: 'media_2', filename: 'hero.png'),
          '/media/media_1': _mediaJson(altText: 'Campaign hero'),
        },
      );
      final service = MediaService(api: api);

      final assets = await service.fetchMedia('store_1');
      final uploaded = await service.uploadAndCreate(
        storeId: 'store_1',
        file: file,
        folder: 'media',
        altText: 'Hero',
      );
      final updated = await service.updateMedia(
        'media_1',
        const MediaUpdateInput(altText: 'Campaign hero', folder: 'media'),
      );
      await service.deleteMedia(assets.single, deleteObject: true);
      final video = MediaAssetContract.fromJson(
        _mediaJson(
          filename: 'launch.mp4',
          originalName: 'Launch.mp4',
          mediaType: 'video',
          mimeType: 'video/mp4',
        ),
      );
      final model = MediaAssetContract.fromJson(
        _mediaJson(
          filename: 'shoe.glb',
          originalName: 'Shoe.glb',
          mediaType: 'other',
          mimeType: 'model/gltf-binary',
        ),
      );

      expect(assets.single.displayName, 'Hero image');
      expect(uploaded.id, 'media_2');
      expect(updated.altText, 'Campaign hero');
      expect(video.isVideo, true);
      expect(model.isThreeDModel, true);
      expect(api.paths, contains('/media'));
      expect(api.paths, contains('/upload'));
      expect(api.paths, contains('/media/media_1'));
      expect(api.paths, contains('/upload/media%2Fstore_1%2Fhero.png'));
      expect(api.queries['/upload/media%2Fstore_1%2Fhero.png'], {
        'store_id': 'store_1',
      });
    });

    test('ShippingTaxService manages zones and rates', () async {
      final api = _FakeApiClient(
        json: {
          '/shipping-tax/shipping/zones': [_shippingZoneJson()],
          '/shipping-tax/shipping': [_shippingRateJson()],
          '/shipping-tax/shipping/zones/zone_1': _shippingZoneJson(
            name: 'South India',
          ),
          '/shipping-tax/shipping/rate_1': _shippingRateJson(price: 80),
        },
      );
      final service = ShippingTaxService(api: api);

      final summary = await service.fetchShipping('store_1');
      final createdZone = await service.createZone(
        const ShippingZoneInput(
          storeId: 'store_1',
          name: 'Domestic',
          countries: ['IN'],
        ),
      );
      final updatedZone = await service.updateZone(
        'zone_1',
        const ShippingZoneInput(
          storeId: 'store_1',
          name: 'South India',
          countries: ['IN'],
          states: ['Karnataka'],
        ),
      );
      final createdRate = await service.createRate(
        const ShippingRateInput(
          zoneId: 'zone_1',
          name: 'Standard',
          type: 'flat',
          price: 49,
          estimatedDaysMin: 2,
          estimatedDaysMax: 5,
        ),
      );
      final updatedRate = await service.updateRate(
        'rate_1',
        const ShippingRateInput(
          zoneId: 'zone_1',
          name: 'Standard',
          type: 'flat',
          price: 80,
        ),
      );
      await service.deleteRate('rate_1');
      await service.deleteZone('zone_1');

      expect(summary.zones.single.name, 'Domestic');
      expect(summary.rates.single.name, 'Standard');
      expect(createdZone.countries, ['IN']);
      expect(updatedZone.states, ['Karnataka']);
      expect(createdRate.price, 49);
      expect(updatedRate.price, 80);
      expect(api.paths, contains('/shipping-tax/shipping/zones'));
      expect(api.paths, contains('/shipping-tax/shipping'));
      expect(api.paths, contains('/shipping-tax/shipping/zones/zone_1'));
      expect(api.paths, contains('/shipping-tax/shipping/rate_1'));
    });

    test('ShippingTaxService manages tax rates', () async {
      final api = _FakeApiClient(
        json: {
          '/shipping-tax/taxes': [_taxRateJson()],
          '/shipping-tax/taxes/tax_1': _taxRateJson(rate: 12),
        },
      );
      final service = ShippingTaxService(api: api);

      final taxes = await service.fetchTaxes('store_1');
      final created = await service.createTaxRate(
        const TaxRateInput(
          storeId: 'store_1',
          name: 'GST',
          rate: 18,
          country: 'IN',
          appliesTo: 'all',
        ),
      );
      final updated = await service.updateTaxRate(
        'tax_1',
        const TaxRateInput(
          storeId: 'store_1',
          name: 'Reduced GST',
          rate: 12,
          country: 'IN',
          appliesTo: 'products',
        ),
      );
      await service.deleteTaxRate('tax_1');

      expect(taxes.single.name, 'GST');
      expect(created.country, 'IN');
      expect(updated.rate, 12);
      expect(
        api.bodies['/shipping-tax/taxes'],
        containsPair('applies_to', 'all'),
      );
      expect(
        api.bodies['/shipping-tax/taxes/tax_1'],
        containsPair('applies_to', 'products'),
      );
      expect(api.paths, contains('/shipping-tax/taxes'));
      expect(api.paths, contains('/shipping-tax/taxes/tax_1'));
    });

    test(
      'DomainService uses gateway custom-domain and access endpoints',
      () async {
        final api = _FakeApiClient(
          json: {
            '/custom/domains': {
              'status': 'pending',
              'records': {
                'cname': {'value': DomainService.cnameTarget},
              },
            },
            '/custom/domains/verify': {
              'status': 'active',
              'cname_verified': true,
            },
            '/custom/domains/shop.example.com/status': _domainHealthJson(),
            '/domains/search': {
              'domain': 'shop.example.in',
              'available': true,
              'currency': 'INR',
              'amountMinor': 79900,
              'provider': 'sandbox',
              'premium': false,
              'reasons': const <String>[],
            },
            '/domains/purchase': {
              'order_id': 'domain_order_1',
              'domain': 'shop.example.in',
              'status': 'active',
              'provider': 'sandbox',
              'registrar_order_id': 'sandbox-domain-order',
              'dns_configured': true,
              'checkout': {
                'mode': 'sandbox',
                'status': 'verified',
                'payment_reference':
                    'sandbox:domain_checkout:store_1:shop.example.in',
                'amount_minor': 79900,
                'currency': 'INR',
              },
            },
            '/store-access/preview-links': {
              'token': 'preview-token',
              'jti': 'jti-1',
              'host': 'shop.example.com',
              'expires_at': '2026-06-06T00:00:00.000Z',
            },
          },
        );
        final service = DomainService(api: api);
        final store = StoreModel.fromJson(_storeJson());

        final updated = await service.saveCustomDomain(
          store,
          'https://Shop.Example.com/path',
        );
        final snapshot = service.snapshotForStore(updated);

        expect(updated.customDomain, 'shop.example.com');
        expect(snapshot.records.single.type, 'CNAME');
        expect(snapshot.records.single.value, DomainService.cnameTarget);
        expect(api.paths, contains('/custom/domains'));
        expect(
          api.bodies['/custom/domains'],
          containsPair('domain', 'shop.example.com'),
        );
        final quote = await service.searchDomainToBuy('shop.example.in');
        final purchase = await service.purchaseDomain(
          store,
          quote: quote,
          ownerName: 'Demo Merchant',
          ownerEmail: 'merchant@example.com',
        );
        final verified = await service.verifyDomain(updated);
        final refreshed = await service.refreshSslStatus(verified);
        final access = await service.updateStoreAccess(
          refreshed,
          accessMode: 'password',
          password: 'secret',
          message: 'Members only',
        );
        final preview = await service.createPreviewLink(
          access,
          host: 'shop.example.com',
        );

        expect(verified.customDomainStatus, 'active');
        expect(refreshed.sslActive, isTrue);
        expect(
          service.snapshotForStore(refreshed).renewalLabel,
          'Managed renewal',
        );
        expect(quote.priceLabel, 'INR 799.00');
        expect(purchase.checkoutVerified, isTrue);
        expect(purchase.dnsConfigured, isTrue);
        expect(purchase.merchantMessage, contains('verified'));
        expect(api.queries['/domains/search']?['query'], 'shop.example.in');
        expect(
          api.bodies['/domains/purchase'],
          containsPair('checkout_mode', 'sandbox'),
        );
        expect(
          api.bodies['/domains/purchase'],
          containsPair(
            'payment_reference',
            'sandbox:domain_checkout:store_1:shop.example.in',
          ),
        );
        expect(access.accessMode, 'password');
        expect(preview.url, contains('lb_preview=preview-token'));
        expect(api.paths, contains('/custom/domains/shop.example.com/status'));
        expect(api.paths, contains('/store-access'));
        expect(api.paths, contains('/store-access/preview-links'));
      },
    );

    test('NotificationSettingsService persists preferences', () async {
      final api = _FakeApiClient(
        json: {'/notifications/preferences': _notificationPreferenceRows()},
      );
      final service = NotificationSettingsService(api: api);

      final settings = await service.fetchSettings('store_1');
      final updated = await service.updateSettings(
        settings.copyWith(marketing: true),
      );

      expect(settings.emailEnabled, isTrue);
      expect(updated.lowStock, isTrue);
      expect(api.paths, contains('/notifications/preferences'));
    });

    test(
      'NotificationSettingsService manages the notification inbox',
      () async {
        final api = _FakeApiClient(
          paginated: {
            '/notifications': [_notificationJson()],
          },
          json: {
            '/notifications/count': {'count': 1},
            '/notifications/notif_1/read': {'marked': true},
            '/notifications/read-all': {'marked_all': true},
            '/notifications/notif_1': {'deleted': true},
          },
        );
        final service = NotificationSettingsService(api: api);

        final inbox = await service.fetchInbox();
        final unreadCount = await service.fetchUnreadCount();
        await service.markRead('notif_1');
        await service.markAllRead();
        await service.deleteNotification('notif_1');

        expect(inbox.single.title, 'New order received');
        expect(unreadCount, 1);
        expect(service.notifications, isEmpty);
        expect(api.paths, contains('/notifications'));
        expect(api.paths, contains('/notifications/count'));
        expect(api.paths, contains('/notifications/notif_1/read'));
        expect(api.paths, contains('/notifications/read-all'));
        expect(api.paths, contains('/notifications/notif_1'));
      },
    );

    test('StaffService manages staff, roles, and removal', () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = _FakeApiClient(
        json: {
          '/employees': [_staffJson()],
          '/employees/staff_1': _staffJson(role: 'manager'),
        },
      );
      final service = StaffService(api: api);

      final staff = await service.fetchStaff('store_1');
      final created = await service.createStaff(
        const StaffInviteInput(
          storeId: 'store_1',
          email: 'riya@example.com',
          role: 'editor',
        ),
      );
      final updated = await service.updateRole(staff.single, 'manager');
      expect(api.bodies['/employees/staff_1'], containsPair('role', 'manager'));
      expect(api.bodies['/employees/staff_1'], containsPair('expected_updated_at', staff.single.updatedAt));
      await service.removeStaff(updated);

      expect(staff.single.email, 'riya@example.com');
      expect(created.role, 'editor');
      expect(updated.role, 'manager');
      expect(api.paths, contains('/employees'));
      expect(api.paths, contains('/employees/staff_1'));
      expect(api.bodies['/employees'], containsPair('role', 'editor'));
      expect(api.bodies['/employees/staff_1'], containsPair('expected_updated_at', updated.updatedAt));
    });

    test(
      'ReviewService moderates reviews and sends merchant replies',
      () async {
        final api = _FakeApiClient(
          paginated: {
            '/reviews': [_reviewJson()],
          },
          json: {
            '/reviews/review_1': _reviewJson(status: 'approved'),
            '/reviews/review_1/reply': _reviewJson(
              status: 'approved',
              merchantReply: 'Thanks for your feedback.',
            ),
          },
        );
        final service = ReviewService(api: api);

        final reviews = await service.fetchReviews(
          'store_1',
          status: 'pending',
        );
        final approved = await service.moderateReview(
          reviews.single,
          'approved',
        );
        final replied = await service.replyToReview(
          const ReviewReplyInput(
            reviewId: 'review_1',
            message: 'Thanks for your feedback.',
          ),
        );
        await service.deleteReview(replied);

        expect(reviews.single.productName, 'Cotton Tee');
        expect(approved.status, 'approved');
        expect(replied.merchantReply, 'Thanks for your feedback.');
        expect(service.reviews, isEmpty);
        expect(api.paths, contains('/reviews'));
        expect(api.paths, contains('/reviews/review_1'));
        expect(api.paths, contains('/reviews/review_1/reply'));
        expect(
          api.bodies['/reviews/review_1'],
          containsPair('status', 'approved'),
        );
        expect(
          api.bodies['/reviews/review_1/reply'],
          containsPair('message', 'Thanks for your feedback.'),
        );
      },
    );

    test('FormSubmissionService manages leads and follow-up status', () async {
      final api = _FakeApiClient(
        paginated: {
          '/form-submissions': [_formSubmissionJson()],
        },
        json: {
          '/form-submissions/submission_1': _formSubmissionJson(
            status: 'contacted',
          ),
        },
      );
      final service = FormSubmissionService(api: api);

      final submissions = await service.fetchSubmissions(
        'store_1',
        type: 'lead',
        status: 'new',
      );
      final contacted = await service.updateStatus(
        submissions.single,
        'contacted',
      );
      await service.deleteSubmission(contacted);

      expect(submissions.single.fullName, 'Meera Merchant');
      expect(
        submissions.single.contactLine,
        'meera@example.com / +919999999999',
      );
      expect(contacted.status, 'contacted');
      expect(service.submissions, isEmpty);
      expect(api.paths, contains('/form-submissions'));
      expect(api.paths, contains('/form-submissions/submission_1'));
      expect(
        api.bodies['/form-submissions/submission_1'],
        containsPair('status', 'contacted'),
      );
    });

    test('AppMarketplaceService lists, installs, and hands off apps', () async {
      final api = _FakeApiClient(
        paginated: {
          '/app-store/apps': [_marketplaceAppJson()],
        },
        json: {
          '/app-store/categories': [_appCategoryJson()],
          '/app-store/installations': [_appInstallationJson()],
          '/app-store/apps/app_1/install': {
            'installation': _appInstallationJson(status: 'active'),
          },
          '/app-store/installations/install_1/embed-session':
              _appBridgeSessionJson(),
          '/app-store/bridge/fetch': {
            'ok': true,
            'status': 200,
            'data': {'products': []},
            'error': null,
          },
        },
      );
      final service = AppMarketplaceService(api: api);

      await service.refresh(storeId: 'store_1');
      final installed = await service.installApp(
        app: service.apps.single,
        storeId: 'store_1',
      );
      final handoff = await service.createDesktopBridgeHandoff(
        installation: installed,
      );
      final runtime = await service.openEmbeddedAppBridgeRuntime(installed);
      final bridgeFetch = await service.fetchEmbeddedBridgeData(
        session: runtime,
        path: '/products?limit=1',
      );
      await service.uninstallApp(app: service.apps.single, storeId: 'store_1');

      expect(service.categories.single.name, 'Marketing');
      expect(service.apps.single.name, 'Campaign Booster');
      expect(installed.app.name, 'Campaign Booster');
      expect(installed.permissions.map((item) => item.title), [
        'Read products',
        'Read orders',
      ]);
      expect(handoff.url, 'https://apps.letbuyy.com/admin/campaign-booster');
      expect(runtime.canOpenInApp, isTrue);
      expect(runtime.host.allowedOrigin, 'https://apps.letbuyy.com');
      expect(runtime.host.messageChannel, 'LetBuyyAppBridge');
      expect(bridgeFetch['ok'], isTrue);
      expect(api.paths, contains('/app-store/apps'));
      expect(api.paths, contains('/app-store/categories'));
      expect(api.paths, contains('/app-store/installations'));
      expect(api.paths, contains('/app-store/apps/app_1/install'));
      expect(
        api.paths,
        contains('/app-store/installations/install_1/embed-session'),
      );
      expect(
        api.bodies['/app-store/apps/app_1/install'],
        containsPair('store_id', 'store_1'),
      );
      expect(api.paths, contains('/app-store/bridge/fetch'));
      expect(api.bodies['/app-store/bridge/fetch'], {
        'method': 'GET',
        'path': '/products?limit=1',
        'store_id': 'store_1',
      });
    });

    test(
      'AiStudioService reads credits, usage, ratings, and generates content',
      () async {
        final api = _FakeApiClient(
          paginated: {
            '/ai/usage': [_aiUsageJson()],
          },
          json: {
            '/ai/credits': _aiCreditsJson(),
            '/ai/generate': {
              'usage': _aiUsageJson(
                id: 'usage_2',
                output: 'Generated cotton tee copy.',
                creditsUsed: 1,
              ),
              'credits': _aiCreditsJson(balance: 79, totalUsed: 21),
            },
            '/ai/homepage': {
              'store_id': 'store_1',
              'theme_slug': 'modern',
              'prompt': 'Warm homepage for cotton kurtas',
              'title': 'Warm homepage for cotton kurtas',
              'summary': 'A warm homepage draft for cotton kurtas.',
              'template_config': {
                'themeId': 'modern',
                'sections': {
                  'template': [
                    {
                      'id': 'ai_home_1',
                      'type': 'heroBanner',
                      'order': 1,
                      'visible': true,
                      'settings': {
                        'heading': 'Warm homepage for cotton kurtas',
                      },
                      'blocks': [],
                      'createdAt': '2026-06-08T10:00:00.000Z',
                      'updatedAt': '2026-06-08T10:00:00.000Z',
                    },
                  ],
                },
              },
              'sections': [
                {
                  'id': 'ai_home_1',
                  'type': 'heroBanner',
                  'order': 1,
                  'visible': true,
                  'settings': {'heading': 'Warm homepage for cotton kurtas'},
                  'blocks': [],
                  'createdAt': '2026-06-08T10:00:00.000Z',
                  'updatedAt': '2026-06-08T10:00:00.000Z',
                },
              ],
              'usage': _aiUsageJson(
                id: 'usage_homepage',
                feature: 'homepage_generator',
                output: 'A warm homepage draft for cotton kurtas.',
              ),
              'generated_at': '2026-06-08T10:00:00.000Z',
            },
            '/ai/usage/usage_1/rate': _aiUsageJson(userRating: 5),
            '/ai/credits/purchase': {
              'purchase': {
                'id': 'ai_credit_1',
                'store_id': 'store_1',
                'status': 'completed',
                'provider': 'letbuyy_sandbox',
                'provider_mode': 'sandbox',
                'credits': 100,
                'amount_minor': 10000,
                'currency': 'INR',
              },
              'credits': _aiCreditsJson(
                balance: 179,
                totalUsed: 21,
                totalPurchased: 100,
              ),
            },
          },
        );
        final service = AiStudioService(api: api);

        final snapshot = await service.fetchStudio('store_1');
        final rated = await service.rateUsage(
          snapshot.usage.single,
          rating: 5,
          feedback: 'Useful',
        );
        final generated = await service.generateContent(
          storeId: 'store_1',
          feature: 'product_description',
          prompt: 'Write copy',
        );
        final homepageDraft = await service.generateHomepageDraft(
          storeId: 'store_1',
          themeSlug: 'modern',
          prompt: 'Warm homepage for cotton kurtas',
          templateConfig: const {
            'themeId': 'modern',
            'sections': {'template': []},
          },
        );
        final purchase = await service.purchaseCredits(
          storeId: 'store_1',
          amount: 100,
        );

        expect(snapshot.credits.balance, 80);
        expect(snapshot.usage.single.featureLabel, 'Product Description');
        expect(rated.userRating, 5);
        expect(generated.id, 'usage_2');
        expect(generated.output, 'Generated cotton tee copy.');
        expect(homepageDraft.themeSlug, 'modern');
        expect(homepageDraft.sections.single['type'], 'heroBanner');
        expect(service.usage.first.id, 'usage_homepage');
        expect(purchase.completed, isTrue);
        expect(purchase.credits, 100);
        expect(service.credits?.balance, 179);
        expect(api.paths, contains('/ai/credits'));
        expect(api.paths, contains('/ai/usage'));
        expect(api.paths, contains('/ai/generate'));
        expect(api.paths, contains('/ai/homepage'));
        expect(api.paths, contains('/ai/usage/usage_1/rate'));
        expect(api.paths, contains('/ai/credits/purchase'));
        expect(
          api.bodies['/ai/generate'],
          containsPair('feature', 'product_description'),
        );
        expect(
          api.bodies['/ai/generate'],
          containsPair('prompt', 'Write copy'),
        );
        expect(
          api.bodies['/ai/homepage'],
          containsPair('prompt', 'Warm homepage for cotton kurtas'),
        );
        expect(api.bodies['/ai/usage/usage_1/rate'], containsPair('rating', 5));
        expect(api.bodies['/ai/credits/purchase'], containsPair('amount', 100));
        expect(
          api.bodies['/ai/credits/purchase'],
          containsPair('store_id', 'store_1'),
        );
      },
    );

    test('AiStudioService hides AI provider internals from users', () async {
      final service = AiStudioService(api: _AiProviderUnavailableApiClient());

      await expectLater(
        service.generateContent(
          storeId: 'store_1',
          feature: 'product_description',
          prompt: 'Write copy',
        ),
        throwsA(
          isA<AiFeatureUnavailableException>().having(
            (error) => error.toString(),
            'message',
            AiFeatureUnavailableException.message,
          ),
        ),
      );
      await expectLater(
        service.generateHomepageDraft(
          storeId: 'store_1',
          themeSlug: 'modern',
          prompt: 'Warm homepage for cotton kurtas',
          templateConfig: const {
            'themeId': 'modern',
            'sections': {'template': []},
          },
        ),
        throwsA(
          isA<AiFeatureUnavailableException>().having(
            (error) => error.toString(),
            'message',
            AiFeatureUnavailableException.message,
          ),
        ),
      );
      await expectLater(
        service.purchaseCredits(storeId: 'store_1', amount: 100),
        throwsA(
          isA<AiCreditPurchaseUnavailableException>().having(
            (error) => error.toString(),
            'message',
            AiCreditPurchaseUnavailableException.message,
          ),
        ),
      );
    });

    test(
      'AiStudioService executes AI operator tool calls through gateway APIs',
      () async {
        final api = _FakeApiClient(
          raw: {
            '/themes': {'data': [], 'current_theme': 'modern'},
          },
          json: {
            '/ai/operator': {
              'store_id': 'store_1',
              'conversation_id': 'operator_1',
              'message': 'Last 7 days: INR 1200 revenue. Create the draft work.',
              'created_at': '2026-06-08T10:00:00.000Z',
              'tool_calls': [
                {
                  'id': 'tool_metrics',
                  'tool': 'answer_metrics',
                  'label': 'Answer store metrics',
                  'status': 'completed',
                  'summary': 'Last 7 days: INR 1200 revenue.',
                  'payload': {'store_id': 'store_1'},
                  'result': {'revenue': 1200, 'orders': 4},
                },
                {
                  'id': 'tool_product',
                  'tool': 'create_product',
                  'label': 'Create draft product',
                  'status': 'ready',
                  'summary': 'Create draft product "Cotton Tee".',
                  'payload': {
                    'store_id': 'store_1',
                    'name': 'Cotton Tee',
                    'price': 499,
                    'stock': 20,
                    'is_active': false,
                  },
                },
                {
                  'id': 'tool_discount',
                  'tool': 'draft_discount',
                  'label': 'Draft discount code',
                  'status': 'ready',
                  'summary': 'Draft inactive 10% discount code LAUNCH10.',
                  'payload': {
                    'store_id': 'store_1',
                    'code': 'LAUNCH10',
                    'type': 'percentage',
                    'value': 10,
                    'is_active': false,
                  },
                },
                {
                  'id': 'tool_theme',
                  'tool': 'draft_homepage_section',
                  'label': 'Draft homepage section',
                  'status': 'ready',
                  'summary': 'Add a draft homepage hero section.',
                  'payload': {
                    'store_id': 'store_1',
                    'theme_slug': 'modern',
                    'template_config': {
                      'themeId': 'modern',
                      'sections': {
                        'template': [
                          {
                            'id': 'ai_section_1',
                            'type': 'heroBanner',
                            'visible': true,
                            'settings': {'title': 'New arrivals'},
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
            '/products': _productJson(),
            '/coupons': _couponJson(code: 'LAUNCH10', isActive: false),
            '/themes/modern/editor': {
              'version': 2,
              'store': {'id': 'store_1'},
              'theme': {'slug': 'modern'},
              'draft': {'exists': true},
              'template_config': {},
            },
            '/themes/modern/editor/draft': {
              'version': 3,
              'current_version': 3,
              'replayed': false,
              'saved_at': '2026-10-16T12:00:00Z',
              'draft': {'version': 3},
            },
          },
        );
        final service = AiStudioService(api: api);

        final result = await service.runOperatorCommand(
          storeId: 'store_1',
          message: 'Show sales this week, create product "Cotton Tee", draft 10% coupon LAUNCH10, and add homepage section "New arrivals".',
        );

        expect(result.toolCalls, hasLength(4));
        expect(
          result.toolCalls.where((call) => call.status == 'completed'),
          hasLength(4),
        );
        expect(api.paths, contains('/ai/operator'));
        expect(api.paths, contains('/products'));
        expect(api.paths, contains('/coupons'));
        expect(api.paths, contains('/themes/modern/editor/draft'));
        expect(api.bodies['/products'], containsPair('is_active', false));
        expect(api.bodies['/coupons'], containsPair('is_active', false));
        expect(
          api.bodies['/themes/modern/editor/draft'],
          containsPair('client', 'flutter-builder'),
        );
        expect(
          api.bodies['/themes/modern/editor/draft'],
          containsPair('base_version', 2),
        );
        expect(
          api.bodies['/themes/modern/editor/draft'],
          containsPair('idempotency_key', 'ai-theme:tool_theme'),
        );
        expect(
          api.paths.indexOf('/themes/modern/editor'),
          lessThan(api.paths.indexOf('/ai/operator')),
        );
        expect(api.bodies['/ai/operator'], containsPair('store_id', 'store_1'));
        expect(
          result.toolCalls.map((call) => call.summary).join(' '),
          isNot(contains('SKIP_NEEDS_HUMAN')),
        );
      },
    );

    test('P4 deep links and localization bundles resolve mobile targets', () {
      final orderTarget = AppRoutes.resolveDeepLink(
        Uri.parse('letbuyy://merchant/orders/order_123'),
      );
      final paymentTarget = AppRoutes.resolveDeepLink(
        Uri.parse('letbuyy://merchant/payment-return?status=success'),
      );
      final shareTarget = AppRoutes.resolveDeepLink(
        Uri.parse(
          'letbuyy://merchant/share/store_1?name=Demo&url=https://demo.letbuyy.com',
        ),
      );

      expect(orderTarget?.routeName, '/orders/detail');
      expect(orderTarget?.arguments['orderId'], 'order_123');
      expect(paymentTarget?.routeName, '/pricing');
      expect(shareTarget?.routeName, '/live-preview');
      expect(
        AppLocalizations.supportedLocales.map((locale) => locale.languageCode),
        containsAll(['en', 'hi', 'ta', 'bn', 'kn', 'mr', 'te']),
      );
      expect(
        const AppLocalizations(Locale('bn')).selectStore,
        'স্টোর নির্বাচন করুন',
      );
      expect(const AppLocalizations(Locale('mr')).selectStore, 'स्टोअर निवडा');
      expect(
        const AppLocalizations(Locale('te')).selectStore,
        'స్టోర్ ఎంచుకోండి',
      );
    });

    test('PlatformBlockedService keeps backend skips merchant-safe', () async {
      final service = PlatformBlockedService();

      expect(PlatformBlockedService.features, isEmpty);
      expect(
        PlatformBlockedService.featureForRoute('/features/returns'),
        isNull,
      );
      expect(PlatformBlockedService.featureForRoute('/features/kyc'), isNull);
      expect(
        PlatformBlockedService.featureForRoute('/features/two-factor'),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute('/features/business-details'),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute(
          '/features/localization-markets',
        ),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute('/features/payouts-settlement'),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute('/features/wallet'),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute('/features/commission'),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute('/features/embedded-app-bridge'),
        isNull,
      );
      expect(
        PlatformBlockedService.featureForRoute('/features/custom-data'),
        isNull,
      );
      try {
        await service.requireBackend(
          const PlatformBlockedFeature(
            id: 'TEST_ONLY',
            route: '/features/test-only',
            title: 'Test Only',
            summary: 'Hidden test seam.',
            flagKey: 'test.only',
            missingContract: 'backend contract',
            ledgerId: 'S-000',
          ),
        );
        fail('Expected requireBackend to keep fallback errors sanitized.');
      } on SkipNeedsBackendException catch (error) {
        expect(error.id, 'TEST_ONLY');
        expect(error.toString(), SkipNeedsBackendException.userMessage);
        expect(error.toString(), isNot(contains('TEST_ONLY')));
        expect(error.toString(), isNot(contains('SKIP')));
        expect(error.toString(), isNot(contains('backend contract')));
      }
    });

    test(
      'PushService registers and removes device tokens through the API',
      () async {
        final api = _FakeApiClient(
          json: {
            '/notifications/device-tokens': {'id': 'token_1'},
          },
        );
        final service = PushService(api: api, tokenProvider: () => 'dev-token');

        final registered = await service.registerCurrentDeviceToken(
          deviceName: 'Pixel test device',
        );
        await service.unregisterDeviceToken('dev-token');

        expect(registered, isTrue);
        expect(service.lastCurrentDeviceRegistrationSkipped, isFalse);
        expect(service.lastAttempt?.toJson(), {
          'token': 'dev-token',
          'platform': service.currentPlatform().apiValue,
          'device_name': 'Pixel test device',
        });
        expect(api.bodies['/notifications/device-tokens'], {
          'token': 'dev-token',
        });
        expect(api.paths, [
          '/notifications/device-tokens',
          '/notifications/device-tokens',
        ]);
      },
    );

    test(
      'PushService skips current-device registration without a token source',
      () async {
        final service = PushService(api: _FakeApiClient(json: const {}));

        final registered = await service.registerCurrentDeviceToken();

        expect(registered, isFalse);
        expect(service.lastCurrentDeviceRegistrationSkipped, isTrue);
        expect(service.lastAttempt, isNull);
      },
    );

    test('AnalyticsService assembles dashboard metrics', () async {
      final api = _FakeApiClient(
        json: {
          '/analytics/dashboard': {
            'summary': {
              'revenue': {'value': 1200, 'prev': 800, 'change_pct': 50},
              'orders': {'value': 4, 'prev': 2, 'change_pct': 100},
              'products': 2,
              'avg_order_value': 300,
            },
            'comparison': {
              'previous_period': {
                'from': '2026-05-25',
                'to': '2026-06-01',
                'label': 'Previous 7 days',
              },
              'revenue': {'value': 1200, 'prev': 800, 'change_pct': 50},
              'orders': {'value': 4, 'prev': 2, 'change_pct': 100},
              'average_order_value': {
                'value': 300,
                'prev': 400,
                'change_pct': -25,
              },
            },
          },
          '/analytics/orders': {
            'breakdown': {'paid': 3, 'pending': 1},
          },
          '/analytics/revenue': {
            'chart': [
              {'date': '2026-06-01', 'revenue': 1200, 'orders': 4},
            ],
            'comparison': {
              'previous_period': {
                'from': '2026-05-25',
                'to': '2026-06-01',
                'label': 'Previous 7 days',
              },
              'chart': [
                {'date': '2026-05-25', 'revenue': 800, 'orders': 2},
              ],
            },
          },
          '/analytics/top-products': [
            {'id': 'prod_1', 'name': 'Tee', 'total_sold': 2, 'revenue': 600},
          ],
          '/analytics/traffic-sources': {
            'available': true,
            'total_sessions': 10,
            'total_page_views': 24,
            'sources': [
              {'label': 'google', 'value': 6, 'percentage': 60},
            ],
          },
        },
      );

      final analytics = await AnalyticsService(
        api: api,
      ).getStoreAnalytics('store_1');

      expect(analytics.totalRevenue, 1200);
      expect(analytics.ordersByStatus['paid'], 3);
      expect(analytics.topProducts.single.name, 'Tee');
      expect(analytics.trafficSources.single.label, 'google');
      expect(analytics.comparison.revenue.previous, 800);
      expect(analytics.comparison.orders.changePct, 100);
      expect(analytics.comparison.averageOrderValue.changePct, -25);
      expect(analytics.comparison.previousDailyStats.single.revenue, 800);
      expect(api.queries['/analytics/revenue']?['period'], '30d');
    });

    test('AnalyticsService fetches live storefront view', () async {
      final api = _FakeApiClient(
        json: {
          '/analytics/live': {
            'available': true,
            'window_minutes': 15,
            'active_sessions': 3,
            'visitors': 8,
            'page_views': 14,
            'cart_adds': 2,
            'checkouts_started': 1,
            'top_pages': [
              {'label': '/products/tee', 'value': 7},
            ],
            'traffic_sources': [
              {'label': 'instagram', 'value': 5},
            ],
            'devices': [],
            'countries': [],
            'recent_signals': [
              {
                'metric_name': 'storefront.page.views',
                'label': '/products/tee',
                'value': 7,
                'seen_at': '2026-06-01T12:00:00.000Z',
              },
            ],
            'generated_at': '2026-06-01T12:00:05.000Z',
            'last_seen_at': '2026-06-01T12:00:00.000Z',
            'refresh_after_seconds': 30,
          },
        },
      );

      final liveView = await AnalyticsService(api: api).getLiveView('store_1');

      expect(liveView.available, isTrue);
      expect(liveView.activeSessions, 3);
      expect(liveView.topPages.single.label, '/products/tee');
      expect(liveView.trafficSources.single.value, 5);
      expect(api.paths, contains('/analytics/live'));
      expect(api.queries['/analytics/live']?['store_id'], 'store_1');
    });

    test('HomeWidgetService publishes real dashboard metrics', () async {
      SharedPreferences.setMockInitialValues({});
      final channel = MethodChannel('com.letbuyy.store/home_widgets_test');
      final calls = <MethodCall>[];
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
            calls.add(call);
            return null;
          });
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, null);
      });

      final snapshot = await HomeWidgetService(channel: channel)
          .publishDashboardSnapshot(
            store: StoreModel.fromJson(_storeJson()),
            analytics: StoreAnalytics(
              totalRevenue: 42000,
              totalOrders: 18,
              totalProducts: 7,
              totalViews: 300,
              averageOrderValue: 2333.33,
              ordersByStatus: const {'pending': 3, 'confirmed': 2, 'paid': 13},
            ),
            updatedAt: DateTime.utc(2026, 6, 1, 12),
          );

      final prefs = await SharedPreferences.getInstance();

      expect(snapshot.openOrders, 5);
      expect(prefs.getString(HomeWidgetSnapshot.storeNameKey), 'Demo Store');
      expect(prefs.getDouble(HomeWidgetSnapshot.revenueKey), 42000);
      expect(prefs.getInt(HomeWidgetSnapshot.openOrdersKey), 5);
      expect(calls.single.method, 'publishMetricsSnapshot');
      expect(
        calls.single.arguments,
        containsPair(HomeWidgetSnapshot.ordersKey, 18),
      );
      expect(
        calls.single.arguments,
        containsPair(
          HomeWidgetSnapshot.updatedAtKey,
          '2026-06-01T12:00:00.000Z',
        ),
      );
    });

    test('home widgets and watch app are registered on Android and iOS', () {
      final androidManifest = _readSource(
        appRelative: 'android/app/src/main/AndroidManifest.xml',
        repoRelative:
            'apps/mobile/merchant-app/android/app/src/main/AndroidManifest.xml',
      );
      final androidProvider = _readSource(
        appRelative:
            'android/app/src/main/kotlin/com/letbuyy/store/MerchantMetricsWidgetProvider.kt',
        repoRelative:
            'apps/mobile/merchant-app/android/app/src/main/kotlin/com/letbuyy/store/MerchantMetricsWidgetProvider.kt',
      );
      final androidLayout = _readSource(
        appRelative:
            'android/app/src/main/res/layout/merchant_metrics_widget.xml',
        repoRelative:
            'apps/mobile/merchant-app/android/app/src/main/res/layout/merchant_metrics_widget.xml',
      );
      final iosDelegate = _readSource(
        appRelative: 'ios/Runner/AppDelegate.swift',
        repoRelative: 'apps/mobile/merchant-app/ios/Runner/AppDelegate.swift',
      );
      final iosProject = _readSource(
        appRelative: 'ios/Runner.xcodeproj/project.pbxproj',
        repoRelative:
            'apps/mobile/merchant-app/ios/Runner.xcodeproj/project.pbxproj',
      );
      final iosWidget = _readSource(
        appRelative: 'ios/LetBuyyMerchantWidget/LetBuyyMerchantWidget.swift',
        repoRelative:
            'apps/mobile/merchant-app/ios/LetBuyyMerchantWidget/LetBuyyMerchantWidget.swift',
      );
      final iosWatch = _readSource(
        appRelative: 'ios/LetBuyyMerchantWatch/LetBuyyMerchantWatchApp.swift',
        repoRelative:
            'apps/mobile/merchant-app/ios/LetBuyyMerchantWatch/LetBuyyMerchantWatchApp.swift',
      );
      final iosWatchEntitlements = _readSource(
        appRelative:
            'ios/LetBuyyMerchantWatch/LetBuyyMerchantWatch.entitlements',
        repoRelative:
            'apps/mobile/merchant-app/ios/LetBuyyMerchantWatch/LetBuyyMerchantWatch.entitlements',
      );
      final dashboard = _readSource(
        appRelative: 'lib/screens/dashboard/home_screen.dart',
        repoRelative:
            'apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart',
      );

      expect(androidManifest, contains('MerchantMetricsWidgetProvider'));
      expect(androidProvider, contains('AppWidgetProvider'));
      expect(androidProvider, contains('Open LetBuyy to sync metrics'));
      expect(androidLayout, contains('widget_revenue_value'));
      expect(iosDelegate, contains('com.letbuyy.store/home_widgets'));
      expect(iosDelegate, contains('WidgetCenter.shared.reloadAllTimelines()'));
      expect(iosDelegate, contains('WatchConnectivity'));
      expect(iosDelegate, contains('updateApplicationContext'));
      expect(iosProject, contains('LetBuyyMerchantWidget.appex'));
      expect(iosProject, contains('Embed App Extensions'));
      expect(iosProject, contains('LetBuyyMerchantWatch.app'));
      expect(iosProject, contains('Embed Watch Content'));
      expect(
        iosProject,
        contains('com.apple.product-type.application.watchapp2'),
      );
      expect(iosWidget, contains('WidgetKit'));
      expect(iosWidget, contains('Open LetBuyy to sync metrics'));
      expect(iosWatch, contains('WatchConnectivity'));
      expect(iosWatch, contains('Open LetBuyy on iPhone to sync metrics'));
      expect(iosWatch, contains('Sessions'));
      expect(iosWatch, contains('formatInr'));
      expect(iosWatchEntitlements, contains('group.com.letbuyy.store'));
      expect(dashboard, contains('HomeWidgetService'));
      expect(dashboard, contains('publishDashboardSnapshot'));
    });

    test('app icon badge bridge is wired to native and push paths', () {
      final androidMainActivity = _readSource(
        appRelative:
            'android/app/src/main/kotlin/com/letbuyy/store/MainActivity.kt',
        repoRelative:
            'apps/mobile/merchant-app/android/app/src/main/kotlin/com/letbuyy/store/MainActivity.kt',
      );
      final iosDelegate = _readSource(
        appRelative: 'ios/Runner/AppDelegate.swift',
        repoRelative: 'apps/mobile/merchant-app/ios/Runner/AppDelegate.swift',
      );
      final pushDispatcher = _readSource(
        appRelative: '../../../services/queue-workers/src/push-dispatcher.ts',
        repoRelative: 'services/queue-workers/src/push-dispatcher.ts',
      );
      final queueConsumer = _readSource(
        appRelative:
            '../../../services/queue-workers/src/platform-queue-consumer.ts',
        repoRelative: 'services/queue-workers/src/platform-queue-consumer.ts',
      );
      final dashboard = _readSource(
        appRelative: 'lib/screens/dashboard/home_screen.dart',
        repoRelative:
            'apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart',
      );

      expect(androidMainActivity, contains('com.letbuyy.store/app_badge'));
      expect(
        iosDelegate,
        contains('UIApplication.shared.applicationIconBadgeNumber'),
      );
      expect(pushDispatcher, contains('badgeCountFromData'));
      expect(pushDispatcher, contains('open_order_count'));
      expect(queueConsumer, contains('resolveOpenOrderBadgeCount'));
      expect(queueConsumer, contains('badge_count'));
      expect(dashboard, contains('syncOpenOrderBadgeFromStatusCounts'));
    });

    test(
      'ThemeService reads catalog payload without native previews',
      () async {
        final api = _FakeApiClient(
          raw: {
            '/themes': {
              'data': [
                {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
              ],
              'current_theme': 'modern',
              'store_status': 'published',
            },
          },
        );

        final catalog = await ThemeService(api: api).fetchThemes('store_1');

        expect(catalog.themes.single.slug, 'modern');
        expect(catalog.currentTheme, 'modern');
      },
    );

    test(
      'ThemeService manages preview sessions and release rollback',
      () async {
        final api = _FakeApiClient(
          raw: {
            '/themes': {
              'data': [
                {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
              ],
              'current_theme': 'modern',
              'store_status': 'published',
            },
          },
          json: {
            '/themes/modern/preview-session': {
              'preview_token': 'preview_token_123',
            },
            '/themes/modern/releases': [_themeReleaseJson()],
            '/themes/modern/releases/release_1/rollback': {'ok': true},
          },
        );
        final service = ThemeService(api: api);

        final preview = await service.createPreviewSession(
          storeId: 'store_1',
          themeSlug: 'modern',
        );
        final releases = await service.fetchReleases(
          storeId: 'store_1',
          themeSlug: 'modern',
        );
        await service.rollbackRelease(
          storeId: 'store_1',
          themeSlug: 'modern',
          releaseId: 'release_1',
          rollbackMessage: 'Restore mobile-tested release',
        );

        expect(preview['preview_token'], 'preview_token_123');
        expect(releases.single['release_version'], 3);
        expect(api.paths, contains('/themes/modern/preview-session'));
        expect(api.paths, contains('/themes/modern/releases'));
        expect(
          api.paths,
          contains('/themes/modern/releases/release_1/rollback'),
        );
        expect(api.bodies['/themes/modern/releases/release_1/rollback'], {
          'store_id': 'store_1',
          'make_store_live': true,
          'rollback_message': 'Restore mobile-tested release',
        });
      },
    );

    test('ThemeService publishes canonical Liquid template config', () async {
      final api = _FakeApiClient(
        raw: {
          '/themes': {
            'data': [
              {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
            ],
            'current_theme': 'modern',
          },
        },
        json: {
          '/themes/modern/editor/draft': {
            'version': 3,
            'current_version': 3,
            'replayed': false,
            'saved_at': '2026-10-16T12:00:00Z',
            'draft': {'version': 3},
          },
          '/themes/modern/publish': {
            'version': 4,
            'current_version': 4,
            'replayed': false,
            'release': {'release_id': 'release_1'},
          },
        },
      );
      final service = ThemeService(api: api);

      await service.publish(
        storeId: 'store_1',
        themeSlug: 'modern',
        templateConfig: const {
          'themeId': 'modern',
          'sections': {'hero': {}},
        },
        liquidBundle: const {
          'schema_version': '2026-06-liquid-sections',
          'layout': {
            'path': 'layout/theme.liquid',
            'source': '<main>{{ content_for_layout }}</main>',
          },
          'sections': <Map<String, dynamic>>[],
          'templates': <String, dynamic>{},
        },
        liquidRenderingCanary: true,
        baseVersion: 2,
      );

      final saveBody = Map<String, dynamic>.from(
        api.bodies['/themes/modern/editor/draft'] as Map,
      );
      expect(saveBody.remove('idempotency_key'), isNotEmpty);
      expect(saveBody, {
        'store_id': 'store_1',
        'template_config': {
          'themeId': 'modern',
          'sections': {'hero': {}},
          'liquidBundle': {
            'schema_version': '2026-06-liquid-sections',
            'layout': {
              'path': 'layout/theme.liquid',
              'source': '<main>{{ content_for_layout }}</main>',
            },
            'sections': <Map<String, dynamic>>[],
            'templates': <String, dynamic>{},
          },
          'liquidRenderingCanary': true,
        },
        'base_version': 2,
        'template_key': 'index',
        'client': 'flutter-builder',
      });
      final publishBody = Map<String, dynamic>.from(
        api.bodies['/themes/modern/publish'] as Map,
      );
      expect(publishBody.remove('idempotency_key'), isNotEmpty);
      expect(publishBody, {
        'store_id': 'store_1',
        'template_key': 'index',
        'base_version': 3,
        'make_store_live': true,
      });
      expect(
        api.paths.indexOf('/themes/modern/editor/draft'),
        lessThan(api.paths.indexOf('/themes/modern/publish')),
      );
    });

    test('ThemeService maps stale editor saves to conflict guidance', () async {
      const conflict = ApiException(
        message: 'Theme draft has changed in another session',
        statusCode: 409,
        code: 'CONFLICT',
      );
      final api = _FakeApiClient(
        errors: {
          '/themes/modern/editor/draft': conflict,
          '/themes/modern/publish': conflict,
        },
      );
      final service = ThemeService(api: api);

      await expectLater(
        service.saveDraft(
          storeId: 'store_1',
          themeSlug: 'modern',
          templateConfig: const {
            'themeId': 'modern',
            'sections': {'template': []},
          },
          baseVersion: 0,
        ),
        throwsA(isA<ThemeDraftConflictException>()),
      );
      await expectLater(
        service.publish(storeId: 'store_1', themeSlug: 'modern', baseVersion: 2),
        throwsA(isA<ThemeDraftConflictException>()),
      );

      expect(
        api.bodies['/themes/modern/editor/draft'],
        containsPair('base_version', 0),
      );
      expect(
        api.bodies['/themes/modern/publish'],
        containsPair('base_version', 2),
      );
    });

    test(
      'SubscriptionService creates and verifies Razorpay checkout',
      () async {
        FlutterSecureStorage.setMockInitialValues({});
        final api = _FakeApiClient(
          json: {
            'payments/subscription/order': {
              'razorpay_order_id': 'order_123',
              'amount': 39900,
              'currency': 'INR',
              'key_id': 'rzp_test_public',
            },
            '/payments/subscription/recover': {
              'razorpay_order_id': 'order_recover_123',
              'amount': 39900,
              'currency': 'INR',
              'key_id': 'rzp_test_public',
              'recovery': {
                'subscription_id': 'sub_1',
                'previous_status': 'past_due',
                'plan_slug': 'business',
                'next_step': 'checkout',
              },
            },
            'payments/subscription/verify': {
              'subscription': {'id': 'sub_1', 'status': 'active'},
            },
          },
        );
        final service = SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor');

        final checkout = await service.createSubscriptionOrder(
          storeId: 'store_1',
          plan: SubscriptionPlan.business,
        );
        final recovery = await service.recoverFailedPayment(storeId: 'store_1');
        await service.verifySubscriptionPayment(
          storeId: 'store_1',
          plan: SubscriptionPlan.business,
          razorpayPaymentId: 'pay_123',
          razorpaySignature: 'sig_123',
          razorpayOrderId: 'order_123',
        );

        expect(checkout['razorpay_order_id'], 'order_123');
        expect(recovery['razorpay_order_id'], 'order_recover_123');
        expect(api.paths, contains('/payments/subscription/recover'));
        expect(api.bodies['/payments/subscription/recover'], {
          'store_id': 'store_1',
        });
        expect(api.paths, contains('payments/subscription/verify'));
      },
    );

    test('SubscriptionService reads billing history invoices', () async {
      final api = _FakeApiClient(
        json: {
          '/payments/subscription/history': [_billingHistoryJson()],
        },
      );
      final service = SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor');

      final history = await service.fetchBillingHistory('store_1');

      expect(history.single.status, 'paid');
      expect(history.single.billingPeriod, 'monthly');
      expect(history.single.amountLabel, 'INR 399.00');
      expect(api.paths, contains('/payments/subscription/history'));
    });
  });

  group('StoreAuthService', () {
    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('requests signup OTP with CSRF cookie and Turnstile token', () async {
      final requests = <http.Request>[];
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          requests.add(request);
          if (request.url.path == '/login') {
            return http.Response(
              '',
              200,
              headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
            );
          }
          return http.Response(
            '{"success":true,"needsVerification":true,"message":"sent"}',
            200,
          );
        }),
      );

      final pending = await auth.requestSignUpOtp('M@Example.COM');

      expect(pending.email, 'm@example.com');
      expect(requests.last.url.path, '/api/auth/signup');
      expect(requests.last.body, contains('turnstile_token'));
      expect(requests.last.headers['X-CSRF-Token'], 'csrf_123');
    });

    test('verifies Turnstile with the mobile BFF before password login', () async {
      final requests = <http.Request>[];
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        mobileBffBaseUrl: 'https://bff.test/v1',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          requests.add(request);
          switch (request.url.host) {
            case 'bff.test':
              expect(request.url.path, '/v1/auth/mobile/turnstile/verify');
              expect(request.body, contains('turnstile_token'));
              return http.Response(
                '{"success":true,"verification":{"proof_token":"lb-mobile-turnstile-v1.proof.signature"}}',
                200,
              );
            case 'accounts.test':
              if (request.url.path == '/login') {
                return http.Response(
                  '',
                  200,
                  headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
                );
              }
              if (request.url.path == '/api/auth/login') {
                expect(
                  request.body,
                  contains('lb-mobile-turnstile-v1.proof.signature'),
                );
                expect(request.body, isNot(contains('turnstile_token')));
                return http.Response(
                  '{"success":true}',
                  200,
                  headers: {'set-cookie': 'lb_session=session_123; Path=/;'},
                );
              }
              if (request.url.path == '/api/auth/session') {
                return http.Response(
                  '{"authenticated":true,"user":{"id":"user_1","email":"m@example.com"}}',
                  200,
                );
              }
          }
          return http.Response('not found', 404);
        }),
      );

      final user = await auth.signInWithPassword(
        'M@Example.COM',
        'Password123',
      );

      expect(user?.email, 'm@example.com');
      expect(requests.map((request) => request.url.host), [
        'accounts.test',
        'bff.test',
        'accounts.test',
        'accounts.test',
      ]);
    });

    test('verifies OTP, sets password, and persists lb_session', () async {
      final auth = StoreAuthService(
        api: _FakeApiClient(),
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile_token',
        httpClient: MockClient((request) async {
          switch (request.url.path) {
            case '/login':
              return http.Response(
                '',
                200,
                headers: {'set-cookie': 'letbuyy_csrf=csrf_123; Path=/;'},
              );
            case '/api/auth/signup':
              return http.Response(
                '{"success":true,"needsVerification":true}',
                200,
              );
            case '/api/auth/verify-otp':
              return http.Response(
                '{"success":true,"verified":true}',
                200,
                headers: {
                  'set-cookie': 'password_set_intent=intent_1; Path=/;',
                },
              );
            case '/api/auth/set-password':
              return http.Response(
                '{"success":true}',
                200,
                headers: {'set-cookie': 'lb_session=session_123; Path=/;'},
              );
            case '/api/auth/session':
              return http.Response(
                '{"authenticated":true,"user":{"id":"user_1","email":"m@example.com"}}',
                200,
              );
          }
          return http.Response('not found', 404);
        }),
      );

      await auth.requestSignUpOtp('m@example.com');
      final user = await auth.signUp(
        'm@example.com',
        'Password123',
        otp: '123456',
      );
      final storage = const FlutterSecureStorage();

      expect(user?.email, 'm@example.com');
      expect(await storage.read(key: 'lb_session'), 'session_123');
      expect(auth.isSignedIn, isTrue);
    });

    test(
      'refreshes valid sessions and expires invalid sessions safely',
      () async {
        final storage = const FlutterSecureStorage();
        final futureExpiry = DateTime.now()
            .add(const Duration(hours: 2))
            .toUtc()
            .toIso8601String();
        final auth = StoreAuthService(
          api: _FakeApiClient(),
          identityBaseUrl: 'https://accounts.test',
          turnstileTokenProvider: () => 'turnstile_token',
          httpClient: MockClient((request) async {
            if (request.url.path == '/api/auth/session') {
              return http.Response(
                '{"authenticated":true,"expires_at":"$futureExpiry","user":{"id":"user_1","email":"m@example.com"}}',
                200,
              );
            }
            return http.Response('not found', 404);
          }),
        );
        final events = <AuthChangeEvent>[];
        final sub = auth.authStateChanges.listen(
          (event) => events.add(event.event),
        );

        await storage.write(key: 'lb_session', value: 'session_123');
        await storage.write(
          key: 'lb_session_user',
          value: jsonEncode({'id': 'user_1', 'email': 'm@example.com'}),
        );

        expect(await auth.refreshSession(), isTrue);
        await Future<void>.delayed(Duration.zero);
        expect(auth.isSignedIn, isTrue);
        expect(auth.sessionExpiresAt?.toUtc().toIso8601String(), futureExpiry);
        expect(events, contains(AuthChangeEvent.tokenRefreshed));

        final expiredAuth = StoreAuthService(
          api: _FakeApiClient(),
          identityBaseUrl: 'https://accounts.test',
          turnstileTokenProvider: () => 'turnstile_token',
          httpClient: MockClient((request) async {
            return http.Response('{"authenticated":false}', 401);
          }),
        );
        final expiredEvents = <AuthChangeEvent>[];
        final expiredSub = expiredAuth.authStateChanges.listen(
          (event) => expiredEvents.add(event.event),
        );

        await storage.write(key: 'lb_session', value: 'expired_session');
        await storage.write(
          key: 'lb_session_user',
          value: jsonEncode({'id': 'user_1', 'email': 'm@example.com'}),
        );

        expect(await expiredAuth.refreshSession(), isFalse);
        await Future<void>.delayed(Duration.zero);
        expect(expiredAuth.isSignedIn, isFalse);
        expect(await storage.read(key: 'lb_session'), isNull);
        expect(expiredEvents, contains(AuthChangeEvent.sessionExpired));

        await sub.cancel();
        await expiredSub.cancel();
      },
    );

    test('LoginScreen exposes a generic expired-session notice', () {
      final loginSourceFile = [
        File('apps/mobile/merchant-app/lib/screens/auth/login_screen.dart'),
        File('lib/screens/auth/login_screen.dart'),
      ].firstWhere((file) => file.existsSync());
      final wrapperSourceFile = [
        File('apps/mobile/merchant-app/lib/app/auth_wrapper.dart'),
        File('lib/app/auth_wrapper.dart'),
      ].firstWhere((file) => file.existsSync());
      final loginSource = loginSourceFile.readAsStringSync();
      final wrapperSource = wrapperSourceFile.readAsStringSync();

      expect(loginSource, contains('sessionNotice'));
      expect(
        wrapperSource,
        contains('Your session expired. Please sign in again.'),
      );
      expect(loginSource, isNot(contains('401')));
      expect(loginSource, isNot(contains('UNAUTHORIZED')));
      expect(wrapperSource, isNot(contains('401')));
      expect(wrapperSource, isNot(contains('UNAUTHORIZED')));
    });
  });

  testWidgets('OrderDetailScreen renders customer, totals, and actions', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    late final StoreContext storeContext;
    final api = _FakeApiClient(
      json: {'/orders/order_1': _orderJson()},
      paginated: {'/stores': [_storeJson()]},
      contextVersionProvider: () => storeContext.requestContextKey,
    );
    storeContext = StoreContext(storeService: StoreService(api: api));
    await storeContext.ensureSelectedStore();
    addTearDown(storeContext.dispose);
    final orderService = OrderService(api: api);
    final order = OrderContract.fromJson(
      _orderJson(
        riskScore: 72,
        riskLevel: 'high',
        fulfillmentState: 'hold',
        codConfirmationStatus: 'requested',
        rtoStatus: 'at_risk',
      ),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: storeContext),
          ChangeNotifierProvider<OrderService>.value(value: orderService),
        ],
        child: MaterialApp(
          home: OrderDetailScreen(orderId: order.id, initialOrder: order),
        ),
      ),
    );
    await tester.pump();
    for (
      var attempt = 0;
      attempt < 10 && find.text('Meera Merchant').evaluate().isEmpty;
      attempt += 1
    ) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(find.text('Risk signal'), findsOneWidget);
    expect(find.text('High risk'), findsOneWidget);
    expect(find.text('Score 72/100'), findsOneWidget);
    expect(find.text('Fulfillment hold is active.'), findsOneWidget);
    expect(find.text('COD confirmation requested.'), findsOneWidget);
    expect(find.text('RTO watchlist active.'), findsOneWidget);
    expect(api.paths, isNot(contains('/orders/order_1')));
    await tester.drag(find.byType(ListView), const Offset(0, -250));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Customer'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Line items'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('Edit'), findsOneWidget);
    expect(find.text('Refund'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Cancel'), findsOneWidget);
  });

  testWidgets('OrderDetailScreen cancels an order with a reason', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    late final StoreContext storeContext;
    final api = _FakeApiClient(
      json: {'/orders/order_1': _orderJson(status: 'cancelled')},
      paginated: {'/stores': [_storeJson()]},
      contextVersionProvider: () => storeContext.requestContextKey,
    );
    storeContext = StoreContext(storeService: StoreService(api: api));
    await storeContext.ensureSelectedStore();
    addTearDown(storeContext.dispose);
    final orderService = OrderService(api: api);
    final order = OrderContract.fromJson(_orderJson());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: storeContext),
          ChangeNotifierProvider<OrderService>.value(value: orderService),
        ],
        child: MaterialApp(
          home: OrderDetailScreen(orderId: order.id, initialOrder: order),
        ),
      ),
    );
    await tester.pump();
    for (
      var attempt = 0;
      attempt < 10 && find.text('Payment needs attention').evaluate().isEmpty;
      attempt += 1
    ) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancel'));
    await tester.pumpAndSettle();

    expect(find.text('Cancellation reason'), findsOneWidget);
    await tester.enterText(
      find.byType(TextField).last,
      'Customer requested cancellation',
    );
    await tester.pump();
    await tester.tap(find.text('Cancel order'));
    await tester.pumpAndSettle();

    expect(
      api.bodies['/orders/order_1'],
      containsPair('cancellation_reason', 'Customer requested cancellation'),
    );
    expect(api.bodies['/orders/order_1'], containsPair('status', 'cancelled'));
  });

  testWidgets('ReturnsScreen renders RMA rows from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/returns': [_returnJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ReturnService(api: api)),
        ],
        child: const MaterialApp(home: ReturnsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Returns'), findsOneWidget);
    expect(find.text('order_1'), findsWidgets);
    expect(find.textContaining('Wrong size'), findsOneWidget);
    expect(find.textContaining('backend contract'), findsNothing);
  });

  testWidgets('StoreHealthScreen renders real health pillars', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {'/stores/store_1/health': _storeHealthJson()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: _storeProviders(api),
        child: const MaterialApp(home: StoreHealthScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Store Health'), findsOneWidget);
    expect(find.text('Needs attention'), findsOneWidget);
    expect(find.text('Launch readiness'), findsOneWidget);
    expect(find.text('Catalog and inventory'), findsOneWidget);
    expect(find.textContaining('backend contract'), findsNothing);
  });

  testWidgets('CustomersScreen renders customer list from gateway service', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/customers': [_customerJson()],
      },
      json: {
        '/customers': {
          ..._customerJson(),
          'id': 'customer_2',
          'email': 'anu@example.com',
          'display_name': 'Anu Buyer',
          'first_name': 'Anu',
          'last_name': 'Buyer',
        },
        '/customers/segments': [_customerSegmentJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
        ],
        child: const MaterialApp(home: CustomersScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Customers'), findsWidgets);
    expect(find.text('Meera Merchant'), findsOneWidget);
    expect(find.text('meera@example.com'), findsOneWidget);
    expect(find.textContaining('VIP customers'), findsOneWidget);

    await tester.tap(find.byTooltip('Add customer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.enterText(
      find.byKey(const Key('customer-name-field')),
      'Anu Buyer',
    );
    await tester.enterText(
      find.byKey(const Key('customer-email-field')),
      'anu@example.com',
    );
    await tester.enterText(
      find.byKey(const Key('customer-phone-field')),
      '+919876543210',
    );
    await tester.enterText(find.byKey(const Key('customer-tags-field')), 'vip');
    await tester.ensureVisible(find.text('Save customer'));
    await tester.tap(find.text('Save customer'));
    await tester.pump();
    for (
      var attempt = 0;
      attempt < 10 &&
          find.byKey(const Key('customer-name-field')).evaluate().isNotEmpty;
      attempt += 1
    ) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(find.text('Anu Buyer'), findsOneWidget);
    expect(api.bodies['/customers'], {
      'store_id': 'store_1',
      'email': 'anu@example.com',
      'first_name': 'Anu',
      'last_name': 'Buyer',
      'phone': '+919876543210',
      'tags': ['vip'],
      'accepts_marketing': false,
    });
  });

  testWidgets('CustomerDetailScreen renders addresses and recent orders', (
    tester,
  ) async {
    final api = _FakeApiClient(
      json: {
        '/customers/meera%40example.com': _customerJson(),
        '/customers/meera%40example.com/notes': [_noteJson()],
        '/customers/meera%40example.com/addresses': [_addressJson()],
        '/whatsapp/status': _whatsAppStatusJson(),
        '/whatsapp/timeline': [_whatsAppMessageJson()],
      },
      paginated: {
        '/orders': [_orderJson()],
      },
    );
    final customer = CustomerContract.fromJson(_customerJson());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => CustomerService(api: api)),
          ChangeNotifierProvider(create: (_) => WhatsAppService(api: api)),
          ChangeNotifierProvider(create: (_) => OrderService(api: api)),
        ],
        child: MaterialApp(
          home: CustomerDetailScreen(
            email: 'meera@example.com',
            initialCustomer: customer,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Meera Merchant'), findsWidgets);
    expect(api.paths, isNot(contains('/customers/meera%40example.com')));
    expect(find.byTooltip('Edit customer'), findsOneWidget);
    expect(find.byTooltip('Email customer'), findsOneWidget);
    expect(find.byTooltip('WhatsApp customer'), findsOneWidget);
    expect(find.byTooltip('Customer actions'), findsOneWidget);
    expect(find.text('Customer CRM'), findsOneWidget);
    expect(find.text('WhatsApp'), findsOneWidget);
    expect(find.text('Order update sent.'), findsOneWidget);
    expect(find.text('vip'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Addresses'), 200);
    await tester.pumpAndSettle();
    expect(find.text('Addresses'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Recent orders'), 200);
    await tester.pumpAndSettle();
    expect(find.text('Recent orders'), findsOneWidget);
    expect(find.text('order_1'), findsOneWidget);
  });

  testWidgets('InventoryScreen renders stock levels and low-stock filter', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/inventory/levels': [_inventoryJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Inventory'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('TEE-001'), findsOneWidget);
    expect(find.text('Adjust'), findsOneWidget);
    expect(find.text('Locations'), findsOneWidget);
    expect(find.text('Purchase orders'), findsOneWidget);
  });

  testWidgets('InventoryLocationsScreen renders WMS locations', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/locations': [_locationJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryLocationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Locations'), findsOneWidget);
    expect(find.text('North warehouse'), findsOneWidget);
    expect(find.text('Default'), findsOneWidget);
  });

  testWidgets('InventorySuppliersScreen renders supplier contacts', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/suppliers': [_supplierJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventorySuppliersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Suppliers'), findsOneWidget);
    expect(find.text('Acme Textiles'), findsOneWidget);
    expect(find.text('riya@example.com'), findsOneWidget);
  });

  testWidgets('PurchaseOrdersScreen renders receive workflow', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/purchase-orders': [_purchaseOrderJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: PurchaseOrdersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Purchase orders'), findsOneWidget);
    expect(find.text('Acme Textiles'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);
  });

  testWidgets('InventoryTransfersScreen renders transfer actions', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/inventory/transfers': [_transferJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => InventoryService(api: api)),
        ],
        child: const MaterialApp(home: InventoryTransfersScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Transfers'), findsOneWidget);
    expect(find.text('loc_1 -> loc_2'), findsOneWidget);
    expect(find.text('Ship'), findsOneWidget);
    expect(find.text('Receive'), findsOneWidget);
  });

  testWidgets('CouponsScreen renders coupon list and actions', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/coupons': [_couponJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => CouponService(api: api)),
        ],
        child: const MaterialApp(home: CouponsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Coupons'), findsWidgets);
    expect(find.text('SAVE10'), findsOneWidget);
    expect(find.text('Active'), findsWidgets);
  });

  testWidgets('CollectionsScreen renders collection merchandising rows', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/products/collections': [_collectionJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ProductService(api: api)),
        ],
        child: const MaterialApp(home: CollectionsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Collections'), findsOneWidget);
    expect(find.text('Summer picks'), findsOneWidget);
    expect(find.text('Seasonal merchandising'), findsOneWidget);
    expect(find.text('6 products'), findsOneWidget);
    expect(find.text('/collections/summer-picks'), findsOneWidget);
    expect(find.text('New collection'), findsOneWidget);
  });

  testWidgets('ProductsScreen can seed a sample product for an empty catalog', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/products': const <Map<String, dynamic>>[],
      },
      json: {'/products/sample': _sampleProductJson()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ProductService(api: api)),
        ],
        child: const MaterialApp(home: ProductsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No Products Yet'), findsOneWidget);
    expect(find.text('Add sample product'), findsOneWidget);

    final sampleButton = find.widgetWithText(
      OutlinedButton,
      'Add sample product',
    );
    await tester.ensureVisible(sampleButton);
    await tester.tap(sampleButton);
    await tester.pumpAndSettle();

    expect(api.bodies['/products/sample'], {'store_id': 'store_1'});
    expect(find.text('Sample Product - Cotton Tote'), findsOneWidget);
    expect(find.text('Inactive'), findsWidgets);
  });

  testWidgets('ProductsScreen edits seller-entered importer disclosure', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});

    Future<void> pumpRouteTransition() async {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    }

    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/products': [
          {
            ..._productJson(),
            'description': 'A cotton tee for the edit journey.',
            'images': ['https://cdn.test/products/cotton-tee.jpg'],
            'country_of_origin': 'Japan',
            'importer_details': 'Example Imports, Mumbai',
          },
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ProductService(api: api)),
        ],
        child: const MaterialApp(home: ProductsScreen()),
      ),
    );
    await pumpRouteTransition();

    expect(find.text('Cotton Tee'), findsOneWidget);
    final productCard = find.byKey(const ValueKey('product-card-prod_1'));
    await tester.ensureVisible(productCard);
    await pumpRouteTransition();
    final cardSemantics = tester.getSemantics(productCard).getSemanticsData();
    expect(cardSemantics.label, startsWith('Product Cotton Tee, Active'));
    expect(cardSemantics.hint, 'Opens product editor');
    expect(cardSemantics.hasFlag(SemanticsFlag.isButton), isTrue);
    expect(cardSemantics.hasFlag(SemanticsFlag.isEnabled), isTrue);
    expect(cardSemantics.hasAction(SemanticsAction.tap), isTrue);

    final productName = find.descendant(
      of: productCard,
      matching: find.text('Cotton Tee'),
    );
    Focus.of(tester.element(productName)).requestFocus();
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await pumpRouteTransition();

    expect(find.text('Edit Product'), findsOneWidget);
    tester.widget<Stepper>(find.byType(Stepper)).onStepTapped!(4);
    await pumpRouteTransition();
    expect(find.text('Country of origin (optional)'), findsOneWidget);
    expect(find.text('Importer details (optional)'), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const ValueKey('importer-details')))
          .controller
          ?.text,
      'Example Imports, Mumbai',
    );

    await tester.enterText(
      find.byKey(const ValueKey('country-of-origin')),
      ' India ',
    );
    await tester.enterText(
      find.byKey(const ValueKey('importer-details')),
      ' Updated Imports, Delhi ',
    );
    await tester.tap(find.widgetWithText(TextButton, 'Update'));
    await pumpRouteTransition();

    expect(
      api.paths,
      contains('/products/prod_1'),
      reason: 'update API trace: ${api.paths}',
    );
    expect(
      api.bodies['/products/prod_1'],
      containsPair('country_of_origin', 'India'),
    );
    expect(
      api.bodies['/products/prod_1'],
      containsPair('importer_details', 'Updated Imports, Delhi'),
    );
  });

  testWidgets('product bulk selection announces the selected state', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final semantics = tester.ensureSemantics();
    try {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
          '/products': [
            _productJson(),
            {..._productJson(), 'id': 'prod_2', 'name': 'Blue Mug'},
          ],
        },
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ..._storeProviders(api),
            ChangeNotifierProvider(create: (_) => ProductService(api: api)),
          ],
          child: const MaterialApp(home: ProductsScreen()),
        ),
      );
      await tester.pumpAndSettle();

      final selectionToggle = find.bySemanticsLabel('Select');
      expect(
        tester.getSemantics(selectionToggle),
        matchesSemantics(
          label: 'Select',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
        ),
      );
      await tester.tap(selectionToggle);
      await tester.pumpAndSettle();

      final selectProduct = find.byKey(const ValueKey('product-select-prod_1'));
      final unselectedData = tester
          .getSemantics(selectProduct)
          .getSemanticsData();
      expect(unselectedData.label, 'Select product Cotton Tee');
      expect(unselectedData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(unselectedData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(unselectedData.hasFlag(SemanticsFlag.isSelected), isFalse);
      expect(unselectedData.hasAction(SemanticsAction.tap), isTrue);

      final checkboxInkWell = find.descendant(
        of: selectProduct,
        matching: find.byType(InkWell),
      );
      final checkboxVisual = find.descendant(
        of: checkboxInkWell,
        matching: find.byType(Container),
      );
      Focus.of(tester.element(checkboxVisual.first)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      final deselectProduct = find.byKey(
        const ValueKey('product-select-prod_1'),
      );
      final selectedData = tester
          .getSemantics(deselectProduct)
          .getSemanticsData();
      expect(selectedData.label, 'Deselect product Cotton Tee');
      expect(selectedData.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(selectedData.hasAction(SemanticsAction.tap), isTrue);
      final productCard = tester
          .getSemantics(find.byKey(const ValueKey('product-card-prod_1')))
          .getSemanticsData();
      expect(productCard.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(find.text('1 selected'), findsOneWidget);

      final selectAll = find.byKey(
        const ValueKey('products-select-all-visible'),
      );
      final selectAllData = tester.getSemantics(selectAll).getSemanticsData();
      expect(selectAllData.label, '1 products selected');
      expect(selectAllData.hint, 'Select all visible products');
      expect(selectAllData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(selectAllData.hasAction(SemanticsAction.tap), isTrue);

      final selectAllInkWell = find.descendant(
        of: selectAll,
        matching: find.byType(InkWell),
      );
      final selectAllContainer = find.descendant(
        of: selectAllInkWell,
        matching: find.byType(Container),
      );
      Focus.of(tester.element(selectAllContainer.first)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      expect(find.text('2 selected'), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('product status filters support keyboard selection', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final semantics = tester.ensureSemantics();
    try {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
          '/products': [
            _productJson(),
            {
              ..._productJson(),
              'id': 'prod_2',
              'name': 'Paused Tee',
              'is_active': false,
            },
          ],
        },
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ..._storeProviders(api),
            ChangeNotifierProvider(create: (_) => ProductService(api: api)),
          ],
          child: const MaterialApp(home: ProductsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cotton Tee'), findsOneWidget);
      expect(find.text('Paused Tee'), findsOneWidget);

      final inactiveFilter = find.byKey(
        const ValueKey('product-filter-inactive'),
      );
      final inactiveData = tester
          .getSemantics(inactiveFilter)
          .getSemanticsData();
      expect(inactiveData.label, 'Inactive products filter');
      expect(inactiveData.hint, 'Show Inactive products');
      expect(inactiveData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(inactiveData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(inactiveData.hasFlag(SemanticsFlag.isSelected), isFalse);
      expect(inactiveData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(inactiveFilter).height, greaterThanOrEqualTo(48));

      final chipText = find.descendant(
        of: inactiveFilter,
        matching: find.text('Inactive'),
      );
      Focus.of(tester.element(chipText)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      final activeFilterData = tester
          .getSemantics(inactiveFilter)
          .getSemanticsData();
      expect(activeFilterData.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(activeFilterData.hint, 'Current filter');
      expect(find.text('Paused Tee'), findsOneWidget);
      expect(find.text('Cotton Tee'), findsNothing);
      expect(tester.takeException(), isNull);
      expect(api.paths, containsAll(['/stores', '/products']));
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('order status filters support keyboard selection', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          AppBadgeService.defaultChannel,
          (_) async => null,
        );
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(AppBadgeService.defaultChannel, null),
    );
    final semantics = tester.ensureSemantics();
    try {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
          '/orders': [
            _orderJson(id: 'pending_1', status: 'pending'),
            _orderJson(id: 'delivered_1', status: 'delivered'),
          ],
        },
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: _merchantShellProviders(api),
          child: const MaterialApp(home: OrdersScreen()),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(api.paths, containsAll(['/stores', '/orders']));
      expect(
        Provider.of<OrderService>(
          tester.element(find.byType(OrdersScreen)),
          listen: false,
        ).orders,
        hasLength(2),
      );
      expect(find.text('pending_1'), findsOneWidget);
      expect(find.text('delivered_1'), findsOneWidget);

      final pendingFilter = find.byKey(const ValueKey('order-filter-pending'));
      final pendingData = tester.getSemantics(pendingFilter).getSemanticsData();
      expect(pendingData.label, 'Pending orders filter');
      expect(pendingData.hint, 'Show Pending orders');
      expect(pendingData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(pendingData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(pendingData.hasFlag(SemanticsFlag.isSelected), isFalse);
      expect(pendingData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(pendingFilter).height, greaterThanOrEqualTo(48));

      final chipText = find.descendant(
        of: pendingFilter,
        matching: find.text('Pending'),
      );
      Focus.of(tester.element(chipText)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      final activeFilterData = tester
          .getSemantics(pendingFilter)
          .getSemanticsData();
      expect(activeFilterData.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(activeFilterData.hint, 'Current filter');
      expect(find.text('pending_1'), findsOneWidget);
      expect(find.text('delivered_1'), findsNothing);
      expect(tester.takeException(), isNull);
      expect(api.paths, containsAll(['/stores', '/orders']));
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('order cards support keyboard selection with named semantics', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          AppBadgeService.defaultChannel,
          (_) async => null,
        );
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(AppBadgeService.defaultChannel, null),
    );
    final semantics = tester.ensureSemantics();
    try {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
          '/orders': [
            _orderJson(id: 'pending_1', status: 'pending'),
            _orderJson(id: 'pending_2', status: 'pending'),
          ],
        },
      );
      await tester.pumpWidget(
        MultiProvider(
          providers: _merchantShellProviders(api),
          child: const MaterialApp(home: OrdersScreen()),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      final orderCard = find.byKey(const ValueKey('order-card-pending_1'));
      final cardData = tester.getSemantics(orderCard).getSemanticsData();
      expect(cardData.label, contains('Order pending_1'));
      expect(cardData.label, contains('Customer Meera Merchant'));
      expect(cardData.hint, 'Opens order details');
      expect(cardData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(cardData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(cardData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(orderCard).height, greaterThanOrEqualTo(48));

      await tester.tap(find.text('Select').first);
      await tester.pump();
      final selectionCardData = tester
          .getSemantics(orderCard)
          .getSemanticsData();
      expect(selectionCardData.hint, 'Tap to select order');
      expect(selectionCardData.hasFlag(SemanticsFlag.isSelected), isFalse);

      Focus.of(tester.element(find.text('pending_1'))).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();

      final selectedCardData = tester
          .getSemantics(orderCard)
          .getSemanticsData();
      expect(selectedCardData.hint, 'Tap to deselect order');
      expect(selectedCardData.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(find.text('1 selected'), findsOneWidget);

      final checkbox = find.byKey(const ValueKey('order-select-pending_1'));
      final checkboxData = tester.getSemantics(checkbox).getSemanticsData();
      expect(checkboxData.label, 'Deselect order pending_1');
      expect(checkboxData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(checkboxData.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(checkboxData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(checkbox).height, greaterThanOrEqualTo(48));

      final selectAll = find.byKey(
        const ValueKey('orders-select-all-visible'),
      );
      final selectAllData = tester.getSemantics(selectAll).getSemanticsData();
      expect(selectAllData.label, '1 orders selected');
      expect(selectAllData.hint, 'Select all visible orders');
      expect(selectAllData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(selectAllData.hasAction(SemanticsAction.tap), isTrue);

      final selectAllInkWell = find.descendant(
        of: selectAll,
        matching: find.byType(InkWell),
      );
      final selectAllContainer = find.descendant(
        of: selectAllInkWell,
        matching: find.byType(Container),
      );
      Focus.of(tester.element(selectAllContainer.first)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      expect(find.text('2 selected'), findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(api.paths, containsAll(['/stores', '/orders']));
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('store info URL copy supports keyboard activation', (
    tester,
  ) async {
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    Map<String, dynamic>? copiedClipboardData;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        copiedClipboardData = Map<String, dynamic>.from(call.arguments);
      }
      return null;
    });
    addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
    );

    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: StoreInfoCard(
              storeName: 'Demo store',
              storeUrl: 'https://demo.letbuyy.com',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final copyUrl = find.byKey(const ValueKey('store-info-copy-url'));
      final copyUrlData = tester.getSemantics(copyUrl).getSemanticsData();
      expect(copyUrlData.label, 'Copy store URL https://demo.letbuyy.com');
      expect(copyUrlData.hint, 'Copies the store URL to the clipboard');
      expect(copyUrlData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(copyUrlData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(copyUrl).height, greaterThanOrEqualTo(48));

      final copyUrlText = find.descendant(
        of: copyUrl,
        matching: find.text('https://demo.letbuyy.com'),
      );
      Focus.of(tester.element(copyUrlText)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();

      expect(copiedClipboardData?['text'], 'https://demo.letbuyy.com');
      expect(find.text('URL copied!'), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('dashboard period picker supports keyboard and reloads metrics', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'letbuyy.selected_store_id': 'store_1',
    });
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    Map<String, dynamic>? copiedClipboardData;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        copiedClipboardData = Map<String, dynamic>.from(call.arguments);
      }
      return null;
    });
    messenger.setMockMethodCallHandler(
      AppBadgeService.defaultChannel,
      (_) async => null,
    );
    messenger.setMockMethodCallHandler(
      HomeWidgetService.defaultChannel,
      (_) async => null,
    );
    addTearDown(() {
      messenger.setMockMethodCallHandler(SystemChannels.platform, null);
      messenger.setMockMethodCallHandler(AppBadgeService.defaultChannel, null);
      messenger.setMockMethodCallHandler(
        HomeWidgetService.defaultChannel,
        null,
      );
    });

    final semantics = tester.ensureSemantics();
    try {
      tester.view.physicalSize = const Size(800, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
        json: {
          '/mobile/dashboard': _mobileDashboardJson(
            revenueValue: 1200,
            orderValue: 4,
            productCount: 1,
            averageOrderValue: 300,
          ),
        },
      );
      await tester.pumpWidget(
        MultiProvider(
          providers: _merchantShellProviders(api),
          child: MaterialApp(
            home: const HomeScreen(),
            routes: {
              AppRoutes.money: (_) => const Scaffold(
                body: Center(child: Text('Money destination')),
              ),
            },
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));

      final copyStoreUrl = find.bySemanticsLabel('Copy store URL');
      final copyStoreUrlData = tester
          .getSemantics(copyStoreUrl)
          .getSemanticsData();
      expect(copyStoreUrlData.hint, 'https://demo.letbuyy.com to clipboard');
      expect(copyStoreUrlData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(copyStoreUrlData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(copyStoreUrlData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(copyStoreUrl).height, greaterThanOrEqualTo(48));

      for (final label in [
        'Visit',
        'Go Live',
        'Share store',
        'Store QR code',
      ]) {
        final action = find.bySemanticsLabel(label);
        final data = tester.getSemantics(action).getSemanticsData();
        expect(data.hasFlag(SemanticsFlag.isButton), isTrue, reason: label);
        expect(data.hasFlag(SemanticsFlag.isEnabled), isTrue, reason: label);
        expect(data.hasAction(SemanticsAction.tap), isTrue, reason: label);
        expect(tester.getSize(action).height, greaterThanOrEqualTo(48));
      }
      final unavailableSettings = tester
          .getSemantics(find.bySemanticsLabel('Store settings'))
          .getSemanticsData();
      expect(unavailableSettings.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(unavailableSettings.hasFlag(SemanticsFlag.isEnabled), isFalse);
      expect(unavailableSettings.hasAction(SemanticsAction.tap), isFalse);

      final copyFocus = find.byKey(const ValueKey('hero-store-url-focus'));
      tester.widget<Focus>(copyFocus).focusNode!.requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(copiedClipboardData?['text'], 'https://demo.letbuyy.com');
      expect(find.text('URL copied!'), findsOneWidget);
      expect(tester.takeException(), isNull);

      final payoutCard = find.bySemanticsLabel(RegExp(r'^Next payout'));
      await tester.ensureVisible(payoutCard);
      final payoutData = tester.getSemantics(payoutCard).getSemanticsData();
      expect(payoutData.label, startsWith('Next payout, ₹'));
      expect(payoutData.label, contains('pending'));
      expect(payoutData.hint, 'Open Money and payouts');
      expect(payoutData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(payoutData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(payoutData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(payoutCard).height, greaterThanOrEqualTo(48));

      final payoutTitle = find.text('Next payout');
      final payoutInkWell = find.ancestor(
        of: payoutTitle,
        matching: find.byType(InkWell),
      );
      final payoutFocus = find.descendant(
        of: payoutInkWell,
        matching: find.byType(Focus),
      );
      final focusablePayoutTitle = find.descendant(
        of: payoutFocus.first,
        matching: find.text('Next payout'),
      );
      Focus.of(tester.element(focusablePayoutTitle)).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pumpAndSettle();
      expect(find.text('Money destination'), findsOneWidget);
      expect(tester.takeException(), isNull);
      Navigator.of(tester.element(find.text('Money destination'))).pop();
      await tester.pump(const Duration(milliseconds: 400));

      final periodPicker = find.byKey(
        const ValueKey('dashboard-period-picker'),
      );
      await tester.ensureVisible(periodPicker);
      await tester.pump();
      final periodData = tester.getSemantics(periodPicker).getSemanticsData();
      expect(periodData.label, 'Dashboard reporting period');
      expect(periodData.hint, 'Current reporting period: 30 Days');
      expect(periodData.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(periodData.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(periodData.hasAction(SemanticsAction.tap), isTrue);
      expect(tester.getSize(periodPicker).height, greaterThanOrEqualTo(48));

      Focus.of(tester.element(find.text('30 Days'))).requestFocus();
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(find.text('Select Period'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 400));

      await tester.tap(find.text('7 Days'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('7 Days'), findsOneWidget);
      expect(
        api.paths.where((path) => path == '/mobile/dashboard'),
        hasLength(2),
      );
      expect(
        api.queries['/mobile/dashboard'],
        containsPair('store_id', 'store_1'),
      );
      expect(api.queries['/mobile/dashboard'], containsPair('period', '7d'));
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('ImportProductsScreen shows progress and result feedback', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final api = _FakeApiClient(
      json: {'/stores/store_1': _storeJson()},
      paginated: {
        '/products': [_productJson()],
      },
      delay: const Duration(milliseconds: 20),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ProductService(api: api)),
        ],
        child: MaterialApp(
          home: ImportProductsScreen(
            store: StoreModel.fromJson(_storeJson()),
            alreadySelectedIds: const {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Import Products'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);

    await tester.ensureVisible(find.text('Cotton Tee'));
    await tester.tap(find.text('Cotton Tee'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add to Store'));
    await tester.pump();

    expect(find.text('Import in progress'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsWidgets);

    await tester.pump(const Duration(milliseconds: 60));
    await tester.pump();

    expect(find.text('Import complete'), findsOneWidget);
    expect(find.text('1 product was added to your store.'), findsOneWidget);
    expect(
      api.bodies['/stores/store_1'],
      containsPair('selected_product_ids', ['prod_1']),
    );
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
  });

  test('remaining merchant CTAs are wired or hidden', () {
    final productsSource = _readSource(
      appRelative: 'lib/screens/products/products_screen.dart',
      repoRelative:
          'apps/mobile/merchant-app/lib/screens/products/products_screen.dart',
    );
    final ordersSource = _readSource(
      appRelative: 'lib/screens/orders/orders_screen.dart',
      repoRelative:
          'apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart',
    );
    final settingsSource = _readSource(
      appRelative: 'lib/screens/settings/settings_screen.dart',
      repoRelative:
          'apps/mobile/merchant-app/lib/screens/settings/settings_screen.dart',
    );
    final errorSource = _readSource(
      appRelative: 'lib/screens/auth/error_screen.dart',
      repoRelative:
          'apps/mobile/merchant-app/lib/screens/auth/error_screen.dart',
    );

    expect(productsSource, contains('_openProductEditor(product)'));
    expect(productsSource, contains("_hideSelectedProducts"));
    expect(productsSource, contains("action: 'deactivate'"));
    expect(settingsSource, contains('AppRoutes.help'));
    expect(errorSource, contains('Navigator.pushReplacementNamed'));

    for (final source in [
      productsSource,
      ordersSource,
      settingsSource,
      errorSource,
    ]) {
      expect(source, isNot(contains('coming soon')));
      expect(source, isNot(contains('TODO: Navigate')));
      expect(source, isNot(contains('TODO: Implement')));
      expect(source, isNot(contains('TODO: Open terms/privacy page')));
      expect(source, isNot(contains('TODO: Deep link')));
    }
  });

  testWidgets('ProductFormScreen exposes variant matrix controls', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: ProductFormScreen()));

    expect(find.text('Add Product'), findsOneWidget);
    await tester.tap(find.text('Continue').first, warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(find.text('Add Image'), findsOneWidget);

    for (var i = 0; i < 2; i++) {
      await tester.tap(find.text('Continue').first, warnIfMissed: false);
      await tester.pumpAndSettle();
    }

    expect(find.text('Variant matrix'), findsOneWidget);
    expect(find.text('Base SKU'), findsOneWidget);
    expect(find.text('Barcode'), findsOneWidget);
    expect(find.text('Add variant'), findsOneWidget);

    final continueButton = find
        .widgetWithText(ElevatedButton, 'Continue')
        .first;
    await tester.ensureVisible(continueButton);
    await tester.tap(continueButton, warnIfMissed: false);
    await tester.pumpAndSettle();

    expect(find.text('Search listing'), findsOneWidget);
    expect(find.text('Classification'), findsOneWidget);
    expect(find.text('Product type'), findsOneWidget);
    expect(find.text('Vendor'), findsOneWidget);
    expect(find.text('Tags'), findsOneWidget);
    expect(find.text('URL handle'), findsOneWidget);
    expect(find.text('SEO title'), findsOneWidget);
    expect(find.text('Meta description'), findsOneWidget);
  });

  testWidgets('product image add and remove controls expose clear semantics', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(const MaterialApp(home: ProductFormScreen()));
      await tester.tap(find.text('Continue').first, warnIfMissed: false);
      await tester.pumpAndSettle();

      final addImage = find.bySemanticsLabel('Add product image');
      expect(
        tester.getSemantics(addImage),
        matchesSemantics(
          label: 'Add product image',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
        ),
      );
      await tester.tap(addImage);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Image URL'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.byType(TextField),
        ),
        'https://cdn.example.test/item.jpg',
      );
      await tester.tap(find.widgetWithText(ElevatedButton, 'Add'));
      await tester.pumpAndSettle();

      expect(
        tester.getSemantics(find.bySemanticsLabel('Product image 1, primary')),
        matchesSemantics(label: 'Product image 1, primary', isImage: true),
      );
      final removeImage = find.bySemanticsLabel('Remove product image 1');
      expect(
        tester.getSemantics(removeImage),
        matchesSemantics(
          label: 'Remove product image 1',
          isButton: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
        ),
      );
      await tester.tap(removeImage);
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Add product image'), findsOneWidget);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('product specification removal exposes its value and action', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      tester.view.physicalSize = const Size(1000, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const MaterialApp(home: ProductFormScreen()));
      final detailsStep = find.text('Details');
      final stepperScroll = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(
        detailsStep,
        250,
        scrollable: stepperScroll,
      );
      await tester.tap(detailsStep);
      await tester.pumpAndSettle();
      expect(find.text('Specifications'), findsOneWidget);
      final addSpecification = find.widgetWithText(TextButton, 'Add');
      await tester.scrollUntilVisible(
        addSpecification,
        250,
        scrollable: stepperScroll,
      );
      await tester.tap(addSpecification);
      await tester.pumpAndSettle();
      final fields = find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(TextField),
      );
      await tester.enterText(fields.at(0), 'Material');
      await tester.enterText(fields.at(1), 'Cotton');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Add'));
      await tester.pumpAndSettle();

      final remove = find.byTooltip('Remove specification Material');
      final removeSemantics = tester.getSemantics(remove).getSemanticsData();
      expect(removeSemantics.tooltip, 'Remove specification Material');
      expect(removeSemantics.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(removeSemantics.hasAction(SemanticsAction.tap), isTrue);
      await tester.tap(remove);
      await tester.pumpAndSettle();
      expect(find.text('No specifications added'), findsOneWidget);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('product variant actions identify the variant they affect', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      tester.view.physicalSize = const Size(1000, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const MaterialApp(home: ProductFormScreen()));

      final stepperScroll = find.byType(Scrollable).first;
      final variantsStep = find.text('Variants').first;
      await tester.scrollUntilVisible(
        variantsStep,
        250,
        scrollable: stepperScroll,
      );
      await tester.tap(variantsStep);
      await tester.pumpAndSettle();

      final addVariant = find.widgetWithText(ElevatedButton, 'Add variant');
      await tester.scrollUntilVisible(
        addVariant.first,
        250,
        scrollable: stepperScroll,
      );
      await tester.tap(addVariant.first);
      await tester.pumpAndSettle();

      final variantFields = find.descendant(
        of: find.byType(BottomSheet),
        matching: find.byType(TextFormField),
      );
      await tester.enterText(variantFields.at(0), 'Size');
      await tester.enterText(variantFields.at(1), 'Small');
      await tester.enterText(variantFields.at(5), '25');
      await tester.enterText(variantFields.at(6), '3');
      await tester.tap(addVariant.last);
      await tester.pumpAndSettle();

      final delete = find.byTooltip('Delete Small variant');
      final deleteSemantics = tester.getSemantics(delete).getSemanticsData();
      expect(deleteSemantics.tooltip, 'Delete Small variant');
      expect(deleteSemantics.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(deleteSemantics.hasAction(SemanticsAction.tap), isTrue);
      await tester.tap(delete);
      await tester.pumpAndSettle();
      expect(
        find.text(
          'No variants yet. The product will use the base price and stock.',
        ),
        findsOneWidget,
      );
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('CouponFormScreen renders create form', (tester) async {
    final api = _FakeApiClient(json: {'/coupons': _couponJson()});

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CouponService(api: api),
        child: const MaterialApp(home: CouponFormScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New coupon'), findsOneWidget);
    expect(find.text('Create coupon'), findsOneWidget);
    expect(find.text('Code'), findsOneWidget);
  });

  testWidgets('GiftCardsScreen renders balances and issue action', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/products/gift-cards': [_giftCardJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ProductService(api: api)),
        ],
        child: const MaterialApp(home: GiftCardsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Gift Cards'), findsOneWidget);
    expect(find.text('GIFT-1234'), findsOneWidget);
    expect(find.text('INR 250.00'), findsWidgets);
    expect(find.text('Issue card'), findsOneWidget);
    expect(find.text('Active'), findsWidgets);
  });

  testWidgets('NotificationsScreen renders persisted toggles', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/notifications': [_notificationJson()],
      },
      json: {
        '/notifications/preferences': _notificationPreferenceRows(),
        '/notifications/count': {'count': 1},
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(
            create: (_) => NotificationSettingsService(api: api),
          ),
        ],
        child: const MaterialApp(home: NotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('New order received'), findsOneWidget);
    expect(find.text('Mark all read'), findsOneWidget);
    expect(find.text('Channels'), findsOneWidget);
    expect(find.text('New orders'), findsOneWidget);
    expect(find.text('Low stock'), findsOneWidget);
  });

  testWidgets('StaffScreen renders staff roles and access gates', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/employees': [
          {..._staffJson(), 'permissions': {'granted': ['products:read']}},
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => StaffService(api: api)),
        ],
        child: const MaterialApp(home: StaffScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Users & Permissions'), findsOneWidget);
    expect(find.text('riya@example.com'), findsWidgets);
    expect(find.text('Editor'), findsWidgets);
    expect(find.text('View products'), findsOneWidget);
    expect(find.text('Manage & fulfil orders'), findsNothing);
    expect(find.text('Add staff'), findsOneWidget);
  });



  for (final screen in <String, Widget>{'settings':const SettingsScreen(),'dashboard':const HomeScreen()}.entries) {
    testWidgets('${screen.key} store-read failure clears content and waits for explicit recovery', (tester) async {
      SharedPreferences.setMockInitialValues({});FlutterSecureStorage.setMockInitialValues({});
      final api=_FakeApiClient(errors:{'/stores':const ApiException(message:'synthetic private store fault',statusCode:503,code:'SYNTHETIC_STORE_OUTAGE')},paginated:{'/stores':[_storeJson()]});
      await tester.pumpWidget(MultiProvider(providers:_merchantShellProviders(api),child:MaterialApp(home:screen.value)));
      await tester.pumpAndSettle();
      expect(find.text('Store details could not load. Try again.'),findsOneWidget);
      expect(find.text('Demo Store'),findsNothing);
      final attempts=api.paths.where((p)=>p=='/stores').length;
      await tester.pump(const Duration(seconds:10));expect(api.paths.where((p)=>p=='/stores').length,attempts,reason:'an outage must not trigger a rebuild/request loop');
      api._errors.clear();await tester.tap(find.text('Retry store details'));await tester.pump();await tester.pump(const Duration(seconds:1));await tester.pump(const Duration(seconds:1));
      expect(find.text('Store details could not load. Try again.'),findsNothing);expect(api.paths.where((p)=>p=='/stores').length,greaterThan(attempts));
      expect(tester.takeException(),isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }

  testWidgets('normal settings opens canonical invoices and exposes current plan and usage', (tester) async {
    SharedPreferences.setMockInitialValues({});FlutterSecureStorage.setMockInitialValues({});
    tester.view.physicalSize=const Size(900,1200);tester.view.devicePixelRatio=1;
    addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
    final api=_FakeApiClient(paginated:{'/stores':[_storeJson()]},json:{
      'payments/subscription':{'store':{'id':'store_1','trial_status':'paid'},'subscription':{'id':'sub_1','plan':'growth','status':'active','billing_period':'monthly','amount_paid':69900,'products_limit':500},'product_usage':{'count':12,'limit_known':true,'limit':500}},
      '/payments/subscription/history':[_billingHistoryJson()],
    });
    await tester.pumpWidget(MultiProvider(providers:_merchantShellProviders(api),child:MaterialApp(home:const SettingsScreen(),routes:{AppRoutes.billing:(_)=>const BillingScreen()})));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Billing and invoices'),300,scrollable:find.byType(Scrollable).first);
    expect(find.text('Growth • active'),findsOneWidget);expect(find.text('12 / 500 products'),findsOneWidget);
    await tester.ensureVisible(find.text('Billing and invoices'));
    await tester.pumpAndSettle();
    expect(find.text('Billing and invoices').hitTestable(),findsOneWidget);
    await tester.tap(find.text('Billing and invoices').hitTestable());await tester.pumpAndSettle();
    expect(find.text('Invoices'),findsOneWidget);expect(find.textContaining('SYN-BILLING-001'),findsOneWidget);
    expect(find.text('Recorded tax: ₹71.82'),findsOneWidget);expect(find.text('Recorded total: ₹470.82'),findsOneWidget);
    expect(tester.takeException(),isNull);
  });

  testWidgets('BillingScreen renders subscription and invoices', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        'payments/subscription': {
          'store': {'id': 'store_1', 'trial_status': 'active'},
          'subscription': {
            'id': 'sub_1',
            'plan': 'business',
            'status': 'active',
            'billing_period': 'monthly',
            'current_period_end': '2026-07-01T00:00:00.000Z',
            'amount_paid': 39900,
          },
        },
        '/payments/subscription/history': [_billingHistoryJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          Provider<SubscriptionService>(
            create: (_) => SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor'),
          ),
        ],
        child: const MaterialApp(home: BillingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Billing'), findsOneWidget);
    expect(find.text('Business'), findsOneWidget);
    expect(find.text('Invoices'), findsOneWidget);
    expect(find.text('INR 399.00'), findsWidgets);
    expect(find.text('Manage plan'), findsOneWidget);
  });

  testWidgets('BillingScreen starts failed-payment recovery', (tester) async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        'payments/subscription': {
          'store': {'id': 'store_1', 'trial_status': 'active'},
          'subscription': {
            'id': 'sub_1',
            'plan': 'business',
            'status': 'past_due',
            'billing_period': 'monthly',
            'current_period_end': '2026-07-01T00:00:00.000Z',
            'amount_paid': 39900,
          },
        },
        '/payments/subscription/history': [
          {..._billingHistoryJson(), 'status': 'failed'},
        ],
        '/payments/subscription/recover': {
          'activated': true,
          'subscription': {'id': 'sub_2', 'status': 'active'},
          'recovery': {
            'subscription_id': 'sub_1',
            'previous_status': 'past_due',
            'plan_slug': 'business',
            'next_step': 'activated',
          },
        },
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          Provider<SubscriptionService>(
            create: (_) => SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor'),
          ),
        ],
        child: const MaterialApp(home: BillingScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Payment needs attention'), findsOneWidget);
    expect(find.text('Retry payment'), findsOneWidget);

    await tester.runAsync(() async {
      await tester.tap(find.text('Retry payment'));
      await Future<void>.delayed(const Duration(milliseconds:20));
    });
    await tester.pump();
    for (
      var attempt = 0;
      attempt < 10 && !api.paths.contains('/payments/subscription/recover');
      attempt += 1
    ) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(api.paths, contains('/payments/subscription/recover'));
    expect(api.bodies['/payments/subscription/recover'], {
      'store_id': 'store_1',
    });
    expect(find.text('Payment recovered.'), findsOneWidget);
  });

  testWidgets('ReviewsScreen renders review moderation actions', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/reviews': [_reviewJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ReviewService(api: api)),
        ],
        child: const MaterialApp(home: ReviewsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Reviews'), findsOneWidget);
    expect(find.text('Cotton Tee'), findsOneWidget);
    expect(find.text('Meera Merchant - meera@example.com'), findsOneWidget);
    expect(find.text('Great quality'), findsOneWidget);
    expect(find.text('Approve'), findsOneWidget);
    expect(find.text('Reply'), findsOneWidget);
    expect(find.text('Delete'), findsOneWidget);
  });

  testWidgets('LeadsScreen renders form submissions and status actions', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/form-submissions': [_formSubmissionJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(
            create: (_) => FormSubmissionService(api: api),
          ),
        ],
        child: const MaterialApp(home: LeadsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Leads'), findsOneWidget);
    expect(find.text('Meera Merchant'), findsOneWidget);
    expect(find.text('meera@example.com / +919999999999'), findsOneWidget);
    expect(find.text('Wholesale inquiry'), findsOneWidget);
    expect(find.text('Mark read'), findsOneWidget);
    expect(find.text('Contacted'), findsOneWidget);
    expect(find.text('Converted'), findsOneWidget);
  });

  testWidgets('PagesScreen renders CMS pages from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/pages': [_pageJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => CmsService(api: api)),
        ],
        child: const MaterialApp(home: PagesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pages'), findsOneWidget);
    expect(find.text('About us'), findsOneWidget);
    expect(find.text('/about-us'), findsOneWidget);
    expect(find.text('Published'), findsWidgets);
    expect(find.text('New page'), findsOneWidget);
  });

  testWidgets('PageEditorScreen renders create form fields', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CmsService(api: _FakeApiClient()),
        child: const MaterialApp(home: PageEditorScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New page'), findsOneWidget);
    expect(find.text('Title'), findsOneWidget);
    expect(find.text('Body'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('BlogScreen renders posts from gateway service', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/blog/posts': [_blogPostJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => CmsService(api: api)),
        ],
        child: const MaterialApp(home: BlogScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Blog'), findsOneWidget);
    expect(find.text('Launch update'), findsOneWidget);
    expect(find.text('/blog/launch-update'), findsOneWidget);
    expect(find.text('Published'), findsWidgets);
    expect(find.text('New post'), findsOneWidget);
  });

  testWidgets('PostEditorScreen renders create form fields', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => CmsService(api: _FakeApiClient()),
        child: const MaterialApp(home: PostEditorScreen(storeId: 'store_1')),
      ),
    );

    expect(find.text('New post'), findsOneWidget);
    expect(find.text('Title'), findsOneWidget);
    expect(find.text('Content'), findsOneWidget);
    expect(find.byIcon(Icons.check_rounded), findsOneWidget);
  });

  testWidgets('NavigationScreen renders draggable menu items', (tester) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/pages/navigation': {
          'menu': _navigationMenuJson(),
          'items': [_navigationItemJson()],
        },
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => CmsService(api: api)),
        ],
        child: const MaterialApp(home: NavigationScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Navigation'), findsOneWidget);
    expect(find.text('Header'), findsWidgets);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('/'), findsOneWidget);
    expect(find.text('Add item'), findsOneWidget);
    expect(find.text('Save menu'), findsOneWidget);
    expect(find.byIcon(Icons.drag_indicator_rounded), findsOneWidget);
  });

  test('ProductFormScreen supports camera and library product media upload', () {
    final sourceFile = [
      File(
        'apps/mobile/merchant-app/lib/screens/products/product_form_screen.dart',
      ),
      File('lib/screens/products/product_form_screen.dart'),
    ].firstWhere((file) => file.existsSync());
    final source = sourceFile.readAsStringSync();

    expect(source, contains('ImageSource.camera'));
    expect(source, contains('ImageSource.gallery'));
    expect(source, contains('uploadProductImage'));
    expect(source, contains('Take photo'));
    expect(source, contains('Photo library'));
    expect(source, contains('Image URL'));
  });

  testWidgets('MediaLibraryScreen renders media assets from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/media': [
          _mediaJson(
            filename: 'lookbook.pdf',
            originalName: 'Lookbook.pdf',
            mediaType: 'document',
            mimeType: 'application/pdf',
          ),
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => MediaService(api: api)),
        ],
        child: const MaterialApp(home: MediaLibraryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Media library'), findsOneWidget);
    expect(find.text('Lookbook.pdf'), findsOneWidget);
    expect(find.text('Document • 2.0 KB'), findsOneWidget);
    expect(find.text('Upload'), findsOneWidget);
    expect(find.text('Search media'), findsOneWidget);
  });

  test('MediaLibraryScreen supports camera image uploads', () {
    final sourceFile = [
      File(
        'apps/mobile/merchant-app/lib/screens/content/media_library_screen.dart',
      ),
      File('lib/screens/content/media_library_screen.dart'),
    ].firstWhere((file) => file.existsSync());
    final source = sourceFile.readAsStringSync();

    expect(source, contains('showImageSourceSheet'));
    expect(source, contains('source: source'));
    expect(source, contains('pickVideo(source: ImageSource.gallery)'));
    expect(
      source,
      contains("import 'package:video_player/video_player.dart';"),
    );
    expect(source, contains('_VideoAssetPreview'));
    expect(source, contains('_VideoPreviewDialog'));
    expect(source, contains('_ModelAssetPreview'));
    expect(source, contains('VideoPlayerController.networkUrl'));
    expect(source, contains('asset.isVideo'));
    expect(source, contains('asset.isThreeDModel'));
  });

  test('Product and media image surfaces use the shared cached loader', () {
    const imageSurfaceFiles = {
      'lib/screens/products/products_screen.dart':
          'apps/mobile/merchant-app/lib/screens/products/products_screen.dart',
      'lib/screens/products/product_form_screen.dart':
          'apps/mobile/merchant-app/lib/screens/products/product_form_screen.dart',
      'lib/screens/products/import_products_screen.dart':
          'apps/mobile/merchant-app/lib/screens/products/import_products_screen.dart',
      'lib/screens/products/collections_screen.dart':
          'apps/mobile/merchant-app/lib/screens/products/collections_screen.dart',
      'lib/screens/content/media_library_screen.dart':
          'apps/mobile/merchant-app/lib/screens/content/media_library_screen.dart',
      'lib/widgets/shared/image_picker_widget.dart':
          'apps/mobile/merchant-app/lib/widgets/shared/image_picker_widget.dart',
      'lib/widgets/dashboard/hero_store_card.dart':
          'apps/mobile/merchant-app/lib/widgets/dashboard/hero_store_card.dart',
      'lib/widgets/settings/store_info_card.dart':
          'apps/mobile/merchant-app/lib/widgets/settings/store_info_card.dart',
    };

    for (final entry in imageSurfaceFiles.entries) {
      final source = _readSource(
        appRelative: entry.key,
        repoRelative: entry.value,
      );
      expect(source, isNot(contains('Image.network')), reason: entry.key);
      expect(source, isNot(contains('NetworkImage(')), reason: entry.key);
      expect(
        source,
        anyOf(
          contains('CachedMerchantImage'),
          contains('cachedMerchantImageProvider'),
        ),
        reason: entry.key,
      );
    }

    final helper = _readSource(
      appRelative: 'lib/widgets/shared/cached_merchant_image.dart',
      repoRelative:
          'apps/mobile/merchant-app/lib/widgets/shared/cached_merchant_image.dart',
    );
    expect(helper, contains('CachedNetworkImage('));
    expect(helper, contains('CachedNetworkImageProvider('));
  });

  test('Gateway upload route supports bounded video and model media', () {
    final route = _readSource(
      appRelative: '../../../services/api-gateway/src/routes/upload.ts',
      repoRelative: 'services/api-gateway/src/routes/upload.ts',
    );
    final sharedTypes = _readSource(
      appRelative: '../../../packages/shared-types/src/index.ts',
      repoRelative: 'packages/shared-types/src/index.ts',
    );
    final uploadTest = _readSource(
      appRelative:
          '../../../services/api-gateway/src/__tests__/upload.security.test.ts',
      repoRelative:
          'services/api-gateway/src/__tests__/upload.security.test.ts',
    );

    expect(route, contains('VIDEO_UPLOAD_LIMIT_BYTES'));
    expect(route, contains('MODEL_UPLOAD_LIMIT_BYTES'));
    expect(route, contains('mediaKindForUpload'));
    expect(route, contains('uploadMediaType'));
    expect(route, contains('media_type: mediaType'));
    expect(sharedTypes, contains('media_type: MediaTypeSchema'));
    expect(
      uploadTest,
      contains('upload accepts storefront video assets above the image limit'),
    );
  });

  test('Shared image source sheet exposes camera and library choices', () {
    final sourceFile = [
      File(
        'apps/mobile/merchant-app/lib/widgets/shared/image_source_sheet.dart',
      ),
      File('lib/widgets/shared/image_source_sheet.dart'),
    ].firstWhere((file) => file.existsSync());
    final source = sourceFile.readAsStringSync();

    expect(source, contains('ImageSource.camera'));
    expect(source, contains('ImageSource.gallery'));
    expect(source, contains('Take photo'));
    expect(source, contains('Photo library'));
  });

  test('Native manifests declare camera capture permissions', () {
    final androidManifest = [
      File('apps/mobile/merchant-app/android/app/src/main/AndroidManifest.xml'),
      File('android/app/src/main/AndroidManifest.xml'),
    ].firstWhere((file) => file.existsSync());
    final iosPlist = [
      File('apps/mobile/merchant-app/ios/Runner/Info.plist'),
      File('ios/Runner/Info.plist'),
    ].firstWhere((file) => file.existsSync());

    expect(
      androidManifest.readAsStringSync(),
      contains('android.permission.CAMERA'),
    );
    final plistSource = iosPlist.readAsStringSync();
    expect(plistSource, contains('NSCameraUsageDescription'));
    expect(plistSource, contains('NSPhotoLibraryUsageDescription'));
  });

  testWidgets('ShippingScreen renders zones and rates from gateway service', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {
        '/shipping-tax/shipping/zones': [_shippingZoneJson()],
        '/shipping-tax/shipping': [_shippingRateJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ShippingTaxService(api: api)),
        ],
        child: const MaterialApp(home: ShippingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Shipping'), findsOneWidget);
    expect(find.text('Domestic'), findsOneWidget);
    expect(find.text('IN'), findsOneWidget);
    expect(find.text('1 rates'), findsOneWidget);

    await tester.tap(find.text('Rates'));
    await tester.pumpAndSettle();
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('₹49'), findsOneWidget);
  });

  testWidgets('TaxesScreen renders inclusive setting and tax rates', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson(taxInclusive: true)],
      },
      json: {
        '/shipping-tax/taxes': [_taxRateJson()],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ShippingTaxService(api: api)),
        ],
        child: const MaterialApp(home: TaxesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Taxes / GST'), findsOneWidget);
    expect(find.text('All prices include tax'), findsOneWidget);
    expect(find.text('GST'), findsOneWidget);
    expect(find.text('18%'), findsOneWidget);
    expect(find.text('HSN 6204'), findsOneWidget);
    expect(find.text('New tax'), findsOneWidget);
  });

  testWidgets('LocalizationMarketsScreen renders real market settings', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {'/stores/store_1/localization': _localizationJson()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: _storeProviders(api),
        child: const MaterialApp(home: LocalizationMarketsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Localization & Markets'), findsOneWidget);
    expect(find.text('Storefront defaults'), findsOneWidget);
    expect(find.text('India'), findsOneWidget);
    expect(find.text('Hindi'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pumpAndSettle();
    expect(find.text('नया स्टोर'), findsOneWidget);
    expect(find.textContaining('backend contract'), findsNothing);
    expect(find.textContaining('S-025'), findsNothing);
  });

  testWidgets('CustomDataScreen renders real metafield settings', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json: {'/metafields/values': _metafieldsSummaryJson()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => MetafieldService(api: api)),
        ],
        child: const MaterialApp(home: CustomDataScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Custom Data'), findsOneWidget);
    expect(find.text('Store fields'), findsOneWidget);
    expect(find.text('Care instructions'), findsOneWidget);
    expect(find.text('custom.care'), findsOneWidget);
    expect(find.text('Wash cold'), findsOneWidget);
    expect(find.textContaining('backend contract'), findsNothing);
    expect(find.textContaining('S-026'), findsNothing);
  });

  testWidgets('TaxesScreen saves inclusive pricing through StoreService', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson(taxInclusive: false)],
      },
      json: {
        '/shipping-tax/taxes': [],
        '/stores/store_1': _storeJson(taxInclusive: true),
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ShippingTaxService(api: api)),
        ],
        child: const MaterialApp(home: TaxesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();

    expect(api.bodies['/stores/store_1'], containsPair('tax_inclusive', true));
    expect(find.text('Tax-inclusive setting saved'), findsOneWidget);
  });

  testWidgets('TaxesScreen hides raw gateway errors', (tester) async {
    final api = _ThrowingApiClient();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => ShippingTaxService(api: api)),
        ],
        child: const MaterialApp(home: TaxesScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tax settings could not load.'), findsOneWidget);
    expect(find.textContaining('offline'), findsNothing);
    expect(find.textContaining('Exception'), findsNothing);
  });

  testWidgets('DomainSettingsScreen renders DNS guidance', (tester) async {
    final health = _domainHealthJson();
    final api = _FakeApiClient(
      paginated: {
        '/stores': [
          _storeJson(
            customDomain: 'shop.example.com',
            customDomainStatus: 'active',
            sslActive: true,
            dnsConfig: {
              'records': health['records'],
              'domain_health': health,
              'apex_mx_warning': true,
            },
          ),
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => DomainService(api: api)),
        ],
        child: const MaterialApp(home: DomainSettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Domain settings'), findsOneWidget);
    expect(find.text('demo.letbuyy.com'), findsOneWidget);
    expect(find.text('shop.example.com'), findsWidgets);
    expect(find.text('Save domain'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Domain health'),
      500,
      scrollable: find
          .descendant(
            of: find.byType(DomainSettingsScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();

    expect(find.text('Domain health'), findsOneWidget);
    expect(find.text('DNS verified'), findsOneWidget);
    expect(find.text('SSL active'), findsWidgets);
    expect(find.text('Managed renewal'), findsOneWidget);
    expect(find.text('Checked 2026-06-08'), findsOneWidget);

    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();

    expect(find.text('CNAME'), findsOneWidget);
    final expectedCname = DomainService.cnameTarget.isNotEmpty
        ? DomainService.cnameTarget
        : 'Generated by gateway after Save domain';
    expect(find.text(expectedCname), findsWidgets);
    expect(find.textContaining('Seen'), findsWidgets);
    expect(find.text('Email DNS records'), findsOneWidget);
    expect(find.textContaining('email may stop working'), findsOneWidget);
  });

  testWidgets('SEOSettingsScreen renders and saves storefront SEO', (
    tester,
  ) async {
    final api = _FakeApiClient(
      paginated: {
        '/stores': [
          _storeJson(
            seoTitle: 'Demo Store India',
            seoDescription: 'Shop premium products from Demo Store.',
          ),
        ],
      },
      json: {
        '/stores/store_1': _storeJson(
          seoTitle: 'Updated Store Title',
          seoDescription: 'Shop premium products from Demo Store.',
        ),
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: _storeProviders(api),
        child: const MaterialApp(home: SEOSettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('SEO Settings'), findsOneWidget);
    expect(find.text('Search preview'), findsOneWidget);
    expect(find.text('Demo Store India'), findsWidgets);

    await tester.enterText(find.byType(TextField).first, 'Updated Store Title');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save SEO'));
    await tester.pumpAndSettle();

    expect(api.paths, contains('/stores/store_1'));
    expect(
      api.bodies['/stores/store_1'],
      containsPair('seo_title', 'Updated Store Title'),
    );
  });

  testWidgets('AppsScreen renders marketplace apps and installed state', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    const grantedScopes = [
      'products:read',
      'orders:read',
      'customers:write',
      'analytics:read',
    ];
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/app-store/apps': [_marketplaceAppJson(scopes: grantedScopes)],
      },
      json: {
        '/app-store/categories': [_appCategoryJson()],
        '/app-store/installations': [
          _appInstallationJson(scopes: grantedScopes),
        ],
      },
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(
            create: (_) => AppMarketplaceService(api: api),
          ),
        ],
        child: const MaterialApp(home: AppsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('App Marketplace'), findsOneWidget);
    expect(find.text('Campaign Booster'), findsOneWidget);
    expect(find.text('Installed'), findsWidgets);
    expect(find.text('Marketing 4'), findsOneWidget);
    expect(find.text('Permissions'), findsOneWidget);
    expect(find.text('Read products'), findsOneWidget);
    expect(find.text('Read orders'), findsOneWidget);
    expect(find.text('Manage customers'), findsOneWidget);
    expect(find.text('Read analytics'), findsOneWidget);
    expect(find.text('customers:write'), findsOneWidget);
    expect(api.paths, contains('/app-store/apps'));
    expect(api.paths, contains('/app-store/installations'));
  });

  testWidgets('AiScreen renders credits, tools, and usage history', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/ai/usage': [_aiUsageJson()],
      },
      json: {'/ai/credits': _aiCreditsJson()},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => AiStudioService(api: api)),
        ],
        child: const MaterialApp(home: AiScreen()),
      ),
    );
    for (var i = 0; i < 10; i += 1) {
      await tester.pump(const Duration(milliseconds: 100));
      if (find.text('Credits remaining').evaluate().isNotEmpty) break;
    }

    expect(find.text('AI Studio'), findsOneWidget);
    expect(find.text('Credits remaining'), findsOneWidget);
    expect(find.byTooltip('Buy credits'), findsOneWidget);
    expect(find.text('Product descriptions'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    for (var i = 0; i < 10; i += 1) {
      await tester.pump(const Duration(milliseconds: 100));
      if (find.text('Product Description').evaluate().isNotEmpty) break;
    }
    expect(find.text('Product Description'), findsOneWidget);
    expect(find.text('Soft cotton tee for everyday wear.'), findsOneWidget);
    expect(find.text('completed'), findsOneWidget);
    expect(api.paths, contains('/ai/credits'));
    expect(api.paths, contains('/ai/usage'));
  });

  testWidgets('AiScreen hides credit purchase control when unavailable', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
        '/ai/usage': [_aiUsageJson()],
      },
      json: {'/ai/credits': _aiCreditsJson(purchaseAvailable: false)},
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ..._storeProviders(api),
          ChangeNotifierProvider(create: (_) => AiStudioService(api: api)),
        ],
        child: const MaterialApp(home: AiScreen()),
      ),
    );
    for (var i = 0; i < 10; i += 1) {
      await tester.pump(const Duration(milliseconds: 100));
      if (find.text('Credits remaining').evaluate().isNotEmpty) break;
    }

    expect(find.text('AI Studio'), findsOneWidget);
    expect(find.text('Credits remaining'), findsOneWidget);
    expect(find.byTooltip('Buy credits'), findsNothing);
    expect(find.text('Product descriptions'), findsOneWidget);
    expect(api.paths, contains('/ai/credits'));
    expect(api.paths, isNot(contains('/ai/credits/purchase')));
  });

  testWidgets('ThemeVersionsScreen renders releases and executes rollback', (
    tester,
  ) async {
    final api = _FakeApiClient(
      raw: {
        '/themes': {
          'data': [
            {'id': 'theme_1', 'slug': 'modern', 'name': 'Modern'},
          ],
          'current_theme': 'modern',
          'store_status': 'published',
        },
      },
      json: {
        '/themes/modern/releases': [_themeReleaseJson()],
        '/themes/modern/releases/release_1/rollback': {
          'rollback': {
            'release_id': 'release_rollback_1',
            'release_version': 4,
            'published_at': '2026-06-02T10:00:00.000Z',
          },
        },
      },
    );

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => ThemeService(api: api),
        child: const MaterialApp(
          home: ThemeVersionsScreen(
            storeId: 'store_1',
            themeSlug: 'modern',
            themeName: 'Modern',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Theme versions'), findsOneWidget);
    expect(find.text('Version 3'), findsOneWidget);
    expect(find.text('Published'), findsOneWidget);
    expect(find.text('Roll back'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'Roll back'));
    await tester.pumpAndSettle();
    expect(find.text('Roll back theme?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Roll back'));
    await tester.pumpAndSettle();

    const rollbackPath = '/themes/modern/releases/release_1/rollback';
    expect(api.paths, contains(rollbackPath));
    expect(api.bodies[rollbackPath], {
      'store_id': 'store_1',
      'make_store_live': true,
      'rollback_message': 'Rolled back from mobile theme versions',
    });
    expect(find.text('Theme rolled back to v3'), findsOneWidget);
  });

  testWidgets('CapabilityGate sanitizes internal fallback reasons', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CapabilityGate(
            availability: FeatureAvailability.temporarilyUnavailable,
            title: 'S-018',
            description: 'SKIP-NEEDS-BACKEND: needs backend contract',
          ),
        ),
      ),
    );

    expect(find.text('Feature temporarily unavailable'), findsOneWidget);
    expect(
      find.text('This workflow is not available right now. Try again later.'),
      findsOneWidget,
    );
    expect(find.textContaining('S-018'), findsNothing);
    expect(find.textContaining('SKIP'), findsNothing);
    expect(find.textContaining('backend contract'), findsNothing);
  });

  testWidgets('subscription plan cards expose labeled selectable semantics', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final semantics = tester.ensureSemantics();
    try {
      final api = _FakeApiClient(
        paginated: {
          '/stores': [_storeJson()],
        },
        json:{'/payments/plans':[_merchantCatalogPlan('launch','Launch',29900),_merchantCatalogPlan('growth','Growth',69900)],'payments/subscription':{'store':{'id':'store_1','trial_status':'paid'},'subscription':{'id':'sub-launch','plan':'launch','status':'active','billing_period':'monthly','amount_paid':29900}}},
      );
      final providers = _storeProviders(api)
        ..add(
          Provider<SubscriptionService>(
            create: (_) => SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor'),
          ),
        );

      await tester.pumpWidget(
        MultiProvider(
          providers: providers,
          child: const MaterialApp(home: PricingScreen()),
        ),
      );
      await tester.pumpAndSettle();

      final freeTrial = tester
          .getSemantics(find.byKey(const ValueKey('subscription-plan-launch')))
          .getSemanticsData();
      expect(freeTrial.label, startsWith('Launch plan, ₹299 /month,'));
      expect(freeTrial.label, contains('Current plan'));
      expect(freeTrial.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(freeTrial.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(freeTrial.hasFlag(SemanticsFlag.hasEnabledState), isTrue);
      expect(freeTrial.hasFlag(SemanticsFlag.isEnabled), isFalse);
      expect(freeTrial.hasAction(SemanticsAction.tap), isFalse);

      final starter = tester
          .getSemantics(find.byKey(const ValueKey('subscription-plan-growth')))
          .getSemanticsData();
      expect(starter.label, startsWith('Growth plan, ₹699 /month,'));
      expect(starter.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(starter.hasFlag(SemanticsFlag.isSelected), isFalse);
      expect(starter.hasFlag(SemanticsFlag.isEnabled), isTrue);
      expect(starter.hasAction(SemanticsAction.tap), isTrue);
      expect(api.paths,containsAll(['/stores','/payments/plans','payments/subscription']));
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('keyboard activation opens the selected plan details only', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = _FakeApiClient(
      paginated: {
        '/stores': [_storeJson()],
      },
      json:{'/payments/plans':[_merchantCatalogPlan('launch','Launch',29900),_merchantCatalogPlan('growth','Growth',69900)],'payments/subscription':{'store':{'id':'store_1','trial_status':'paid'},'subscription':{'id':'sub-launch','plan':'launch','status':'active','billing_period':'monthly','amount_paid':29900}}},
    );
    final providers = _storeProviders(api)
      ..add(
        Provider<SubscriptionService>(
          create: (_) => SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor'),
        ),
      );

    await tester.pumpWidget(
      MultiProvider(
        providers: providers,
        child: const MaterialApp(home: PricingScreen()),
      ),
    );
    await tester.pumpAndSettle();

    final starter = find.byKey(const ValueKey('subscription-plan-growth'));
    await tester.ensureVisible(starter);
    final starterInkWell = find.descendant(
      of: starter,
      matching: find.byType(InkWell),
    );
    final starterFocus = find.descendant(
      of: starterInkWell,
      matching: find.byType(Focus),
    );
    final starterLabel = find.descendant(
      of: starterFocus.first,
      matching: find.text('Growth'),
    );
    Focus.of(tester.element(starterLabel)).requestFocus();
    await tester.pump();
    expect(FocusManager.instance.primaryFocus?.hasFocus, isTrue);

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();

    expect(find.text('Choose Growth'), findsOneWidget);
    expect(find.text('Continue to Payment'), findsOneWidget);
    expect(tester.takeException(), isNull);
    final sheetScroll = find.descendant(
      of: find.byType(BottomSheet),
      matching: find.byType(Scrollable),
    );
    await tester.scrollUntilVisible(
      find.descendant(of:find.byType(BottomSheet),matching:find.text('Custom domain')),
      100,
      scrollable: sheetScroll.first,
    );
    expect(find.descendant(of:find.byType(BottomSheet),matching:find.text('Custom domain')), findsOneWidget);
    expect(find.text('Continue to Payment'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(api.paths,containsAll(['/stores','/payments/plans','payments/subscription']));
  });

  testWidgets('Turnstile sentinel state renders a generic error', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: TurnstileChallengeScreen()),
    );

    expect(
      find.text(
        'Verification is temporarily unavailable. Please try again later.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('SKIP_NEEDS_HUMAN'), findsNothing);
    expect(find.textContaining('TURNSTILE'), findsNothing);
  });
}

List<SingleChildWidget> _storeProviders(ApiClient api) {
  final storeService = StoreService(api: api, cache: CacheService.memory());
  return [
    ChangeNotifierProvider<StoreService>.value(value: storeService),
    ChangeNotifierProvider<StoreContext>(
      create: (_) => StoreContext(storeService: storeService),
    ),
  ];
}

List<SingleChildWidget> _merchantShellProviders(
  ApiClient api, {
  String? currentUserId,
  StoreAuthService? authServiceOverride,
}) {
  final cache = CacheService.memory();
  final storeService = StoreService(api: api, cache: cache);
  final appBadgeService = const AppBadgeService();
  final authService =
      authServiceOverride ??
      _TestMerchantAuthService(api: api, currentUserId: currentUserId);

  return [
    Provider<ApiClient>.value(value: api),
    Provider<CacheService>.value(value: cache),
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ChangeNotifierProvider<StoreService>.value(value: storeService),
    ChangeNotifierProvider<StoreAuthService>.value(value: authService),
    ChangeNotifierProvider<StoreContext>(
      create: (_) => StoreContext(storeService: storeService),
    ),
    ChangeNotifierProvider<ProductService>(
      create: (_) => ProductService(api: api, cache: cache),
    ),
    ChangeNotifierProvider<OrderService>(
      create: (_) => OrderService(
        api: api,
        cache: cache,
        appBadgeService: appBadgeService,
      ),
    ),
    ChangeNotifierProvider<CustomerService>(
      create: (_) => CustomerService(api: api),
    ),
    ChangeNotifierProvider<AnalyticsService>(
      create: (_) => AnalyticsService(api: api),
    ),
    ChangeNotifierProvider<MoneyService>(create: (_) => MoneyService(api: api)),
    ChangeNotifierProvider<AiStudioService>(
      create: (_) => AiStudioService(api: api),
    ),
    Provider<AppBadgeService>.value(value: appBadgeService),
    Provider<HomeWidgetService>(create: (_) => const HomeWidgetService()),
    Provider<SubscriptionService>(create: (_) => SubscriptionService(api: api, actorIdProvider: () => 'synthetic-subscription-actor')),
  ];
}

class _TestMerchantAuthService extends StoreAuthService {
  _TestMerchantAuthService({
    required super.api,
    required this.currentUserId,
    super.httpClient,
  })
    : super(
        identityBaseUrl: 'https://accounts.test',
        turnstileTokenProvider: () => 'turnstile-token',
      );

  final String? currentUserId;
  int signOutCalls = 0;

  @override
  Future<void> signOut() async {
    signOutCalls++;
    await super.signOut();
  }

  @override
  MerchantSessionUser? get currentUser => currentUserId == null
      ? null
      : MerchantSessionUser(
          id: currentUserId!,
          email: '$currentUserId@example.invalid',
        );
}

String _readSource({
  required String appRelative,
  required String repoRelative,
}) {
  final candidates = [File(appRelative), File(repoRelative)];
  final source = candidates.firstWhere(
    (file) => file.existsSync(),
    orElse: () => throw StateError('Missing source file: $repoRelative'),
  );
  return source.readAsStringSync();
}

class _PublishRetryApiClient extends _FakeApiClient {
  _PublishRetryApiClient({required super.json, super.errors = const {}});

  int createAttempts = 0;
  int publishAttempts = 0;
  final List<String?> createIdempotencyKeys = [];

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) {
    if (path == '/stores') {
      createAttempts++;
      createIdempotencyKeys.add(options?.idempotencyKey);
      return super.requestJson(path, options: options).then((response) {
        if (createAttempts == 1) {
          throw const ApiException(
            message: 'temporary lost create response',
            statusCode: 503,
            code: 'CREATE_RESPONSE_LOST',
          );
        }
        return response;
      });
    }
    if (path == '/stores/store_1/publish') {
      publishAttempts++;
      if (publishAttempts == 1) {
        paths.add(path);
        throw const ApiException(
          message: 'temporary publish failure',
          statusCode: 503,
          code: 'PUBLISH_UNAVAILABLE',
        );
      }
    }
    return super.requestJson(path, options: options);
  }
}

// Controlled transport only: proof objects are created by the real service,
// never directly constructed. These responses are not server/MFA/provider proof.
JsonMap _controlledRefundProofJson() => {
  'step_up_token': 'unit-response-refund-approval',
  'verified_at': '2026-10-16T12:00:00Z',
};

TwoFactorService _contractTwoFactor(_FakeApiClient api, MemoryStorage storage) {
  final service = TwoFactorService(
    api: api,
    actorIdProvider: () => '11111111-1111-4111-8111-111111111111',
    storeIdProvider: () => 'store_1',
    storage: storage,
  );
  addTearDown(service.dispose);
  return service;
}

Future<MerchantStepUpProof> _contractRefundApproval(TwoFactorService service) =>
    service.challenge(
      action: 'refund.approve',
      factorId: '22222222-2222-4222-8222-222222222222',
      code: '123456',
      idempotencyKey: 'unit-refund-challenge-key',
      expectedContext: service.requestContext,
    );

void _expectContractApproval(
  ApiRequestOptions options,
  MerchantStepUpProof approval,
) {
  expect(approval.context.actorId,
      '11111111-1111-4111-8111-111111111111');
  expect(approval.action, 'refund.approve');
  expect(options.method, HttpMethod.post);
  expect(options.storeId, 'store_1');
  expect(options.expectedContextVersion, approval.context.version);
  expect(options.headers, {
    'X-Step-Up-Token': 'unit-response-refund-approval',
    'X-Step-Up-Verified-At': '2026-10-16T12:00:00Z',
  });
}

class _FakeApiClient extends ApiClient {
  _FakeApiClient({
    Map<String, dynamic> json = const {},
    Map<String, dynamic> raw = const {},
    Map<String, List<Map<String, dynamic>>> paginated = const {},
    Map<String, Map<String, dynamic>> paginatedMeta = const {},
    Map<String, ApiException> errors = const {},
    Duration delay = Duration.zero,
    super.contextVersionProvider,
  }) : _json = json,
       _raw = raw,
       _paginated = paginated,
       _paginatedMeta = paginatedMeta,
       _errors = errors,
       _delay = delay,
       super(
         baseUrl: 'https://gateway.test/v1',
         maxRetries: 0,
       );

  final Map<String, dynamic> _json;
  final Map<String, dynamic> _raw;
  final Map<String, List<Map<String, dynamic>>> _paginated;
  final Map<String, Map<String, dynamic>> _paginatedMeta;
  final Map<String, ApiException> _errors;
  final Duration _delay;
  final List<String> paths = [];
  final Map<String, Object?> bodies = {};
  final Map<String, Map<String, dynamic>> queries = {};
  final Map<String, List<ApiRequestOptions?>> requestOptions = {};

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    await _maybeDelay();
    paths.add(path);
    _captureBody(path, options);
    _throwIfConfigured(path);
    return _raw[path] ?? {'success': true, 'data': _json[path] ?? {}};
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    await _maybeDelay();
    paths.add(path);
    _captureBody(path, options);
    _throwIfConfigured(path);
    final value = _json[path] ?? {};
    if (value is List && value.isNotEmpty) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    return Map<String, dynamic>.from(value as Map);
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    await _maybeDelay();
    paths.add(path);
    _captureBody(path, options);
    _throwIfConfigured(path);
    return decoder(_json[path]);
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    await _maybeDelay();
    paths.add(path);
    _captureBody(path, options);
    _throwIfConfigured(path);
    final rows = _paginated[path] ?? const <Map<String, dynamic>>[];
    final meta = _paginatedMeta[path] ?? const <String, dynamic>{};
    final hasNext = meta['has_next'] is bool ? meta['has_next'] as bool : null;
    return PaginatedResponse<JsonMap>(
      data: rows,
      total: _intMeta(meta, 'total', rows.length),
      page: _intMeta(meta, 'page', 1),
      limit: _intMeta(meta, 'per_page', rows.length),
      totalPages: meta['total_pages'] is int
          ? meta['total_pages'] as int
          : null,
      hasNext: hasNext,
      hasPrev: meta['has_prev'] is bool ? meta['has_prev'] as bool : null,
      hasMore: hasNext ?? (meta['has_more'] == true),
      nextCursor: meta['next_cursor']?.toString(),
      meta: Map<String, dynamic>.from(meta),
    );
  }

  int _intMeta(Map<String, dynamic> meta, String key, int fallback) {
    final value = meta[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  Future<void> _maybeDelay() async {
    if (_delay > Duration.zero) await Future<void>.delayed(_delay);
  }

  void _throwIfConfigured(String path) {
    final error = _errors[path];
    if (error != null) throw error;
  }

  void _captureBody(String path, ApiRequestOptions? options) {
    requestOptions.putIfAbsent(path, () => []).add(options);
    if (options?.body != null) bodies[path] = options!.body;
    final query = options?.query;
    if (query != null && query.isNotEmpty) {
      queries[path] = Map<String, dynamic>.from(query);
    }
  }
}

class _DelayedSubdomainLookupApiClient extends _FakeApiClient {
  _DelayedSubdomainLookupApiClient(this.subdomain)
    : super(
        errors: const {
          'stores/public/available-shop': ApiException(
            message: 'Not found',
            statusCode: 404,
            code: 'NOT_FOUND',
          ),
        },
      );

  final String subdomain;
  bool delayedLookupStarted = false;

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    if (path.endsWith('stores/public/$subdomain')) {
      delayedLookupStarted = true;
      await Future<void>.delayed(const Duration(seconds: 2));
    }
    return super.request(path, options: options);
  }
}

class _StorageApiClient extends _FakeApiClient {
  _StorageApiClient({
    this.uploadUrl = 'https://cdn.letbuyy.com/uploads/test.jpg',
    this.failDeletes = false,
  });

  final String uploadUrl;
  final bool failDeletes;
  String? uploadedFilePath;
  String? uploadedFolder;
  final List<String> deletedPaths = [];

  @override
  Future<String> uploadFile(
    File file, {
    String folder = 'uploads',
    String? storeId,
    ApiRequestOptions? options,
  }) async {
    uploadedFilePath = file.path;
    uploadedFolder = folder;
    return uploadUrl;
  }

  @override
  Future<dynamic> delete(
    String path, {
    Object? body,
    ApiRequestOptions? options,
  }) async {
    deletedPaths.add(path);
    if (failDeletes) throw Exception('delete failed');
    return {'success': true};
  }
}

class _ThrowingApiClient extends ApiClient {
  _ThrowingApiClient() : super(baseUrl: 'https://gateway.test/v1');

  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) {
    throw Exception('offline');
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) {
    throw Exception('offline');
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) {
    throw Exception('offline');
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) {
    throw Exception('offline');
  }
}

class _AiProviderUnavailableApiClient extends _FakeApiClient {
  _AiProviderUnavailableApiClient() : super();

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) {
    if (path == '/ai/generate') {
      paths.add(path);
      _captureBody(path, options);
      throw const ApiException(
        message: 'AI generation is temporarily unavailable.',
        statusCode: 503,
        code: 'AI_PROVIDER_UNCONFIGURED',
      );
    }
    if (path == '/ai/homepage') {
      paths.add(path);
      _captureBody(path, options);
      throw const ApiException(
        message: 'AI homepage generation is temporarily unavailable.',
        statusCode: 503,
        code: 'AI_HOMEPAGE_GENERATOR_UNAVAILABLE',
      );
    }
    if (path == '/ai/credits/purchase') {
      paths.add(path);
      _captureBody(path, options);
      throw const ApiException(
        message: 'AI credit purchases are temporarily unavailable.',
        statusCode: 503,
        code: 'AI_CREDIT_PURCHASE_UNAVAILABLE',
      );
    }
    return super.requestJson(path, options: options);
  }
}

Map<String, dynamic> _domainHealthJson({
  String domain = 'shop.example.com',
  String status = 'active',
  bool txtVerified = true,
  bool cnameVerified = true,
  bool sslActive = true,
  String renewalStatus = 'managed',
}) => {
  'site_id': 'store_1',
  'domain': domain,
  'status': status,
  'txt_verified': txtVerified,
  'cname_verified': cnameVerified,
  'ssl_active': sslActive,
  'provider_status': 'configured',
  'configured_by': 'letbuyy-storefront',
  'misconfigured': false,
  'apex_mx_warning': true,
  'renewal_status': renewalStatus,
  'renewal_date': null,
  'checked_at': '2026-06-08T09:30:00.000Z',
  'records': [
    {
      'type': 'TXT',
      'host': '_letbuyy-challenge.$domain',
      'value': 'verify-token',
      'status': txtVerified ? 'verified' : 'pending',
      'actual': ['verify-token'],
      'message': 'Ownership challenge is visible.',
    },
    {
      'type': 'CNAME',
      'host': domain,
      'value': DomainService.cnameTarget.isNotEmpty
          ? DomainService.cnameTarget
          : 'Generated by gateway after Save domain',
      'status': cnameVerified ? 'verified' : 'pending',
      'actual': [
        DomainService.cnameTarget.isNotEmpty
            ? DomainService.cnameTarget
            : 'Generated by gateway after Save domain',
      ],
      'message': 'Storefront traffic points to LetBuyy.',
    },
  ],
};

Map<String, dynamic> _storeJson({
  String id = 'store_1',
  String name = 'Demo Store',
  String subdomain = 'demo',
  bool taxInclusive = false,
  String? customDomain,
  String? customDomainStatus,
  String? seoTitle,
  String? seoDescription,
  bool sslActive = false,
  Map<String, dynamic>? dnsConfig,
  String? legalName,
  String? gstin,
  String? gstStateCode,
  String? invoicePrefix,
  Map<String, dynamic>? invoiceAddress,
}) => {
  'id': id,
  'seller_id': 'seller_1',
  'name': name,
  'tagline': 'Demo',
  'subdomain': subdomain,
  'store_url': 'https://$subdomain.letbuyy.com',
  'theme_id': 'modern',
  'tax_inclusive': taxInclusive,
  'seo_title': seoTitle,
  'seo_description': seoDescription,
  'custom_domain': customDomain,
  'custom_domain_status': customDomainStatus,
  'ssl_active': sslActive,
  'dns_config': dnsConfig ?? const {},
  'legal_name': legalName,
  'gstin': gstin,
  'gst_state_code': gstStateCode,
  'invoice_prefix': invoicePrefix,
  'business_profile': {
    if (legalName != null) 'legal_name': legalName,
    if (gstin != null) 'gstin': gstin,
    if (gstStateCode != null) 'gst_state_code': gstStateCode,
  },
  'invoice_address': invoiceAddress ?? const {},
  'invoice_number_next': 1,
  'created_at': '2026-06-01T00:00:00.000Z',
  'updated_at': '2026-06-01T00:00:00.000Z',
};

Map<String, dynamic> _storeHealthJson() => {
  'store_id': 'store_1',
  'score': 84,
  'generated_at': '2026-06-01T10:00:00.000Z',
  'pillars': const [
    {
      'id': 'launch',
      'label': 'Launch readiness',
      'score': 88,
      'status': 'ready',
      'summary': 'Store is published with visible branding.',
      'route': '/store-details',
      'metrics': {'status': 'published'},
    },
    {
      'id': 'catalog',
      'label': 'Catalog and inventory',
      'score': 72,
      'status': 'attention',
      'summary': '1 product needs inventory attention.',
      'action_label': 'Open products',
      'route': '/products',
      'metrics': {'product_count': 4, 'low_stock_count': 1},
    },
  ],
};

Map<String, dynamic> _localizationJson() => {
  'store_id': 'store_1',
  'default_locale': 'en-IN',
  'currency': 'INR',
  'timezone': 'Asia/Kolkata',
  'markets': [_marketJson()],
  'locales': [_localeJson()],
  'translations': [_translationJson()],
  'schema_ready': true,
  'metadata': const {'source': 'test'},
};

Map<String, dynamic> _marketJson({
  String id = 'market_1',
  String name = 'India',
}) => {
  'id': id,
  'store_id': 'store_1',
  'name': name,
  'country_code': 'IN',
  'currency': 'INR',
  'locale': 'hi-IN',
  'is_primary': true,
  'is_active': true,
  'price_adjustment_bps': 0,
  'rounding_mode': 'standard',
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
  'metadata': const {},
};

Map<String, dynamic> _localeJson({
  String id = 'locale_1',
  String name = 'Hindi',
  String status = 'published',
}) => {
  'id': id,
  'store_id': 'store_1',
  'locale': 'hi-IN',
  'name': name,
  'status': status,
  'is_default': false,
  'published_at': '2026-06-01T10:00:00.000Z',
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
  'metadata': const {},
};

Map<String, dynamic> _translationJson({
  String id = 'translation_1',
  String translatedText = 'नया स्टोर',
}) => {
  'id': id,
  'store_id': 'store_1',
  'locale': 'hi-IN',
  'resource_type': 'store',
  'resource_id': 'storefront',
  'field': 'title',
  'source_text': 'New store',
  'translated_text': translatedText,
  'status': 'published',
  'published_at': '2026-06-01T10:00:00.000Z',
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
  'metadata': const {},
};

Map<String, dynamic> _metafieldsSummaryJson() => {
  'store_id': 'store_1',
  'owner_type': 'store',
  'owner_id': 'store_1',
  'definitions': [_metafieldDefinitionJson()],
  'values': [_metafieldValueJson()],
  'schema_ready': true,
  'metadata': const {'source': 'test'},
};

Map<String, dynamic> _metafieldDefinitionJson({
  String id = 'field_1',
  String name = 'Care instructions',
}) => {
  'id': id,
  'store_id': 'store_1',
  'owner_type': 'store',
  'namespace': 'custom',
  'key': 'care',
  'name': name,
  'description': 'Product care copy for the storefront.',
  'value_type': 'single_line_text',
  'validation_rules': const {},
  'is_required': false,
  'is_public': true,
  'sort_order': 0,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
  'metadata': const {},
};

Map<String, dynamic> _metafieldValueJson({
  String id = 'value_1',
  Object? value = 'Wash cold',
}) => {
  'id': id,
  'store_id': 'store_1',
  'definition_id': 'field_1',
  'owner_type': 'store',
  'owner_id': 'store_1',
  'value': value,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
  'metadata': const {},
};

Map<String, dynamic> _productJson({List<Map<String, dynamic>>? variants}) => {
  'id': 'prod_1',
  'store_id': 'store_1',
  'name': 'Cotton Tee',
  'slug': 'cotton-tee',
  'price': 499,
  'currency': 'INR',
  'stock': 8,
  'is_active': true,
  'variants': variants ?? const [],
};

Map<String, dynamic> _sampleProductJson() => {
  'id': 'sample_prod_1',
  'store_id': 'store_1',
  'name': 'Sample Product - Cotton Tote',
  'slug': 'sample-product',
  'description': 'Sample product for exploring your catalog.',
  'price': 499,
  'currency': 'INR',
  'sku': 'LETBUYY-SAMPLE-PRODUCT',
  'stock': 1,
  'is_active': false,
  'tags': const ['sample', 'not-for-sale', 'edit-before-publication'],
  'variants': const [],
};

Map<String, dynamic> _variantJson() => {
  'title': 'XL',
  'sku': 'TEE-XL',
  'price': 599,
  'compare_price': 699,
  'stock': 4,
  'inventory_quantity': 4,
  'options': {'Size': 'XL'},
};

Map<String, dynamic> _collectionJson({
  String id = 'collection_1',
  String title = 'Summer picks',
  bool isActive = true,
}) => {
  'id': id,
  'store_id': 'store_1',
  'title': title,
  'description': 'Seasonal merchandising',
  'image_url': null,
  'handle': 'summer-picks',
  'is_active': isActive,
  'product_count': 6,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _customerJson() => {
  'id': 'customer_1',
  'store_id': 'store_1',
  'email': 'meera@example.com',
  'phone': '+919999999999',
  'first_name': 'Meera',
  'last_name': 'Merchant',
  'display_name': 'Meera Merchant',
  'status': 'active',
  'accepts_marketing': true,
  'tags': ['vip'],
  'notes': 'Prefers COD',
  'order_count': 1,
  'total_spent': 499,
  'last_order_at': '2026-06-01T10:00:00.000Z',
  'addresses': [_addressJson()],
};

Map<String, dynamic> _noteJson() => {
  'id': 'note_1',
  'store_id': 'store_1',
  'customer_email': 'meera@example.com',
  'note': 'Prefers COD',
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
};

Map<String, dynamic> _whatsAppStatusJson() => {
  'store_id': 'store_1',
  'available': true,
  'provider': 'letbuyy_sandbox',
  'provider_mode': 'sandbox',
  'templates': const [
    {
      'key': 'order_update',
      'label': 'Order update',
      'description': 'Send a short order status update.',
      'required_variables': ['order_number', 'status'],
    },
  ],
};

Map<String, dynamic> _whatsAppMessageJson({
  String message = 'Order update sent.',
}) => {
  'id': 'wa_1',
  'store_id': 'store_1',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'direction': 'outbound',
  'template': 'order_update',
  'message': message,
  'provider': 'letbuyy_sandbox',
  'provider_message_id': 'wa_sandbox_1',
  'status': 'queued',
  'metadata': const {'sandbox': true},
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
};

Map<String, dynamic> _marketingCampaignJson({
  String id = 'campaign_1',
  String status = 'draft',
  int sentCount = 0,
}) => {
  'id': id,
  'store_id': 'store_1',
  'name': 'June update',
  'subject': 'New arrivals',
  'preview_text': 'Fresh catalog drops',
  'body_text': 'Fresh catalog drops are live.',
  'body_html': null,
  'status': status,
  'audience_type': 'all_marketing',
  'audience_segment_id': null,
  'audience_rules': const {'tags_any': []},
  'manual_recipients': const [],
  'recipient_count': 2,
  'sent_count': sentCount,
  'failed_count': 0,
  'delivery_mode': 'sandbox',
  'provider': 'letbuyy_sandbox',
  'scheduled_at': null,
  'sent_at': status == 'sent' ? '2026-06-01T10:00:00.000Z' : null,
  'metadata': const {},
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
};

Map<String, dynamic> _customerSegmentJson() => {
  'id': 'segment_1',
  'store_id': 'store_1',
  'name': 'VIP customers',
  'description': 'Customers tagged VIP with at least one order.',
  'rules': {
    'tags_any': ['vip'],
    'min_order_count': 1,
  },
  'customer_count': 1,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
  'deleted_at': null,
};

Map<String, dynamic> _addressJson() => {
  'id': 'address_1',
  'store_id': 'store_1',
  'customer_id': 'customer_1',
  'full_name': 'Meera Merchant',
  'phone': '+919999999999',
  'address_line1': '12 Market Road',
  'address_line2': '',
  'city': 'Bengaluru',
  'state': 'Karnataka',
  'postal_code': '560001',
  'country': 'IN',
  'label': 'Home',
  'is_default': true,
};

Map<String, dynamic> _inventoryJson({int available = 10}) => {
  'id': 'inventory_1',
  'store_id': 'store_1',
  'product_id': 'prod_1',
  'variant_id': 'variant_1',
  'sku': 'TEE-001',
  'product_name': 'Cotton Tee',
  'location_id': 'main',
  'available': available,
  'reserved': 1,
  'committed': 2,
  'on_hand': available + 3,
};

Map<String, dynamic> _locationJson() => {
  'id': 'loc_1',
  'store_id': 'store_1',
  'name': 'North warehouse',
  'address': '12 Industrial Road',
  'city': 'Delhi',
  'state': 'Delhi',
  'country': 'IN',
  'is_default': true,
  'status': 'active',
};

Map<String, dynamic> _supplierJson() => {
  'id': 'supplier_1',
  'site_id': 'store_1',
  'name': 'Acme Textiles',
  'contact_name': 'Riya',
  'email': 'riya@example.com',
  'phone': '+911111111111',
  'address': {'line1': 'Supplier lane'},
};

Map<String, dynamic> _purchaseOrderJson({
  String status = 'ordered',
  int receivedQuantity = 0,
}) => {
  'id': 'po_1',
  'site_id': 'store_1',
  'supplier_id': 'supplier_1',
  'supplier': {'name': 'Acme Textiles'},
  'location_id': 'loc_1',
  'status': status,
  'expected_at': '2026-06-15T10:00:00.000Z',
  'notes': 'Restock cotton tee',
  'lines': [
    {
      'id': 'po_line_1',
      'product_id': 'prod_1',
      'variant_id': 'variant_1',
      'sku': 'TEE-001',
      'product_name': 'Cotton Tee',
      'quantity': 4,
      'received_quantity': receivedQuantity,
      'unit_cost': 299,
    },
  ],
};

Map<String, dynamic> _transferJson({
  String status = 'reserved',
  int receivedQuantity = 0,
}) => {
  'id': 'transfer_1',
  'site_id': 'store_1',
  'source_location_id': 'loc_1',
  'destination_location_id': 'loc_2',
  'status': status,
  'notes': 'Balance stock',
  'lines': [
    {
      'id': 'transfer_line_1',
      'product_id': 'prod_1',
      'variant_id': 'variant_1',
      'sku': 'TEE-001',
      'product_name': 'Cotton Tee',
      'quantity': 3,
      'received_quantity': receivedQuantity,
    },
  ],
};

Map<String, dynamic> _couponJson({
  String id = 'coupon_1',
  String code = 'SAVE10',
  bool isActive = true,
}) => {
  'id': id,
  'store_id': 'store_1',
  'code': code,
  'description': 'Launch campaign',
  'type': 'percentage',
  'value': 10,
  'currency': 'INR',
  'minimum_order_amount': 500,
  'maximum_discount': 200,
  'usage_limit': 100,
  'used_count': 3,
  'per_customer_limit': 1,
  'expires_at': '2026-12-31T23:59:59.000Z',
  'is_active': isActive,
};

Map<String, dynamic> _giftCardJson({
  String id = 'gift_1',
  String code = 'GIFT-1234',
  String status = 'active',
  double initialValue = 500,
  double balance = 250,
}) => {
  'id': id,
  'store_id': 'store_1',
  'code': code,
  'initial_value': initialValue,
  'balance': balance,
  'status': status,
  'expires_at': '2026-12-31T23:59:59.000Z',
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _appCategoryJson() => {
  'slug': 'marketing',
  'name': 'Marketing',
  'icon': 'campaign',
  'group': 'growth',
  'count': 4,
};

Map<String, dynamic> _marketplaceAppJson({
  String id = 'app_1',
  String name = 'Campaign Booster',
  List<String> scopes = const ['products:read', 'orders:read'],
}) => {
  'id': id,
  'slug': 'campaign-booster',
  'name': name,
  'tagline': 'Automated campaigns for storefront growth.',
  'description': 'Build lifecycle campaigns from LetBuyy events.',
  'status': 'published',
  'developer_name': 'LetBuyy Labs',
  'pricing_model': 'free',
  'price_inr': 0,
  'install_count': 120,
  'review_count': 8,
  'rating_avg': 4.7,
  'api_scopes': scopes,
  'app_url': 'https://apps.letbuyy.com/campaign-booster',
  'app_developers': {'company_name': 'LetBuyy Labs', 'verified': true},
  'app_categories': _appCategoryJson(),
};

Map<String, dynamic> _appInstallationJson({
  String id = 'install_1',
  String status = 'active',
  List<String> scopes = const ['products:read', 'orders:read'],
}) => {
  'id': id,
  'app_id': 'app_1',
  'store_id': 'store_1',
  'status': status,
  'scopes_granted': scopes,
  'installed_at': '2026-06-01T11:00:00.000Z',
  'marketplace_apps': {
    'id': 'app_1',
    'slug': 'campaign-booster',
    'name': 'Campaign Booster',
    'tagline': 'Automated campaigns for storefront growth.',
    'pricing_model': 'free',
    'app_url': 'https://apps.letbuyy.com/campaign-booster',
  },
};

Map<String, dynamic> _appBridgeSessionJson() => {
  'installation': _appInstallationJson(),
  'embed': {
    'title': 'Campaign Booster',
    'label': 'Open app',
    'url': 'https://apps.letbuyy.com/admin/campaign-booster',
    'origin': 'https://apps.letbuyy.com',
  },
  'bridge': {
    'version': '2026-06-01',
    'token_type': 'Bearer',
    'access_token': 'test-token',
    'expires_at': '2026-06-01T11:15:00.000Z',
    'api_base_url': 'https://gateway.test/v1',
    'store_id': 'store_1',
    'installation_id': 'install_1',
    'app_id': 'app_1',
    'scopes': ['products:read', 'orders:read'],
    'capabilities': ['api.fetch', 'toast', 'resize'],
  },
  'mobile_host': {
    'platform': 'mobile_webview',
    'host_version': '2026-06-08.mobile-app-bridge.v1',
    'allowed_origin': 'https://apps.letbuyy.com',
    'allowed_navigation_origins': ['https://apps.letbuyy.com'],
    'js_namespace': 'LetBuyyAppBridge',
    'message_channel': 'LetBuyyAppBridge',
    'bridge_fetch_path': '/app-store/bridge/fetch',
    'token_transport': 'native_bridge',
    'capabilities': ['api.fetch', 'toast', 'resize'],
    'expires_at': '2026-06-01T11:15:00.000Z',
  },
};

Map<String, dynamic> _aiCreditsJson({
  int balance = 80,
  int totalUsed = 20,
  int totalPurchased = 0,
  bool purchaseAvailable = true,
}) => {
  'store_id': 'store_1',
  'balance': balance,
  'plan_credits': 100,
  'bonus_credits': 0,
  'total_used': totalUsed,
  'total_purchased': totalPurchased,
  'purchase_available': purchaseAvailable,
  'purchase_mode': purchaseAvailable ? 'sandbox' : 'live',
  'purchase_provider': purchaseAvailable ? 'letbuyy_sandbox' : 'razorpay',
};

Map<String, dynamic> _aiUsageJson({
  String id = 'usage_1',
  String feature = 'product_description',
  String output = 'Soft cotton tee for everyday wear.',
  int creditsUsed = 2,
  int? userRating,
}) => {
  'id': id,
  'store_id': 'store_1',
  'feature': feature,
  'prompt': 'Write a product description for a cotton tee.',
  'output': output,
  'tokens_input': 12,
  'tokens_output': 24,
  'credits_used': creditsUsed,
  'model': 'sandbox-model',
  'provider': 'letbuyy_sandbox',
  'status': 'completed',
  'user_rating': userRating,
  'user_feedback': userRating == null ? null : 'Useful',
  'created_at': '2026-06-01T12:00:00.000Z',
};

Map<String, dynamic> _pageJson({
  String id = 'page_1',
  String title = 'About us',
  String status = 'published',
}) => {
  'id': id,
  'store_id': 'store_1',
  'title': title,
  'slug': 'about-us',
  'body': 'We build storefronts from a phone.',
  'content': {'body': 'We build storefronts from a phone.'},
  'page_type': 'custom',
  'status': status,
  'show_in_nav': true,
  'display_order': 0,
  'seo_title': title,
  'seo_description': 'Mobile storefront content',
  'published_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _blogPostJson({
  String id = 'post_1',
  String postTitle = 'Launch update',
  String status = 'published',
}) => {
  'id': id,
  'store_id': 'store_1',
  'title': postTitle,
  'slug': 'launch-update',
  'excerpt': 'New mobile-first store operations.',
  'content': 'Run your whole commerce workflow from a phone.',
  'status': status,
  'allow_comments': true,
  'is_featured': true,
  'is_pinned': false,
  'reading_time_min': 3,
  'seo_title': postTitle,
  'seo_description': 'Mobile commerce update',
  'published_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _blogCommentJson({
  String id = 'comment_1',
  String status = 'pending',
}) => {
  'id': id,
  'store_id': 'store_1',
  'post_id': 'post_1',
  'post_title': 'Launch update',
  'author_name': 'Meera Merchant',
  'email': 'meera@example.com',
  'body': 'This update is useful.',
  'status': status,
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _navigationMenuJson() => {
  'id': 'menu_1',
  'store_id': 'store_1',
  'handle': 'main',
  'location': 'main',
  'name': 'Header menu',
};

Map<String, dynamic> _navigationItemJson({
  String id = 'nav_1',
  String label = 'Home',
  String url = '/',
  int sortOrder = 0,
}) => {
  'id': id,
  'menu_id': 'menu_1',
  'store_id': 'store_1',
  'label': label,
  'url': url,
  'target_type': 'url',
  'target_resource_id': null,
  'parent_item_id': null,
  'sort_order': sortOrder,
  'is_visible': true,
  'open_in_new_tab': false,
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _mediaJson({
  String id = 'media_1',
  String filename = 'hero.jpg',
  String originalName = 'Hero image',
  String mediaType = 'image',
  String mimeType = 'image/jpeg',
  String? altText = 'Homepage hero',
}) => {
  'id': id,
  'store_id': 'store_1',
  'uploaded_by': 'user_1',
  'filename': filename,
  'original_name': originalName,
  'url': 'https://cdn.test/media/store_1/$filename',
  'thumbnail_url': null,
  'mime_type': mimeType,
  'size_bytes': 2048,
  'width': mediaType == 'image' ? 1200 : null,
  'height': mediaType == 'image' ? 800 : null,
  'alt_text': altText,
  'caption': 'Launch asset',
  'folder': 'media',
  'media_type': mediaType,
  'tags': ['hero', 'launch'],
  'usage_count': 1,
  'storage_key': 'media/store_1/hero.png',
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _uploadJson() => {
  'url': 'https://cdn.test/media/store_1/hero.png',
  'key': 'media/store_1/hero.png',
  'size': 2,
  'content_type': 'image/png',
};

Map<String, dynamic> _shippingZoneJson({
  String id = 'zone_1',
  String name = 'Domestic',
}) => {
  'id': id,
  'store_id': 'store_1',
  'name': name,
  'countries': ['IN'],
  'states': ['Karnataka'],
  'zip_codes': ['560001'],
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _shippingRateJson({
  String id = 'rate_1',
  String name = 'Standard',
  double price = 49,
}) => {
  'id': id,
  'zone_id': 'zone_1',
  'name': name,
  'type': 'flat',
  'price': price,
  'min_order_amount': 0,
  'max_order_amount': null,
  'estimated_days_min': 2,
  'estimated_days_max': 5,
  'is_active': true,
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _taxRateJson({
  String id = 'tax_1',
  String name = 'GST',
  double rate = 18,
}) => {
  'id': id,
  'store_id': 'store_1',
  'name': name,
  'rate': rate,
  'country': 'IN',
  'state': 'Karnataka',
  'hsn_code': '6204',
  'applies_to': 'all',
  'is_compound': false,
  'is_shipping': false,
  'priority': 0,
  'is_active': true,
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _staffJson({
  String id = 'staff_1',
  String email = 'riya@example.com',
  String role = 'editor',
  String status = 'active',
}) => {
  'id': id,
  'store_id': 'store_1',
  'email': email,
  'full_name': 'Riya Staff',
  'role': role,
  'status': status,
  'is_active': status != 'removed',
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-10-15T00:00:00.000Z',
};

Map<String, dynamic> _reviewJson({
  String id = 'review_1',
  String status = 'pending',
  String? merchantReply,
}) => {
  'id': id,
  'store_id': 'store_1',
  'product_id': 'prod_1',
  'product_name': 'Cotton Tee',
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'rating': 5,
  'title': 'Great quality',
  'body': 'The fabric feels premium and shipped quickly.',
  'status': status,
  'is_approved': status == 'approved',
  'is_verified': true,
  'helpful_count': 2,
  if (merchantReply != null) 'merchant_reply': merchantReply,
  if (merchantReply != null) 'merchant_reply_at': '2026-06-01T12:00:00.000Z',
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _formSubmissionJson({
  String id = 'submission_1',
  String status = 'new',
}) => {
  'id': id,
  'store_id': 'store_1',
  'form_type': 'lead',
  'form_name': 'Wholesale form',
  'data': {'company': 'Meera Retail', 'source': 'homepage'},
  'source_url': 'https://demo.letbuyy.com/pages/wholesale',
  'status': status,
  'full_name': 'Meera Merchant',
  'email': 'meera@example.com',
  'phone': '+919999999999',
  'subject': 'Wholesale inquiry',
  'message': 'We want to buy 50 cotton tees.',
  'source': 'homepage',
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _billingHistoryJson() => {
  'id': 'invoice_1',
  'invoice_number': 'SYN-BILLING-001',
  'amount_paid': 39900,
  'amount': 39900,
  'tax_amount': 7182,
  'total_amount': 47082,
  'status': 'paid',
  'billing_period': 'monthly',
  'created_at': '2026-06-01T11:00:00.000Z',
};

Map<String, dynamic> _themeReleaseJson() => {
  'id': 'release_1',
  'release_version': 3,
  'release_status': 'published',
  'published_at': '2026-06-01T10:00:00.000Z',
  'release_manifest': {'message': 'Homepage and checkout polish'},
};

List<Map<String, dynamic>> _notificationPreferenceRows() => [
  {
    'store_id': 'store_1',
    'channel': 'email',
    'category': 'system',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'sms',
    'category': 'system',
    'enabled': false,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'system',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'order_created',
    'enabled': true,
  },
  {
    'store_id': 'store_1',
    'channel': 'push',
    'category': 'low_stock',
    'enabled': true,
  },
];

Map<String, dynamic> _notificationJson() => {
  'id': 'notif_1',
  'user_id': 'user_1',
  'type': 'order_placed',
  'title': 'New order received',
  'message': 'Order order_1 is ready to fulfill.',
  'data': {'order_id': 'order_1'},
  'action_url': '/orders/detail?orderId=order_1',
  'is_read': false,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:00:00.000Z',
};

Map<String, dynamic> _orderJson({
  String id = 'order_1',
  String status = 'paid',
  int riskScore = 0,
  String riskLevel = 'low',
  String fulfillmentState = 'unfulfilled',
  String codConfirmationStatus = 'not_required',
  String rtoStatus = 'none',
}) => {
  'id': id,
  'store_id': 'store_1',
  'order_number': id,
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'status': status,
  'payment_status': 'paid',
  'fulfillment_status': 'unfulfilled',
  'risk_score': riskScore,
  'risk_level': riskLevel,
  'fulfillment_state': fulfillmentState,
  'cod_confirmation_status': codConfirmationStatus,
  'rto_status': rtoStatus,
  'currency': 'INR',
  'subtotal': 499,
  'discount_amount': 0,
  'shipping_amount': 0,
  'tax_amount': 0,
  'total': 499,
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
  'shipping_address': const {
    'name': 'Meera Merchant',
    'line1': '12 Market Road',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'country': 'IN',
  },
  'billing_address': const {
    'name': 'Meera Merchant',
    'line1': '12 Market Road',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'country': 'IN',
  },
  'line_items': const [
    {
      'id': 'line_1',
      'name': 'Cotton Tee',
      'sku': 'TEE-001',
      'quantity': 1,
      'unit_price': 499,
      'total': 499,
      'currency': 'INR',
    },
  ],
};

Map<String, dynamic> _draftOrderJson({
  String id = 'draft_1',
  String status = 'draft',
}) => {
  'id': id,
  'site_id': 'store_1',
  'store_id': 'store_1',
  'customer_name': 'Meera Merchant',
  'customer_email': 'meera@example.com',
  'customer_phone': '+919999999999',
  'shipping_address': const {},
  'payment_method': 'cod',
  'shipping_method': 'standard',
  'status': status,
  'converted_order_id': status == 'converted' ? 'order_1' : null,
  'items': const [
    {'id': 'draft_line_1', 'product_id': 'product_1', 'quantity': 2},
  ],
  'created_at': '2026-06-01T10:00:00.000Z',
  'updated_at': '2026-06-01T10:30:00.000Z',
};

Map<String, dynamic> _payoutJson({String status = 'pending'}) => {
  'id': 'payout_1',
  'site_id': 'store_1',
  'statement_number': 'PYT-STORE1-1',
  'status': status,
  'provider': 'razorpay_route',
  'provider_mode': 'sandbox',
  'rail': 'razorpay_route',
  'currency': 'INR',
  'gross_amount_minor': 300000,
  'platform_fee_minor': 0,
  'tax_minor': 0,
  'net_amount_minor': 300000,
  'available_on': '2026-06-03',
  'metadata': const {},
  'created_at': '2026-06-01T12:00:00.000Z',
  'updated_at': '2026-06-01T12:00:00.000Z',
};

Map<String, dynamic> _payoutSummaryJson() => {
  'site_id': 'store_1',
  'currency': 'INR',
  'pending_minor': 300000,
  'processing_minor': 0,
  'released_minor': 0,
  'failed_minor': 0,
  'provider_mode': 'sandbox',
  'next_payout': _payoutJson(),
};

Map<String, dynamic> _mobileDashboardJson({
  required num revenueValue,
  required int orderValue,
  required int productCount,
  required num averageOrderValue,
  List<Map<String, dynamic>> topProducts = const [
    {'id': 'prod_1', 'name': 'Cotton Tee', 'total_sold': 2, 'revenue': 600},
  ],
  List<Map<String, dynamic>> trafficSources = const [
    {'label': 'instagram', 'value': 5, 'percentage': 62.5},
  ],
}) => {
  'store_id': 'store_1',
  'period': '30d',
  'provider_mode': 'sandbox',
  'analytics': {
    'dashboard': {
      'summary': {
        'revenue': {'value': revenueValue},
        'orders': {'value': orderValue},
        'products': productCount,
        'avg_order_value': averageOrderValue,
      },
    },
    'order_breakdown': {
      'breakdown': {'paid': orderValue, 'pending': 0},
    },
    'revenue': {
      'chart': [
        {'date': '2026-06-01', 'revenue': revenueValue, 'orders': orderValue},
      ],
    },
    'top_products': topProducts,
    'traffic_sources': {
      'available': trafficSources.isNotEmpty,
      'total_sessions': trafficSources.fold<int>(
        0,
        (total, item) => total + ((item['value'] as num?)?.toInt() ?? 0),
      ),
      'total_page_views': trafficSources.fold<int>(
        0,
        (total, item) => total + ((item['value'] as num?)?.toInt() ?? 0),
      ),
      'sources': trafficSources,
    },
  },
  'payout_summary': _payoutSummaryJson(),
  'partial_errors': const <Map<String, dynamic>>[],
};

Map<String, dynamic> _walletJson() => {
  'site_id': 'store_1',
  'currency': 'INR',
  'available_minor': 250000,
  'pending_minor': 300000,
  'held_minor': 0,
  'released_minor': 0,
  'ledger': [
    {
      'id': 'wallet_1',
      'site_id': 'store_1',
      'entry_type': 'payout_credit',
      'direction': 'credit',
      'status': 'pending',
      'currency': 'INR',
      'amount_minor': 300000,
      'description': 'Payout pending settlement',
    },
  ],
};

Map<String, dynamic> _commissionJson() => {
  'site_id': 'store_1',
  'currency': 'INR',
  'schedule': {
    'id': 'commission_schedule_1',
    'site_id': 'store_1',
    'name': 'Default commission',
    'status': 'active',
    'currency': 'INR',
    'commission_bps': 0,
    'gst_bps': 1800,
    'effective_from': '2026-06-01',
    'source': 'mobile_money_contract',
    'metadata': const {},
  },
  'entries': const [
    {
      'id': 'commission_1',
      'site_id': 'store_1',
      'order_id': 'order_1',
      'status': 'pending',
      'currency': 'INR',
      'gross_amount_minor': 300000,
      'commission_bps': 0,
      'commission_amount_minor': 0,
      'gst_bps': 1800,
      'gst_amount_minor': 0,
      'net_payable_minor': 300000,
    },
  ],
  'summary': {
    'gross_amount_minor': 300000,
    'commission_amount_minor': 0,
    'gst_amount_minor': 0,
    'net_payable_minor': 300000,
  },
};

Map<String, dynamic> _codJson() => {
  'site_id': 'store_1',
  'currency': 'INR',
  'entries': const [
    {
      'id': 'cod_1',
      'site_id': 'store_1',
      'order_id': 'order_1',
      'status': 'collected',
      'currency': 'INR',
      'expected_amount_minor': 300000,
      'collected_amount_minor': 300000,
      'deposited_amount_minor': 0,
      'difference_amount_minor': 0,
      'metadata': {'order_number': 'LB-1001'},
    },
  ],
  'summary': const {
    'site_id': 'store_1',
    'currency': 'INR',
    'expected_amount_minor': 300000,
    'collected_amount_minor': 300000,
    'deposited_amount_minor': 0,
    'difference_amount_minor': 0,
    'counts': {
      'pending': 0,
      'collected': 1,
      'reconciled': 0,
      'short': 0,
      'over': 0,
      'reversed': 0,
    },
  },
};

Map<String, dynamic> _kycDocumentJson({String status = 'submitted'}) => {
  'id': 'kyc_1',
  'site_id': 'store_1',
  'document_type': 'business_pan',
  'status': status,
  'provider': 'letbuyy_sandbox_kyc',
  'provider_mode': 'sandbox',
  'provider_reference': 'kyc_sandbox_store_business_pan',
  'document_number_last4': '1234',
  'file_url': 'https://cdn.letbuyy.com/kyc/pan.jpg',
  'file_name': 'pan.jpg',
  'metadata': const {'sandbox': true},
  'submitted_at': '2026-06-01T12:00:00.000Z',
  'created_at': '2026-06-01T12:00:00.000Z',
  'updated_at': '2026-06-01T12:00:00.000Z',
};

Map<String, dynamic> _kycOverviewJson({String status = 'in_progress'}) => {
  'site_id': 'store_1',
  'overall_status': status,
  'provider_mode': 'sandbox',
  'required_documents': const [
    {
      'document_type': 'business_pan',
      'title': 'Business PAN',
      'required': true,
      'status': 'submitted',
    },
    {
      'document_type': 'bank_proof',
      'title': 'Bank proof',
      'required': true,
      'status': null,
    },
  ],
  'documents': [
    _kycDocumentJson(status: status == 'verified' ? 'verified' : 'submitted'),
  ],
  'next_action': status == 'verified'
      ? 'Business verification is complete.'
      : 'Submit the remaining required documents.',
};

Map<String, dynamic> _twoFactorFactorJson({String status = 'active'}) => {
  'id': '22222222-2222-4222-8222-222222222222',
  'custom_user_id': '11111111-1111-4111-8111-111111111111',
  'factor_type': 'totp',
  'status': status,
  'issuer': 'LetBuyy',
  'label': 'test@example.com',
  'last_verified_at': status == 'active' ? '2026-06-01T12:00:00.000Z' : null,
  'enrolled_at': status == 'active' ? '2026-06-01T12:00:00.000Z' : null,
  'disabled_at': status == 'disabled' ? '2026-06-01T12:10:00.000Z' : null,
  'metadata': const {'algorithm': 'SHA1', 'digits': 6, 'period': 30},
  'created_at': '2026-06-01T11:55:00.000Z',
  'updated_at': '2026-06-01T12:00:00.000Z',
  'deleted_at': null,
};

Map<String, dynamic> _twoFactorSessionJson() => {
  'id': 'session_1',
  'device_id': 'Pixel test device',
  'expires_at': '2026-06-08T12:00:00.000Z',
  'created_at': '2026-06-01T11:00:00.000Z',
  'last_active': '2026-06-01T12:00:00.000Z',
};

Map<String, dynamic> _twoFactorOverviewJson() => {
  'custom_user_id': '11111111-1111-4111-8111-111111111111',
  'email': 'test@example.com',
  'mfa_enabled': false,
  'factors': [_twoFactorFactorJson(status: 'pending')],
  'sessions': [_twoFactorSessionJson()],
};

Map<String, dynamic> _returnJson({
  String id = 'return_1',
  String status = 'approved',
}) => {
  'id': id,
  'store_id': 'store_1',
  'site_id': 'store_1',
  'order_id': 'order_1',
  'order_number': 'order_1',
  'customer_email': 'meera@example.com',
  'status': status,
  'reason': 'Wrong size',
  'refund_method': 'original_payment',
  'refund_id': 'refund_1',
  'refund_status': status == 'refunded' ? 'succeeded' : 'pending',
  'refund_amount': 499,
  'currency': 'INR',
  'created_at': '2026-06-01T11:00:00.000Z',
  'updated_at': '2026-06-01T11:30:00.000Z',
  'lines': const [
    {
      'id': 'return_line_1',
      'order_item_id': 'line_1',
      'quantity': 1,
      'restock_quantity': 1,
      'refund_amount': 499,
      'status': 'restocked',
    },
  ],
};


Map<String,dynamic> _merchantCatalogPlan(String slug,String name,int amount)=>{
 'id':'catalog-$slug','slug':slug,'name':name,'currency':'INR','is_active':true,'purchasable':true,
 'billing_amount_monthly_minor':amount,'billing_amount_yearly_minor':amount*12,
 'limits':{'products':slug=='growth'?null:100},'entitlements':{'custom_domain':true},
};
