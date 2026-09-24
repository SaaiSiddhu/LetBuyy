// lib/screens/shop/widgets/premium_bottom_bar.dart
// Amazon/Flipkart-style premium bottom action bar

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class PremiumBottomBar extends StatelessWidget {
  final bool isDark;
  final double price;
  final double? originalPrice;
  final int discount;
  final bool isInStock;
  final bool isInWishlist;
  final bool isLoading;
  final int cartQuantity;
  final VoidCallback onWishlistTap;
  final VoidCallback onAddToCart;
  final VoidCallback onBuyNow;

  const PremiumBottomBar({
    super.key,
    required this.isDark,
    required this.price,
    this.originalPrice,
    required this.discount,
    required this.isInStock,
    required this.isInWishlist,
    this.isLoading = false,
    this.cartQuantity = 0,
    required this.onWishlistTap,
    required this.onAddToCart,
    required this.onBuyNow,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: bottomPadding > 0 ? bottomPadding : 12,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Price Row
            Row(
              children: [
                // Price Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '₹${price.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          if (originalPrice != null && originalPrice! > price) ...[
                            const SizedBox(width: 8),
                            Text(
                              '₹${originalPrice!.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 14,
                                decoration: TextDecoration.lineThrough,
                                color: Colors.grey[500],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF4CAF50),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                '$discount% OFF',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (!isInStock)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              Icon(
                                Icons.error_outline_rounded,
                                size: 14,
                                color: AppColors.errorLight,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Currently unavailable',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.errorLight,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        )
                      else
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            children: [
                              Icon(
                                Icons.check_circle_rounded,
                                size: 14,
                                color: AppColors.successLight,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'In Stock',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.successLight,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),

                // Wishlist Button
                Container(
                  margin: const EdgeInsets.only(right: 12),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        HapticFeedback.lightImpact();
                        onWishlistTap();
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isInWishlist
                              ? AppColors.error.withValues(alpha: 0.1)
                              : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isInWishlist
                                ? AppColors.error.withValues(alpha: 0.3)
                                : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
                          ),
                        ),
                        child: Icon(
                          isInWishlist
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          color: isInWishlist ? AppColors.error : Colors.grey[600],
                          size: 24,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Action Buttons Row
            Row(
              children: [
                // Add to Cart Button
                Expanded(
                  child: _buildButton(
                    label: cartQuantity > 0 ? 'Go to Cart ($cartQuantity)' : 'Add to Cart',
                    icon: cartQuantity > 0 ? Icons.shopping_cart : Icons.add_shopping_cart_rounded,
                    onTap: onAddToCart,
                    isPrimary: false,
                    isEnabled: isInStock,
                    accentColor: accentColor,
                  ),
                ),
                const SizedBox(width: 12),
                // Buy Now Button
                Expanded(
                  child: _buildButton(
                    label: 'Buy Now',
                    icon: Icons.flash_on_rounded,
                    onTap: onBuyNow,
                    isPrimary: true,
                    isEnabled: isInStock,
                    accentColor: accentColor,
                    isLoading: isLoading,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    required bool isPrimary,
    required bool isEnabled,
    required Color accentColor,
    bool isLoading = false,
  }) {
    final effectiveColor = isPrimary ? accentColor : accentColor;
    
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isEnabled && !isLoading ? () {
          HapticFeedback.mediumImpact();
          onTap();
        } : null,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: !isEnabled
                ? Colors.grey[400]
                : (isPrimary ? effectiveColor : Colors.transparent),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: !isEnabled
                  ? Colors.grey[400]!
                  : effectiveColor,
              width: 2,
            ),
            boxShadow: isPrimary && isEnabled
                ? [
                    BoxShadow(
                      color: effectiveColor.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: isLoading
              ? Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: isPrimary ? Colors.white : effectiveColor,
                    ),
                  ),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      icon,
                      color: !isEnabled
                          ? Colors.white70
                          : (isPrimary ? Colors.white : effectiveColor),
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      label,
                      style: TextStyle(
                        color: !isEnabled
                            ? Colors.white70
                            : (isPrimary ? Colors.white : effectiveColor),
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
