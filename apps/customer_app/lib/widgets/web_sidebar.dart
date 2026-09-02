// lib/widgets/web_sidebar.dart
// 💎 Premium Web Sidebar Navigation - Amazon/Flipkart Style

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

/// Premium collapsible sidebar for web navigation
class WebSidebar extends StatefulWidget {
  final String? activeRoute;
  final bool isExpanded;
  final VoidCallback? onToggle;

  const WebSidebar({
    super.key,
    this.activeRoute,
    this.isExpanded = true,
    this.onToggle,
  });

  @override
  State<WebSidebar> createState() => _WebSidebarState();
}

class _WebSidebarState extends State<WebSidebar> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _widthAnimation;

  // Sidebar widths
  static const double expandedWidth = 240.0;
  static const double collapsedWidth = 72.0;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );

    _widthAnimation = Tween<double>(
      begin: collapsedWidth,
      end: expandedWidth,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    ));

    if (widget.isExpanded) {
      _animationController.value = 1.0;
    }
  }

  @override
  void didUpdateWidget(WebSidebar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isExpanded != oldWidget.isExpanded) {
      if (widget.isExpanded) {
        _animationController.forward();
      } else {
        _animationController.reverse();
      }
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return AnimatedBuilder(
      animation: _widthAnimation,
      builder: (context, child) {
        return Container(
          width: _widthAnimation.value,
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF0F172A)
                : Colors.white,
            border: Border(
              right: BorderSide(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.grey.shade200,
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
                blurRadius: 10,
                offset: const Offset(2, 0),
              ),
            ],
          ),
          child: Column(
            children: [
              const SizedBox(height: 16),
              
              // Toggle Button
              _buildToggleButton(isDark),
              
              const SizedBox(height: 8),
              
              // Divider
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Divider(
                  color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200,
                  height: 1,
                ),
              ),
              
              const SizedBox(height: 8),
              
              // Navigation Items
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      _buildNavItem(
                        icon: Icons.home_rounded,
                        label: 'Home',
                        route: AppRoutes.home,
                        isDark: isDark,
                      ),
                      _buildNavItem(
                        icon: Icons.slow_motion_video_rounded,
                        label: 'Reels',
                        route: AppRoutes.reels,
                        isDark: isDark,
                      ),
                      _buildNavItem(
                        icon: Icons.shopping_bag_rounded,
                        label: 'Shop',
                        route: AppRoutes.shop,
                        isDark: isDark,
                      ),
                      _buildNavItem(
                        icon: Icons.grid_view_rounded,
                        label: 'Categories',
                        route: AppRoutes.categories,
                        isDark: isDark,
                      ),
                      
                      // Divider
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Divider(
                          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200,
                          height: 1,
                        ),
                      ),
                      
                      _buildNavItem(
                        icon: Icons.shopping_cart_rounded,
                        label: 'Cart',
                        route: AppRoutes.cart,
                        isDark: isDark,
                        badgeProvider: 'cart',
                      ),
                      _buildNavItem(
                        icon: Icons.favorite_rounded,
                        label: 'Wishlist',
                        route: AppRoutes.wishlist,
                        isDark: isDark,
                        badgeProvider: 'wishlist',
                      ),
                      _buildNavItem(
                        icon: Icons.receipt_long_rounded,
                        label: 'Orders',
                        route: AppRoutes.orders,
                        isDark: isDark,
                      ),
                      
                      // Divider
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Divider(
                          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200,
                          height: 1,
                        ),
                      ),
                      
                      _buildNavItem(
                        icon: Icons.person_rounded,
                        label: 'Profile',
                        route: AppRoutes.profile,
                        isDark: isDark,
                      ),
                      _buildNavItem(
                        icon: Icons.headset_mic_rounded,
                        label: 'Support',
                        route: AppRoutes.supportConversations,
                        isDark: isDark,
                      ),
                    ],
                  ),
                ),
              ),
              
              // Bottom Section - Theme Toggle
              _buildBottomSection(isDark, themeProvider),
            ],
          ),
        );
      },
    );
  }

  Widget _buildToggleButton(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Align(
        alignment: widget.isExpanded ? Alignment.centerRight : Alignment.center,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: widget.onToggle,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                widget.isExpanded
                    ? Icons.chevron_left_rounded
                    : Icons.chevron_right_rounded,
                size: 20,
                color: isDark ? Colors.white70 : Colors.grey.shade600,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required String route,
    required bool isDark,
    String? badgeProvider,
  }) {
    final isActive = widget.activeRoute == route;
    final accentColor = AppColors.primary;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.pushReplacementNamed(context, route);
          },
          borderRadius: BorderRadius.circular(12),
          hoverColor: isDark
              ? Colors.white.withValues(alpha: 0.05)
              : Colors.grey.shade100,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.symmetric(
              horizontal: widget.isExpanded ? 14 : 0,
              vertical: 12,
            ),
            decoration: BoxDecoration(
              color: isActive
                  ? accentColor.withValues(alpha: isDark ? 0.15 : 0.1)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              border: isActive
                  ? Border.all(
                      color: accentColor.withValues(alpha: 0.3),
                      width: 1,
                    )
                  : null,
            ),
            child: Row(
              mainAxisAlignment: widget.isExpanded
                  ? MainAxisAlignment.start
                  : MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      icon,
                      size: 22,
                      color: isActive
                          ? accentColor
                          : (isDark ? Colors.white60 : Colors.grey.shade600),
                    ),
                    if (badgeProvider != null)
                      _buildBadge(badgeProvider, isDark),
                  ],
                ),
                if (widget.isExpanded) ...[
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                        color: isActive
                            ? accentColor
                            : (isDark ? Colors.white70 : Colors.grey.shade700),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(String providerType, bool isDark) {
    return Consumer(
      builder: (context, _, child) {
        int count = 0;
        if (providerType == 'cart') {
          count = Provider.of<CartProvider>(context).itemCount;
        } else if (providerType == 'wishlist') {
          count = Provider.of<WishlistProvider>(context).itemCount;
        }

        if (count == 0) return const SizedBox.shrink();

        return Positioned(
          top: -6,
          right: -8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.error,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: AppColors.error.withValues(alpha: 0.4),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Text(
              count > 99 ? '99+' : count.toString(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildBottomSection(bool isDark, ThemeProvider themeProvider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200,
            width: 1,
          ),
        ),
      ),
      child: widget.isExpanded
          ? Row(
              children: [
                Icon(
                  isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                  size: 20,
                  color: isDark ? Colors.white60 : Colors.grey.shade600,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    isDark ? 'Dark Mode' : 'Light Mode',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.white60 : Colors.grey.shade600,
                    ),
                  ),
                ),
                Switch.adaptive(
                  value: isDark,
                  onChanged: (_) => themeProvider.toggleTheme(),
                  activeColor: AppColors.primary,
                ),
              ],
            )
          : IconButton(
              onPressed: () => themeProvider.toggleTheme(),
              icon: Icon(
                isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                size: 20,
                color: isDark ? Colors.white60 : Colors.grey.shade600,
              ),
            ),
    );
  }
}
