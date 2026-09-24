// ============================================================
// HOURLY TREND CHART WIDGET
// Shows today's hourly performance as a sparkline
// ============================================================

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Hourly Trend Chart - Today's performance by hour
class HourlyTrendChart extends StatelessWidget {
  final List<Map<String, dynamic>> dailyData;
  final Map<String, dynamic>? realtimeData;
  final String selectedMetric;

  const HourlyTrendChart({
    super.key,
    required this.dailyData,
    this.realtimeData,
    required this.selectedMetric,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hourlyData = _getHourlyData();
    final currentHour = DateTime.now().hour;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Row(
          children: [
            Icon(
              Icons.trending_up,
              size: 18,
              color: AppColors.primary,
            ),
            const SizedBox(width: 8),
            Text(
              "Today's Hourly Trend",
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const Spacer(),
            // Current time indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'Now: ${currentHour.toString().padLeft(2, '0')}:00',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 16),
        
        // Chart
        SizedBox(
          height: 100,
          child: hourlyData.isEmpty || hourlyData.every((v) => v == 0)
              ? _buildEmptyChart(isDark)
              : _buildChart(context, hourlyData, currentHour, isDark),
        ),
        
        // X-axis labels
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('12AM', style: _labelStyle(isDark)),
            Text('6AM', style: _labelStyle(isDark)),
            Text('12PM', style: _labelStyle(isDark)),
            Text('6PM', style: _labelStyle(isDark)),
            Text('12AM', style: _labelStyle(isDark)),
          ],
        ),
      ],
    );
  }

  TextStyle _labelStyle(bool isDark) {
    return TextStyle(
      fontSize: 10,
      color: isDark ? Colors.white60 : Colors.grey.shade600,
    );
  }

  Widget _buildEmptyChart(bool isDark) {
    return Center(
      child: Text(
        'No data for today yet',
        style: TextStyle(
          fontSize: 12,
          color: isDark ? Colors.white38 : Colors.grey.shade400,
        ),
      ),
    );
  }

  Widget _buildChart(BuildContext context, List<double> data, int currentHour, bool isDark) {
    final maxY = data.reduce((a, b) => a > b ? a : b);
    final spots = List.generate(24, (i) => FlSpot(i.toDouble(), data[i]));

    return LineChart(
      LineChartData(
        gridData: FlGridData(show: false),
        titlesData: FlTitlesData(show: false),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: 23,
        minY: 0,
        maxY: maxY > 0 ? maxY * 1.1 : 10,
        lineTouchData: LineTouchData(
          enabled: true,
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (spots) => spots.map((spot) {
              final hour = spot.x.toInt();
              return LineTooltipItem(
                '${hour.toString().padLeft(2, '0')}:00\n${_formatValue(spot.y)}',
                TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              );
            }).toList(),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: AppColors.primary,
            barWidth: 2.5,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, bar, index) {
                if (index == currentHour) {
                  // Highlight current hour
                  return FlDotCirclePainter(
                    radius: 5,
                    color: AppColors.primary,
                    strokeWidth: 2,
                    strokeColor: Colors.white,
                  );
                }
                return FlDotCirclePainter(
                  radius: 0,
                  color: Colors.transparent,
                  strokeWidth: 0,
                  strokeColor: Colors.transparent,
                );
              },
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.3),
                  AppColors.primary.withValues(alpha: 0.05),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
        extraLinesData: ExtraLinesData(
          verticalLines: [
            // Current hour indicator line
            VerticalLine(
              x: currentHour.toDouble(),
              color: AppColors.primary.withValues(alpha: 0.5),
              strokeWidth: 1,
              dashArray: [4, 4],
            ),
          ],
        ),
      ),
    );
  }

  List<double> _getHourlyData() {
    // Initialize with zeros for all 24 hours
    final hourlyData = List.filled(24, 0.0);
    
    // Try to get today's data from dailyData
    final today = DateTime.now();
    final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    
    for (final day in dailyData) {
      if (day['date'] == todayStr) {
        final breakdown = day['hourlyBreakdown'] as List<dynamic>?;
        if (breakdown != null) {
          for (int i = 0; i < breakdown.length && i < 24; i++) {
            hourlyData[i] = (breakdown[i] as num?)?.toDouble() ?? 0;
          }
        }
        break;
      }
    }
    
    // If realtime data has today's values, use those
    if (realtimeData != null) {
      final todayViews = (realtimeData!['todayViews'] as num?)?.toDouble() ?? 0;
      if (todayViews > 0 && hourlyData.every((v) => v == 0)) {
        // Distribute realtime values (rough approximation)
        final currentHour = DateTime.now().hour;
        hourlyData[currentHour] = todayViews;
      }
    }
    
    return hourlyData;
  }

  String _formatValue(double value) {
    if (selectedMetric == 'revenue') {
      return '₹${value.toStringAsFixed(0)}';
    }
    return value.toStringAsFixed(0);
  }
}
