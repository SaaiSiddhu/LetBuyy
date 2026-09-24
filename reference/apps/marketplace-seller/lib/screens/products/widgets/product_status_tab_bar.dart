// lib/screens/products/widgets/product_status_tab_bar.dart
// Professional Product Status Tabs with Color-Coded Count Badges

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Product status for tabs
enum ProductStatusTab {
  all('All', null, Colors.grey),
  active('Active', 'active', Color(0xFF4CAF50)), // Green
  inactive('Inactive', 'inactive', Color(0xFF9E9E9E)), // Grey
  pending('Pending', 'pending', Color(0xFFFF9800)), // Amber
  approved('Approved', 'approved', Color(0xFF2196F3)), // Blue
  rejected('Rejected', 'rejected', Color(0xFFE53935)); // Red

  final String label;
  final String? status;
  final Color color;
  const ProductStatusTab(this.label, this.status, this.color);
}

/// Tab counts model for products
class ProductTabCounts {
  final int all;
  final int active;
  final int inactive;
  final int pending;
  final int approved;
  final int rejected;

  const ProductTabCounts({
    this.all = 0,
    this.active = 0,
    this.inactive = 0,
    this.pending = 0,
    this.approved = 0,
    this.rejected = 0,
  });

  int getCount(ProductStatusTab tab) {
    switch (tab) {
      case ProductStatusTab.all:
        return all;
      case ProductStatusTab.active:
        return active;
      case ProductStatusTab.inactive:
        return inactive;
      case ProductStatusTab.pending:
        return pending;
      case ProductStatusTab.approved:
        return approved;
      case ProductStatusTab.rejected:
        return rejected;
    }
  }
}

/// Returns Tab Widget for TabController integration
class ProductStatusTabBar extends StatelessWidget {
  final TabController tabController;
  final bool isDark;
  final ProductTabCounts counts;
  final int lowStockCount;

  const ProductStatusTabBar({
    super.key,
    required this.tabController,
    required this.isDark,
    required this.counts,
    this.lowStockCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      width: double.infinity,
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08),
      ),
      child: TabBar(
        controller: tabController,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        padding: const EdgeInsets.symmetric(horizontal: 12),
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
          _buildTab('Active', counts.active, const Color(0xFF4CAF50), false),
          _buildTab('Inactive', counts.inactive, const Color(0xFF9E9E9E), false),
          _buildTab('Pending', counts.pending, const Color(0xFFFF9800), counts.pending > 0),
          _buildTab('Approved', counts.approved, const Color(0xFF2196F3), false),
          _buildTab('Rejected', counts.rejected, const Color(0xFFE53935), counts.rejected > 0),
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
