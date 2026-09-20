// ============================================================
// HEATMAP GRID WIDGET
// 7-day x 6-timeslot grid showing traffic patterns
// ============================================================

import 'package:flutter/material.dart';

/// Heatmap Grid - Shows weekly traffic patterns by time of day
class HeatmapGrid extends StatelessWidget {
  final List<Map<String, dynamic>> dailyData;
  final String selectedMetric;
  final String selectedPeriod;

  const HeatmapGrid({
    super.key,
    required this.dailyData,
    required this.selectedMetric,
    required this.selectedPeriod,
  });

  // Time slots for 4-hour blocks
  static const List<String> _timeSlots = [
    '12AM-4AM',
    '4AM-8AM',
    '8AM-12PM',
    '12PM-4PM',
    '4PM-8PM',
    '8PM-12AM',
  ];

  static const List<String> _dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Process data into grid format
    final gridData = _processDataToGrid();
    final maxValue = _getMaxValue(gridData);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Day labels header
        Padding(
          padding: const EdgeInsets.only(left: 60),
          child: Row(
            children: _dayLabels.map((day) => Expanded(
              child: Center(
                child: Text(
                  day,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white60 : Colors.grey.shade600,
                  ),
                ),
              ),
            )).toList(),
          ),
        ),
        
        const SizedBox(height: 8),
        
        // Grid rows (one per time slot)
        ...List.generate(_timeSlots.length, (slotIndex) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                // Time label
                SizedBox(
                  width: 60,
                  child: Text(
                    _timeSlots[slotIndex],
                    style: TextStyle(
                      fontSize: 10,
                      color: isDark ? Colors.white60 : Colors.grey.shade600,
                    ),
                  ),
                ),
                
                // Grid cells for each day
                ...List.generate(7, (dayIndex) {
                  final value = gridData[slotIndex][dayIndex];
                  final intensity = maxValue > 0 ? value / maxValue : 0.0;
                  
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: _buildCell(
                        value: value,
                        intensity: intensity,
                        isDark: isDark,
                        dayIndex: dayIndex,
                        slotIndex: slotIndex,
                      ),
                    ),
                  );
                }),
              ],
            ),
          );
        }),
        
        const SizedBox(height: 12),
        
        // Legend
        _buildLegend(isDark),
      ],
    );
  }

  Widget _buildCell({
    required double value,
    required double intensity,
    required bool isDark,
    required int dayIndex,
    required int slotIndex,
  }) {
    final color = _getIntensityColor(intensity);
    
    return Tooltip(
      message: '${_dayLabels[dayIndex]} ${_timeSlots[slotIndex]}\n${_formatValue(value)}',
      child: Container(
        height: 28,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade200,
          ),
        ),
        child: Center(
          child: value > 0 ? Text(
            _formatShortValue(value),
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: intensity > 0.5 ? Colors.white : Colors.black87,
            ),
          ) : null,
        ),
      ),
    );
  }

  Color _getIntensityColor(double intensity) {
    if (intensity <= 0) return Colors.grey.shade200;
    if (intensity < 0.25) return const Color(0xFF22C55E); // Green
    if (intensity < 0.40) return const Color(0xFF84CC16); // Lime
    if (intensity < 0.60) return const Color(0xFFEAB308); // Yellow
    if (intensity < 0.80) return const Color(0xFFF97316); // Orange
    return const Color(0xFFEF4444); // Red
  }

  Widget _buildLegend(bool isDark) {
    final colors = [
      (const Color(0xFF22C55E), 'Low'),
      (const Color(0xFF84CC16), ''),
      (const Color(0xFFEAB308), 'Medium'),
      (const Color(0xFFF97316), ''),
      (const Color(0xFFEF4444), 'High'),
    ];

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Activity: ',
          style: TextStyle(
            fontSize: 11,
            color: isDark ? Colors.white60 : Colors.grey.shade600,
          ),
        ),
        const SizedBox(width: 8),
        ...colors.map((c) => Row(
          children: [
            Container(
              width: 16,
              height: 12,
              decoration: BoxDecoration(
                color: c.$1,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            if (c.$2.isNotEmpty) ...[
              const SizedBox(width: 4),
              Text(
                c.$2,
                style: TextStyle(
                  fontSize: 10,
                  color: isDark ? Colors.white60 : Colors.grey.shade600,
                ),
              ),
            ],
            const SizedBox(width: 4),
          ],
        )),
      ],
    );
  }

  /// Process daily data into a 6x7 grid (timeslots x days)
  List<List<double>> _processDataToGrid() {
    // Initialize grid with zeros
    final grid = List.generate(6, (_) => List.filled(7, 0.0));
    
    for (final day in dailyData) {
      final dateStr = day['date'] as String?;
      if (dateStr == null) continue;
      
      // Parse date to get day of week (0 = Monday, 6 = Sunday)
      final date = DateTime.tryParse(dateStr);
      if (date == null) continue;
      
      final dayOfWeek = (date.weekday - 1) % 7; // Convert to 0-indexed Monday start
      
      // Get hourly breakdown if available
      final hourlyBreakdown = day['hourlyBreakdown'] as List<dynamic>?;
      
      if (hourlyBreakdown != null && hourlyBreakdown.length >= 24) {
        // Aggregate hours into 4-hour time slots
        for (int slot = 0; slot < 6; slot++) {
          double slotValue = 0;
          for (int h = slot * 4; h < (slot + 1) * 4 && h < 24; h++) {
            slotValue += (hourlyBreakdown[h] as num?)?.toDouble() ?? 0;
          }
          grid[slot][dayOfWeek] += slotValue;
        }
      } else {
        // If no hourly breakdown, use total value distributed evenly
        final totalValue = _getMetricValue(day);
        final perSlot = totalValue / 6;
        for (int slot = 0; slot < 6; slot++) {
          grid[slot][dayOfWeek] += perSlot;
        }
      }
    }
    
    return grid;
  }

  double _getMetricValue(Map<String, dynamic> day) {
    switch (selectedMetric) {
      case 'views':
        return (day['totalViews'] as num?)?.toDouble() ?? 0;
      case 'orders':
        return (day['totalOrders'] as num?)?.toDouble() ?? 0;
      case 'revenue':
        return (day['totalRevenue'] as num?)?.toDouble() ?? 0;
      case 'cartAdds':
        return (day['totalCartAdds'] as num?)?.toDouble() ?? 0;
      default:
        return 0;
    }
  }

  double _getMaxValue(List<List<double>> grid) {
    double max = 0;
    for (final row in grid) {
      for (final value in row) {
        if (value > max) max = value;
      }
    }
    return max;
  }

  String _formatValue(double value) {
    if (selectedMetric == 'revenue') {
      return '₹${value.toStringAsFixed(0)}';
    }
    return value.toStringAsFixed(0);
  }

  String _formatShortValue(double value) {
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}k';
    }
    return value.toStringAsFixed(0);
  }
}
