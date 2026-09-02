// lib/screens/admin_shell_screen.dart
// Admin Shell Screen - Persistent sidebar/bottom nav wrapper for GoRouter

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../app/app_router.dart';

// ═══════════════════════════════════════════════════════════════════════════
// NAV ITEM MODEL
// ═══════════════════════════════════════════════════════════════════════════

class _NavSection {
  final String title;
  final List<_NavItem> items;
  const _NavSection(this.title, this.items);
}

class _NavItem {
  final IconData icon;
  final String label;
  final String path;
  final String? badge;
  final Color? badgeColor;
  const _NavItem(this.icon, this.label, this.path, {this.badge, this.badgeColor});
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN SHELL SCREEN
// ═══════════════════════════════════════════════════════════════════════════

class AdminShellScreen extends StatefulWidget {
  final String currentPath;
  final Widget child;

  const AdminShellScreen({
    super.key,
    required this.currentPath,
    required this.child,
  });

  @override
  State<AdminShellScreen> createState() => _AdminShellScreenState();
}

class _AdminShellScreenState extends State<AdminShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _isSidebarCollapsed = false;
  
  // FocusNode for drawer search - CRITICAL for keyboard handling
  final FocusNode _searchFocusNode = FocusNode();

  @override
  void dispose() {
    _searchFocusNode.dispose();
    super.dispose();
  }

  // Navigation structure - Modern Material Icons
  final List<_NavSection> _navSections = const [
    _NavSection('Overview', [
      _NavItem(Icons.widgets_rounded, 'Dashboard', '/dashboard'),
    ]),
    _NavSection('Catalog', [
      _NavItem(Icons.grid_view_rounded, 'Categories', '/categories'),
      _NavItem(Icons.shopping_bag_outlined, 'Products', '/products'),
    ]),
    _NavSection('Operations', [
      _NavItem(Icons.local_shipping_outlined, 'Orders', '/orders'),
      _NavItem(Icons.keyboard_return_rounded, 'Returns', '/returns'),
      _NavItem(Icons.account_balance_wallet_outlined, 'Payouts', '/payouts'),
    ]),
    _NavSection('Users & Sellers', [
      _NavItem(Icons.group_outlined, 'Users', '/users'),
      _NavItem(Icons.store_outlined, 'Sellers', '/sellers'),
    ]),
    _NavSection('Marketing', [
      _NavItem(Icons.image_outlined, 'Banners', '/banners'),
      _NavItem(Icons.campaign_outlined, 'Sponsored Ads', '/sponsored-ads'),
      _NavItem(Icons.confirmation_number_outlined, 'Coupons', '/coupons'),
      _NavItem(Icons.bolt_rounded, 'Flash Deals', '/deals', badge: 'HOT', badgeColor: Colors.deepOrange),
      _NavItem(Icons.play_circle_outline_rounded, 'Reels', '/reels'),
    ]),
    _NavSection('Analytics & Reports', [
      _NavItem(Icons.insights_rounded, 'Analytics', '/analytics'),
      _NavItem(Icons.percent_rounded, 'Commission', '/commission'),
    ]),
    _NavSection('Communication', [
      _NavItem(Icons.notifications_outlined, 'Notifications', '/notifications'),
      _NavItem(Icons.headset_mic_outlined, 'Support', '/support'),
    ]),
    _NavSection('System', [
      _NavItem(Icons.dns_outlined, 'Domain Requests', '/domain-requests', badge: 'NEW', badgeColor: Colors.teal),
      _NavItem(Icons.system_update_alt_rounded, 'App Updates', '/app-updates'),
      _NavItem(Icons.tune_rounded, 'Settings', '/settings'),
    ]),
  ];

  // Mobile bottom nav items: Dashboard, Products, Orders, Categories, Settings, More
  final List<_NavItem> _mobileNavItems = const [
    _NavItem(Icons.widgets_rounded, 'Dashboard', '/dashboard'),
    _NavItem(Icons.shopping_bag_outlined, 'Products', '/products'),
    _NavItem(Icons.local_shipping_outlined, 'Orders', '/orders'),
    _NavItem(Icons.grid_view_rounded, 'Categories', '/categories'),
    _NavItem(Icons.tune_rounded, 'Settings', '/settings'),
  ];

