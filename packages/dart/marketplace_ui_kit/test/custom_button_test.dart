import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

Future<void> _pump(WidgetTester tester, Widget child) {
  return tester.pumpWidget(MaterialApp(home: Scaffold(body: Center(child: child))));
}

void main() {
  group('CustomButton', () {
    testWidgets('renders its text label', (tester) async {
      await _pump(tester, const CustomButton(text: 'Checkout'));
      expect(find.text('Checkout'), findsOneWidget);
    });

    testWidgets('tapping it invokes onPressed', (tester) async {
      var taps = 0;
      await _pump(
        tester,
        CustomButton(text: 'Checkout', onPressed: () => taps++),
      );
      await tester.tap(find.byType(CustomButton));
      await tester.pump();
      expect(taps, 1);
    });

    testWidgets('a null onPressed disables the button', (tester) async {
      await _pump(tester, const CustomButton(text: 'Checkout', onPressed: null));
      final elevatedButton = tester.widget<ElevatedButton>(
        find.byType(ElevatedButton),
      );
      expect(elevatedButton.onPressed, isNull);
    });

    testWidgets('isLoading shows a spinner and hides the label', (tester) async {
      await _pump(
        tester,
        CustomButton(text: 'Checkout', onPressed: () {}, isLoading: true),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Checkout'), findsNothing);
    });

    testWidgets('isLoading disables the button even with a real onPressed', (
      tester,
    ) async {
      var taps = 0;
      await _pump(
        tester,
        CustomButton(text: 'Checkout', onPressed: () => taps++, isLoading: true),
      );
      final elevatedButton = tester.widget<ElevatedButton>(
        find.byType(ElevatedButton),
      );
      expect(elevatedButton.onPressed, isNull);
      // Confirms the disabled state actually blocks the tap, not just the
      // widget's own onPressed field.
      await tester.tap(find.byType(CustomButton), warnIfMissed: false);
      await tester.pump();
      expect(taps, 0);
    });

    testWidgets('renders the given icon when provided', (tester) async {
      await _pump(
        tester,
        const CustomButton(text: 'Save', icon: Icons.save),
      );
      expect(find.byIcon(Icons.save), findsOneWidget);
    });

    testWidgets('renders no icon when none is provided', (tester) async {
      await _pump(tester, const CustomButton(text: 'Save'));
      expect(find.byType(Icon), findsNothing);
    });

    testWidgets('each ButtonType renders its expected Material widget', (
      tester,
    ) async {
      await _pump(
        tester,
        const CustomButton(text: 'x', type: ButtonType.filled),
      );
      expect(find.byType(ElevatedButton), findsOneWidget);

      await _pump(
        tester,
        const CustomButton(text: 'x', type: ButtonType.outlined),
      );
      expect(find.byType(OutlinedButton), findsOneWidget);

      await _pump(
        tester,
        const CustomButton(text: 'x', type: ButtonType.text),
      );
      expect(find.byType(TextButton), findsOneWidget);

      await _pump(
        tester,
        const CustomButton(text: 'x', type: ButtonType.glass),
      );
      expect(find.byType(InkWell), findsOneWidget);
    });

    testWidgets('isFullWidth expands to infinite width by default', (
      tester,
    ) async {
      await _pump(tester, const CustomButton(text: 'x'));
      final sizedBox = tester.widget<SizedBox>(
        find.ancestor(
          of: find.byType(ElevatedButton),
          matching: find.byType(SizedBox),
        ).first,
      );
      expect(sizedBox.width, double.infinity);
    });
  });
}
