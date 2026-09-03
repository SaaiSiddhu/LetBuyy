import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

void main() {
  List<CustomBottomNavItem> items() => [
    CustomBottomNavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
    CustomBottomNavItem(icon: Icons.search_outlined, activeIcon: Icons.search, label: 'Search'),
    CustomBottomNavItem(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Profile'),
  ];

  group('CustomBottomNav', () {
    testWidgets('shows the label only for the currently selected item', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomBottomNav(currentIndex: 1, onTap: (_) {}, items: items()),
          ),
        ),
      );

      expect(find.text('Search'), findsOneWidget);
      expect(find.text('Home'), findsNothing);
      expect(find.text('Profile'), findsNothing);
    });

    testWidgets('the selected item uses its active icon, others use inactive', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomBottomNav(currentIndex: 0, onTap: (_) {}, items: items()),
          ),
        ),
      );

      expect(find.byIcon(Icons.home), findsOneWidget); // active
      expect(find.byIcon(Icons.home_outlined), findsNothing);
      expect(find.byIcon(Icons.search_outlined), findsOneWidget); // inactive
      expect(find.byIcon(Icons.person_outline), findsOneWidget); // inactive
    });

    testWidgets('tapping an item calls onTap with that item\'s index', (
      tester,
    ) async {
      final tapped = <int>[];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomBottomNav(
              currentIndex: 0,
              onTap: tapped.add,
              items: items(),
            ),
          ),
        ),
      );

      await tester.tap(find.byIcon(Icons.person_outline));
      await tester.pump();

      expect(tapped, [2]);
    });

    testWidgets('renders all item icons regardless of selection', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomBottomNav(currentIndex: 0, onTap: (_) {}, items: items()),
          ),
        ),
      );
      expect(find.byType(InkWell), findsNWidgets(3));
    });
  });
}