  bool _isPathActive(String path) {
    final currentPath = widget.currentPath;
    if (path == currentPath) return true;
    if (path != '/dashboard' && currentPath.startsWith(path)) return true;
    return false;
  }

  int _getMobileNavIndex() {
    for (int i = 0; i < _mobileNavItems.length; i++) {
      if (_isPathActive(_mobileNavItems[i].path)) return i;
    }
    return 5; // More
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isDesktop = screenWidth >= 1024;
    final isTablet = screenWidth >= 768 && screenWidth < 1024;
    final isMobile = screenWidth < 768;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) => _onWillPop(isDark),
      child: Scaffold(
        key: _scaffoldKey,
        // Use default behavior - let Flutter handle keyboard resize properly
        backgroundColor: isDark ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
        drawer: isMobile ? _buildMobileDrawer(isDark) : null,
        body: Row(
          children: [
            // SIDEBAR (Desktop & Tablet)
            if (isDesktop || isTablet)
              _buildSidebar(isDark, isCollapsed: isTablet || _isSidebarCollapsed),

            // MAIN CONTENT
            Expanded(
              child: widget.child,
            ),
          ],
        ),
        // Always show bottom nav on mobile - keyboard dismissal handled by OS
        bottomNavigationBar: isMobile ? _buildBottomNav(isDark) : null,
      ),
    );
  }

  Future<bool> _onWillPop(bool isDark) async {
    if (widget.currentPath != '/dashboard') {
      context.go(AppRouter.dashboard);
      return false;
    }
    return await _showExitDialog(isDark);
  }

  Future<bool> _showExitDialog(bool isDark) async {
    return await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A2E) : Colors.white,
        title: Text('Exit App?', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
        content: Text('Are you sure you want to exit?', style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Exit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    ) ?? false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREMIUM COMPACT BOTTOM NAVIGATION (Mobile)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildBottomNav(bool isDark) {
    final currentIndex = _getMobileNavIndex();

    return Container(
      margin: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      height: 64,
      decoration: BoxDecoration(
        color: isDark 
            ? const Color(0xFF1A1A2E).withValues(alpha: 0.98) 
            : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: isDark 
                ? Colors.black.withValues(alpha: 0.5) 
                : AppColors.primary.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: isDark 
              ? Colors.white.withValues(alpha: 0.06) 
              : Colors.grey.withValues(alpha: 0.08),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          for (int i = 0; i < _mobileNavItems.length; i++)
            _buildCompactNavItem(
              icon: _mobileNavItems[i].icon,
              label: _mobileNavItems[i].label,
              isActive: currentIndex == i,
              isDark: isDark,
              onTap: () => context.go(_mobileNavItems[i].path),
            ),
          _buildCompactNavItem(
            icon: Icons.apps_rounded,
            label: 'More',
            isActive: currentIndex == 5,
            isDark: isDark,
            onTap: () => _scaffoldKey.currentState?.openDrawer(),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactNavItem({
    required IconData icon,
    required String label,
    required bool isActive,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    final activeColor = AppColors.primary;
    final inactiveColor = isDark ? Colors.white54 : Colors.grey[500];

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 52,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Icon
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isActive ? activeColor.withValues(alpha: 0.12) : Colors.transparent,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                color: isActive ? activeColor : inactiveColor,
                size: 22,
              ),
            ),
            const SizedBox(height: 2),
            // Label
            Text(
              label,
              style: TextStyle(
                color: isActive ? activeColor : inactiveColor,
                fontSize: 9,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBILE DRAWER
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildMobileDrawer(bool isDark) {
    // ═══════════════════════════════════════════════════════════════════════
    // PRODUCTION-GRADE KEYBOARD HANDLING - Uses FocusManager
    // ═══════════════════════════════════════════════════════════════════════
    return PopScope(
      // INTERCEPT BACK BUTTON: If any input has focus, close keyboard instead
      canPop: FocusManager.instance.primaryFocus == null || 
              FocusManager.instance.primaryFocus!.context == null,
      onPopInvokedWithResult: (didPop, _) {
        if (FocusManager.instance.primaryFocus != null) {
          FocusManager.instance.primaryFocus!.unfocus();
          return; // Don't pop/close drawer
        }
      },
      child: Drawer(
        backgroundColor: isDark ? const Color(0xFF12121A) : const Color(0xFFFAFAFA),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.only(
            topRight: Radius.circular(24),
            bottomRight: Radius.circular(24),
          ),
        ),
        child: GestureDetector(
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          behavior: HitTestBehavior.opaque,
          child: SafeArea(
            child: Column(
              children: [
            // Premium Header
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isDark 
                      ? [const Color(0xFF1A1A2E), const Color(0xFF12121A)]
                      : [Colors.white, const Color(0xFFFAFAFA)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              child: Column(
                children: [
                  // Logo and Title Row
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.asset(
                            'assets/icons/app_icon.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'LetBuyy',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: isDark ? Colors.white : Colors.black87,
                                letterSpacing: -0.5,
                              ),
                            ),
                            Text(
                              'Admin Console',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? Colors.white54 : Colors.grey[600],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Close button
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            Icons.close_rounded,
                            color: isDark ? Colors.white54 : Colors.grey[600],
                            size: 18,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Search Bar with Autocomplete
                  _buildSearchBar(isDark),
                ],
              ),
            ),
            
            // Navigation Items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                children: _navSections.map((section) => _buildDrawerSection(section, isDark)).toList(),
              ),
            ),
            
            // Bottom Actions
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.withValues(alpha: 0.15),
                  ),
                ),
              ),
              child: Row(
                children: [
                  // User Avatar
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary.withValues(alpha: 0.2), AppColors.primary.withValues(alpha: 0.1)],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.person_rounded, color: AppColors.primary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          FirebaseAuth.instance.currentUser?.displayName ?? 
                              FirebaseAuth.instance.currentUser?.email?.split('@').first ?? 
                              'Admin',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          'Super Admin',
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? Colors.white54 : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Logout Button
                  GestureDetector(
                    onTap: _logout,
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.logout_rounded, color: Colors.red, size: 20),
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
  );
}

  // Premium Search Bar with Autocomplete
  Widget _buildSearchBar(bool isDark) {
    return Autocomplete<_NavItem>(
      optionsBuilder: (TextEditingValue textEditingValue) {
        if (textEditingValue.text.isEmpty) {
          return const Iterable<_NavItem>.empty();
        }
        final query = textEditingValue.text.toLowerCase();
        final allItems = _navSections.expand((s) => s.items).toList();
        return allItems.where((item) => 
            item.label.toLowerCase().contains(query) ||
            item.path.toLowerCase().contains(query));
      },
      displayStringForOption: (item) => item.label,
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        // Sync focus with our managed FocusNode
        focusNode.addListener(() {
          if (focusNode.hasFocus && !_searchFocusNode.hasFocus) {
            _searchFocusNode.requestFocus();
          } else if (!focusNode.hasFocus && _searchFocusNode.hasFocus) {
            _searchFocusNode.unfocus();
          }
        });
        
        return Container(
          height: 44,
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.15),
            ),
          ),
          child: TextField(
            controller: controller,
            focusNode: _searchFocusNode, // Use our managed FocusNode
            onTapOutside: (_) => _searchFocusNode.unfocus(), // Dismiss on tap outside
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 14,
            ),
            decoration: InputDecoration(
              hintText: 'Search pages...',
              hintStyle: TextStyle(
                color: isDark ? Colors.white38 : Colors.grey[400],
                fontSize: 14,
              ),
              prefixIcon: Icon(
                Icons.search_rounded,
                color: isDark ? Colors.white38 : Colors.grey[400],
                size: 20,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            color: isDark ? const Color(0xFF1A1A2E) : Colors.white,
            child: Container(
              width: 240,
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.builder(
                padding: const EdgeInsets.all(8),
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final item = options.elementAt(index);
                  return ListTile(
                    dense: true,
                    leading: Icon(item.icon, size: 20, color: AppColors.primary),
                    title: Text(
                      item.label,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontSize: 14,
                      ),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    onTap: () {
                      onSelected(item);
                      Navigator.pop(context);
                      this.context.go(item.path);
                    },
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDrawerSection(_NavSection section, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            section.title.toUpperCase(),
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.white38 : Colors.grey[500], letterSpacing: 1),
          ),
        ),
        ...section.items.map((item) => _buildDrawerItem(item, isDark)),
      ],
    );
  }

  Widget _buildDrawerItem(_NavItem item, bool isDark) {
    final isActive = _isPathActive(item.path);
    final activeColor = AppColors.primary;

    return ListTile(
      leading: Icon(item.icon, color: isActive ? activeColor : (isDark ? Colors.white70 : Colors.grey[700]), size: 22),
      title: Row(
        children: [
          Text(
            item.label,
            style: TextStyle(
              color: isActive ? activeColor : (isDark ? Colors.white : Colors.black87),
              fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
          if (item.badge != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: item.badgeColor ?? Colors.red, borderRadius: BorderRadius.circular(8)),
              child: Text(item.badge!, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ],
      ),
      selected: isActive,
      selectedTileColor: activeColor.withValues(alpha: 0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pop(context); // Close drawer
        context.go(item.path);
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR (Desktop/Tablet)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSidebar(bool isDark, {bool isCollapsed = false}) {
    final sidebarWidth = isCollapsed ? 72.0 : 260.0;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: sidebarWidth,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0D0D12) : Colors.white,
        border: Border(
          right: BorderSide(color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.shade200),
        ),
      ),
      child: Column(
        children: [
          // Header
          _buildSidebarHeader(isDark, isCollapsed),
          const Divider(height: 1),
          // Navigation
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: _navSections.map((section) => _buildSidebarSection(section, isDark, isCollapsed)).toList(),
            ),
          ),
          // Collapse Button & Logout
          const Divider(height: 1),
          if (!isCollapsed)
            ListTile(
              leading: Icon(_isSidebarCollapsed ? Icons.chevron_right : Icons.chevron_left, color: isDark ? Colors.white54 : Colors.grey),
              title: Text('Collapse', style: TextStyle(color: isDark ? Colors.white54 : Colors.grey)),
              onTap: () => setState(() => _isSidebarCollapsed = !_isSidebarCollapsed),
            ),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: Colors.red),
            title: isCollapsed ? null : const Text('Logout', style: TextStyle(color: Colors.red)),
            onTap: _logout,
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildSidebarHeader(bool isDark, bool isCollapsed) {
    return Container(
      height: 70,
      padding: EdgeInsets.symmetric(horizontal: isCollapsed ? 16 : 20),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.admin_panel_settings, color: Colors.white, size: 22),
          ),
          if (!isCollapsed) ...[
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('LetBuyy', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                  Text('Admin Panel', style: TextStyle(fontSize: 12, color: isDark ? Colors.white54 : Colors.grey[600])),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSidebarSection(_NavSection section, bool isDark, bool isCollapsed) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!isCollapsed)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Text(
              section.title.toUpperCase(),
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: isDark ? Colors.white30 : Colors.grey[400], letterSpacing: 1.2),
            ),
          ),
        ...section.items.map((item) => _buildSidebarItem(item, isDark, isCollapsed)),
      ],
    );
  }

  Widget _buildSidebarItem(_NavItem item, bool isDark, bool isCollapsed) {
    final isActive = _isPathActive(item.path);
    final activeColor = AppColors.primary;

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: isCollapsed ? 12 : 12, vertical: 2),
      child: Tooltip(
        message: isCollapsed ? item.label : '',
        preferBelow: false,
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            context.go(item.path);
          },
          borderRadius: BorderRadius.circular(10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: EdgeInsets.symmetric(horizontal: isCollapsed ? 12 : 14, vertical: 12),
            decoration: BoxDecoration(
              color: isActive ? activeColor.withValues(alpha: 0.12) : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              border: isActive ? Border.all(color: activeColor.withValues(alpha: 0.3)) : null,
            ),
            child: Row(
              children: [
                Icon(item.icon, color: isActive ? activeColor : (isDark ? Colors.white60 : Colors.grey[600]), size: 20),
                if (!isCollapsed) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.label,
                      style: TextStyle(
                        color: isActive ? activeColor : (isDark ? Colors.white.withValues(alpha: 0.8) : Colors.black87),
                        fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  if (item.badge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: item.badgeColor ?? Colors.red, borderRadius: BorderRadius.circular(8)),
                      child: Text(item.badge!, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _logout() async {
    await FirebaseAuth.instance.signOut();
    if (mounted) {
      context.go(AppRouter.login);
    }
  }
}
