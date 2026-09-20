// lib/screens/dashboard/widgets/sales_chart.dart
// 📈 ADVANCED SALES ANALYTICS CHART WITH RADAR GRAPH
// ✨ Logical Data + Custom Date Range + Enhanced Features

import 'dart:ui' as ui;
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

enum ChartPeriod { today, week, month, custom }
enum ChartMetric { revenue, orders, units }
enum ChartViewMode { line, radar }

class SalesChartWidget extends StatefulWidget {
  final List<SalesDataPoint> data;
  final bool isLoading;
  final Function(ChartPeriod, DateTimeRange?)? onPeriodChanged;
  
  // Performance data for radar chart (optional - will calculate from data if not provided)
  final double? avgOrderValue;
  final double? conversionRate;
  final double? returnRate;
  final double? customerSatisfaction;
  final double? repeatCustomerRate;

  const SalesChartWidget({
    super.key,
    required this.data,
    this.isLoading = false,
    this.onPeriodChanged,
    this.avgOrderValue,
    this.conversionRate,
    this.returnRate,
    this.customerSatisfaction,
    this.repeatCustomerRate,
  });

  @override
  State<SalesChartWidget> createState() => _SalesChartWidgetState();
}

class _SalesChartWidgetState extends State<SalesChartWidget>
    with SingleTickerProviderStateMixin {
  ChartPeriod _selectedPeriod = ChartPeriod.week;
  ChartMetric _selectedMetric = ChartMetric.revenue;
  ChartViewMode _viewMode = ChartViewMode.line;
  DateTimeRange? _customDateRange;
  int? _selectedSpotIndex; // For sticky tooltip
  late AnimationController _animationController;
  late Animation<double> _animation;

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _animation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  // Filter data based on selected period
  List<SalesDataPoint> _getFilteredData() {
    if (widget.data.isEmpty) return [];
    
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    
    switch (_selectedPeriod) {
      case ChartPeriod.today:
        return widget.data.where((d) => 
          d.date.year == today.year && 
          d.date.month == today.month && 
          d.date.day == today.day
        ).toList();
      case ChartPeriod.week:
        final weekAgo = today.subtract(const Duration(days: 6));
        return widget.data.where((d) => 
          d.date.isAfter(weekAgo.subtract(const Duration(days: 1))) && 
          d.date.isBefore(now.add(const Duration(days: 1)))
        ).toList();
      case ChartPeriod.month:
        final monthAgo = today.subtract(const Duration(days: 29));
        return widget.data.where((d) => 
          d.date.isAfter(monthAgo.subtract(const Duration(days: 1))) && 
          d.date.isBefore(now.add(const Duration(days: 1)))
        ).toList();
      case ChartPeriod.custom:
        if (_customDateRange != null) {
          return widget.data.where((d) => 
            d.date.isAfter(_customDateRange!.start.subtract(const Duration(days: 1))) && 
            d.date.isBefore(_customDateRange!.end.add(const Duration(days: 1)))
          ).toList();
        }
        return widget.data;
    }
  }

  // Calculate radar metrics from actual data
  RadarMetrics _calculateRadarMetrics() {
    final filteredData = _getFilteredData();
    if (filteredData.isEmpty) {
      return RadarMetrics.empty();
    }

    final totalRevenue = filteredData.fold(0.0, (sum, d) => sum + d.revenue);
    final totalOrders = filteredData.fold(0, (sum, d) => sum + d.orders);
    final totalUnits = filteredData.fold(0, (sum, d) => sum + d.units);
    final daysWithSales = filteredData.where((d) => d.orders > 0).length;
    final avgDailyRevenue = filteredData.isNotEmpty ? totalRevenue / filteredData.length : 0;
    final avgDailyOrders = filteredData.isNotEmpty ? totalOrders / filteredData.length : 0;
    final avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    final unitsPerOrder = totalOrders > 0 ? totalUnits / totalOrders : 0;

    // Calculate growth (compare first half vs second half)
    double growth = 0;
    if (filteredData.length >= 2) {
      final mid = filteredData.length ~/ 2;
      final firstHalfRev = filteredData.sublist(0, mid).fold(0.0, (s, d) => s + d.revenue);
      final secondHalfRev = filteredData.sublist(mid).fold(0.0, (s, d) => s + d.revenue);
      if (firstHalfRev > 0) {
        growth = ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100;
      }
    }

    // Calculate consistency (how many days had sales vs total days)
    final consistency = filteredData.isNotEmpty ? daysWithSales / filteredData.length : 0;

    // Normalize values to 0-1 scale for radar chart
    // Using realistic benchmarks for seller dashboard
    return RadarMetrics(
      revenue: _normalizeValue(totalRevenue, 50000), // Benchmark: 50k
      orders: _normalizeValue(totalOrders.toDouble(), 50), // Benchmark: 50 orders
      avgOrderValue: _normalizeValue(avgOrderValue.toDouble(), 2000), // Benchmark: ₹2000
      growth: _normalizeValue((growth + 100) / 2, 100), // Normalize -100% to +100% → 0 to 100
      consistency: consistency.toDouble(),
      // Use provided values or defaults
      conversionRate: widget.conversionRate ?? 0.65,
      customerSatisfaction: widget.customerSatisfaction ?? 0.85,
    );
  }

  double _normalizeValue(double value, double benchmark) {
    return (value / benchmark).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [
                      const Color(0xFF1E293B).withValues(alpha: 0.8),
                      const Color(0xFF0F172A).withValues(alpha: 0.9),
                    ]
                  : [
                      Colors.white.withValues(alpha: 0.9),
                      Colors.white.withValues(alpha: 0.7),
                    ],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : Colors.black.withValues(alpha: 0.05),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.1),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              _buildHeader(isDark),

              // Controls Row
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    _buildViewToggle(isDark),
                    const Spacer(),
                    _buildMetricSelector(isDark),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Period Chips with Custom
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _buildPeriodChips(isDark),
              ),
              const SizedBox(height: 20),

              // Chart Area
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  height: 200,
                  child: widget.isLoading
                      ? _buildLoadingState(isDark)
                      : widget.data.isEmpty
                          ? _buildEmptyState(isDark)
                          : AnimatedSwitcher(
                              duration: const Duration(milliseconds: 400),
                              child: _viewMode == ChartViewMode.line
                                  ? _buildLineChart(isDark)
                                  : _buildRadarChart(isDark),
                            ),
                ),
              ),
              const SizedBox(height: 16),

              // Summary Stats
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: _buildSummaryStats(isDark),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.03, end: 0);
  }

  Widget _buildHeader(bool isDark) {
    final growth = _calculateGrowth();
    final isPositive = growth >= 0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.black.withValues(alpha: 0.03),
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.2),
                  AppColors.primary.withValues(alpha: 0.1),
                ],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Icon(
              _viewMode == ChartViewMode.line
                  ? Icons.insights_rounded
                  : Icons.radar_rounded,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _viewMode == ChartViewMode.line
                      ? 'Sales Analytics'
                      : 'Performance Radar',
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                ),
                Text(
                  _getPeriodLabel(),
                  style: TextStyle(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.5)
                        : Colors.black.withValues(alpha: 0.4),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          // Growth Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: (isPositive ? const Color(0xFF10B981) : const Color(0xFFEF4444))
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: (isPositive ? const Color(0xFF10B981) : const Color(0xFFEF4444))
                    .withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isPositive
                      ? Icons.trending_up_rounded
                      : Icons.trending_down_rounded,
                  size: 14,
                  color: isPositive
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                ),
                const SizedBox(width: 4),
                Text(
                  '${isPositive ? '+' : ''}${growth.toStringAsFixed(1)}%',
                  style: TextStyle(
                    color: isPositive
                        ? const Color(0xFF10B981)
                        : const Color(0xFFEF4444),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getPeriodLabel() {
    switch (_selectedPeriod) {
      case ChartPeriod.today:
        return 'Today\'s performance';
      case ChartPeriod.week:
        return 'Last 7 days';
      case ChartPeriod.month:
        return 'Last 30 days';
      case ChartPeriod.custom:
        if (_customDateRange != null) {
          final format = DateFormat('MMM d');
          return '${format.format(_customDateRange!.start)} - ${format.format(_customDateRange!.end)}';
        }
        return 'Custom range';
    }
  }

  Widget _buildViewToggle(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildViewChip(ChartViewMode.line, Icons.show_chart_rounded, 'Trend', isDark),
          const SizedBox(width: 2),
          _buildViewChip(ChartViewMode.radar, Icons.radar_rounded, 'Radar', isDark),
        ],
      ),
    );
  }

  Widget _buildViewChip(ChartViewMode mode, IconData icon, String label, bool isDark) {
    final isSelected = _viewMode == mode;
    return GestureDetector(
      onTap: () {
        setState(() => _viewMode = mode);
        _animationController.reset();
        _animationController.forward();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected
                  ? Colors.white
                  : isDark
                      ? Colors.grey[400]
                      : Colors.grey[600],
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? Colors.white
                    : isDark
                        ? Colors.grey[400]
                        : Colors.grey[600],
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricSelector(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildMetricChip(ChartMetric.revenue, '₹', isDark),
          const SizedBox(width: 2),
          _buildMetricChip(ChartMetric.orders, '📦', isDark),
        ],
      ),
    );
  }

  Widget _buildMetricChip(ChartMetric metric, String symbol, bool isDark) {
    final isSelected = _selectedMetric == metric;
    return GestureDetector(
      onTap: () => setState(() => _selectedMetric = metric),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.15)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          symbol,
          style: TextStyle(
            color: isSelected
                ? AppColors.primary
                : isDark
                    ? Colors.grey[400]
                    : Colors.grey[600],
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildPeriodChips(bool isDark) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildPeriodChip(ChartPeriod.today, 'Today', Icons.today_rounded, isDark),
          const SizedBox(width: 8),
          _buildPeriodChip(ChartPeriod.week, '7 Days', Icons.date_range_rounded, isDark),
          const SizedBox(width: 8),
          _buildPeriodChip(ChartPeriod.month, '30 Days', Icons.calendar_month_rounded, isDark),
          const SizedBox(width: 8),
          _buildCustomDateChip(isDark),
        ],
      ),
    );
  }

  Widget _buildPeriodChip(ChartPeriod period, String label, IconData icon, bool isDark) {
    final isSelected = _selectedPeriod == period;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedPeriod = period;
          if (period != ChartPeriod.custom) {
            _customDateRange = null;
          }
        });
        widget.onPeriodChanged?.call(period, null);
        _animationController.reset();
        _animationController.forward();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.18),
                    AppColors.primary.withValues(alpha: 0.08),
                  ],
                )
              : null,
          color: isSelected
              ? null
              : isDark
                  ? Colors.white.withValues(alpha: 0.03)
                  : Colors.grey[100],
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected
                ? AppColors.primary.withValues(alpha: 0.35)
                : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected
                  ? AppColors.primary
                  : isDark
                      ? Colors.grey[400]
                      : Colors.grey[600],
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? AppColors.primary
                    : isDark
                        ? Colors.grey[400]
                        : Colors.grey[600],
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomDateChip(bool isDark) {
    final isSelected = _selectedPeriod == ChartPeriod.custom;
    final hasRange = _customDateRange != null;

    return GestureDetector(
      onTap: () => _showDateRangePicker(isDark),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  colors: [
                    const Color(0xFF8B5CF6).withValues(alpha: 0.18),
                    const Color(0xFF8B5CF6).withValues(alpha: 0.08),
                  ],
                )
              : null,
          color: isSelected
              ? null
              : isDark
                  ? Colors.white.withValues(alpha: 0.03)
                  : Colors.grey[100],
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF8B5CF6).withValues(alpha: 0.35)
                : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.edit_calendar_rounded,
              size: 14,
              color: isSelected
                  ? const Color(0xFF8B5CF6)
                  : isDark
                      ? Colors.grey[400]
                      : Colors.grey[600],
            ),
            const SizedBox(width: 6),
            Text(
              hasRange
                  ? '${DateFormat('d/M').format(_customDateRange!.start)} - ${DateFormat('d/M').format(_customDateRange!.end)}'
                  : 'Custom',
              style: TextStyle(
                color: isSelected
                    ? const Color(0xFF8B5CF6)
                    : isDark
                        ? Colors.grey[400]
                        : Colors.grey[600],
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showDateRangePicker(bool isDark) async {
    final now = DateTime.now();
    final initialRange = _customDateRange ??
        DateTimeRange(
          start: now.subtract(const Duration(days: 14)),
          end: now,
        );

    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: now,
      initialDateRange: initialRange,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.fromSeed(
              seedColor: AppColors.primary,
              brightness: isDark ? Brightness.dark : Brightness.light,
            ), dialogTheme: DialogThemeData(backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _customDateRange = picked;
        _selectedPeriod = ChartPeriod.custom;
      });
      widget.onPeriodChanged?.call(ChartPeriod.custom, picked);
      _animationController.reset();
      _animationController.forward();
    }
  }

  Widget _buildLineChart(bool isDark) {
    final filteredData = _getFilteredData();
    final spots = _getChartSpots();
    if (spots.isEmpty) return _buildEmptyState(isDark);

    final maxY = spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    final adjustedMaxY = maxY <= 0 ? 100.0 : maxY * 1.2;

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return LineChart(
          LineChartData(
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              horizontalInterval: _getYAxisInterval(adjustedMaxY),
              getDrawingHorizontalLine: (value) => FlLine(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.04)
                    : Colors.black.withValues(alpha: 0.04),
                strokeWidth: 1,
                dashArray: [5, 5],
              ),
            ),
            titlesData: FlTitlesData(
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 48,
                  interval: _getYAxisInterval(adjustedMaxY),
                  getTitlesWidget: (value, meta) {
                    // Skip 0 and only the very top label if it would duplicate with max
                    if (value == 0 || value >= meta.max * 0.99) {
                      return const SizedBox.shrink();
                    }
                    // For small values (orders), show integer
                    final displayValue = adjustedMaxY < 100 
                        ? value.toInt().toString()
                        : _formatAxisValue(value);
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Text(
                        displayValue,
                        style: TextStyle(
                          color: isDark ? Colors.white38 : Colors.black38,
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    );
                  },
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  interval: _getBottomIntervalForFiltered(filteredData),
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    // Skip first label to avoid Y-axis overlap
                    if (index == 0 && filteredData.length > 7) {
                      return const SizedBox.shrink();
                    }
                    if (index >= 0 && index < filteredData.length) {
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _formatDateLabelSmart(filteredData[index].date, filteredData.length),
                          style: TextStyle(
                            color: isDark ? Colors.white38 : Colors.black38,
                            fontSize: filteredData.length > 20 ? 8 : 9,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
              ),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            borderData: FlBorderData(show: false),
            lineBarsData: [
              LineChartBarData(
                spots: spots.map((s) => FlSpot(s.x, s.y * _animation.value)).toList(),
                isCurved: true,
                curveSmoothness: 0.35,
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
                ),
                barWidth: 3,
                isStrokeCapRound: true,
                dotData: FlDotData(
                  show: spots.length <= 10,
                  getDotPainter: (spot, percent, barData, index) => FlDotCirclePainter(
                    radius: 4,
                    color: isDark ? const Color(0xFF1E293B) : Colors.white,
                    strokeWidth: 2,
                    strokeColor: AppColors.primary,
                  ),
                ),
                belowBarData: BarAreaData(
                  show: true,
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      AppColors.primary.withValues(alpha: 0.2 * _animation.value),
                      AppColors.primary.withValues(alpha: 0.02 * _animation.value),
                    ],
                  ),
                ),
              ),
            ],
            lineTouchData: LineTouchData(
              enabled: true,
              handleBuiltInTouches: false, // We handle touches manually
              touchSpotThreshold: 20,
              touchCallback: (FlTouchEvent event, LineTouchResponse? response) {
                if (event is FlTapUpEvent || event is FlLongPressEnd) {
                  // Keep the selected spot on tap up
                  if (response?.lineBarSpots?.isNotEmpty == true) {
                    setState(() {
                      _selectedSpotIndex = response!.lineBarSpots!.first.spotIndex;
                    });
                  }
                } else if (event is FlTapDownEvent || event is FlLongPressStart) {
                  // Update selection on tap
                  if (response?.lineBarSpots?.isNotEmpty == true) {
                    final newIndex = response!.lineBarSpots!.first.spotIndex;
                    setState(() {
                      // If tapping same spot, clear it; otherwise select new spot
                      if (_selectedSpotIndex == newIndex) {
                        _selectedSpotIndex = null;
                      } else {
                        _selectedSpotIndex = newIndex;
                      }
                    });
                  } else {
                    // Tapped on empty area, clear selection
                    setState(() => _selectedSpotIndex = null);
                  }
                } else if (event is FlPanUpdateEvent) {
                  // Update during drag
                  if (response?.lineBarSpots?.isNotEmpty == true) {
                    setState(() {
                      _selectedSpotIndex = response!.lineBarSpots!.first.spotIndex;
                    });
                  }
                }
              },
              getTouchedSpotIndicator: (barData, spotIndexes) {
                return spotIndexes.map((spotIndex) {
                  return TouchedSpotIndicatorData(
                    FlLine(
                      color: AppColors.primary.withValues(alpha: 0.5),
                      strokeWidth: 2,
                      dashArray: [4, 4],
                    ),
                    FlDotData(
                      show: true,
                      getDotPainter: (spot, percent, barData, index) => FlDotCirclePainter(
                        radius: 8,
                        color: AppColors.primary,
                        strokeWidth: 3,
                        strokeColor: isDark ? const Color(0xFF1E293B) : Colors.white,
                      ),
                    ),
                  );
                }).toList();
              },
              touchTooltipData: LineTouchTooltipData(
                fitInsideHorizontally: true,
                fitInsideVertically: true,
                showOnTopOfTheChartBoxArea: true,
                getTooltipColor: (_) => isDark
                    ? const Color(0xFF1E293B).withValues(alpha: 0.98)
                    : Colors.white.withValues(alpha: 0.98),
                tooltipBorder: BorderSide(
                  color: AppColors.primary.withValues(alpha: 0.4),
                  width: 1.5,
                ),
                tooltipRoundedRadius: 12,
                tooltipPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                tooltipMargin: 12,
                getTooltipItems: (spots) => spots.map((spot) {
                  final index = spot.spotIndex;
                  if (index >= filteredData.length) return null;
                  
                  final dataPoint = filteredData[index];
                  final dateStr = DateFormat('EEE, MMM d').format(dataPoint.date);
                  
                  // Show more detailed info based on selected metric
                  String valueStr;
                  String metricLabel;
                  switch (_selectedMetric) {
                    case ChartMetric.revenue:
                      valueStr = '₹${_compactFormat(dataPoint.revenue)}';
                      metricLabel = 'Revenue';
                      break;
                    case ChartMetric.orders:
                      valueStr = '${dataPoint.orders}';
                      metricLabel = 'Orders';
                      break;
                    case ChartMetric.units:
                      valueStr = '${dataPoint.units}';
                      metricLabel = 'Units';
                      break;
                  }
                  
                  return LineTooltipItem(
                    '$dateStr\n',
                    TextStyle(
                      color: isDark ? Colors.white70 : Colors.black54,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                    children: [
                      TextSpan(
                        text: valueStr,
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      TextSpan(
                        text: '\n$metricLabel',
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.black38,
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
            showingTooltipIndicators: _selectedSpotIndex != null
                ? [ShowingTooltipIndicators([
                    LineBarSpot(
                      LineChartBarData(spots: spots),
                      0,
                      spots[_selectedSpotIndex!.clamp(0, spots.length - 1)],
                    ),
                  ])]
                : [],
            minY: 0,
            maxY: adjustedMaxY,
          ),
          duration: const Duration(milliseconds: 300),
        );
      },
    );
  }

  double _getBottomIntervalForFiltered(List<SalesDataPoint> data) {
    if (data.isEmpty) return 1;
    if (data.length <= 5) return 1;
    if (data.length <= 10) return 2;
    if (data.length <= 15) return 3;
    if (data.length <= 30) return 5;
    return (data.length / 6).ceilToDouble();
  }

  double _getYAxisInterval(double maxY) {
    if (maxY <= 0) return 1;
    if (maxY <= 5) return 1;
    if (maxY <= 10) return 2;
    if (maxY <= 20) return 5;
    if (maxY <= 50) return 10;
    if (maxY <= 100) return 20;
    if (maxY <= 500) return 100;
    if (maxY <= 1000) return 200;
    if (maxY <= 5000) return 1000;
    if (maxY <= 10000) return 2000;
    if (maxY <= 50000) return 10000;
    if (maxY <= 100000) return 25000;
    if (maxY <= 500000) return 100000;
    return (maxY / 4).ceilToDouble();
  }

  Widget _buildRadarChart(bool isDark) {
    final metrics = _calculateRadarMetrics();

    return Row(
      children: [
        // Radar Chart
        Expanded(
          flex: 3,
          child: AnimatedBuilder(
            animation: _animation,
            builder: (context, child) {
              return CustomPaint(
                size: const Size(double.infinity, 180),
                painter: RadarChartPainter(
                  metrics: metrics,
                  animation: _animation.value,
                  isDark: isDark,
                  primaryColor: AppColors.primary,
                ),
              );
            },
          ),
        ),
        const SizedBox(width: 8),
        // Legend
        Expanded(
          flex: 2,
          child: _buildRadarLegend(metrics, isDark),
        ),
      ],
    );
  }

  Widget _buildRadarLegend(RadarMetrics metrics, bool isDark) {
    final items = [
      _LegendItem('Revenue', metrics.revenue, const Color(0xFF3B82F6)),
      _LegendItem('Orders', metrics.orders, const Color(0xFF10B981)),
      _LegendItem('Avg Value', metrics.avgOrderValue, const Color(0xFFF59E0B)),
      _LegendItem('Growth', metrics.growth, const Color(0xFF8B5CF6)),
      _LegendItem('Consistency', metrics.consistency, const Color(0xFFEC4899)),
    ];

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: items.asMap().entries.map((entry) {
        final index = entry.key;
        final item = entry.value;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: item.color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item.label,
                  style: TextStyle(
                    color: isDark ? Colors.white60 : Colors.black54,
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Text(
                '${(item.value * 100).toInt()}%',
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ).animate(delay: (80 * index).ms).fadeIn().slideX(begin: 0.1);
      }).toList(),
    );
  }

  Widget _buildSummaryStats(bool isDark) {
    final filteredData = _getFilteredData();
    final totalRevenue = filteredData.fold(0.0, (sum, d) => sum + d.revenue);
    final totalOrders = filteredData.fold(0, (sum, d) => sum + d.orders);
    final totalUnits = filteredData.fold(0, (sum, d) => sum + d.units);
    final avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0.0;

    return Row(
      children: [
        _buildStatCard(
          'Revenue',
          '₹${_compactFormat(totalRevenue)}',
          const Color(0xFF10B981),
          Icons.account_balance_wallet_rounded,
          isDark,
        ),
        const SizedBox(width: 10),
        _buildStatCard(
          'Orders',
          '$totalOrders',
          const Color(0xFF3B82F6),
          Icons.shopping_bag_rounded,
          isDark,
        ),
        const SizedBox(width: 10),
        _buildStatCard(
          'Avg Value',
          '₹${_compactFormat(avgOrderValue)}',
          const Color(0xFFF59E0B),
          Icons.receipt_long_rounded,
          isDark,
        ),
      ],
    );
  }

  Widget _buildStatCard(
    String label,
    String value,
    Color color,
    IconData icon,
    bool isDark,
  ) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withValues(alpha: 0.1),
              color.withValues(alpha: 0.04),
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF111827),
                fontSize: 15,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.3,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.5)
                    : Colors.black.withValues(alpha: 0.4),
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ).animate(delay: 200.ms).fadeIn().scale(begin: const Offset(0.95, 0.95)),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              color: AppColors.primary,
              strokeWidth: 3,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Loading analytics...',
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.black45,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.05)
                  : Colors.black.withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.analytics_outlined,
              size: 36,
              color: isDark
                  ? Colors.white.withValues(alpha: 0.2)
                  : Colors.black.withValues(alpha: 0.15),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'No data for this period',
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.black45,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  // Utility methods
  List<FlSpot> _getChartSpots() {
    final filteredData = _getFilteredData();
    switch (_selectedMetric) {
      case ChartMetric.revenue:
        return filteredData.asMap().entries
            .map((e) => FlSpot(e.key.toDouble(), e.value.revenue))
            .toList();
      case ChartMetric.orders:
        return filteredData.asMap().entries
            .map((e) => FlSpot(e.key.toDouble(), e.value.orders.toDouble()))
            .toList();
      case ChartMetric.units:
        return filteredData.asMap().entries
            .map((e) => FlSpot(e.key.toDouble(), e.value.units.toDouble()))
            .toList();
    }
  }

  double _getBottomInterval() {
    if (widget.data.length <= 7) return 1;
    if (widget.data.length <= 14) return 2;
    return (widget.data.length / 5).ceilToDouble();
  }

  double _calculateGrowth() {
    final filteredData = _getFilteredData();
    if (filteredData.length < 2) return 0.0;
    final mid = filteredData.length ~/ 2;
    final firstHalf = filteredData.sublist(0, mid);
    final secondHalf = filteredData.sublist(mid);
    final firstTotal = firstHalf.fold(0.0, (sum, d) => sum + d.revenue);
    final secondTotal = secondHalf.fold(0.0, (sum, d) => sum + d.revenue);
    if (firstTotal == 0) return secondTotal > 0 ? 100.0 : 0.0;
    return ((secondTotal - firstTotal) / firstTotal) * 100;
  }

  String _formatAxisValue(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(0)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(0)}k';
    return value.toStringAsFixed(0);
  }

  String _formatDateLabel(DateTime date) {
    final now = DateTime.now();
    if (date.year == now.year && date.month == now.month && date.day == now.day) {
      return 'Today';
    }
    return DateFormat('d/M').format(date);
  }

  String _formatDateLabelSmart(DateTime date, int dataLength) {
    final now = DateTime.now();
    if (date.year == now.year && date.month == now.month && date.day == now.day) {
      return 'Today';
    }
    // Use shorter format for longer periods
    if (dataLength > 20) {
      return DateFormat('d').format(date); // Just day number
    } else if (dataLength > 10) {
      return DateFormat('d/M').format(date); // Day/Month
    }
    return DateFormat('d/M').format(date);
  }

  String _formatTooltipValue(double value) {
    if (_selectedMetric == ChartMetric.revenue) {
      return '₹${_currencyFormat.format(value)}';
    }
    return value.toStringAsFixed(0);
  }

  String _compactFormat(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}

