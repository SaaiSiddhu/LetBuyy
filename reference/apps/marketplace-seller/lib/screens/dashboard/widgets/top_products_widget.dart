// lib/screens/dashboard/widgets/top_products_widget.dart
// 🏆 PREMIUM TOP PRODUCTS
// ✨ Professional Glassmorphic Layout

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class TopProductsWidget extends StatelessWidget {
  final List<TopProduct> products;
  final bool isLoading;
  final VoidCallback? onViewAll;

  const TopProductsWidget({
    super.key,
    required this.products,
    this.isLoading = false,
    this.onViewAll,
  });

  static final _currencyFormat = NumberFormat('#,##,##0', 'en_IN');

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
                          color: const Color(0xFF10B981).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.emoji_events_rounded, color: Color(0xFF10B981), size: 20),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Top Performers',
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
                  _buildProductRow(entry.value, entry.key + 1, isDark, entry.key * 50)),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: 400.ms);
  }

  Widget _buildProductRow(TopProduct product, int rank, bool isDark, int delay) {
    final rankColor = rank == 1 ? const Color(0xFFFFD700) 
        : rank == 2 ? const Color(0xFFC0C0C0) 
        : rank == 3 ? const Color(0xFFCD7F32) 
        : Colors.grey;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          // Rank
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: rankColor.withValues(alpha: rank <= 3 ? 0.15 : 0.05),
              shape: BoxShape.circle,
              border: Border.all(color: rankColor.withValues(alpha: 0.3), width: 1.5),
            ),
            child: Center(
              child: Text(
                '$rank',
                style: TextStyle(color: rankColor, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(width: 12),
          
          // Image
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
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
                RichText(
                  text: TextSpan(
                    style: TextStyle(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.5), fontSize: 11),
                    children: [
                      TextSpan(text: '${product.unitsSold} sold'),
                      const TextSpan(text: ' • '),
                      TextSpan(text: '${product.stockRemaining} left', style: TextStyle(color: product.stockRemaining < 10 ? const Color(0xFFEF4444) : null)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Revenue
          Text(
            '₹${_compactFormat(product.revenue)}',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
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
            Icon(Icons.bar_chart_rounded, size: 36, color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2)),
            const SizedBox(height: 12),
            Text(
              'No product metrics available',
              style: TextStyle(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.4), 
                fontSize: 13
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _compactFormat(double value) {
    if (value >= 100000) return '${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    return _currencyFormat.format(value);
  }
}

class TopProduct {
  final String id;
  final String name;
  final int unitsSold;
  final double revenue;
  final double? conversionRate;
  final int stockRemaining;
  final String? imageUrl;

  const TopProduct({
    required this.id,
    required this.name,
    required this.unitsSold,
    required this.revenue,
    this.conversionRate,
    required this.stockRemaining,
    this.imageUrl,
  });
}
