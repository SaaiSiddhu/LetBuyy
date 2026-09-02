import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart'; // ✅ Using shared Cyan theme
import 'package:provider/provider.dart';
import 'package:letbuyy_admin/providers/auth_provider.dart';

class AdminSidebar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onItemSelected;
  final bool isCollapsed;
  final VoidCallback onToggleCollapse;
  final bool isMobile; // Added to distinguishing drawer mode

  const AdminSidebar({
    super.key,
    required this.currentIndex,
    required this.onItemSelected,
    required this.isCollapsed,
    required this.onToggleCollapse,
    this.isMobile = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Calculate width: Mobile uses full width (drawer) or fixed, Desktop uses collapsed/expanded
    final double width = isMobile ? 280 : (isCollapsed ? 80 : 280);
    
    // Get status bar padding for mobile drawer
    final topPadding = isMobile ? MediaQuery.of(context).viewPadding.top : 0.0;

    return AnimatedContainer(
      duration: 300.ms,
      width: width,
      curve: Curves.fastOutSlowIn,
      child: GlassContainer(
        blur: isMobile ? 0 : 20,
        opacity: isMobile ? 1.0 : (isDark ? 0.8 : 0.95),
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.zero,
        border: Border(
          right: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
            width: 1,
          ),
        ),
        child: Column(
          children: [
            // 🎯 Status bar padding for mobile
            if (isMobile) SizedBox(height: topPadding),
            
            // Header
            _buildHeader(isDark, context),
            
            // Scrollable Menu
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                physics: const BouncingScrollPhysics(),
                children: [
                  _buildSectionHeader("MAIN", isDark),
                  _buildMenuItem(context, 0, Icons.dashboard_rounded, "Dashboard", isDark),
                  _buildMenuItem(context, 9, Icons.analytics_rounded, "Analytics", isDark),

                  const SizedBox(height: 16),
                  _buildSectionHeader("MANAGEMENT", isDark),
                  _buildMenuItem(context, 2, Icons.shopping_cart_rounded, "Orders", isDark),
                  _buildMenuItem(context, 1, Icons.inventory_2_rounded, "Products", isDark),
                  _buildMenuItem(context, 17, Icons.category_rounded, "Categories", isDark),
                  _buildMenuItem(context, 3, Icons.people_rounded, "Users", isDark),
                  _buildMenuItem(context, 8, Icons.storefront_rounded, "Sellers", isDark),
                  _buildMenuItem(context, 12, Icons.payments_rounded, "Payouts", isDark),
                  _buildMenuItem(context, 13, Icons.assignment_return_rounded, "Returns", isDark),
                  _buildMenuItem(context, 14, Icons.support_agent_rounded, "Support", isDark),

                  const SizedBox(height: 16),
                  _buildSectionHeader("MARKETING", isDark),
                  _buildMenuItem(context, 4, Icons.local_offer_rounded, "Coupons", isDark),
                  _buildMenuItem(context, 5, Icons.slideshow_rounded, "Banners", isDark),
                  _buildMenuItem(context, 6, Icons.video_library_rounded, "Sponsored", isDark),
                  _buildMenuItem(context, 7, Icons.notifications_rounded, "Notifications", isDark),
                  _buildMenuItem(context, 15, Icons.ads_click_rounded, "Seller Ads", isDark),
                  _buildMenuItem(context, 16, Icons.play_circle_rounded, "Reels", isDark),
                  _buildMenuItem(context, 18, Icons.local_fire_department_rounded, "Deals", isDark, badge: "NEW", badgeColor: AppColors.error),

                  const SizedBox(height: 16),
                  _buildSectionHeader("SYSTEM", isDark),
                  _buildMenuItem(context, 19, Icons.percent_rounded, "Commission", isDark, badge: "NEW", badgeColor: AppColors.primary),
                  _buildMenuItem(context, 10, Icons.settings_rounded, "Settings", isDark),
                  _buildMenuItem(context, 11, Icons.system_update_rounded, "Updates", isDark),
                  
                  // Mobile only logout
                  if (isMobile) ...[
                    const SizedBox(height: 24),
                    _buildLogoutButton(isDark, context),
                  ],
                  
                  // Bottom safe area padding for mobile
                  if (isMobile) SizedBox(height: MediaQuery.of(context).viewPadding.bottom + 16),
                ],
              ),
            ),
            
            // Desktop Collapse Button
            if (!isMobile) ...[
              const Divider(height: 1),
              _buildCollapseButton(isDark),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark, BuildContext context) {
    return Container(
      height: 80,
      alignment: Alignment.center,
      padding: EdgeInsets.symmetric(horizontal: isCollapsed && !isMobile ? 0 : 24),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight)),
      ),
      child: isCollapsed && !isMobile
        ? const Icon(Icons.verified_user_rounded, color: AppColors.primary, size: 32)
            .animate().scale(duration: 300.ms, curve: Curves.elasticOut)
        : Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: AppColors.primaryGradient,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.verified_user_rounded, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "LetBuyy",
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 20,
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      "Admin Panel",
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              if (isMobile)
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                  color: isDark ? AppColors.textLight : AppColors.textSecondary,
                ),
            ],
          ),
    );
  }

  Widget _buildSectionHeader(String title, bool isDark) {
    if (isCollapsed && !isMobile) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: isDark ? AppColors.textLightHint : AppColors.textHint,
          letterSpacing: 1.2,
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildMenuItem(BuildContext context, int index, IconData icon, String title, bool isDark, {String? badge, Color? badgeColor}) {
    final bool isSelected = currentIndex == index;
    final bool collapsed = isCollapsed && !isMobile;

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            onItemSelected(index);
            if (isMobile) Navigator.pop(context); // Close drawer on mobile
          },
          borderRadius: BorderRadius.circular(12),
          hoverColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03),
          child: AnimatedContainer(
            duration: 200.ms,
            padding: EdgeInsets.symmetric(
              horizontal: collapsed ? 0 : 16, 
              vertical: 12,
            ),
            decoration: BoxDecoration(
              color: isSelected 
                  ? AppColors.primary.withValues(alpha: isDark ? 0.2 : 0.1)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              border: isSelected 
                  ? Border.all(color: AppColors.primary.withValues(alpha: 0.3), width: 1)
                  : Border.all(color: Colors.transparent),
            ),
            child: collapsed
              ? Center(
                  child: Icon(
                    icon,
                    color: isSelected ? AppColors.primary : (isDark ? Colors.white54 : Colors.black54),
                    size: 24,
                  ),
                )
              : Row(
                  children: [
                    Icon(
                      icon,
                      color: isSelected ? AppColors.primary : (isDark ? Colors.white54 : Colors.black54),
                      size: 22,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          color: isSelected 
                              ? AppColors.primary 
                              : (isDark ? Colors.white70 : Colors.black87),
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    if (badge != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor?.withValues(alpha: 0.15) ?? AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: badgeColor?.withValues(alpha: 0.3) ?? AppColors.primary.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          badge,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: badgeColor ?? AppColors.primary,
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

  Widget _buildCollapseButton(bool isDark) {
    return InkWell(
      onTap: onToggleCollapse,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isCollapsed ? Icons.keyboard_double_arrow_right_rounded : Icons.keyboard_double_arrow_left_rounded,
              color: isDark ? Colors.white54 : Colors.black54,
              size: 20,
            ),
            if (!isCollapsed) ...[
              const SizedBox(width: 12),
              Text(
                "Collapse Sidebar",
                style: TextStyle(
                  color: isDark ? Colors.white54 : Colors.black54,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLogoutButton(bool isDark, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ElevatedButton.icon(
        onPressed: () {
          Provider.of<AuthProvider>(context, listen: false).signOut();
        },
        icon: const Icon(Icons.logout_rounded, size: 18),
        label: const Text("Sign Out"),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.error.withValues(alpha: 0.1),
          foregroundColor: AppColors.error,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          shadowColor: Colors.transparent,
        ),
      ),
    );
  }
}
