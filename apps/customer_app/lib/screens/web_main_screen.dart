// lib/screens/web_main_screen.dart
// 💎 Web Main Screen - Layout shell with sidebar for web browsers

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_marketplace/widgets/web_sidebar.dart';
import 'package:letbuyy_marketplace/widgets/web_mobile_header.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

// Screen Imports
import 'home/home_screen.dart';
import 'reels/reels_feed_screen.dart';
import 'shop/shop_screen.dart';
import 'category/category_screen.dart';
import 'cart/cart_screen.dart';
import 'profile/profile_screen.dart';

/// Web-optimized main screen with sidebar navigation
class WebMainScreen extends StatefulWidget {
  final int initialIndex;

  const WebMainScreen({
    super.key,
    this.initialIndex = 0,
  });

  @override
  State<WebMainScreen> createState() => _WebMainScreenState();
}

class _WebMainScreenState extends State<WebMainScreen> {
  late int _currentIndex;
  bool _sidebarExpanded = true;
  
  // 🔑 GlobalKey to access Scaffold from header
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  // Route Mapping
  final List<String> _screenRoutes = [
    AppRoutes.home,       // 0
    AppRoutes.reels,      // 1
    AppRoutes.shop,       // 2
    AppRoutes.categories, // 3
    AppRoutes.cart,       // 4
    AppRoutes.profile,    // 5
  ];

  // Breakpoints
  static const double mobileBreakpoint = 768.0;
  static const double tabletBreakpoint = 1200.0;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
  }

  @override
  void didUpdateWidget(WebMainScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialIndex != oldWidget.initialIndex) {
      setState(() => _currentIndex = widget.initialIndex);
    }
  }

  String _getCurrentRoute() {
    if (_currentIndex >= 0 && _currentIndex < _screenRoutes.length) {
      return _screenRoutes[_currentIndex];
    }
    return AppRoutes.home;
  }

  void _openDrawer() {
    _scaffoldKey.currentState?.openDrawer();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final screenWidth = MediaQuery.of(context).size.width;

    // Determine layout type
    final isMobile = screenWidth < mobileBreakpoint;
    final isDesktop = screenWidth >= tabletBreakpoint;

    // Auto-collapse sidebar on mobile/tablet
    if (!isDesktop && _sidebarExpanded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _sidebarExpanded = false);
      });
    }

    final List<Widget> screens = [
      const HomeScreen(),
      ReelsFeedScreen(
        key: const ValueKey('reels_feed_web'),
        isTabActive: _currentIndex == 1,
      ),
      const ShopScreen(),
      const CategoryScreen(),
      const CartScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      drawer: isMobile ? _buildMobileDrawer(isDark) : null,
      body: Column(
        children: [
          // 📱 Mobile-style header on mobile web (hide for screens with their own header)
          if (isMobile && _currentIndex != 3) // 3 = CategoryScreen has its own header
            SafeArea(
              bottom: false,
              child: WebMobileHeader(onMenuPressed: _openDrawer),
            ),

          // Main content area
          Expanded(
            child: Row(
              children: [
                // Sidebar (hidden on mobile)
                if (!isMobile)
                  WebSidebar(
                    activeRoute: _getCurrentRoute(),
                    isExpanded: isDesktop && _sidebarExpanded,
                    onToggle: () {
                      setState(() => _sidebarExpanded = !_sidebarExpanded);
                    },
                  ),

                // Main Content
                Expanded(
                  child: IndexedStack(
                    index: _currentIndex,
                    children: screens,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileDrawer(bool isDark) {
    return Drawer(
      backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      child: WebSidebar(
        activeRoute: _getCurrentRoute(),
        isExpanded: true,
        onToggle: () => Navigator.pop(context),
      ),
    );
  }
}
