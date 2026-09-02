import 'package:flutter/material.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'mobile_shop_screen.dart';
import 'web_shop_screen.dart';
import 'desktop_shop_screen.dart';

/// Shop Screen - Platform-responsive wrapper
/// 
/// Automatically selects the appropriate layout based on platform:
/// - Android/iOS: [MobileShopScreen]
/// - Web Browser: [WebShopScreen] (responsive to screen size)
/// - macOS/Windows: [DesktopShopScreen]
class ShopScreen extends StatelessWidget {
  final String? categoryId;
  final bool showRecentlyViewed;
  final bool showDeals;

  const ShopScreen({
    super.key,
    this.categoryId,
    this.showRecentlyViewed = false,
    this.showDeals = false,
  });

  @override
  Widget build(BuildContext context) {
    return PlatformResponsive(
      mobile: MobileShopScreen(
        categoryId: categoryId,
        showRecentlyViewed: showRecentlyViewed,
        showDeals: showDeals,
      ),
      tablet: WebShopScreen(
        categoryId: categoryId,
        showRecentlyViewed: showRecentlyViewed,
        showDeals: showDeals,
      ),
      web: WebShopScreen(
        categoryId: categoryId,
        showRecentlyViewed: showRecentlyViewed,
        showDeals: showDeals,
      ),
      desktop: DesktopShopScreen(
        categoryId: categoryId,
        showRecentlyViewed: showRecentlyViewed,
        showDeals: showDeals,
      ),
    );
  }
}
