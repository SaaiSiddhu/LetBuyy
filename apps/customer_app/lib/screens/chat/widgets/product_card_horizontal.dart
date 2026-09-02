// lib/screens/chat/widgets/product_card_horizontal.dart
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class ProductCardHorizontal extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback? onTap;

  const ProductCardHorizontal({
    super.key,
    required this.product,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    // ✅ ENHANCED: Better data extraction
    final name = _extractName();
    final imageUrl = _extractImageUrl();
    final salePrice = _extractPrice('salePrice') ?? _extractPrice('price') ?? 0.0;
    final originalPrice = _extractPrice('originalPrice') ?? _extractPrice('mrp') ?? salePrice;
    final hasDiscount = originalPrice > salePrice && salePrice > 0;
    final discount = hasDiscount
        ? ((originalPrice - salePrice) / originalPrice * 100).round()
        : 0;
    final inStock = _extractStock();
    final rating = _extractRating();
    final isFeatured = product['isFeatured'] == true;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: inStock ? onTap : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          width: 160,
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: inStock ? AppColors.borderLight : AppColors.borderLight.withValues(alpha: 0.3),
              width: 0.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.shadowLight,
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ═══ IMAGE SECTION ═══
              Stack(
                children: [
                  Container(
                    height: 120,
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(15),
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(15),
                      ),
                      child: imageUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: imageUrl,
                              width: double.infinity,
                              height: 120,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(
                                color: AppColors.background,
                                child: Center(
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      AppColors.primary,
                                    ),
                                  ),
                                ),
                              ),
                              errorWidget: (context, url, error) => Container(
                                color: AppColors.background,
                                child: Center(
                                  child: Icon(
                                    Icons.image_not_supported,
                                    size: 36,
                                    color: AppColors.textHint,
                                  ),
                                ),
                              ),
                            )
                          : Center(
                              child: Icon(
                                Icons.image_not_supported,
                                size: 36,
                                color: AppColors.textHint,
                              ),
                            ),
                    ),
                  ),
                  
                  // Featured Badge
                  if (isFeatured)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.warning,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.shadowMedium,
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(
                              Icons.star,
                              size: 10,
                              color: AppColors.white,
                            ),
                            SizedBox(width: 2),
                            Text(
                              'Featured',
                              style: TextStyle(
                                color: AppColors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Discount Badge
                  if (hasDiscount && discount > 0)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.shadowMedium,
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: Text(
                          '$discount% OFF',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),

                  // Out of Stock Overlay
                  if (!inStock)
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.textPrimary.withValues(alpha: 0.7),
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(15),
                          ),
                        ),
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.error,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Out of Stock',
                              style: TextStyle(
                                color: AppColors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),

              // ═══ DETAILS SECTION ═══
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product Name
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      
                      const SizedBox(height: 4),
                      
                      // Rating (if available)
                      if (rating > 0) ...[
                        Row(
                          children: [
                            Icon(
                              Icons.star,
                              size: 12,
                              color: AppColors.warning,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              rating.toStringAsFixed(1),
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                      ],

                      const Spacer(),

                      // Prices Row
                      Row(
                        children: [
                          Text(
                            '₹${salePrice.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                          if (hasDiscount) ...[
                            const SizedBox(width: 4),
                            Text(
                              '₹${originalPrice.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textTertiary,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),

                      // Stock indicator
                      if (inStock) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Text(
                              'In Stock',
                              style: TextStyle(
                                fontSize: 9,
                                color: AppColors.success,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ✅ Helper methods for data extraction
  String _extractName() {
    final name = product['name'];
    if (name is String && name.trim().isNotEmpty) {
      return name.trim();
    }
    return 'Unnamed Product';
  }

  String _extractImageUrl() {
    // Try multiple possible image fields
    final images = product['images'];
    final imageUrl = product['imageUrl'];
    
    if (images is List && images.isNotEmpty) {
      final first = images.first;
      if (first is String && first.isNotEmpty) return first;
    }
    
    if (imageUrl is String && imageUrl.isNotEmpty) {
      return imageUrl;
    }
    
    return '';
  }

  double? _extractPrice(String key) {
    final value = product[key];
    if (value == null) return null;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  bool _extractStock() {
    final inStock = product['inStock'];
    if (inStock is bool) return inStock;
    
    final stock = product['stock'];
    if (stock is int) return stock > 0;
    if (stock is double) return stock > 0;
    if (stock is String) {
      final parsed = int.tryParse(stock);
      return parsed != null && parsed > 0;
    }
    
    return true; // Default to in stock
  }

  double _extractRating() {
    final rating = product['rating'];
    if (rating == null) return 0.0;
    if (rating is double) return rating;
    if (rating is int) return rating.toDouble();
    if (rating is String) return double.tryParse(rating) ?? 0.0;
    return 0.0;
  }
}