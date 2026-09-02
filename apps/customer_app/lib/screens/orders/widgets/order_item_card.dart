import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart'; // ✅ Added
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart'; // ✅ Added

class OrderItemCard extends StatelessWidget {
  final CartItemModel item;

  const OrderItemCard({
    super.key,
    required this.item,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Image with CachedNetworkImage for better performance
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: isDark ? AppColors.surfaceDark : AppColors.surface,
                border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.border,
                ),
              ),
              child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: item.productImage,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          color: isDark ? AppColors.surfaceDark : AppColors.surface,
                          child: Center(
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation(AppColors.primary.withValues(alpha: 0.5)),
                              ),
                            ),
                          ),
                        ),
                        errorWidget: (context, url, error) => Icon(
                          Icons.image_not_supported_rounded,
                          color: isDark ? AppColors.textLightHint : AppColors.textHint,
                        ),
                      ),
                    ),
            ),

            const SizedBox(width: 12),

            // Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.productName,
                    style: AppTextStyles.bodyMedium.copyWith(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Qty: ${item.quantity}',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '₹${item.price.toStringAsFixed(2)}',
                        style: AppTextStyles.bodyMedium.copyWith(
                          fontWeight: FontWeight.w900,
                          fontSize: 12,
                          color: AppColors.success,
                        ),
                      ),
                      Text(
                        'Total: ₹${(item.price * item.quantity).toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
