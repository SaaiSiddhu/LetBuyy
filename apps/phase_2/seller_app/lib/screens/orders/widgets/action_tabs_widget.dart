// lib/screens/orders/widgets/action_tabs_widget.dart
// Professional Order Status Tabs with Color-Coded Count Badges

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Order status for tabs
enum OrderStatusTab {
  all('All', null, Colors.grey),
  pending('Pending', 'pending', Color(0xFFFF9800)), // Amber
  processing('Processing', 'processing', Color(0xFF2196F3)), // Blue
  shipped('Shipped', 'shipped', Color(0xFF9C27B0)), // Purple
  delivered('Delivered', 'delivered', Color(0xFF4CAF50)), // Green
  cancelled('Cancelled', 'cancelled', Color(0xFFE53935)), // Red
  rto('RTO', 'rto', Color(0xFFE91E63)); // Pink

  final String label;
  final String? status;
  final Color color;
  const OrderStatusTab(this.label, this.status, this.color);
}

/// Tab counts model
class TabCounts {
  final int all;
  final int pending;
  final int processing;
  final int shipped;
  final int delivered;
  final int cancelled;
  final int rto;

  const TabCounts({
    this.all = 0,
    this.pending = 0,
    this.processing = 0,
    this.shipped = 0,
    this.delivered = 0,
    this.cancelled = 0,
    this.rto = 0,
  });

  int getCount(OrderStatusTab tab) {
    switch (tab) {
      case OrderStatusTab.all:
        return all;
      case OrderStatusTab.pending:
        return pending;
      case OrderStatusTab.processing:
        return processing;
      case OrderStatusTab.shipped:
        return shipped;
      case OrderStatusTab.delivered:
        return delivered;
      case OrderStatusTab.cancelled:
        return cancelled;
      case OrderStatusTab.rto:
        return rto;
    }
  }
}

/// Professional Action Tabs Widget
class ActionTabsWidget extends StatelessWidget {
  final bool isDark;
  final OrderStatusTab selectedTab;
  final TabCounts counts;
  final Function(OrderStatusTab) onTabSelected;
  final int overdueCount;

  const ActionTabsWidget({
    super.key,
    required this.isDark,
    required this.selectedTab,
    required this.counts,
    required this.onTabSelected,
    this.overdueCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        physics: const BouncingScrollPhysics(),
        child: Row(
          children: OrderStatusTab.values.map((tab) {
            final isSelected = tab == selectedTab;
            final count = counts.getCount(tab);
            final hasOverdue = tab == OrderStatusTab.pending && overdueCount > 0;

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: _buildTabChip(
                tab: tab,
                count: count,
                isSelected: isSelected,
                hasOverdue: hasOverdue,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildTabChip({
    required OrderStatusTab tab,
    required int count,
    required bool isSelected,
    bool hasOverdue = false,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTabSelected(tab);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? Colors.white.withValues(alpha: 0.12) : Colors.white)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected && !isDark
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Color indicator dot
            if (tab != OrderStatusTab.all) ...[
              _buildStatusDot(tab, isSelected, hasOverdue),
              const SizedBox(width: 6),
            ],
            
            // Tab label
            Text(
              tab.label,
              style: TextStyle(
                color: isSelected
                    ? (isDark ? Colors.white : tab.color)
                    : (isDark ? Colors.grey[400] : Colors.grey[700]),
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            
            // Count badge
            if (count > 0) ...[
              const SizedBox(width: 6),
              _buildCountBadge(count, tab, isSelected),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusDot(OrderStatusTab tab, bool isSelected, bool hasOverdue) {
    Widget dot = Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: isSelected ? tab.color : tab.color.withValues(alpha: 0.5),
        shape: BoxShape.circle,
      ),
    );

    // Pulse animation for pending with overdue orders
    if (hasOverdue) {
      return Stack(
        clipBehavior: Clip.none,
        children: [
          dot.animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(begin: const Offset(1, 1), end: const Offset(1.3, 1.3), duration: 600.ms)
              .then()
              .scale(begin: const Offset(1.3, 1.3), end: const Offset(1, 1), duration: 600.ms),
          Positioned(
            right: -3,
            top: -3,
            child: Container(
              width: 5,
              height: 5,
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ],
      );
    }

    return dot;
  }

  Widget _buildCountBadge(int count, OrderStatusTab tab, bool isSelected) {
    // Muted badges for delivered/cancelled
    final isMuted = tab == OrderStatusTab.delivered || tab == OrderStatusTab.cancelled;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected
            ? tab.color.withValues(alpha: isMuted ? 0.1 : 0.15)
            : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.15)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: TextStyle(
          color: isSelected
              ? (isMuted ? tab.color.withValues(alpha: 0.7) : tab.color)
              : (isDark ? Colors.grey[400] : Colors.grey[600]),
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

/// Returns Tab Widget for TabController integration
class OrderStatusTabBar extends StatelessWidget {
  final TabController tabController;
  final bool isDark;
  final TabCounts counts;
  final int overdueCount;

  const OrderStatusTabBar({
    super.key,
    required this.tabController,
    required this.isDark,
    required this.counts,
    this.overdueCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      width: double.infinity, // Stretch full width
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08),
        // No borderRadius - edge to edge
      ),
      child: TabBar(
        controller: tabController,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        padding: const EdgeInsets.symmetric(horizontal: 12), // Internal content padding
        labelPadding: const EdgeInsets.symmetric(horizontal: 10),
        dividerColor: Colors.transparent,
        labelColor: isDark ? Colors.white : AppColors.primary,
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
        indicator: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.12) : Colors.white,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.all(3),
        tabs: [
          _buildTab('All', counts.all, Colors.grey, false),
          _buildTab('Pending', counts.pending, const Color(0xFFFF9800), overdueCount > 0),
          _buildTab('Process', counts.processing, const Color(0xFF2196F3), false),
          _buildTab('Shipped', counts.shipped, const Color(0xFF9C27B0), false),
          _buildTab('Done', counts.delivered, const Color(0xFF4CAF50), false),
          _buildTab('Cancel', counts.cancelled, const Color(0xFFE53935), false),
          _buildTab('RTO', counts.rto, const Color(0xFFE91E63), false),
        ],
      ),
    );
  }

  Widget _buildTab(String label, int count, Color color, bool isPulsing) {
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Color dot
          if (label != 'All') ...[
            Builder(builder: (context) {
              Widget dot = Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              );
              
              if (isPulsing) {
                return dot.animate(onPlay: (c) => c.repeat(reverse: true))
                    .scale(begin: const Offset(1, 1), end: const Offset(1.4, 1.4), duration: 600.ms);
              }
              return dot;
            }),
            const SizedBox(width: 6),
          ],
          
          Text(label),
          
          // Count
          if (count > 0) ...[
            const SizedBox(width: 4),
            Text(
              '($count)',
              style: TextStyle(
                fontSize: 11,
                color: color.withValues(alpha: 0.8),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
