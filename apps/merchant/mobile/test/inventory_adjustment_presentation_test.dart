import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'inventory_workspace_test.dart' as workspace;

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'stock adjustment stays usable with a keyboard at320dp scale2.4 dark=$dark',
      (tester) async {
        var writes = 0;
        await workspace.mount(
          tester,
          const InventoryScreen(),
          (r, h) {
            if (r.method != 'GET') writes++;
            workspace.respond(r, h, [workspace.record(workspace.siteA)]);
          },
          windowSize: const Size(320, 640),
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          textScale: 2.4,
        );
        final vertical = find
            .byWidgetPredicate(
              (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
            )
            .first;
        await tester.scrollUntilVisible(
          find.text('Adjust'),
          160,
          scrollable: vertical,
        );
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<OutlinedButton>(
                find.widgetWithText(OutlinedButton, 'Adjust'),
              )
              .onPressed,
          isNotNull,
        );
        await tester.tap(find.text('Adjust'));
        await tester.pumpAndSettle();
        final quantity = find.byWidgetPredicate(
          (w) => w is TextField && w.decoration?.labelText == 'Change quantity',
        );
        expect(quantity, findsOneWidget);
        await tester.enterText(quantity, '+5');
        tester.view.viewInsets = const FakeViewPadding(bottom: 240);
        addTearDown(tester.view.resetViewInsets);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Apply'));
        await tester.ensureVisible(find.text('Cancel'));
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        tester.view.resetViewInsets();
        await tester.pumpAndSettle();
        expect(writes, 0);
        expect(find.byType(InventoryScreen), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
