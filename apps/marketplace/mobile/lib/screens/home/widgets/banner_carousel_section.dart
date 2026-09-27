// Banner Carousel Section
//
// Phase 1R (2026-09-26): this file bundled two unrelated Firestore-only features with no canonical
// successor (R1.1) — the promotional banner carousel (BannerProvider, retired: its whole
// implementation was FirebaseFirestore/FirebaseStorage reads and writes) and a "recently viewed
// products" strip (a direct `recently_viewed`/`products` Firestore read, its own separate feature,
// never related to banners). Both are now retired to this one honest, static placeholder: no
// Firebase, no crash risk on guest launch, no false promise of live content.
import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

class BannerCarouselSection extends StatelessWidget {
  const BannerCarouselSection({super.key});

  // Standard wide banner aspect ratio: 16:9 (1920×1080px recommended)
  static const double _bannerAspectRatio = 16 / 9;
  static const double _maxBannerHeight = 380.0;
  static const double _minBannerHeight = 240.0;

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final screenWidth = MediaQuery.of(context).size.width;
    final double calculatedHeight = screenWidth / _bannerAspectRatio;
    final double finalBannerHeight = calculatedHeight.clamp(_minBannerHeight, _maxBannerHeight);

    return SizedBox(
      height: finalBannerHeight,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
                : [AppColors.primaryLight.withValues(alpha: 0.3), AppColors.primary.withValues(alpha: 0.1)],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.local_offer_outlined, size: 48, color: isDark ? Colors.white24 : Colors.grey[400]),
              const SizedBox(height: 12),
              Text(
                'Special offers coming soon!',
                style: TextStyle(
                  fontSize: 16,
                  color: isDark ? Colors.white38 : Colors.grey[500],
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
