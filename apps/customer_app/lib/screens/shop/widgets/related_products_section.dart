// lib/screens/shop/widgets/related_products_section.dart
// Amazon/Flipkart-style related products carousel with DEAL support

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

class RelatedProductsSection extends StatefulWidget {
  final String currentProductId;
  final String categoryId;
  final bool isDark;
  final Function(ProductModel) onProductTap;

  const RelatedProductsSection({
    super.key,
    required this.currentProductId,
    required this.categoryId,
    required this.isDark,
    required this.onProductTap,
  });

  @override
  State<RelatedProductsSection> createState() => _RelatedProductsSectionState();
}

class _RelatedProductsSectionState extends State<RelatedProductsSection> {
  // Deal cache
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
    return Consumer<ProductProvider>(
      builder: (context, productProvider, child) {
        // Get products from same category, excluding current product
        final relatedProducts = productProvider.products
            .where((p) => 
                p.categoryId == widget.categoryId && 
                p.id != widget.currentProductId &&
                p.isActive)
            .take(10)
            .toList();

        if (relatedProducts.isEmpty) {
          return const SizedBox.shrink();
        }

        return _buildSection(
          title: 'Similar Products',
          icon: Icons.grid_view_rounded,
          products: relatedProducts,
        );
      },
    );
  }

  Widget _buildSection({
    required String title,
    required IconData icon,
    required List<ProductModel> products,
  }) {
    final accentColor = widget.isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: accentColor, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: widget.isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () {},
                  child: Text(
                    'See All',
                    style: TextStyle(
                      color: accentColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Products Carousel
          SizedBox(
            height: 260, // Slightly taller for deal badge
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: products.length,
              itemBuilder: (context, index) {
                return _buildProductCard(products[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductCard(ProductModel product) {
    return FutureBuilder<DealModel?>(
      future: _getDealForProduct(product.id),
      builder: (context, dealSnapshot) {
        final deal = dealSnapshot.data;
        final hasDeal = deal != null && deal.isActive;
        
        // Deal-specific colors
        final dealBorderColor = hasDeal 
            ? (widget.isDark ? const Color(0xFF991B1B) : const Color(0xFFFECACA))
            : (widget.isDark ? Colors.grey[800]! : Colors.grey[200]!);
        final dealBgColor = hasDeal
            ? (widget.isDark ? const Color(0xFF1A0A0A) : const Color(0xFFFEF2F2))
            : (widget.isDark ? const Color(0xFF1A1A1A) : Colors.white);

        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            widget.onProductTap(product);
          },
          child: Container(
            width: 150,
            margin: const EdgeInsets.only(right: 12),
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
                      ? AppColors.error.withValues(alpha: widget.isDark ? 0.2 : 0.1)
                      : Colors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                      child: CachedNetworkImage(
                        imageUrl: product.primaryImage,
                        height: 130,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          height: 130,
                          color: widget.isDark ? Colors.grey[800] : Colors.grey[200],
                          child: const Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ),
                        errorWidget: (context, url, error) => Container(
                          height: 130,
                          color: widget.isDark ? Colors.grey[800] : Colors.grey[200],
                          child: const Icon(Icons.image_not_supported, size: 32),
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
                      )
                    else if (product.discount > 0)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE53935),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${product.discount}% OFF',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),

                // Info
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
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: widget.isDark ? Colors.white : Colors.black87,
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: 6),
                        
                        // Price Row
                        Row(
                          children: [
                            Text(
                              '₹${(hasDeal ? deal.dealPrice : product.salePrice).toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: hasDeal ? AppColors.error : (widget.isDark ? Colors.white : Colors.black87),
                              ),
                            ),
                            if (hasDeal || product.originalPrice != null) ...[
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  '₹${(hasDeal ? deal.originalPrice : product.originalPrice!).toStringAsFixed(0)}',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 11,
                                    decoration: TextDecoration.lineThrough,
                                    color: Colors.grey[500],
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        
                        const SizedBox(height: 4),
                        
                        // Deal Timer or Rating
                        if (hasDeal)
                          Container(
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
                          )
                        else
                          Row(
                            children: [
                              const Icon(Icons.star_rounded, color: Color(0xFFFFC107), size: 14),
                              const SizedBox(width: 4),
                              Text(
                                product.rating.toStringAsFixed(1),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                                ),
                              ),
                              Text(
                                ' (${product.reviewCount})',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: widget.isDark ? Colors.grey[600] : Colors.grey[500],
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
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
