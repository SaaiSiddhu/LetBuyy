import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../services/theme_service.dart';
import '../../theme/app_theme_colors.dart';
import '../shared/cached_merchant_image.dart';

/// The same authored catalog/library artwork as Merchant web. This is an image
/// of a design, never a substitute for the actual live or draft preview.
class ThemeArtwork extends StatelessWidget {
  const ThemeArtwork({
    super.key,
    required this.slug,
    required this.name,
    this.version,
    this.thumbnailUrl,
    this.aspectRatio = 1.4,
  });
  final String slug, name;
  final String? version, thumbnailUrl;
  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final url = ThemeService.resolveCatalogThumbnail(
      thumbnailUrl,
      themeSlug: slug,
      version: version,
    );
    Widget unavailable() => ColoredBox(
      color: colors.surfaceVariant,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.image_outlined, color: colors.textSecondary, size: 32),
            const SizedBox(height: 8),
            Text(
              'Artwork unavailable',
              style: TextStyle(color: colors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
    final isSvg =
        url != null && Uri.parse(url).path.toLowerCase().endsWith('.svg');
    return Semantics(
      label: '$name theme artwork',
      image: true,
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: url == null
              ? unavailable()
              : isSvg
              ? SvgPicture.network(
                  url,
                  fit: BoxFit.cover,
                  placeholderBuilder: (_) =>
                      ColoredBox(color: colors.surfaceVariant),
                  errorBuilder: (_, __, ___) => unavailable(),
                )
              : CachedMerchantImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  placeholderBuilder: (_) =>
                      ColoredBox(color: colors.surfaceVariant),
                  errorBuilder: (_) => unavailable(),
                ),
        ),
      ),
    );
  }
}
