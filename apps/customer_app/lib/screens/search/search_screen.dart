import 'package:flutter/material.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'mobile_search_screen.dart';
import 'web_search_screen.dart';
import 'desktop_search_screen.dart';

/// Search Screen - Platform-responsive wrapper
/// 
/// Automatically selects the appropriate layout based on platform:
/// - Android/iOS: [MobileSearchScreen]
/// - Web Browser: [WebSearchScreen] (responsive)
/// - macOS/Windows: [DesktopSearchScreen]
class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlatformResponsive(
      mobile: MobileSearchScreen(),
      tablet: WebSearchScreen(),
      web: WebSearchScreen(),
      desktop: DesktopSearchScreen(),
    );
  }
}
