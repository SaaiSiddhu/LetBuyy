import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

void main() {
  group('EmptyState', () {
    testWidgets('renders the title and the default inbox icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: EmptyState(title: 'No orders yet')),
      );
      expect(find.text('No orders yet'), findsOneWidget);
      expect(find.byIcon(Icons.inbox), findsOneWidget);
    });

    testWidgets('renders the message only when one is provided', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: EmptyState(title: 'No orders yet')),
      );
      // No message text node beyond the title itself.
      expect(find.byType(Text), findsOneWidget);

      await tester.pumpWidget(
        const MaterialApp(
          home: EmptyState(
            title: 'No orders yet',
            message: 'Orders will appear here once a customer checks out.',
          ),
        ),
      );
      expect(
        find.text('Orders will appear here once a customer checks out.'),
        findsOneWidget,
      );
      expect(find.byType(Text), findsNWidgets(2));
    });

    testWidgets('renders a custom icon when provided', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: EmptyState(title: 'No results', icon: Icons.search_off),
        ),
      );
      expect(find.byIcon(Icons.search_off), findsOneWidget);
      expect(find.byIcon(Icons.inbox), findsNothing);
    });
  });

  group('EmptyStateAdvanced', () {
    testWidgets('renders icon, title, and message', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: EmptyStateAdvanced(
            icon: Icons.shopping_cart_outlined,
            title: 'Your cart is empty',
            message: 'Add items to get started.',
          ),
        ),
      );
      expect(find.byIcon(Icons.shopping_cart_outlined), findsOneWidget);
      expect(find.text('Your cart is empty'), findsOneWidget);
      expect(find.text('Add items to get started.'), findsOneWidget);
    });

    testWidgets('shows no button when buttonText/onButtonPressed are omitted', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: EmptyStateAdvanced(
            icon: Icons.shopping_cart_outlined,
            title: 'Your cart is empty',
            message: 'Add items to get started.',
          ),
        ),
      );
      expect(find.byType(ElevatedButton), findsNothing);
    });

    testWidgets('shows and wires the button only when BOTH text and callback are given', (
      tester,
    ) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: EmptyStateAdvanced(
            icon: Icons.shopping_cart_outlined,
            title: 'Your cart is empty',
            message: 'Add items to get started.',
            buttonText: 'Shop now',
            onButtonPressed: () => tapped = true,
          ),
        ),
      );
      expect(find.text('Shop now'), findsOneWidget);
      await tester.tap(find.text('Shop now'));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('omits the button when only buttonText is given (no callback)', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: EmptyStateAdvanced(
            icon: Icons.shopping_cart_outlined,
            title: 'Your cart is empty',
            message: 'Add items to get started.',
            buttonText: 'Shop now',
          ),
        ),
      );
      // Both conditions in `buttonText != null && onButtonPressed != null`
      // are required -- text alone must not render the button.
      expect(find.byType(ElevatedButton), findsNothing);
    });
  });
}
