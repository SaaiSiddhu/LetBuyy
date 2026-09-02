// lib/screens/admin/analytics/widgets/heat_map_calendar.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'analytics_card.dart';

class HeatMapCalendar extends StatefulWidget {
  final Map<DateTime, double> activityData;
  final bool isDark;

  const HeatMapCalendar({
    super.key,
    required this.activityData,
    required this.isDark,
  });

  @override
  State<HeatMapCalendar> createState() => _HeatMapCalendarState();
}

class _HeatMapCalendarState extends State<HeatMapCalendar>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  DateTime? selectedDate;
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final accentColor =
        widget.isDark ? AppColors.primaryLight : AppColors.primary;
    final weeks = _generateWeeks();
    final stats = _calculateStats();

    return AnalyticsCard(
      title: 'Activity Heatmap',
      icon: Icons.calendar_today_rounded,
      color: accentColor,
      isDark: widget.isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stats Summary
          _buildStatsSummary(stats, accentColor),
          const SizedBox(height: 24),

          // Legend
          _buildLegend(accentColor),
          const SizedBox(height: 20),

          // Calendar Grid
          SizedBox(
            height: 180,
            child: SingleChildScrollView(
              controller: _scrollController,
              scrollDirection: Axis.horizontal,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Day Labels
                  _buildDayLabels(),
                  const SizedBox(width: 12),

                  // Weeks Grid
                  ...weeks.asMap().entries.map((entry) {
                    final index = entry.key;
                    return _buildWeekColumn(entry.value, index);
                  }),
                ],
              ),
            ),
          ),

          if (selectedDate != null) ...[
            const SizedBox(height: 20),
            _buildSelectedDateInfo(accentColor),
          ],
        ],
      ),
    );
  }

  Widget _buildStatsSummary(HeatMapStats stats, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.15),
            accentColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatItem(
              'Total Days',
              '${stats.totalDays}',
              Icons.calendar_month_rounded,
              AppColors.info,
            ),
          ),
          Container(
            width: 1,
            height: 50,
            color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                .withValues(alpha: 0.5),
          ),
          Expanded(
            child: _buildStatItem(
              'Active Days',
              '${stats.activeDays}',
              Icons.check_circle_rounded,
              AppColors.success,
            ),
          ),
          Container(
            width: 1,
            height: 50,
            color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                .withValues(alpha: 0.5),
          ),
          Expanded(
            child: _buildStatItem(
              'Peak Day',
              NumberFormat.compact().format(stats.peakValue),
              Icons.trending_up_rounded,
              AppColors.warning,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color:
                widget.isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildLegend(Color accentColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Less',
          style: TextStyle(
            fontSize: 12,
            color:
                widget.isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
        ),
        const SizedBox(width: 8),
        ...List.generate(5, (index) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: _getHeatColor(index / 4, accentColor),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color:
                      widget.isDark ? AppColors.borderDark : AppColors.border,
                ),
              ),
            ),
          );
        }),
        const SizedBox(width: 8),
        Text(
          'More',
          style: TextStyle(
            fontSize: 12,
            color:
                widget.isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
        ),
      ],
    );
  }

  Widget _buildDayLabels() {
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: days.map((day) {
        return Container(
          height: 22,
          alignment: Alignment.centerRight,
          margin: const EdgeInsets.only(bottom: 2),
          child: Text(
            day,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: widget.isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildWeekColumn(List<DateTime?> week, int weekIndex) {
    final accentColor =
        widget.isDark ? AppColors.primaryLight : AppColors.primary;

    return Padding(
      padding: const EdgeInsets.only(right: 3),
      child: Column(
        children: week.map((date) {
          if (date == null) {
            return Container(
              width: 22,
              height: 22,
              margin: const EdgeInsets.only(bottom: 2),
            );
          }

          final value = widget.activityData[date] ?? 0.0;
          final maxValue = widget.activityData.values.isEmpty
              ? 1.0
              : widget.activityData.values
                  .reduce((a, b) => a > b ? a : b);
          final normalizedValue = maxValue > 0 ? value / maxValue : 0.0;
          final isSelected = selectedDate != null &&
              date.year == selectedDate!.year &&
              date.month == selectedDate!.month &&
              date.day == selectedDate!.day;

          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                if (mounted) {
                  setState(() {
                    selectedDate = date;
                  });
                }
              },
              borderRadius: BorderRadius.circular(4),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 22,
                height: 22,
                margin: const EdgeInsets.only(bottom: 2),
                decoration: BoxDecoration(
                  color: _getHeatColor(normalizedValue, accentColor),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(
                    color: isSelected
                        ? accentColor
                        : (widget.isDark
                            ? AppColors.borderDark
                            : AppColors.border),
                    width: isSelected ? 2 : 1,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    ).animate().fadeIn(duration: 400.ms, delay: (weekIndex * 50).ms);
  }

  Widget _buildSelectedDateInfo(Color accentColor) {
    final value = widget.activityData[selectedDate!] ?? 0.0;
    final dateStr = DateFormat('EEEE, MMMM d, y').format(selectedDate!);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.2),
            accentColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  accentColor,
                  accentColor.withValues(alpha: 0.7),
                ],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.calendar_today_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateStr,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: widget.isDark
                        ? AppColors.textLight
                        : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${NumberFormat.compact().format(value)} orders',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: accentColor,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () {
              if (mounted) {
                setState(() {
                  selectedDate = null;
                });
              }
            },
            color: widget.isDark
                ? AppColors.textLightSecondary
                : AppColors.textSecondary,
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.2);
  }

  Color _getHeatColor(double value, Color baseColor) {
    if (value == 0) {
      return widget.isDark
          ? AppColors.surfaceDarkVariant.withValues(alpha: 0.3)
          : AppColors.surface;
    }

    if (value < 0.2) {
      return baseColor.withValues(alpha: 0.2);
    } else if (value < 0.4) {
      return baseColor.withValues(alpha: 0.4);
    } else if (value < 0.6) {
      return baseColor.withValues(alpha: 0.6);
    } else if (value < 0.8) {
      return baseColor.withValues(alpha: 0.8);
    } else {
      return baseColor;
    }
  }

  List<List<DateTime?>> _generateWeeks() {
    final now = DateTime.now();
    final startDate = now.subtract(const Duration(days: 90));
    
    // Find the Monday of the week containing startDate
    int daysToSubtract = (startDate.weekday - 1) % 7;
    DateTime weekStart = startDate.subtract(Duration(days: daysToSubtract));
    
    final List<List<DateTime?>> weeks = [];
    
    while (weekStart.isBefore(now) || weekStart.isAtSameMomentAs(now)) {
      final List<DateTime?> week = [];
      
      for (int i = 0; i < 7; i++) {
        final date = weekStart.add(Duration(days: i));
        if (date.isAfter(now)) {
          week.add(null);
        } else if (date.isBefore(startDate)) {
          week.add(null);
        } else {
          week.add(date);
        }
      }
      
      weeks.add(week);
      weekStart = weekStart.add(const Duration(days: 7));
    }
    
    return weeks;
  }

  HeatMapStats _calculateStats() {
    final totalDays = widget.activityData.length;
    final activeDays =
        widget.activityData.values.where((v) => v > 0).length;
    final peakValue = widget.activityData.values.isEmpty
        ? 0.0
        : widget.activityData.values.reduce((a, b) => a > b ? a : b);

    return HeatMapStats(
      totalDays: totalDays,
      activeDays: activeDays,
      peakValue: peakValue,
    );
  }
}

class HeatMapStats {
  final int totalDays;
  final int activeDays;
  final double peakValue;

  HeatMapStats({
    required this.totalDays,
    required this.activeDays,
    required this.peakValue,
  });
}
