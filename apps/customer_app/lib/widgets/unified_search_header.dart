// lib/widgets/unified_search_header.dart
// 🔍 Unified Search Header - Common sticky header for all screens

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

/// A unified, sticky search header widget used across:
/// - Shop Screen
/// - Product Details Screen
/// - Search Screen
///
/// Provides a seamless navigation experience where users
/// don't feel like they're switching between screens.
class UnifiedSearchHeader extends StatelessWidget {
  /// Whether to show the back button (for sub-pages)
  final bool showBackButton;
  
  /// Custom hint text for the search bar
  final String searchHint;
  
  /// Custom callback when back is pressed (defaults to Navigator.pop)
  final VoidCallback? onBackPressed;
  
  /// Custom callback when search bar is tapped
  final VoidCallback? onSearchTap;
  
  /// Custom callback when camera is tapped
  final VoidCallback? onCameraTap;
  
  /// Whether to show the camera button
  final bool showCameraButton;
  
  /// Current search query (to display in search bar)
  final String? currentQuery;

  const UnifiedSearchHeader({
    super.key,
    this.showBackButton = true,
    this.searchHint = 'Search for products...',
    this.onBackPressed,
    this.onSearchTap,
    this.onCameraTap,
    this.showCameraButton = true,
    this.currentQuery,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusBarHeight = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.only(
        top: statusBarHeight + 8,
        bottom: 12,
        left: showBackButton ? 0 : 16,
        right: 16,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [AppColors.primaryDark, AppColors.primaryDarker, AppColors.surfaceDark]
              : [AppColors.primaryDark, AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: (isDark ? Colors.black : AppColors.primaryDark).withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Back Button (for sub-pages)
          if (showBackButton)
            IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: onBackPressed ?? () => Navigator.pop(context),
            ),
          
          // Search Bar + Camera
          Expanded(
            child: Row(
              children: [
                // Main Search Bar (Tappable)
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      if (onSearchTap != null) {
                        onSearchTap!();
                      } else {
                        Navigator.pushNamed(context, AppRoutes.search);
                      }
                    },
                    child: Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          const SizedBox(width: 14),
                          Icon(Icons.search_rounded, color: Colors.grey[600], size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              currentQuery?.isNotEmpty == true 
                                  ? currentQuery! 
                                  : searchHint,
                              style: TextStyle(
                                color: currentQuery?.isNotEmpty == true 
                                    ? Colors.black87 
                                    : Colors.grey[500],
                                fontSize: 15,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          // Mic icon
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Icon(Icons.mic_rounded, color: Colors.grey[600], size: 24),
                          ),
                          const SizedBox(width: 4),
                        ],
                      ),
                    ),
                  ),
                ),
                
                // Camera Button
                if (showCameraButton) ...[
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      if (onCameraTap != null) {
                        onCameraTap!();
                      } else {
                        Navigator.pushNamed(context, '/visual-search');
                      }
                    },
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                      ),
                      child: Icon(
                        Icons.camera_alt_outlined,
                        color: Colors.white.withValues(alpha: 0.9),
                        size: 24,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
