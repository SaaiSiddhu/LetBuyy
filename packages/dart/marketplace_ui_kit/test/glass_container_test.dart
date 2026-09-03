import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

BoxDecoration _innerDecoration(WidgetTester tester) {
  // The child-carrying Container is the innermost of the two Containers
  // GlassContainer builds (the outer one only carries margin/shadow).
  final containers = tester.widgetList<Container>(find.byType(Container));
  return containers.last.decoration as BoxDecoration;
}

void main() {
  group('GlassContainer', () {
    testWidgets('renders its child', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: GlassContainer(child: Text('inside')),
        ),
      );
      expect(find.text('inside'), findsOneWidget);
    });

    testWidgets('applies a blur filter behind the child', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: GlassContainer(child: Text('inside')),
        ),
      );
      expect(find.byType(BackdropFilter), findsOneWidget);
    });

    testWidgets('uses the light-mode surface color under a light theme', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: Brightness.light),
          home: const GlassContainer(child: Text('inside')),
        ),
      );
      final decoration = _innerDecoration(tester);
      expect(decoration.color, AppColors.surfaceGlass);
    });

    testWidgets('uses the dark-mode surface color under a dark theme', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: Brightness.dark),
          home: const GlassContainer(child: Text('inside')),
        ),
      );
      final decoration = _innerDecoration(tester);
      expect(decoration.color, AppColors.surfaceGlassDark);
    });

    testWidgets('an explicit color overrides the theme-derived default', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: GlassContainer(color: Colors.red, child: Text('inside')),
        ),
      );
      final decoration = _innerDecoration(tester);
      expect(decoration.color, Colors.red);
    });

    testWidgets('defaults to a 16-radius rounded rectangle border', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: GlassContainer(child: Text('inside')),
        ),
      );
      final decoration = _innerDecoration(tester);
      expect(decoration.borderRadius, BorderRadius.circular(16));
    });

    testWidgets('an explicit borderRadius overrides the default', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: GlassContainer(
            borderRadius: BorderRadius.circular(4),
            child: const Text('inside'),
          ),
        ),
      );
      final decoration = _innerDecoration(tester);
      expect(decoration.borderRadius, BorderRadius.circular(4));
    });
  });
}
