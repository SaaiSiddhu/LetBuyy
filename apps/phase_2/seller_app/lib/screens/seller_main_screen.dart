import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../providers/seller_provider.dart';
import '../app/routes.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

// Screens
import 'dashboard/new_seller_dashboard.dart';
import 'products/seller_product_management_screen.dart';
import 'orders/seller_order_management_screen.dart';
import 'wallet/seller_wallet_screen.dart';
import 'analytics/seller_analytics_screen.dart';
import 'settings/seller_settings_screen.dart';
import 'ads/seller_ads_screen.dart';
import 'reels/seller_reels_screen.dart';
import 'deals/seller_deals_screen.dart';
import 'dashboard/widgets/store_auth_approval_dialog.dart';

class SellerMainScreen extends StatefulWidget {
  const SellerMainScreen({super.key});

  @override
  State<SellerMainScreen> createState() => _SellerMainScreenState();
}

class _SellerMainScreenState extends State<SellerMainScreen> {
  int _currentIndex = 0;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  late final List<Widget> _screens;

  // Maps Bottom Nav index to the main screen index
  // 0=Dashboard, 1=Products, 2=Orders, 3=Wallet, 4=More (opens drawer)
  final List<int> _mobileScreenIndices = [0, 1, 2, 3, -1]; // -1 = drawer

  @override
  void initState() {
    super.initState();
    _screens = [
      const NewSellerDashboard(), // 0
      const SellerProductManagementScreen(), // 1
      const SellerOrderManagementScreen(), // 2
      const SellerWalletScreen(), // 3
      const SellerAdsScreen(), // 4 - Sponsored Ads
      const SellerAnalyticsScreen(), // 5
      const SellerReelsScreen(), // 6 - Reels
      const SellerSettingsScreen(), // 7
    ];
  }

  // Helper to get the current Bottom Nav index
  int _getMobileCurrentIndex() {
    int mobileIndex = _mobileScreenIndices.indexOf(_currentIndex);
    if (mobileIndex != -1 && mobileIndex < 4) {
      return mobileIndex;
    }
    return 4; // "More" tab for other screens
  }

  // ===================================
  // ✅ Back Button Logic
  // ===================================
  Future<bool> _onWillPop(bool isDark) async {
    final isMobile = MediaQuery.of(context).size.width < 768;
    if (!isMobile) {
      return true;
    }

    if (_scaffoldKey.currentState?.isDrawerOpen == true) {
      Navigator.pop(context);
      return false;
    }
    
    if (_scaffoldKey.currentState?.isEndDrawerOpen == true) {
      Navigator.pop(context);
      return false;
    }

    if (_currentIndex != 0) {
      setState(() {
        _currentIndex = 0;
      });
      return false;
    } else {
      final bool? shouldExit = await _showExitDialog(isDark);
      if (shouldExit == true) {
        if (mounted) {
          AppRoutes.navigateAndRemoveUntil(context, AppRoutes.sellerMain);
        }
        return false;
      }
      return false;
    }
  }

