// Desktop Shop Screen - Optimized for macOS/Windows native apps
import 'package:flutter/material.dart';
import 'web_shop_screen.dart';

/// Desktop Shop Screen for native macOS/Windows/Linux apps
/// Shares layout with web as per user specification
class DesktopShopScreen extends StatelessWidget {
  final String? categoryId;
  final bool showRecentlyViewed;
  final bool showDeals;

  const DesktopShopScreen({
    super.key,
    this.categoryId,
    this.showRecentlyViewed = false,
    this.showDeals = false,
  });

  @override
  Widget build(BuildContext context) {
    return WebShopScreen(
      categoryId: categoryId,
      showRecentlyViewed: showRecentlyViewed,
      showDeals: showDeals,
    );
  }
}
