// lib/screens/user/home/widgets/recently_viewed_widget.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

class RecentlyViewedWidget extends StatefulWidget {
  const RecentlyViewedWidget({super.key});

  @override
  State<RecentlyViewedWidget> createState() => _RecentlyViewedWidgetState();
}

class _RecentlyViewedWidgetState extends State<RecentlyViewedWidget>
    with TickerProviderStateMixin {
  late AnimationController _shimmerController;
  final DealService _dealService = DealService();

  // Cache deals for products to avoid repeated API calls
  final Map<String, DealModel?> _productDealsCache = {};
  bool _dealsLoaded = false;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  /// Load active deals for all recently viewed products
  Future<void> _loadDealsForProducts(List<ProductModel> products) async {
    if (_dealsLoaded || products.isEmpty) return;
    _dealsLoaded = true; // Set early to prevent multiple calls

    debugPrint(
      '🔥 Loading deals for ${products.length} recently viewed products...',
    );

    for (final product in products.take(10)) {
      if (!_productDealsCache.containsKey(product.id)) {
        try {
          final deal = await _dealService.getActiveDealForProduct(product.id);
          if (deal != null) {
            debugPrint(
              '✅ Found active deal for product: ${product.name} - ${deal.discountLabel}',
            );
          }
          if (mounted) {
            setState(() {
              _productDealsCache[product.id] = deal;
            });
          }
        } catch (e) {
          debugPrint('❌ Error loading deal for ${product.id}: $e');
          _productDealsCache[product.id] = null;
        }
      }
    }
    debugPrint(
      '🔥 Deals loading complete. Cache size: ${_productDealsCache.length}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Consumer<ProductProvider>(
      builder: (context, productProvider, child) {
        final recentlyViewed = productProvider.recentlyViewedProducts;

        if (recentlyViewed.isEmpty) {
          return const SizedBox.shrink();
        }

        // Load deals for products (only once)
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _loadDealsForProducts(recentlyViewed);
        });

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
              child: _buildSectionHeader(
                context: context,
                title: 'Keep Shopping For',
                subtitle: 'Continue where you left off',
                totalProducts: recentlyViewed.length,
                isDark: isDark,
                onSeeAll: () {
                  Navigator.pushNamed(context, AppRoutes.recentlyViewed);
                },
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 220,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: recentlyViewed.length > 10
                    ? 10
                    : recentlyViewed.length,
                itemBuilder: (context, index) {
                  final product = recentlyViewed[index];
                  // Get deal from cache - already filtered for active deals
                  final deal = _productDealsCache[product.id];

                  return _RecentlyViewedProductCard(
                    product: product,
                    deal:
                        deal, // Pass deal directly, card will handle null check
                    isDark: isDark,
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // --- REUSED HEADER from all_products_grid.dart ---
  Widget _buildSectionHeader({
    required BuildContext context,
    required String title,
    required String subtitle,
    required int totalProducts,
    required bool isDark,
    required VoidCallback onSeeAll,
  }) {
    return Row(
      children: [
        AnimatedBuilder(
          animation: _shimmerController,
          builder: (context, child) {
            return Container(
              width: 5,
              height: 32,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isDark
                      ? [
                          AppColors.primaryLight,
                          AppColors.primaryLight.withValues(alpha: 0.5),
                        ]
                      : [
                          AppColors.primary,
                          AppColors.primary.withValues(alpha: 0.5),
                        ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(3),
                boxShadow: [
                  BoxShadow(
                    color: (isDark ? AppColors.primaryLight : AppColors.primary)
                        .withValues(
                          alpha: 0.4 + (_shimmerController.value * 0.2),
                        ),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.white : Colors.black87,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: isDark
                            ? [
                                AppColors.primaryLight.withValues(alpha: 0.2),
                                AppColors.primaryLight.withValues(alpha: 0.1),
                              ]
                            : [
                                AppColors.primary.withValues(alpha: 0.15),
                                AppColors.primary.withValues(alpha: 0.08),
                              ],
                      ),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isDark
                            ? AppColors.primaryLight.withValues(alpha: 0.3)
                            : AppColors.primary.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Text(
                      '${totalProducts > 10 ? '10+' : totalProducts}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: isDark
                            ? AppColors.primaryLight
                            : AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
        TextButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            onSeeAll();
          },
          style: TextButton.styleFrom(
            foregroundColor: isDark
                ? AppColors.primaryLight
                : AppColors.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: Row(
            children: const [
              Text(
                'See All',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
              SizedBox(width: 4),
              Icon(Icons.arrow_forward_ios_rounded, size: 12),
            ],
          ),
        ),
      ],
    );
  }
}

/// Product card widget that handles deal display
class _RecentlyViewedProductCard extends StatelessWidget {
  final ProductModel product;
  final DealModel? deal;
  final bool isDark;

  const _RecentlyViewedProductCard({
    required this.product,
    required this.deal,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final hasDeal = deal != null;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(
          context,
          AppRoutes.productDetail,
          arguments: product.id,
        );
      },
      child: Container(
        width: 150,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        decoration: BoxDecoration(
          // Use red tint for deals, primary tint otherwise
          color: hasDeal
              ? (isDark
                    ? const Color(0xFF450A0A).withValues(alpha: 0.3)
                    : const Color(0xFFFEF2F2))
              : (isDark
                    ? AppColors.primaryDark.withValues(alpha: 0.15)
                    : AppColors.primary.withValues(alpha: 0.05)),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: hasDeal
                ? (isDark
                      ? AppColors.error.withValues(alpha: 0.3)
                      : const Color(0xFFFECACA))
                : (isDark
                      ? AppColors.primaryLight.withValues(alpha: 0.1)
                      : AppColors.primary.withValues(alpha: 0.08)),
            width: hasDeal ? 1.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: hasDeal
                  ? AppColors.error.withValues(alpha: isDark ? 0.2 : 0.1)
                  : (isDark
                        ? AppColors.primary.withValues(alpha: 0.15)
                        : AppColors.primary.withValues(alpha: 0.08)),
              blurRadius: 15,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product Image with badges
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16),
                  ),
                  child: product.images.isNotEmpty &&
                          product.images.first.trim().isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: product.images.first,
                          height: 130,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            color: isDark
                                ? Colors.grey[800]
                                : AppColors.lightGrey,
                            child: Center(
                              child: CircularProgressIndicator(
                                color: hasDeal
                                    ? AppColors.error
                                    : (isDark
                                          ? AppColors.primaryLight
                                          : AppColors.primary),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: isDark
                                ? Colors.grey[800]
                                : AppColors.lightGrey,
                            child: Icon(
                              Icons.shopping_bag_outlined,
                              size: 40,
                              color: isDark ? Colors.grey[600] : AppColors.grey,
                            ),
                          ),
                        )
                      : Container(
                          height: 130,
                          width: double.infinity,
                          color: isDark ? Colors.grey[800] : AppColors.lightGrey,
                          child: Icon(
                            Icons.shopping_bag_outlined,
                            size: 40,
                            color: isDark ? Colors.grey[600] : AppColors.grey,
                          ),
                        ),
                ),

                // DEAL Badge (top-left) - only show if has active deal
                if (hasDeal)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.error, const Color(0xFFDC2626)],
                        ),
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.error.withValues(alpha: 0.4),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🔥', style: TextStyle(fontSize: 8)),
                          const SizedBox(width: 3),
                          Text(
                            'DEAL',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Discount Badge (top-right) - show deal discount or regular discount
                if (hasDeal ||
                    (product.discount > 0 &&
                        product.marketplaceListingId == null))
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: hasDeal
                            ? Colors.black.withValues(alpha: 0.75)
                            : AppColors.primary.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        hasDeal ? deal!.discountLabel : product.discountLabel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
              ],
            ),

            // Product Details
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        fontWeight: FontWeight.w600,
                        height: 1.2,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    const Spacer(),

                    // Price display - different for deals vs regular
                    if (hasDeal) ...[
                      // Deal price row
                      Row(
                        children: [
                          Text(
                            '₹${deal!.dealPrice.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.error,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '₹${deal!.originalPrice.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: isDark ? Colors.white38 : Colors.grey[500],
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      // Regular price display
                      if (product.hasDisplayableReferencePrice)
                        Row(
                          children: [
                            Text(
                              '₹${product.salePrice.toStringAsFixed(0)}',
                              style: AppTextStyles.titleMedium.copyWith(
                                color: isDark
                                    ? AppColors.primaryLight
                                    : AppColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                '${product.hasPriorThirtyDayLow ? '30-day low ' : 'M.R.P. '}₹${product.originalPrice!.toStringAsFixed(0)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                  color: isDark
                                      ? Colors.white38
                                      : Colors.grey[500],
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ),
                          ],
                        )
                      else
                        Text(
                          '₹${product.price.toStringAsFixed(0)}',
                          style: AppTextStyles.titleMedium.copyWith(
                            color: isDark
                                ? AppColors.primaryLight
                                : AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
