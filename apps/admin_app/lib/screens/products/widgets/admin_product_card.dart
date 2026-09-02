// lib/screens/admin/products/widgets/admin_product_card.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class AdminProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onTap;
  final Function(bool) onToggleActive; // ✅ Added for the switch

  const AdminProductCard({
    super.key,
    required this.product,
    this.onEdit,
    this.onDelete,
    this.onTap,
    required this.onToggleActive, // ✅ Added
  });

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final int discount = product.discount;
    final bool isActive = product.isActive;
    final bool inStock = product.inStock;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ===================
                  // Column 1: Image
                  // ===================
                  Stack(
                    children: [
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: (product.images.isNotEmpty && product.images[0].isNotEmpty)
                              ? Image.network(
                                  product.images[0],
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Icon(Icons.shopping_bag_outlined, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                                )
                              : Icon(Icons.shopping_bag_outlined, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                        ),
                      ),
                      
                      // Out of Stock Overlay
                      if (!inStock)
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: Text(
                                'OUT OF\nSTOCK',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),

                      // Discount Badge
                      if (discount > 0)
                        Positioned(
                          top: 6,
                          left: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.error,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '-$discount%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),

                  const SizedBox(width: 12),

                  // ===================
                  // Column 2: Details
                  // ===================
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.name,
                          style: AppTextStyles.bodyLarge.copyWith(
                            fontWeight: FontWeight.bold,
                            color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          product.categoryId,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        // Price
                        Row(
                          children: [
                            Text(
                              '₹${product.salePrice.toStringAsFixed(0)}',
                              style: AppTextStyles.bodyMedium.copyWith(
                                color: accentColor,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (product.originalPrice != null && product.originalPrice! > product.salePrice)
                              Padding(
                                padding: const EdgeInsets.only(left: 8.0),
                                child: Text(
                                  '₹${product.originalPrice!.toStringAsFixed(0)}',
                                  style: AppTextStyles.bodySmall.copyWith(
                                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                                    decoration: TextDecoration.lineThrough,
                                  ),
                                ),
                              ),
                          ],
                        ),
                         const SizedBox(height: 6),
                        // Stock
                        Text(
                          'Stock: ${product.stock} ${product.unit ?? 'units'}',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: product.stock < 10 ? AppColors.warning : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                            fontWeight: product.stock < 10 ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              // --- Divider ---
              Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 24),

              // --- Badges and Actions ---
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Status Badges
                  Expanded(
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if(product.isFeatured) _buildBadge('Featured', AppColors.favorite, isDark),
                        if(product.isTrending) _buildBadge('Trending', AppColors.info, isDark),
                        if(product.isVerified) _buildBadge('Verified', AppColors.processing, isDark),
                      ],
                    ),
                  ),

                  // Control Row (Switch + Actions)
                  Row(
                    children: [
                      // ✅✅✅ FIXED: Wrapped Switch in Transform.scale
                      Transform.scale(
                        scale: 0.8,
                        child: Switch(
                          value: isActive,
                          onChanged: onToggleActive,
                          activeThumbColor: AppColors.success, 
                          inactiveTrackColor: AppColors.warning.withValues(alpha: 0.5), 
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                      
                      // Edit Button
                      Tooltip(
                        message: 'Edit Product',
                        child: IconButton(
                          onPressed: onEdit,
                          icon: Icon(Icons.edit_outlined, color: isDark ? AppColors.infoLight : AppColors.info, size: 22), 
                        ),
                      ),

                      // Delete Button
                      Tooltip(
                        message: 'Delete Product',
                        child: IconButton(
                          onPressed: onDelete,
                          icon: Icon(Icons.delete_outline, color: isDark ? AppColors.errorLight : AppColors.error, size: 22), 
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).moveY(begin: 15, end: 0, curve: Curves.easeOut);
  }

  Widget _buildBadge(String label, Color color, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: AppTextStyles.bodySmall.copyWith(color: color, fontWeight: FontWeight.bold, fontSize: 10),
      ),
    );
  }
}