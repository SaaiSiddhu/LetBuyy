import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';

void main() {
  group('PremiumScaffold', () {
    testWidgets('always renders the required body', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: PremiumScaffold(body: Text('page content')),
        ),
      );
      expect(find.text('page content'), findsOneWidget);
    });

    testWidgets('passes through appBar, bottomNavigationBar, and FAB', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: PremiumScaffold(
            appBar: AppBar(title: const Text('Title')),
            body: const Text('page content'),
            bottomNavigationBar: const Text('bottom nav'),
            floatingActionButton: FloatingActionButton(
              onPressed: () {},
              child: const Icon(Icons.add),
            ),
          ),
        ),
      );
      expect(find.text('Title'), findsOneWidget);
      expect(find.text('bottom nav'), findsOneWidget);
      expect(find.byType(FloatingActionButton), findsOneWidget);
    });

    testWidgets(
      'defaults backgroundColor to the theme\'s scaffoldBackgroundColor '
      'when none is given',
      (tester) async {
        const themeBackground = Color(0xFF123456);
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(scaffoldBackgroundColor: themeBackground),
            home: const PremiumScaffold(body: Text('x')),
          ),
        );
        final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
        expect(scaffold.backgroundColor, themeBackground);
      },
    );

    testWidgets('an explicit backgroundColor overrides the theme default', (
      tester,
    ) async {
      const themeBackground = Color(0xFF123456);
      const explicitBackground = Color(0xFFABCDEF);
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(scaffoldBackgroundColor: themeBackground),
          home: const PremiumScaffold(
            backgroundColor: explicitBackground,
            body: Text('x'),
          ),
        ),
      );
      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffold.backgroundColor, explicitBackground);
    });

    testWidgets('resizeToAvoidBottomInset is always true', (tester) async {
      // A deliberate, documented choice (the source comment says the app
      // relies on a browser API override instead) -- worth pinning down
      // explicitly since a silent flip would change real keyboard behaviour.
      await tester.pumpWidget(
        const MaterialApp(home: PremiumScaffold(body: Text('x'))),
      );
      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffold.resizeToAvoidBottomInset, isTrue);
    });
  });
}
