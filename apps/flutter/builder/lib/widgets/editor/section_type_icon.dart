import 'package:flutter/material.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Icon with label for section type
class SectionTypeIcon extends StatelessWidget {
  final SectionType type;
  final double size;
  final bool showLabel;
  final bool showBadge;

  const SectionTypeIcon({
    super.key,
    required this.type,
    this.size = 48,
    this.showLabel = true,
    this.showBadge = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: _getColor().withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(size * 0.25),
              ),
              child: Icon(
                type.icon,
                color: _getColor(),
                size: size * 0.5,
              ),
            ),
            if (showBadge && type.isPremium)
              Positioned(
                top: -4,
                right: -4,
                child: Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    color: Colors.amber,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                  ),
                  child: const Icon(
                    Icons.star_rounded,
                    size: 10,
                    color: Colors.white,
                  ),
                ),
              ),
          ],
        ),
        if (showLabel) ...[
          const SizedBox(height: 8),
          Text(
            type.displayName,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }

  Color _getColor() {
    switch (type) {
      case SectionType.header:
      case SectionType.footer:
        return Colors.grey[700]!;
      case SectionType.heroBanner:
      case SectionType.videoHero:
        return AppColors.primary;
      case SectionType.productGrid:
      case SectionType.featuredProducts:
        return Colors.blue;
      case SectionType.aboutSection:
      case SectionType.collectionFilter:
        return Colors.purple;
      case SectionType.testimonials:
        return Colors.orange;
      case SectionType.newsletter:
      case SectionType.faqAccordion:
        return Colors.green;
      case SectionType.instagramFeed:
        return Colors.pink;
      case SectionType.trustBadges:
        return Colors.indigo;
    }
  }
}

/// Block type icon
class BlockTypeIcon extends StatelessWidget {
  final BlockType type;
  final double size;

  const BlockTypeIcon({
    super.key,
    required this.type,
    this.size = 32,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(size * 0.25),
      ),
      child: Icon(
        type.icon,
        color: AppColors.primary,
        size: size * 0.5,
      ),
    );
  }
}
