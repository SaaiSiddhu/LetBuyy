import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

void main() {
  group('ErrorView', () {
    testWidgets('renders the fixed headline plus the given message', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ErrorView(message: 'Could not load your orders.'),
        ),
      );
      expect(find.text('Oops! Something went wrong'), findsOneWidget);
      expect(find.text('Could not load your orders.'), findsOneWidget);
    });

    testWidgets('shows no retry button when onRetry is omitted', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: ErrorView(message: 'x')),
      );
      expect(find.text('Try Again'), findsNothing);
    });

    testWidgets('shows a retry button that invokes onRetry when tapped', (
      tester,
    ) async {
      var retried = false;
      await tester.pumpWidget(
        MaterialApp(
          home: ErrorView(message: 'x', onRetry: () => retried = true),
        ),
      );
      expect(find.text('Try Again'), findsOneWidget);
      await tester.tap(find.text('Try Again'));
      await tester.pump();
      expect(retried, isTrue);
    });
  });
}
