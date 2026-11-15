import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/dashboard/animated_revenue_chart.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets('zero revenue axis keeps fractional tick labels distinct', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: StoreTheme.light(),
        home: const Scaffold(body: AnimatedRevenueChart(revenueData: [0, 0])),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('0.25'), findsOneWidget);
    expect(find.text('0.50'), findsOneWidget);
    expect(find.text('0.75'), findsOneWidget);
    expect(
      tester
          .widget<LineChart>(find.byType(LineChart))
          .data
          .lineBarsData
          .single
          .spots
          .map((spot) => spot.y),
      [0, 0],
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'revenue tooltip keeps source units and paise independent of animation',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: StoreTheme.light(),
          home: const Scaffold(
            body: AnimatedRevenueChart(
              totalRevenue: 69.12,
              revenueData: [12.34, 56.78],
            ),
          ),
        ),
      );
      final data = tester.widget<LineChart>(find.byType(LineChart)).data;
      final bar = data.lineBarsData.single;
      final items = data.lineTouchData.touchTooltipData.getTooltipItems([
        LineBarSpot(bar, 0, bar.spots.first),
      ]);
      expect(items.single!.text, '₹12.34');
      expect(find.text('₹69.12'), findsOneWidget);
      await tester.pumpAndSettle();
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'revenue reflows with exact accessible values and reduced motion in ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(320, 600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(2.4),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: Scaffold(
              body: SingleChildScrollView(
                child: AnimatedRevenueChart(
                  totalRevenue: 12345678.90,
                  revenueData: const [12.34, 56.78],
                  revenueDates: [DateTime(2026, 11, 1), DateTime(2026, 11, 2)],
                ),
              ),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
        expect(tester.binding.transientCallbackCount, 0);
        final bar = tester
            .widget<LineChart>(find.byType(LineChart))
            .data
            .lineBarsData
            .single;
        expect(bar.spots.map((spot) => spot.y), [12.34, 56.78]);
        expect(find.text('₹1,23,45,678.90'), findsOneWidget);
        expect(find.text('Live total'), findsNothing);
        expect(find.textContaining('vs last'), findsNothing);
        await tester.ensureVisible(find.text('Daily revenue values'));
        await tester.tap(find.text('Daily revenue values'));
        await tester.pumpAndSettle();
        expect(find.text('₹12.34'), findsOneWidget);
        expect(find.text('₹56.78'), findsOneWidget);
        expect(find.text('1 Nov 2026'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