  Future<bool?> _showExitDialog(bool isDark) async {
    return showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              margin: const EdgeInsets.all(0),
              decoration: BoxDecoration(
                color: (isDark ? AppColors.surfaceDark : AppColors.surface).withValues(alpha: 0.9),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
                boxShadow: [
                  BoxShadow(
                    color: isDark ? AppColors.shadowDark : AppColors.shadowMedium,
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.exit_to_app_rounded,
                            size: 30,
                            color: isDark ? AppColors.primaryLight : AppColors.primary,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Exit Seller Panel?',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: isDark ? AppColors.textLight : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Are you sure you want to go back to the shop?',
                          style: TextStyle(
                            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                            fontSize: 14,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context, false),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              side: BorderSide(
                                color: isDark ? AppColors.borderDark : AppColors.border,
                              ),
                            ),
                            child: Text(
                              'Cancel',
                              style: TextStyle(
                                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(context, true),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
                              foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text(
                              'Exit',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sellerProvider = Provider.of<SellerProvider>(context);
    final isMobile = MediaQuery.of(context).size.width < 768;
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    // ✅ Auth is now fully handled by AuthGate widget - no duplicate check needed
    // If user reaches this screen, they are already verified by AuthGate

    return WillPopScope(
      onWillPop: () => _onWillPop(isDark),
      child: StoreAuthRequestListener(
        sellerId: sellerProvider.sellerId ?? '',
        child: Scaffold(
          key: _scaffoldKey,
          backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
          appBar: null,
          // ✅ Let child screens handle SafeArea for consistent themed headers
          extendBody: true,
          extendBodyBehindAppBar: true,
          // drawer: opens on left side
          drawer: isMobile ? _buildMobileDrawer(sellerProvider, isDark) : null,
          endDrawer: null,
          body: Row(
            children: [
              if (!isMobile) _buildSideNavigation(sellerProvider, isDark),
              Expanded(
                child: IndexedStack(
                  index: _currentIndex,
                  children: _screens,
                ),
              ),
            ],
          ),
          bottomNavigationBar: isMobile ? _buildBottomNavigation(isDark) : null,
        ),
      ),
    );
  }

  // ===================================
  // 📱 MOBILE DRAWER
  // ===================================
  Widget _buildMobileDrawer(SellerProvider sellerProvider, bool isDark) {
    final seller = sellerProvider.currentSeller;
    
    return Drawer(
      width: 280, // ✅ Fixed width for better compactness
      backgroundColor: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0F172A) : Colors.white,
        ),
        child: SafeArea(
          child: Column(
            children: [
              // ✨ Compact Header
              Container(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: isDark ? Colors.white10 : Colors.grey[100]!)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.1)),
                      ),
                      child: seller?.photoUrl != null && seller!.photoUrl!.isNotEmpty
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(11),
                              child: Image.network(seller.photoUrl!, fit: BoxFit.cover),
                            )
                          : const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            seller?.storeName ?? 'Seller Panel',
                            style: TextStyle(
                              color: isDark ? Colors.white : Colors.black87,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (seller != null)
                            Row(
                              children: [
                                Icon(
                                  seller.isVerified ? Icons.verified_rounded : Icons.pending_rounded,
                                  size: 10,
                                  color: seller.isVerified ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  seller.verificationBadge,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: isDark ? Colors.white60 : Colors.grey[600],
                                  ),
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.close_rounded, size: 20, color: isDark ? Colors.white54 : Colors.grey[400]),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              ),
              
              // 📋 Compact Menu Items
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  children: [
                    _buildDrawerSectionPro('MAIN', isDark),
                    _buildDrawerItemPro(Icons.dashboard_rounded, 'Dashboard', 0, isDark),
                    _buildDrawerItemPro(Icons.inventory_2_rounded, 'Products', 1, isDark),
                    _buildDrawerItemPro(Icons.shopping_bag_rounded, 'Orders', 2, isDark),
                    _buildDrawerItemPro(Icons.account_balance_wallet_rounded, 'Wallet', 3, isDark),
                    
                    const SizedBox(height: 12),
                    _buildDrawerSectionPro('GROWTH', isDark),
                    _buildDrawerItemPro(Icons.campaign_rounded, 'Sponsored Ads', 4, isDark),
                    _buildDrawerItemPro(Icons.play_circle_rounded, 'Reels', 6, isDark),
                    _buildDrawerItemWithBadgePro(
                      Icons.local_fire_department_rounded, 
                      'Flash Deals', 
                      isDark,
                      badgeText: 'NEW',
                      badgeColor: AppColors.error,
                      onTap: () {
                        Navigator.pop(context);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => SellerDealsScreen(sellerId: Provider.of<SellerProvider>(context, listen: false).sellerId ?? ''),
                          ),
                        );
                      },
                    ),
                    
                    const SizedBox(height: 12),
                    _buildDrawerSectionPro('INSIGHTS', isDark),
                    _buildDrawerItemPro(Icons.analytics_rounded, 'Analytics', 5, isDark),
                    
                    const SizedBox(height: 12),
                    _buildDrawerSectionPro('SYSTEM', isDark),
                    _buildDrawerItemPro(Icons.settings_rounded, 'Settings', 7, isDark),
                  ],
                ),
              ),
              
              // 🔒 Compact Logout
              Container(
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: isDark ? Colors.white10 : Colors.grey[100]!)),
                ),
                padding: const EdgeInsets.all(12),
                child: InkWell(
                  onTap: () => _showLogoutDialog(isDark),
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.logout_rounded, color: AppColors.error, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Logout',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              // App version
              Padding(
                padding: const EdgeInsets.only(bottom: 8, top: 4),
                child: Text(
                  'v1.0.0',
                  style: TextStyle(fontSize: 9, color: isDark ? Colors.white24 : Colors.grey[300]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ✨ Compact Section Header
  Widget _buildDrawerSectionPro(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 6),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: isDark ? Colors.white24 : Colors.grey[400],
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  // ✨ Compact Drawer Item
  Widget _buildDrawerItemPro(IconData icon, String label, int index, bool isDark) {
    final isSelected = _currentIndex == index;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.pop(context);
            setState(() => _currentIndex = index);
          },
          borderRadius: BorderRadius.circular(8),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primary.withValues(alpha: 0.1) : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 18, // Compact icon
                  color: isSelected ? AppColors.primary : (isDark ? Colors.white60 : Colors.grey[600]),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13, // Compact text
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                      color: isSelected ? AppColors.primary : (isDark ? Colors.white : Colors.grey[800]),
                    ),
                  ),
                ),
                if (isSelected)
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ✨ Compact Drawer Item with Badge
  Widget _buildDrawerItemWithBadgePro(
    IconData icon, 
    String label, 
    bool isDark, {
    required String badgeText,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: badgeColor), // Compact icon
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 13, // Compact text
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.grey[800],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: badgeColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    badgeText,
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                      color: badgeColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 🔒 Logout Confirmation Dialog
  Future<void> _showLogoutDialog(bool isDark) async {
    Navigator.pop(context); // Close drawer first
    
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: (isDark ? const Color(0xFF1E293B) : Colors.white).withValues(alpha: 0.95),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 30,
                    offset: const Offset(0, 15),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.logout_rounded,
                      size: 32,
                      color: AppColors.error,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Logout',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : Colors.grey[900],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Are you sure you want to logout from your seller account?',
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.white60 : Colors.grey[600],
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(context, false),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            side: BorderSide(
                              color: isDark ? Colors.white24 : Colors.grey[300]!,
                            ),
                          ),
                          child: Text(
                            'Cancel',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white70 : Colors.grey[700],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => Navigator.pop(context, true),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            backgroundColor: AppColors.error,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            elevation: 0,
                          ),
                          child: const Text(
                            'Logout',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    
    if (confirmed == true && mounted) {
      final sellerProvider = Provider.of<SellerProvider>(context, listen: false);
      await sellerProvider.signOut();
      if (mounted) {
        AppRoutes.navigateAndRemoveUntil(context, AppRoutes.login);
      }
    }
  }

  Widget _buildDrawerSection(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: isDark ? Colors.white38 : Colors.grey[500],
          letterSpacing: 1,
        ),
      ),
    );
  }

  Widget _buildDrawerItem(IconData icon, String label, int index, bool isDark) {
    final isSelected = _currentIndex == index;
    
    return ListTile(
      onTap: () {
        Navigator.pop(context);
        setState(() => _currentIndex = index);
      },
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isSelected 
              ? AppColors.primary.withValues(alpha: 0.15) 
              : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(
          icon,
          size: 18,
          color: isSelected ? AppColors.primary : (isDark ? Colors.white70 : Colors.grey[700]),
        ),
      ),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 14,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          color: isSelected 
              ? AppColors.primary 
              : (isDark ? Colors.white : Colors.grey[800]),
        ),
      ),
      trailing: isSelected 
          ? Container(
              width: 4,
              height: 20,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            )
          : null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
    );
  }

  Widget _buildDrawerItemWithBadge(
    IconData icon, 
    String label, 
    bool isDark, {
    required String badgeText,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: badgeColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: badgeColor),
      ),
      title: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : Colors.grey[800],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: badgeColor,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              badgeText,
              style: const TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20),
    );
  }

  // ===================================
  // 🧱 SIDE NAVIGATION (Desktop)
  // ===================================
  Widget _buildSideNavigation(SellerProvider sellerProvider, bool isDark) {
    return Container(
      width: 280,
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF0F172A) : Colors.white).withValues(alpha: 0.6),
        boxShadow: [
          BoxShadow(
            color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(2, 0),
          ),
        ],
        border: Border(
          right: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
          ),
        ),
      ),
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Column(
            children: [
              _buildSellerHeader(sellerProvider, isDark),
              Divider(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1), height: 1),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                  children: [
                    _buildNavItem(0, Icons.dashboard_rounded, 'Dashboard', isDark),
                    _buildNavItem(1, Icons.inventory_2_rounded, 'Products', isDark),
                    _buildNavItem(2, Icons.shopping_bag_rounded, 'Orders', isDark),
                    _buildNavItem(3, Icons.account_balance_wallet_rounded, 'Wallet', isDark),
                    _buildNavItem(4, Icons.campaign_rounded, 'Ads', isDark),
                    _buildNavItem(5, Icons.analytics_rounded, 'Analytics', isDark),
                    _buildNavItem(6, Icons.play_circle_rounded, 'Reels', isDark),
                    _buildNavItem(7, Icons.settings_rounded, 'Settings', isDark),
                    const SizedBox(height: 16),
                    Divider(color: isDark ? Colors.white10 : Colors.grey[200]),
                    const SizedBox(height: 16),
                    // Deals - Desktop Side Nav
                    _buildNavItemWithBadge(
                      Icons.local_fire_department_rounded, 
                      'Flash Deals', 
                      isDark,
                      badgeText: 'NEW',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => SellerDealsScreen(sellerId: Provider.of<SellerProvider>(context, listen: false).sellerId ?? ''),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
              Divider(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.1), height: 1),
              _buildBackToShopButton(isDark),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  // 👤 Seller Header
  Widget _buildSellerHeader(SellerProvider sellerProvider, bool isDark) {
    final seller = sellerProvider.currentSeller;
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.storefront_rounded, size: 40, color: AppColors.primary),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            seller?.storeName ?? 'Seller Panel',
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontSize: 18,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
            textAlign: TextAlign.center,
          ),
          if (seller != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: seller.isVerified
                    ? const Color(0xFF10B981).withValues(alpha: 0.15)
                    : const Color(0xFFF59E0B).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: seller.isVerified
                      ? const Color(0xFF10B981).withValues(alpha: 0.3)
                      : const Color(0xFFF59E0B).withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                seller.verificationBadge,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: seller.isVerified ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // compass Navigation Item (Desktop)
  Widget _buildNavItem(int index, IconData icon, String label, bool isDark) {
    final isSelected = _currentIndex == index;
    final Color accentColor = AppColors.primary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: () => setState(() => _currentIndex = index),
          child: AnimatedContainer(
            duration: 200.ms,
            decoration: BoxDecoration(
              color: isSelected ? accentColor : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              boxShadow: isSelected ? [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                )
              ] : [],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon,
                    color: isSelected
                        ? Colors.white
                        : (isDark ? Colors.grey[400] : Colors.grey[600]),
                    size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isSelected
                          ? Colors.white
                          : (isDark ? Colors.grey[400] : Colors.grey[600]),
                      fontSize: 14,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
                if (isSelected)
                  const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 18)
                      .animate()
                      .fadeIn(duration: 200.ms)
                      .slideX(begin: 0.2),
              ],
            ),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 200.ms, delay: (50 * (index + 1)).ms).moveX(begin: -10);
  }

  Widget _buildNavItemWithBadge(
    IconData icon, 
    String label, 
    bool isDark, {
    required String badgeText,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.2)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, color: AppColors.error, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: AppColors.error,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    badgeText,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 🔒 Logout Button (Desktop)
  Widget _buildBackToShopButton(bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // App version
          Text(
            'Seller App v1.0.0',
            style: TextStyle(
              fontSize: 10,
              color: isDark ? Colors.white24 : Colors.grey[400],
            ),
          ),
          const SizedBox(height: 12),
          // Logout button
          MouseRegion(
            cursor: SystemMouseCursors.click,
            child: GestureDetector(
              onTap: () => _showLogoutDialog(isDark),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.15)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.logout_rounded, color: AppColors.error, size: 18),
                    const SizedBox(width: 10),
                    Text(
                      'Logout',
                      style: TextStyle(
                        color: AppColors.error,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ).animate().fadeIn(duration: 300.ms, delay: 200.ms),
        ],
      ),
    );
  }

  // ===================================
  // 📱 Premium Floating Navigation (Mobile)
  // ===================================
  Widget _buildBottomNavigation(bool isDark) {
    final int currentMobileIndex = _getMobileCurrentIndex();
    final accentColor = AppColors.primary;
    final unselectedColor = isDark ? Colors.grey[500] : Colors.grey[400];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(32),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Container(
            decoration: BoxDecoration(
              color: (isDark ? const Color(0xFF1E293B) : const Color(0xFFFFFFFF)).withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(32),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                  spreadRadius: -2,
                ),
              ],
            ),
            child: Theme(
              data: Theme.of(context).copyWith(
                splashColor: Colors.transparent,
                highlightColor: Colors.transparent,
              ),
              child: BottomNavigationBar(
                currentIndex: currentMobileIndex,
                onTap: (index) {
                  HapticFeedback.lightImpact();
                  if (index == 4) {
                    // Open drawer for "More"
                    _scaffoldKey.currentState?.openDrawer();
                  } else {
                    setState(() => _currentIndex = _mobileScreenIndices[index]);
                  }
                },
                type: BottomNavigationBarType.fixed,
                backgroundColor: Colors.transparent,
                selectedItemColor: accentColor,
                unselectedItemColor: unselectedColor,
                showSelectedLabels: true,
                showUnselectedLabels: true,
                selectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                unselectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
                elevation: 0,
                enableFeedback: true,
                items: [
                  _buildNavItemIcon(Icons.dashboard_rounded, Icons.dashboard_outlined, 'Home'),
                  _buildNavItemIcon(Icons.inventory_2_rounded, Icons.inventory_2_outlined, 'Products'),
                  _buildNavItemIcon(Icons.shopping_bag_rounded, Icons.shopping_bag_outlined, 'Orders'),
                  _buildNavItemIcon(Icons.account_balance_wallet_rounded, Icons.account_balance_wallet_outlined, 'Wallet'),
                  _buildNavItemIcon(Icons.menu_rounded, Icons.menu_rounded, 'More'),
                ],
              ),
            ),
          ),
        ),
      ),
    ).animate().slideY(begin: 1, duration: 500.ms, curve: Curves.easeOutQuart);
  }

  BottomNavigationBarItem _buildNavItemIcon(IconData active, IconData inactive, String label) {
    return BottomNavigationBarItem(
      icon: Icon(inactive, size: 24),
      activeIcon: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.15),
          shape: BoxShape.circle,
        ),
        child: Icon(active, size: 22, color: AppColors.primary),
      ).animate().scale(begin: const Offset(0.8, 0.8), curve: Curves.easeOutBack, duration: 200.ms),
      label: label,
    );
  }
}
