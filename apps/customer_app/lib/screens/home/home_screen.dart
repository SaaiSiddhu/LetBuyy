import 'package:flutter/material.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'mobile_home_screen.dart';
import 'web_home_screen.dart';
import 'desktop_home_screen.dart';

/// Home Screen - Platform-responsive wrapper
/// 
/// Automatically selects the appropriate layout based on platform:
/// - Android/iOS: [MobileHomeScreen]
/// - Web Browser: [WebHomeScreen] (responsive to screen size)
/// - macOS/Windows: [DesktopHomeScreen]
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlatformResponsive(
      mobile: MobileHomeScreen(),
      tablet: WebHomeScreen(),
      web: WebHomeScreen(),
      desktop: DesktopHomeScreen(),
    );
  }
}
