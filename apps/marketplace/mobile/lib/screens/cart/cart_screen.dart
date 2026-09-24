import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import '../../providers/auth_provider.dart';
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
    // 🔒 Auth Gate: Require login to view cart
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        final platformContent = PlatformResponsive(
          mobile: const MobileCartScreen(),
          tablet: const WebCartScreen(),
          web: const WebCartScreen(),
          desktop: const DesktopCartScreen(),
        );

        if (!authProvider.isLoggedIn) {
          return AuthGatedWidget(
            actionDescription: 'Please login to view your cart',
            child: platformContent,
          );
        }

        return platformContent;
      },
    );
  }
}
