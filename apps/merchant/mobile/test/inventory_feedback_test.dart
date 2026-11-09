import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    for (final isError in [false, true]) {
      for (final scale in [1.0, 2.0]) {
        testWidgets(
          '${dark ? 'dark' : 'light'} ${isError ? 'error' : 'success'} feedback has readable composed colors and spoken status at text scale $scale',
          (tester) async {
            final semantics = tester.ensureSemantics();
            const message =
                'Stock confirmation needs review. Your original request is saved.';
            try {
              final theme = dark ? StoreTheme.dark() : StoreTheme.light();
              await tester.pumpWidget(
                MaterialApp(
                  theme: theme,
                  builder: (context, child) => MediaQuery(
                    data: MediaQuery.of(
                      context,
                    ).copyWith(textScaler: TextScaler.linear(scale)),
                    child: child!,
                  ),
                  home: Scaffold(
                    body: Builder(
                      builder: (context) => TextButton(
                        onPressed: () => showLetbuyyOperationFeedback(
                          context,
                          message: message,
                          isError: isError,
                        ),
                        child: const Text('Show feedback'),
                      ),
                    ),
                  ),
                ),
              );
              await tester.tap(find.text('Show feedback'));
              await tester.pumpAndSettle();
              final snackbar = tester.widget<SnackBar>(find.byType(SnackBar));
              final text = tester.widget<Text>(find.text(message));
              final foreground = text.style!.color!;
              final background = snackbar.backgroundColor!;
              expect(background, theme.snackBarTheme.backgroundColor);
              final materials = tester.widgetList<Material>(
                find.descendant(
                  of: find.byType(SnackBar),
                  matching: find.byType(Material),
                ),
              );
              expect(materials.any((m) => m.color == background), isTrue);
              final high = foreground.computeLuminance();
              final low = background.computeLuminance();
              final contrast = high > low
                  ? (high + 0.05) / (low + 0.05)
                  : (low + 0.05) / (high + 0.05);
              expect(contrast, greaterThanOrEqualTo(4.5));
              expect(
                find.byIcon(
                  isError ? Icons.error_outline : Icons.check_circle_outline,
                ),
                findsOneWidget,
              );
              expect(
                find.bySemanticsLabel(
                  '${isError ? 'Error' : 'Success'}: $message',
                ),
                findsOneWidget,
              );
              expect(tester.takeException(), isNull);
            } finally {
              semantics.dispose();
            }
          },
        );
      }
    }
  }
}
