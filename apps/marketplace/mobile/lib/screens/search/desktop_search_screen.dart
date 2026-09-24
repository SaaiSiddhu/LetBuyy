// Desktop Search Screen - Optimized for macOS/Windows native apps
import 'package:flutter/material.dart';
import 'mobile_search_screen.dart';

/// Desktop Search Screen for native macOS/Windows/Linux apps
/// Uses mobile search for now (responsive) - can be enhanced with desktop-specific features
class DesktopSearchScreen extends StatelessWidget {
  const DesktopSearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Using MobileSearchScreen as it's responsive
    // Can be replaced with dedicated desktop search in future
    return const MobileSearchScreen();
  }
}
