// ============================================================
// QUICK INSIGHTS CARDS WIDGET
// Shows key performance insights at a glance
// ============================================================

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Quick Insights - Key metrics and insights cards
class QuickInsightsCards extends StatelessWidget {
  final List<Map<String, dynamic>> dailyData;
  final Map<String, dynamic>? realtimeData;

  const QuickInsightsCards({
    super.key,
    required this.dailyData,
    this.realtimeData,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final insights = _calculateInsights();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.lightbulb_outline,
              size: 18,
              color: AppColors.primary,
            ),
            const SizedBox(width: 8),
            Text(
              'Quick Insights',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 12),
        
        // First row of cards
        Row(
          children: [
            Expanded(child: _buildInsightCard(
              context,
              icon: Icons.local_fire_department,
              iconColor: const Color(0xFFEF4444),
              title: 'Peak Hour',
              value: insights['peakHour'] ?? '--',
              subtitle: insights['peakHourChange'] ?? '',
              isDark: isDark,
            )),
            const SizedBox(width: 12),
            Expanded(child: _buildInsightCard(
              context,
              icon: Icons.calendar_today,
              iconColor: const Color(0xFF3B82F6),
              title: 'Best Day',
              value: insights['bestDay'] ?? '--',
              subtitle: insights['bestDayChange'] ?? '',
              isDark: isDark,
            )),
            const SizedBox(width: 12),
            Expanded(child: _buildInsightCard(
              context,
              icon: Icons.trending_up,
              iconColor: const Color(0xFF22C55E),
              title: 'Conversion',
              value: insights['conversionRate'] ?? '0%',
              subtitle: insights['conversionChange'] ?? '',
              isDark: isDark,
            )),
          ],
        ),
        
        const SizedBox(height: 12),
        
        // Second row of cards
        Row(
          children: [
            Expanded(child: _buildInsightCard(
              context,
              icon: Icons.search,
              iconColor: const Color(0xFF8B5CF6),
              title: 'Top Source',
              value: insights['topSource'] ?? '--',
              subtitle: insights['topSourcePercent'] ?? '',
              isDark: isDark,
            )),
            const SizedBox(width: 12),
            Expanded(child: _buildInsightCard(
              context,
              icon: Icons.campaign,
              iconColor: const Color(0xFFF97316),
              title: 'Ads ROI',
              value: insights['adsRoi'] ?? '--',
              subtitle: insights['adsRoiChange'] ?? '',
              isDark: isDark,
            )),
            const SizedBox(width: 12),
            Expanded(child: _buildInsightCard(
              context,
              icon: Icons.shopping_bag,
              iconColor: const Color(0xFF06B6D4),
              title: 'Orders',
              value: insights['totalOrders'] ?? '0',
              subtitle: insights['ordersChange'] ?? '',
              isDark: isDark,
            )),
          ],
        ),
      ],
    );
  }

  Widget _buildInsightCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
    required String subtitle,
    required bool isDark,
  }) {
    final isPositiveChange = subtitle.startsWith('+') || subtitle.contains('↑');
    final isNegativeChange = subtitle.startsWith('-') || subtitle.contains('↓');
    
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 14, color: iconColor),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white60 : Colors.grey.shade600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: isPositiveChange
                    ? const Color(0xFF22C55E)
                    : isNegativeChange
                        ? const Color(0xFFEF4444)
                        : (isDark ? Colors.white38 : Colors.grey.shade500),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Map<String, String> _calculateInsights() {
    if (dailyData.isEmpty) {
      return {};
    }

    // Calculate totals
    int totalViews = 0;
    int totalOrders = 0;
    double totalRevenue = 0;
    
    Map<String, int> dayViews = {};
    Map<int, int> hourViews = {};
    Map<String, int> sourceViews = {
      'organic': 0,
      'search': 0,
      'category': 0,
      'ads': 0,
    };
    int adViews = 0;
    int adOrders = 0;

    for (final day in dailyData) {
      totalViews += (day['totalViews'] as num?)?.toInt() ?? 0;
      totalOrders += (day['totalOrders'] as num?)?.toInt() ?? 0;
      totalRevenue += (day['totalRevenue'] as num?)?.toDouble() ?? 0;
      
      // Track by day of week
      final dayOfWeek = (day['dayOfWeek'] as num?)?.toInt() ?? 0;
      final dayName = _getDayName(dayOfWeek);
      dayViews[dayName] = (dayViews[dayName] ?? 0) + ((day['totalViews'] as num?)?.toInt() ?? 0);
      
      // Track by hour
      final hourlyBreakdown = day['hourlyBreakdown'] as List<dynamic>?;
      if (hourlyBreakdown != null) {
        for (int h = 0; h < hourlyBreakdown.length; h++) {
          hourViews[h] = (hourViews[h] ?? 0) + ((hourlyBreakdown[h] as num?)?.toInt() ?? 0);
        }
      }
      
      // Track by source
      final sourceBreakdown = day['sourceBreakdown'] as Map<String, dynamic>?;
      if (sourceBreakdown != null) {
        sourceViews['organic'] = (sourceViews['organic'] ?? 0) + ((sourceBreakdown['organic'] as num?)?.toInt() ?? 0);
        sourceViews['search'] = (sourceViews['search'] ?? 0) + ((sourceBreakdown['search'] as num?)?.toInt() ?? 0);
        sourceViews['category'] = (sourceViews['category'] ?? 0) + ((sourceBreakdown['category'] as num?)?.toInt() ?? 0);
        sourceViews['ads'] = (sourceViews['ads'] ?? 0) + ((sourceBreakdown['ads'] as num?)?.toInt() ?? 0);
      }
    }

    // Find peak hour
    String peakHour = '--';
    int peakHourViews = 0;
    hourViews.forEach((hour, views) {
      if (views > peakHourViews) {
        peakHourViews = views;
        peakHour = '${hour.toString().padLeft(2, '0')}:00-${((hour + 1) % 24).toString().padLeft(2, '0')}:00';
      }
    });

    // Find best day
    String bestDay = '--';
    int bestDayViews = 0;
    dayViews.forEach((day, views) {
      if (views > bestDayViews) {
        bestDayViews = views;
        bestDay = day;
      }
    });

    // Find top source
    String topSource = '--';
    int topSourceViews = 0;
    sourceViews.forEach((source, views) {
      if (views > topSourceViews) {
        topSourceViews = views;
        topSource = _formatSourceName(source);
      }
    });
    
    final topSourcePercent = totalViews > 0 
        ? '${((topSourceViews / totalViews) * 100).toStringAsFixed(0)}% traffic'
        : '';

    // Calculate conversion rate
    final conversionRate = totalViews > 0 
        ? '${((totalOrders / totalViews) * 100).toStringAsFixed(1)}%'
        : '0%';

    // Calculate Ads ROI (rough: ad orders / ad views)
    adViews = sourceViews['ads'] ?? 0;
    String adsRoi = '--';
    if (adViews > 0) {
      // This is simplified - in real app you'd track ad-attributed orders
      adsRoi = '${(adViews * 0.02).toStringAsFixed(1)}x';
    }

    return {
      'peakHour': peakHour,
      'peakHourChange': peakHourViews > 0 ? '+$peakHourViews views' : '',
      'bestDay': bestDay,
      'bestDayChange': bestDayViews > 0 ? '+$bestDayViews views' : '',
      'conversionRate': conversionRate,
      'conversionChange': '',
      'topSource': topSource,
      'topSourcePercent': topSourcePercent,
      'adsRoi': adsRoi,
      'adsRoiChange': adViews > 0 ? 'from ads' : 'no ads',
      'totalOrders': totalOrders.toString(),
      'ordersChange': totalRevenue > 0 ? '₹${totalRevenue.toStringAsFixed(0)}' : '',
    };
  }

  String _getDayName(int dayOfWeek) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek % 7];
  }

  String _formatSourceName(String source) {
    switch (source) {
      case 'organic': return 'Organic';
      case 'search': return 'Search';
      case 'category': return 'Category';
      case 'ads': return 'Ads';
      default: return source;
    }
  }
}
