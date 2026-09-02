// lib/screens/shop/widgets/quick_actions_bar.dart
// Amazon/Flipkart-style quick action pills

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class QuickActionsBar extends StatelessWidget {
  final bool isDark;
  final bool isInWishlist;
  final VoidCallback onWishlistTap;
  final VoidCallback onShareTap;
  final VoidCallback? onCompareTap;
  final VoidCallback? onSimilarTap;

  const QuickActionsBar({
    super.key,
    required this.isDark,
    required this.isInWishlist,
    required this.onWishlistTap,
    required this.onShareTap,
    this.onCompareTap,
    this.onSimilarTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            _buildActionPill(
              icon: isInWishlist 
                  ? Icons.favorite_rounded 
                  : Icons.favorite_border_rounded,
              label: isInWishlist ? 'Wishlisted' : 'Wishlist',
              onTap: () {
                HapticFeedback.lightImpact();
                onWishlistTap();
              },
              isActive: isInWishlist,
              activeColor: AppColors.error,
            ),
            const SizedBox(width: 10),
            _buildActionPill(
              icon: Icons.share_rounded,
              label: 'Share',
              onTap: () {
                HapticFeedback.lightImpact();
                onShareTap();
              },
            ),
            if (onCompareTap != null) ...[
              const SizedBox(width: 10),
              _buildActionPill(
                icon: Icons.compare_arrows_rounded,
                label: 'Compare',
                onTap: () {
                  HapticFeedback.lightImpact();
                  onCompareTap?.call();
                },
              ),
            ],
            if (onSimilarTap != null) ...[
              const SizedBox(width: 10),
              _buildActionPill(
                icon: Icons.grid_view_rounded,
                label: 'Similar',
                onTap: () {
                  HapticFeedback.lightImpact();
                  onSimilarTap?.call();
                },
              ),
            ],
            const SizedBox(width: 10),
            _buildActionPill(
              icon: Icons.store_rounded,
              label: 'Store',
              onTap: () {
                HapticFeedback.lightImpact();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionPill({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
    Color? activeColor,
  }) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final effectiveColor = isActive 
        ? (activeColor ?? accentColor)
        : (isDark ? Colors.grey[400] : Colors.grey[700]);
    
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(30),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: isActive 
                ? effectiveColor!.withValues(alpha: 0.1)
                : (isDark ? const Color(0xFF2A2A2A) : Colors.grey[100]),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: isActive 
                  ? effectiveColor!.withValues(alpha: 0.3)
                  : (isDark ? Colors.grey[700]! : Colors.grey[300]!),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: effectiveColor,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: effectiveColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
