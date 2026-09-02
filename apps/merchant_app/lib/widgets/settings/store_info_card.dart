import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme_colors.dart';
import '../shared/accessible_tap_region.dart';
import '../shared/cached_merchant_image.dart';

/// Store info banner with rounded edges - like Blinkit
class StoreInfoCard extends StatelessWidget {
  final String storeName;
  final String storeUrl;
  final String? logoUrl;
  final bool isPublished;
  final VoidCallback? onEdit;

  const StoreInfoCard({
    super.key,
    required this.storeName,
    required this.storeUrl,
    this.logoUrl,
    this.isPublished = false,
    this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    void copyStoreUrl() {
      Clipboard.setData(ClipboardData(text: storeUrl));
      HapticFeedback.lightImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('URL copied!'),
          backgroundColor: colors.success,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          // Logo
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(10),
              image: logoUrl != null
                  ? DecorationImage(
                      image: cachedMerchantImageProvider(logoUrl!),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: logoUrl == null
                ? Icon(
                    Icons.store_rounded,
                    color: colors.textTertiary,
                    size: 24,
                  )
                : null,
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        storeName,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: colors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    _buildStatusBadge(),
                  ],
                ),
                const SizedBox(height: 2),
                AccessibleTapRegion(
                  label: 'Copy store URL $storeUrl',
                  hint: 'Copies the store URL to the clipboard',
                  onTap: copyStoreUrl,
                  excludeChildSemantics: true,
                  child: GestureDetector(
                    onTap: copyStoreUrl,
                    child: Text(
                      storeUrl,
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Chevron
          Icon(
            Icons.chevron_right_rounded,
            color: colors.textTertiary,
            size: 22,
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: isPublished
            ? const Color(0xFF22C55E).withValues(alpha: 0.15)
            : Colors.orange.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: isPublished ? const Color(0xFF22C55E) : Colors.orange,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 3),
          Text(
            isPublished ? 'Live' : 'Draft',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w500,
              color: isPublished ? const Color(0xFF22C55E) : Colors.orange,
            ),
          ),
        ],
      ),
    );
  }
}
