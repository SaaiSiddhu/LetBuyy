import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    for (final label in [
      'Review the supported store setup',
      'Reload the saved store details',
    ]) {
      testWidgets(
        'multiline label stays on its filled surface dark=$dark $label',
        (tester) async {
          await tester.pumpWidget(
            MaterialApp(
              theme: dark ? StoreTheme.dark() : StoreTheme.light(),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(2.4)),
                child: child!,
              ),
              home: Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 224,
                    child: FilledButton(onPressed: () {}, child: Text(label)),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          final button = find.byType(FilledButton);
          final surface = find.descendant(
            of: button,
            matching: find.byType(Material),
          );
          expect(surface, findsOneWidget);
          final shape = tester.widget<Material>(surface).shape!;
          final box = tester.getRect(surface);
          final text = tester
              .getRect(find.text(label))
              .shift(-box.topLeft)
              .deflate(1);
          final painted = shape.getOuterPath(Offset.zero & box.size);
          for (final point in [
            text.topLeft,
            text.topRight,
            text.bottomLeft,
            text.bottomRight,
          ]) {
            expect(
              painted.contains(point),
              isTrue,
              reason:
                  'The full decision label must stay over its paired background, including multiline corners',
            );
          }
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
