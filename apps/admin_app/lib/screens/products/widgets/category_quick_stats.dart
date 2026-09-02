// lib/screens/products/widgets/category_quick_stats.dart
// Premium stats header for category management screen

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class CategoryQuickStats extends StatelessWidget {
  final int totalCategories;
  final int activeCategories;
  final int totalProducts;
  final bool isDark;

  const CategoryQuickStats({
    super.key,
    required this.totalCategories,
    required this.activeCategories,
    required this.totalProducts,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final inactiveCount = totalCategories - activeCategories;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Use actual container width, not screen width
        final isNarrow = constraints.maxWidth < 400;

        return Container(
          padding: EdgeInsets.all(isNarrow ? 12 : 16),
          margin: EdgeInsets.all(isNarrow ? 8 : 12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [
                      AppColors.primary.withValues(alpha: 0.15),
                      AppColors.primaryLight.withValues(alpha: 0.05),
                    ]
                  : [
                      AppColors.primary.withValues(alpha: 0.08),
                      AppColors.primaryLight.withValues(alpha: 0.02),
                    ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? AppColors.primary.withValues(alpha: 0.3)
                  : AppColors.primary.withValues(alpha: 0.15),
            ),
          ),
          child: isNarrow ? _buildMobileLayout(inactiveCount) : _buildDesktopLayout(inactiveCount),
        );
      },
    );
  }

  Widget _buildMobileLayout(int inactiveCount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        _buildCompactStat('Total', totalCategories, Icons.category_rounded, AppColors.primary),
        _buildCompactStat('Active', activeCategories, Icons.check_circle_rounded, AppColors.success),
        _buildCompactStat('Products', totalProducts, Icons.inventory_rounded, AppColors.info),
      ],
    );
  }

  Widget _buildDesktopLayout(int inactiveCount) {
    // Use 2 rows of 2 cards for better fit in narrow panels
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildStatCard('Total', totalCategories, Icons.category_rounded, AppColors.primary)),
            const SizedBox(width: 12),
            Expanded(child: _buildStatCard('Active', activeCategories, Icons.check_circle_rounded, AppColors.success)),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _buildStatCard('Inactive', inactiveCount, Icons.pause_circle_rounded, AppColors.warning)),
            const SizedBox(width: 12),
            Expanded(child: _buildStatCard('Products', totalProducts, Icons.inventory_rounded, AppColors.info)),
          ],
        ),
      ],
    );
  }

  Widget _buildCompactStat(String label, int value, IconData icon, Color color) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(height: 6),
        Text(
          '$value',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
          ),
        ),
      ],
    ).animate().fadeIn(delay: 100.ms).scale(begin: const Offset(0.8, 0.8));
  }

  Widget _buildStatCard(String label, int value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark 
            ? Colors.white.withValues(alpha: 0.05) 
            : Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.grey.shade200,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$value',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 100.ms).slideX(begin: 0.1);
  }
}
