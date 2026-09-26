// Suggested For You Section - Based on user behavior with DEAL support
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

class SuggestedForYouSection extends StatefulWidget {
  const SuggestedForYouSection({super.key});

  @override
  State<SuggestedForYouSection> createState() => _SuggestedForYouSectionState();
}

class _SuggestedForYouSectionState extends State<SuggestedForYouSection> {
  // Cache for deals - productId -> DealModel
  final Map<String, DealModel?> _dealCache = {};
  final DealService _dealService = DealService();

  Future<DealModel?> _getDealForProduct(String productId) async {
    if (_dealCache.containsKey(productId)) {
      return _dealCache[productId];
    }
    try {
      final deal = await _dealService.getActiveDealForProduct(productId);
      _dealCache[productId] = deal;
      return deal;
    } catch (_) {
      _dealCache[productId] = null;
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 20,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          isDark ? AppColors.primaryLight : AppColors.primary,
                          isDark ? AppColors.primaryLight.withValues(alpha: 0.5) : AppColors.primary.withValues(alpha: 0.5),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Suggested For You',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, AppRoutes.shop),
                child: Row(
                  children: [
                    Text(
                      'View All',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.primaryLight : AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 16,
                      color: isDark ? AppColors.primaryLight : AppColors.primary,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Suggested Products Grid
        _buildSuggestedProducts(isDark, context),
      ],
    );
  }

  // C3 (Firebase SDK removal): was guarded on safeFirebaseUserId() == null, which is always true
  // under canonical auth -- so _getSuggestedProducts()'s raw FirebaseFirestore reads (a
  // 'recently_viewed' lookup, then per-category product queries) were already provably
  // unreachable dead code, never a live crash risk, and this method already always fell through
  // to _buildPopularProducts (the real, canonical-data path used elsewhere in this file). Calling
  // it directly removes the dead branch and the cloud_firestore import with it -- no behavior
  // change, since the FutureBuilder branch could never actually run.
  Widget _buildSuggestedProducts(bool isDark, BuildContext context) {
    return _buildPopularProducts(isDark, context);
  }

  Widget _buildPopularProducts(bool isDark, BuildContext context) {
    return Consumer<ProductProvider>(
      builder: (context, productProvider, child) {
        var products = productProvider.products
            .where((p) => p.isActive && p.rating > 0)
            .toList()
          ..sort((a, b) => b.rating.compareTo(a.rating));
        
        if (products.isEmpty) {
          products = productProvider.products
              .where((p) => p.isActive && p.reviewCount > 0)
              .toList()
            ..sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
        }
        
        if (products.isEmpty) {
          products = productProvider.products
              .where((p) => p.isActive)
              .toList()
            ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        }
        
        products = products.take(10).toList();

        if (products.isEmpty) {
          return const SizedBox(height: 240);
        }

        return SizedBox(
          height: 240,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: products.length,
            itemBuilder: (context, index) {
              return _buildSuggestedCard(products[index], isDark, context);
            },
          ),
        );
      },
    );
  }

  Widget _buildSuggestedCard(ProductModel product, bool isDark, BuildContext context) {
    return FutureBuilder<DealModel?>(
      future: _getDealForProduct(product.id),
      builder: (context, dealSnapshot) {
        final deal = dealSnapshot.data;
        final hasDeal = deal != null && deal.isActive;
        
        // Deal-specific colors
        final dealBorderColor = hasDeal 
            ? (isDark ? const Color(0xFF991B1B) : const Color(0xFFFECACA))
            : (isDark ? Colors.grey[800]! : Colors.grey[200]!);
        final dealBgColor = hasDeal
            ? (isDark ? const Color(0xFF1A0A0A) : const Color(0xFFFEF2F2))
            : (isDark ? AppColors.surfaceDark : Colors.white);

        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.pushNamed(
              context,
              AppRoutes.productDetails,
              arguments: product.id,
            );
          },
          child: Container(
            width: 150,
            margin: const EdgeInsets.symmetric(horizontal: 6),
            decoration: BoxDecoration(
              color: dealBgColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: dealBorderColor,
                width: hasDeal ? 2 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: hasDeal 
                      ? AppColors.error.withValues(alpha: isDark ? 0.2 : 0.1)
                      : Colors.black.withValues(alpha: isDark ? 0.2 : 0.08),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product Image
                Expanded(
                  child: Stack(
                    children: [
                      ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                        child: CachedNetworkImage(
                          imageUrl: product.images.isNotEmpty ? product.images.first : '',
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          placeholder: (context, url) => Container(
                            color: isDark ? Colors.grey[800] : Colors.grey[100],
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: isDark ? Colors.grey[800] : Colors.grey[100],
                            child: const Icon(Icons.image, size: 32),
                          ),
                        ),
                      ),
                      
                      // 🔥 DEAL Badge
                      if (hasDeal)
                        Positioned(
                          top: 8,
                          left: 0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [AppColors.error, const Color(0xFFDC2626)],
                              ),
                              borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
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
                                const Text('🔥', style: TextStyle(fontSize: 10)),
                                const SizedBox(width: 3),
                                Text(
                                  deal.discountLabel,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      
                      // Wishlist Heart
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.favorite_border_rounded,
                            size: 16,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Product Details
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Rating
                      if (product.rating > 0)
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    product.rating.toStringAsFixed(1),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(width: 2),
                                  const Icon(Icons.star, size: 10, color: Colors.white),
                                ],
                              ),
                            ),
                          ],
                        ),

                      const SizedBox(height: 6),

                      // Product Name
                      Text(
                        product.name,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : AppColors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      const SizedBox(height: 4),

                      // Price Row - Show deal price if active
                      Row(
                        children: [
                          if (hasDeal || (product.discount > 0 && product.originalPrice != null)) ...[
                            Text(
                              '₹${(hasDeal ? deal.originalPrice : product.originalPrice!).toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 10,
                                color: isDark ? Colors.grey[500] : Colors.grey[600],
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                            const SizedBox(width: 4),
                          ],
                          Text(
                            '₹${(hasDeal ? deal.dealPrice : product.salePrice).toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: hasDeal ? AppColors.error : (isDark ? Colors.white : AppColors.textPrimary),
                            ),
                          ),
                        ],
                      ),

                      // Deal Timer or Discount Badge
                      if (hasDeal)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.error.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.timer_rounded, size: 10, color: AppColors.error),
                                const SizedBox(width: 2),
                                Text(
                                  _formatDealTime(deal.timeRemaining),
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.error,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else if (product.discount > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '↓${product.discount.toInt()}% Off',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.success,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _formatDealTime(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d left';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h left';
    } else if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m left';
    } else {
      return '${duration.inSeconds}s';
    }
  }
}
