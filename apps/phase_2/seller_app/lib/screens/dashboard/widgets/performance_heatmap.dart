// ============================================================
// PERFORMANCE HEATMAP WIDGET
// 📊 Premium Glassmorphic Analytics Dashboard
// ✨ Professional Design with AppColors Theme
// ============================================================

import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_seller/providers/seller_provider.dart';

/// Performance Heatmap - Premium Analytics Dashboard
class PerformanceHeatmap extends StatefulWidget {
  const PerformanceHeatmap({super.key});

  @override
  State<PerformanceHeatmap> createState() => _PerformanceHeatmapState();
}

class _PerformanceHeatmapState extends State<PerformanceHeatmap> {
  String _selectedPeriod = 'week';
  String _selectedMetric = 'views';
  bool _isLoading = true;
  List<Map<String, dynamic>> _dailyData = [];
  Map<String, dynamic>? _realtimeData;
  String? _errorMessage;

  static const List<String> _timeSlots = ['12-4AM', '4-8AM', '8-12PM', '12-4PM', '4-8PM', '8-12AM'];
  static const List<String> _dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  void initState() {
    super.initState();
    _loadAnalyticsData();
  }

  Future<void> _loadAnalyticsData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId ?? 
                       FirebaseAuth.instance.currentUser?.uid;
      
      if (sellerId == null) {
        setState(() {
          _errorMessage = 'No seller ID found';
          _isLoading = false;
        });
        return;
      }

      final endDate = DateTime.now();
      final startDate = _selectedPeriod == 'week' 
          ? endDate.subtract(const Duration(days: 7))
          : endDate.subtract(const Duration(days: 30));

      final startDateStr = _formatDate(startDate);
      final endDateStr = _formatDate(endDate);

      final dailySnapshot = await FirebaseFirestore.instance
          .collection('seller_analytics')
          .doc('aggregates')
          .collection('daily')
          .where('sellerId', isEqualTo: sellerId)
          .where('date', isGreaterThanOrEqualTo: startDateStr)
          .where('date', isLessThanOrEqualTo: endDateStr)
          .orderBy('date', descending: false)
          .get();

      DocumentSnapshot<Map<String, dynamic>>? realtimeDoc;
      try {
        realtimeDoc = await FirebaseFirestore.instance
            .collection('seller_analytics')
            .doc('realtime')
            .collection('sellers')
            .doc(sellerId)
            .get();
      } catch (_) {}

