// lib/screens/dashboard/widgets/low_stock_alerts.dart
// ⚠️ PREMIUM LOW STOCK ALERTS
// ✨ Professional Glassmorphic Layout

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class LowStockAlertsWidget extends StatelessWidget {
  final List<LowStockProduct> products;
  final bool isLoading;
  final VoidCallback? onViewAll;

  const LowStockAlertsWidget({
    super.key,
    required this.products,
    this.isLoading = false,
    this.onViewAll,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 20),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Inventory Alert',
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF111827),
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  if (onViewAll != null)
                    GestureDetector(
                      onTap: onViewAll,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'View All',
                          style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              
              // List
              if (isLoading)
                Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2))
              else if (products.isEmpty)
                _buildEmptyState(isDark)
              else
                ...products.asMap().entries.map((entry) => 
                  _buildProductRow(entry.value, isDark, entry.key * 50)),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: 300.ms);
  }

  Widget _buildProductRow(LowStockProduct product, bool isDark, int delay) {
    final isCritical = product.currentStock == 0;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          // Image
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 48,
              height: 48,
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03),
              child: product.imageUrl != null
                  ? CachedNetworkImage(imageUrl: product.imageUrl!, fit: BoxFit.cover)
                  : Icon(Icons.image, size: 20, color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2)),
            ),
          ),
          const SizedBox(width: 12),
          
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  product.sku,
                  style: TextStyle(
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          
          // Stock Indicator
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: (isCritical ? const Color(0xFFEF4444) : const Color(0xFFF59E0B)).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: (isCritical ? const Color(0xFFEF4444) : const Color(0xFFF59E0B)).withValues(alpha: 0.2)),
                ),
                child: Text(
                  isCritical ? 'Out of Stock' : 'Low Stock',
                  style: TextStyle(
                    color: isCritical ? const Color(0xFFEF4444) : const Color(0xFFF59E0B),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${product.currentStock}/${product.threshold}',
                style: TextStyle(
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(delay: delay.ms);
  }

  Widget _buildEmptyState(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.check_circle_outline_rounded, size: 36, color: const Color(0xFF10B981).withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            Text(
              'Stock levels are healthy',
              style: TextStyle(
                color: const Color(0xFF10B981).withValues(alpha: 0.8), 
                fontSize: 13, 
                fontWeight: FontWeight.w600
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LowStockProduct {
  final String id;
  final String name;
  final String sku;
  final int currentStock;
  final int threshold;
  final String? imageUrl;

  const LowStockProduct({
    required this.id,
    required this.name,
    required this.sku,
    required this.currentStock,
    required this.threshold,
    this.imageUrl,
  });

  factory LowStockProduct.fromFirestore(String id, Map<String, dynamic> data) {
    return LowStockProduct(
      id: id,
      name: data['name'] ?? 'Unknown',
      sku: data['sku'] ?? 'N/A',
      currentStock: data['stock'] ?? 0,
      threshold: data['lowStockThreshold'] ?? 10,
      imageUrl: (data['images'] as List?)?.firstOrNull,
    );
  }
}
