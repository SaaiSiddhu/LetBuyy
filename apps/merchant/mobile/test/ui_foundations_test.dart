import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/app.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/language_service.dart';
import 'package:letbuyy_store/services/merchant_browser_auth.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/services/theme_provider.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'actual app builder preserves accessibility scaling and retires old account semantics/input',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      final semantics = tester.ensureSemantics();
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final auth = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://identity.example.invalid',
      );
      // Constructor only: no browser, callback, token injection, storage restore or network operation.
      final accounts = MerchantBrowserAuth(
        auth: auth,
        identityBaseUrl: 'http://localhost:9002',
        environment: 'development',
        clientId: 'merchant_android',
      );
      final themes = ThemeProvider(), languages = LanguageService();
      var scale = 0.0, taps = 0;
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<ThemeProvider>.value(value: themes),
              ChangeNotifierProvider<LanguageService>.value(value: languages),
              ChangeNotifierProvider<StoreAuthService>.value(value: auth),
              ChangeNotifierProvider<MerchantBrowserAuth>.value(
                value: accounts,
              ),
            ],
            child: MaterialApp(
              home: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2.4)),
                child: Builder(
                  builder: (context) {
                    // Exercise the actual root presentation boundary with a private child,
                    // without starting AuthWrapper or a hosted sign-in journey.
                    final app =
                        const StoreBuilderApp().build(context) as MaterialApp;
                    return app.builder!(
                      context,
                      Scaffold(
                        body: Builder(
                          builder: (context) {
                            scale = MediaQuery.textScalerOf(context).scale(1);
                            return TextButton(
                              onPressed: () => taps++,
                              child: const Text(
                                'Previous private account action',
                              ),
                            );
                          },
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(scale, 2.4);
        expect(
          find.semantics.byLabel('Previous private account action'),
          findsOneWidget,
        );
        await tester.tap(find.text('Previous private account action'));
        expect(taps, 1);
        auth.setAccountTransition(true);
        await tester.pumpAndSettle();
        expect(
          find.semantics.byLabel('Previous private account action'),
          findsNothing,
        );
        expect(find.text('Finishing your account action…'), findsOneWidget);
        auth.setAccountTransition(false);
        await tester.pumpAndSettle();
        expect(
          find.semantics.byLabel('Previous private account action'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        accounts.dispose();
        auth.dispose();
        api.close();
        themes.dispose();
        languages.dispose();
        semantics.dispose();
      }
    },
  );
  testWidgets(
    'canonical field preserves IME composition and detaches replaced controllers/focus nodes',
    (tester) async {
      final first = TextEditingController(),
          second = TextEditingController(text: 'New draft');
      final firstFocus = FocusNode(), secondFocus = FocusNode();
      Future<void> mount(TextEditingController controller, FocusNode focus) =>
          tester.pumpWidget(
            MaterialApp(
              theme: StoreTheme.dark(),
              home: Scaffold(
                body: CustomTextField(
                  controller: controller,
                  focusNode: focus,
                  label: 'Name',
                  autofillHints: const [AutofillHints.name],
                  validator: (value) =>
                      value == null || value.isEmpty ? 'Enter a name' : null,
                ),
              ),
            ),
          );
      try {
        await mount(first, firstFocus);
        await tester.tap(find.byType(TextFormField));
        const editing = TextEditingValue(
          text: 'தமிழ்',
          selection: TextSelection.collapsed(offset: 5),
          composing: TextRange(start: 0, end: 5),
        );
        tester.testTextInput.updateEditingValue(editing);
        await tester.pump();
        expect(first.value, editing);
        await mount(second, secondFocus);
        first.text = 'Retired draft';
        await tester.pump();
        expect(find.text('New draft'), findsOneWidget);
        expect(find.text('Retired draft'), findsNothing);
        await tester.tap(find.byType(TextFormField));
        await tester.pump();
        expect(secondFocus.hasFocus, isTrue);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        first.dispose();
        second.dispose();
        firstFocus.dispose();
        secondFocus.dispose();
      }
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'composed primary/destructive actions meet contrast and editor Back retains draft in ${dark ? 'dark' : 'light'}',
      (tester) async {
        final theme = dark ? StoreTheme.dark() : StoreTheme.light();
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: Builder(
              builder: (context) => Scaffold(
                body: FilledButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => const LetbuyyEditorScaffold(
                        title: 'Edit item',
                        hasChanges: true,
                        body: Text('Unsaved private draft'),
                        actions: FilledButton(
                          onPressed: null,
                          child: Text('Save'),
                        ),
                      ),
                    ),
                  ),
                  child: const Text('Open editor'),
                ),
              ),
            ),
          ),
        );
        final textContext = tester.element(find.text('Open editor'));
        final foreground = DefaultTextStyle.of(textContext).style.color!;
        final materials = tester.widgetList<Material>(
          find.descendant(
            of: find.widgetWithText(FilledButton, 'Open editor'),
            matching: find.byType(Material),
          ),
        );
        final background = materials.firstWhere((m) => m.color != null).color!;
        double contrast(Color a, Color b) {
          final x = a.computeLuminance(), y = b.computeLuminance();
          return x > y ? (x + .05) / (y + .05) : (y + .05) / (x + .05);
        }

        expect(contrast(foreground, background), greaterThanOrEqualTo(4.5));
        await tester.tap(find.text('Open editor'));
        await tester.pumpAndSettle();
        await tester.tap(find.byTooltip('Back'));
        await tester.pumpAndSettle();
        expect(find.text('Discard changes?'), findsOneWidget);
        final discard = find.widgetWithText(FilledButton, 'Discard changes');
        final confirmationForeground = DefaultTextStyle.of(
          tester.element(find.text('Discard changes')),
        ).style.color!;
        final confirmationBackground = tester
            .widgetList<Material>(
              find.descendant(of: discard, matching: find.byType(Material)),
            )
            .firstWhere((m) => m.color != null)
            .color!;
        expect(
          contrast(confirmationForeground, confirmationBackground),
          greaterThanOrEqualTo(4.5),
        );
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        expect(find.text('Unsaved private draft'), findsOneWidget);
        await tester.tap(find.byTooltip('Back'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Discard changes'));
        await tester.pumpAndSettle();
        expect(find.text('Open editor'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final dark in [false, true]) {
    for (final kind in ['outlined', 'text', 'elevated']) {
      testWidgets(
        'composed $kind action has readable foreground in ${dark ? 'dark' : 'light'}',
        (tester) async {
          final theme = dark ? StoreTheme.dark() : StoreTheme.light();
          final label = '$kind action';
          final button = switch (kind) {
            'outlined' => OutlinedButton(onPressed: () {}, child: Text(label)),
            'text' => TextButton(onPressed: () {}, child: Text(label)),
            _ => ElevatedButton(onPressed: () {}, child: Text(label)),
          };
          await tester.pumpWidget(
            MaterialApp(
              theme: theme,
              home: Scaffold(body: Center(child: button)),
            ),
          );
          final foreground = DefaultTextStyle.of(
            tester.element(find.text(label)),
          ).style.color!;
          final material = tester
              .widgetList<Material>(
                find.descendant(
                  of: find.byWidget(button),
                  matching: find.byType(Material),
                ),
              )
              .first;
          final background = Color.alphaBlend(
            material.color ?? Colors.transparent,
            theme.scaffoldBackgroundColor,
          );
          final a = foreground.computeLuminance(),
              b = background.computeLuminance();
          final contrast = (a > b
              ? (a + .05) / (b + .05)
              : (b + .05) / (a + .05));
          expect(
            contrast,
            greaterThanOrEqualTo(4.5),
            reason:
                'Actual composed $kind foreground $foreground against $background',
          );
        },
      );
    }
  }
}
