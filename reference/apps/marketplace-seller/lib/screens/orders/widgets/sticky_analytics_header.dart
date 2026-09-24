// lib/screens/orders/widgets/sticky_analytics_header.dart
// Sticky Analytics Header for Order Management

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:intl/intl.dart';

/// Analytics data for the header
class OrderAnalytics {
  final int totalToday;
  final int pendingCount;
  final int overdueCount;
  final double revenueToday;
  final int processingCount;
  final int shippedCount;

  const OrderAnalytics({
    this.totalToday = 0,
    this.pendingCount = 0,
    this.overdueCount = 0,
    this.revenueToday = 0,
    this.processingCount = 0,
    this.shippedCount = 0,
  });
}

/// Sticky Analytics Header that collapses on scroll
class StickyAnalyticsHeader extends StatelessWidget {
  final OrderAnalytics analytics;
  final VoidCallback? onTapAnalytics;
  final bool isExpanded;

  const StickyAnalyticsHeader({
    super.key,
    required this.analytics,
    this.onTapAnalytics,
    this.isExpanded = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFormat = NumberFormat.currency(symbol: '₹', decimalDigits: 0);

    if (isExpanded) {
      return _buildExpandedHeader(isDark, currencyFormat);
    }
    return _buildCompactHeader(isDark, currencyFormat);
  }

  Widget _buildExpandedHeader(bool isDark, NumberFormat currencyFormat) {
    return GestureDetector(
      onTap: onTapAnalytics,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFF1E1E2E), const Color(0xFF2A2A3E)]
                : [Colors.white, Colors.grey[50]!],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
          ),
        ),
        child: Column(
          children: [
            // Header row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.analytics_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'Today\'s Overview',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.trending_up_rounded, size: 14, color: Colors.green),
                      const SizedBox(width: 4),
                      Text(
                        currencyFormat.format(analytics.revenueToday),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.green,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 16),
            
            // Stats row
            Row(
              children: [
                _buildStatItem(
                  'Orders',
                  analytics.totalToday.toString(),
                  Icons.shopping_bag_rounded,
                  AppColors.primary,
                  isDark,
                ),
                _buildStatItem(
                  'Pending',
                  analytics.pendingCount.toString(),
                  Icons.hourglass_empty_rounded,
                  Colors.orange,
                  isDark,
                ),
                _buildStatItem(
                  'Overdue',
                  analytics.overdueCount.toString(),
                  Icons.warning_rounded,
                  Colors.red,
                  isDark,
                  isHighlight: analytics.overdueCount > 0,
                ),
                _buildStatItem(
                  'Processing',
                  analytics.processingCount.toString(),
                  Icons.inventory_2_rounded,
                  Colors.blue,
                  isDark,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactHeader(bool isDark, NumberFormat currencyFormat) {
    return GestureDetector(
      onTap: onTapAnalytics,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            _buildCompactStat(
              analytics.totalToday.toString(),
              'Today',
              AppColors.primary,
            ),
            Container(
              height: 20,
              width: 1,
              color: Colors.grey.withValues(alpha: 0.3),
              margin: const EdgeInsets.symmetric(horizontal: 12),
            ),
            _buildCompactStat(
              analytics.pendingCount.toString(),
              'Pending',
              Colors.orange,
            ),
            Container(
              height: 20,
              width: 1,
              color: Colors.grey.withValues(alpha: 0.3),
              margin: const EdgeInsets.symmetric(horizontal: 12),
            ),
            if (analytics.overdueCount > 0) ...[
              _buildCompactStat(
                analytics.overdueCount.toString(),
                'Overdue',
                Colors.red,
                isAlert: true,
              ),
              Container(
                height: 20,
                width: 1,
                color: Colors.grey.withValues(alpha: 0.3),
                margin: const EdgeInsets.symmetric(horizontal: 12),
              ),
            ],
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                currencyFormat.format(analytics.revenueToday),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Colors.green,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(
    String label,
    String value,
    IconData icon,
    Color color,
    bool isDark, {
    bool isHighlight = false,
  }) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isHighlight
              ? color.withValues(alpha: 0.1)
              : (isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50]),
          borderRadius: BorderRadius.circular(12),
          border: isHighlight
              ? Border.all(color: color.withValues(alpha: 0.3))
              : null,
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isHighlight ? color : (isDark ? Colors.white : Colors.black87),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey[500],
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactStat(String value, String label, Color color, {bool isAlert = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isAlert)
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(right: 4),
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[500],
          ),
        ),
      ],
    );
  }
}

/// Sliver version of the analytics header for CustomScrollView
class SliverStickyAnalyticsHeader extends StatelessWidget {
  final OrderAnalytics analytics;
  final VoidCallback? onTapAnalytics;

  const SliverStickyAnalyticsHeader({
    super.key,
    required this.analytics,
    this.onTapAnalytics,
  });

  @override
  Widget build(BuildContext context) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _AnalyticsHeaderDelegate(
        analytics: analytics,
        onTapAnalytics: onTapAnalytics,
      ),
    );
  }
}

class _AnalyticsHeaderDelegate extends SliverPersistentHeaderDelegate {
  final OrderAnalytics analytics;
  final VoidCallback? onTapAnalytics;

  const _AnalyticsHeaderDelegate({
    required this.analytics,
    this.onTapAnalytics,
  });

  @override
  double get maxExtent => 140;

  @override
  double get minExtent => 52;

  @override
  bool shouldRebuild(covariant _AnalyticsHeaderDelegate oldDelegate) {
    return analytics != oldDelegate.analytics;
  }

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final expandRatio = 1 - (shrinkOffset / (maxExtent - minExtent)).clamp(0.0, 1.0);
    final isExpanded = expandRatio > 0.5;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: isExpanded
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: StickyAnalyticsHeader(
                analytics: analytics,
                onTapAnalytics: onTapAnalytics,
                isExpanded: true,
              ),
            )
          : StickyAnalyticsHeader(
              analytics: analytics,
              onTapAnalytics: onTapAnalytics,
              isExpanded: false,
            ),
    );
  }
}
