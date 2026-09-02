import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

class AmazonSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onClear;
  final Function(String) onSubmitted;
  final String searchQuery;
  final bool isDark;

  const AmazonSearchBar({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onClear,
    required this.onSubmitted,
    required this.searchQuery,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      // Add top padding for status bar + standard padding
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 8,
        bottom: 12,
        right: 16,
      ),
      decoration: BoxDecoration(
        // Premium gradient background matching PremiumHomeAppBar
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
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Back Button
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          
          // Search Bar Layout
          Expanded(
            child: Row(
              children: [
                // Main Search Bar (Large white rounded)
                Expanded(
                  child: Hero(
                    tag: 'search-bar',
                    child: Material(
                      color: Colors.transparent,
                      child: Container(
                        height: 48, // Match Home App Bar
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10), // Match Home App Bar
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
                              child: TextField(
                                controller: controller,
                                focusNode: focusNode,
                                onSubmitted: onSubmitted,
                                textInputAction: TextInputAction.search,
                                style: const TextStyle(fontSize: 15, color: Colors.black87),
                                decoration: InputDecoration(
                                  hintText: 'Search for products, brands...',
                                  hintStyle: TextStyle(color: Colors.grey[500], fontSize: 15),
                                  border: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  errorBorder: InputBorder.none,
                                  disabledBorder: InputBorder.none,
                                  contentPadding: const EdgeInsets.symmetric(vertical: 13), // Center text properly
                                  isDense: false,
                                  filled: false,
                                  fillColor: Colors.transparent,
                                ),
                              ),
                            ),
                            if (searchQuery.isNotEmpty)
                              GestureDetector(
                                onTap: onClear,
                                child: Padding(
                                  padding: const EdgeInsets.all(8),
                                  child: Icon(Icons.close, color: Colors.grey[600], size: 20),
                                ),
                              ),
                            // Voice Search Icon (Inside Search Bar)
                            GestureDetector(
                              onTap: () {
                                HapticFeedback.mediumImpact();
                                // InlineVoiceSearchOverlay.show(context);
                              },
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                child: Icon(Icons.mic_rounded, color: Colors.grey[600], size: 24),
                              ),
                            ),
                            const SizedBox(width: 4),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(width: 12),
                
                // Camera/Visual Search Button (Standalone)
                GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    Navigator.pushNamed(context, AppRoutes.visualSearch);
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
            ),
          ),
        ],
      ),
    );
  }
}
