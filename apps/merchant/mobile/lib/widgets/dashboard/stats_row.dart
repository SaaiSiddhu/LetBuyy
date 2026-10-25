import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../theme/app_theme_colors.dart';

/// Stats row showing key metrics
class StatsRow extends StatelessWidget {
  final int views;
  final int sales;
  final int revenue;
  final int products;
  final String currencySymbol;

  const StatsRow({
    super.key,
    required this.views,
    required this.sales,
    required this.revenue,
    required this.products,
    this.currencySymbol = '₹',
  });

  @override
  Widget build(BuildContext context) {
    // Use a scrolling list for the cards to allow them to be wider
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StatCard(
            label: 'TOTAL SALES',
            value: sales.toString(),
            trendColor: Colors.greenAccent,
            icon: Icons.shopping_bag_outlined,
            color: Colors.blueAccent,
          ),
          const SizedBox(width: 16),
          _StatCard(
            label: 'REVENUE',
            value: '$currencySymbol$revenue',
            trendColor: Colors.greenAccent,
            icon: Icons.attach_money_rounded,
            color: Colors.greenAccent,
          ),
          const SizedBox(width: 16),
          _StatCard(
            label: 'STORE VISITS',
            value: views.toString(),
            trendColor: Colors.orangeAccent,
            icon: Icons.visibility_outlined,
            color: Colors.purpleAccent,
          ),
          const SizedBox(width: 16),
          _StatCard(
            label: 'PRODUCTS',
            value: products.toString(),
            trend: 'Active Inventory',
            trendColor: AppThemeColors.of(context).textSecondary,
            icon: Icons.inventory_2_outlined,
            color: Colors.orangeAccent,
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? trend;
  final Color trendColor;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    this.trend,
    this.trendColor = Colors.green,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppThemeColors.of(context).glassMedium,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppThemeColors.of(context).glassMediumBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              // Optional: Could put a tiny menu icon here
            ],
          ),
          const SizedBox(height: 16),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppThemeColors.of(context).textPrimary,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppThemeColors.of(context).textSecondary,
              letterSpacing: 0.5,
            ),
          ),
          if (trend != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: trendColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                trend!,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: trendColor,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Single stat tile for flexible layouts
class StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? color;
  final VoidCallback? onTap;

  const StatTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppColors.primary;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppThemeColors.of(context).glassMediumBorder,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: AppThemeColors.of(context).glassMediumBorder,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: effectiveColor.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: effectiveColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppThemeColors.of(context).textPrimary,
                    ),
                  ),
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppThemeColors.of(context).textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              Icon(
                Icons.chevron_right_rounded,
                color: AppThemeColors.of(context).textTertiary,
              ),
          ],
        ),
      ),
    );
  }
}
