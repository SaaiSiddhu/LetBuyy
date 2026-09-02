// lib/screens/admin/analytics/widgets/comparison_widget.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import '../analytics_screen.dart';
import 'analytics_card.dart';

class ComparisonWidget extends StatelessWidget {
  final TimeSeriesResult currentData;
  final ComparisonMode comparisonMode;
  final bool isDark;

  const ComparisonWidget({
    super.key,
    required this.currentData,
    required this.comparisonMode,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final metrics = _calculateComparison();

    return AnalyticsCard(
      title: 'Period Comparison',
      icon: Icons.compare_arrows_rounded,
      color: accentColor,
      isDark: isDark,
      child: Column(
        children: [
          _buildComparisonHeader(metrics, accentColor),
          const SizedBox(height: 24),
          _buildMetricsGrid(metrics, accentColor),
        ],
      ),
    );
  }

  Widget _buildComparisonHeader(
    ComparisonMetrics metrics,
    Color accentColor,
  ) {
    final isPositive = metrics.totalChange >= 0;
    final changeColor = isPositive ? AppColors.success : AppColors.error;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            changeColor.withValues(alpha: 0.15),
            changeColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: changeColor.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  changeColor,
                  changeColor.withValues(alpha: 0.7),
                ],
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: changeColor.withValues(alpha: 0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              isPositive ? Icons.trending_up_rounded : Icons.trending_down_rounded,
              color: Colors.white,
              size: 32,
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Overall Change',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(
                      '${isPositive ? '+' : ''}${metrics.totalChange.toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: changeColor,
                        height: 1,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      isPositive
                          ? Icons.arrow_upward_rounded
                          : Icons.arrow_downward_rounded,
                      color: changeColor,
                      size: 24,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'vs ${_getComparisonLabel()}',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 500.ms).slideY(begin: 0.2);
  }

  Widget _buildMetricsGrid(ComparisonMetrics metrics, Color accentColor) {
    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _buildMetricCard(
          'Total Revenue',
          NumberFormat.currency(symbol: '₹', decimalDigits: 0)
              .format(metrics.currentTotal),
          NumberFormat.currency(symbol: '₹', decimalDigits: 0)
              .format(metrics.previousTotal),
          metrics.totalChange,
          Icons.account_balance_wallet_rounded,
          AppColors.success,
        ),
        _buildMetricCard(
          'Daily Average',
          NumberFormat.currency(symbol: '₹', decimalDigits: 0)
              .format(metrics.currentAverage),
          NumberFormat.currency(symbol: '₹', decimalDigits: 0)
              .format(metrics.previousAverage),
          metrics.averageChange,
          Icons.calendar_today_rounded,
          AppColors.info,
        ),
        _buildMetricCard(
          'Peak Value',
          NumberFormat.currency(symbol: '₹', decimalDigits: 0)
              .format(metrics.currentMax),
          NumberFormat.currency(symbol: '₹', decimalDigits: 0)
              .format(metrics.previousMax),
          metrics.maxChange,
          Icons.star_rounded,
          AppColors.warning,
        ),
        _buildMetricCard(
          'Growth Rate',
          '${metrics.totalChange.toStringAsFixed(1)}%',
          'Baseline',
          metrics.totalChange,
          Icons.trending_up_rounded,
          metrics.totalChange >= 0 ? AppColors.success : AppColors.error,
        ),
      ],
    );
  }

  Widget _buildMetricCard(
    String label,
    String currentValue,
    String previousValue,
    double change,
    IconData icon,
    Color color,
  ) {
    final isPositive = change >= 0;
    final changeColor = isPositive ? AppColors.success : AppColors.error;

    return Container(
      width: 280,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.12),
            color.withValues(alpha: 0.04),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.4),
          width: 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      color,
                      color.withValues(alpha: 0.7),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: Colors.white,
                  size: 20,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: changeColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: changeColor.withValues(alpha: 0.5),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPositive
                          ? Icons.arrow_upward_rounded
                          : Icons.arrow_downward_rounded,
                      size: 14,
                      color: changeColor,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${change.abs().toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: changeColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            currentValue,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Previous: $previousValue',
            style: TextStyle(
              fontSize: 11,
              color: isDark ? AppColors.textLightHint : AppColors.textHint,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms, delay: 100.ms)
        .slideX(begin: 0.1);
  }

  ComparisonMetrics _calculateComparison() {
    // Simulate previous period data (in real app, fetch from provider)
    final previousTotal = currentData.total * 0.85; // 15% lower baseline
    final previousAverage = currentData.average * 0.85;
    final previousMax = currentData.maxY * 0.90;

    final totalChange = previousTotal > 0
        ? ((currentData.total - previousTotal) / previousTotal) * 100
        : 0.0;

    final averageChange = previousAverage > 0
        ? ((currentData.average - previousAverage) / previousAverage) * 100
        : 0.0;

    final maxChange = previousMax > 0
        ? ((currentData.maxY - previousMax) / previousMax) * 100
        : 0.0;

    return ComparisonMetrics(
      currentTotal: currentData.total,
      previousTotal: previousTotal,
      totalChange: totalChange,
      currentAverage: currentData.average,
      previousAverage: previousAverage,
      averageChange: averageChange,
      currentMax: currentData.maxY,
      previousMax: previousMax,
      maxChange: maxChange,
    );
  }

  String _getComparisonLabel() {
    switch (comparisonMode) {
      case ComparisonMode.previous:
        return 'previous period';
      case ComparisonMode.yearAgo:
        return 'last year';
      default:
        return '';
    }
  }
}

class ComparisonMetrics {
  final double currentTotal;
  final double previousTotal;
  final double totalChange;
  final double currentAverage;
  final double previousAverage;
  final double averageChange;
  final double currentMax;
  final double previousMax;
  final double maxChange;

  ComparisonMetrics({
    required this.currentTotal,
    required this.previousTotal,
    required this.totalChange,
    required this.currentAverage,
    required this.previousAverage,
    required this.averageChange,
    required this.currentMax,
    required this.previousMax,
    required this.maxChange,
  });
}
