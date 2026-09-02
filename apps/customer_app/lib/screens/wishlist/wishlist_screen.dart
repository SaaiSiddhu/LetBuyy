import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth_gate.dart';
import 'mobile_wishlist_screen.dart';
import 'web_wishlist_screen.dart';
import 'desktop_wishlist_screen.dart';

/// Wishlist Screen - Platform-responsive wrapper with auth gate
/// 
/// Automatically selects the appropriate layout based on platform:
/// - Android/iOS: [MobileWishlistScreen]
/// - Web Browser: [WebWishlistScreen] (responsive to screen size)
/// - macOS/Windows: [DesktopWishlistScreen]
class WishlistScreen extends StatelessWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final platformContent = const PlatformResponsive(
      mobile: MobileWishlistScreen(),
      tablet: WebWishlistScreen(),
      web: WebWishlistScreen(),
      desktop: DesktopWishlistScreen(),
    );

    // 🔒 Auth Gate: Require login to view wishlist
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        if (!authProvider.isLoggedIn) {
          return AuthGatedWidget(
            actionDescription: 'Please login to view your wishlist',
            child: platformContent,
          );
        }
        return platformContent;
      },
    );
  }
}
