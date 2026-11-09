import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/recorded_history_chart.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final values in [
    <double?>[0, 0, 0],
    <double?>[-12.34, -56.78],
    <double?>[12.34, null, 56.78],
  ]) {
    testWidgets(
      'recorded chart retains exact zero/negative/gap points $values',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: StoreTheme.light(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: RecordedHistoryChart(
                  title: 'Revenue',
                  valuesTitle: 'Daily exact values',
                  current: RecordedHistorySeries(
                    label: 'Applied current range',
                    values: values,
                    dates: List.generate(
                      values.length,
                      (i) => DateTime(2026, 11, i + 1),
                    ),
                  ),
                  previous: RecordedHistorySeries(
                    label: 'Previous real range',
                    values: const [1.23, 4.56],
                    dates: [DateTime(2026, 10, 24), DateTime(2026, 10, 25)],
                  ),
                  formatValue: (v) => '₹${v.toStringAsFixed(2)}',
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final chart = tester.widget<LineChart>(find.byType(LineChart));
        expect(chart.duration, Duration.zero);
        expect(chart.data.lineBarsData.first.spots.map((s) => s.y), [
          1.23,
          4.56,
        ]);
        final spots = chart.data.lineBarsData.last.spots;
        for (var i = 0; i < values.length; i++) {
          if (values[i] == null) {
            expect(spots[i], FlSpot.nullSpot);
          } else {
            expect(spots[i].y, values[i]);
          }
        }
        expect(
          chart.data.minY,
          lessThanOrEqualTo(
            values.whereType<double>().reduce((a, b) => a < b ? a : b),
          ),
        );
        expect(chart.data.gridData.horizontalInterval, greaterThan(0));
        final previous = chart.data.lineBarsData.first;
        final tooltip = chart.data.lineTouchData.touchTooltipData
            .getTooltipItems([LineBarSpot(previous, 0, previous.spots.first)])
            .single!;
        expect(tooltip.text, '₹1.23');
        expect(tooltip.children!.single.text, contains('24 Oct 2026'));
        await tester.ensureVisible(find.text('Daily exact values'));
        await tester.tap(find.text('Daily exact values'));
        await tester.pumpAndSettle();
        expect(find.text('24 Oct 2026'), findsOneWidget);
        if (values.contains(null))
          expect(find.text('Unavailable'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final dark in [false, true]) {
    testWidgets(
      '365 recorded points and full comparison label remain readable at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        const previousLabel =
            'Previous complete calendar range with a deliberately long descriptive label';
        final dates = List.generate(
          365,
          (i) => DateTime(2025, 11, 3).add(Duration(days: i)),
        );
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
                child: RecordedHistoryChart(
                  title: 'Revenue',
                  valuesTitle: 'Daily exact values',
                  current: RecordedHistorySeries(
                    label: 'Applied calendar range',
                    values: List.filled(365, 999999999.99),
                    dates: dates,
                  ),
                  previous: RecordedHistorySeries(
                    label: previousLabel,
                    values: const [0, 0],
                    dates: const [],
                  ),
                  formatValue: (v) => '₹${v.toStringAsFixed(2)}',
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final data = tester.widget<LineChart>(find.byType(LineChart)).data;
        expect(data.lineBarsData.last.spots, hasLength(365));
        expect(
          data.titlesData.bottomTitles.sideTitles.interval,
          greaterThanOrEqualTo(182),
        );
        expect(data.lineBarsData.last.spots.last.y, 999999999.99);
        await tester.ensureVisible(find.text('$previousLabel · dashed line'));
        expect(
          tester
              .renderObject<RenderParagraph>(
                find.text('$previousLabel · dashed line'),
              )
              .didExceedMaxLines,
          isFalse,
        );
        final semantics = tester.ensureSemantics();
        expect(
          find.bySemanticsLabel(RegExp('Revenue chart. Exact dated values')),
          findsOneWidget,
        );
        semantics.dispose();
        expect(tester.binding.transientCallbackCount, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
