// Desktop Wishlist Screen - Optimized for macOS/Windows native apps
import 'package:flutter/material.dart';
import 'web_wishlist_screen.dart';

/// Desktop Wishlist Screen for native macOS/Windows/Linux apps
/// Shares layout with web as per user specification
class DesktopWishlistScreen extends StatelessWidget {
  const DesktopWishlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const WebWishlistScreen();
  }
}
