import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Product card widget for grid
class ProductCard extends StatelessWidget {
  final String name;
  final String? imageUrl;
  final double price;
  final bool isSelected;
  final bool inStock;
  final String currencySymbol;
  final VoidCallback? onTap;

  const ProductCard({
    super.key,
    required this.name,
    this.imageUrl,
    required this.price,
    required this.isSelected,
    this.inStock = true,
    this.currencySymbol = '₹',
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.grey[200]!,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isSelected ? 0.08 : 0.04),
              blurRadius: isSelected ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image
                Expanded(
                  flex: 3,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(14),
                      ),
                      image: imageUrl != null
                          ? DecorationImage(
                              image: NetworkImage(imageUrl!),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: imageUrl == null
                        ? Center(
                            child: Icon(
                              Icons.image_outlined,
                              size: 40,
                              color: Colors.grey[400],
                            ),
                          )
                        : null,
                  ),
                ),
                // Info
                Expanded(
                  flex: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const Spacer(),
                        Row(
                          children: [
                            Text(
                              '$currencySymbol${price.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: AppColors.primary,
                              ),
                            ),
                            const Spacer(),
                            if (!inStock)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.red[50],
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'Out',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.red[700],
                                    fontWeight: FontWeight.w600,
                                  ),
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
            // Selection indicator
            Positioned(
              top: 8,
              right: 8,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected ? AppColors.primary : Colors.grey[300]!,
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: isSelected
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
                      )
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
