export 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' show StatTile;
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

// Migration adapter for the existing Analytics caller. The metric rendering
// owner is now the exported UI-kit StatTile; this keeps original inputs intact.
class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    this.trend,
    this.trendColor = Colors.green,
    required this.icon,
    required this.color,
  });
  final String label, value;
  final String? trend;
  final Color trendColor, color;
  final IconData icon;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 160,
    child: StatTile(
      icon: icon,
      label: label,
      value: value,
      color: color,
      supportingText: trend,
    ),
  );
}
