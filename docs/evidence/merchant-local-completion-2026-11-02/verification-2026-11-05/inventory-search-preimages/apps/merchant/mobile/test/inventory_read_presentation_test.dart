import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/screens/inventory/records_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'inventory_records_scope_test.dart' as records;

const longName =
    'Long warehouse product with exact variant and supplier reference';

void expectReadable(WidgetTester tester) {
  expect(tester.takeException(), isNull);
  for (final e in find.byType(Text).evaluate()) {
    final p = e.renderObject;
    if (p is RenderParagraph) {
      expect(p.didExceedMaxLines, isFalse, reason: (e.widget as Text).data);
    }
  }
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'stock page keeps long data and shown metrics readable at 320dp scale2.4 dark=$dark',
      (tester) async {
        await workspace.mount(
          tester,
          const InventoryScreen(),
          (r, h) {
            workspace.respond(r, h, [
              {
                ...workspace.record(workspace.siteA),
                'product_name': longName,
                'variant_title': 'Long variant title with an exact reference',
                'sku': 'EXACT-REFERENCE-LONG-SKU-01234567890123456789',
                'location_name':
                    'Long warehouse location with a regional receiving reference',
              },
            ]);
          },
          windowSize: const Size(320, 640),
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          textScale: 2.4,
        );
        expectReadable(tester);
        expect(find.textContaining('Available shown'), findsOneWidget);
        await tester.scrollUntilVisible(
          find.textContaining(longName),
          160,
          scrollable: find
              .byWidgetPredicate(
                (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
              )
              .first,
        );
        expectReadable(tester);
      },
    );
    for (final kind in InventoryRecordKind.values) {
      testWidgets(
        '${kind.name} register keeps filter and record readable at 320dp scale2.4 dark=$dark',
        (tester) async {
          await workspace.mount(
            tester,
            InventoryRecordsScreen(
              kind: kind,
              productId: kind == InventoryRecordKind.receipts
                  ? null
                  : records.productId,
              productName: longName,
            ),
            (r, h) {
              final row = switch (kind) {
                InventoryRecordKind.history => {
                  ...workspace.historyRecord(records.siteA),
                  'products': {'name': longName, 'store_id': records.siteA},
                },
                InventoryRecordKind.reservations => records.reservation(
                  name: longName,
                ),
                InventoryRecordKind.receipts => records.receipt(),
              };
              records.respond(r, h, [row]);
            },
            windowSize: const Size(320, 640),
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            textScale: 2.4,
          );
          expectReadable(tester);
          expect(
            find.textContaining(
              kind == InventoryRecordKind.receipts
                  ? 'Purchase order receipt'
                  : longName,
            ),
            findsWidgets,
          );
        },
      );
    }
  }
}
