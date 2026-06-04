import 'package:flutter/material.dart';
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

  const AnimatedRevenueChart({
    super.key,
    this.totalRevenue = 0,
    this.revenueData = const [],
    this.currency = '₹',
  });

  @override
  State<AnimatedRevenueChart> createState() => _AnimatedRevenueChartState();
}

class _AnimatedRevenueChartState extends State<AnimatedRevenueChart>
    with SingleTickerProviderStateMixin {
  int _selectedPeriod = 1;
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
  static const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // X-axis labels for different periods - dynamic based on current date
  List<String> get _xLabels {
    final now = DateTime.now();

    switch (_selectedPeriod) {
      case 0: // 7 Days - Last 7 days from today
        return List.generate(7, (i) {
          final day = now.subtract(Duration(days: 6 - i));
          return _days[day.weekday - 1];
        });

      case 1: // 30 Days - Date ranges from current date backwards
        final labels = <String>[];
        for (int i = 4; i >= 0; i--) {
          final endDay = now.subtract(Duration(days: i * 6));
          final startDay = endDay.subtract(const Duration(days: 5));
          // Show "Dec\n11-16" format
          labels.add(
            '${_months[startDay.month - 1]}\n${startDay.day}-${endDay.day}',
          );
        }
        return labels;

      case 2: // 90 Days - Last 3 months
        return List.generate(3, (i) {
          final month = DateTime(now.year, now.month - 2 + i);
          return _months[month.month - 1];
        });

      case 3: // 1 Year - Last 12 months
        return List.generate(12, (i) {
          final month = DateTime(now.year, now.month - 11 + i);
          return _months[month.month - 1];
        });

      default:
        return _days;
    }
  }

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
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.glassMedium,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
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
                    colors: [Color(0xFF8B5CF6), Color(0xFFA78BFA)],
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
                    Text(
                      '${widget.currency}${_formatNumber(widget.totalRevenue.toInt())}',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: colors.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.payments_outlined,
                            color: const Color(0xFF8B5CF6),
                            size: 10,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            'Live total',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF8B5CF6),
                            ),
                          ),
                        ],
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
                      return LineChart(_buildChartData(_chartAnimation.value));
                    },
                  ),
          ),
        ],
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
                      colors: [Color(0xFF8B5CF6), Color(0xFFA78BFA)],
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
                const Color(0xFF8B5CF6).withValues(alpha: 0.25),
                const Color(0xFF8B5CF6).withValues(alpha: 0.1),
              ],
            ),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: const Color(0xFF8B5CF6).withValues(alpha: 0.4),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.payments_outlined,
                color: const Color(0xFF8B5CF6),
                size: 12,
              ),
              const SizedBox(width: 4),
              Text(
                'Recorded',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF8B5CF6),
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
          _buildMiniStat('High', '$high', const Color(0xFF8B5CF6)),
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
            onTap: () {
              HapticFeedback.selectionClick();
              setState(() => _selectedPeriod = index);
              _chartController.reset();
              _chartController.forward();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: isSelected
                    ? const LinearGradient(
                        colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
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
    final maxY = (data.reduce(math.max) * 1.3).ceilToDouble();
    final labels = _xLabels;

    // Calculate interval for x-axis labels
    final labelInterval = (data.length / 7).ceil().toDouble();

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
                  '${value.toInt()}K',
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
            colors: [Color(0xFF8B5CF6), Color(0xFFA78BFA), Color(0xFFC4B5FD)],
          ),
          barWidth: 3,
          isStrokeCapRound: true,
          shadow: Shadow(
            color: const Color(0xFF8B5CF6).withValues(alpha: 0.5),
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
                color: const Color(0xFF8B5CF6),
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
                const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                const Color(0xFF8B5CF6).withValues(alpha: 0.0),
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

    // Show limited labels based on data length
    int showEvery;
    if (data.length <= 7) {
      showEvery = 1;
    } else if (data.length <= 12) {
      showEvery = 2;
    } else {
      showEvery = 3;
    }

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
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              )
            : null,
        child: Text(
          labels[index],
          style: TextStyle(
            color: isSelected ? const Color(0xFF8B5CF6) : colors.textSecondary,
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
