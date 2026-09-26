// lib/screens/user/main_screen.dart
// 💎 PREMIUM: Ultra-Professional Floating Navigation

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

// --- Theme & Routes ---
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

// --- Providers ---
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

// --- Screen Imports ---
import 'home/home_screen.dart';
import 'reels/reels_feed_screen.dart';
import 'shop/shop_screen.dart';
import 'category/category_screen.dart';
import 'cart/cart_screen.dart';
import 'profile/profile_screen.dart';

// Note: WebHeader import removed to prevent duplication as screens handle it internally

class MainScreen extends StatefulWidget {
  final int initialIndex;

  const MainScreen({
    super.key,
    this.initialIndex = 0,
  });

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late int _currentIndex;

  // Animations
  late AnimationController _bottomBarController;
  late Animation<Offset> _bottomBarSlideAnimation;

  bool _isNavigating = false;
  DateTime? _lastBackPressTime;

  // Route Mapping
  final List<String> _screenRoutes = [
    AppRoutes.home,       // 0
    AppRoutes.reels,      // 1
    AppRoutes.shop,       // 2
    AppRoutes.categories, // 3
    AppRoutes.cart,       // 4
    AppRoutes.profile,    // 5
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    WidgetsBinding.instance.addObserver(this);

    // Slide up animation for Bottom Bar
    _bottomBarController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _bottomBarSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 1.5),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _bottomBarController,
        curve: Curves.easeOutCubic,
      ),
    );

    // Start animations
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) _bottomBarController.forward();
    });

    _initializeData();
  }

  @override
  void didUpdateWidget(MainScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialIndex != oldWidget.initialIndex) {
      setState(() {
        _currentIndex = widget.initialIndex;
      });
    }
  }

  Future<void> _initializeData() async {
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      try {
        Provider.of<CartProvider>(context, listen: false).loadCart();
        Provider.of<WishlistProvider>(context, listen: false).loadWishlist();
        
        // 🚀 PERFORMANCE FIX: Removed ReelsPreloadProvider().initialize()
        // Video preloading is now deferred to ReelsFeedScreen.initState()
        // This eliminates blocking startup delay from MediaCodec initialization
      } catch (e) {
        debugPrint('❌ Error initializing data: $e');
      }
    });
  }
  // Phase 1R (R1 corrective, C2): the mandatory-update check was a direct FirebaseFirestore.instance
  // read with no canonical successor (R1.1) — removed rather than left as a try/caught no-op, since
  // "no update check happens" needs no honest-unavailable UI the way a missing cart does.

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshData();
    }
  }

  void _refreshData() {
    if (!mounted) return;
    Provider.of<CartProvider>(context, listen: false).loadCart();
    Provider.of<WishlistProvider>(context, listen: false).loadWishlist();
  }

  Future<void> _onTabTapped(int index) async {
    if (_isNavigating || _currentIndex == index) return;

    HapticFeedback.lightImpact(); // Subtle premium feedback
    setState(() => _isNavigating = true);

    if (kIsWeb) {
      Navigator.of(context).pushReplacementNamed(_screenRoutes[index]);
    } else {
      setState(() => _currentIndex = index);
    }

    await Future.delayed(const Duration(milliseconds: 150));
    if (mounted) setState(() => _isNavigating = false);
  }

  Future<void> _handleBackNavigation() async {
    if (_currentIndex == 1) { // Reels
      await _onTabTapped(0);
      return;
    }
    if (_currentIndex != 0) { // Not Home
      await _onTabTapped(0);
      return;
    }
    final now = DateTime.now();
    if (_lastBackPressTime == null ||
        now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
      _lastBackPressTime = now;
      _showSnackBar('Press back again to exit');
      return;
    }
    SystemNavigator.pop();
  }

  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: Colors.black87,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
        margin: const EdgeInsets.only(bottom: 80, left: 20, right: 20),
      ),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _bottomBarController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width > 900;
    final bool isOnReelsTab = _currentIndex == 1;

    final List<Widget> screens = [
      const HomeScreen(),
      ReelsFeedScreen(
        key: const ValueKey('reels_feed'),  // Stable key for proper updates
        isTabActive: isOnReelsTab,
      ),
      const ShopScreen(),
      const CategoryScreen(),
      const CartScreen(),
      const ProfileScreen(),
    ];

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) {
        if (!didPop) _handleBackNavigation();
      },
      child: Scaffold(
        resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
        extendBody: false, // Fixed nav bar, not floating
        body: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),
        // 🌐 WEB FIX: No bottom nav on web (use sidebar instead)
        // Only show bottom nav for native mobile apps
        bottomNavigationBar: kIsWeb 
            ? null  // Web uses sidebar navigation
            : (isOnReelsTab ? null : _buildPremiumFixedNavBar(isDark)),
      ),
    );
  }

  Widget _buildPremiumFixedNavBar(bool isDark) {
    return SlideTransition(
      position: _bottomBarSlideAnimation,
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: BoxDecoration(
              // Glassmorphic Background
              color: isDark 
                  ? AppColors.surfaceDark.withValues(alpha: 0.7) 
                  : AppColors.surface.withValues(alpha: 0.8),
              border: Border(
                top: BorderSide(
                  color: isDark 
                      ? Colors.white.withValues(alpha: 0.1) 
                      : Colors.black.withValues(alpha: 0.05),
                  width: 0.5,
                ),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Container(
                height: 70,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildInstagramNavItem(0, Icons.home_outlined, Icons.home_rounded, isDark),
                    _buildInstagramNavItem(1, Icons.slow_motion_video_outlined, Icons.slow_motion_video, isDark),
                    _buildInstagramNavItem(2, Icons.shopping_bag_outlined, Icons.shopping_bag_rounded, isDark),
                    _buildInstagramNavItem(3, Icons.grid_view_outlined, Icons.grid_view_rounded, isDark),
                    _buildInstagramNavItem(4, Icons.shopping_cart_outlined, Icons.shopping_cart_rounded, isDark, badge: 'cart'),
                    _buildInstagramNavItem(5, Icons.person_outline_rounded, Icons.person_rounded, isDark), // Changed to standard icon method for consistency call
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInstagramNavItem(int index, IconData outlineIcon, IconData filledIcon, bool isDark, {String? badge}) {
    final isSelected = _currentIndex == index;
    // Unified Icon Colors
    final iconColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final inactiveColor = isDark ? AppColors.textLightHint : AppColors.textHint;

    return Expanded(
      child: GestureDetector(
        onTap: () => _onTabTapped(index),
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: double.infinity,
          alignment: Alignment.center,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Icon with smooth transition
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 1.0, end: isSelected ? 1.08 : 1.0),
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOutCubic,
                builder: (context, scale, child) {
                  return Transform.scale(
                    scale: scale,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      transitionBuilder: (child, animation) {
                        return FadeTransition(opacity: animation, child: child);
                      },
                      child: Icon(
                        isSelected ? filledIcon : outlineIcon,
                        key: ValueKey(isSelected),
                        size: 28, // Larger icons like Instagram
                        color: isSelected ? iconColor : inactiveColor,
                      ),
                    ),
                  );
                },
              ),
              
              // Notification dot (Instagram style - small dot, not number)
              if (badge != null) _buildInstagramBadge(badge),
            ],
          ),
        ),
      ),
    );
  }

  // Instagram-style profile icon with avatar
  Widget _buildProfileNavItem(int index, bool isDark) {
    final isSelected = _currentIndex == index;
    final iconColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final inactiveColor = isDark ? AppColors.textLightHint : AppColors.textHint;

    return Expanded(
      child: GestureDetector(
        onTap: () => _onTabTapped(index),
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: double.infinity,
          alignment: Alignment.center,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 1.0, end: isSelected ? 1.08 : 1.0),
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            builder: (context, scale, child) {
              return Transform.scale(
                scale: scale,
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? iconColor : Colors.transparent,
                      width: 2,
                    ),
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isDark ? AppColors.surfaceVariant.withValues(alpha: 0.1) : AppColors.surfaceVariant,
                    ),
                    child: Icon(
                      isSelected ? Icons.person_rounded : Icons.person_outline_rounded,
                      size: 18,
                      color: isSelected ? iconColor : inactiveColor,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  // Instagram-style small red dot (not number)
  Widget _buildInstagramBadge(String providerType) {
    return Positioned(
      top: -2,
      right: -6,
      child: Consumer(
        builder: (context, _, child) {
          int count = 0;
          if (providerType == 'cart') {
            count = Provider.of<CartProvider>(context).itemCount;
          } else if (providerType == 'wishlist') {
            count = Provider.of<WishlistProvider>(context).itemCount;
          }

          if (count == 0) return const SizedBox.shrink();

          return TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: const Duration(milliseconds: 300),
            curve: Curves.elasticOut,
            builder: (context, value, child) {
              return Transform.scale(
                scale: value,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: AppColors.error, // Unified Error/Notification color
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.error.withValues(alpha: 0.4),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      )
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
