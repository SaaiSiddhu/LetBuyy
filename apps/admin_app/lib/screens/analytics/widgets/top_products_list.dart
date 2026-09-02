// lib/screens/admin/analytics/widgets/top_products_list.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import '../analytics_screen.dart';
import 'analytics_card.dart';

class TopProductsList extends StatefulWidget {
  final List<ProductAnalytics> products;
  final bool isDark;

  const TopProductsList({
    super.key,
    required this.products,
    required this.isDark,
  });

  @override
  State<TopProductsList> createState() => _TopProductsListState();
}

class _TopProductsListState extends State<TopProductsList>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  int selectedIndex = 0;
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (widget.products.isEmpty) {
      return _buildEmptyState();
    }

    final accentColor =
        widget.isDark ? AppColors.primaryLight : AppColors.primary;

    return AnalyticsCard(
      title: 'Top Performing Products',
      icon: Icons.star_rounded,
      color: accentColor,
      isDark: widget.isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Summary Stats
          _buildSummaryStats(accentColor),
          const SizedBox(height: 24),

          // Products List
          SizedBox(
            height: 400,
            child: ListView.builder(
              controller: _scrollController,
              itemCount: widget.products.length,
              itemBuilder: (context, index) {
                return _buildProductCard(
                  widget.products[index],
                  index,
                  accentColor,
                ).animate().fadeIn(
                      duration: 400.ms,
                      delay: (index * 50).ms,
                    );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryStats(Color accentColor) {
    final totalRevenue =
        widget.products.fold<double>(0.0, (sum, p) => sum + p.revenue);
    final totalUnits =
        widget.products.fold<int>(0, (sum, p) => sum + p.unitsSold);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            accentColor.withValues(alpha: 0.15),
            accentColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.3),
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildStatColumn(
              'Total Revenue',
              NumberFormat.currency(symbol: '₹', decimalDigits: 0)
                  .format(totalRevenue),
              Icons.currency_rupee_rounded,
              AppColors.success,
            ),
          ),
          Container(
            width: 1,
            height: 50,
            color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                .withValues(alpha: 0.5),
          ),
          Expanded(
            child: _buildStatColumn(
              'Units Sold',
              NumberFormat.compact().format(totalUnits),
              Icons.shopping_cart_rounded,
              AppColors.info,
            ),
          ),
          Container(
            width: 1,
            height: 50,
            color: (widget.isDark ? AppColors.borderDark : AppColors.border)
                .withValues(alpha: 0.5),
          ),
          Expanded(
            child: _buildStatColumn(
              'Products',
              '${widget.products.length}',
              Icons.inventory_rounded,
              AppColors.warning,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatColumn(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Column(
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color:
                widget.isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildProductCard(
    ProductAnalytics product,
    int index,
    Color accentColor,
  ) {
    final isSelected = selectedIndex == index;
    final rank = index + 1;
    final medalColor = _getMedalColor(rank);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (mounted) {
              setState(() {
                selectedIndex = index;
              });
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? LinearGradient(
                      colors: [
                        accentColor.withValues(alpha: 0.2),
                        accentColor.withValues(alpha: 0.05),
                      ],
                    )
                  : LinearGradient(
                      colors: [
                        (widget.isDark
                                ? AppColors.surfaceDarkVariant
                                : AppColors.surface)
                            .withValues(alpha: 0.8),
                        (widget.isDark
                                ? AppColors.surfaceDarkVariant
                                : AppColors.surface)
                            .withValues(alpha: 0.4),
                      ],
                    ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isSelected
                    ? accentColor.withValues(alpha: 0.6)
                    : (widget.isDark ? AppColors.borderDark : AppColors.border)
                        .withValues(alpha: 0.3),
                width: isSelected ? 2 : 1,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: accentColor.withValues(alpha: 0.2),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                // Rank Badge
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        medalColor,
                        medalColor.withValues(alpha: 0.7),
                      ],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: medalColor.withValues(alpha: 0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: rank <= 3
                      ? Icon(
                          Icons.emoji_events_rounded,
                          color: Colors.white,
                          size: 28,
                        )
                      : Text(
                          '$rank',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                ),
                const SizedBox(width: 16),

                // Product Image
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: widget.isDark
                        ? AppColors.surfaceDark
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: widget.isDark
                          ? AppColors.borderDark
                          : AppColors.border,
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: product.imageUrl.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: product.imageUrl,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Center(
                              child: Icon(
                                Icons.image_outlined,
                                color: widget.isDark
                                    ? AppColors.textLightHint
                                    : AppColors.textHint,
                              ),
                            ),
                            errorWidget: (context, url, error) => Icon(
                              Icons.broken_image_rounded,
                              color: widget.isDark
                                  ? AppColors.textLightHint
                                  : AppColors.textHint,
                            ),
                          )
                        : Icon(
                            Icons.inventory_rounded,
                            color: widget.isDark
                                ? AppColors.textLightHint
                                : AppColors.textHint,
                          ),
                  ),
                ),
                const SizedBox(width: 16),

                // Product Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: widget.isDark
                              ? AppColors.textLight
                              : AppColors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.info.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.shopping_cart_rounded,
                                  size: 14,
                                  color: AppColors.info,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${product.unitsSold} sold',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.info,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Revenue
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      NumberFormat.compactCurrency(
                        symbol: '₹',
                        decimalDigits: 0,
                      ).format(product.revenue),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppColors.success,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Revenue',
                      style: TextStyle(
                        fontSize: 11,
                        color: widget.isDark
                            ? AppColors.textLightHint
                            : AppColors.textHint,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return AnalyticsCard(
      title: 'Top Products',
      icon: Icons.star_rounded,
      color: widget.isDark ? AppColors.primaryLight : AppColors.primary,
      isDark: widget.isDark,
      child: Container(
        height: 200,
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inventory_rounded,
              size: 64,
              color: widget.isDark
                  ? AppColors.textLightHint
                  : AppColors.textHint,
            ),
            const SizedBox(height: 16),
            Text(
              'No product sales data available',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: widget.isDark
                    ? AppColors.textLightSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getMedalColor(int rank) {
    switch (rank) {
      case 1:
        return const Color(0xFFFFD700); // Gold
      case 2:
        return const Color(0xFFC0C0C0); // Silver
      case 3:
        return const Color(0xFFCD7F32); // Bronze
      default:
        return widget.isDark ? AppColors.primaryLight : AppColors.primary;
    }
  }
}
