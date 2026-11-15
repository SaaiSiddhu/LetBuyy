import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/settings/merchant_theme_selector.dart';
import 'package:letbuyy_store/widgets/settings/settings_tile.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  late ThemeProvider preference;
  setUp(() async {
    SharedPreferences.setMockInitialValues({'app_theme_mode': 'dark'});
    preference = ThemeProvider();
    await preference.loadTheme();
  });
  tearDown(() => preference.dispose());
  Future<void> mount(
    WidgetTester tester, {
    double scale = 1,
    bool reduced = false,
  }) => tester.pumpWidget(
    ChangeNotifierProvider<ThemeProvider>.value(
      value: preference,
      child: Consumer<ThemeProvider>(
        builder: (context, theme, _) => MaterialApp(
          theme: StoreTheme.light(),
          darkTheme: StoreTheme.dark(),
          themeMode: theme.themeMode,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(scale),
              disableAnimations: reduced,
            ),
            child: child!,
          ),
          home: const Scaffold(
            body: SettingsTile(
              icon: Icons.palette_outlined,
              title: 'Theme',
              trailing: MerchantThemeSelector(),
              showArrow: false,
            ),
          ),
        ),
      ),
    ),
  );
  Future<void> open(WidgetTester tester) async {
    await tester.tap(find.byType(MerchantThemeSelector));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'draft selection and dismissal do not change the existing saved preference; Apply does',
    (tester) async {
      await mount(tester);
      await open(tester);
      await tester.tap(find.text('Light'));
      await tester.pumpAndSettle();
      expect(preference.themeMode, ThemeMode.dark);
      expect(
        (await SharedPreferences.getInstance()).getString('app_theme_mode'),
        'dark',
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(preference.themeMode, ThemeMode.dark);
      final trigger = tester.widget<TextButton>(
        find.descendant(
          of: find.byType(MerchantThemeSelector),
          matching: find.byType(TextButton),
        ),
      );
      expect(trigger.focusNode!.hasFocus, isTrue);
      await open(tester);
      await tester.tap(find.text('Light'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Apply theme'));
      await tester.pumpAndSettle();
      expect(preference.themeMode, ThemeMode.light);
      expect(
        (await SharedPreferences.getInstance()).getString('app_theme_mode'),
        'light',
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'system remains the existing supported mode and repeated activation opens only one sheet',
    (tester) async {
      await mount(tester);
      final trigger = tester.widget<TextButton>(
        find.descendant(
          of: find.byType(MerchantThemeSelector),
          matching: find.byType(TextButton),
        ),
      );
      trigger.onPressed!();
      trigger.onPressed!();
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyFormSheet), findsOneWidget);
      await tester.tap(find.text('System'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Apply theme'));
      await tester.pumpAndSettle();
      expect(preference.themeMode, ThemeMode.system);
      expect(
        (await SharedPreferences.getInstance()).getString('app_theme_mode'),
        'system',
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'platform Back discards an unapplied preference without changing persistence',
    (tester) async {
      await mount(tester);
      await open(tester);
      await tester.tap(find.text('Light'));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyFormSheet), findsNothing);
      expect(preference.themeMode, ThemeMode.dark);
      expect(
        (await SharedPreferences.getInstance()).getString('app_theme_mode'),
        'dark',
      );
    },
  );
  for (final reduced in [false, true]) {
    testWidgets(
      'theme sheet reflows at 320px and scale2.4, reduced motion $reduced',
      (tester) async {
        tester.view.physicalSize = const Size(320, 500);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final semantics = tester.ensureSemantics();
        try {
          await mount(tester, scale: 2.4, reduced: reduced);
          expect(find.semantics.byLabel('Current theme: Dark'), findsOneWidget);
          await tester.tap(find.byType(MerchantThemeSelector));
          await tester.pump();
          if (reduced)
            expect(
              ModalRoute.of(
                tester.element(find.byType(LetbuyyFormSheet)),
              )!.animation!.value,
              1,
            );
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.text('Apply theme'));
          await tester.pumpAndSettle();
          expect(find.text('Apply theme').hitTestable(), findsOneWidget);
          expect(tester.takeException(), isNull);
        } finally {
          await tester.pumpWidget(const SizedBox.shrink());
          semantics.dispose();
        }
      },
    );
  }
}
