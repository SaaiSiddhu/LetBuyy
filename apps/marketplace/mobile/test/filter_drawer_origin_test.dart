import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace/screens/shop/widgets/filter_drawer.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await SharedPreferencesService.init();
  });

  testWidgets('selects a facet origin and applies it as the active filter', (
    tester,
  ) async {
    Map<String, dynamic>? appliedFilters;
    final scaffoldKey = GlobalKey<ScaffoldState>();

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => ThemeProvider(),
        child: MaterialApp(
          home: Scaffold(
            key: scaffoldKey,
            endDrawer: FilterDrawer(
              originOptions: const ['Japan', 'India'],
              onApply: (filters) => appliedFilters = filters,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    scaffoldKey.currentState!.openEndDrawer();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Origin').first);
    await tester.pumpAndSettle();
    final originField = find.byType(TextField);
    expect(originField, findsOneWidget);
    await tester.tap(originField);
    await tester.enterText(originField, 'jap');
    await tester.pumpAndSettle();
    expect(find.text('Japan'), findsOneWidget);
    await tester.tap(find.text('Japan').last);
    await tester.pumpAndSettle();

    expect(find.text('Japan'), findsNWidgets(2));
    expect(find.text('Apply 1 Filter'), findsOneWidget);
    await tester.tap(find.text('Apply 1 Filter'));
    await tester.pumpAndSettle();

    expect(appliedFilters?['countryOfOrigin'], 'Japan');
    expect(appliedFilters?['attributeFilters'], isEmpty);
  });

  testWidgets('selects and applies an origin facet from the keyboard', (
    tester,
  ) async {
    Map<String, dynamic>? appliedFilters;
    final scaffoldKey = GlobalKey<ScaffoldState>();

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => ThemeProvider(),
        child: MaterialApp(
          home: Scaffold(
            key: scaffoldKey,
            endDrawer: FilterDrawer(
              originOptions: const ['Japan', 'India'],
              onApply: (filters) => appliedFilters = filters,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    scaffoldKey.currentState!.openEndDrawer();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Origin').first);
    await tester.pumpAndSettle();
    final originField = find.byType(TextField);
    await tester.tap(originField);
    await tester.enterText(originField, 'jap');
    await tester.pumpAndSettle();
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(find.text('Apply 1 Filter'), findsOneWidget);
    await tester.tap(find.text('Apply 1 Filter'));
    await tester.pumpAndSettle();

    expect(appliedFilters?['countryOfOrigin'], 'Japan');
  });

  testWidgets('origin options failure exposes a retry action', (tester) async {
    var retryCount = 0;
    final scaffoldKey = GlobalKey<ScaffoldState>();

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => ThemeProvider(),
        child: MaterialApp(
          home: Scaffold(
            key: scaffoldKey,
            endDrawer: FilterDrawer(
              originOptionsError: true,
              onRetryOriginOptions: () async => retryCount++,
              onApply: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    scaffoldKey.currentState!.openEndDrawer();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Origin').first);
    await tester.pumpAndSettle();
    expect(find.text('Could not load origin filters.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(retryCount, 1);
  });
}
