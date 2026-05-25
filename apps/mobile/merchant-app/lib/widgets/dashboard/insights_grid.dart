import 'package:flutter/material.dart';
import '../../theme/app_theme_colors.dart';

class InsightsGrid extends StatelessWidget {
  final int totalSales;
  final int totalVisitors;
  final String currency;

  const InsightsGrid({
    super.key,
    required this.totalSales,
    required this.totalVisitors,
    this.currency = '₹',
  });

  @override
  Widget build(BuildContext context) {
    // Calculate dummy insights based on basics
    final conversionRate = totalVisitors > 0 ? (totalSales / totalVisitors * 100).toStringAsFixed(1) : '0.0';
    // Assume average order value random avg for now or 0 if no sales
    final aov = totalSales > 0 ? '1,250' : '0'; 

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _InsightTile(
          label: 'Total Orders',
          value: totalSales.toString(),
          icon: Icons.shopping_bag_outlined,
          color: Colors.blueAccent,
        ),
        _InsightTile(
          label: 'Visitors',
          value: totalVisitors.toString(),
          icon: Icons.people_outline,
          color: Colors.purpleAccent,
        ),
        _InsightTile(
          label: 'Conv. Rate',
          value: '$conversionRate%',
          icon: Icons.trending_up,
          color: Colors.greenAccent,
        ),
        _InsightTile(
          label: 'Avg. Order',
          value: '$currency$aov',
          icon: Icons.attach_money,
          color: Colors.orangeAccent,
        ),
      ],
    );
  }
}

class _InsightTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _InsightTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 20),
              // Mini sparkline could go here
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
