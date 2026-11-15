import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

void main() {
  for (final dark in [false, true]) {
    testWidgets(
      'shared metrics retain exact values and one action at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final semantics = tester.ensureSemantics();
        try {
          var taps = 0;
          const label = 'Exact retained operational amount';
          const value = 'INR 99,99,99,999.99';
          await tester.pumpWidget(
            MaterialApp(
              theme: dark ? StoreTheme.dark() : StoreTheme.light(),
              home: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2.4)),
                child: Scaffold(
                  body: SingleChildScrollView(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: StatGrid(
                        children: [
                          StatTile(
                            icon: Icons.payments_outlined,
                            label: label,
                            value: value,
                            onTap: () => taps++,
                          ),
                          const StatTile(
                            icon: Icons.inventory_2_outlined,
                            label: 'Stock availability',
                            value: 'Unavailable',
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(
            tester
                .renderObject<RenderParagraph>(find.text(value))
                .didExceedMaxLines,
            isFalse,
          );
          expect(
            tester
                .renderObject<RenderParagraph>(find.text(label))
                .didExceedMaxLines,
            isFalse,
          );
          expect(find.semantics.byLabel('$label, $value'), findsOneWidget);
          expect(
            MediaQuery.textScalerOf(tester.element(find.text(value))).scale(1),
            2.4,
          );
          await tester.tap(find.text(value));
          expect(taps, 1);
          final target = tester.getRect(find.byType(StatTile).first);
          expect(target.height, greaterThanOrEqualTo(48));
          expect(target.width, greaterThanOrEqualTo(48));
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );
  }
}