      setState(() {
        _dailyData = dailySnapshot.docs.map((doc) => doc.data()).toList();
        _realtimeData = realtimeDoc?.data();
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('❌ Error loading analytics: $e');
      setState(() {
        _errorMessage = 'Failed to load analytics';
        _isLoading = false;
      });
    }
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark 
                  ? [AppColors.surfaceDark.withValues(alpha: 0.9), AppColors.surfaceDarkVariant.withValues(alpha: 0.7)]
                  : [AppColors.surface.withValues(alpha: 0.95), AppColors.surfaceVariant.withValues(alpha: 0.9)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark 
                  ? AppColors.primary.withValues(alpha: 0.2) 
                  : AppColors.border.withValues(alpha: 0.3),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: isDark 
                    ? Colors.black.withValues(alpha: 0.3) 
                    : AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(isDark),
              if (_isLoading)
                _buildLoadingState(isDark)
              else if (_errorMessage != null)
                _buildErrorState(isDark)
              else if (_dailyData.isEmpty)
                _buildEmptyState(isDark)
              else
                _buildContent(isDark),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).scale(
      begin: const Offset(0.97, 0.97),
      end: const Offset(1, 1),
      duration: 400.ms,
      curve: Curves.easeOutCubic,
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.15),
          ),
        ),
      ),
      child: Row(
        children: [
          // Icon with gradient background
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primary.withValues(alpha: 0.7)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(Icons.grid_view_rounded, color: Colors.white, size: 20),
          ),
          
          const SizedBox(width: 14),
          
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Traffic Heatmap',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'View patterns by day & time',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? AppColors.textLight.withValues(alpha: 0.6) : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          
          // Period selector chip
          _buildSelectorChip(
            value: _selectedPeriod,
            items: {'week': '7D', 'month': '30D'},
            onChanged: (v) {
              setState(() => _selectedPeriod = v);
              _loadAnalyticsData();
            },
            isDark: isDark,
          ),
          
          const SizedBox(width: 8),
          
          // Metric selector chip
          _buildSelectorChip(
            value: _selectedMetric,
            items: {'views': '👁️', 'orders': '📦', 'revenue': '💰'},
            onChanged: (v) => setState(() => _selectedMetric = v),
            isDark: isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildSelectorChip({
    required String value,
    required Map<String, String> items,
    required ValueChanged<String> onChanged,
    required bool isDark,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.08) : AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.1) : AppColors.primary.withValues(alpha: 0.15),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: items.entries.map((e) {
          final isSelected = e.key == value;
          return GestureDetector(
            onTap: () => onChanged(e.key),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected 
                    ? (isDark ? AppColors.primary : AppColors.primary)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                e.value,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected 
                      ? Colors.white 
                      : (isDark ? AppColors.textLight.withValues(alpha: 0.7) : AppColors.textSecondary),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Center(
        child: Column(
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Loading analytics...',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textLight.withValues(alpha: 0.5) : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(30),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.error_outline_rounded, size: 32, color: AppColors.error),
            ),
            const SizedBox(height: 12),
            Text(
              _errorMessage ?? 'Error loading data',
              style: TextStyle(fontSize: 13, color: isDark ? AppColors.textLight : AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: _loadAnalyticsData,
              icon: Icon(Icons.refresh_rounded, size: 18, color: AppColors.primary),
              label: Text('Retry', style: TextStyle(color: AppColors.primary)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.15),
                    AppColors.primary.withValues(alpha: 0.05),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                Icons.insights_rounded,
                size: 40,
                color: AppColors.primary.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No traffic data yet',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Data appears as customers view your products',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textLight.withValues(alpha: 0.5) : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(bool isDark) {
    final gridData = _processDataToGrid();
    final maxValue = _getMaxValue(gridData);
    final insights = _calculateInsights();
    final detailedInsights = _calculateDetailedInsights();
    final hourlyData = _getHourlyData();

    return Column(
      children: [
        // Heatmap Grid
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            children: [
              // Day labels
              Padding(
                padding: const EdgeInsets.only(left: 50),
                child: Row(
                  children: _dayLabels.map((day) => Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: isDark ? AppColors.textLight.withValues(alpha: 0.5) : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  )).toList(),
                ),
              ),
              
              const SizedBox(height: 6),
              
              // Grid rows
              ...List.generate(6, (slotIndex) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 50,
                        child: Text(
                          _timeSlots[slotIndex],
                          style: TextStyle(
                            fontSize: 9,
                            color: isDark ? AppColors.textLight.withValues(alpha: 0.4) : AppColors.textSecondary.withValues(alpha: 0.8),
                          ),
                        ),
                      ),
                      ...List.generate(7, (dayIndex) {
                        final value = gridData[slotIndex][dayIndex];
                        final intensity = maxValue > 0 ? value / maxValue : 0.0;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 1.5),
                            child: _buildGridCell(value, intensity, isDark),
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
          ),
        ),
        
        // Divider
        Container(
          height: 1,
          margin: const EdgeInsets.symmetric(horizontal: 16),
          color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.15),
        ),
        
        // Quick Stats Row
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              _buildQuickStat('🔥 Peak', insights['peakTime'] ?? '--', isDark),
              _buildDivider(isDark),
              _buildQuickStat('📈 Best', insights['bestDay'] ?? '--', isDark),
              _buildDivider(isDark),
              _buildQuickStat('📊 Avg', insights['avgViews'] ?? '--', isDark),
            ],
          ),
        ),
        
        // ===== NEW: Quick Insights Cards =====
        Container(
          height: 1,
          margin: const EdgeInsets.symmetric(horizontal: 16),
          color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.15),
        ),
        
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.lightbulb_outline, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    'Quick Insights',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // First row
              Row(
                children: [
                  Expanded(child: _buildInsightCard(
                    Icons.local_fire_department,
                    const Color(0xFFEF4444),
                    'Peak Hour',
                    detailedInsights['peakHour'] ?? '--',
                    detailedInsights['peakHourViews'] ?? '',
                    isDark,
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _buildInsightCard(
                    Icons.calendar_today,
                    const Color(0xFF3B82F6),
                    'Best Day',
                    detailedInsights['bestDay'] ?? '--',
                    detailedInsights['bestDayViews'] ?? '',
                    isDark,
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _buildInsightCard(
                    Icons.trending_up,
                    const Color(0xFF22C55E),
                    'Conversion',
                    detailedInsights['conversionRate'] ?? '0%',
                    '',
                    isDark,
                  )),
                ],
              ),
              const SizedBox(height: 8),
              // Second row
              Row(
                children: [
                  Expanded(child: _buildInsightCard(
                    Icons.search,
                    const Color(0xFF8B5CF6),
                    'Top Source',
                    detailedInsights['topSource'] ?? '--',
                    detailedInsights['topSourcePercent'] ?? '',
                    isDark,
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _buildInsightCard(
                    Icons.campaign,
                    const Color(0xFFF97316),
                    'Ads Views',
                    detailedInsights['adsViews'] ?? '0',
                    detailedInsights['adsPercent'] ?? '',
                    isDark,
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _buildInsightCard(
                    Icons.shopping_bag,
                    const Color(0xFF06B6D4),
                    'Orders',
                    detailedInsights['totalOrders'] ?? '0',
                    detailedInsights['ordersRevenue'] ?? '',
                    isDark,
                  )),
                ],
              ),
            ],
          ),
        ),
        
        // ===== NEW: Today's Hourly Trend =====
        if (hourlyData.any((v) => v > 0)) ...[
          Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.15),
          ),
          
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.show_chart, size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text(
                      "Today's Hourly Trend",
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Now: ${DateTime.now().hour.toString().padLeft(2, '0')}:00',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Hourly bars
                SizedBox(
                  height: 60,
                  child: _buildHourlyBars(hourlyData, isDark),
                ),
                const SizedBox(height: 8),
                // X-axis labels
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('12AM', style: TextStyle(fontSize: 9, color: isDark ? Colors.white38 : Colors.grey[400])),
                    Text('6AM', style: TextStyle(fontSize: 9, color: isDark ? Colors.white38 : Colors.grey[400])),
                    Text('12PM', style: TextStyle(fontSize: 9, color: isDark ? Colors.white38 : Colors.grey[400])),
                    Text('6PM', style: TextStyle(fontSize: 9, color: isDark ? Colors.white38 : Colors.grey[400])),
                    Text('Now', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // Insight Card Widget
  Widget _buildInsightCard(IconData icon, Color color, String title, String value, String subtitle, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Icon(icon, size: 12, color: color),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 9,
                    color: isDark ? Colors.white60 : Colors.grey.shade600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 9,
                color: subtitle.startsWith('+') ? const Color(0xFF22C55E) : (isDark ? Colors.white38 : Colors.grey.shade500),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // Hourly bars visualization
  Widget _buildHourlyBars(List<double> data, bool isDark) {
    final maxVal = data.reduce((a, b) => a > b ? a : b);
    final currentHour = DateTime.now().hour;
    
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(24, (i) {
        final value = data[i];
        final height = maxVal > 0 ? (value / maxVal) * 50 : 0.0;
        final isCurrent = i == currentHour;
        
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 0.5),
            child: Container(
              height: height.clamp(2.0, 50.0),
              decoration: BoxDecoration(
                color: isCurrent 
                    ? AppColors.primary 
                    : (value > 0 
                        ? AppColors.primary.withValues(alpha: 0.4) 
                        : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200)),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        );
      }),
    );
  }

  // Get hourly data for today
  List<double> _getHourlyData() {
    final hourlyData = List.filled(24, 0.0);
    final today = DateTime.now();
    final todayStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    
    for (final day in _dailyData) {
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
    
    // Use realtime data if available
    if (_realtimeData != null && hourlyData.every((v) => v == 0)) {
      final todayViews = (_realtimeData!['todayViews'] as num?)?.toDouble() ?? 0;
      if (todayViews > 0) {
        hourlyData[DateTime.now().hour] = todayViews;
      }
    }
    
    return hourlyData;
  }

  // Calculate detailed insights for cards
  Map<String, String> _calculateDetailedInsights() {
    if (_dailyData.isEmpty) return {};

    int totalViews = 0;
    int totalOrders = 0;
    double totalRevenue = 0;
    
    Map<String, int> dayViews = {};
    Map<int, int> hourViews = {};
    Map<String, int> sourceViews = {'organic': 0, 'search': 0, 'category': 0, 'ads': 0};

    for (final day in _dailyData) {
      totalViews += (day['totalViews'] as num?)?.toInt() ?? 0;
      totalOrders += (day['totalOrders'] as num?)?.toInt() ?? 0;
      totalRevenue += (day['totalRevenue'] as num?)?.toDouble() ?? 0;
      
      final dayOfWeek = (day['dayOfWeek'] as num?)?.toInt() ?? 0;
      final dayName = _getDayName(dayOfWeek);
      dayViews[dayName] = (dayViews[dayName] ?? 0) + ((day['totalViews'] as num?)?.toInt() ?? 0);
      
      final hourlyBreakdown = day['hourlyBreakdown'] as List<dynamic>?;
      if (hourlyBreakdown != null) {
        for (int h = 0; h < hourlyBreakdown.length; h++) {
          hourViews[h] = (hourViews[h] ?? 0) + ((hourlyBreakdown[h] as num?)?.toInt() ?? 0);
        }
      }
      
      final sourceBreakdown = day['sourceBreakdown'] as Map<String, dynamic>?;
      if (sourceBreakdown != null) {
        sourceViews['organic'] = (sourceViews['organic'] ?? 0) + ((sourceBreakdown['organic'] as num?)?.toInt() ?? 0);
        sourceViews['search'] = (sourceViews['search'] ?? 0) + ((sourceBreakdown['search'] as num?)?.toInt() ?? 0);
        sourceViews['category'] = (sourceViews['category'] ?? 0) + ((sourceBreakdown['category'] as num?)?.toInt() ?? 0);
        sourceViews['ads'] = (sourceViews['ads'] ?? 0) + ((sourceBreakdown['ads'] as num?)?.toInt() ?? 0);
      }
    }

    // Peak hour
    String peakHour = '--';
    int peakHourViews = 0;
    hourViews.forEach((hour, views) {
      if (views > peakHourViews) {
        peakHourViews = views;
        peakHour = '${hour.toString().padLeft(2, '0')}:00';
      }
    });

    // Best day
    String bestDay = '--';
    int bestDayViews = 0;
    dayViews.forEach((day, views) {
      if (views > bestDayViews) {
        bestDayViews = views;
        bestDay = day;
      }
    });

    // Top source
    String topSource = '--';
    int topSourceViews = 0;
    sourceViews.forEach((source, views) {
      if (views > topSourceViews) {
        topSourceViews = views;
        topSource = _formatSourceName(source);
      }
    });

    final conversionRate = totalViews > 0 
        ? '${((totalOrders / totalViews) * 100).toStringAsFixed(1)}%'
        : '0%';

    final adsViews = sourceViews['ads'] ?? 0;

    return {
      'peakHour': peakHour,
      'peakHourViews': peakHourViews > 0 ? '+$peakHourViews views' : '',
      'bestDay': bestDay,
      'bestDayViews': bestDayViews > 0 ? '+$bestDayViews views' : '',
      'conversionRate': conversionRate,
      'topSource': topSource,
      'topSourcePercent': totalViews > 0 ? '${((topSourceViews / totalViews) * 100).toStringAsFixed(0)}%' : '',
      'adsViews': adsViews.toString(),
      'adsPercent': totalViews > 0 ? '${((adsViews / totalViews) * 100).toStringAsFixed(0)}% of traffic' : '',
      'totalOrders': totalOrders.toString(),
      'ordersRevenue': totalRevenue > 0 ? '₹${totalRevenue.toStringAsFixed(0)}' : '',
    };
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

  Widget _buildGridCell(double value, double intensity, bool isDark) {
    final color = _getIntensityColor(intensity, isDark);
    return Container(
      height: 24,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
      child: value > 0 ? Center(
        child: Text(
          value >= 1000 ? '${(value / 1000).toStringAsFixed(1)}k' : value.toStringAsFixed(0),
          style: TextStyle(
            fontSize: 8,
            fontWeight: FontWeight.w600,
            color: intensity > 0.4 ? Colors.white : (isDark ? Colors.white70 : Colors.black54),
          ),
        ),
      ) : null,
    );
  }

  Color _getIntensityColor(double intensity, bool isDark) {
    if (intensity <= 0) return isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade200;
    if (intensity < 0.25) return AppColors.success.withValues(alpha: 0.5);
    if (intensity < 0.50) return AppColors.warning.withValues(alpha: 0.6);
    if (intensity < 0.75) return Color.lerp(AppColors.warning, AppColors.error, 0.5)!.withValues(alpha: 0.7);
    return AppColors.error.withValues(alpha: 0.85);
  }

  Widget _buildLegend(bool isDark) {
    final colors = [
      (AppColors.success.withValues(alpha: 0.5), 'Low'),
      (AppColors.warning.withValues(alpha: 0.6), 'Med'),
      (AppColors.error.withValues(alpha: 0.85), 'High'),
    ];
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Activity: ',
          style: TextStyle(fontSize: 10, color: isDark ? AppColors.textLight.withValues(alpha: 0.4) : AppColors.textSecondary),
        ),
        ...colors.map((c) => Row(
          children: [
            Container(
              width: 12,
              height: 10,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: c.$1,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              c.$2,
              style: TextStyle(fontSize: 9, color: isDark ? AppColors.textLight.withValues(alpha: 0.5) : AppColors.textSecondary),
            ),
          ],
        )),
      ],
    );
  }

  Widget _buildQuickStat(String label, String value, bool isDark) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: isDark ? AppColors.textLight.withValues(alpha: 0.5) : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider(bool isDark) {
    return Container(
      width: 1,
      height: 28,
      color: isDark ? AppColors.border.withValues(alpha: 0.1) : AppColors.border.withValues(alpha: 0.2),
    );
  }

  List<List<double>> _processDataToGrid() {
    final grid = List.generate(6, (_) => List.filled(7, 0.0));
    
    for (final day in _dailyData) {
      final dateStr = day['date'] as String?;
      if (dateStr == null) continue;
      
      final date = DateTime.tryParse(dateStr);
      if (date == null) continue;
      
      final dayOfWeek = (date.weekday - 1) % 7;
      final hourlyBreakdown = day['hourlyBreakdown'] as List<dynamic>?;
      
      if (hourlyBreakdown != null && hourlyBreakdown.length >= 24) {
        for (int slot = 0; slot < 6; slot++) {
          double slotValue = 0;
          for (int h = slot * 4; h < (slot + 1) * 4 && h < 24; h++) {
            slotValue += (hourlyBreakdown[h] as num?)?.toDouble() ?? 0;
          }
          grid[slot][dayOfWeek] += slotValue;
        }
      } else {
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
    switch (_selectedMetric) {
      case 'views': return (day['totalViews'] as num?)?.toDouble() ?? 0;
      case 'orders': return (day['totalOrders'] as num?)?.toDouble() ?? 0;
      case 'revenue': return (day['totalRevenue'] as num?)?.toDouble() ?? 0;
      default: return 0;
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

  Map<String, String> _calculateInsights() {
    if (_dailyData.isEmpty) return {};

    int totalViews = 0;
    Map<String, int> dayViews = {};
    Map<int, int> hourViews = {};

    for (final day in _dailyData) {
      totalViews += (day['totalViews'] as num?)?.toInt() ?? 0;
      final dayOfWeek = (day['dayOfWeek'] as num?)?.toInt() ?? 0;
      final dayName = _getDayName(dayOfWeek);
      dayViews[dayName] = (dayViews[dayName] ?? 0) + ((day['totalViews'] as num?)?.toInt() ?? 0);
      
      final hourlyBreakdown = day['hourlyBreakdown'] as List<dynamic>?;
      if (hourlyBreakdown != null) {
        for (int h = 0; h < hourlyBreakdown.length; h++) {
          hourViews[h] = (hourViews[h] ?? 0) + ((hourlyBreakdown[h] as num?)?.toInt() ?? 0);
        }
      }
    }

    String peakTime = '--';
    int peakViews = 0;
    hourViews.forEach((hour, views) {
      if (views > peakViews) {
        peakViews = views;
        peakTime = '$hour:00';
      }
    });

    String bestDay = '--';
    int bestDayViews = 0;
    dayViews.forEach((day, views) {
      if (views > bestDayViews) {
        bestDayViews = views;
        bestDay = day;
      }
    });

    final avgViews = _dailyData.isNotEmpty ? (totalViews / _dailyData.length).round() : 0;

    return {
      'peakTime': peakTime,
      'bestDay': bestDay,
      'avgViews': '$avgViews/day',
    };
  }

  String _getDayName(int dayOfWeek) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek % 7];
  }
}
