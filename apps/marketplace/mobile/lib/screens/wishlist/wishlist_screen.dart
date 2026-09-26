import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
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
    // Phase 1R corrective (C2): was its own Consumer<AuthProvider> checking
    // authProvider.isLoggedIn (always false -- AuthProvider is entirely FirebaseAuth-backed,
    // and canonical "Sign in with LetBuyy" never touches FirebaseAuth), wrapping in
    // AuthGatedWidget only when that was false. AuthGatedWidget already re-checks the
    // canonical BuyerSignInController status itself now, so this can wrap unconditionally.
    return AuthGatedWidget(
      actionDescription: 'Please login to view your wishlist',
      child: const PlatformResponsive(
        mobile: MobileWishlistScreen(),
        tablet: WebWishlistScreen(),
        web: WebWishlistScreen(),
        desktop: DesktopWishlistScreen(),
      ),
    );
  }
}
