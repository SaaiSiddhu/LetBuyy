import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'warehouse_create_form_test.dart' as forms;
import 'support/warehouse_fixture.dart' as w;

const title =
    'Long receiving variant title with exact packaging and regional supplier reference';
const sku = 'EXACT-LONG-VARIANT-REFERENCE-00000001';
const label = '$title · $sku';

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'warehouse selected variant remains exact and readable at320dp scale2.4 dark=$dark',
      (tester) async {
        var writes = 0;
        await workspace.mount(
          tester,
          const PurchaseOrdersScreen(),
          (r, h) {
            if (r.method != 'GET') writes++;
            if (r.path.endsWith('/products/${w.warehouseProduct}')) {
              final product = forms.product();
              (product['variants'] as List).first['title'] = title;
              (product['variants'] as List).first['sku'] = sku;
              workspace.respond(r, h, product);
            } else {
              forms.respond(r, h);
            }
          },
          windowSize: const Size(320, 640),
          theme: dark ? StoreTheme.dark() : StoreTheme.light(),
          textScale: 2.4,
        );
        await forms.tap(tester, find.text('New PO'));
        await tester.scrollUntilVisible(
          find.text('Choose product for line 1'),
          160,
        );
        await tester.pumpAndSettle();
        await forms.tap(tester, find.text('Choose product for line 1'));
        await forms.tap(tester, find.text('Synthetic shirt').last);
        await forms.tap(tester, find.byType(LetbuyyChoiceField<String>).last);
        await forms.tap(tester, find.text(label).last);
        await forms.tap(tester, find.text('Apply selection'));
        expect(find.text(label), findsOneWidget);
        expect(
          tester
              .renderObject<RenderParagraph>(find.text(label))
              .didExceedMaxLines,
          isFalse,
        );
        expect(writes, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
