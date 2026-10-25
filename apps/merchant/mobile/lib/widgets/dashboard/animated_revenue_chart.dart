import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import 'package:flutter/services.dart';
import 'package:fl_chart/fl_chart.dart';
import 'dart:math' as math;
import '../../theme/app_theme_colors.dart';

/// Premium Animated Revenue Chart
/// Features: Gradient fill, glow effect, interactive tooltips, dynamic period labels
class AnimatedRevenueChart extends StatefulWidget {
  final double totalRevenue;
  final List<double> revenueData;
  final String currency;
  final List<DateTime> revenueDates;
  final String period;
  final ValueChanged<String>? onPeriodChanged;

  const AnimatedRevenueChart({
    super.key,
    this.totalRevenue = 0,
    this.revenueData = const [],
    this.currency = '₹',
    this.revenueDates = const [],
    this.period = '30d',
    this.onPeriodChanged,
  });

  @override
  State<AnimatedRevenueChart> createState() => _AnimatedRevenueChartState();
}

class _AnimatedRevenueChartState extends State<AnimatedRevenueChart>
    with SingleTickerProviderStateMixin {
  int get _selectedPeriod =>
      const ['7d', '30d', '90d', '12m'].indexOf(widget.period).clamp(0, 3);
  final List<String> _periods = ['7D', '30D', '90D', '1Y'];
  late AnimationController _chartController;
  late Animation<double> _chartAnimation;
  late AppThemeColors colors;
  int? _touchedIndex;

  // Month abbreviations
  static const _months = [
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

  List<String> get _xLabels => widget.revenueDates
      .map((day) => '${day.day} ${_months[day.month - 1]}')
      .toList(growable: false);

  @override
  void initState() {
    super.initState();
    _chartController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _chartAnimation = CurvedAnimation(
      parent: _chartController,
      curve: Curves.easeOutCubic,
    );
    _chartController.forward();
  }

  @override
  void dispose() {
    _chartController.dispose();
    super.dispose();
  }

  List<double> get _currentData => widget.revenueData;

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Semantics(
      label: 'Daily revenue history, ${widget.revenueData.length} days',
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: colors.glassMedium,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
              alpha: 0.2,
            ),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Compact Header Row
            Row(
              children: [
                // Icon
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        mobile_tokens.LetbuyyColorTokens.brandPrimary,
                        Color(0xFFA78BFA),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.show_chart_rounded,
                    color: Colors.white,
                    size: 12,
                  ),
                ),
                const SizedBox(width: 8),
                // Title + Value
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          '${widget.currency}${_formatNumber(widget.totalRevenue.toInt())}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: mobile_tokens.LetbuyyColorTokens.brandPrimary
                                .withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.payments_outlined,
                                color: mobile_tokens
                                    .LetbuyyColorTokens
                                    .brandPrimary,
                                size: 10,
                              ),
                              const SizedBox(width: 2),
                              Flexible(
                                child: Text(
                                  'Live total',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: mobile_tokens
                                        .LetbuyyColorTokens
                                        .brandPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Period Selector
                _buildPeriodSelector(),
              ],
            ),

            const SizedBox(height: 10),

            // High/Low Row
            Row(
              children: [
                Text(
                  'vs last ${_periods[_selectedPeriod].toLowerCase()}',
                  style: TextStyle(fontSize: 10, color: colors.textSecondary),
                ),
                const Spacer(),
                Text(
                  _currentData.isEmpty
                      ? 'Revenue history unavailable'
                      : 'Recorded history',
                  style: TextStyle(fontSize: 10, color: colors.textSecondary),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Chart - Increased height
            SizedBox(
              height: 200,
              child: _currentData.length < 2
                  ? _buildEmptyHistory()
                  : AnimatedBuilder(
                      animation: _chartAnimation,
                      builder: (context, child) {
                        return LineChart(
                          _buildChartData(_chartAnimation.value),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyHistory() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.show_chart_rounded, size: 36, color: colors.textSecondary),
          const SizedBox(height: 8),
          Text(
            'Revenue chart needs daily gateway analytics.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [
                        mobile_tokens.LetbuyyColorTokens.brandPrimary,
                        Color(0xFFA78BFA),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.show_chart_rounded,
                    color: Colors.white,
                    size: 14,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  'Revenue',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${widget.currency}${_formatNumber(widget.totalRevenue.toInt())}',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: colors.textPrimary,
                letterSpacing: -1,
              ),
            ),
          ],
        ),
        // Period Selector
        _buildPeriodSelector(),
      ],
    );
  }

  Widget _buildStatsRow() {
    final data = _currentData;
    final high = data.isEmpty ? null : data.reduce(math.max);
    final low = data.isEmpty ? null : data.reduce(math.min);

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.25,
                ),
                mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.1,
                ),
              ],
            ),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                alpha: 0.4,
              ),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.payments_outlined,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                size: 12,
              ),
              const SizedBox(width: 4),
              Text(
                'Recorded',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          data.isEmpty
              ? 'history pending'
              : 'last ${_periods[_selectedPeriod].toLowerCase()}',
          style: TextStyle(fontSize: 11, color: colors.textSecondary),
        ),
        const Spacer(),
        if (high != null && low != null) ...[
          _buildMiniStat(
            'High',
            '$high',
            mobile_tokens.LetbuyyColorTokens.brandPrimary,
          ),
          const SizedBox(width: 16),
          _buildMiniStat('Low', '$low', const Color(0xFFF59E0B)),
        ],
      ],
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w500,
            color: colors.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildPeriodSelector() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: colors.elevation1,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(_periods.length, (index) {
          final isSelected = _selectedPeriod == index;
          return GestureDetector(
            key: ValueKey(
              'revenue-period-${const ['7d', '30d', '90d', '12m'][index]}',
            ),
            onTap: () {
              HapticFeedback.selectionClick();
              widget.onPeriodChanged?.call(
                const ['7d', '30d', '90d', '12m'][index],
              );
              _chartController.reset();
              _chartController.forward();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: isSelected
                    ? const LinearGradient(
                        colors: [
                          mobile_tokens.LetbuyyColorTokens.brandPrimary,
                          Color(0xFF7C3AED),
                        ],
                      )
                    : null,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                _periods[index],
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : colors.textSecondary,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  LineChartData _buildChartData(double animationValue) {
    final data = _currentData;
    final maxY = math.max(1.0, (data.reduce(math.max) * 1.3).ceilToDouble());
    final labels = _xLabels;

    // Calculate interval for x-axis labels

    return LineChartData(
      gridData: FlGridData(
        show: true,
        drawVerticalLine: false,
        horizontalInterval: maxY / 4,
        getDrawingHorizontalLine: (value) {
          return FlLine(
            color: Colors.white.withValues(alpha: 0.08),
            strokeWidth: 1,
            dashArray: [5, 5],
          );
        },
      ),
      titlesData: FlTitlesData(
        show: true,
        rightTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 36,
            interval: maxY / 4,
            getTitlesWidget: (value, meta) {
              if (value == 0) return const SizedBox.shrink();
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(
                  _formatNumber(value.toInt()),
                  style: TextStyle(
                    color: colors.textSecondary,
                    fontSize: 10,
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
            reservedSize: 44,
            interval: 1,
            getTitlesWidget: (value, meta) =>
                _bottomTitleWidgets(value, meta, labels),
          ),
        ),
      ),
      borderData: FlBorderData(show: false),
      minX: 0,
      maxX: (data.length - 1).toDouble(),
      minY: 0,
      maxY: maxY,
      lineBarsData: [
        LineChartBarData(
          spots: List.generate(data.length, (i) {
            return FlSpot(i.toDouble(), data[i] * animationValue);
          }),
          isCurved: true,
          curveSmoothness: 0.4,
          gradient: const LinearGradient(
            colors: [
              mobile_tokens.LetbuyyColorTokens.brandPrimary,
              Color(0xFFA78BFA),
              Color(0xFFC4B5FD),
            ],
          ),
          barWidth: 3,
          isStrokeCapRound: true,
          shadow: Shadow(
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
              alpha: 0.5,
            ),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          dotData: FlDotData(
            show: true,
            getDotPainter: (spot, percent, barData, index) {
              final isLast = index == data.length - 1;
              final isTouched = index == _touchedIndex;
              return FlDotCirclePainter(
                radius: isLast || isTouched ? 5 : 0,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                strokeWidth: 2,
                strokeColor: Colors.white,
              );
            },
          ),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.35,
                ),
                mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.1,
                ),
                mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.0,
                ),
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        ),
      ],
      lineTouchData: LineTouchData(
        handleBuiltInTouches: true,
        touchCallback: (event, response) {
          setState(() {
            if (response?.lineBarSpots != null &&
                response!.lineBarSpots!.isNotEmpty) {
              _touchedIndex = response.lineBarSpots!.first.spotIndex;
            } else {
              _touchedIndex = null;
            }
          });
        },
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (_) => const Color(0xFF1E1B4B),
          tooltipRoundedRadius: 12,
          tooltipPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 10,
          ),
          tooltipMargin: 12,
          getTooltipItems: (spots) => spots.map((spot) {
            final index = spot.x.toInt();
            final labels = _xLabels;
            final label = index < labels.length ? labels[index] : '';
            return LineTooltipItem(
              '${widget.currency}${(spot.y * 1000).toInt().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (match) => '${match[1]},')}',
              TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
              children: [
                TextSpan(
                  text: '\n$label',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _bottomTitleWidgets(
    double value,
    TitleMeta meta,
    List<String> labels,
  ) {
    final index = value.toInt();
    final data = _currentData;

    final showEvery = math.max(1, (data.length / 5).ceil());

    if (index % showEvery != 0 && index != data.length - 1) {
      return const SizedBox.shrink();
    }

    if (index < 0 || index >= labels.length) return const SizedBox.shrink();

    final isSelected = index == _touchedIndex;

    return SideTitleWidget(
      axisSide: meta.axisSide,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        decoration: isSelected
            ? BoxDecoration(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.2,
                ),
                borderRadius: BorderRadius.circular(4),
              )
            : null,
        child: Text(
          labels[index],
          style: TextStyle(
            color: isSelected
                ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                : colors.textSecondary,
            fontSize: 9,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  String _formatNumber(int number) {
    if (number >= 10000000)
      return '${(number / 10000000).toStringAsFixed(1)}Cr';
    if (number >= 100000) return '${(number / 100000).toStringAsFixed(1)}L';
    if (number >= 1000) return '${(number / 1000).toStringAsFixed(1)}K';
    return number.toString();
  }
}