// Radar Chart Painter
class RadarChartPainter extends CustomPainter {
  final RadarMetrics metrics;
  final double animation;
  final bool isDark;
  final Color primaryColor;

  RadarChartPainter({
    required this.metrics,
    required this.animation,
    required this.isDark,
    required this.primaryColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2.5;
    const sides = 5;
    final angle = (2 * math.pi) / sides;

    // Draw background circles
    for (var i = 1; i <= 4; i++) {
      final r = radius * (i / 4);
      final paint = Paint()
        ..color = isDark
            ? Colors.white.withValues(alpha: 0.05)
            : Colors.black.withValues(alpha: 0.03)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1;
      canvas.drawCircle(center, r, paint);
    }

    // Draw axis lines
    for (var i = 0; i < sides; i++) {
      final x = center.dx + radius * math.cos(angle * i - math.pi / 2);
      final y = center.dy + radius * math.sin(angle * i - math.pi / 2);
      final linePaint = Paint()
        ..color = isDark
            ? Colors.white.withValues(alpha: 0.07)
            : Colors.black.withValues(alpha: 0.05)
        ..strokeWidth = 1;
      canvas.drawLine(center, Offset(x, y), linePaint);
    }

    // Get values from metrics
    final values = [
      metrics.revenue,
      metrics.orders,
      metrics.avgOrderValue,
      metrics.growth,
      metrics.consistency,
    ];

    // Draw data polygon
    final path = Path();
    for (var i = 0; i < sides; i++) {
      final value = values[i] * animation;
      final r = radius * value;
      final x = center.dx + r * math.cos(angle * i - math.pi / 2);
      final y = center.dy + r * math.sin(angle * i - math.pi / 2);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    path.close();

    // Fill
    final fillPaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.18 * animation)
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    // Stroke
    final strokePaint = Paint()
      ..color = primaryColor.withValues(alpha: 0.7 * animation)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, strokePaint);

    // Draw data points
    final colors = [
      const Color(0xFF3B82F6),
      const Color(0xFF10B981),
      const Color(0xFFF59E0B),
      const Color(0xFF8B5CF6),
      const Color(0xFFEC4899),
    ];

    for (var i = 0; i < sides; i++) {
      final value = values[i] * animation;
      final r = radius * value;
      final x = center.dx + r * math.cos(angle * i - math.pi / 2);
      final y = center.dy + r * math.sin(angle * i - math.pi / 2);

      // Point
      final pointPaint = Paint()
        ..color = colors[i]
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(x, y), 4, pointPaint);

      // Inner highlight
      final innerPaint = Paint()
        ..color = Colors.white
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(x, y), 1.5, innerPaint);
    }

    // Draw labels
    final labels = ['Revenue', 'Orders', 'Avg Value', 'Growth', 'Consistency'];
    final textPainter = TextPainter(textDirection: ui.TextDirection.ltr);

    for (var i = 0; i < sides; i++) {
      final labelRadius = radius + 18;
      final x = center.dx + labelRadius * math.cos(angle * i - math.pi / 2);
      final y = center.dy + labelRadius * math.sin(angle * i - math.pi / 2);

      textPainter.text = TextSpan(
        text: labels[i],
        style: TextStyle(
          color: isDark ? Colors.white54 : Colors.black45,
          fontSize: 9,
          fontWeight: FontWeight.w500,
        ),
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(x - textPainter.width / 2, y - textPainter.height / 2),
      );
    }
  }

  @override
  bool shouldRepaint(covariant RadarChartPainter oldDelegate) {
    return oldDelegate.animation != animation || oldDelegate.metrics != metrics;
  }
}

// Data Models
class SalesDataPoint {
  final DateTime date;
  final double revenue;
  final int orders;
  final int units;

  const SalesDataPoint({
    required this.date,
    required this.revenue,
    required this.orders,
    required this.units,
  });
}

class RadarMetrics {
  final double revenue;
  final double orders;
  final double avgOrderValue;
  final double growth;
  final double consistency;
  final double conversionRate;
  final double customerSatisfaction;

  const RadarMetrics({
    required this.revenue,
    required this.orders,
    required this.avgOrderValue,
    required this.growth,
    required this.consistency,
    required this.conversionRate,
    required this.customerSatisfaction,
  });

  factory RadarMetrics.empty() => const RadarMetrics(
        revenue: 0,
        orders: 0,
        avgOrderValue: 0,
        growth: 0.5,
        consistency: 0,
        conversionRate: 0,
        customerSatisfaction: 0,
      );
}

class _LegendItem {
  final String label;
  final double value;
  final Color color;

  _LegendItem(this.label, this.value, this.color);
}
