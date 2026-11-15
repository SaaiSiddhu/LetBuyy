import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'store_switcher_presentation_test.dart' as f;

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    testWidgets(
      'membership refresh is immediately reachable with53stores dark$dark',
      (tester) async {
        final h = f.Harness();
        await h.mount(
          tester,
          dark: dark,
          size: const Size(320, 740),
          scale: 2.4,
        );
        h.service.rows = [
          f.row(f.a),
          for (var n = 1; n <= 51; n++)
            {
              'id': 'synthetic-extra-$n',
              'name': 'Synthetic membership $n',
              'subdomain': 'synthetic-extra-$n',
            },
          f.row(f.b),
        ];
        await h.stores.loadStores(force: true);
        await tester.pumpAndSettle();
        await h.open(tester);
        expect(
          f.button('Refresh stores').hitTestable(),
          findsOneWidget,
          reason:
              'Refreshing membership access must be available before traversing the long choice list',
        );
        final reads = h.service.reads;
        await tester.tap(f.button('Refresh stores'));
        await tester.pumpAndSettle();
        expect(h.service.reads, reads + 1);
        expect(h.stores.stores.length, 53);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
