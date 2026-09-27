import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import '../../widgets/auth_gate.dart';
import 'mobile_cart_screen.dart';
import 'web_cart_screen.dart';
import 'desktop_cart_screen.dart';

/// Cart Screen - Platform-responsive wrapper with auth gate
///
/// Automatically selects the appropriate layout based on platform:
/// - Android/iOS: [MobileCartScreen]
/// - Web Browser: [WebCartScreen] (responsive to screen size)
/// - macOS/Windows: [DesktopCartScreen]
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Phase 1R corrective (C2): was its own Consumer<AuthProvider> checking
    // authProvider.isLoggedIn (always false -- AuthProvider is entirely FirebaseAuth-backed,
    // and canonical "Sign in with LetBuyy" never touches FirebaseAuth), wrapping in
    // AuthGatedWidget only when that was false. AuthGatedWidget already re-checks the
    // canonical BuyerSignInController status itself now, so this can wrap unconditionally.
    return AuthGatedWidget(
      actionDescription: 'Please login to view your cart',
      child: PlatformResponsive(
        mobile: const MobileCartScreen(),
        tablet: const WebCartScreen(),
        web: const WebCartScreen(),
        desktop: const DesktopCartScreen(),
      ),
    );
  }
}
