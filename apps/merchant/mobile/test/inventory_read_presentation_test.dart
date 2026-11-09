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
      'inventory incremental page filter keeps native input focus dark=$dark',
      (tester) async {
        var reads = 0, writes = 0;
        await workspace.mount(
          tester,
          const InventoryScreen(),
          (request, handler) {
            if (request.method != 'GET') writes++;
            if (request.path.endsWith('/inventory/levels')) reads++;
            workspace.respond(request, handler, [
              workspace.record(workspace.siteA),
            ]);
          },
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        );
        final field = find.byWidgetPredicate(
          (widget) =>
              widget is CustomTextField && widget.label == 'Filter this page',
        );
        final input = find.descendant(
          of: field,
          matching: find.byType(EditableText),
        );
        await tester.showKeyboard(input);
        final focus = tester.widget<EditableText>(input).focusNode;
        final initialReads = reads;
        expect(initialReads, greaterThan(0));
        expect(focus.hasFocus, isTrue);
        for (final text in ['S', 'Syn', 'Synthetic warehouse']) {
          tester.testTextInput.enterText(text);
          await tester.pump();
          expect(tester.widget<EditableText>(input).focusNode, same(focus));
          expect(
            focus.hasFocus,
            isTrue,
            reason: 'Typing must retain the active native editor',
          );
          expect(tester.testTextInput.isVisible, isTrue);
          expect(tester.widget<EditableText>(input).controller.text, text);
        }
        expect(find.textContaining('Private A'), findsWidgets);
        expect(
          reads,
          initialReads,
          reason: 'This is the existing local page filter',
        );
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );
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
