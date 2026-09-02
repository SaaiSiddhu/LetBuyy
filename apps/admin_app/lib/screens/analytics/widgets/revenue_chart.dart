// lib/screens/admin/analytics/widgets/revenue_chart.dart

import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../analytics_screen.dart';
import 'analytics_card.dart';

class RevenueChart extends StatefulWidget {
  final TimeSeriesResult timeSeries;
  final RangeKey selectedRange;
  final ComparisonMode comparisonMode;
  final bool isDark;
  final double height;
  final bool showPrediction;

  const RevenueChart({
    super.key,
    required this.timeSeries,
    required this.selectedRange,
    required this.comparisonMode,
    required this.isDark,
    this.height = 350,
    this.showPrediction = false,
  });

  @override
  State<RevenueChart> createState() => _RevenueChartState();
}

class _RevenueChartState extends State<RevenueChart>
    with TickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  int? touchedIndex;
  bool showAverage = true;
  bool showPrediction = true;
  bool showTarget = false;
  String chartType = 'area'; // 'line', 'area', 'gradient'

  late AnimationController _animController;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..forward();

    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  bool get isMobile => MediaQuery.of(context).size.width < 600;
  bool get isTablet =>
      MediaQuery.of(context).size.width >= 600 &&
      MediaQuery.of(context).size.width < 1200;
  bool get isDesktop => MediaQuery.of(context).size.width >= 1200;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    
    final accentColor =
        widget.isDark ? AppColors.primaryLight : AppColors.primary;
    final cf = NumberFormat.compactCurrency(
      symbol: '₹',
      locale: 'en_IN',
      decimalDigits: 0,
    );

    final spots =
        widget.timeSeries.spots.isEmpty ? [FlSpot(0, 0)] : widget.timeSeries.spots;

    double suggestedMax = (widget.timeSeries.maxY * 1.25).ceilToDouble();
    if (suggestedMax == 0) suggestedMax = 100;

    return AnalyticsCard(
      title: 'Revenue Analytics',
      icon: Icons.trending_up_rounded,
      color: accentColor,
      isDark: widget.isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Premium KPI Cards
          _buildPremiumKPIs(cf, accentColor),
          SizedBox(height: isDesktop ? 28 : 24),

          // Advanced Controls
          if (isDesktop) ...[
            _buildAdvancedControls(accentColor),
            const SizedBox(height: 24),
          ],

          // Main Chart with Annotations
          SizedBox(
            height: widget.height,
            child: _buildAdvancedChart(spots, accentColor, suggestedMax, cf),
          ),

          SizedBox(height: isDesktop ? 24 : 20),

          // Interactive Legend & Insights
          _buildInteractiveLegendAndInsights(cf, accentColor),

          // Statistical Summary
          if (isDesktop) ...[
            const SizedBox(height: 24),
            _buildStatisticalSummary(cf, accentColor),
          ],
        ],
      ),
    );
  }

  // PREMIUM KPI CARDS WITH SPARKLINES
  Widget _buildPremiumKPIs(NumberFormat cf, Color accentColor) {
    final metrics = _calculateAdvancedMetrics();

    if (isMobile) {
      return Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildKPICard(
                  'Total Revenue',
                  cf.format(widget.timeSeries.total),
                  Icons.account_balance_wallet_rounded,
                  AppColors.success,
                  metrics['revenueTrend']!,
                  _generateMiniSparkline(widget.timeSeries.spots),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKPICard(
                  'Daily Avg',
                  cf.format(widget.timeSeries.average),
                  Icons.calendar_today_rounded,
                  AppColors.info,
                  metrics['avgTrend']!,
                  null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildKPICard(
                  'Peak Revenue',
                  _getPeakValue(cf),
                  Icons.star_rounded,
                  AppColors.warning,
                  0.0,
                  null,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKPICard(
                  'Growth',
                  '${metrics['growthRate']!.toStringAsFixed(1)}%',
                  metrics['growthRate']! >= 0
                      ? Icons.trending_up
                      : Icons.trending_down,
                  metrics['growthRate']! >= 0
                      ? AppColors.success
                      : AppColors.error,
                  metrics['growthRate']!,
                  null,
                ),
              ),
            ],
          ),
        ],
      );
    }

    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _buildKPICard(
          'Total Revenue',
          cf.format(widget.timeSeries.total),
          Icons.account_balance_wallet_rounded,
          AppColors.success,
          metrics['revenueTrend']!,
          _generateMiniSparkline(widget.timeSeries.spots),
        ),
        _buildKPICard(
          'Daily Average',
          cf.format(widget.timeSeries.average),
          Icons.calendar_today_rounded,
          AppColors.info,
          metrics['avgTrend']!,
          null,
        ),
        _buildKPICard(
          'Peak Revenue',
          _getPeakValue(cf),
          Icons.star_rounded,
          AppColors.warning,
          0.0,
          null,
        ),
        _buildKPICard(
          'Growth Rate',
          '${metrics['growthRate']!.toStringAsFixed(1)}%',
          metrics['growthRate']! >= 0 ? Icons.trending_up : Icons.trending_down,
          metrics['growthRate']! >= 0 ? AppColors.success : AppColors.error,
          metrics['growthRate']!,
          null,
        ),
      ],
    );
  }

  Widget _buildKPICard(
    String label,
    String value,
    IconData icon,
    Color color,
    double trend,
    List<FlSpot>? sparkline,
  ) {
    final width = isMobile ? double.infinity : 230.0;

    return Container(
      width: width,
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
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.15),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      color,
                      color.withValues(alpha: 0.7),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(
                  icon,
                  color: Colors.white,
                  size: 24,
                ),
              ),
              if (trend != 0)
                AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, child) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: (trend >= 0 ? AppColors.success : AppColors.error)
                            .withValues(alpha: 0.2 + _pulseController.value * 0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: (trend >= 0
                                  ? AppColors.success
                                  : AppColors.error)
                              .withValues(alpha: 0.5),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            trend >= 0
                                ? Icons.arrow_upward
                                : Icons.arrow_downward,
                            size: 16,
                            color: trend >= 0
                                ? AppColors.success
                                : AppColors.error,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${trend.abs().toStringAsFixed(1)}%',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: trend >= 0
                                  ? AppColors.success
                                  : AppColors.error,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: widget.isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: color,
                    height: 1.1,
                  ),
                ),
              ),
              if (sparkline != null && sparkline.isNotEmpty)
                SizedBox(
                  width: 60,
                  height: 30,
                  child: _buildMiniSparkline(sparkline, color),
                ),
            ],
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 500.ms, delay: 100.ms)
        .scale(begin: const Offset(0.9, 0.9), curve: Curves.easeOutBack);
  }

  Widget _buildMiniSparkline(List<FlSpot> spots, Color color) {
    if (spots.isEmpty) return const SizedBox.shrink();

    return LineChart(
      LineChartData(
        minY: spots.map((s) => s.y).reduce((a, b) => a < b ? a : b),
        maxY: spots.map((s) => s.y).reduce((a, b) => a > b ? a : b),
        gridData: const FlGridData(show: false),
        titlesData: const FlTitlesData(show: false),
        borderData: FlBorderData(show: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.4,
            barWidth: 2,
            color: color.withValues(alpha: 0.8),
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  color.withValues(alpha: 0.3),
                  color.withValues(alpha: 0.0),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
        lineTouchData: const LineTouchData(enabled: false),
      ),
    );
  }

  // ADVANCED CONTROLS
  Widget _buildAdvancedControls(Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: (widget.isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surface)
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: widget.isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          // Chart Type Selector
          Text(
            'Style:',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: widget.isDark
                  ? AppColors.textLight
                  : AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: 16),
          _buildStyleButton('line', Icons.show_chart, 'Line', accentColor),
          const SizedBox(width: 10),
          _buildStyleButton(
              'area', Icons.area_chart_rounded, 'Area', accentColor),
          const SizedBox(width: 10),
          _buildStyleButton(
              'gradient', Icons.gradient_rounded, 'Gradient', accentColor),
          const Spacer(),
          // Toggles
          _buildCompactToggle(
            'Avg',
            showAverage,
            (v) => setState(() => showAverage = v),
            accentColor,
          ),
          const SizedBox(width: 12),
          if (widget.showPrediction)
            _buildCompactToggle(
              'Forecast',
              showPrediction,
              (v) => setState(() => showPrediction = v),
              accentColor,
            ),
          const SizedBox(width: 12),
          _buildCompactToggle(
            'Target',
            showTarget,
            (v) => setState(() => showTarget = v),
            accentColor,
          ),
        ],
      ),
    );
  }

  Widget _buildStyleButton(
    String type,
    IconData icon,
    String label,
    Color accentColor,
  ) {
    final isSelected = chartType == type;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (mounted) {
            setState(() {
              chartType = type;
            });
          }
        },
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOutCubic,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            gradient: isSelected
                ? LinearGradient(
                    colors: [
                      accentColor.withValues(alpha: 0.2),
                      accentColor.withValues(alpha: 0.1),
                    ],
                  )
                : null,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? accentColor.withValues(alpha: 0.6)
                  : (widget.isDark ? AppColors.borderDark : AppColors.border)
                      .withValues(alpha: 0.3),
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: isSelected
                    ? accentColor
                    : widget.isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected
                      ? accentColor
                      : widget.isDark
                          ? AppColors.textLight
                          : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCompactToggle(
    String label,
    bool value,
    ValueChanged<bool> onChanged,
    Color color,
  ) {
    return InkWell(
      onTap: () {
        if (mounted) {
          onChanged(!value);
        }
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: value ? color.withValues(alpha: 0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: value
                ? color.withValues(alpha: 0.5)
                : (widget.isDark ? AppColors.borderDark : AppColors.border)
                    .withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              value ? Icons.check_circle_rounded : Icons.circle_outlined,
              size: 16,
              color: value
                  ? color
                  : widget.isDark
                      ? AppColors.textLightSecondary
                      : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: value ? FontWeight.w700 : FontWeight.w600,
                color: value
                    ? color
                    : widget.isDark
                        ? AppColors.textLight
                        : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ADVANCED CHART WITH ANNOTATIONS - FIXED MOUSE TRACKING
  Widget _buildAdvancedChart(
    List<FlSpot> spots,
    Color accentColor,
    double maxY,
    NumberFormat cf,
  ) {
    return AnimatedBuilder(
      animation: _animController,
      builder: (context, child) {
        return LineChart(
          LineChartData(
            minY: 0,
            maxY: maxY,
            gridData: _buildEnhancedGridData(),
            titlesData: _buildEnhancedTitlesData(cf),
            borderData: _buildEnhancedBorderData(),
            lineBarsData: [
              _buildEnhancedMainLine(spots, accentColor),
              if (widget.showPrediction && showPrediction)
                _buildEnhancedPredictionLine(spots, accentColor),
            ],
            lineTouchData: _buildEnhancedTouchData(cf, accentColor),
            extraLinesData: _buildEnhancedExtraLines(maxY),
          ),
          duration: const Duration(milliseconds: 250),
        );
      },
    );
  }

  FlGridData _buildEnhancedGridData() {
    return FlGridData(
      show: true,
      drawVerticalLine: true,
      horizontalInterval:
          widget.timeSeries.maxY > 0 ? widget.timeSeries.maxY / 6 : null,
      verticalInterval: widget.timeSeries.spots.length > 10
          ? widget.timeSeries.spots.length / 10
          : null,
      getDrawingHorizontalLine: (value) => FlLine(
        color: (widget.isDark ? AppColors.borderDark : AppColors.border)
            .withValues(alpha: 0.25),
        strokeWidth: 1.5,
        dashArray: [6, 4],
      ),
      getDrawingVerticalLine: (value) => FlLine(
        color: (widget.isDark ? AppColors.borderDark : AppColors.border)
            .withValues(alpha: 0.12),
        strokeWidth: 1,
        dashArray: [4, 4],
      ),
    );
  }

  FlTitlesData _buildEnhancedTitlesData(NumberFormat cf) {
    final labelStep = _getXAxisLabelStep();

    return FlTitlesData(
      leftTitles: AxisTitles(
        sideTitles: SideTitles(
          showTitles: true,
          reservedSize: 75,
          interval:
              widget.timeSeries.maxY > 0 ? widget.timeSeries.maxY / 6 : null,
          getTitlesWidget: (value, meta) {
            if (value == 0 || value == meta.max) {
              return const SizedBox.shrink();
            }

            return Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Text(
                cf.format(value),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: widget.isDark
                      ? AppColors.textLightHint
                      : AppColors.textHint,
                ),
                textAlign: TextAlign.right,
              ),
            );
          },
        ),
      ),
      bottomTitles: AxisTitles(
        sideTitles: SideTitles(
          showTitles: true,
          reservedSize: 44,
          interval: labelStep.toDouble(),
          getTitlesWidget: (value, meta) {
            final ix = value.toInt();
            if (ix < 0 ||
                ix >= widget.timeSeries.labels.length ||
                ix % labelStep != 0) {
              return const SizedBox.shrink();
            }

            final label = _formatXAxisLabel(widget.timeSeries.labels[ix]);
            final isToday = _isToday(widget.timeSeries.labels[ix]);

            return Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Container(
                padding: isToday
                    ? const EdgeInsets.symmetric(horizontal: 8, vertical: 4)
                    : null,
                decoration: isToday
                    ? BoxDecoration(
                        color: (widget.isDark
                                ? AppColors.primaryLight
                                : AppColors.primary)
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      )
                    : null,
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                    color: isToday
                        ? (widget.isDark
                            ? AppColors.primaryLight
                            : AppColors.primary)
                        : (widget.isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint),
                  ),
                ),
              ),
            );
          },
        ),
      ),
      topTitles: const AxisTitles(
        sideTitles: SideTitles(showTitles: false),
      ),
      rightTitles: const AxisTitles(
        sideTitles: SideTitles(showTitles: false),
      ),
    );
  }

  FlBorderData _buildEnhancedBorderData() {
    return FlBorderData(
      show: true,
      border: Border(
        left: BorderSide(
          color: (widget.isDark ? AppColors.borderDark : AppColors.border)
              .withValues(alpha: 0.6),
          width: 2.5,
        ),
        bottom: BorderSide(
          color: (widget.isDark ? AppColors.borderDark : AppColors.border)
              .withValues(alpha: 0.6),
          width: 2.5,
        ),
      ),
    );
  }

  LineChartBarData _buildEnhancedMainLine(
    List<FlSpot> spots,
    Color accentColor,
  ) {
    final animatedSpots = spots.asMap().entries.map((entry) {
      final progress = _animController.value * spots.length;
      final spotProgress = (progress - entry.key).clamp(0.0, 1.0);
      return FlSpot(entry.value.x, entry.value.y * spotProgress);
    }).toList();

    return LineChartBarData(
      spots: animatedSpots,
      isCurved: chartType != 'line',
      curveSmoothness: 0.4,
      barWidth: 4,
      isStrokeCapRound: true,
      gradient: chartType == 'gradient'
          ? LinearGradient(
              colors: [
                accentColor,
                accentColor.withValues(alpha: 0.6),
                AppColors.info,
              ],
            )
          : LinearGradient(
              colors: [
                accentColor,
                accentColor.withValues(alpha: 0.8),
              ],
            ),
      dotData: FlDotData(
        show: widget.selectedRange.days <= 30,
        getDotPainter: (spot, percent, barData, index) {
          final isHighlighted = index == touchedIndex;
          final isPeak = spot.y >= widget.timeSeries.maxY;

          return FlDotCirclePainter(
            radius: isHighlighted ? 8 : (isPeak ? 6 : 4),
            color: isPeak ? AppColors.warning : accentColor,
            strokeWidth: isHighlighted ? 4 : (isPeak ? 3 : 2),
            strokeColor:
                widget.isDark ? AppColors.surfaceDark : AppColors.surface,
          );
        },
      ),
      belowBarData: BarAreaData(
        show: chartType == 'area' || chartType == 'gradient',
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.35),
            accentColor.withValues(alpha: 0.15),
            accentColor.withValues(alpha: 0.02),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
    );
  }

  LineChartBarData _buildEnhancedPredictionLine(
    List<FlSpot> spots,
    Color accentColor,
  ) {
    if (spots.length < 3) {
      return LineChartBarData(spots: []);
    }

    final lastN = spots.length > 7 ? 7 : spots.length;
    final recentSpots = spots.sublist(spots.length - lastN);
    final avgSlope = _calculateAverageSlope(recentSpots);
    final volatility = _calculateVolatility(recentSpots);

    final lastPoint = spots.last;
    final predictionDays = 7;

    final predictionSpots = List.generate(predictionDays, (i) {
      final x = lastPoint.x + i + 1;
      final y = (lastPoint.y + avgSlope * (i + 1) + volatility * i * 0.5)
          .clamp(0.0, widget.timeSeries.maxY * 2);
      return FlSpot(x, y.toDouble());
    });

    return LineChartBarData(
      spots: [lastPoint, ...predictionSpots],
      isCurved: true,
      curveSmoothness: 0.4,
      barWidth: 3,
      isStrokeCapRound: true,
      color: accentColor.withValues(alpha: 0.6),
      dashArray: [10, 5],
      dotData: FlDotData(
        show: true,
        getDotPainter: (spot, percent, barData, index) {
          return FlDotCirclePainter(
            radius: 4,
            color: accentColor.withValues(alpha: 0.6),
            strokeWidth: 2,
            strokeColor:
                widget.isDark ? AppColors.surfaceDark : AppColors.surface,
          );
        },
      ),
      belowBarData: BarAreaData(
        show: true,
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.15),
            accentColor.withValues(alpha: 0.03),
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
    );
  }

  // FIXED: Proper touch handling to prevent mouse tracker errors
  LineTouchData _buildEnhancedTouchData(NumberFormat cf, Color accentColor) {
    return LineTouchData(
      enabled: true,
      handleBuiltInTouches: true,
      touchCallback: (event, response) {
        if (!mounted) return;
        
        setState(() {
          if (response?.lineBarSpots != null &&
              response!.lineBarSpots!.isNotEmpty) {
            touchedIndex = response.lineBarSpots!.first.spotIndex;
          } else {
            touchedIndex = null;
          }
        });
      },
      touchTooltipData: LineTouchTooltipData(
        getTooltipColor: (_) =>
            widget.isDark ? AppColors.surfaceDarkContainer : AppColors.surface,
        tooltipRoundedRadius: 14,
        tooltipPadding: const EdgeInsets.all(16),
        tooltipMargin: 14,
        tooltipBorder: BorderSide(
          color: accentColor.withValues(alpha: 0.5),
          width: 2,
        ),
        getTooltipItems: (spots) {
          return spots.map((spot) {
            final idx = spot.x.toInt();
            final iso = idx >= 0 && idx < widget.timeSeries.labels.length
                ? widget.timeSeries.labels[idx]
                : '';

            final dateLabel = iso.isNotEmpty
                ? DateFormat('EEEE, d MMM yyyy').format(DateTime.parse(iso))
                : 'Unknown';

            final percentOfMax =
                ((spot.y / widget.timeSeries.maxY) * 100).toStringAsFixed(1);

            return LineTooltipItem(
              '$dateLabel\n',
              TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: widget.isDark
                    ? AppColors.textLight
                    : AppColors.textPrimary,
              ),
              children: [
                TextSpan(
                  text: '${cf.format(spot.y)}\n',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: accentColor,
                    height: 1.5,
                  ),
                ),
                TextSpan(
                  text: '$percentOfMax% of peak',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: widget.isDark
                        ? AppColors.textLightHint
                        : AppColors.textHint,
                  ),
                ),
              ],
            );
          }).toList();
        },
      ),
    );
  }

  ExtraLinesData _buildEnhancedExtraLines(double maxY) {
    final lines = <HorizontalLine>[];

    if (showAverage) {
      lines.add(
        HorizontalLine(
          y: widget.timeSeries.average,
          color: AppColors.info.withValues(alpha: 0.7),
          strokeWidth: 2,
          dashArray: [8, 4],
          label: HorizontalLineLabel(
            show: true,
            alignment: Alignment.topRight,
            padding: const EdgeInsets.only(right: 8, bottom: 4),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.info,
              backgroundColor: (widget.isDark
                      ? AppColors.surfaceDark
                      : AppColors.surface)
                  .withValues(alpha: 0.9),
            ),
            labelResolver: (line) => ' Avg: ₹${line.y.toStringAsFixed(0)} ',
          ),
        ),
      );
    }

    if (showTarget) {
      final targetValue = widget.timeSeries.average * 1.5;
      lines.add(
        HorizontalLine(
          y: targetValue,
          color: AppColors.warning.withValues(alpha: 0.7),
          strokeWidth: 2,
          dashArray: [12, 6],
          label: HorizontalLineLabel(
            show: true,
            alignment: Alignment.topRight,
            padding: const EdgeInsets.only(right: 8, bottom: 4),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.warning,
              backgroundColor: (widget.isDark
                      ? AppColors.surfaceDark
                      : AppColors.surface)
                  .withValues(alpha: 0.9),
            ),
            labelResolver: (line) => ' Target: ₹${line.y.toStringAsFixed(0)} ',
          ),
        ),
      );
    }

    return ExtraLinesData(horizontalLines: lines);
  }

  Widget _buildInteractiveLegendAndInsights(NumberFormat cf, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: (widget.isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surface)
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: widget.isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.lightbulb_outline_rounded,
                size: 20,
                color: accentColor,
              ),
              const SizedBox(width: 8),
              Text(
                'Insights',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: widget.isDark
                      ? AppColors.textLight
                      : AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _generateInsight(),
            style: TextStyle(
              fontSize: 13,
              height: 1.5,
              color: widget.isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatisticalSummary(NumberFormat cf, Color accentColor) {
    final metrics = _calculateAdvancedMetrics();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: (widget.isDark
                ? AppColors.surfaceDarkVariant
                : AppColors.surface)
            .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: widget.isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Statistical Summary',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: widget.isDark
                  ? AppColors.textLight
                  : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _buildStatItem(
                'Median',
                cf.format(metrics['median']!),
                Icons.analytics_outlined,
              ),
              _buildStatItem(
                'Std Dev',
                cf.format(metrics['stdDev']!),
                Icons.show_chart,
              ),
              _buildStatItem(
                'Variance',
                '${metrics['variance']!.toStringAsFixed(1)}%',
                Icons.trending_up,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: widget.isDark
              ? AppColors.textLightSecondary
              : AppColors.textSecondary,
        ),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: widget.isDark
                    ? AppColors.textLightHint
                    : AppColors.textHint,
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: widget.isDark
                    ? AppColors.textLight
                    : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // HELPER METHODS
  Map<String, double> _calculateAdvancedMetrics() {
    if (widget.timeSeries.spots.isEmpty) {
      return {
        'revenueTrend': 0.0,
        'avgTrend': 0.0,
        'growthRate': 0.0,
        'median': 0.0,
        'stdDev': 0.0,
        'variance': 0.0,
      };
    }

    final values = widget.timeSeries.spots.map((s) => s.y).toList();
    values.sort();

    final median = values.length.isOdd
        ? values[values.length ~/ 2]
        : (values[values.length ~/ 2 - 1] + values[values.length ~/ 2]) / 2;

    final mean = widget.timeSeries.average;
    final variance =
        values.map((v) => (v - mean) * (v - mean)).reduce((a, b) => a + b) /
            values.length;
    final stdDev = variance > 0 ? variance : 0.0;

    // Growth rate calculation
    final halfPoint = widget.timeSeries.spots.length ~/ 2;
    final firstHalf = widget.timeSeries.spots.sublist(0, halfPoint);
    final secondHalf = widget.timeSeries.spots.sublist(halfPoint);

    final firstHalfAvg = firstHalf.isEmpty
        ? 0.0
        : firstHalf.map((s) => s.y).reduce((a, b) => a + b) / firstHalf.length;
    final secondHalfAvg = secondHalf.isEmpty
        ? 0.0
        : secondHalf.map((s) => s.y).reduce((a, b) => a + b) /
            secondHalf.length;

    final growthRate = firstHalfAvg > 0
        ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
        : 0.0;

    return {
      'revenueTrend': growthRate,
      'avgTrend': growthRate * 0.8,
      'growthRate': growthRate,
      'median': median,
      'stdDev': stdDev,
      'variance': (stdDev / mean) * 100,
    };
  }

  double _calculateAverageSlope(List<FlSpot> spots) {
    if (spots.length < 2) return 0;

    double totalSlope = 0;
    for (int i = 1; i < spots.length; i++) {
      totalSlope += (spots[i].y - spots[i - 1].y) / (spots[i].x - spots[i - 1].x);
    }

    return totalSlope / (spots.length - 1);
  }

  double _calculateVolatility(List<FlSpot> spots) {
    if (spots.length < 2) return 0;

    final values = spots.map((s) => s.y).toList();
    final mean = values.reduce((a, b) => a + b) / values.length;
    final variance =
        values.map((v) => (v - mean) * (v - mean)).reduce((a, b) => a + b) /
            values.length;

    return variance > 0 ? variance * 0.3 : 0.0;
  }

  List<FlSpot> _generateMiniSparkline(List<FlSpot> originalSpots) {
    if (originalSpots.isEmpty) return [];
    if (originalSpots.length <= 20) return originalSpots;

    final step = originalSpots.length ~/ 20;
    final List<FlSpot> downsampled = [];

    for (int i = 0; i < originalSpots.length; i += step) {
      downsampled.add(FlSpot(
        downsampled.length.toDouble(),
        originalSpots[i].y,
      ));
    }

    return downsampled;
  }

  String _getPeakValue(NumberFormat cf) {
    if (widget.timeSeries.spots.isEmpty) return cf.format(0);

    final peak = widget.timeSeries.spots
        .map((s) => s.y)
        .reduce((a, b) => a > b ? a : b);

    return cf.format(peak);
  }

  int _getXAxisLabelStep() {
    final totalPoints = widget.timeSeries.spots.length;

    if (totalPoints <= 7) return 1;
    if (totalPoints <= 30) return totalPoints ~/ 7;
    if (totalPoints <= 90) return totalPoints ~/ 6;
    return totalPoints ~/ 5;
  }

  String _formatXAxisLabel(String isoDate) {
    if (isoDate.isEmpty) return '';

    try {
      final date = DateTime.parse(isoDate);
      final days = widget.selectedRange.days;

      if (days <= 7) return DateFormat('EEE').format(date);
      if (days <= 30) return DateFormat('d MMM').format(date);
      if (days <= 90) return DateFormat('d MMM').format(date);
      return DateFormat('MMM yyyy').format(date);
    } catch (e) {
      return '';
    }
  }

  bool _isToday(String isoDate) {
    if (isoDate.isEmpty) return false;

    try {
      final date = DateTime.parse(isoDate);
      final now = DateTime.now();

      return date.year == now.year &&
          date.month == now.month &&
          date.day == now.day;
    } catch (e) {
      return false;
    }
  }

  String _generateInsight() {
    final metrics = _calculateAdvancedMetrics();
    final growthRate = metrics['growthRate']!;

    if (growthRate > 20) {
      return '🚀 Exceptional growth! Revenue increased by ${growthRate.toStringAsFixed(1)}% in the second half of the period. Maintain current strategies.';
    } else if (growthRate > 10) {
      return '📈 Strong performance! Revenue is trending upward with ${growthRate.toStringAsFixed(1)}% growth. Continue monitoring key metrics.';
    } else if (growthRate > 0) {
      return '✅ Steady growth of ${growthRate.toStringAsFixed(1)}%. Consider optimization opportunities to accelerate revenue.';
    } else if (growthRate > -10) {
      return '⚠️ Slight decline of ${growthRate.abs().toStringAsFixed(1)}%. Review recent changes and market conditions.';
    } else {
      return '🔴 Significant decline of ${growthRate.abs().toStringAsFixed(1)}%. Immediate action required to reverse the trend.';
    }
  }
}
