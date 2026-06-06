import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/store_model.dart';

/// Preview of hero banner section in website preview
/// Applies theme colors from store.templateConfig.themeSettings
class PreviewHero extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;

  const PreviewHero({
    super.key,
    required this.section,
    this.store,
  });

  @override
  Widget build(BuildContext context) {
    final settings = section.settings;
    
    // Get theme colors
    final themeSettings = store?.templateConfig?.themeSettings;
    final primaryColor = _hexToColor(themeSettings?.primaryColor ?? '#8B5CF6');
    final secondaryColor = _hexToColor(themeSettings?.secondaryColor ?? '#8B5CF6');
    final fontFamily = themeSettings?.fontFamily ?? 'Inter';
    
    // Handle both carousel and legacy format
    // Defaults only apply when there are NO banners at all
    String? heading;
    String? subheading;
    String? buttonText;
    String? imageUrl;
    
    final banners = settings['banners'] as List?;
    final hasBanners = banners != null && banners.isNotEmpty;
    
    if (hasBanners) {
      final firstBanner = banners.first as Map<String, dynamic>?;
      heading = firstBanner?['heading'] as String?;
      subheading = firstBanner?['subheading'] as String?;
      buttonText = firstBanner?['buttonText'] as String?;
      imageUrl = firstBanner?['imageUrl'] as String?;
    } else {
      // Legacy format fields
      heading = settings['heading'] as String?;
      subheading = settings['subheading'] as String?;
      buttonText = settings['buttonText'] as String?;
      imageUrl = settings['imageUrl'] as String? ?? settings['image'] as String?;
    }
    
    // Apply defaults only when no banners exist (placeholder mode)
    if (!hasBanners) {
      heading ??= 'Welcome to Our Store';
      subheading ??= 'Discover amazing products at great prices';
      buttonText ??= 'Shop Now';
    }

    return Container(
      height: 200,
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [primaryColor, secondaryColor],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background Image
          if (imageUrl != null && imageUrl.isNotEmpty)
            CachedNetworkImage(
              imageUrl: imageUrl,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => const SizedBox.shrink(),
            ),
          
          // Gradient overlay
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  Colors.black.withValues(alpha: 0.6),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          
          // Content
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (heading != null && heading.isNotEmpty)
                  Text(
                    heading,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: fontFamily,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                if (subheading != null && subheading.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    subheading,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.9),
                      fontFamily: fontFamily,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (buttonText != null && buttonText.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      buttonText,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontFamily: fontFamily,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }
}
