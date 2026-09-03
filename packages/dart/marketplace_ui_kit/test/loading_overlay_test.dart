import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

void main() {
  group('LoadingOverlay', () {
    testWidgets('always renders the child, loading or not', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: false, child: Text('content')),
        ),
      );
      expect(find.text('content'), findsOneWidget);

      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: true, child: Text('content')),
        ),
      );
      expect(
        find.text('content'),
        findsOneWidget,
        reason: 'the overlay is stacked on top, not a replacement',
      );
    });

    testWidgets('shows no spinner when isLoading is false', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: false, child: Text('content')),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('shows a spinner when isLoading is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(isLoading: true, child: Text('content')),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows loadingText only when both isLoading and text are set', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(
            isLoading: true,
            loadingText: 'Placing your order...',
            child: Text('content'),
          ),
        ),
      );
      expect(find.text('Placing your order...'), findsOneWidget);

      // Same loadingText, but not loading -- must not render, since it
      // lives inside the `if (isLoading)` branch entirely.
      await tester.pumpWidget(
        const MaterialApp(
          home: LoadingOverlay(
            isLoading: false,
            loadingText: 'Placing your order...',
            child: Text('content'),
          ),
        ),
      );
      expect(find.text('Placing your order...'), findsNothing);
    });
  });
}
