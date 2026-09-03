import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

void main() {
  group('CustomAppBar', () {
    testWidgets('renders the title text', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(appBar: CustomAppBar(title: 'Orders')),
        ),
      );
      expect(find.text('Orders'), findsOneWidget);
    });

    testWidgets('renders provided actions', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            appBar: CustomAppBar(
              title: 'Orders',
              actions: [IconButton(icon: const Icon(Icons.search), onPressed: () {})],
            ),
          ),
        ),
      );
      expect(find.byIcon(Icons.search), findsOneWidget);
    });

    testWidgets('preferredSize matches the standard toolbar height', (
      tester,
    ) async {
      const bar = CustomAppBar(title: 'Orders');
      expect(bar.preferredSize.height, kToolbarHeight);
    });

    testWidgets('isGlass:false renders a plain (non-blurred) AppBar', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            appBar: CustomAppBar(title: 'Orders', isGlass: false),
          ),
        ),
      );
      expect(find.byType(BackdropFilter), findsNothing);
      expect(find.text('Orders'), findsOneWidget);
    });

    testWidgets('isGlass:true (the default) wraps the AppBar in a blur', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(appBar: CustomAppBar(title: 'Orders')),
        ),
      );
      expect(find.byType(BackdropFilter), findsOneWidget);
    });
  });
}
