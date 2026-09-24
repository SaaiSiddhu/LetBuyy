// lib/screens/wallet/widgets/earnings_chart.dart
// 📈 EARNINGS CHART - Visual earnings over time
// ✨ Professional fintech design

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class EarningsChart extends StatefulWidget {
  final List<EarningDataPoint> data;
  final bool isLoading;

  const EarningsChart({
    super.key,
    required this.data,
    this.isLoading = false,
  });

  @override
  State<EarningsChart> createState() => _EarningsChartState();
}

class _EarningsChartState extends State<EarningsChart> {
  String _selectedPeriod = '7d';
  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.8) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.trending_up_rounded, color: const Color(0xFF10B981), size: 20),
              const SizedBox(width: 10),
              Text(
                'Earnings Trend',
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              _buildPeriodSelector(isDark),
            ],
          ),
          const SizedBox(height: 16),
          
          // Stats Summary
          Row(
            children: [
              _buildStatChip('Total', _calculateTotal(), const Color(0xFF10B981), isDark),
              const SizedBox(width: 10),
              _buildStatChip('Avg/Day', _calculateAverage(), const Color(0xFF3B82F6), isDark),
            ],
          ),
          const SizedBox(height: 16),
          
          // Chart
          SizedBox(
            height: 180,
            child: widget.isLoading
                ? Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
                : widget.data.isEmpty
                    ? _buildEmptyState(isDark)
                    : _buildChart(isDark),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 300.ms);
  }

  Widget _buildPeriodSelector(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: ['7d', '30d', '90d'].map((period) {
          final isSelected = _selectedPeriod == period;
          return GestureDetector(
            onTap: () => setState(() => _selectedPeriod = period),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFF10B981) : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                period,
                style: TextStyle(
                  color: isSelected ? Colors.white : (isDark ? Colors.grey[400] : Colors.grey[600]),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildStatChip(String label, double value, Color color, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(color: Colors.grey[500], fontSize: 10)),
                Text(
                  '₹${_compactFormat(value)}',
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChart(bool isDark) {
    final spots = widget.data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value.amount)).toList();
    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    final adjustedMaxY = maxY <= 0 ? 100.0 : maxY * 1.15;

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: adjustedMaxY / 4,
          getDrawingHorizontalLine: (value) => FlLine(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) => Text(
                _formatAxisValue(value),
                style: TextStyle(color: Colors.grey[500], fontSize: 10),
              ),
            ),
          ),
          bottomTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.3,
            color: const Color(0xFF10B981),
            barWidth: 3,
            isStrokeCapRound: true,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [const Color(0xFF10B981).withValues(alpha: 0.2), const Color(0xFF10B981).withValues(alpha: 0.0)],
              ),
            ),
          ),
        ],
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => isDark ? const Color(0xFF334155) : Colors.white,
            tooltipRoundedRadius: 8,
            getTooltipItems: (spots) => spots.map((spot) {
              return LineTooltipItem(
                '₹${_currencyFormat.format(spot.y)}',
                const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 12),
              );
            }).toList(),
          ),
        ),
        minY: 0,
        maxY: adjustedMaxY,
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.show_chart_rounded, size: 32, color: Colors.grey[400]),
          const SizedBox(height: 8),
          Text('No earnings data', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
        ],
      ),
    );
  }

  double _calculateTotal() {
    if (widget.data.isEmpty) return 0;
    return widget.data.fold(0.0, (sum, e) => sum + e.amount);
  }

  double _calculateAverage() {
    if (widget.data.isEmpty) return 0;
    return _calculateTotal() / widget.data.length;
  }

  String _formatAxisValue(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(0)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(0)}k';
    return value.toStringAsFixed(0);
  }

  String _compactFormat(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}

class EarningDataPoint {
  final DateTime date;
  final double amount;

  const EarningDataPoint({required this.date, required this.amount});
}
