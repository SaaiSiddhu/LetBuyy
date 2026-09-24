// lib/screens/products/widgets/product_stats_card.dart
// 📊 PRODUCT PERFORMANCE STATS - Quick overview of product metrics
// ✨ Ultra-compact, glassmorphism design

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class ProductStatsCard extends StatelessWidget {
  final int totalProducts;
  final int activeProducts;
  final int lowStockProducts;
  final int outOfStockProducts;
  final double totalInventoryValue;
  final Function(String filter)? onFilterTap;

  const ProductStatsCard({
    super.key,
    required this.totalProducts,
    required this.activeProducts,
    required this.lowStockProducts,
    required this.outOfStockProducts,
    required this.totalInventoryValue,
    this.onFilterTap,
  });

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.8) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.03),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.analytics_rounded, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Text(
                'Inventory Overview',
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Stats Grid
          Row(
            children: [
              _buildStatTile('Total', '$totalProducts', const Color(0xFF3B82F6), Icons.inventory_2_rounded, isDark, 'all'),
              const SizedBox(width: 10),
              _buildStatTile('Active', '$activeProducts', const Color(0xFF10B981), Icons.check_circle_rounded, isDark, 'active'),
              const SizedBox(width: 10),
              _buildStatTile('Low', '$lowStockProducts', const Color(0xFFF59E0B), Icons.warning_rounded, isDark, 'low_stock'),
              const SizedBox(width: 10),
              _buildStatTile('Out', '$outOfStockProducts', const Color(0xFFEF4444), Icons.error_rounded, isDark, 'out_of_stock'),
            ],
          ),
          const SizedBox(height: 14),
          
          // Inventory Value
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                  const Color(0xFF3B82F6).withValues(alpha: 0.1),
                ],
              ),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.currency_rupee_rounded, color: Color(0xFF8B5CF6), size: 18),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Inventory Value',
                      style: TextStyle(color: Colors.grey[500], fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '₹${_compactFormat(totalInventoryValue)}',
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF111827),
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 100.ms);
  }

  Widget _buildStatTile(String label, String value, Color color, IconData icon, bool isDark, String filter) {
    return Expanded(
      child: GestureDetector(
        onTap: () => onFilterTap?.call(filter),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 6),
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _compactFormat(double value) {
    if (value >= 10000000) return '${(value / 10000000).toStringAsFixed(1)}Cr';
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}
