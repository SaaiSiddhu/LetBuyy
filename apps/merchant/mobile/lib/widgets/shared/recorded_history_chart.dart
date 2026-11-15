import 'dart:math' as math;
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Canonical recorded-series presentation. Callers retain authority for values,
/// dates, availability, units and population. There is no business aggregation.
class RecordedHistorySeries {
  const RecordedHistorySeries({
    required this.label,
    required this.values,
    required this.dates,
  });
  final String label;
  final List<double?> values;
  final List<DateTime> dates;
}

class RecordedHistoryChart extends StatelessWidget {
  const RecordedHistoryChart({
    super.key,
    required this.title,
    required this.current,
    required this.formatValue,
    required this.valuesTitle,
    this.previous,
    this.supportingText,
    this.header,
    this.icon = Icons.show_chart_rounded,
    this.axisValue,
    this.discreteValues = false,
  });
  final String title, valuesTitle;
  final RecordedHistorySeries current;
  final RecordedHistorySeries? previous;
  final String Function(double) formatValue;
  final String Function(double)? axisValue;
  final String? supportingText;
  final Widget? header;
  final IconData icon;

  /// Count axes use whole units. Source points and value formatting are intact.
  final bool discreteValues;

  String _date(RecordedHistorySeries series, int index) {
    if (index >= series.dates.length) {
      return 'Date unavailable (point ${index + 1})';
    }
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final day = series.dates[index];
    return '${day.day} ${months[day.month - 1]} ${day.year}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    final series = [current, if (previous != null) previous!];
    final observed = [
      for (final row in series)
        ...row.values.whereType<double>().where((v) => v.isFinite),
    ];
    final count = series.map((s) => s.values.length).reduce(math.max);
    final minimum = observed.fold<double>(0, math.min);
    final maximum = observed.fold<double>(0, math.max);
    // Chart bounds only. Exact source values are never rounded or rescaled.
    final minY = minimum < 0 ? (minimum * 1.3).floorToDouble() : 0.0;
    final maxY = math.max(1.0, (maximum * 1.3).ceilToDouble());
    final interval = discreteValues
        ? math.max(1.0, ((maxY - minY) / 4).ceilToDouble())
        : (maxY - minY) / 4;
    final primary = scheme.primary, comparison = scheme.onSurfaceVariant;
    final labelStyle = theme.textTheme.bodySmall!;
    final axis = axisValue ?? formatValue;
    final content = Padding(
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: LetbuyySpacingTokens.space8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ExcludeSemantics(child: Icon(icon, color: primary)),
              Text(title, style: theme.textTheme.titleMedium),
            ],
          ),
          if (header != null) ...[
            const SizedBox(height: LetbuyySpacingTokens.space8),
            header!,
          ],
          if (supportingText != null) ...[
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(supportingText!, style: theme.textTheme.bodyMedium),
          ],
          const SizedBox(height: LetbuyySpacingTokens.space16),
          if (count >= 2 && observed.isNotEmpty)
            LayoutBuilder(
              builder: (context, constraints) {
                final scale = MediaQuery.textScalerOf(context);
                double measure(String text) {
                  final painter = TextPainter(
                    text: TextSpan(text: text, style: labelStyle),
                    textDirection: Directionality.of(context),
                    textScaler: scale,
                  )..layout();
                  final width = painter.width;
                  painter.dispose();
                  return width;
                }

                final axisWidth =
                    [
                      for (var i = 0; i <= 4; i++)
                        measure(axis(minY + interval * i)),
                    ].reduce(math.max) +
                    16;
                final labelHeight =
                    scale.scale(labelStyle.fontSize ?? 12) * 2 + 16;
                final minimumPlot = math.max(
                  220.0,
                  measure(_date(current, 0)) * 3 + 24,
                );
                final width = math.max(
                  constraints.maxWidth,
                  axisWidth + minimumPlot,
                );
                final lines = <LineChartBarData>[];
                // Previous first, current last: the solid current series is visible.
                for (final row in [if (previous != null) previous!, current]) {
                  final old = identical(row, previous);
                  lines.add(
                    LineChartBarData(
                      spots: [
                        for (var i = 0; i < row.values.length; i++)
                          row.values[i] != null && row.values[i]!.isFinite
                              ? FlSpot(i.toDouble(), row.values[i]!)
                              : FlSpot.nullSpot,
                      ],
                      isCurved: false,
                      color: old ? comparison : primary,
                      dashArray: old ? const [6, 4] : null,
                      barWidth: old ? 2 : 3,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(show: false),
                    ),
                  );
                }
                final titleSeries = current.values.isNotEmpty
                    ? current
                    : previous!;
                return Semantics(
                  label:
                      '$title chart. Exact dated values are available in $valuesTitle below. Scroll horizontally to inspect the chart.',
                  child: ExcludeSemantics(
                    child: SingleChildScrollView(
                      key: PageStorageKey((
                        'recorded-chart-position',
                        valuesTitle,
                        current.label,
                      )),
                      scrollDirection: Axis.horizontal,
                      child: SizedBox(
                        width: width,
                        height: 240 + labelHeight,
                        child: LineChart(
                          LineChartData(
                            minX: 0,
                            maxX: (count - 1).toDouble(),
                            minY: minY,
                            maxY: maxY,
                            gridData: FlGridData(
                              drawVerticalLine: false,
                              horizontalInterval: interval,
                              getDrawingHorizontalLine: (_) => FlLine(
                                color: scheme.outlineVariant,
                                strokeWidth: 1,
                              ),
                            ),
                            borderData: FlBorderData(show: false),
                            titlesData: FlTitlesData(
                              rightTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false),
                              ),
                              topTitles: const AxisTitles(
                                sideTitles: SideTitles(showTitles: false),
                              ),
                              leftTitles: AxisTitles(
                                sideTitles: SideTitles(
                                  showTitles: true,
                                  reservedSize: axisWidth,
                                  interval: interval,
                                  getTitlesWidget: (value, _) => Padding(
                                    padding: const EdgeInsetsDirectional.only(
                                      end: 8,
                                    ),
                                    child: Text(axis(value), style: labelStyle),
                                  ),
                                ),
                              ),
                              bottomTitles: AxisTitles(
                                sideTitles: SideTitles(
                                  showTitles: true,
                                  reservedSize: labelHeight,
                                  interval: math
                                      .max(1, ((count - 1) / 2).ceil())
                                      .toDouble(),
                                  getTitlesWidget: (value, meta) {
                                    final index = value.round();
                                    if ((value - index).abs() > 0.001 ||
                                        index < 0 ||
                                        index >= titleSeries.values.length)
                                      return const SizedBox.shrink();
                                    return SideTitleWidget(
                                      axisSide: meta.axisSide,
                                      child: Text(
                                        _date(
                                          titleSeries,
                                          index,
                                        ).replaceFirst(RegExp(r' \d{4}$'), ''),
                                        style: labelStyle,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                            lineBarsData: lines,
                            lineTouchData: LineTouchData(
                              touchTooltipData: LineTouchTooltipData(
                                getTooltipColor: (_) => scheme.inverseSurface,
                                fitInsideHorizontally: true,
                                fitInsideVertically: true,
                                getTooltipItems: (spots) => spots.map((spot) {
                                  final row =
                                      previous != null && spot.barIndex == 0
                                      ? previous!
                                      : current;
                                  return LineTooltipItem(
                                    formatValue(spot.y),
                                    TextStyle(
                                      color: scheme.onInverseSurface,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    children: [
                                      TextSpan(
                                        text:
                                            '\n${row.label}\n${_date(row, spot.spotIndex)}',
                                        style: TextStyle(
                                          color: scheme.onInverseSurface,
                                          fontWeight: FontWeight.normal,
                                        ),
                                      ),
                                    ],
                                  );
                                }).toList(),
                              ),
                            ),
                          ),
                          duration: Duration.zero,
                        ),
                      ),
                    ),
                  ),
                );
              },
            )
          else
            Text(
              count == 0
                  ? '$title history unavailable'
                  : 'Recorded values are available below.',
            ),
          if (observed.isNotEmpty) ...[
            const SizedBox(height: LetbuyySpacingTokens.space12),
            for (final row in series)
              Padding(
                padding: const EdgeInsets.only(
                  bottom: LetbuyySpacingTokens.space8,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 4, right: 8),
                      child: Icon(
                        identical(row, previous)
                            ? Icons.linear_scale_rounded
                            : Icons.show_chart_rounded,
                        color: identical(row, previous) ? comparison : primary,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        '${row.label}${identical(row, previous) ? ' · dashed line' : ' · solid line'}',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
          ],
          if (count > 0)
            ExpansionTile(
              key: PageStorageKey((
                'recorded-values',
                valuesTitle,
                current.label,
              )),
              tilePadding: EdgeInsets.zero,
              expansionAnimationStyle: MediaQuery.disableAnimationsOf(context)
                  ? AnimationStyle.noAnimation
                  : null,
              title: Text(valuesTitle),
              children: [
                for (final row in series) ...[
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(row.label, style: theme.textTheme.titleSmall),
                  ),
                  for (var i = 0; i < row.values.length; i++)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: LetbuyySpacingTokens.space8,
                      ),
                      child: Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        spacing: LetbuyySpacingTokens.space16,
                        runSpacing: LetbuyySpacingTokens.space4,
                        children: [
                          Text(_date(row, i)),
                          Text(
                            row.values[i] != null && row.values[i]!.isFinite
                                ? formatValue(row.values[i]!)
                                : 'Unavailable',
                          ),
                        ],
                      ),
                    ),
                ],
              ],
            ),
        ],
      ),
    );
    return LayoutBuilder(
      builder: (context, constraints) => Card(
        margin: EdgeInsets.zero,
        child: constraints.hasBoundedHeight
            ? SingleChildScrollView(
                key: PageStorageKey((
                  'recorded-chart-viewport',
                  valuesTitle,
                  current.label,
                )),
                primary: false,
                child: content,
              )
            : content,
      ),
    );
  }
}
